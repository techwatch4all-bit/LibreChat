// Clip · kinetic type (y5): the words are the actors. One cue = one page: the main word slams in on the
// at frame (spring overshoot ~8%), the support line rises from its slot;
// a page change is a color-band wipe, and the frame the new page emerges = at (the wipe starts 0.3s
// before at).
// cues: title | point (one page: text the main word (auto-shrinks when too long, at most two lines), sub
// the support line, data.label a small top-left tag like "01")
//       number (one big-number page: data {value, prefix, suffix, decimals}, at = the moment the number
//       settles; the page appears 0.7s early and starts rolling)
//       highlight (brushes a highlighter over data.word on the current page + a slight pop; without word
//       it highlights the whole main word)
//       keywords inside sub: data.key names a word in the support line; that word takes the accent color
//       (like the demo film's "next line")
//       the number's caption accepts text or sub (clip.js already unifies them); data.label still works
// Two or more point pages = a checklist: draws a progress track (01/02/03, telling the audience which
// item and how many; landscape top-right, portrait lower) and a giant background numeral (low contrast,
// slow diagonal drift, data.num overridable).
// data.palette = [[ground, text], ...] swaps the color scheme (when written it wins, overriding spec.theme).
// Alpha mode paints no ground; text is white with a dark outline. safe: the main-word block centers
// within top..H-bottom, and the progress track lives in that band too.
// spec.theme (the whole-clip palette ctx.pal): pages rotate [bg ground ink text] -> [accent ground] ->
// [ink ground bg text] -> [accent2 ground] (an accent page's text picks the most readable of
// surface/ink/bg);
//   the highlighter, support-line keywords and page-change bands only pick from bg / ink / accent /
//   accent2, always different from the current page's ground.
CLIPS.y5_kinetic_type = (() => {
const { clamp, lerp } = U;
const PAGES0 = [['#FFD23F', '#111111'], ['#FF5A36', '#FFFFFF'], ['#14213D', '#FFD23F'], ['#F4EFE6', '#111111']];
let pages, LIST, TP = null;                                                // TP: the whole-clip palette (used only when data.palette is absent)
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
// Pick from the candidates a color different from both the page ground and the text, and most readable on the ground
const pick = (bg, fg, cands) => { const ok = cands.filter(x => !same(x, bg) && !same(x, fg)); return ok.length ? PAL.on(bg, ok) : cands[0]; };
const accentOf = col => TP ? pick(col[0], col[1], [TP.accent, TP.accent2]) : col[0] === '#FFD23F' || col[0] === '#F4EFE6' || col[1] === '#FFD23F' ? '#FF5A36' : '#FFD23F';   // when the text itself is yellow (deep-blue page) use orange, otherwise the tint is invisible
const fromPal = p => { const txt = bg => PAL.on(bg, [p.surface, p.ink, p.bg]); return [[p.bg, p.ink], [p.accent, txt(p.accent)], [p.ink, p.bg], [p.accent2, txt(p.accent2)]]; };
return {
  fonts: ['PuHui-Black', 'PuHui-Heavy', 'PuHui-Bold'],
  safe: true,
  init(ctx) {
    TP = ctx.data.palette ? null : ctx.pal;
    const { W, u } = ctx, pal = ctx.data.palette || (TP ? fromPal(TP) : PAGES0), g = document.createElement('canvas').getContext('2d');
    pages = ctx.of('title', 'point', 'number').map((q, i) => {
      const num = q.kind === 'number', nd = q.data || {};
      const text = num ? (nd.prefix || '') + TY.fmt(nd.value || 0, nd.decimals ?? 0) + (nd.suffix || '') : (q.text || '');
      const S0 = (ctx.portrait ? 380 : 300) * u;
      let f = TY.fit(g, text, W * 0.86, S0, 'PuHui-Black', { maxLines: 1, min: 0.55, soft: true });   // shrink to fit one line first, then wrap to two; a single long English word must fit even shrunk
      if (!f.ok) f = num ? TY.fit(g, text, W * 0.86, S0, 'PuHui-Black', { maxLines: 1 })   // numbers never wrap (each digit widens while rolling; wrapping would jump): shrink only
                     : TY.fit(g, text, W * 0.86, S0, 'PuHui-Black', { maxLines: 2, min: 0.3, balance: true });
      const sf = q.sub ? TY.fit(g, q.sub, W * 0.86, (ctx.portrait ? 64 : 80) * u, 'PuHui-Heavy', { maxLines: 2, min: 0.6, balance: true }) : null;   // support line: shrink first when it doesn't fit, then wrap to two
      const show = num ? q.at - 0.7 : q.at;
      return { q, i, num, nd, text, f, sf, show, col: pal[i % pal.length] };
    });
    const pts = pages.filter(p => p.q.kind === 'point'); pts.forEach((p, k) => { p.ord = k + 1; });
    LIST = pts.length >= 2 ? pts : null;
    // The highlighted word is not on the page: warn only (previously nothing happened at all)
    for (const h of ctx.of('highlight')) { const w = h.data && h.data.word; if (!w) continue; const pg = [...pages].reverse().find(p => p.show <= h.at + 1e-6);
      if (pg && !pg.f.lines.some(l => l.includes(w))) console.warn(`y5 highlight at=${h.at}: "${w}" is not in the main word (main word "${pg.text}"; the highlighter brushes only the main word -- words in the support line use data.key coloring); this one does nothing`); }
  },
  draw(c, t, ctx) {
    const { W, H, u } = ctx;
    let k = -1; pages.forEach((p, i) => { if (t >= p.show - 1e-6) k = i; });
    const P = pages[Math.max(0, k)]; if (!P) return;
    const page = (p, c2) => drawPage(c2, p, t, ctx);
    // Ground + dot grid
    if (!ctx.alpha) { c.fillStyle = P.col[0]; c.fillRect(0, 0, W, H); dots(c, t, P.col[1], 0.07, u, W, H); }
    if (k >= 0) {
      // Beat micro-punch: when each cue lands the whole frame scales 1.5%, decaying over 0.15s
      let bump = 1; for (const q of ctx.cues) { const l = t - q.at; if (l >= 0 && l < 0.4) bump += 0.015 * Math.exp(-l * 22); }
      // The camera never drifts or shakes: settle and stop; motion happens only on beats (the micro-punch
      // above, the main-word slam, the page-change bands)
      CAM.with(c, { x: W / 2, y: H / 2, z: bump }, cc => { ghost(cc, P, t, ctx); page(P, cc); });
      track(c, P, t, ctx);
    }
    // Page change: two color bands sweep left to right, the new page behind the last (the emergence
    // frame = the new page's show time)
    const N = pages[k + 1];
    if (N && !ctx.alpha) {
      const p = (t - (N.show - 0.3)) / 0.36; if (p > 0 && p < 1) {
        const mid = (TP ? [TP.accent, TP.accent2, TP.ink, TP.bg] : ['#FFD23F', '#FF5A36', '#14213D', '#3A86FF']).find(x => !same(x, P.col[0]) && !same(x, N.col[0])), cols = [mid, N.col[0]], sk = H * 0.35;   // two bands: an accent different from both grounds + the new ground (the first band used to be the text color, which flashed a white frame before white-text pages)
        const edge = q => lerp(-sk - 40, W + sk + 40, MO.expoInOut(clamp(q)));
        cols.forEach((col, i) => { const x = edge((p - i * 0.12) / 0.76); c.save(); c.beginPath(); c.moveTo(-sk - 60, 0); c.lineTo(x + sk, 0); c.lineTo(x, H); c.lineTo(-sk - 60, H); c.closePath(); c.clip(); c.fillStyle = col; c.fillRect(0, 0, W, H); c.restore(); });
      }
    }
  },
};
function dots(c, t, col, a, u, W, H) { const g = 64 * u, ox = (t * 36 * u) % g, oy = (t * 18 * u) % g; c.save(); c.globalAlpha = a; c.fillStyle = col; for (let y = -g; y < H + g; y += g) for (let x = -g; x < W + g; x += g) { c.beginPath(); c.arc(x + ox, y + oy, 4 * u, 0, Math.PI * 2); c.fill(); } c.restore(); }
function drawPage(c, P, t, ctx) {
  const { W, H, u } = ctx, q = P.q, fg = ctx.alpha ? '#FFFFFF' : P.col[1], lt = ctx.lt(t, P.num ? P.show : q.at);
  const stroke = ctx.alpha ? { stroke: '#111', strokeW: P.f.size * 0.06 } : {};
  const lines = P.num ? [P.text] : P.f.lines, size = P.f.size, lh = size * 1.08;
  const sub = q.sub, subSz = P.sf ? P.sf.size : 0, subL = P.sf ? P.sf.lines : [];
  const by0 = ctx.safe.top, by1 = H - ctx.safe.bottom - (ctx.portrait && LIST ? 220 * u : 0), cyB = ctx.portrait ? by0 + (by1 - by0) * 0.44 : (by0 + by1) / 2;
  const blockH = lines.length * lh + (sub ? subSz * (0.6 + subL.length * 1.15) : 0), y0 = cyB - blockH / 2 + size * 0.82;
  // Label (top left)
  let label = q.data && q.data.label;
  if (label) { const lf = TY.fitFloor(c, label, W * (ctx.portrait ? 0.84 : 0.5) - (ctx.portrait ? 80 : 140) * u, (ctx.portrait ? 56 : 52) * u, 'PuHui-Bold', { maxLines: 1, floor: 34 * u }); label = lf.lines[0] || ''; }
  if (label) TY.rise(c, label, (ctx.portrait ? 80 : 140) * u, ctx.safe.top + (ctx.portrait ? 260 : 210) * u, MO.at(lt, 0, 0.3), { size: (ctx.portrait ? 56 : 52) * u, fam: 'PuHui-Bold', color: fg, track: 6 * u, ...(ctx.alpha ? { stroke: '#111', strokeW: 6 * u } : {}) });
  // Highlight (painted behind the text)
  const hq = ctx.of('highlight').filter(h => h.at >= (P.num ? P.show : q.at) - 1e-6).find(h => { const nx = ctx.of('title', 'point', 'number').find(z => z.at > q.at); return !nx || h.at < nx.at; });
  let hiScale = 1, knock = null;
  if (hq) {
    const hl = ctx.lt(t, hq.at), wd = hq.data && hq.data.word, found = !wd || lines.some(l => l.includes(wd));
    hiScale = hl > 0 && found ? 1 + 0.06 * MO.settle(hl, 1, 2.5, 6) : 1;                     // the word is not in the main word: no brush, no pop (init already warned)
    if (hl > 0) lines.forEach((ln, i) => {
      const word = wd || ln, at = ln.indexOf(word); if (at < 0) return;
      const wPre = TY.width(c, ln.slice(0, at), size), wW = TY.width(c, word, size), wl = TY.width(c, ln, size), x = W / 2 - wl / 2 + wPre, y = y0 + i * lh;
      const mc = ctx.alpha ? (TP ? TP.accent : '#FF5A36') : TP ? (same(P.col[0], TP.accent) ? TP.accent2 : TP.accent) : (P.col[0] === '#FFD23F' ? '#FF5A36' : '#FFD23F'), mr = [x - 12 * u, y - size * 0.86, wW + 24 * u, size * 1.0, MO.at(hl, 0, 0.3)];
      TY.marker(c, ...mr, mc);
      if (mc.toLowerCase() === fg.toLowerCase()) (knock = knock || []).push({ i, mr });   // the highlighter matches the text color (yellow text on deep blue): re-knock the text under the marker to the ground color, otherwise the whole word gets painted over
    });
  }
  // Main word: each line slams in at at (+0.08s per line); number pages roll from 0 to the value
  lines.forEach((ln, i) => {
    let s = ln; if (P.num) { const k = MO.expoOut(clamp(lt / 0.7)); s = (P.nd.prefix || '') + TY.fmt((P.nd.value || 0) * k, P.nd.decimals ?? 0) + (P.nd.suffix || ''); }
    const w = TY.width(c, s, size), x = W / 2 - w / 2, y = y0 + i * lh;
    TY.slam(c, s, x, y, lt - i * 0.08, { size, color: fg, scale: hiScale, ox: W / 2, oy: y - size * 0.36, ...stroke });
    for (const k of (knock || []).filter(k => k.i === i)) {             // only inside the highlighter's parallelogram, re-slam the same line in the ground color (same shape as TY.marker)
      const [mx, my, mw, mh, mp] = k.mr, ww = mw * MO.expoOut(clamp(mp)), sk = mh * 0.18;
      c.save(); c.beginPath(); c.moveTo(mx + sk, my); c.lineTo(mx + ww + sk, my); c.lineTo(mx + ww, my + mh); c.lineTo(mx, my + mh); c.closePath(); c.clip();
      TY.slam(c, s, x, y, lt - i * 0.08, { size, color: P.col[0], scale: hiScale, ox: W / 2, oy: y - size * 0.36 }); c.restore();
    }
  });
  if (sub) subL.forEach((ln, k) => {                                      // support line (up to two lines); data.key's word takes the accent color
    const sw = TY.width(c, ln, subSz, 'PuHui-Heavy'), sy = y0 + (lines.length - 1) * lh + subSz * (1.7 + k * 1.15), sp = MO.at(lt, 0.35 + k * 0.08, 0.35), so = { size: subSz, fam: 'PuHui-Heavy', color: fg, ...(ctx.alpha ? { stroke: '#111', strokeW: subSz * 0.08 } : {}) };
    const key = q.data && q.data.key, ki = key ? ln.indexOf(key) : -1, x0 = W / 2 - sw / 2;
    if (ki < 0) return TY.rise(c, ln, x0, sy, sp, so);
    const pre = ln.slice(0, ki), post = ln.slice(ki + key.length), wp = TY.width(c, pre, subSz, 'PuHui-Heavy'), wk = TY.width(c, key, subSz, 'PuHui-Heavy');
    if (pre) TY.rise(c, pre, x0, sy, sp, so); TY.rise(c, key, x0 + wp, sy, sp, { ...so, color: ctx.alpha ? (TP ? TP.accent : '#FFD23F') : accentOf(P.col) }); if (post) TY.rise(c, post, x0 + wp + wk, sy, sp, so);
  });
}
// Giant background numeral: lower right of checklist pages (lower half in portrait), low contrast, a
// spring landing then a slow diagonal drift; never competes with the main word (text at 12% alpha)
function ghost(c, P, t, ctx) {
  if (!LIST || !P.ord || ctx.alpha) return;
  const { W, H, u } = ctx, lt = t - P.show, k = MO.springHz(lt, 2.0, 8), sc = lerp(1.35, 1, k), s = String((P.q.data && P.q.data.num) ?? P.ord);
  const size = (ctx.portrait ? 1000 : 900) * u, x = W - (ctx.portrait ? 40 : 60) * u + lt * 14 * u, y = H - ctx.safe.bottom + (ctx.portrait ? -120 : 70) * u - lt * 10 * u;
  TY.text(c, s, x, y, { size, fam: 'PuHui-Black', align: 'right', color: P.col[1], alpha: 0.12 * clamp(lt / 0.08), scale: sc, ox: x - size * 0.28, oy: y - size * 0.36 });
}
// Progress track: 01/02/03 cells (as many as point pages), the current page's cell lights on the
// page-change emergence frame; drawn outside the camera, never shaking with the page
function track(c, P, t, ctx) {
  if (!LIST) return;
  const { W, H, u } = ctx, n = LIST.length, k = LIST.filter(p => p.show <= t + 1e-6).length; if (k === 0) return;
  const fg = ctx.alpha ? '#FFFFFF' : P.col[1], gap = 18 * u, seg = Math.min((ctx.portrait ? 150 : 110) * u, ((ctx.portrait ? W * 0.86 : W * 0.4) - (n - 1) * gap) / n), tot = n * seg + (n - 1) * gap;   // with many items each cell narrows, staying on screen
  const x0 = ctx.portrait ? (W - tot) / 2 : W - (ctx.portrait ? 80 : 140) * u - tot, y = ctx.portrait ? H - ctx.safe.bottom - 130 * u : ctx.safe.top + 120 * u;
  const a = MO.expoOut(clamp((t - LIST[0].show) / 0.3));
  c.save(); c.globalAlpha = a;
  for (let i = 0; i < n; i++) { const x = x0 + i * (seg + gap), on = i < k, fill = on ? MO.expoOut(clamp((t - LIST[i].show) / 0.3)) : 0;
    c.fillStyle = fg; c.globalAlpha = a * 0.25; c.fillRect(x, y, seg, 10 * u); c.globalAlpha = a; c.fillRect(x, y, seg * fill, 10 * u);
    TY.text(c, String(i + 1).padStart(2, '0'), x, y - 20 * u, { size: (ctx.portrait ? 40 : 32) * u, fam: 'PuHui-Bold', color: fg, align: 'left', alpha: on ? 1 : 0.4, track: 2 * u, ...(ctx.alpha ? { stroke: '#111', strokeW: 5 * u } : {}) }); }
  c.restore();
}
})();
