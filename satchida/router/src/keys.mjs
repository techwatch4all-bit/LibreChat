// Resolve a provider API key: env var first, then (HQ PC only) the opencode auth store.
// Never logs or returns keys to callers other than the upstream request builder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const AUTH = process.env.ROUTER_OPENCODE_AUTH || path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
let cache = { at: 0, data: {} };

function readAuth(now = Date.now()) {
  if (now - cache.at < 30_000) return cache.data;
  let data = {};
  try { data = JSON.parse(fs.readFileSync(AUTH, 'utf8')); } catch { /* absent on client nodes */ }
  cache = { at: now, data };
  return data;
}

export function needsKey(p) { return !!(p.keyEnv || p.keyFrom); }

export function resolveKey(p, env = process.env) {
  if (p.keyEnv && env[p.keyEnv]) return env[p.keyEnv];
  const id = p.keyFrom?.opencodeAuth;
  if (id) { const e = readAuth()[id]; if (e && e.key) return e.key; }
  return null;
}

export const hasKeyFor = (p, env = process.env) => !needsKey(p) || !!resolveKey(p, env);
