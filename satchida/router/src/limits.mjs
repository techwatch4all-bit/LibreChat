// In-memory sliding-window limits + admission control. Single router process.

export class SlidingLimiter {
  constructor() { this.hits = new Map(); } // key -> number[] timestamps (ms)
  /** Returns {ok, retryAfterMs, used, limit, window}. Checks all rules, records hit only if all pass. */
  check(key, rules, now = Date.now()) {
    const arr = (this.hits.get(key) || []).filter((t) => now - t < 86_400_000);
    for (const r of rules) {
      if (!r.limit || r.limit <= 0) continue;
      const inWin = arr.filter((t) => now - t < r.windowMs);
      if (inWin.length >= r.limit) {
        this.hits.set(key, arr);
        return { ok: false, retryAfterMs: Math.max(1000, r.windowMs - (now - inWin[0])), used: inWin.length, limit: r.limit, window: r.name };
      }
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { ok: true };
  }
  sweep(now = Date.now()) {
    for (const [k, a] of this.hits) { const f = a.filter((t) => now - t < 86_400_000); f.length ? this.hits.set(k, f) : this.hits.delete(k); }
  }
}

export function rulesFor(limits, scope, mode) {
  const out = [];
  const c = limits?.[scope];
  if (!c) return out;
  if (c.h5) out.push({ name: '5h', windowMs: 5 * 3600_000, limit: c.h5[mode] ?? c.h5.default });
  if (c.day) out.push({ name: 'day', windowMs: 86_400_000, limit: c.day[mode] ?? c.day.default });
  return out;
}

/** Bounded concurrency with FIFO queue and wait timeout - protects the single local GPU. */
export class Gate {
  constructor({ max = 8, maxQueue = 64, waitMs = 45_000 } = {}) { Object.assign(this, { max, maxQueue, waitMs }); this.active = 0; this.q = []; }
  acquire() {
    if (this.active < this.max) { this.active++; return Promise.resolve(() => this.release()); }
    if (this.q.length >= this.maxQueue) return Promise.reject(Object.assign(new Error('queue full'), { code: 'QUEUE_FULL' }));
    return new Promise((resolve, reject) => {
      const w = { resolve: () => { this.active++; resolve(() => this.release()); } };
      w.t = setTimeout(() => { this.q = this.q.filter((x) => x !== w); reject(Object.assign(new Error('queue timeout'), { code: 'QUEUE_TIMEOUT' })); }, this.waitMs);
      this.q.push(w);
    });
  }
  release() {
    this.active = Math.max(0, this.active - 1);
    const w = this.q.shift();
    if (w) { clearTimeout(w.t); w.resolve(); }
  }
  stats() { return { active: this.active, queued: this.q.length, max: this.max }; }
}
