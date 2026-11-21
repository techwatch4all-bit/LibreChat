# 17_ink · Chinese ink freehand (Bada Shanren / Qi Baishi)

> Source: migration test A (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/17_ink.js`.

Filename during the experiment: `scenes/01_ink.js` (313 lines). Frame diff 0.45↔0.9s is 3.3% (threshold 24), adjacent-frame median 0.62%, no static frame pairs.

**Pipeline** (opposite of the 09 benchmark: paper is the base, ink only adds). Opening `lt += 0.12`, so frame 0 already has the first strokes down — not a blank sheet (review noted a blank first frame can't serve as a cover).
Xuan paper (cached) → wash layer: pale-ink distant mountains, vermilion sun → mist bands (paper-colored blurred ellipses drifting horizontally) → small birds skimming past → static strokes: window, desk, ground line, cached once written → bamboo branch (ge-character leaves) → Qi Baishi shrimp inside the hanging scroll → cat: ochre wash + scorched ink → girl: indigo wash + baimiao line drawing + garment folds → steam gossamer → seal stamp.

**Xuan paper**
`P.texture('#efe6d0', scale .0025, amt 9, grain 7)`. Overlaid with 2600 paper-fiber short arcs: half brown at α.05–.13, half bright at α.12–.27. Plus a radial vignette reaching α.22 at the edges.

**Brush `brush(c, pts, {w, tone, dry, reveal, bristles, head, tail})`**
- Point list densified with Catmull-Rom first, then resampled at 4px equal arc length (`KIT.resample`). Without resampling, flying-white noise frequency varies with stroke length.
- Brush pressure: `prof(q) = smoothstep(0,head,q) · (1−0.7·smoothstep(1−tail,1,q)) · (0.85+0.15·noise)`.
- Wet ink core: the whole stroke filled as a ribbon, width `w·prof·(1−0.85·dry·q^0.8)`, alpha tone×0.72. Thinner toward the end — ink running out.
- Bristles: each one a **continuous** polyline, lateral offset ±0.475w·prof. Broken when noise `noise(k·1.9, i·0.09)` falls below `dry·q^1.2·0.95+0.05`; the exposed paper is flying white (feibai).
- Pitfall: v1 drew each bristle as "each small segment separately stroked with round cap" — overlapping joints produced knotted dark points, like bamboo joints or hemp rope. Must switch to one continuous path per bristle with butt cap.
- Parameters: window frame w14–18, dry .45–.6; desk surface w22; garment folds w4–6, dry .3–.4, tone .78; ground line w5, dry .85, tone .35.

**Wash layer `washLayer`**
- Shapes painted to a scratch first, then merged onto the paper with multiply, in two passes.
- Outer halo: `blur(halo·(0.4+grow))`, alpha haloA·grow.
- Body: `blur(blur·(1.6−0.6grow))`.
- grow runs 0→1 with lt: the opening blooms from nothing, afterwards the outer halo keeps widening slowly — that is "ink blooming on paper".
- Girl halo 12, α.6; cat halo 9, α.78; distant mountains halo 14.

**Negative space (liubai)**
- The cat's white parts (muzzle, chest, paws) are carved out of the ochre layer with `destination-out`, exposing paper color. More ink-painting than painting white.
- The girl's cross-collar inner garment is carved out the same way.
- The face is filled with paper color, then outlined with 1.8px scorched-ink baimiao lines.

**Colors**
- Ink `[16,14,12]`, five tones via tone (scorched .9 / thick .8 / heavy .6 / pale .35 / clear .15).
- Ochre (cat) `#c47a3c`; indigo (garment) `#6f8aa0`, wide sleeves `#7d97ab`; gamboge (blond hair) `rgba(226,170,52,.75)` multiply.
- Carmine only at three points: belt, hairpin bead, lip dot, using `[190,40,40]`. Also vermilion sun `#d8553f`, seal stamp `#c4281e`.

**Motif animation**
- **Opening self-writing**: lt 0→0.45, each stroke `reveal = ss(d, d+l, lt/0.45)`, written in order window, desk, bamboo, cat, person.
- Bamboo: segmented pale-ink main branch, swaying around (835,70) `sin(2.9t)·0.11`, larger toward the tip. 5 groups of ge-character leaves, 3 leaves each (L110, w15), flipping `sin(7t+g)·0.2`.
- Mist bands: 4 paper-colored ellipses, blur 14, α.72, drifting 150–270px/s horizontally, distant mountains appearing and disappearing.
- Bada-style birds: skimming past from right of the window at 420px/s, wings in two strokes, flapping ~8 times per second (`sin(52·lt)`).
- Qi Baishi shrimp (two inside the hanging scroll, ×1.45): 6 pale-ink segments + one scorched-ink stroke at the head-thorax shell, two long two short antennae as traveling waves, three-segment long claws, body curving `sin(7t)·0.12`, swimming along a curve.
- Bada white eyes: the cat's pupil dot pushed to the top of the eye socket — "white eye to the sky".
- Seal stamp: lt 0.3–0.4 pressed from 1.5× down to 1×, composited multiply; white-character (baiwen) "白石" (Baishi).

**Pitfalls**
- Static strokes are drawn live during the writing phase, then cached once into `ink_static` — otherwise every frame paints thousands of bristles.
- V1 birds' path went through the bamboo clump and vanished; only at y≈470 above the mist band does it read.
- The wash is multiply and translucent, so the windowsill ink line shows through the cat's ears and table legs through the skirt — review read it as "wrong layer order". Fix: inside the cat's and garments' silhouettes first patch a layer of paper color (clip then drawImage the paper), then wash on top. This amounts to "reserving that spot" on the paper first.
