# 55_dunhuang · Dunhuang murals (Northern Dynasties): mineral pigments on dry mud walls, lines flying across

Status: research recipe; a v1 demo was added 2026-10-16 (see "v1 implementation" at the end); self-score ~72, under 80, not registered as a mature implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md) and [Protocol 16](../16-style-demo-95-point-protocol.md), then this card. Originals are used only to compare visual language; figures, compositions, and subject matter are not copied directly. The "stable traits" below come from the originals actually viewed this time, not official parameters.

## Scope

Pick one period before production; do not blend Northern Dynasties, High Tang, and Late Tang into one generic "Dunhuang look":
- Northern Dynasties (Cave 257's Deer King Jataka, Cave 285's Western Wei apsaras, Cave 428's Northern Zhou): earth-red ground, white running beasts, jagged mountains, teal wind-blown leaves, apsaras flying horizontally. This card's v1 does this branch.
- High Tang (Cave 112's pipa behind the back, Cave 45's bodhisattvas): all-over gold-and-blue-green, full-bodied figures, grouped music and dance. Not yet done.

## Stable traits (observed from the originals)

- Ground: Cave 257 is a whole wall of earth red like #92342d; Cave 285 is creamy white #e8dcc5; the two can split into upper/lower registers with a multicolor horizontal band (black/white/teal/ochre) + pearl roundels between them.
- Form: running beasts are one solid white, a single contour line, almost no interior lines; mountains are rows of narrow tall jagged triangles, each one color with one side darkened, large red ground exposed between them; figures small, spread horizontally.
- Apsaras (Cave 285): flying horizontally, head foremost, shawl swept back, lower body dissolved into one long skirt trailing behind; small faces, slender brows and eyes, red blush on the cheeks; lines are red-brown iron-wire / orchid-leaf strokes.
- Wind leaves: comma-shaped teal-green curled leaves, flocks tumbling backward.
- Color: azurite #3e919c, malachite green #577f7a, vermilion, ochre, lead white; lead white oxidizes dark with age — Cave 428's skin reads gray-blue.
- Wall surface: craquelure, flaking exposing the underlayer, salt bloom whitening, mud-wall grain; cracks cross the people and beasts in the picture. A diamond-grid band at the top, a triangular valance band at the bottom.

## Difference from neighboring styles

Not Persian miniature (all-over, precise, gold-lined); not Giotto (fresco's plaster veil); not guofeng illustration (that one is glossy gradients and cloud motifs). Dunhuang's texture is "dry, old, cracked", and its colors are minerals, not pigments.

## Production route (used by v1)

`scenes/55_dunhuang.js`: wall base (P.texture mud) → upper/lower registers + horizontal band + top diamond grid + bottom valance (cached) → jagged mountains (cached) → dynamics: wind leaves tumbling left in speed layers, apsaras (`apsara()`, widening streamers via `ribbon()`), scattered flowers, white deer running (`deer()`, leap-gather two beats), hoof dust → overlay (craquelure, flaking, salt bloom, painted above the picture) → mud-grain multiply.

## v1 implementation (2026-10-16, self-score ~72, taste items await Uncle Hua)

- Masterpiece anchoring: Cave 257's Deer King Jataka, Cave 285's Western Wei apsaras, Cave 428's Northern Zhou apsaras, Cave 112's pipa-behind-the-back (sources in the `参考.md` [key: "reference.md" — the notes file fetch_reference.py actually generates, name kept as the tool emits it]; the Cave 112 and Cave 257 images are puzzle-book rephotographs — only palette and composition are taken, no tracing).
- Dynamics: wind leaves tumbling back, apsaras bobbing with streamers swinging, scattered flowers falling, white deer and fawn running, hoof dust, drifting dust.
- Known shortfalls: mountains still lean geometric triangles, missing Cave 257's layered overlapping rhythm; apsara torsos too flat, missing the half-profile volume; lead-white oxidation darkening not done; the High Tang branch not done.
- Not yet validated: cross-subject (swapping apsaras for another subject), portrait orientation, compositing with voiceover films.

## Backflow after use

Read this section's latest conclusions before use. Record only new findings: date, subject, method, problem, fix, verification status, applicable scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules; research hypotheses rise to implementation recipes only after cross-scene reproduction.
