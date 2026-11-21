// Clip · Kurzgesagt-style flat explainer (y1): deep-ink flat ground (when no theme is written; no more
// indigo-purple gradient night sky), a flat central object = the concept being explained; each point is
// a satellite node,
// with a label pill popping in (108% overshoot) and signals flowing along the links. The ambient layer
// (star twinkle, particles, signal pulses) moves gently all the time; the center object, nodes and labels
// settle and hold,
// and the camera never slow-pushes uniformly: it pushes in ~30% only on the highlight beat, glides at
// the same zoom to a connected highlight, then holds.
// spec-level data.camera 'smooth' (default, push 0.9s, node-to-node 0.7s, sineInOut) | 'snap' (accent:
// fast push 0.28s, fast pan 0.30s).
// The signature is scale traversal: enter has the camera push logarithmically into a satellite until its
// color fills the screen, then pulls out of a same-colored new center object -- "what's inside".
// cues: title (top title floats up per character; text) - point (a satellite node + label of the current
// layer: text; data.color overrides the accent)
//       highlight (the camera pushes to the data.index-th node (counting only the current layer's points,
//       from 0; default the latest), the other nodes and labels dim; push takes 1.2s)
//       enter (dive into the data.index-th node (default the latest): push -> same color full screen ->
//       pull out of a new center object; text = the new center's name (default that node's name);
//       points after it are satellites of the new layer; dur default 1.6s, the push starts on the at frame)
// data.center: the first layer's center object's name. data.center_style: { color, shape:
// 'circle'|'rounded'|'hex'|'diamond', ring: true (adds an orbit ring) };
//   absent, a neutral style is generated from the name (color and shape derive from the text, same name
//   same style; no orbit ring). data.image: put an image inside the center object (screenshot, photo,
//   cropped to the shape), with the name moved to the pill below.
//   A new layer's (the one enter dove into) center object uses that node's color, its shape generated
//   from the name the same way; enter's data.style can override.
// data.flow:true: nodes chain in order (center->1->2->3), signals flow through in sequence, nodes carry
// numbers -- for explaining "sequence".
// Node layout matches portrait and landscape: <=3 on the upper arc (left to right), >=4 around a full
// circle (clockwise from the left). safe: layout stays within top..H-bottom.
// spec.theme (the whole-clip palette ctx.pal): the ground is flat bg (no gradients, no glows), stars and
// motes use sub at low alpha, links sub, signals accent2,
//   node colors accent / accent2 and their shades (data.color honored as written), the center object
//   defaults to accent2, label pills on light palettes use surface ground with ink text and on dark
//   palettes ink ground with bg text, the title ink.
CLIPS.y1_kurzgesagt = (() => {
const { clamp, lerp, rng } = U;
// Default (no theme written): deep-ink ground, only a barely visible same-hue light/dark shift; no
// purple, magenta or violet-blue in node / center-object colors
const P0 = { sky: ['#0F1114', '#121417', '#171A1E'], star: '#F2EFE8', line: 'rgba(125,211,220,.35)', pulse: '#32BAEE', pulseCore: '#e9fdff', mote: '#fff6d0', pill: '#ffffff', pillInk: '#1B1A17', title: '#fff', ring: 'rgba(255,230,190,.55)', arrow: 'rgba(125,211,220,.7)', shadow: 'rgba(20,40,20,.25)' };
const ACC0 = ['#32BAEE', '#FACC12', '#E07A3F', '#5CD0B3', '#FC6255', '#A3B84B'];
// The center object's neutral style: color and shape hashed from the name (same name same style), no orbit ring
const CPAL0 = ['#4F86C6', '#3FA796', '#D99A3A', '#C8574A', '#5BA4CF', '#6FAF5A'], SHAPES = ['circle', 'rounded', 'hex'];
let P = P0, ACC = ACC0, CPAL = CPAL0, PL = null;
// Whole-clip palette -> this grammar's color set (derived only from the 6 keys)
const fromPal = p => { const dk = PAL.dark(p), spot = dk ? p.ink : p.sub;
  return { P: { sky: [p.bg], star: spot, line: PAL.alpha(p.sub, 0.5), pulse: p.accent2, pulseCore: PAL.mix(p.accent2, p.surface, 0.6), mote: spot, pill: dk ? p.ink : p.surface, pillInk: dk ? p.bg : p.ink, title: p.ink,
      ring: PAL.alpha(p.ink, 0.4), arrow: PAL.alpha(p.sub, 0.85), shadow: PAL.alpha(dk ? '#000000' : p.ink, dk ? 0.3 : 0.14) },
    ACC: [p.accent, p.accent2, PAL.mix(p.accent, p.ink, 0.35), PAL.mix(p.accent2, p.ink, 0.35), PAL.mix(p.accent, p.bg, 0.3), PAL.mix(p.accent2, p.bg, 0.3)],
    CPAL: [p.accent2] }; };
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
const styleFor = (name, over = {}, col) => { const h = hashStr(name || '·'); return { color: over.color || col || CPAL[h % CPAL.length], shape: over.shape || SHAPES[(h >>> 8) % SHAPES.length], ring: !!over.ring }; };
const shapePath = (kind, x, y, R) => { const p = new Path2D();
  if (kind === 'rounded') p.roundRect(x - R * 0.92, y - R * 0.92, R * 1.84, R * 1.84, R * 0.36);
  else if (kind === 'hex') for (let i = 0; i <= 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? p.lineTo(x + Math.cos(a) * R * 1.06, y + Math.sin(a) * R * 1.06) : p.moveTo(x + Math.cos(a) * R * 1.06, y + Math.sin(a) * R * 1.06); }
  else if (kind === 'diamond') { p.moveTo(x, y - R * 1.2); p.lineTo(x + R * 1.2, y); p.lineTo(x, y + R * 1.2); p.lineTo(x - R * 1.2, y); p.closePath(); }
  else p.arc(x, y, R, 0, Math.PI * 2);
  return p; };
const dark = (col, k = 0.72) => PAINT.rgb(PAINT.hex(col).map(v => v * k)), light = col => PAINT.rgb(PAINT.hex(col).map(v => v + (255 - v) * 0.4));
let S, levels, flow;
return {
  fonts: ['PuHui-Heavy', 'PuHui-Medium'],
  safe: true,
  init(ctx) {
    const { W, H, u, safe } = ctx, r = rng(11);
    PL = ctx.pal; if (PL) ({ P, ACC, CPAL } = fromPal(PL)); else { P = P0; ACC = ACC0; CPAL = CPAL0; }
    flow = !!ctx.data.flow;
    const y0 = safe.top + (ctx.of('title').length ? (ctx.portrait ? 300 : 210) * u : 60 * u), y1 = H - safe.bottom - 40 * u;
    const R = (ctx.portrait ? 160 : 140) * u, cx = W / 2, cy = (y0 + y1) / 2 + (ctx.portrait ? 0 : 30 * u);
    S = { cx, cy, R, stars: Array.from({ length: 160 }, () => ({ x: r() * W * 1.4 - W * 0.2, y: r() * H * 1.4 - H * 0.2, r: (0.8 + r() * r() * 3) * u, ph: r() * 6.28, sp: 1 + r() * 2.5 })),
      bokeh: Array.from({ length: 10 }, () => ({ x: r() * W * 1.3 - W * 0.15, y: r() * H * 1.3 - H * 0.15, r: (60 + r() * 150) * u, ph: r() * 6.28, a: 0.035 + r() * 0.04 })),
      motes: Array.from({ length: 24 }, () => ({ x: r() * W, y: r() * H, ph: r() * 6.28, d: 0.8 + r() * 0.5, s: (2 + r() * 3) * u })) };
    // Layering: enter moves the points after it into a new layer
    const cs0 = styleFor(ctx.data.center || '', ctx.data.center_style || {});
    levels = [{ start: 0, center: ctx.data.center || '', col: cs0.color, style: cs0, img: ctx.data.image ? ctx.IMG[ctx.data.image] : null, pts: [], hls: [] }];
    for (const q of ctx.cues) {
      const L = levels[levels.length - 1];
      if (q.kind === 'point') L.pts.push(q);
      else if (q.kind === 'highlight') L.hls.push(q);
      else if (q.kind === 'enter') { const D = q.dur || 1.6; L.exit = { q, at: q.at, D, sw: q.at + D * 0.55, idx: q.data && q.data.index };
        levels.push({ start: q.at + D * 0.55, end0: q.at + D, center: '', col: null, pts: [], hls: [], from: L }); }
    }
    // Per-layer node positions (the same angle scheme in portrait and landscape: <=3 upper arc left->right, >=4 one full circle clockwise from the left)
    const lab = 46 * u + 70 * u + 45 * u;                               // node radius + label offset + half a label height: even the lowest label stays inside y1
    const rx = ctx.portrait ? W * 0.34 : Math.min(W * 0.32, 640 * u), ryHalf = Math.min(y1 - y0, H) * (ctx.portrait ? 0.3 : 0.42), ryRing = Math.min((y1 - y0) * (ctx.portrait ? 0.34 : 0.36), y1 - cy - lab, cy - y0 - 60 * u);
    levels.forEach((L, li) => {
      const n = L.pts.length, ring = n >= 4;
      L.orbit = { rx, ry: ring ? ryRing : ryHalf, ring };
      L.nodes = L.pts.map((q, i) => { const ang = ring ? Math.PI + i / n * Math.PI * 2 : Math.PI + (i + 0.5) / n * Math.PI;
        const ry = ring ? ryRing : ryHalf; return { q, i, x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry, col: (q.data && q.data.color) || ACC[(i + li * 2) % ACC.length] }; });
      if (L.exit) { const nd = L.exit.idx != null ? L.nodes[L.exit.idx] : L.nodes.filter(z => z.q.at <= L.exit.at).pop() || L.nodes[L.nodes.length - 1];
        L.exit.node = nd; const N = levels[li + 1]; N.col = nd ? nd.col : ACC[0]; N.center = L.exit.q.text || (nd && nd.q.text) || '';
        N.style = styleFor(N.center, (L.exit.q.data && L.exit.q.data.style) || {}, N.col); N.col = N.style.color; }
      // This layer's camera: hold; on the highlight beat push to the node (about 30% in, the target
      // biased a little toward the center object so the center isn't cropped too much),
      // and when already pushed, the next highlight glides at the same zoom to the new node; then hold.
      // Durations follow data.camera
      const Z = ctx.portrait ? 1.28 : 1.32; L.events = []; let zoomed = false;
      for (const h of L.hls) {
        const nd = h.data && h.data.index != null ? L.nodes[h.data.index] : L.nodes.filter(z => z.q.at <= h.at).pop(); if (!nd) continue;
        const snap = (ctx.data && ctx.data.camera) === 'snap';
        L.events.push(zoomed ? { at: h.at, kind: snap ? 'pan' : 'glide', x: lerp(nd.x, cx, 0.35), y: lerp(nd.y, cy, 0.35) } : { at: h.at, kind: 'to', x: lerp(nd.x, cx, 0.35), y: lerp(nd.y, cy, 0.35), z: Z, ...(snap ? { dur: MO.PULSE.punch, ease: MO.cubicInOut } : {}) });
        zoomed = true; h.node = nd;
      }
    });
  },
  draw(c, t, ctx) {
    const { W, H, u } = ctx;
    // Current layer: past the switch point it's the new layer; within +-0.05s of the switch the two
    // layers cross-dissolve (both sides are a full screen of one color, so the cut is invisible)
    let k = 0; levels.forEach((L, i) => { if (i > 0 && t >= L.start) k = i; });
    drawLevel(c, k, t, ctx);
    const L = levels[k], ex = L.exit;
    if (ex && t > ex.sw - 0.05 && t < ex.sw) { const buf = UI.scratch('clip_y1x', W, H), g = buf.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      drawLevel(g, k + 1, t, ctx); c.save(); c.globalAlpha = (t - (ex.sw - 0.05)) / 0.1; c.drawImage(buf, 0, 0); c.restore(); }
    // Title: floats up per character (screen layer, not following the camera); fades out at the first
    // highlight / enter
    const qt = ctx.of('title')[0];
    if (qt) { const nx = ctx.of('highlight', 'enter')[0], out = nx ? 1 - MO.sineInOut(clamp((t - nx.at) / 0.5)) : 1;
      if (out > 0) { c.save(); c.globalAlpha = out; const fs = TY.fit(c, qt.text || '', W * 0.88, (ctx.portrait ? 84 : 76) * u, 'PuHui-Heavy', { maxLines: 2, balance: true });
        fs.lines.forEach((ln, i) => TY.charsIn(c, ln, W / 2, ctx.safe.top + (ctx.portrait ? 200 : 130) * u + i * fs.size * 1.2, ctx.lt(t, qt.at) - i * 0.2, { font: `${fs.size}px "PuHui-Heavy"`, color: P.title, dur: 0.5, stagger: 0.045, dy: 30 * u, align: 'center', shadow: PL && !ctx.alpha ? null : { color: 'rgba(0,0,0,.5)', y: 6 * u, blur: ctx.alpha ? 14 * u : 0 } }));
        c.restore(); } }
  },
};
// Camera: this layer's move table; while diving out -> push into that node to full screen; just after
// diving in -> pull out from the full-screen center object
function camAt(L, t, ctx) {
  const { W, H } = ctx;
  if (L.from && t < L.end0) {                                            // Pull out: z falls logarithmically from "center object covering the screen" to 1; the center object returns from screen center to its place
    const e = MO.cubicInOut(clamp((t - L.start) / (L.end0 - L.start))), Z = CAM.coverZoom(S.R * 0.84) * 1.15;   // 0.84: a diamond/hexagon's inscribed circle is smaller than R, it must still cover the screen
    return CAM.anchor(S.cx, S.cy, CAM.zlerp(Z, 1, e), lerp(W / 2, S.cx, e), lerp(H / 2, S.cy, e));
  }
  const ex = L.exit;
  if (ex && t >= ex.at && ex.node) {                                      // Push in: logarithmic scale; the node glides smoothly to frame center, pushed until its circle covers the screen
    const base = CAM.track({}, L.events, ex.at), e = MO.cubicIn(clamp((t - ex.at) / (ex.sw - ex.at)) ) * 0.5 + MO.cubicInOut(clamp((t - ex.at) / (ex.sw - ex.at))) * 0.5;
    return CAM.pushTo(base, ex.node.x, ex.node.y, CAM.coverZoom(46 * ctx.u) * 1.2, e, e);
  }
  return CAM.track({}, L.events, t);
}
function drawLevel(c, k, t, ctx) {
  const { W, H, u } = ctx, L = levels[k], cam = camAt(L, t, ctx), { cx, cy, R } = S;
  if (!ctx.alpha) {
    c.fillStyle = P.sky.length > 1 ? TOON.vgrad(c, 0, H, P.sky) : P.sky[0]; c.fillRect(0, 0, W, H);
    const sa = PL ? 0.35 : 1;                                             // on a palette ground the stars are just a very faint texture
    CAM.layer(c, cam, 0.12, g => { for (const b of S.bokeh) { const k = 0.75 + 0.25 * Math.sin(t * 0.5 + b.ph); const bx = b.x + Math.sin(t * 0.2 + b.ph) * 14 * u, a = b.a * k * (PL ? 0.9 : 1.6), rgb = (PL ? PAINT.hex(P.star) : [125, 211, 220]).slice(0, 3).map(Math.round).join(','), gr = g.createRadialGradient(bx, b.y, b.r * 0.15, bx, b.y, b.r); gr.addColorStop(0, `rgba(${rgb},${a * 0.35})`); gr.addColorStop(0.8, `rgba(${rgb},${a * 0.55})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.beginPath(); g.arc(bx, b.y, b.r, 0, 7); g.fill(); } });
    CAM.layer(c, cam, 0.05, g => { for (const s of S.stars) { g.globalAlpha = sa * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph))); g.fillStyle = P.star; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); } g.globalAlpha = 1; });
  }
  // When a highlight is active: the pushed node brightens, other nodes and labels dim
  const hNow = [...L.hls].reverse().find(h => t >= h.at && h.node), dimK = hNow ? MO.smooth(clamp((t - hNow.at) / 0.6)) : 0;
  const col = L.col, st = L.style, pull = L.from && t < L.end0 ? MO.smooth(clamp(((t - L.start) / (L.end0 - L.start) - 0.45) / 0.45)) : 1;   // right after diving in: full-screen pure color first; the name and ring only appear in the pull-out's second half
  CAM.layer(c, cam, 1, g => {
    // Node orbit: a very faint dashed ellipse giving the points a "circling the center" structure
    // (more nodes reads as a ring; <=3 is the upper arc)
    if (L.orbit && L.nodes.length) { const o = L.orbit, a0 = L.orbit.ring ? 0 : Math.PI, a1 = L.orbit.ring ? Math.PI * 2 : Math.PI * 2, show = MO.cubicOut(clamp(ctx.lt(t, L.nodes[0].q.at) / 0.8));
      g.save(); g.globalAlpha = 0.5 * show * (1 - 0.6 * dimK); g.strokeStyle = P.line; g.lineWidth = 2 * u; g.setLineDash([2 * u, 14 * u]); g.lineCap = 'round'; g.beginPath(); g.ellipse(cx, cy, o.rx, o.ry, 0, a0, a0 + (a1 - a0) * show); g.stroke(); g.restore(); }
    // Links + signal pulses (flow: center->1->2->3 chained, signals flowing in sequence)
    L.nodes.forEach((nd, i) => {
      const l = ctx.lt(t, nd.q.at); if (l <= 0) return;
      const from = flow && i > 0 ? L.nodes[i - 1] : { x: cx, y: cy }, p = MO.cubicOut(clamp(l / 0.4)), ex = lerp(from.x, nd.x, p), ey = lerp(from.y, nd.y, p);
      g.save(); g.globalAlpha = 1 - 0.6 * dimK * (hNow && hNow.node === nd ? 0 : 1);
      g.strokeStyle = P.line; g.lineWidth = 4 * u; g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(ex, ey); g.stroke();
      if (flow && l > 0.4) { const ax = lerp(from.x, nd.x, 0.55), ay = lerp(from.y, nd.y, 0.55), a = Math.atan2(nd.y - from.y, nd.x - from.x); g.fillStyle = P.arrow; g.translate(ax, ay); g.rotate(a); g.beginPath(); g.moveTo(10 * u, 0); g.lineTo(-8 * u, -9 * u); g.lineTo(-8 * u, 9 * u); g.closePath(); g.fill(); }
      g.restore();
      for (let kk = 0; kk < 3; kk++) { if (l < 0.4) break; const q = flow ? ((t * 0.7 - i * 0.33 + kk / 3) % 1 + 1) % 1 : ((l * 0.8 + kk / 3) % 1); const x = lerp(from.x, nd.x, q), y = lerp(from.y, nd.y, q); if (!PL) TOON.glow(g, x, y, 20 * u, P.pulse, 0.6 * (1 - 0.7 * dimK)); g.fillStyle = PL ? P.pulse : P.pulseCore; g.beginPath(); g.arc(x, y, (PL ? 7 : 5) * u, 0, 7); g.fill(); }
    });
    // Center object: two-tone facets + soft glow (shape and color from data.center_style or generated
    // from the name); optional orbit ring; with data.image the image is cropped into the shape
    const breath = 1 + 0.018 * Math.sin(t * 1.7), shape = shapePath(st.shape, cx, cy, R * breath);
    if (!PL) TOON.glow(g, cx, cy, R * 2.4, light(col), 0.28);
    TOON.flat(g, shape, col, dark(col), light(col), [-18 * u, 14 * u], [-6 * u, 5 * u]);
    if (L.img) { g.save(); g.clip(shapePath(st.shape, cx, cy, R * 0.9)); MD.cover(g, L.img, { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R }); g.restore(); }
    if (st.ring) { g.save(); g.globalAlpha = pull; g.strokeStyle = P.ring; g.lineWidth = 6 * u; g.beginPath(); g.ellipse(cx, cy, R * 1.55, R * 0.35, -0.25, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.restore(); }
    if (L.center && !L.img) { const f = TY.fitFloor(g, L.center, R * 1.7, 56 * u, 'PuHui-Heavy', { maxLines: 3, floor: 30 * u, balance: true });   // the name goes inside the center object: shrink to the floor first, then wrap, then truncate
      g.save(); g.globalAlpha = pull; g.font = `${f.size}px "PuHui-Heavy"`; g.fillStyle = PL ? PAL.on(col, [PL.surface, PL.ink, PL.bg]) : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      f.lines.forEach((ln, i) => g.fillText(ln, cx, cy + (i - (f.lines.length - 1) / 2) * f.size * 1.1)); g.restore(); }
    else if (L.center) { const f = TY.fit(g, L.center, R * 3, 44 * u, 'PuHui-Heavy', { maxLines: 1, min: 0.6 });   // with an image: the name goes into the white pill below
      g.save(); g.globalAlpha = pull; g.font = `${f.size}px "PuHui-Heavy"`; const tw = g.measureText(f.lines[0] || '').width, bw = tw + 56 * u, bh = f.size * 1.6, by = cy + R * 1.12;
      g.fillStyle = P.pill; g.beginPath(); g.roundRect(cx - bw / 2, by, bw, bh, bh / 2); g.fill(); g.fillStyle = P.pillInk; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.lines[0] || '', cx, by + bh / 2 + 2 * u); g.restore(); }
    // Nodes + label pills (pop 0.5s, 108% overshoot)
    for (const nd of L.nodes) {
      const l = ctx.lt(t, nd.q.at); if (l <= 0) continue;
      const on = hNow && hNow.node === nd, a = 1 - 0.65 * dimK * (on ? 0 : 1);
      const pop = MO.backOut(clamp(l / 0.5), 1.1), fy = l > 0.5 ? MO.float(t, 7 * u, 3.4, nd.i * 1.9) * clamp((l - 0.5) / 0.6) : 0, nr = 46 * u * pop * (on ? 1 + 0.15 * dimK : 1);
      g.save(); g.globalAlpha = a;
      if (!PL) TOON.glow(g, nd.x, nd.y + fy, nr * (on ? 4.2 : 2.6), nd.col, on ? 0.7 : 0.45);
      TOON.flat(g, TOON.circle(nd.x, nd.y + fy, nr), nd.col, dark(nd.col), PL ? light(nd.col) : '#ffffff', [-8 * u, -8 * u], [-3 * u, -3 * u]);
      if (l < 1.0) { const rp = clamp(l / 0.9); g.save(); g.globalAlpha = (1 - rp) * 0.55 * a; g.strokeStyle = nd.col; g.lineWidth = 4 * u * (1 - rp); g.beginPath(); g.arc(nd.x, nd.y + fy, nr * (1.1 + rp * 1.5), 0, 7); g.stroke(); g.restore(); }
      if (flow) { g.font = `${30 * u * pop}px "PuHui-Heavy"`; g.fillStyle = PL ? PAL.on(nd.col, [PL.surface, PL.ink, PL.bg]) : P.pillInk; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(nd.i + 1), nd.x, nd.y + fy + 2 * u); }
      const gone = L.exit ? 1 - clamp((t - L.exit.at) / 0.2) : 1;   // while diving in: this layer's labels all withdraw as the push starts (otherwise they blow up into half-screen white blocks, and the neighbors' too)
      const lp = MO.backOut(clamp((l - 0.15) / 0.5), 1.1) * gone; if (lp > 0) {
        const sc = lp * (on ? 1 + 0.18 * dimK : 1);
        const lf = TY.fitFloor(g, nd.q.text || '', ctx.W * 0.44 - 56 * u, (ctx.portrait ? 44 : 38) * u, 'PuHui-Medium', { maxLines: 1, floor: 30 * u }), lab = lf.lines[0] || '';   // a long label shrinks to the floor first, then truncates with an ellipsis -- never shrunk into illegibility
        g.font = `${lf.size}px "PuHui-Medium"`; const tw = g.measureText(lab).width, bw = tw + 56 * u, bh = 70 * u;
        const ly = nd.y + fy + (nd.y < cy - R * 0.5 && ctx.portrait ? -nr - 70 * u : nr + 70 * u);   // the label sits below the node (above it on portrait's upper arc)
        const z = cam.z || 1, vx0 = cam.x - ctx.W / 2 / z, vx1 = cam.x + ctx.W / 2 / z, hw = bw * sc / 2 + 20 * u / z;   // the world range visible under the current camera (a slow push would shove edge labels off-screen)
        const lx = nd.x > vx0 && nd.x < vx1 ? (vx1 - vx0 > 2 * hw ? clamp(nd.x, vx0 + hw, vx1 - hw) : cam.x) : nd.x;   // when the node is in frame, clamp the label back into frame
        g.translate(lx, ly); g.scale(sc, sc);
        g.fillStyle = P.shadow; g.beginPath(); g.roundRect(-bw / 2 + 6 * u, -bh / 2 + 8 * u, bw, bh, bh / 2); g.fill();
        g.fillStyle = P.pill; g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); g.fill();
        if (on) { g.strokeStyle = nd.col; g.lineWidth = 5 * u * dimK; g.stroke(); }
        g.fillStyle = P.pillInk; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, 0, 2 * u);
      }
      g.restore();
    }
    // Firefly motes
    for (const m of S.motes) { const x = m.x + Math.sin(t * 0.8 + m.ph) * 30 * u, y = m.y - ((t * 22 * u + m.ph * 40 * u) % (120 * u)); g.globalAlpha = (PL ? 0.3 : 1) * (0.4 + 0.4 * Math.sin(t * 2 + m.ph)); g.fillStyle = P.mote; g.beginPath(); g.arc(x, y, m.s, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  });
}
})();
