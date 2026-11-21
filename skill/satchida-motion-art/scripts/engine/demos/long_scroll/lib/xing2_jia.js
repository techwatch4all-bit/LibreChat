// Shared utilities for a group of segments (in the full film used by 01_cave, 02_egypt, 03_greek, 20_dunhuang, 17_ink, 05_gothic;
// this demo only uses 02_egypt). Each segment file loads it synchronously at the top via XJ_LOAD; not referenced from index.html.
//   XJ.actor(c, key, i, o, name, proc)   Draw the hero frame with this segment's material: proc(g, w, h, i, img) applies the
//                                        segment's art-style processing on a "frame + pad" canvas; results cached by key/frame/name
//   XJ.texInside(g, w, h, draw, op)      Multiply texture only onto the character (texture layer destination-in against the
//                                        silhouette -> multiply back) so the white hat stays white: use a near-white texture base
//   XJ.ta(seg, s)                        Seconds into the act (film time − WORLD.actT(seg); negative before it) — time every
//                                        in-segment event by it so they stay aligned when the walk speed changes
//   XJ.hatNow(seg, s)                    While an act runs: the hat top's position on screen
//   XJ.arc(p0, p1, q, lift)              Parabola between two points
//   XJ.actFrame(table)                   [[seconds, frame], ...] -> frame(u) function (u = seconds into the action)
(() => {
if (window.XJ) return;
const { clamp, lerp } = U, P = PAINT, TAU = Math.PI * 2;
const XJ = window.XJ = {};
const MATS = {};
XJ.mat = (key, i, name, proc, pad = 6) => {
  const k = key + '|' + i + '|' + name; if (MATS[k]) return MATS[k];
  const S = XING.SPR[key], im = S.imgs[i];
  const out = P.canvas(im.width + 2 * pad, im.height + 2 * pad), g = out.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, pad, pad);
  if (proc) proc(g, out.width, out.height, i, im, pad);
  out.pad = pad; MATS[k] = out; return out;
};
XJ.actor = (c, key, i, o, name, proc) => {
  XING.hatTop(key, i, o);                                   // Trigger crossing.js's ensure (reads frames, computes hat top)
  const S = XING.SPR[key], f = S.meta.frames[i], im = XJ.mat(key, i, name, proc), pad = im.pad, s = o.h / S.meta.ref_h * (o.scale || 1);
  const x0 = o.x - (f.ax + pad) * s, y0 = o.y - (f.ay + pad) * s;
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (o.shadow) { c.fillStyle = o.shadow; c.beginPath(); c.ellipse(o.x, o.y + 2, o.h * 0.2, o.h * 0.035, 0, 0, TAU); c.fill(); }
  if (!o.lock) c.drawImage(im, x0, y0, im.width * s, im.height * s);
  else {   // Foot lock: upper body drawn normally (smooth); below the knee, a continuous shear translates the lower half to o.lock,
           // and the shoes (bottom 9%) shift by the full amount — the supporting foot sticks to the ground without slipping
    const iw = im.width, foot = f.ay + pad, cut = Math.max(0, foot - S.meta.ref_h * 0.4), full = foot - S.meta.ref_h * 0.09;
    c.drawImage(im, 0, 0, iw, cut, x0, y0, iw * s, cut * s);
    c.save(); c.beginPath(); c.rect(x0 - 200, y0 + cut * s, iw * s + 400, (full - cut) * s); c.clip();
    c.translate(0, y0 + cut * s); c.transform(1, 0, o.lock / ((full - cut) * s), 1, 0, 0); c.drawImage(im, x0, -cut * s, iw * s, im.height * s); c.restore();
    c.drawImage(im, 0, full, iw, im.height - full, x0 + o.lock, y0 + full * s, iw * s, (im.height - full) * s);
  }
  c.restore();
};
// Walk foot-lock translation amount (screen px). st = per-frame supporting-foot x relative to the anchor (measured from the walk
// frames at height 300), fps = this library's frame rate at walk speed 330 (matches hero.fps).
// Principle: within one half-cycle (4 frames) the supporting foot's world position is fixed; the smoothly advancing body moves
// V·τ relative to it while the drawn foot retreats st0−stj relative to the anchor — the difference is how far the foot must be
// shifted back at this instant.
// Fades to 0 within 220px of either end of a segment (the frame libraries differ across boundaries; prevents left/right body
// mismatch).
XJ.walkLock = (seg, S, i, st, fps, h = 300) => {
  if (S.act) return 0; const t = S.t, P0 = WORLD.plan.find(q => t >= q.t0 && t < q.t1); if (!P0 || P0.kind !== 'walk') return 0;
  const walked = WORLD.plan.filter(q => q.kind === 'walk' && q.t0 <= t).reduce((a, q) => a + Math.min(t, q.t1) - q.t0, 0);
  const rate = fps * WORLD.V / 330, ph = walked * rate, h0 = Math.floor(ph / 4) * 4, tau = (ph - h0) / rate;
  const k0 = h0 % 8, n = st.length; const lock = ((st[k0 % n] - st[i % n]) * h / 300 - WORLD.V * tau);
  const L = U.ss(0, 220, S.hx) * U.ss(0, 220, seg.w - S.hx);
  return clamp(lock, -70, 40) * L;
};
XJ.texInside = (g, w, h, draw, op = 'multiply', alpha = 1, skipWhite = false) => {
  const T = P.canvas(w, h), tg = T.getContext('2d');
  draw(tg, w, h);
  tg.globalCompositeOperation = 'destination-in'; tg.drawImage(g.canvas, 0, 0);
  if (skipWhite) { tg.globalCompositeOperation = 'destination-out'; tg.drawImage(XJ.whiteMask(g, w, h), 0, 0); }   // Keep the aging texture off the white hat and white tee (character design: pure white hat)
  g.save(); g.globalCompositeOperation = op; g.globalAlpha = alpha; g.drawImage(T, 0, 0); g.restore();
};
// Per-pixel color remap (protecting the white hat etc.): fn(r,g,b,a) -> [r,g,b] or null
XJ.remap = (g, w, h, fn) => { const d = g.getImageData(0, 0, w, h), q = d.data;
  for (let k = 0; k < q.length; k += 4) { if (q[k + 3] < 8) continue; const r = fn(q[k], q[k + 1], q[k + 2], q[k + 3], (k >> 2) % w, (k >> 2) / w | 0); if (r) { q[k] = r[0]; q[k + 1] = r[1]; q[k + 2] = r[2]; if (r.length > 3) q[k + 3] = r[3]; } }
  g.putImageData(d, 0, 0); };
// White-area mask (bright and low saturation), for texInside to cut out
XJ.whiteMask = (g, w, h) => { const d = g.getImageData(0, 0, w, h).data, M = P.canvas(w, h), mg = M.getContext('2d'), o = mg.createImageData(w, h);
  for (let k = 0; k < w * h; k++) { const r = d[k * 4], gg = d[k * 4 + 1], b = d[k * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); o.data[k * 4 + 3] = d[k * 4 + 3] > 100 && mx > 200 && mx - mn < 50 ? 255 : 0; }
  mg.putImageData(o, 0, 0); return M; };
// Wipe aging speckles inside the hat zone (top frac) back to white: a pixel whose 5x5 neighborhood is over 60% white and that is
// not itself dark = a speckle on the white hat -> replace with pure white (outline strokes around the brim have under 60% white
// around them, so they survive)
XJ.cleanHat = (g, w, h, frac = 0.34, white = [250, 248, 242], R = 2, wmin = 205) => { const D = g.getImageData(0, 0, w, h), d = D.data, Y = Math.floor(h * frac), wt = new Uint8Array(w * Y);
  for (let y = 0; y < Y; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]); wt[y * w + x] = d[k + 3] > 100 && mx > wmin && mx - mn < 45 ? 1 : 0; }
  const need = Math.ceil((2 * R + 1) ** 2 * 0.55);
  for (let y = R; y < Y - R; y++) for (let x = R; x < w - R; x++) { const k = (y * w + x) * 4; if (d[k + 3] < 100 || wt[y * w + x]) continue; const lum = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; if (lum < 95) continue;
    let n = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) n += wt[(y + dy) * w + x + dx]; if (n >= need) { d[k] = white[0]; d[k + 1] = white[1]; d[k + 2] = white[2]; } }
  g.putImageData(D, 0, 0); };
