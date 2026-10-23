import fs from 'node:fs';

/** Merge static models + discovered free models + pins into flat entries. */
export function buildEntries(raw, discovered = []) {
  const entries = [];
  const seen = new Set();
  const pinRx = (raw.pins || []).map((p) => ({ ...p, rx: new RegExp(p.idRegex, 'i') }));
  const add = (e) => {
    const k = `${e.provider}::${e.id}`;
    if (seen.has(k)) return;
    seen.add(k);
    if (e.modes && e.modes.includes('work') && !e.modes.includes('study')) e.modes = [...e.modes, 'study']; // Study draws from the Work pool
    const pin = pinRx.find((p) => p.rx.test(e.id));
    if (pin) {
      e.pinned = true;
      e.priority = pin.priority ?? e.priority;
      e.modes = [...new Set([...(e.modes || []), ...(pin.modes || [])])];
    }
    entries.push(e);
  };
  for (const f of freeFromFile(raw)) add(f);
  for (const m of raw.models || []) add({ capabilities: ['text', 'streaming'], priority: 100, modes: ['chat'], ...m });
  for (const d of discovered) add({ capabilities: ['text', 'streaming'], priority: 200, tier: 'free', ...d });
  return entries;
}

/** Import the shared opencode free list ("provider/model-id" strings). */
export function freeFromFile(raw) {
  if (!raw.freeListFile) return [];
  let list;
  try { list = JSON.parse(fs.readFileSync(raw.freeListFile, 'utf8')); } catch { return []; }
  const skip = raw.freeListSkipRegex ? new RegExp(raw.freeListSkipRegex, 'i') : null;
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    const i = String(s).indexOf('/');
    if (i < 1) continue;
    const provider = s.slice(0, i); const id = s.slice(i + 1);
    if (!raw.providers[provider] || (skip && skip.test(id))) continue;
    const caps = ['text', 'tools', 'streaming'];
    if (raw.visionRegex && new RegExp(raw.visionRegex, 'i').test(id)) caps.push('vision');
    out.push({ id, provider, tier: 'free', modes: ['chat', 'work'], priority: 150, capabilities: caps });
  }
  return out;
}

export function loadRegistry(file, discovered = []) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  return { providers: raw.providers, modeOrder: raw.modeOrder, defaultTraffic: raw.defaultTraffic || 'internal', revenueGate: raw.revenueGate || 'off', raw, entries: buildEntries(raw, discovered) };
}

/** Query providers that declare `discover`; returns discovered entries. Never throws. */
export async function discoverFree(raw, env = process.env, fetchFn = fetch, log = () => {}) {
  const out = [];
  for (const [name, p] of Object.entries(raw.providers)) {
    if (!p.discover || p.enabled === false) continue;
    try {
      const headers = {};
      if (p.keyEnv && env[p.keyEnv]) headers.authorization = `Bearer ${env[p.keyEnv]}`;
      const res = await fetchFn(`${p.baseURL}/models`, { headers, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { log(`discover ${name}: HTTP ${res.status}`); continue; }
      const j = await res.json();
      const list = Array.isArray(j.data) ? j.data : [];
      for (const m of list) {
        const id = String(m.id || '');
        let free = false;
        if (p.discover.type === 'openrouter') {
          free = id.endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0);
        } else if (p.discover.freeNameRegex) {
          free = new RegExp(p.discover.freeNameRegex, 'i').test(id);
        }
        if (!free) continue;
        const caps = ['text', 'streaming'];
        const params = m.supported_parameters;
        if (Array.isArray(params) && params.includes('tools')) caps.push('tools');
        const mods = m.architecture?.input_modalities;
        if (Array.isArray(mods) && mods.includes('image')) caps.push('vision');
        out.push({ id, provider: name, modes: p.discover.mode || ['chat'], capabilities: caps, discovered: true });
      }
      log(`discover ${name}: ${out.filter((x) => x.provider === name).length} free models`);
    } catch (err) {
      log(`discover ${name}: ${err.message}`);
    }
  }
  return out;
}
