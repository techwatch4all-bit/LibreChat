# 21_kusama · Kusama infinity polka dots

> Source: migration test A (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/21_kusama.js`.

Filename during the experiment: `scenes/05_kusama.js` (124 lines). 0.45↔0.9s diff is 17.3%, adjacent-frame median 2.98%, JS side 4–28ms.

**Crawling dots**
- Every dot's radius multiplied by one "traveling wave radiating from the cat": `wave = 0.82 + 0.28·sin(dist·0.012 − 6t)`.
- The whole room's dots pulse outward from the cat's position ring by ring, like breathing. This one function animates the entire screen.

**Dot placement**
- Wall: big dots (30px, spacing 104) + small dots (10px, offset) as two hex grids, each jittered ±25–50%. Each dot a slight ellipse with random rotation, like hand-drawn.
- Floor: 9 rows, bigger nearer (6→28px), sparser, squashed to 0.42 ellipses for perspective.
- Red dress white dots 13px, spacing 52, **crawling down the dress** at 46px/s (clipped to the dress silhouette, y offset modulated).
- Cat: white dots on orange areas, red dots on white areas, each crawling downward.
- A red dot on the cheek too (Kusama's body painting), and a red-ground white-dot bow on the head.

**Infinity Mirror Room (window)**
- 3D lattice lamps: 13×7×3, 6 colors. z cycling toward camera at 0.3/s, perspective projection F150.
- Each lamp a solid small core + 3.2× halo, composited lighter.
- Pitfall: v1 lamps were randomly scattered with big halos, blurring into bokeh. Regular lattice + small solid cores give the mirror-infinite-repetition feel.

**Yellow pumpkin**
- 5 petal ellipses, painted outer → inner.
- Each petal rows black dots: center column largest (9.5px), shrinking toward both sides and up/down, dot size also following the traveling wave.
- Overall breathing: scale `1 ± 0.025·sin(5t)`, pivoting on the base.

**Ending "self-obliteration"**
- lt 1.0–1.26: a red overlay fades in; a full-screen 120px hex dot grid pulses outward from the cat's position to 0.47 spacing. Then ~0.15s with only the dot grid gently breathing, giving the ending a resting point (review noted v1 had no hold frame).
- The last frame rests on the red-ground white-dot grid.
- Pitfall: v1 let dots grow infinitely — the result was a white screen. Radius must be capped; the ending must rest on the grid, never on flat color.
- Pitfall: dress and wall are both red-ground white-dot, so the girl dissolves into the frame. Final version raised the girl's outline to 4.5px and removed red dots from the cat's white areas, preserving the orange/white boundary.
