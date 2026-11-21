# 12_bauhaus · 1923 Bauhaus poster

File: `scenes/12_bauhaus.js` (~210 lines). Performance: warm mean 5ms, max 9.5ms, first frame ≈85ms; determinism passes; motion diff lt 0.34→0.46 moves 4.9% of pixels (black rod, grid window, concentric arcs, cat, ball, figure all move). Segment hold 0.47s (T11 blue square / red circle / yellow triangle / round-hole transition 0.20s, origin (1330,590) ≈ the red circle's center).

## Pipeline
1. **Base plate fully cached `bh_bg`**: aged off-white paper `#ebe3cf` + a 320×180 fbm small image upscaled at α0.5 (aged mottling) + a fine diagonal line crossing the frame (40,170)→(1900,840) (pressed behind the window) + upper-left black horizontal bar (60,61,256,13), red vertical bar (292,105,24,468) + vertical "bauhaus" (`Poppins-800` 210px, `rotate(-π/2)` then horizontally scaled to exactly 820px long, origin (262,1000) read bottom-up) + gray small squares + ground line (345,898)-(1860,915) + yellow right triangle + katze (Poppins-800 150px, red `#d3262b`) + two lines Poppins-600 31px lower-right + black-top table / chrome tube legs (three-color linear gradient) + Breuer cantilever chair (same path stroked 15px dark gray / 10px chrome / 3px highlight offset 2px) + two grain layers (dark specks 0.02 density α0.35, old-print black blotches).
2. Red circle cached separately 520²: base color + fbm light blotches overlaid with `source-atop` at α0.55, imitating silkscreen/lithograph uneven ink.
3. Characters and composition are all geometric: no curved strokes at all, only circles, squares, triangles, heavy rods.

## Motif animation
- **The slanted long black rod turns like a pointer**: angles measured frame by frame from the original (frames 575–579 at 28°, 581 at 33°, 583 at 37°, 585 at 42°, 587 at 46°, 591 at 49.5°), written as `deg = 28 + 21.5·easeOut(clamp((lt-0.26)/0.22))`. Axis = hub center (1125,195) (confirmed comparing frames 576/590: hub fixed, lower end sweeps down); rod 27px from -432 to +150, fine parallel line offset 30px, red short rod offset -30px, hub's inner arc turning with it.
- **Mondrian grid window cycling**: 4×4 grid (inner frame 366..794 × 126..561, cells 100×101, seams 9.5), 6 cells participating in the cycle, 13fps stepping `step=floor(lt·13)`, each cell a different phase, changing only when `(step+2·sw)%9 < 6` (not every beat — the rhythm isn't mechanical); cycling colors restricted to red yellow blue cream pale-blue gray. Pattern cells (9px graph paper) and quarter-circle cells stay.
- **Concentric arcs**: 6 arcs right of the red circle, start phase wobbling `sin(9lt-0.7i)·0.05`, radius breathing `±3`, arc length sweeping 55%→100% over 0.4s — like sound waves pushing outward.
- **Cup steam**: one 2.2px sine fine line (26 periods per 170px, `-18t` traveling wave), fading with a linear gradient.
- **Cat batting the ball once**: right forepaw `tap = sin(clamp((lt-0.05)/0.16)·π)` extends 36px forward then retracts; blue ball r31 rolls from x712 to 816 at lt 0.13→0.47 with easeOut, **rotation angle = displacement/radius** (white diameter line + white dot make the roll readable), two speed lines behind while rolling. Tail = a 26px thick orange arc + dashed dark-orange stripes of the same width, angle following `choreo.tail·0.5`.

## Characters geometricized (anchors all from RIG)
- **Schlemmer figure**: head = circle r70 (`G.A.headC + (14,-18)`), gold geometric hairpiece = the back half-head's fan (−1.95→1.15rad) + forehead triangle + bun circle r34 + back half-disc hairpiece (`G.A.back`); face = black vertical-bar eyes (blinks become horizontal bars), red square cheeks, short black mouth. The whole head group rotates around `G.A.neck` by `G.tilt` (tilts back when drinking). Torso = blue trapezoid + rear black trapezoid (rising/falling with breathe); skirt = black fan r178 + blue trapezoid; limbs = heavy black round-capped rods, joints = cream discs + 5px black ring + black center dot. The near arm uses `G.A.shoulder/elbow/hand` directly (RIG's IK cup hold); the far arm rests flat on the table (recreating the original's hand reaching across the table).
- **Cat**: body circle r100 (derived from `K.box` at (536,805), scaled with breathe) + 4 dark-orange horizontal bars on the left (clipped inside the circle) + a cream fan lower-right (orange-white color blocks); head = a 104 square (`K.headC + (14,48)`, micro-rotating ±0.08rad with the tail phase) + yellow triangle ears + cream lower face + dark-orange forehead band; eyes = white circles + black vertical-bar pupils.

## Palette
Paper `#ebe3cf`; black `#161514`; red `#d3262b`; blue `#2a58b4`; yellow `#efc12f`; pale blue `#b9cee0`/`#a6c0da`; gray `#c6c3bb`; cream `#f2ecdf`; orange `#ee8a2a`/`#c25a14`; chrome `#c9c9c6`.

## Pitfalls
- V1 computed the grid at 107px; the right side overflowed the black frame by 16px — grid window size must be back-derived from "inner frame width − 3 seams".
- Black was in the cycling palette: whenever a cell swapped to black the whole window suddenly weighed down like a broken cell. Removed.
- The figure's mouth was initially drawn per the original as a long black bar sticking out of the head — on the girl's face it read as a cigarette; changed to a short bar inside the head.

## Still improvable
- The cat's head/body are shifted down relative to the RIG armature (to seat the square head on the round body); during transitions the cat head position differs ~50px from the neighboring eras.