XJ.ta = (seg, s, k = 0) => s.t - WORLD.actT(seg, k);
XJ.hatNow = (seg, s) => {
  const a = s.act; if (!a) return null;
  const key = a.a.key, i = a.a.frame ? a.a.frame(a.u) : 0, h = (seg.hero && seg.hero.h) || WORLD.HERO_H;
  const x = s.hx - s.camX, y = a.a.y ? a.a.y(s.hx, a.u) : (seg.ground ? seg.ground(s.hx) : WORLD.GROUND);
  return XING.hatTop(key, i, { x, y, h });
};
XJ.arc = (p0, p1, q, lift = 120) => [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - 4 * lift * q * (1 - q)];
// Stops/starts no longer go full stop in one frame, full speed the next: for Tb seconds at the act's head the walk speed eases
// linearly to 0, and for Tb seconds at the tail it ramps from 0 back to full speed (the camera follows him, so it also stops and
// starts gently).
// extra(u) can add the act's own displacement (e.g. being flung), extraDx is its total displacement. Returns { dx, move } to
// spread directly into the acts entry (with lead: 0, so the camera doesn't surge then rewind).
XJ.glide = (dur, Tb = 0.22, extra = null, extraDx = 0) => { const V = WORLD.V, d1 = V * Tb / 2, dx = 2 * d1 + extraDx;
  const pos = u => (u < Tb ? V * (u - u * u / (2 * Tb)) : d1) + (u > dur - Tb ? V * (u - (dur - Tb)) ** 2 / (2 * Tb) : 0) + (extra ? extra(u) : 0);
  return { dx, move: f => dx ? pos(f * dur) / dx : 0 }; };
