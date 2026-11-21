# 04_roman · 79 AD Pompeii Mosaic — Technique Notes

File: `scenes/04_roman.js` (~330 lines). Final self-check: warm max 17ms / mean 13ms (1920×1080), init 206ms (once at boot), 17,871 stones of which 13,067 in the dynamic zone re-sample color every frame. Determinism passes.

## Core idea: layout computed once, color flows through the stones every frame

Mosaic animation should look like this: the stones stay fixed on the wall; what moves is the color flowing from one to another. So the renderer splits in two.

1. **init (`build()`, 206ms)**: first compute for every stone where it is, how big, at what angle, which pixels belong to it, and how its bevel is lit; store as `ID` (Int32, per-pixel stone number, -1 = grout) and `SH` (Uint8, per-pixel shading, 128 = 1.0).
2. **Each frame**: repaint the flat underpainting, `getImageData` once, sample color at dynamic stones' centers (plus each stone's fixed color jitter), then fill pixel-by-pixel `color×shade>>7` inside the dynamic rectangle, finally `putImageData` to its own offscreen canvas and `drawImage` onto `c`.
   - Pitfall: **you cannot `putImageData` directly onto `c`**, because it ignores the engine's punch zoom and transition clipping. It must go into an offscreen canvas first and then `drawImage`.
   - Only ~1M pixels per frame are processed pixel-by-pixel (4 border bands, inside the picture frame, girl, cat), about 5ms in a JS loop. All offscreen contexts use `{willReadFrequently:true}` or `getImageData` is slow.

## Stone layout (andamento: placed along contours)

Simplified from the approach of Hausner 2001 "Simulating Decorative Mosaics".

- **Structure map**: the static underpainting plus the cat and girl of frame 0 (excluding the moving near arm), downsampled to 960×540. Neighboring pixels whose summed RGB difference exceeds 34 are marked edges; the border bands' boundaries in the class map also count as edges.
- **Distance field**: Felzenszwalb–Huttenlocher exact Euclidean distance transform (two passes of 1D lower envelope), ~20ms at half resolution.
- **Stone placement along contour walks**: candidate pixels satisfy |d−(k+½)s|<1.5, k < that class's ring count — i.e. contour bands of the distance field. Starting from unvisited candidates, walk the 8-neighborhood preferring the candidate "most consistent with the previous step's direction" (direction smoothed 0.6/0.4), placing a stone when the distance from the previous one ≥s. Stone orientation takes the tangent of the distance-field gradient. A spatial hash guarantees any two stones are ≥0.8× average size apart.
- **Regular rows to fill holes**: each class gets a grid with half-stone offset rows (row jitter ±5%, column jitter ±9%). Minimum spacing check uses 0.86; place if it fits. This step also fills holes between contour rows and along the axis.
  - Pitfall: initially only let grids fill where "distance ≥K×s" — narrow shapes (cat tail, 26px wide) got no stones at all, the whole tail showed grout. Fixed by relying only on the minimum spacing.
- **Border bands laid separately**: each edge lays 11 rows in its own local coordinates, stones 7.6px, width along the edge random in 0.86–1.14; the four corners are 11×11 square grids.

| Class | Stone edge px | Contour rings | Color jitter |
|---|---|---|---|
| Wall | 12 | 1, then regular rows | ±8%, 7% of stones additionally darkened 12% |
| Halo (white edge outside people/cat/objects) | 11 | 9 (the whole halo along contours) | ±5% |
| Girl body / objects | 10 | All along contours | ±5% |
| Girl face, cat head | 6 | All | ±4% |
| Hair | 8 | All | ±5% |
| Inside volcano painting | 9 | 2 | ±6% |
| Outer frame band | 7.6 | Rows along the edge | ±5% |
| Text | 7 | All | ±5% |
| Ground band | 13 | 1 | ±6.5% |

Beyond the table's jitter, every stone gets an additional ±7 additive grayscale jitter. 9% of stones lean warm (+12,+4,−8), 7% lean cold (−6,0,+9).

## Stone shape and grout: weighted L∞ Voronoi

- Each stone is a rotated square. Its four half-edge lengths each independently take `s/2×(1.08–1.28)`, rotation jittered ±0.06rad. A pixel's distance to stone k is defined as `D=max(|u|/h±, |v|/h±)`, where (u,v) is the pixel's position in that stone's local frame.
- Rasterization records for each pixel the smallest D1, second-smallest D2, and the stone numbers, costing 1.5h bounding box per stone.
- **Grout**: pixels satisfying `D1>1`, or `(D2−D1)·h/2 < g` (g = clamp(0.1s, 0.75, 1.25)px), count as grout — i.e. pixels near the bisector between two stones. So seam width is ~1.5–2.5px and stones get irregular edges "cut" by neighbors, like real chiseled tesserae.
  - Pitfall: half-edge lengths were initially `s/2×(0.9–1.1)` — stones smaller than the spacing, so grout took ~40% of the area and it looked sparse. Making stones 8–28% larger than the half-spacing and letting the bisector cut them made the stones dense. This is the key to the texture.
