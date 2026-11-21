# 30_matisse · 1947 Matisse "Jazz" cut-outs

> Source: migration test C (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/30_matisse.js`.

Filename during the experiment: `scenes/k4_matisse.js` (167 lines). ~25ms per frame, frame diff 9.3%.

**Composition**: the wall = "Polynesie" double blue checkerboard (`#1d4fb8 / #4f95dc`, each cell a 240×236 cut-paper block); the window = "Icarus" (cobalt ground, black figure, red heart, yellow stars); the floor = emerald `#1f9a5a` with a black baseboard strip; the tabletop is black cut-paper, the chair yellow cut-paper.

**Technique**
1. **Scissor polyline `cut(pts)`**: take a point every 14–24px along the contour, add ±2–2.5px seeded jitter, connect points with straight lines. All self-generated shapes are handled this way.
2. **Seaweed (the key)**: one tapered stem + 2×lobes **round-capped capsule fingers** alternating left/right. Finger angle `±(1.05−0.55u)`, length `width·(1−0.45u)`, width `width·(0.34−0.12u)`. All subpaths `addPath` into one Path2D, filled once with nonzero — union, and the shadow projects only once. **Do not use "width modulated along the spine"**: v1 did that and produced caterpillars and Z-shaped lightning.
3. **RIG characters get hand-cut edges**: the RIG gives no point lists, so the whole character layer gets pixel displacement. The static displacement field is `fbm(0.028x, 0.028y, 2)·9`, separate dx and dy sets, processing only bbox (330,470)-(1600,980), ~15ms.
4. **Paper shadows**: shadow offset (5,6), blur 4, `rgba(10,20,40,.3)` — paper pinned to the wall.
5. **Gouache brush marks**: 2600 long strip strokes cached (60–300px, width 6–22, half black half white, α .04–.13, tilt −0.25rad), `overlay` over the whole frame.

**Motif animation**:
- Seaweed sways around its root like paper, `sin(2.8t+φ)·0.13`; curled edges breathe with `scaleX 0.93–1.0`.
- Icarus: 7 irregular yellow stars, rotating and twinkling (scale `.82+.22sin(7t+1.9k)`); the black figure drifting up/down; the red heart beating (`1+.18·max(0,sin 9t)`).
- Two white birds flapping (scaleY `.55+.45cos 13t`).
- One pink paper sheet tumbling down (scaleX=cos 6t).
- Steam is two small white cut-outs.

**Characters**: Matisse's "Romanian Blouse". White wide-sleeve blouse with one cobalt embroidered band down the front (small red/yellow alternating triangles), red/blue embroidered bands across the sleeves rotating with the arms (clipped inside upperArm), red long skirt + black belt, blond hair as 5 cut-paper curls. Features only as cut-paper fragments: black almond eyes, red lip triangle, pink cheek discs.
**Pitfall**: v1's falling paper crossed the girl's face; moved to the left wall. A white cut-paper sheet backs the counter, otherwise black text on cobalt is unreadable.

---
