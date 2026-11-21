// Demo · Long-scroll traversal film: one horizontal scroll where several "world segments" join end to end, the hero walks left to right, and the art style changes as they cross each boundary.
// Only 3 segments are included here (Egyptian mural -> Monet's "Japanese Footbridge" -> 8-bit pixels); the full film has 24 segments, see references/11-scroll-traversal-film.md for the method.
//   Preview index.html?film=demos/long_scroll   Render render.py --film demos/long_scroll --out long_scroll.mp4
// The skeleton lib/world.js manages the timeline, the hero's march, the forward-only camera, the hero clipped at segment boundaries, and the corner badge; each segment is one file segments/<id>.js calling WORLD.add({...}).
(() => {
  window.__bootErrors = window.__bootErrors || [];
  const base = 'demos/long_scroll/';
  const load = url => { const x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); if (x.status !== 200) { __bootErrors.push(`${url} not found (HTTP ${x.status})`); return; }
    try { (0, eval)(x.responseText + `\n//# sourceURL=${url}`); } catch (e) { __bootErrors.push(`${url} failed to execute ${e && e.stack || e}`); } };
  load(base + 'lib/crossing.js');                 // XING: character frame library, brush-stroke material, the Monet world
  load(base + 'lib/acts.js');                     // ACT: small staging tools such as skipping-stone trajectories
  load(base + 'lib/world.js');                    // WORLD: the long-scroll skeleton
  // Film order: reorder or add segments only here (adding a segment = drop a file into segments/, then list its id here)
  window.FILM_ORDER = ['02_egypt', '28_monet', '14_8bit'];
  for (const id of window.FILM_ORDER) { const n = WORLD.segs.length; load(`${base}segments/${id}.js`);
    if (WORLD.segs.length === n || WORLD.segs[WORLD.segs.length - 1].id !== id) __bootErrors.push(`segments/${id}.js is missing WORLD.add({ id: '${id}', ... })`); }
  // Register every frame library each segment uses (hero.walk, acts[].key, sprites) as assets in one pass, all loaded before engine start
  const sprites = new Set(); WORLD.segs.forEach(s => { if (s.hero && s.hero.walk) sprites.add(s.hero.walk); (s.acts || []).forEach(a => a.key && sprites.add(a.key)); (s.sprites || []).forEach(k => sprites.add(k)); });
  try { window.EXTRA_ASSETS = (window.EXTRA_ASSETS || []).concat(XING.sprites([...sprites])); } catch (e) { __bootErrors.push('Missing frame library: ' + e.message); }
  WORLD.layout();
  window.PUNCH = 0;
  window.ERAS = [{ id: 'film', dur: WORLD.total, draw: (c, lt, t) => WORLD.draw(c, t) }];
})();
