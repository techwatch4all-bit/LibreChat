# 08_impressionism · 1874 Impressionism (Monet)

65–76ms per frame (median 69ms). The main cost is two full-screen P.strokes passes plus one character-stroke pass.

## Pipeline (following the 09_postimp benchmark)
1. Flat underpainting `impBase`, repainted every frame because poppies, clouds, bouquet, potted plant, and curtain all move:
   - Lilac-pink wall (#d8bede→#f0c8cc→#f2c4d4), a warm-yellow sunlight radial gradient r=900 overlaid upper-right.
   - Garden outside the window: sky, woods, red-roofed house, meadow, 70 poppies (stems anchored, heads swaying horizontally `sin(t·3.2+ph+x·.02)·(6+r·.6)`), a woman with parasol plus child (homage to "Poppy Field"), flower clusters.
   - White window frame, pale-lilac curtains, "Impression, Sunrise" on the wall, round table with white-lilac cloth, vase, teapot, potted plant on the right (whole leaf mass swaying with `sin(t·1.9)·8`).
2. Stroke repainting, **two passes**:
   - Main frame: cell 11, len 20, width 7, outline 0, jitterCol 26, with a mask excluding the window view and the small wall painting.
   - Window view and "Sunrise": cell 6, len 11, width 4.5, only inside the mask.
   - V1 had one coarse pass only — the house and parasol woman outside got smeared away and "Sunrise" became a diagonal smear. Only after splitting into two passes and turning "Sunrise" into horizontal water-wave strokes did everything read.
   - Canvas primed with #f2e6ee first; pale ground shows in the gaps between strokes.
3. Direction field: wall slanting to upper-right (sunlit zone −0.95 rad, rest −0.55, plus ±0.55 noise); ground nearly horizontal; curtain and tablecloth vertical; potted plant radiating outward from the pot rim; sky inside the window horizontal.
4. Region palettes `P.swatch` (mixBase 0.3–0.45): wall 9 lilac-pink-yellow colors; sunlit wall 7 cream-yellow; ground 7 rose-orange-violet; separate sets for sky, grass green, curtain lilac, tablecloth blue-violet. The white window frame is detected with `col > (240,236,225)` and mixed back to white, otherwise it gets stroked over in wall color and the frame vanishes. Poppy red returns null, keeping the underpainting's own color.
5. Characters: first flat-filled with `RIG.drawCat` / `RIG.drawGirl` fill mode, then a `source-atop` P.strokes pass (cell 7, len 13) on the character layer, strokes only inside the character. The white dress samples from white, pale lilac, cream yellow. Afterward only features are added, in pale-lilac fine lines — Impressionism doesn't outline.
   - Straw hat, blue ribbon, and belt streamers all flutter.
   - `pal.line` must be set to hair-gold: drawGirl's locks and lid strokes use pal.line even at lw=0, so the default dark blue leaves black bands beside the face. Same for the cat — set `line`/`whisker`.

## Motif animation
- **Sunlight patches flickering and dancing**: 26 patches (6 on the tabletop, 20 on the ground). Each patch's intensity is `0.5+0.5·sin(t·sp+ph)·sin(t·sp·0.53+2ph)`, clamped, so the on/off rhythm is irregular. Patches drift slowly ±10px horizontally. Each patch is 40 bright yellow-white short strokes, boiling at 8fps with a reseed. V1 used screen overlay at α0.75 — nearly invisible on the pink ground; source-over at α0.95 finally reads bright.
- 60 slanted bright strokes in the wall's sunlit zone, flickering at 6fps with reseed.
- Cat fur sparkle: 60 candidate points, restricted with `isPointInPath` to the left half of body and head (the lit side), blinking at `sin(t·7+h·30)`.
- Whole painting boils at 8fps, steam white.

## Performance
Two full-screen stroke passes plus one character pass, ~69ms. During transitions the engine paints both eras at once: 08→09 totals ~69+110ms, exceeding 150ms, but only for the dozen-odd transition frames.

## v2 fixes (review: whole screen's strokes reshuffle every 7–8 frames, frame diff 18)
- Stroke positions fully fixed: `boil: 0`. **Fixed seeds aren't enough**: P.strokes' random numbers form a sequential stream; when a palette returns null, jitter consumes 3 extra numbers; and whether it returns null depends on the underpainting color — poppies sway, the pot plant swings, and every cell downstream reshuffles. Wrapped with `stable(palette)`: each cell consumes 1 number and never returns null.
- Character strokes dropped alphaMask (a skipped cell from cup movement reshuffles the whole layer) for a hand-written loop: per-cell randoms from `U.hash(i,j)`. Incidentally dropped 115ms per frame back to 72ms.
- "Life" now carried by local motion: light patches drifting ±44px, flicker frequencies 5–11; poppy sway up to 10+; clouds moving horizontally 45px/s; curtain and potted plant swaying; window flowers' strokes rotating ±0.22rad with the wind; cat tail-flick (×2.2), head turn (look).
- Static-segment frame diff (480×270, counter masked, transition frames at segment end removed): v1 mean 4.14, peak 20.5 — strobing; v2 mean 0.57, peak 1.9. Original 0.77.