// During the ease-in/ease-out windows keep playing walk frames instead of act frames: the stride rate falls to 0 with the speed
// and back up, phasing seamlessly into the walk before and after the act
XJ.walkedAt = t => WORLD.plan.filter(q => q.kind === 'walk' && q.t0 <= t).reduce((a, q) => a + Math.min(t, q.t1) - q.t0, 0);
XJ.glideWalk = (S, dur, fps, n = 8, Tb = 0.22, head = true, tail = true) => {
  if (!S.act) return null; const u = S.act.u, V = WORLD.V, rate = fps * V / 330, ph0 = XJ.walkedAt(S.t - u) * rate, d1 = V * Tb / 2;
  let ph = null;
  if (head && u < Tb) ph = ph0 + (V * (u - u * u / (2 * Tb))) / V * rate;
  else if (tail && u > dur - Tb) { const w = u - (dur - Tb); ph = ph0 - (d1 - V * w * w / (2 * Tb)) / V * rate; }
  return ph == null ? null : ((Math.floor(ph) % n) + n) % n;
};
XJ.actFrame = tab => u => { let f = tab[0][1]; for (const [t0, fr] of tab) if (u >= t0) f = fr; return f; };
// Draw only within this segment's visible range: lx world coord -> screen
XJ.vis = (s, lx, pad = 300) => lx - s.camX > -pad && lx - s.camX < s.W + pad;
// Paint bursts across boundaries: crossing.js only ships monet / vg palettes. Here we recolor only this group's burst names
// ('jia_*') and hand everything else back to the original function (crossing.js untouched)
XJ.BURST = {
  jia_cave: ['#9c3520', '#c9772f', '#21150d', '#d49a5a', '#74261a'],
  jia_egypt: ['#1f4fa0', '#c0392b', '#2f8a5a', '#e0b030', '#1a1a1a'],
  jia_greek: ['#1a1410', '#c8602a', '#e8d2b0', '#7a2a1a'],
  jia_dunhuang: ['#2f5f8f', '#3f8f6e', '#a5452f', '#ecdfc4', '#d8b05a'],
  jia_ink: ['#1a1a1a', '#3a3a3a', '#6a6a6a', '#9a9a9a', '#b8322a'],
  jia_gothic: ['#e8c45a', '#1f3f9f', '#b8202a', '#f6e6a8', '#2f7a3a'],
};
if (XING.burst && !XING.burst.__jia) {
  const orig = XING.burst;
  XING.burst = (c, x, y, a, R, style, seed = 1) => {
    const cols = XJ.BURST[style]; if (!cols) return orig(c, x, y, a, R, style, seed); if (a < 0 || a > 1) return;
    const r = U.rng(seed); c.save(); c.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const ang = r() * TAU, sp = R * (0.55 + r() * 0.8), d = 150 + sp * U.ease.out(a), x1 = x + Math.cos(ang) * d, y1 = y + Math.sin(ang) * d * 0.8 + 120 * a * a;   // Burst outward outside the body ring, not on top of him (review note: color streaks stayed on the white tee)
      c.strokeStyle = cols[i % cols.length]; c.globalAlpha = 1 - a; c.lineWidth = 7 + r() * 6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + Math.cos(ang) * 16, y1 + Math.sin(ang) * 10); c.stroke(); }
    c.restore(); };
  XING.burst.__jia = true;
}
})();
