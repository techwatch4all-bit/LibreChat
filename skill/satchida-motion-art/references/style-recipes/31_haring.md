# 31_haring · 1982 Keith Haring

> Source: migration test C (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/31_haring.js`.

Filename during the experiment: `scenes/k5_haring.js` (109 lines). ~4ms per frame, frame diff 11.5%.

**Technique**
- Pure-color ground: yellow wall `#ffd51c`, green floor `#16a54a`, 14px black horizon.
- Everything is 13px round-capped black lines + flat fills, using `X.girl / X.cat` part-by-part "fill → stroke".
- **Dancing figures**: capsules from a modified `X.limb` make 7 limb segments + round heads, **all stroked 2×LW black first, then all filled together** — union outline. 4 poses (local keypoints, origin at the feet) cut hard at **8fps, no interpolation** — that's Haring's dance; action arcs added beside hands.
- **Radiating action lines**: n short straight lines on an ellipse around an object (length 22–34, width 7–9), re-angled at 8fps. Used on the cat, girl's head, cup, teapot, red heart, and the right-side figure.
- **Everything follows the beat**: `bounce=|sin(t·128/60·π)|^0.6`. Girl dy=−12·bb, cat half a beat off. The table squashes/stretches around its foot (sy 1−0.07(1−bb), sx 1+0.05(1−bb)), legs bending; the teapot jumps 26px; the window frame rocks ±0.025rad; the floor's "bounce" horizontal lines change length with the beat.

**Motif animation**:
- The radiant baby in the window: white union silhouette, crawling in a two-frame alternation; 14 rays alternating long/short at 8fps.
- 3 dancing figures on the wall (red/blue/pink, different phases, one mirrored).
- The red heart above the table, beating with radiating lines.

**Characters**: a 1980s New York girl. Big red oversized sweater (one ribbed line at the hem), denim-blue long skirt, white high-top sneakers. The face keeps only one eye dot and one red lip (Haring's figures have no features; this bit stays for recognition). The thick black ear circles read as Walkman headphones — right for the era.
**Pitfall**: `RIG.limb`'s reversed end caps leave holes at joints under heavy strokes (see ②-1). The window's crossbar must paint under the baby. The RIG's hairLines are fine lines — violating Haring's "uniform-width lines" — and cross the face when the head tilts back to drink, so they were removed.

---
