# 27_kirby · 1966 Marvel galaxy era (Jack Kirby + four-color offset)

> Source: migration test C (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/27_kirby.js`.

Filename during the experiment: `scenes/k1_kirby.js` (255 lines). ~20ms per frame, frame diff 7.5%.

**Pipeline: the same geometry painted twice**
1. **Color plate layer**: paper `#f4ecd6` + flat fills + Ben-Day halftone. Wall: C dots on light blue (pitch 9, r 2.7, 15°); floor: purple dots on deep blue (pitch 9, r 3.2, 75°); skin: red dots (pitch 7, r 1.5, 75°). **The whole layer `drawImage(color, 4, 3)` = misregistered plates**.
2. **Ink layer**: white ground; each part "white fill → shadows → black outline 6px". Composited with `multiply` over the color plate; white = transparent. Filling each part white covers the previous parts' lines, so only visible lines remain — no visibleLines needed.
3. **Kirby's spotted blacks + feathering**: light comes from the window (LIGHT=(-0.86,-0.5)).
   - Black crescent: `path ∩ ¬translate(path, LIGHT·d1)`, d1=14. Method: first `clip(path)`, then `clip(…,'evenodd')` with "fullscreen rectangle + translated path", finally fillRect black.
   - Feather band: same construction with d2=30 gives a band; parallel lines along the light direction drawn inside it (spacing 9px, width 2.6).
   - Parameters (d1/d2): skirt 16/34, torso 14/30, sleeve 10/22, hair 12/26, cat body 16/34, tabletop 10/18.
   - One function gives any Path2D a Kirby-style shadow.

**Motif animation**
- **Kirby krackle**: a cluster of 16–26 black circles. Distances distributed by `R·rnd^0.7`, larger near center (`R·(0.05+0.2·(1-d/R))`), 12fps reseed, radii pulsing with `sin(18t+i)`. 6 clusters travel along an S-shaped energy stream outside the window (`(k/6+0.42t)%1`); the energy stream is an orange-edged yellow-core band + jagged ink edges. Steam also uses krackle (4 small clusters drifting up).
- **Speed lines**: cup velocity `|sin(min(1,lt/0.9)π)|`, dragging 9 black lines below the cup, length 70–180·v, jittering at 12fps; two action arcs behind the elbow.
- **Onomatopoeia SLURRP!**: pops in with `outBack` from lt 0.52, `Bangers-400` 132px (×0.82); black extrusion in 7 layers (each offset (0.8d,d)) makes Kirby's dimensional block letters; the red letters' top 46px clipped to yellow (two-tone letters); on a 26-spike yellow explosion box; ±3px jitter at 12fps.
- **Panels**: main panel 24..1534; one cell at right is a cat-face close-up, pupils rising with `cup` (`lerp(14,-18,cup)`), looking left. Background magenta + yellow halftone + 44 focusing black triangles (12fps swap) + 6 krackle clusters around the head. Bottom caption box "BUT THE CAT IS WATCHING!", upper-left caption "MEANWHILE, AT TEA TIME...". The counter is styled as a yellow-ground black-framed caption box with a black offset shadow, tucked into the upper-right gutter.

**Characters**: 60s red A-line long dress, white Peter Pan collar (two ellipses), three black buttons down the front, black headband (elliptical arc in the head's rotated frame, width 11), flipped-up hair tips (drawn in the `skirt` hook, behind the torso). The chair is a Saarinen tulip chair.

**Pitfalls**
- The onomatopoeia started full-size at (1000,300), covering the window and the girl's face. Moved to (990,318) and scaled to 0.82.
- The big black ellipse right of the cat close-up made the cat look tortoiseshell; changed to a narrow edge-hugging crescent.
- Planet rings must split into a rear arc (painted first) and a front arc (painted later), otherwise the ring cuts through the planet.
- **Still improvable**: the frame leans "clean pop comic"; it still lacks Kirby's blocky fingers, more extreme perspective, and muscle tension.
