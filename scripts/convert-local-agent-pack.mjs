#!/usr/bin/env node
/**
 * Converts the local "Satchida Reusable Build Agent Pack" into LibreChat agents.
 *
 * WHAT THIS IS FIXING
 * -------------------
 * D:/LAN-AI-Infra/agents/agents/*.md holds 36 genuine, well-written agent
 * personas (Architecture Reviewer, Code Reviewer, SAST Analyzer, DAST Analyzer,
 * UI Visual QA, ...). They are NOT LibreChat agents: LibreChat stores agents as
 * documents with name/description/instructions, not as markdown files. Nothing
 * reads these files, which is why the agent list looked empty.
 *
 * They also carry two defects that would ship straight into the product:
 *
 *   1. A stale workspace path — `C:/LAN-AI-Infra/LMS` (wrong drive letter and
 *      a repo that is not this one). Every agent would tell the model to
 *      operate on a directory that does not exist.
 *   2. A "Skill Sources" section naming skills that are not installed in
 *      LibreChat, which reads as an instruction to use a capability that
 *      isn't there.
 *
 * Both are repaired here rather than copied verbatim.
 *
 * Idempotent, keyed on agent NAME (the create API assigns its own ids).
 *
 * Usage:
 *   SATCHIDA_ADMIN_PASSWORD=... node scripts/convert-local-agent-pack.mjs
 *   ... --dry-run
 *   ... --force
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config();

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

const SOURCE_DIR = process.env.SATCHIDA_AGENT_PACK ?? 'D:/LAN-AI-Infra/agents/agents';
const MANIFEST = path.join(path.dirname(SOURCE_DIR), 'agent-manifest.json');
const BASE_URL = process.env.SATCHIDA_URL ?? 'http://127.0.0.1:3080';
const EMAIL = process.env.SATCHIDA_ADMIN_EMAIL ?? 'admin@satchida.local';
const PASSWORD = process.env.SATCHIDA_ADMIN_PASSWORD;

const PROVIDER = 'Satchida';
const MODEL = 'Work';
const CATEGORY = 'general';

/**
 * Agents that are NOT merged, with the reason each one is excluded.
 *
 * The pack was authored for a different product line — an LMS/training suite on
 * a shared LAN, with its own Casdoor identity server and an RBI-regulated
 * training-content pipeline. Most of these agents are bound to that product's
 * tooling or domain rather than to a transferable engineering skill, so merging
 * them would ship agents that reference tools (`lan_audit`, `lan_bi`,
 * `lan_connectors`, `Dagger`) and services that do not exist here. An agent that
 * confidently invokes a missing binary is worse than no agent.
 *
 * Kept deliberately: anything whose core skill is generic engineering,
 * security, or operations and whose references resolve in this deployment.
 * Several of those still mention the LMS in passing; their missions are generic
 * and are merged as-is.
 */
const EXCLUDED = {
  'architecture-reviewer':
    'Reviews LMS pages, live session sync, labs and assessments — a different product, not this instance.',
  'audit-runner': 'Invokes `lan_audit`, a scanner that is not installed in this deployment.',
  'autosecposm-security-builder': 'Builds and verifies the AutoSecPosM suite, not this product.',
  'aws-agent': 'Audits AWS resources. There is no AWS estate in this deployment.',
  'azure-agent': 'Audits Azure subscriptions. There is no Azure estate in this deployment.',
  'active-directory-agent': 'Audits Active Directory domains and GPOs. No AD domain here.',
  'casdoor-registrar': 'Registers apps in a Casdoor server at localhost:9200 that does not exist here.',
  'connector-runner': 'Executes `lan_connectors` entries (WhatsApp, Drive, Telegram) — missing tooling.',
  'edge-device-agent': 'Audits edge devices reached through proxy tunnels. No such device fleet here.',
  'iot-scanner-agent': 'Discovers IoT devices (cameras, NVRs, PLCs). Out of scope for this deployment.',
  'report-generator': 'Runs BI tasks through `lan_bi`, which is not installed here.',
  'report-synthesizer-agent':
    'Produces RBI compliance binders for Indian banking-regulated training content — a different product domain.',
  'release-engineer':
    'Deploys through Dagger pipelines to a LAN target; this fork ships no Dagger pipeline.',
  'service-activator': 'Drives the "Satchida Services Manager", a control surface that does not exist here.',
  'content-quality-reviewer':
    'Grades cybersecurity/AI course content for level and session duration — training content, not this product.',
};

/** LibreChat rejects requests without a browser User-Agent (middleware/uaParser). */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Paths that were baked into the pack when it was authored. */
const PATH_FIXES = [
  [/\bC:\/LAN-AI-Infra\/LMS\b/gi, 'D:/LAN-AI-Infra/LibreChat'],
  [/\bC:\\LAN-AI-Infra\\LMS\b/g, 'D:\\LAN-AI-Infra\\LibreChat'],
  [/\bD:\/LAN-AI-Infra\/agents\/reports\b/g, 'D:/LAN-AI-Infra/LibreChat/data/reports'],
  [/\bD:\\LAN-AI-Infra\\agents\\reports\b/g, 'D:\\LAN-AI-Infra\\LibreChat\\data\\reports'],
];

