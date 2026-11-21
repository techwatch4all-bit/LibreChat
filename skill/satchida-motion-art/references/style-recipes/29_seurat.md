# 29_seurat · 1884 Seurat "A Sunday Afternoon on the Island of La Grande Jatte" (pointillism: optical-mixing renderer)

> Source: migration test C (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/29_seurat.js`.

Filename during the experiment: `scenes/k3_seurat.js` (136 lines). ~100ms per frame, frame diff 7.4% (serene; adjacent-frame mean 0.45).

**Renderer (the key part, extractable into paint.js)**
1. Full-frame flat underpainting, characters included (~3ms per frame). Beneath, one pass of the underpainting with `blur(4px) saturate(.85) brightness(1.06)` serves as the priming color; the gaps between dots reveal it.
2. **Fixed hex grid, equal-size dots**: pitch 10, row spacing 8.66, r 4.5, each dot with ±1.2px static jitter. ~24k dots. Dots accumulated into 21 Path2Ds by color; each color filled only once.
3. **Optical-mixing color pick**: a 21-color pure palette.
   - 14 saturated colors: `#1a2058 #2a3a9a #3f6fd0 #6aaee6 #1f6a52 #2f9a5a #a8c83a #f2cf3a #f08a2a #e0432a #c0306a #7a4aa8 #f8f4e8 #e8b48a`
   - 7 pale colors (Seurat's "colors mixed with white"): `#f6e49a #f6c48a #cfe08a #b0cff0 #f2b8c8 #c99a4a #9a7ac8`
   - For each pair (i,j), **project** the target color onto the segment Pj→Pi, giving a continuous ratio w, clamped to [.2,.8]. Distance adds `0.004·|Pi−Pj|²`, penalizing far-apart pairs so black/white dots aren't mixed into gray. Take the closest pair; each dot uses Pi or Pj by `hash(i,j) < w`.
   - Results cached in a Map keyed by 15-bit quantized color.
4. **Add ±20 hash jitter to the target color before picking** (R+dj, G+0.8dj, B−0.6dj). The pairing switch boundaries therefore become interleaved dots, avoiding vertical color bands.
5. **Complementary dots**: 8% of dots swap to the contrast color (blue↔orange, green↔red-purple, yellow↔purple… 21 mappings total). **Irradiation**: compare with the point 14px to the lower right; when brightness differs >45, with 45% probability place a white dot on the bright side and a deep-blue dot on the dark side.
6. **Seurat's own painted border**: a 28px deep-blue band on all four sides, also run through the pointillist renderer, so orange complements appear inside it.

**Motif animation**:
- The Seine inside the window: sailboat drifting (40px/s), steamer smoking, the parasol lady's silhouette + small monkey.
- River dots re-roll hash at 6fps = glitter.
- One orange-red butterfly flies above the table indoors (`sin(2.6t)·120`), wings at `|sin(20t)|`.
- 6fps swapping 7% of dots to their paired colors expresses light trembling between dots. V1 used 4fps/3% — independent review judged "basically frozen" (adjacent-frame mean 0.1–0.2); raised to 6fps/7% reaching 0.45.

**Characters**: 1880s deep blue-purple long dress + bustle behind the waist (an arc piece in the `back` hook) + white high collar + orange buttons + small round hat with red feather. A folded red parasol leans on the chair back.
**Pitfalls** (both at the renderer level)
- Preferring single pure colors (with the penalty added) cuts gradient walls into several vertical color bands.
- With the ratio made continuous, paired colors still switch whole columns at boundaries, producing bands. It's solved by step 4's target-color jitter.
- V1's palette had no pale colors: the bright wall decomposed into white + skin + scattered blue dots, looking like snow noise.

---
