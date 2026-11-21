# 05_gothic · 1290 Gothic Illuminated Manuscript

11–22ms per frame (median 12ms). Static layer + gold-leaf mask built once in `init()`.

## Pipeline
1. Static layer `goth_static` (cached): parchment → gold leaf → diamond-grid embossing → gable, small pinnacles, side columns → pointed-arch window and stained glass → table, throne → Latin text column → marginal little knight.
2. Gold-leaf mask `goth_mask`: per-pixel "goldness" of the static layer `clamp((r-b-70)/50)·clamp((g-b-30)/40)·clamp((r-140)/40)`, result used as alpha. Parchment (236,223,194) has r−b only 42, so it's excluded; pink bands have high b, also excluded. **Do not redraw the gold shapes to build the mask** — anywhere gold will automatically catch the highlight sweep: background, initial letter, gold balls, gable finial.
3. Each frame draws in order: stained-glass flicker → diagonal highlight → four-pointed stars where the highlight passes → vine foliage → snail → running mouse → cat → girl → grain.

## Gold-leaf texture (the spec's "fine texture + highlight")
- Per-pixel shading: `f = 0.52 + fbm(x·.0035)·0.42 + horizontal polish noise(x·.004, y·.09)·0.5 + upper-left lighting + grain ±0.05`, interpolated between goldLo #9c6a1a / gold #d9a63a / goldHi #f8de86. The polish noise's y frequency is over 20× the x frequency, so it reads as horizontal metal brushing.
- Diamond grid: spacing 46px, two families of diagonals (x+y, x−y constant). Each line drawn twice: a dark pass and a bright pass offset 1.2px — reads as engraved into the gold. Each diamond center pressed with 4 points, bright upper-left, dark lower-right.
- Every 118×125px a very faint square seam, imitating gold leaf laid piece by piece.
- Diagonal highlight: draw a linear-gradient band on a 920px-wide scratch first, slope K=0.45 ("/" direction). Multiply the mask with `destination-in`, then composite back with `lighter` at α0.62. **Moved at constant speed** `x = lerp(150,1650,(lt-0.08)/1.15)`. Initially used inOut easing — at 0.9s the highlight had already swept out of the gold area and never crossed the girl; at constant speed it reaches the window at 0.3s and sweeps the girl at exactly 0.9s. The halo and 11 fixed points trigger via `|u − sweepX| < 70`, flashing four-pointed stars as the highlight passes.

## Motif animation (all visible in the 0.25–1.4s window)
- Vine: two stems of ~120 points each, each point adding `sin(t·2.1+i·.09)·2.5` sway. Every 3–5 points hangs a three-lobed ivy leaf (blue/red/gold rotation) or a gold ball with 3 whiskers. Leaves swing around their hang point at `sin(t·3.1+k·1.7)·0.28`. Leaf scale was 0.85 in v1 — too small and sparse; changed to 1.05–1.45 before the density matched the original.
- Stained glass: 26 random points, lighting a white radial glow when `sin(t·5+h·40) > 0.6`.
- The cat lifts one forepaw holding a mouse tail; the mouse swings like a pendulum `0.32·sin(t·5.5)`, legs kicking wildly. The snail crawls left at 62px/s with swaying antennae; the mouse under the text column runs 360px within 0.12–1.17s, legs swinging 40 rad/s.
- The girl raises the gold cup per the shared choreography, a four-pointed star twinkling on the rim, steam in fine ink lines.

## Characters
- The girl draws `RIG.girl`'s Path2Ds directly in her own order, **not calling `RIG.drawGirl`**, for two reasons: drawGirl always draws a mug with a handle; and the cloak and halo must be inserted between certain layers. Draw order: halo (centered on headC offset (16,−22), r=114, red ring with 36 stamped dots) → wavy long blond hair → red gown (gold fine vertical stripes every 20px, gold hem trim) → blue cloak (anchored on nape/back, gold-edged) → head → gold chalice.
- The cat becomes the manuscript's "human-faced cat": the face is a cream ellipse, almond pupils squeezed right, glancing sideways at the girl, upper lids thickened, brows raised, mouth corners turned down, blushing cheeks. Only `legs[0]` is used; the other foreleg is drawn by hand with `RIG.limb` in the raised pose.
- Latin body text in UnifrakturMaguntia 44px. 50px pushes "cum poculo suo" off the right edge. Sentence-initial Cattus/Nemo/Mus in vermilion — the medieval rubrication practice.

## Pitfalls
- The scratchpad is shared with other eras' authors; `check.py` got overwritten once by someone else. Keep self-check scripts in your own subdirectory.
- If the motion-diff baseline is lt=0, it's polluted by the engine's first-20-frame camera punch (1.03 zoom). Baseline must be lt≥0.35.

## v2 tweaks
Vine sway ×2, leaf swing 0.42; stained-window flash points 40; gold highlight α0.85, highlight band widened. Static-segment frame diff 1.10 → 1.32 (original 1.64).
