// Pure selection logic - no I/O, fully unit-testable.
// Entry shape: { id, provider, tier: free|paid|local, modes[], priority, capabilities[], pinned? }
// Provider shape: see registry.json.

export const MODES = ['chat', 'work', 'study', 'privacy'];
export const MODE_LABELS = { chat: 'Chat', work: 'Work', study: 'Study', privacy: 'Privacy' };

export const STYLES = ['plan', 'build'];

/**
 * Mode (right dropdown) and style (left selector) are independent.
 * Style comes from header/body; as a fallback a model id like 'Study - Plan' also works.
 */
export function parseModel(name) {
  const s = String(name || '').trim();
  const v = /^(?:satchida-)?(chat|work|study|privacy)\s*[-:]\s*(plan|build)$/i.exec(s);
  if (v) return { mode: v[1].toLowerCase(), variant: v[2].toLowerCase() };
  return { mode: modeFromModelName(s), variant: null };
}

export function normStyle(v) {
  const s = String(v || '').toLowerCase();
  return STYLES.includes(s) ? s : null;
}

export function modeFromModelName(name) {
  const m = /^(?:satchida-)?(chat|work|study|privacy)$/i.exec(String(name || '').trim());
  return m ? m[1].toLowerCase() : 'chat';
}

/**
 * Returns an ordered candidate list.
 * ctx: { mode, traffic: 'internal'|'revenue', needs: string[], now, state, hasKey(provider) }
 */
export function selectCandidates(registry, ctx) {
  const { mode, traffic, needs = [], now = Date.now(), state, hasKey, client } = ctx;
  const clientOverrides = registry.clientOverrides || {};
  const clientModeOrder = clientOverrides[client]?.modeOrder?.[mode];
  const order = clientModeOrder || registry.modeOrder[mode] || ['local'];
  const out = [];
  for (const e of registry.entries) {
    if (e.enabled === false) continue;
    const p = registry.providers[e.provider];
    if (!p || p.enabled === false || !p.baseURL) continue;
    if (!e.modes.includes(mode)) continue;
    if (!hasKey(e.provider)) continue;
    if (registry.revenueGate === 'on' && traffic === 'revenue' && !p.revenueSafe) continue; // optional licensing gate (off by operator decision)
    if (mode === 'privacy') {
      // fail closed: only local, or retention explicitly none
      if (!(p.locality === 'local' || p.retention === 'none')) continue;
    }
    if (mode === 'work' && p.retention !== 'none' && p.locality !== 'local') {
      // Work mode serves non-free (paid) models only from ZDR-compliant
      // providers (retention: "none") or local. Paid models from providers
      // that retain data (documented/unknown retention) are excluded.
      continue;
    }
    if (needs.some((n) => !e.capabilities.includes(n))) continue;
    if (state.isBlocked(e.provider, e.id, now)) continue;
    const rank = e.pinned && order.includes('pinned') ? order.indexOf('pinned') : order.indexOf(e.tier);
    if (rank < 0) continue;
    out.push({ e, rank });
  }
  out.sort((a, b) => a.rank - b.rank || a.e.priority - b.e.priority);
  return out.map((x) => x.e);
}

/**
 * Candidates for speech-to-text.
 *
 * Transcription is selected separately from chat because the two have different
 * rules that the mode order cannot express. Chat's order is free/paid, so a
 * local model has no rank and is skipped; that is correct for chat, where a
 * local model must not shadow a cloud one, but it would leave transcription with
 * no candidate at all.
 *
 * The selection is therefore: local providers only, audio-capable, ordered by
 * priority. Local is not a preference here, it is the requirement: a cloud
 * transcription endpoint would put the audio on someone else's infrastructure,
 * which is the one thing a local mode must never do.
 *
 * ctx: { now, state, hasKey }
 */
/**
 * Candidates for speech-to-text.
 *
 * Transcription is selected separately from chat because the two have different
 * rules that the mode order cannot express. Chat's order is free/paid, so a
 * local model has no rank and is skipped; that is correct for chat, where a
 * local model must not shadow a cloud one, but it would leave transcription with
 * no candidate at all.
 *
 * The selection is therefore: local providers only, audio-capable, ordered by
 * priority. Local is not a preference here, it is the requirement: a cloud
 * transcription endpoint would put the audio on someone else's infrastructure,
 * which is the one thing a local mode must never do.
 *
 * ctx: { now, state, hasKey }
 */
export function selectAudioCandidates(registry, ctx) {
  const { now = Date.now(), state, hasKey } = ctx;
  const out = [];
  for (const e of registry.entries) {
    if (e.enabled === false) continue;
    if (!e.capabilities?.includes('audio')) continue;
    const p = registry.providers[e.provider];
    if (!p || p.enabled === false || !p.baseURL) continue;
    if (p.locality !== 'local') continue;
    if (!hasKey(e.provider)) continue;
    if (state?.isBlocked?.(e.provider, e.id, now)) continue;
    out.push(e);
  }
  out.sort((a, b) => a.priority - b.priority);
  return out;
}

export function needsFromBody(body) {
  const needs = [];
  if (Array.isArray(body?.tools) && body.tools.length) needs.push('tools');
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  for (const m of msgs) {
    if (Array.isArray(m.content) && m.content.some((c) => c && c.type === 'image_url')) {
      needs.push('vision');
      break;
    }
  }
  return needs;
}
