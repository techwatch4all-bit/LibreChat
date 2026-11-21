# 10_nouveau · 1896 Art Nouveau (Mucha poster)

File: `scenes/10_nouveau.js` (~300 lines). Performance: warm mean 29ms, max 37ms, first frame (cache build) ≈80ms; determinism passes (same lt twice, pixel-identical); motion diff lt 0.35→0.65 moves 13.1% of pixels. Segment hold 0.70s (T09 organic-wave transition 0.24s, growing out from (1330,320) = the girl's halo).

## Pipeline
1. **Base plate fully cached `nv_bg`**: gray-green→sage→peach three-stage vertical gradient (`#b9cba0`→`#cfd3a6`→`#ecc9a2`, laid only inside the inner frame 34..1886×32..907); dot ornament = ring r10 + center dot r2.6, row spacing 54, column spacing 62, odd rows offset 31 (diamond stagger), color `rgba(120,140,100,.38)`; a 240×135 fbm small image upscaled at α0.5 for lithograph mottling (hundreds of times faster than computing noise full-screen); mosaic floor tiles 20×24 per cell, 9 colors shuffled `(k*7+(k>>2))%9`; green banner `#8fac80`; title `Marcellus-400` 76px, letterSpacing 12, 7px dark-brown stroke first then cream fill; gold frame = outer 6px gold `#c9a24a` + two 2px dark-brown lines inside and out.
2. **Variable-width path `ribbon(pts, w(q))`**: point list densified with Catmull-Rom (4–10 points per segment), each point offset w/2 on both sides along the normal, assembled into a closed polygon and filled. All "whiplash lines" are this: stems, leaves, ironwork table legs, banner scrollwork, hair, steam. `swellW(wmax)` = pointed at both ends, thick in the middle (sin envelope) — that is Mucha's line-weight breathing. Spiral finish `spiral(cx,cy,r0,a0,turns,dir)`: radius shrinking linearly to 15%.
3. **Mucha's "heavy outer contour, fine inner lines" — offset silhouette method**: characters (cat + girl + hair + drapery) all drawn into offscreen layer L (RIG both mode, lw 2 → inner lines occlude correctly in part order); then L is copied and tinted dark brown `#4e3320` with `source-in`, laid beneath L at offsets (-1.5,-1.5), (3.5,4.5), (2,2.5). Result: a 1.5px ring at the silhouette's outer edge, a 4–5px thick edge on the lower-right; inner lines stay 2px. Only 3 extra full-screen drawImage calls.
4. Grain `P.grain('nv', .05, warm brown, .14)` on top — like a lithograph print.

## Motif animation (all visible within 0.7s)
- **Sun rising**: measured from the original (frame 509 (583,400) → frame 530 (576,299), ≈−5px/frame), written as `sy = 400 - (lt-0.267)·288`, `sx = 583 - (lt-0.267)·20`; at lt=0 it's at 477 (hidden behind the hill), at lt=0.7 it reaches 275. Hill color bands drawn after the sun = natural occlusion of "rising from behind the hill".
- **Leading rays rotating**: 14 radiating lead lines from sun center r92→r420, angles `+lt·0.9·0.25` slow rotation with ±0.04 sway; the rays move with the sun, so the whole window's glass segmentation changes — the most conspicuous motion inside the window.
- **Stained-glass border band**: along the arch's inner edge (straight sides + elliptical arc rx219 ry130), a 14×14 glass piece every 17px, rotated to the tangent, 6 colors cycling.
- **Poppies/lilies swaying**: flower heads horizontal displacement `sin(7.5t+φ)·13 + sin(3.1t+2φ)·5`, stems are ribbon three-control-point curves pushing only the upper section; left and right clumps phase-opposite; leaves at 0.3× amplitude.
- **Halos rotating**: girl's halo R172 with 18 round studs turning `+0.9t`, inner ring 32 rose-window petals turning `-0.63t` opposite; cat halo R106 with eight orange petals `-1.1t` + a gold dashed ring moving its lineDashOffset.
- **Hair**: first one big hair mass (16-point smooth, outer edge waving `sin(6t+y·0.035)·9`), then 7 back curls + 2 front curls: each lock a 12-point S-curve `sin(7.4q+φ-7t)·(6+20q)` (traveling wave downward), ending in a 1.2-turn spiral, width 14–18 → 2.5 decreasing, cream-yellow highlight core + dark-gold fine line. 6 small curls on the head-top outer edge for volume. All points follow `G.A.headC`'s offset (moving together when she tilts to drink, following less further down).
- **S-shaped decorative steam**: 3 cream ribbons (width 26/20/14) + 1.8px brown stroke + midline, traveling wave `sin(4q+φ-6t)·(18+70q)`, horizontal spread ×(1+2.6q) with height, ending in a 34px spiral; overall `lean = -90 - 160·cup` tipping left — **pitfall**: choreo lifts the cup to the mouth; steam rising straight would cross the girl's face, so it must tip toward the window with cup.
- choreo: cup drinking, head tilt, blink, tail flick, breath all via RIG; the saucer stays on the table (tabletop not empty once the cup is lifted away).

## Palette
Lines `#4e3320`; gold `#c9a24a`/`#9c7a2e`; cream white `#f6eedb`; skin `#f6dcc4`; blond hair `#e8bf55`/highlight `#f6dc8a`/dark `#b9862a`; dress `#f4ecda`; pink drapery `#e6aaa5`/folds `#d48e8c`; poppies `#d9706a`/`#b4504b`, centers `#3f6a4a` + gold dots; lilies `#f7f2e6`; ironwork `#3d7763`; cat `#e39a4c`/`#fbf3e3`/stripes `#c0672c`, eyes `#e6c040`; halo pink `#ebb8b2`, teal ring `#5f9a8a`, cat-halo red `#b8473a`.

## Pitfalls hit
- **`drawGirl(mode:'line')` on the topmost layer strokes the occluded parts' outlines (far sleeve) through the torso** (the 09 benchmark has this too). Fixed by drawing lines in part order with both mode inside the offscreen layer, then building the heavy outer contour from the whole layer.
- Hair was initially 7 long bands 34px wide — sausages/noodles. Mucha hair = one hair mass as base + fine S-curl locks + spiral finishes, width ≤18.
- For self-check diffs, don't take frames at lt<0.33: the engine has a 1.03× "beat punch" zoom within 20 frames after a transition starts, and the diff lights up the whole screen.

## Still improvable
- The cat still uses RIG's sitting pose (straight white legs); the design sheet shows a reclining fluffy orange cat. The Mucha flavor is carried mainly by the halo and the line weights.
- The title uses Marcellus; the design sheet wants rounder hand-drawn Art Nouveau letterforms; a hand-written alphabet path set is possible.