function applyPathFixes(text) {
  let out = text;
  for (const [pattern, replacement] of PATH_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * The `## Skill Sources` section names skills that are not installed in
 * LibreChat. Left in place it instructs the model to reach for capabilities
 * that do not exist here, which produces confident nonsense. Replaced with an
 * accurate statement of where skills actually come from.
 */
function replaceSkillSources(body, skillNames) {
  const sectionRe = /^##\s*Skill Sources\s*$[\s\S]*?(?=^##\s|\Z)/m;
  if (!sectionRe.test(body)) {
    return { body, referenced: [] };
  }
  const original = body.match(sectionRe)?.[0] ?? '';
  const referenced = [...original.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter(Boolean);
  const replacement = skillNames.length
    ? `## Skills\nPrefer a matching skill when one applies. Skills installed on this instance are listed in the Skills panel; do not assume a skill exists because it is named elsewhere.\n\n`
    : '';
  return { body: body.replace(sectionRe, replacement), referenced };
}

/** Kebab-case slug from a display name or filename. */
function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** First non-heading sentence of a section, used as the marketplace blurb. */
function extractMission(body, fallbackTitle) {
  const mission = body.match(/^##\s*Mission\s*$([\s\S]*?)(?=^##\s|\Z)/m)?.[1]?.trim();
  const source = mission ?? body;
  const line = source
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('|'));
  const cleaned = (line ?? fallbackTitle)
    .replace(/^[-\d.\s]+/, '')
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .trim();
  return cleaned.length > 300 ? `${cleaned.slice(0, 297)}...` : cleaned;
}

/** Load the installed skill names so the converter can tell real skills from ghosts. */
function installedSkillNames() {
  const skillDir = 'skill';
  try {
    return new Set(
      fs
        .readdirSync(skillDir)
        .filter((d) => fs.existsSync(path.join(skillDir, d, 'SKILL.md'))),
    );
  } catch {
    return new Set();
  }
}

function parseAgent(filePath, installedSkills) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const fileBase = path.basename(filePath, '.md');

  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fileBase;
  const { body, referenced } = replaceSkillSources(raw, [...installedSkills]);

  const missingSkills = referenced.filter((s) => !installedSkills.has(s));
  const instructions = applyPathFixes(body).trim();

  return {
    id: slugify(fileBase),
    name: title,
    description: extractMission(raw, title),
    instructions,
    referencedSkills: referenced,
    missingSkills,
  };
}

async function api(path_, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path_}`, {
    method,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path_} -> HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${method} ${path_} -> HTTP ${response.status}: ${JSON.stringify(parsed).slice(0, 250)}`);
  }
  return parsed;
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Agent pack not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const installedSkills = installedSkillNames();
  console.log(`installed skills on this instance: ${installedSkills.size}`);

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(SOURCE_DIR, f));

  const parsed = files.map((f) => parseAgent(f, installedSkills));
  const agents = parsed.filter((a) => !(a.id in EXCLUDED));
  const excluded = parsed.filter((a) => a.id in EXCLUDED);

  console.log(`parsed ${parsed.length} agent definition(s) from ${SOURCE_DIR}`);
  console.log(`merging ${agents.length}, excluding ${excluded.length}`);

  if (excluded.length) {
    console.log('\nEXCLUDED (bound to a different product line):');
    for (const a of excluded) {
      console.log(`  ${a.id.padEnd(30)} ${EXCLUDED[a.id]}`);
    }
  }

  const ghostSkills = new Set();
  for (const a of agents) {
    for (const s of a.missingSkills) ghostSkills.add(s);
  }
  if (ghostSkills.size) {
    console.log(
      `\n${ghostSkills.size} referenced skill(s) are NOT installed; their "Skill Sources" section was replaced so the model does not chase capabilities that do not exist:`,
    );
    console.log(`  ${[...ghostSkills].join(', ')}`);
  }

  if (DRY_RUN) {
    for (const a of agents) {
      console.log(`\n--- ${a.name} (${a.id})`);
      console.log(`    desc: ${a.description.slice(0, 120)}`);
      console.log(`    instructions: ${a.instructions.length} chars`);
    }
    return;
  }

  if (!PASSWORD) {
    console.error('Set SATCHIDA_ADMIN_PASSWORD before running without --dry-run.');
    process.exit(1);
  }

  const auth = await api('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = auth.token;
  console.log(`\nauthenticated as ${auth.user?.name ?? EMAIL}`);

  const existing = await api('/api/agents?requiredPermission=1&limit=1000', { token });
  const byName = new Map((existing.data ?? []).map((a) => [a.name, a]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failed = [];

  for (const agent of agents) {
    const existingAgent = byName.get(agent.name);
    const body = {
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
      provider: PROVIDER,
      model: MODEL,
      category: CATEGORY,
      is_promoted: false,
    };

    try {
      if (existingAgent) {
        if (!FORCE) {
          skipped += 1;
          continue;
        }
        await api(`/api/agents/${encodeURIComponent(existingAgent.id)}`, {
          method: 'PATCH',
          token,
          body,
        });
        updated += 1;
        console.log(`  UPDATED ${agent.name}`);
      } else {
        await api('/api/agents', { method: 'POST', token, body });
        created += 1;
        console.log(`  CREATED ${agent.name}`);
      }
    } catch (error) {
      failed.push({ name: agent.name, error: error.message });
      console.log(`  FAILED  ${agent.name}: ${error.message.slice(0, 120)}`);
    }
  }

  console.log(`\ncreated ${created}, updated ${updated}, skipped ${skipped}, failed ${failed.length}`);
  if (failed.length) {
    console.log('\nfailures:');
    for (const f of failed) console.log(`  ${f.name}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});