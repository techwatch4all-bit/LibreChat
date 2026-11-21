// Load scenes/<id>.js by id; auto-load transitions/<type>.js per transition.type (synchronous XHR, so everything is registered before the engine starts).
// If any scene file is missing, has a syntax error, never registers, or a transition name is found in neither TRANSITIONS nor transitions/ → record it in window.__bootErrors;
// the engine refuses to start, and render.py/qa.py exit with an error.
// (Bitten by migration test B: previously a missing scene drew a "to be implemented" placeholder and kept rendering — 1.2 seconds of gray background — only caught by a 0.0% frame diff; a mistyped transition name silently fell back to a cross-fade.)
(() => {
  window.SCENES = window.SCENES || {}; window.__bootErrors = [];
  const load = (url) => { const x = new XMLHttpRequest(); x.open('GET', url, false); try { x.send(); } catch (err) { return { err: `request failed ${err}` }; }
    if (x.status !== 200) return { err: `${url} does not exist (HTTP ${x.status})` };
    try { (0, eval)(x.responseText + `\n//# sourceURL=${url}`); } catch (err) { return { err: `${url} failed to execute ${err && err.stack || err}` }; } return {}; };
  // A film may preload its own shared scripts (window.SCENE_LIBS, in order) and its own scene directory window.SCENE_DIR (default scenes).
  // Segments already registered in SCENES[id] by a shared script no longer look for a separate scene file (that's how the demos/ sample films are organized).
  for (const f of window.SCENE_LIBS || []) { const r = load(f); if (r.err) __bootErrors.push(`shared script ${r.err}`); }
  const dir = window.SCENE_DIR || 'scenes';
  for (const e of ERAS) {
    if (!e.draw) {                                          // segments with an inline draw in eras.js do not need a file
      const r = SCENES[e.id] ? {} : load(`${dir}/${e.id}.js`);
      if (r.err) { __bootErrors.push(`${e.id}: ${r.err}`); continue; }
      const sc = SCENES[e.id];
      if (!sc || typeof sc.draw !== 'function') { __bootErrors.push(`${e.id}: file has no SCENES['${e.id}'] = { draw(c, lt, t) }`); continue; }
      e.draw = sc.draw; if (sc.init) e.init = sc.init;
    }
    const ty = e.transition && e.transition.type;
    if (ty && !TRANSITIONS[ty]) {                            // project-local transition: put it in transitions/<type>.js, attached to TRANSITIONS under the same name
      const r = load(`transitions/${ty}.js`);
      if (r.err || !TRANSITIONS[ty]) __bootErrors.push(`${e.id}: transition "${ty}" is not in transitions.js and there is no transitions/${ty}.js (${r.err || 'file does not register TRANSITIONS.' + ty})`);
    }
  }
})();