- **Bevel shading**: within 2.2px of the edge, brighten or darken ±16% by the dot product of the outward normal with light direction (−0.6,−0.8) (bright upper-left, dark lower-right). Plus a dome term `−5%·D1²` and ±3% per-pixel grain.
- Grout color: `rgb(112,103,92)` ±8 noise.

## Underpainting and colors

- Wall `#e4ddcd`, halo `#f5f1e8` (every person and object gets a 44–50px halo outline; stones lay a white edge along it), outline `#46322a`, outline 8px (8px on the face so it tiles into rows).
- Picture frame: red `#a8322a`, then inward in sequence: dark-red `#7c221d` line, gold `#d0a23c` line, dark line.
- Volcano: three faces bright `#7c84b8`, mid `#4e5796`, dark `#2f3672`; sky `#9ec0d8`→`#d3e3e4`; hillside `#6f9341`/`#92b254`; ground `#cba344`; cypress `#2b5a2f`; lava `#d64a22`/`#f2952c`.
- Girl: stola `#efe7d5`, hem with two red stripes `#a8322a`; red palla split into three panels (diagonal over the back, one across the knees, one hanging down the front), folds `#7c221d`, gold brooch; short sleeves are a circle of radius 62 centered on the shoulder clipped inside the upper arm, with red trim; blond hair `#dcaa42`, layer lines `#9c6c1c`, spiral bun behind the head; red headband in cubic bezier following the head's tilt. Eyes drawn as 10×6 white plus radius-5.5 dark — landing exactly as "one white, one dark" pair of 6px stones.
- Cat: orange `#dc8530`, back darkened `#c06a24`, stripes `#9c4818`, white `#f7f2e8`, big yellow eyes `#e9c22c` (radius eyeR×1.65), red collar `#b02a22` with gold pendant. Body smoothed with `RIG.smooth(K.bodyPts)` into a pear shape, replacing the original polygon. Tail rings drawn with dashes `setLineDash([9,13])`.
- "CAVE CATTVM": **hand-written monospaced heavy-stroke letters** (C from an elliptical arc, A/V/E/T/M from polylines), stroke 14px, letter height 60px, spacing 16, horizontally scaled to 600px width.
  - Pitfall: with Cinzel-700 fillText directly, thin horizontal strokes break under 7–9px stones (E becomes F, A loses its crossbar), and tight spacing merges letters into a blob. Three iterations led to the conclusion: mosaic text = monospaced heavy strokes, each stroke about 2 stones wide.

## Motif animation (this segment lt 0–0.94s; drawn to 1.29s during transition T04)

- **Wave pattern flowing clockwise on four edges**: each edge switches to local coordinates with `setTransform` (u clockwise along the edge, v from outside in), drawing the same Vitruvian scroll: starting from the inner black band, spiral r tightening 24→5 over 2.25 turns, line width 13, period 81px. Phase is `42·lt + 81·easeInOut((lt−0.485)/0.365)` — constant drift the whole way, plus one extra period at the original's frames 226–248. Stones don't move, so black/white flows between stones — exactly what a moving mosaic looks like. Between 0.4→0.9s, 20% of border-band pixels change.
- **Vesuvius smoking**: the crater is only 70px below the frame top, so smoke drifting up gets clipped and vanishes immediately (v1 hit exactly this). Changed to the whole ash-cloud band drifting right at 55px/s (period 380px), plus 9 smoke puffs (dark `#3f3c3a`→light `#a29c94`) hugging the sky drifting right and low, plus 12 sparks (10px squares, parabolic trajectories) and crater lava pulsing. 4.4% of pixels inside the frame change.
- **Cup drinking**: rhythm from `choreo.cup/sip`; the cup is a gold kantharos, white-stone steam at the rim, opacity 1−0.85·cup. Route is the hand-written `armPose` (see "Review fix" at the end).
  - Pitfall: with 15px wall stones, hand and cup smear inside the big stones. For a while the arm-sweep zone got its own 8.5px stones, which became a pale patch when static; finally unified to 12px wall-wide.
- **Cat**: tail uses `choreo.tail×1.6` (original amplitude too small under 9px stones to read), blink turns eyes into orange stones plus a dark line.

## Performance and dynamic rectangles

