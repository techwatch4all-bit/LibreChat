# 36_picasso_blue · 1903 Picasso blue period

> Source: migration test D (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/36_picasso_blue.js`.

Filename during the experiment: `scenes/r5_bluepicasso.js`, ~24ms per frame.

**Pipeline**: blue monochrome flat underpainting (wall, floor, night sea and moon outside the window) → broad dry strokes repaint, then blurred 7px layered at 80% → extremely faint dry-brush filaments → window frame copied back as-is plus small strokes → table on its own layer → environment heavy outlines (no jitter) → waves, moonlight glints, clouds → characters (elongated as a whole) → character fine strokes + cold-light gradients → visibleLines heavy outlines → shawl fold lines → slow steam → canvas weave + cold vignette.

**Key parameters**
- Palette: #132240 / #1d3866 / #2d5a94 / #6b8fb6 / #b6c8d8 / slate-teal #3b6878, strictly monochrome.
- The orange-white cat maps by value: orange = mid blue #4f719a, tabby #273f66, white = light blue #b6c8d8. Blond hair = the brightest blue-gray #cbd8e0, skin #90a9be — hair must be one step brighter than skin or it won't read as "gold".
- Wall strokes: cell34, len110, w34, jitter 4, vertical ±0.5·noise(0.003); palette mixBase 0.8; then blur 7px at α0.8. Floor strokes same parameters, horizontal.
- Dry-brush filaments: 900 lines, α0.07, length 30–90.
- Elongation: girl `DOMMatrix().translate(1240,932).scale(0.84,1.12)`, pivoting on the feet; cat scale(0.82,1.14) around (540,905). The same matrix used in three places: Path2D.addPath, offscreen setTransform, and the setTransform inside visibleLines' callback.
- Shawl: dropped from forehead/headTop, over nape, back, landing at waist+70, color #6b8fb6, folds rgba(20,40,80,.6) 4px. Long fingers: 3 slender ellipses 22×4.5 around the cup.
- Outline: Prussian blue #0c1830, 5px, no boiling. The blue period's outlines are assured — they shouldn't jitter.
- Slowness: breath sin(1.8t)·0.026 (about 2× the shared choreography's amplitude, ~0.45× its frequency); the cup raises over 1.25s (shared choreography 0.9s); steam rises at 0.5× time.

**Motif animation**: sea waves sliding horizontally outside the window (faster nearer, speed 20 + 0.25·(y − 400)), 14 moonlight glints flickering, one pale long cloud crossing the moon, slow breathing (person and cat), cup drinking, steam. Moving area 3.2%.

**Pitfalls**
- V1 kept a little ochre for the cat and hair (wanting to reference "The Old Guitarist"); independent review judged it breaks the monochrome. The blue period is all blue; differentiate by value.
- cell16, len40, w14 vertical strokes wall-to-wall read as "rain/blanket" — that's Impressionism, not the blue period. It needs wide, long, low-contrast strokes, then a blur layer.
- Broad strokes' round caps packed densely form "a crowd of heads" (see ② item 11). The 7px blur suppressed it; the real fix is a cap parameter for strokes.
- If the table area is excluded from broad strokes with a rectangular mask, a flat rectangular patch remains on the floor. The table must be its own layer painted after the strokes — don't cut holes in the strokes.
