// Cooldown + circuit-breaker state. In-memory (single router process; Redis is
// deliberately omitted on Windows, see DEPLOYMENT.md). Optional JSON persistence.
import fs from 'node:fs';

export class RouterState {
  constructor({ file = null, failWindow = 20, failThreshold = 0.5, minSamples = 4, openMs = 60_000 } = {}) {
    this.file = file;
    this.cool = new Map(); // key -> untilEpoch
    this.hist = new Map(); // key -> boolean[] (true=ok)
    this.cfg = { failWindow, failThreshold, minSamples, openMs };
    if (file && fs.existsSync(file)) {
      try {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const [k, v] of Object.entries(j.cool || {})) this.cool.set(k, v);
      } catch { /* ignore corrupt state */ }
    }
  }
  key(provider, id) { return `${provider}::${id}`; }
  isBlocked(provider, id, now = Date.now()) {
    const until = Math.max(this.cool.get(this.key(provider, id)) || 0, this.cool.get(`${provider}::*`) || 0);
    return until > now;
  }
  cooldown(provider, id, ms, now = Date.now()) {
    this.cool.set(id === '*' ? `${provider}::*` : this.key(provider, id), now + ms);
    this.persist();
  }
  record(provider, id, ok, now = Date.now()) {
    const k = this.key(provider, id);
    const h = this.hist.get(k) || [];
    h.push(ok);
    if (h.length > this.cfg.failWindow) h.shift();
    this.hist.set(k, h);
    if (h.length >= this.cfg.minSamples) {
      const failRate = h.filter((x) => !x).length / h.length;
      if (failRate >= this.cfg.failThreshold) {
        this.cool.set(k, now + this.cfg.openMs);
        this.hist.set(k, []);
        this.persist();
      }
    }
  }
  persist() {
    if (!this.file) return;
    try { fs.writeFileSync(this.file, JSON.stringify({ cool: Object.fromEntries(this.cool) }), 'utf8'); } catch { /* non-fatal */ }
  }
  snapshot(now = Date.now()) {
    const o = {};
    for (const [k, v] of this.cool) if (v > now) o[k] = Math.round((v - now) / 1000) + 's';
    return o;
  }
}

/** Parse Retry-After (seconds or HTTP date); clamp 5s..6h; default 60s. */
export function retryAfterMs(headers, fallback = 60_000) {
  const v = headers?.get?.('retry-after');
  if (!v) return fallback;
  const n = Number(v);
  let ms = Number.isFinite(n) ? n * 1000 : Date.parse(v) - Date.now();
  if (!Number.isFinite(ms)) ms = fallback;
  return Math.min(Math.max(ms, 5_000), 6 * 3600_000);
}
