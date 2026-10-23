#!/usr/bin/env node
/**
 * Satchida edge-node guardrail — PreToolUse.
 *
 * Decides whether a proposed shell invocation may run on a client edge node.
 * Deliberately deterministic: a guardrail that depends on a model is a
 * guardrail that fails open on a bad day, and this one protects the operator's
 * production GPU servers and the HQ keyring.
 *
 * Contract (packages/api/src/agents/hooks/executor.ts):
 *   stdin  — the event payload as JSON
 *   exit 0 + JSON stdout -> hook output merged into the run
 *   exit 2 + stderr       -> BLOCKS the tool call, stderr is the user-facing reason
 *   any other exit        -> logged and ignored (fails open)
 *
 * Blocking is advisory-by-design: a false positive costs one clarification, a
 * false negative costs a VRAM-exhausting duplicate llama-server.
 */

import fs from 'node:fs';

const BLOCK_EXIT = 2;

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

const payload = readStdin();
const toolInput = payload.tool_input ?? {};

/**
 * The command text, whichever shape the tool used. LibreChat's bash tool calls
 * it `command`; the Claude-compat alias surface calls it `cmd`.
 */
const rawCommand = [toolInput.command, toolInput.cmd, toolInput.script]
  .filter((v) => typeof v === 'string')
  .join('\n')
  .toLowerCase();

const args = Array.isArray(toolInput.args) ? toolInput.args.join(' ').toLowerCase() : '';
/** Windows separators are normalized so one pattern covers both shells. */
const haystack = `${rawCommand} ${args}`.replace(/\\/g, '/');

/**
 * Recursive delete is checked in two steps rather than one regex: the flag set
 * and the target can appear in either order (`Remove-Item -Recurse -Force C:\`
 * and `rm -rf /` are the same act written differently), and flag-order-sensitive
 * patterns get this wrong.
 */
function isRecursiveRootDelete(text) {
  const IS_DELETE = /\brm\b[^|;&]*?-[\w]*[rf][\w]*|\bremove-item\b[^|;&]*?-recurse|\bdel\b\s+\/f\s+\/s\b/;
  if (!IS_DELETE.test(text)) {
    return false;
  }
  /* A root is: bare `/`, a home reference, or a drive root. A NAMED
     subdirectory (`./build`, `node_modules`, `dist/`) is an ordinary clean. */
  const IS_ROOT_TARGET =
    /(^|[\s;&|"'])\/(\s|$|;|&|")|(^|[\s;&|"'])~\/?(\s|$|;|&|")|\$home\/?(\s|$|;|&|")|(^|[\s;&|"'])[a-z]:\/?(\s|$|;|&|")/;
  return IS_ROOT_TARGET.test(text);
}

/**
 * Each rule is [id, test, reason]. Order matters: the first match wins, so the
 * specific operational rules come before the generic filesystem ones.
 */
const RULES = [
  [
    'llama-server',
    /\b(llama-server|llama_cpp|llama\.exe)\b|taskkill\s+\/f\s+.*(8080|8091)|\b(f|taskkill|kill)\s+.*\b(llama-server)\b/,
    'Refusing to touch the llama-server processes on ports 8080/8091. Those are the operator\'s production inference on a single 12 GB GPU; a second process will exhaust VRAM, and stopping one interrupts live traffic. Use the documented model switch instead.',
  ],
  [
    'infrastructure-services',
    /\b(nssm\s+(install|remove|start|stop)|sc\s+(create|delete|config|stop)\b|new-service|start-service|stop-service|systemctl)\b/,
    'Refusing to install or control a Windows service. Service installation changes what survives a reboot and needs an approved maintenance window. Raise it with the operator.',
  ],
  [
    'firewall',
    /\b(netsh\s+advfirewall|new-netfirewallrule|set-netfirewallprofile|iptables|ufw\s+(enable|disable))\b/,
    'Refusing to change firewall rules. Edge nodes are outbound-only behind a Cloudflare Named Tunnel; inbound port changes are not part of the deployment design.',
  ],
  [
    'docker',
    /\b(docker\s+(run|compose|build|pull)|podman\s+run|wsl\s+--install)\b/,
    'Refusing to run Docker on a Windows client node. Satchida edge deployments are native Windows (LibreChat, MongoDB, cloudflared, PM2) — Docker is an HQ-only construct.',
  ],
  [
    'keyring',
    /(\/programdata\/satchida\/keyring|master\.key|(^|[\s"'=])\.env\b|signing\.key\.pem|\bid_rsa\b|\bid_ed25519\b|\.ssh\/|fleet\/\.state)/,
    'Refusing to read credential material. Real provider keys and the gateway signing keypair live at HQ only and must never be read into a transcript, log or report. Name the variable instead.',
  ],
  [
    'credential-exfil',
    /\b(curl|wget|http|invoke-webrequest|invoke-restmethod)\b[^|;&]{0,200}(authorization|x-api-key|api[_-]?key|secret|bearer)/,
    'Refusing to send credential material to an external endpoint. Operator policy requires explicit approval for each destination; a key pasted into a request is already disclosed. Ask the operator, or reference the HQ keyring by variable name.',
  ],
  [
    'credential-print',
    /\b(type|cat|get-content|more|findstr)\b[^|;&]{0,80}(\.env\b|master\.key|signing\.key\.pem)|echo[^|;&]{0,40}(api[_-]?key|secret|token)/,
    'Refusing to print credential material. Refer to the variable name and read the value from the HQ keyring instead.',
  ],
  [
    'disk-wipe',
    /\b(format\s+[a-z]:|mkfs|dd\s+if=.*of=\/dev\/[sh]d|diskpart|clean\s+all|cipher\s+\/w)/,
    'Refusing a destructive disk operation.',
  ],
  [
    'recursive-delete',
    () => isRecursiveRootDelete(haystack),
    'Refusing a recursive delete of a filesystem root, a home directory or a whole drive. Delete inside the working directory or the plugin data directory instead.',
  ],
  [
    'git-history-rewrite',
    /git\s+push\s+(--force|-f)\b|git\s+reset\s+--hard|git\s+push\s+.*--delete|git\s+filter-branch/,
    'Refusing to rewrite shared git history. Force-push and hard reset destroy work that exists nowhere else.',
  ],
  [
    'registry-services',
    /(reg\s+add|reg\s+delete|hklm\/system\/currentcontrolset\/services|hklm\\system\\currentcontrolset\\services)/,
    'Refusing to modify the registry. Service and credential configuration is operator-only.',
  ],
];

for (const [id, test, reason] of RULES) {
  const matched = typeof test === 'function' ? test() : test.test(haystack);
  if (matched) {
    process.stderr.write(reason);
    process.exit(BLOCK_EXIT);
  }
}

// Allow. An empty object is a no-op hook output.
process.stdout.write('{}');
process.exit(0);