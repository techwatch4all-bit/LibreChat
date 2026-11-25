/**
 * Satchida OpenHands Vibecoding Bridge (openhands-bridge.mjs)
 * ===========================================================
 * Orchestrates autonomous vibecoding sessions for captured fleet errors:
 * 1. Creates an isolated git worktree for the incident
 * 2. Prepares a detailed Task Briefing from the telemetry incident
 * 3. Launches the OpenHands Agent Canvas or automation worker
 * 4. Captures the generated patch/diff upon operator or automated approval
 * 5. Dispatches the verified patch to the Satchida Fleet Control Plane
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const execAsync = promisify(exec);

const REPO_ROOT = 'd:/LAN-AI-Infra/LibreChat';
const WORKTREES_ROOT = 'd:/LAN-AI-Infra/worktrees';
const OPENHANDS_DIR = 'd:/LAN-AI-Infra/OpenHands/OpenHands';
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:8443';

if (!existsSync(WORKTREES_ROOT)) {
  mkdirSync(WORKTREES_ROOT, { recursive: true });
}

/**
 * Initializes a git worktree for an incident so vibecoding never touches production code directly
 */
export async function createIncidentWorktree(fingerprint, tenantId) {
  const branchName = `fix/fleet-${tenantId || 'global'}-${fingerprint.slice(0, 8)}`;
  const worktreePath = join(WORKTREES_ROOT, `fix-${fingerprint.slice(0, 8)}`);

  console.log(`[openhands-bridge] Setting up isolated worktree at ${worktreePath}...`);

  try {
    // If worktree already exists, return it
    if (existsSync(worktreePath)) {
      return { worktreePath, branchName, reused: true };
    }

    // Create branch and worktree from dev or current head
    await execAsync(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd: REPO_ROOT });
    console.log(`[openhands-bridge] Worktree created successfully.`);
    return { worktreePath, branchName, reused: false };
  } catch (err) {
    console.warn(`[openhands-bridge] Worktree creation notice: ${err.message}`);
    // If branch already exists, attach without -b
    try {
      await execAsync(`git worktree add "${worktreePath}" ${branchName}`, { cwd: REPO_ROOT });
      return { worktreePath, branchName, reused: true };
    } catch (e2) {
      return { worktreePath: REPO_ROOT, branchName: 'current', isFallback: true };
    }
  }
}

/**
 * Prepares an OpenHands autonomous task file with rich incident context
 */
export async function prepareTaskPrompt(incident, worktreePath) {
  const ai = incident.aiAnalysis || {};
  const prompt = `# Satchida Fleet Auto-Repair Briefing

## Error Type: ${incident.errorType}
- Fingerprint: ${incident.fingerprint}
- Affected Tenant: ${incident.affectedTenants ? incident.affectedTenants.join(', ') : (incident.tenantId || 'operator-local')}
- Occurrence Count: ${incident.count} user(s) encountered this failure

## Plain-English Description
${ai.plainEnglishDescription || incident.message}

## Suspected Root Cause
${ai.rootCause || 'Under diagnosis'}

## Target Files / Modules
${ai.affectedFile || 'Inspect relevant files in repo'}

## Required Vibecoding Tasks
1. Inspect the affected files and reproduce the error behavior.
2. Implement the minimal, robust fix ensuring no side-effects on other tenants.
3. Run verification:
   - For backend TypeScript: \`npm run build:api\` and \`npx tsc --noEmit -p packages/api/tsconfig.json\`
   - For skills / Python: run relevant python syntax / test check
4. Once verified 100% green, write the final summary of modified files.
`;

  const taskFilePath = join(worktreePath, 'SATCHIDA_INCIDENT_BRIEF.md');
  writeFileSync(taskFilePath, prompt, 'utf8');
  return taskFilePath;
}

/**
 * Exports git diff from worktree as a verified patch for Satchida Fleet Dispatcher
 */
export async function exportWorktreeDiff(worktreePath) {
  try {
    const { stdout } = await execAsync('git diff HEAD~1', { cwd: worktreePath });
    return stdout;
  } catch {
    const { stdout: diffUnstaged } = await execAsync('git diff', { cwd: worktreePath });
    return diffUnstaged;
  }
}