- Dynamic rectangles are computed at init from sampled pose bounding boxes (cup from 0 to 1 at 0.05 steps, sip at 0/0.15; cat tail tail over ±0.75), expanded 58px, enclosing halo and steam. Outside the rectangles is frame 0's static mosaic.
  - Pitfall: rectangles must be large enough, otherwise stones crossing the boundary show half new color, half old.
- On the whole-film timeline, the Roman segment's frames (including the two transitions before/after, with both old and new layers painted) stay under 40ms except for other eras' cold caches on first transition entry.

## What to know about self-check

- `selfcheck`'s "motion diff 0.2↔0.7" is polluted by the engine's beat-hit camera punch. At lt<0.37 the whole frame is zooming and the result reports 68% — that's not the painting moving. Measure 0.4↔0.9 instead (impact finished): whole frame 6.2%, of which border band 20.4%, girl 8.4%, picture frame 4.4%, cat 0.8%.

## Where it could be better

- When the girl raises the cup to her mouth, hand, cup, and face crowd together and smear slightly at the 6–8.5px stone scale.

## Review fix (second round)

- **Cat**: anchored at paw base (540,905), scaled to 0.85 via canvas transform (class map and dynamic rectangles scaled in sync), ear tips drop from y≈540 to ~590, halo no longer touches the frame. Head redrawn as a frontal Pompeii cat: two R17 big yellow round eyes, black vertical pupils, 7px dark eye rims, head with an 11px dark outline, also stroked into the class map as 6px small stones so the outline tiles into rows.
- **Cup smearing the face**: abandoned the armature's original raise route for the hand-written `armPose`. The cup moves along a quadratic bezier "table → up-forward (1150,470) → before the lips", ending with the rim's right end touching `G.lips[0]`, tilt 0.15rad (8.6°). Hand cupped under the stem (offset interpolated from (28,34) to (3,44)), IK uses the same arm lengths 165/122 and elbow direction. The forearm stands in front of the chin; nose, lips, chin, and eyes are all visible. Facial outline thickened to 10px.
- **Patch feeling**: removed the "arm-sweep zone 8.5px" class. Wall stones unified to 12px (also closer to the original's wall stone scale); the dynamic zone's wall shares the same layout as its surroundings, only re-sampling color per frame — no visible boundary.
  - Lesson: never give the dynamic zone its own stone size for detail; when static it's just a patch.
- After fix: warm max 17.1ms, mean 13.0ms, determinism passes.

## Review fixes (third round, review report v1 items 3, 4)

- **Border doesn't read as scrolling**: on the whole-film timeline (renderFrame) it does move, but with "stones fixed, only color swaps" the scroll moves 1–3px per frame, quantized away by the 7.6px stones and nearly invisible in a motion heat map.
  - Fix: the border became a "conveyor belt". At init, pre-bake a stone strip 2106px long (26 periods). The pattern period is 81px and the stone layout also cycles at 81px: 11 stones per row, widths individually random but normalized to exactly 81px, jitter also reused per period. So the whole strip can be translated to any phase and tile seamlessly.
  - Each frame does one `c.transform(edge's local frame)` per edge, then clips and `drawImage(strip, BW−2·81+phase, 0)`; stones travel clockwise with the pattern. The corner squares stay static.
  - Phase changed to `15·lt + 81·easeInOut((lt−0.485)/0.365)`; constant drift dropped from 42 to 15px/s, saving the main motion for the original's one period at frames 226–248.
  - Static-segment motion (motion.py, 480×270 mean frame diff, frames 222–253): replica rose 1.98 → 4.62, original 2.90. At 42px/s drift it was 5.5.
  - Rule: when a slow pattern's displacement is smaller than the stone size, "color-swap only" gets eaten by quantization — either let the stones travel, or the displacement must far exceed the stone size.
- **Cup unreadable**: the cup was removed from the underpainting and rebuilt as a small-stone (4.4px) sprite `cupSprite`. Content is the kantharos scaled ×1.3: dark outline stones, gold body (darkened on the right), bright rim over dark interior, two handles, stem. Each frame it's overlaid whole on the mosaic at `armPose`'s position and tilt. Steam also became two columns of white square stones rising along a sine (`steamTiles`), with grout edges. Only the cup's white halo remains in the underpainting.
  - Rule: props narrower than 3 stones wide are unreadable in a fixed layout — make them a movable "inlay" (emblema-style panel).
- **Face features unreadable**: face stones 6px → 5px. Eyes white 13×7, dark 8×7, about 3 dark stones plus white; lips changed to red `#a8282a`, an 8.5×6 ellipse, about 2 stones; brows 6px dark brown. Scaled to half at 1080p, eyes and mouth read.
- After fix: warm max 20.9ms, p90 17.4ms, mean 13.9ms, determinism passes.
