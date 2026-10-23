#!/usr/bin/env node
/**
 * Converts opencode agents into LibreChat agents.
 *
 * WHY
 * ---
 * `~/.config/opencode/agent/*.md` holds 25 working agent personas written for
 * the operator's own coding harness. They are MIT/Apache-lineage (opencode is
 * MIT) and the instructions are genuinely good — notably `vibe-coder`, which is
 * the full-stack "Work" persona this product needs.
 *
 * None of them were visible in LibreChat: opencode agents are markdown with
 * opencode frontmatter, LibreChat agents are documents with instructions.
 *
 * WHAT IS REPAIRED
 * ----------------
 * 1. opencode frontmatter is dropped. `model: llama.cpp/Qwen3VL-...`,
 *    `fallback_models`, `mode`, `color` and `permission` are opencode concepts
 *    with no LibreChat equivalent. Copied through they would pin these agents to
 *    a model that does not exist here, and would suggest a sandbox permission
 *    model the host does not implement. Every agent is bound to the Satchida
 *    `Work` endpoint instead, which is where the router decides the model.
 * 2. Agents whose whole purpose is opencode's own provider/router machinery are
 *    excluded — they would talk a user into a provider that isn't configured.
 *
 * Idempotent, keyed on agent name.
 *
 * Usage:
 *   SATCHIDA_ADMIN_PASSWORD=... node scripts/convert-opencode-agents.mjs [--dry-run] [--force]
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config();

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

const AGENT_DIR = process.env.OPENCODE_AGENT_DIR ?? 'C:/Users/WinDiesel/.config/opencode/agent';
const BASE_URL = process.env.SATCHIDA_URL ?? 'http://127.0.0.1:3080';
const EMAIL = process.env.SATCHIDA_ADMIN_EMAIL ?? 'admin@satchida.local';
const PASSWORD = process.env.SATCHIDA_ADMIN_PASSWORD;

const PROVIDER = 'Satchida';
const MODEL = 'Work';
const CATEGORY = 'general';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Excluded agents, with the reason.
 *
 * These exist to drive opencode's own multi-provider routing stack (model
 * catalogues, free-tier scouting, provider health). None of that infrastructure
 * exists in this product — the Satchida router owns model selection — so as
 * LibreChat agents they would confidently recommend endpoints that aren't
 * configured. `vibe-coder` and the security/research personas are kept.
 */
const EXCLUDED = {
  'auto-router': 'Drives opencode model auto-routing; the Satchida router owns model selection.',
  'router-advisor': 'Advises on the opencode router registry, not this product.',
  'free-model-scout': 'Scouts free-tier provider models for opencode; no such catalogue here.',
  'provider-healthbot': 'Monitors opencode provider endpoints; providers are reached through the Satchida router.',
  'model-provider-bot': 'Configures opencode provider plugins and auth; not applicable.',
  'local-chat': 'Describes the opencode local chat harness rather than a task an agent performs.',
  'browser-operator': 'Duplicates the Playwright MCP server already registered; use the MCP tools instead.',
};

/** frontmatter keys that are opencode-only and must not leak into instructions. */
const OPENCODE_ONLY_KEYS = new Set([
  'model',
  'fallback_models',
  'mode',
  'color',
  'steps',
  'permission',
  'tools',
  'temperature',
  'top_p',
]);

/**
 * Minimal frontmatter reader. These files are simple `key: value` and
 * `key:` + list pairs; a full YAML parse would also pull in nested structures
 * that are all being discarded anyway.
 */
function readFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const line2 = line.trim();
    if (!line2 || line2.startsWith('#')) continue;
    const idx = line2.indexOf(':');
    if (idx === -1) continue;
    const key = line2.slice(0, idx).trim();
    const value = line2.slice(idx + 1).trim();
    if (OPENCODE_ONLY_KEYS.has(key)) continue;
    if (value) meta[key] = value;
  }
  return { meta, body: match[2] ?? '' };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Human title from the filename: `vibe-coder` -> `Vibe Coder`. */
function titleFromFile(fileBase) {
  return fileBase
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseAgent(filePath) {
  const fileBase = path.basename(filePath, '.md');
  const raw = fs.readFileSync(filePath, 'utf8');
  const { meta, body } = readFrontmatter(raw);
  const instructions = body.trim();

  let description = meta.description;
  if (!description) {
    const line = instructions
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#') && !l.startsWith('|'));
    description = line ?? titleFromFile(fileBase);
  }
  description = description.replace(/\s+/g, ' ').trim();
  if (description.length > 300) description = `${description.slice(0, 297)}...`;

  return {
    id: slugify(fileBase),
    name: titleFromFile(fileBase),
    description,
    instructions,
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
  if (!fs.existsSync(AGENT_DIR)) {
    console.error(`opencode agent directory not found: ${AGENT_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(AGENT_DIR)
    /* `.bak` files are stale historical copies of the same agent; including
       them would create near-duplicate agents under the same name. */
    .filter((f) => f.endsWith('.md') && !f.includes('.bak'));

  const parsed = files.map((f) => parseAgent(path.join(AGENT_DIR, f)));
  const agents = parsed.filter((a) => !(a.id in EXCLUDED));
  const excluded = parsed.filter((a) => a.id in EXCLUDED);

  console.log(`source: ${AGENT_DIR}`);
  console.log(`parsed ${parsed.length}, merging ${agents.length}, excluding ${excluded.length}`);
  if (excluded.length) {
    console.log('\nEXCLUDED:');
    for (const a of excluded) console.log(`  ${a.id.padEnd(22)} ${EXCLUDED[a.id]}`);
  }

  if (DRY_RUN) {
    for (const a of agents) {
      console.log(`\n--- ${a.name} (${a.id})  ${a.instructions.length} chars`);
      console.log(`    ${a.description.slice(0, 130)}`);
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
    const body = {
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
      provider: PROVIDER,
      model: MODEL,
      category: CATEGORY,
      is_promoted: false,
    };
    const existingAgent = byName.get(agent.name);
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
        console.log(`  CREATED ${agent.name}  (${agent.instructions.length} chars)`);
      }
    } catch (error) {
      failed.push({ name: agent.name, error: error.message });
      console.log(`  FAILED  ${agent.name}: ${error.message.slice(0, 140)}`);
    }
  }

  console.log(`\ncreated ${created}, updated ${updated}, skipped ${skipped}, failed ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  ${f.name}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});