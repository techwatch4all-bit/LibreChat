# 26_vaporwave · 2011 vaporwave / cyber neon

> Source: migration test B (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/26_vaporwave.js`.

Filename during the experiment: `scenes/c5_vaporwave.js` (~210 lines). Review red flag: the top was pink in v1 and blended into the pink-toned skin — read as undressed. Changed to a lavender trench coat `#8f7cf6` + white triangular collar + teal zipper line. Median 49ms per frame; frame diff 25% (VHS post makes the whole screen move).

**Pipeline**: the whole frame paints into offscreen S first, then VHS post outputs to c (the counter is drawn by the engine on the topmost layer, unaffected by chromatic aberration).
1. Wall: deep purple vertical gradient `#0d0322 → #4a0f6a` + a magenta radial glow at the window, a teal radial glow at the sign. A teal light strip along the baseboard.
2. **`glowLine(c, col, w, blur)`**: the same path first stroked with a thick shadowBlur glow, then a 2–3px near-white core line — that's a neon tube.
3. Sunset in the window: the sun is a yellow → orange → magenta vertical gradient, cut with 7 horizontal slits via `destination-out`, slit width growing with depth (2 + q²·16), the whole thing moving up at 0.9/s. The horizon is wireframe mountains (magenta glow), below it a teal perspective grid rolling toward the viewer, palm silhouettes swaying left and right.
4. Floor: magenta perspective grid, vanishing point (960,600), horizontal lines `y = 600 + 520/d`, d = k + 1 − phase (phase = 1.3t mod 1), line widths thickening near.
5. **The neon sign "カフェ" draws tubes with polylines** (no font dependency): each kana 1–3 strokes, (u,v) unit coordinates. Per-letter flicker by frame hash: `hash(floor(30t), k) < 0.07` off; "フ" additionally has a 22% chance to go off when `f mod 17 < 5`, drawing a dark-purple tube when off.
6. Win95 dialog TEA.EXE: gray body, navy gradient title bar, progress blocks `3 + 14lt` cells, percentage `18 + 70lt`. A marble bust on the table (side-profile silhouette 22 points, purple-gray gradient + vein lines + pink rim light + sunglasses stems).
7. Characters: pink sweater, teal pleated long skirt, blond hair + pink scrunchie. Glow outline "pink on the window side, teal on the back": the same paths stroked twice, clipped to left/right half-screens respectively.

**VHS post `vhs(c, S, t, lt)`**
- RGB split: for each channel, draw S into a temp canvas, `multiply` pure `#ff0000/#00ff00/#0000ff` to isolate the channel, then composite onto black with `lighter` at offsets. Offset 3 + 1.5sin(7t), occasional (hash<0.12) +6.
- Tracking noise band: 70px tall, rolling down `(520lt + 200) mod (H+160)`. Inside the band every 6px a horizontal shift `±30·sin(πy/bh)`, plus 90 white-gray noise lines.
- Scanlines: 4×4 tile pattern (row 0 α 0.28, row 2 α 0.12). OSD: PressStart2P "PLAY" + hand-drawn ▶ (the font lacks this glyph), flashing every 16 frames; lower-left date and timecode advancing with lt.

**Palette**: magenta `#ff4fd8`, hot pink `#ff2f8f`, teal `#3ff6ff`, deep purple `#12052a / #2a0b4a`, sun yellow `#ffd84a`, orange `#ff8a3a`.

**Pitfalls**
- Full-width "ＶＡＰＯＲＷＡＶＥ", ▶, and Japanese are all missing from `lib/fonts` and silently fall back to system fonts. Labels switched to half-width + letter spacing 7; ▶ and the kana are hand-drawn.
- Character strokes use part paths, so the waistline and the arm/torso junctions also glow. Acceptable for a neon line drawing, but for a pure outer contour you must first paint the silhouette into an offscreen and stroke the offscreen's edges.
