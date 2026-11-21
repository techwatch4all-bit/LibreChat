// Brush and water: dry-brush ink strokes, tapered single strokes, ink-wash blooms, long flowing
// curve strokes, watercolor washes, impasto bristle strokes, scissor polylines. All hang on PAINT (P).
// Sources: migration tests A (ink/Munch), B (Ghibli), C (Matisse), D (Rembrandt). Determinism: all
// randomness is seeded.
//   P.brush(c, pts, opt)            ink brush: pressure attack/release + wet core + per-bristle dry
//                                   brush, can write on with reveal (ink, calligraphy, outline garments)
//   P.leaf(c, x, y, ang, L, w)      one tapered stroke pointed at both ends (bamboo leaf, orchid
//                                   leaf, bird wing, shrimp tail)
//   P.inkWash(c, key, grow, fn, o)  ink wash: the shape is painted to a scratch first, then "outer
//                                   halo + body" blurred twice with multiply onto the paper; grow
//                                   0->1 is the soak-out
//   P.flowSeeds / P.flowLines       long flowing strokes: seeds integrated along a time-twisting
//                                   direction field into 200-300px strokes (Munch, not Van Gogh's
//                                   short dabs)
//   P.deform / P.watercolor         watercolor wash: midpoint-displaced polygons x several low-alpha
//                                   multiply layers + a faint edge per layer = water-mark rim (Ghibli
//                                   backgrounds)
//   P.rectPts / P.ellipsePts        polygon point lists the washes commonly use
//   P.impasto(c, pts, w, col, hi)   impasto bristle stroke: one stroke = several parallel fine
//                                   bristles (Rembrandt highlights, Van Gogh impasto retouches)
//   P.cut(pts, seed, step, amp)     scissor polyline: sample points every step px along the outline +
//                                   jitter, connect with lines (Matisse cutouts, silhouettes, woodcut)
(() => {
let W = 1920, H = 1080; U.onStage((w, h) => { W = w; H = h; });   // canvas size follows U.setStage (default 1920x1080)
const P = window.PAINT;
const { clamp, lerp, rng, ss } = U;

// ---------- Ink brush ----------
// pts control points (Catmull-Rom densified then resampled at equal 4px arc length -- without
// resampling the dry-brush noise frequency would vary with stroke length)
// w max width; tone ink alpha (burnt .9 / dense .8 / heavy .6 / light .35 / clear .15); dry 0..1
// dryness (drier toward the tail); reveal 0..1 write-on fraction
// head/tail attack/release fractions; bristles bristle count; col ink color [r,g,b]; per densify factor
// Trap: each bristle must be one continuous path (butt caps); stroking short segments separately
// with round caps stacks dark blobs at the joints, like bamboo nodes or rope.
P.brush = (c, pts, { w = 10, tone = 0.85, dry = 0.45, seed = 1, reveal = 1, bristles = 8, col = [16, 14, 12], head = 0.12, tail = 0.4, per = 5 } = {}) => {
  if (reveal <= 0) return;
  const D = KIT.resample(KIT.densify(pts, per), 4), n = D.length, m = Math.max(2, Math.ceil(n * clamp(reveal)));
  const r = rng(seed * 7919);
  const prof = q => ss(0, head, q) * (1 - 0.7 * ss(1 - tail, 1, q)) * (0.85 + 0.15 * P.noise(seed * 3.3, q * 6)) + 0.08;
  c.save(); c.lineCap = 'butt'; c.lineJoin = 'round';
  const N = [];
  for (let i = 0; i < n; i++) { const A = D[Math.max(0, i - 1)], B = D[Math.min(n - 1, i + 1)]; let dx = B[0] - A[0], dy = B[1] - A[1]; const d = Math.hypot(dx, dy) || 1; N.push([-dy / d, dx / d]); }
  const core = q => w * prof(q) * (1 - dry * 0.85 * Math.pow(q, 0.8));
  // Wet core: present along the whole stroke, thinner and fainter toward the end (the ink is running out)
  c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${tone * 0.72})`; c.fill(KIT.ribbon(D.slice(0, m), (q, i) => core(i / (n - 1))));
  // Bristles: one continuous line each, broken by noise (dry brush = paper showing between bristles), breaking more toward the tail
  for (let k = 0; k < bristles; k++) {
    const off = (k / (bristles - 1) - 0.5) * 0.95, bw = w / bristles * (0.9 + r() * 0.9), ph = r() * 50;
    c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${tone * (0.45 + r() * 0.35)})`; c.lineWidth = Math.max(0.7, bw);
    c.beginPath(); let on = false;
    for (let i = 0; i < m; i++) {
      const q = i / (n - 1), dryness = dry * Math.pow(q, 1.2);
      const vis = P.noise(k * 1.9 + ph, i * 0.09) * 0.5 + 0.5 > dryness * 0.95 + 0.05;
      const o = off * w * prof(q), x = D[i][0] + N[i][0] * o, y = D[i][1] + N[i][1] * o;
      if (vis) { on ? c.lineTo(x, y) : c.moveTo(x, y); on = true; } else on = false;
    }
    c.stroke();
  }
  c.restore();
};
// One tapered stroke, pointed at both ends ("ge"-shaped bamboo leaves, orchid-leaf line, bird wings):
// length L along ang, widest at wmax, slightly bent
P.leaf = (c, x, y, ang, L, wmax, tone = 0.88, col = [16, 14, 12]) => {
  if (!Array.isArray(col)) col = [16, 14, 12];
  const pts = []; for (let i = 0; i <= 10; i++) { const q = i / 10, bend = Math.sin(q * Math.PI) * 0.08 * L; pts.push([x + Math.cos(ang) * L * q - Math.sin(ang) * bend, y + Math.sin(ang) * L * q + Math.cos(ang) * bend]); }
  c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${tone})`; c.fill(KIT.ribbon(pts, q => wmax * Math.pow(Math.sin(Math.PI * Math.min(1, q * 1.1)), 0.7) + 0.6));
};

// ---------- Ink wash / bloom layers ----------
// fn(g) paints the shape onto a scratch (solid color is enough); grow 0..1 controls the soak: the
// outer halo's blur widens with grow, the body's blur tightens with grow.
// halo outer-halo blur radius, haloA halo alpha, blur body blur, alpha overall alpha. Returns the
// scratch (can be reused to punch negative-space holes).
// Trap: multiply is transparent, so ink lines behind show through the wash (the windowsill line
// through the cat's ears). Fill the silhouette with paper color first (clip, then drawImage paper)
// before washing = "reserve this area first".
P.inkWash = (c, key, grow, fn, { blur = 2, halo = 10, haloA = 0.22, alpha = 1 } = {}) => {
  const S = P.scratch('inkw_' + key), g = S.getContext('2d'); g.reset(); fn(g);
  c.save(); c.globalCompositeOperation = 'multiply';
  if (grow > 0) {
    c.globalAlpha = haloA * alpha * grow; c.filter = `blur(${(halo * (0.4 + grow)).toFixed(2)}px)`; c.drawImage(S, 0, 0);
    c.globalAlpha = alpha * ss(0, 0.6, grow); c.filter = `blur(${(blur * (1.6 - grow * 0.6)).toFixed(2)}px)`; c.drawImage(S, 0, 0);
  }
  c.filter = 'none'; c.restore();
  return S;
};

// ---------- Long flowing strokes (Munch's The Scream-style expressionism) ----------
// Seeds: a jittered cell grid, each seed carrying two randoms [x, y, r1, r2]
P.flowSeeds = (cell = 24, seed = 5) => { const r = rng(seed), o = []; for (let y = -10; y < H + 10; y += cell) for (let x = -10; x < W + 10; x += cell) o.push([x + (r() - .5) * cell, y + (r() - .5) * cell, r(), r()]); return o; };
// Each seed: region(x,y,t) classifies the area -> takes that region's params[reg] = [steps, step,
// width, alpha] -> integrates along angle(x,y,t,reg); stops on leaving the region (clean boundaries).
// color(reg, sx, sy, r1, t) returns [r,g,b]. No outline, translucent stacked color -- Munch uses thin
// long strokes; copying Van Gogh's dark outlines turns them into segmented caterpillar stubs.
// Lay a flat fill of the same color family underneath, so gaps between strokes show the same color,
// not black. Length: steps 26-42, step 6-8; one stroke travels 200-300px.
P.flowLines = (c, seeds, { t = 0, region, angle, color, params, extraSteps = 8 }) => {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [sx, sy, r1, r2] of seeds) {
    const reg = region(sx, sy, t); const pr = params[reg]; if (!pr) continue; const [steps, step, width, alpha] = pr;
    const col = color(reg, sx, sy, r1, t);
    let x = sx, y = sy; c.beginPath(); c.moveTo(x, y);
    const n = steps + ((r2 * extraSteps) | 0);
    for (let i = 0; i < n; i++) { const a = angle(x, y, t, reg); x += Math.cos(a) * step; y += Math.sin(a) * step; if (region(x, y, t) !== reg) break; c.lineTo(x, y); }
    c.strokeStyle = P.rgb(col, alpha); c.lineWidth = width * (0.7 + r2 * 0.6); c.stroke();
  }
};

// ---------- Watercolor wash (Ghibli-style background art) ----------
// Midpoint displacement: each round pushes every edge's midpoint along its normal by a quasi-Gaussian
// amount (3 uniform randoms summed), proportional to edge length, amp x0.6 per round
P.deform = (pts, depth, amp, r) => {
  let out = pts;
  for (let d = 0; d < depth; d++) {
    const n = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const g = (r() + r() + r() - 1.5) * amp * Math.min(1, len / 80), nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
      n.push(a, [(a[0] + b[0]) / 2 + nx * g, (a[1] + b[1]) / 2 + ny * g]);
    }
    out = n; amp *= 0.6;
  }
  return out;
};
const fillPts = (g, pts) => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); };
// One wash: the base shape deformed 3 rounds; each layer deformed 2 more rounds, filled at low alpha
// (multiply = transparent pigment stacking), with an edge stroke of alpha=edge at 1.6px in the same
// color (pigment settles at edges = water-mark rim).
// fill may be a gradient; opaque whites (window frames, clouds, tablecloth) use blend:'source-over',
// alpha .9.
// Common values: big wall layers5 a.4 amp12; color bloom layers3 a.045 amp40; wood planks layers3 a.5 amp3 edge.14.
// Trap: dark areas use strongly deformed polygons (amp 60), not rectangles -- rectangle seams show
// hard edges. Keep bloom alpha under .05 x 3 layers or the room looks like moldy parchment.
P.watercolor = (g, pts, color, { layers = 7, alpha = 0.13, amp = 10, seed = 1, edge = 0.1, blend = 'multiply', fill } = {}) => {
  const r = rng(seed * 7919 + 13), base = P.deform(pts, 3, amp, r);
  g.save(); g.globalCompositeOperation = blend; g.lineJoin = 'round';
  for (let k = 0; k < layers; k++) {
    const q = P.deform(base, 2, amp * 0.55, r);
    fillPts(g, q); g.globalAlpha = alpha; g.fillStyle = fill || color; g.fill();
    if (edge) { g.globalAlpha = edge; g.strokeStyle = color; g.lineWidth = 1.6; g.stroke(); }
  }
  g.restore();
};
P.rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
P.ellipsePts = (cx, cy, rx, ry, n = 18) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * rx, cy + Math.sin(i / n * Math.PI * 2) * ry]);

// ---------- Impasto bristle stroke ----------
// One stroke = round(w/1.3) parallel fine bristles (each brightened +-17, both ends randomly shortened
// 0-25%) + a faint shadow underneath + scattered bright specks above -> reads as "a blob of thick
// paint brushed out".
// Use only where light hits (blond hair, collars, porcelain, pearls, white fur). Trap: drawing it as
// three tidy lines "shadow + main stroke + bright ridge" reads as a white sticker / band-aid.
P.impasto = (c, pts, w, col, hi) => {
  const base = col.startsWith('#') ? P.hex(col) : [240, 230, 210];
  const A = pts[0], B = pts[pts.length - 1], ang = Math.atan2(B[1] - A[1], B[0] - A[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
  const r = rng((A[0] * 13 + A[1] * 7) | 0), nb = Math.max(3, Math.round(w / 1.3));
  c.save(); c.lineCap = 'round';
  c.strokeStyle = 'rgba(40,18,6,.28)'; c.lineWidth = w * 0.9; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0] + nx * w * 0.45 + 1, p[1] + ny * w * 0.45 + 1.5) : c.moveTo(p[0] + nx * w * 0.45 + 1, p[1] + ny * w * 0.45 + 1.5)); c.stroke();
  for (let k = 0; k < nb; k++) {
    const o = (k / (nb - 1) - 0.5) * w, s0 = r() * 0.25, s1 = 1 - r() * 0.25, sh = (r() - 0.5) * 34 + (k < nb / 2 ? 14 : -10);
    c.strokeStyle = P.rgb([base[0] + sh, base[1] + sh, base[2] + sh * 0.8], 0.55 + r() * 0.4); c.lineWidth = 1.4 + r() * 1.2; c.beginPath();
    const n = pts.length - 1; for (let i = 0; i <= 8; i++) { const q = lerp(s0, s1, i / 8), j = Math.min(n - 1, Math.floor(q * n)), f = q * n - j, x = lerp(pts[j][0], pts[j + 1][0], f) + nx * o, y = lerp(pts[j][1], pts[j + 1][1], f) + ny * o; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  c.fillStyle = hi || 'rgba(255,250,232,.7)'; for (let k = 0; k < 2 + w / 3; k++) { const q = r(), x = lerp(A[0], B[0], q) - nx * w * 0.3, y = lerp(A[1], B[1], q) - ny * w * 0.3; c.beginPath(); c.arc(x, y, 0.9 + r(), 0, Math.PI * 2); c.fill(); }
  c.restore();
};

// ---------- Scissor polyline ----------
// Resample a ring (closed) point list by step, jitter each point by +-amp with a seed, connect with
// lines -> the edge of hand-cut paper. RIG parts can be fed in via path.pts to re-cut.
P.cut = (pts, seed, step = 18, amp = 2.5) => {
  const r = rng(seed), out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) { const q = k / n; out.push([lerp(a[0], b[0], q) + (r() - 0.5) * amp * 2, lerp(a[1], b[1], q) + (r() - 0.5) * amp * 2]); }
  }
  return U.poly(out);
};
})();
