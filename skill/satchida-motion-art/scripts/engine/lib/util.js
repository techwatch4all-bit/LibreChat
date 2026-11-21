// Generic utilities (loaded first; shared by the transition library and the engine)
(() => {
// ---------- Utilities ----------
window.U = {
  TAU: Math.PI * 2,
  clamp: (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  lerp: (a, b, p) => a + (b - a) * p,
  // smoothstep: x moves smoothly from 0 to 1 inside [a,b] (opening write-ons, fades, in-segment rhythm)
  ss: (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
  // Linearly stretch p's [a,b] span to 0..1 (staged transitions)
  seg: (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a))),
  // Stepped frame rate: quantize continuous time into fps steps -- the "stop-motion jerk" is itself
  // the flavor of many styles:
  // rubber-hose cartoon 12fps (on twos), shadow-puppet rod work 10fps, Haring's dancing figure 8fps
  // hard cuts, boiling hand-drawn lines 8-12fps, film layer 24fps.
  stepTime: (t, fps) => Math.floor(t * fps) / fps,
  ease: {
    linear: p => p,
    inOut: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    out: p => 1 - Math.pow(1 - p, 3),
    in: p => p * p * p,
    outBack: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  },
  // Seeded random: mulberry32
  rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  hash(i, j = 0) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
  // Point list -> Path2D (polyline)
  poly(pts, closed = true) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; },
};

// ---------- Canvas size ----------
// Default 1920x1080. Portrait clips (clip.html, spec.width/height) and portrait whole films
// (index.html?w=1080&h=1920, or window.FILM_SIZE = [1080, 1920] in eras.js)
// call U.setStage(w, h) once at boot. Libraries that use screen size (PAINT / BRUSH / RENDER / POST /
// KIT / TOON / CAM / UI / CH / DG / CL / MD, transitions.js, engine.js)
// register with U.onStage; when the size changes they all follow; registering immediately calls back
// with the current size so late-loaded libraries get it too.
// The 35 art-style scenes (scenes/) were drawn for 1920x1080; portrait only guarantees the explainer
// grammars, transitions and the engine itself.
const stageHooks = [];
window.STAGE = { W: 1920, H: 1080 };
U.onStage = f => { stageHooks.push(f); f(window.STAGE.W, window.STAGE.H); };
U.setStage = (w, h) => { w = Math.round(+w); h = Math.round(+h); if (!(w > 0 && h > 0)) throw new Error(`U.setStage: bad size ${w}x${h}`); window.STAGE = { W: w, H: h }; stageHooks.forEach(f => f(w, h)); };

// ---------- Glyph checks ----------
// When a font file lacks a character the browser silently falls back to a system font: measureText
// does not error and the width is plausible, but the look changes on another machine (migration
// tests B and D both hit this: full-width letters, the play glyph, some CJK characters).
// Approach: at boot (engine boot, after fonts load) read each font file's cmap table from FONT_FACES
// (WOFF1 decompressed via DecompressionStream) and look the character up in the table.
// Do not compare measureText against fallback fonts: on macOS Chromium's per-character fallback picks
// system fonts relative to the primary font, so the two spellings can land on different fonts and a
// missing glyph goes undetected (measured false negatives).
// font may be a family name ('LXGWWenKai-500') or a CSS font string ('80px "LXGWWenKai-500"'). A
// family not in FONT_FACES -> treated as all missing.
const famOf = font => { const m = /"([^"]+)"/.exec(font) || /'([^']+)'/.exec(font); return m ? m[1] : String(font).replace(/^(italic\s+|bold\s+|\d+\s+)*[\d.]+px\s+/, '').trim(); };
const CMAPS = {};
const inflate = async (buf) => new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
async function readCmap(url) {
  const ab = await (await fetch(url)).arrayBuffer(), dv = new DataView(ab), sig = dv.getUint32(0);
  let tab = null;
  if (sig === 0x774F4646) {                                            // 'wOFF'
    const n = dv.getUint16(12);
    for (let i = 0; i < n; i++) { const o = 44 + i * 20; if (dv.getUint32(o) !== 0x636D6170) continue;   // 'cmap'
      const off = dv.getUint32(o + 4), comp = dv.getUint32(o + 8), orig = dv.getUint32(o + 12), raw = new Uint8Array(ab, off, comp);
      tab = comp < orig ? await inflate(raw) : raw.slice(); }
  } else {                                                             // bare TTF/OTF
    const n = dv.getUint16(4);
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; if (dv.getUint32(o) === 0x636D6170) tab = new Uint8Array(ab, dv.getUint32(o + 8), dv.getUint32(o + 12)).slice(); }
  }
  if (!tab) throw new Error('no cmap table');
  const t = new DataView(tab.buffer, tab.byteOffset, tab.byteLength), set = new Set(), nt = t.getUint16(2);
  for (let i = 0; i < nt; i++) {
    const so = t.getUint32(4 + i * 8 + 4), fmt = t.getUint16(so);
    if (fmt === 4) { const segX2 = t.getUint16(so + 6), ends = so + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ros = deltas + segX2;
      for (let k = 0; k < segX2 / 2; k++) { const e = t.getUint16(ends + k * 2), s = t.getUint16(starts + k * 2), d = t.getInt16(deltas + k * 2), ro = t.getUint16(ros + k * 2);
        for (let ch = s; ch <= e && ch !== 0xFFFF; ch++) { let g; if (!ro) g = (ch + d) & 0xFFFF; else { g = t.getUint16(ros + k * 2 + ro + (ch - s) * 2); if (g) g = (g + d) & 0xFFFF; } if (g) set.add(ch); } } }
    else if (fmt === 12 || fmt === 13) { const ng = t.getUint32(so + 12); for (let k = 0; k < ng; k++) { const o = so + 16 + k * 12, s = t.getUint32(o), e = t.getUint32(o + 4), g = t.getUint32(o + 8);
      for (let ch = s; ch <= e; ch++) if (fmt === 13 ? g : g + ch - s) set.add(ch); } }
    else if (fmt === 0) { for (let ch = 0; ch < 256; ch++) if (t.getUint8(so + 6 + ch)) set.add(ch); }
    else if (fmt === 6) { const first = t.getUint16(so + 6), cnt = t.getUint16(so + 8); for (let k = 0; k < cnt; k++) if (t.getUint16(so + 10 + k * 2)) set.add(first + k); }
  }
  return set;
}
// Called once in the engine boot (after fonts load). A font whose cmap fails to read console.errors
// without blocking startup.
U.loadCmaps = async (faces = window.FONT_FACES || []) => {
  await Promise.all(faces.map(async f => { try { CMAPS[f.family] = await readCmap(f.url); } catch (e) { console.error(`cannot read font ${f.family}'s cmap: ${e}`); } }));
};
U.missingGlyphs = (font, text) => {
  const fam = famOf(font), cm = CMAPS[fam];
  const chars = [...new Set([...String(text)])].filter(ch => !/\s/.test(ch));
  if (!cm) return chars;
  return chars.filter(ch => !cm.has(ch.codePointAt(0)));
};
// console.error on missing glyphs (qa.py / render.py treat page console.error as failure).
// Returns true = everything present.
U.assertGlyphs = (font, text, where = '') => {
  const fam = famOf(font), miss = U.missingGlyphs(font, text);
  if (miss.length) console.error(!CMAPS[fam] ? `font "${fam}" is not registered or its cmap was not read (FONT_FACES in lib/fonts.js)${where ? ' (' + where + ')' : ''}`
    : `missing glyphs: font "${fam}" lacks "${miss.join('')}"${where ? ' (' + where + ')' : ''} -- it will silently fall back to system fonts. Add them to the subset with scripts/font_subset.py, or draw the text as paths.`);
  return miss.length === 0;
};
U.fontFamily = famOf;

})();
