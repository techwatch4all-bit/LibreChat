# Era Author Spec (pure-code drawing)

> This is the author spec for the art-history speedrun replica film: the composition coordinates and
> character rules below apply only to that film and similar speedrun/traversal films. For the general
> version see `references/08-style-author-spec.md`; a new subject needs its own recomposition.

Each era you own = one file `scenes/<id>.js`, registering:

```js
SCENES['<id>'] = { draw(c, lt, t) { /* fill 1920x1080 */ } };
```

- `c`: the target 2D context; `lt`: this segment's local time (seconds, counted from the era's
  transition start, may slightly exceed the segment length); `t`: global film time.
- **Do not draw the year plate** (the engine draws it at top-right 1500-1890 x 40-210); leave this area as
  background and keep important elements out of it.
- **Do not modify `lib/`, `engine.js`, `eras.js`, `transitions.js`, or other people's scene files**. Put
  any helper functions you need in your own file.

## Available libraries (read the source first)
- `lib/paint.js` -> `PAINT`: noise noise/fbm, textures texture/grain/craquelure, hand-drawn lines
  roughPath/boilSeed,
  style renderers strokes (flow-field strokes, supports a palette region swatch) /dabs/mosaic/halftone/
  pixelate/facets, the `swatch` color set, the shared `choreo`, steam, particles, and `scratch(key)`
  offscreen canvases.
- `lib/rig.js` -> `RIG`: `RIG.girl(opt)` the girl skeleton (sitting facing left; returns each part's
  Path2D plus the anchors `G.A`), `RIG.drawGirl(c,G,pal)` (pal.mode: fill/line),
  `RIG.cat(opt)` the orange-and-white cat skeleton (sitting facing right), `RIG.drawCat(c,K,pal)`,
  `RIG.drawCup`, `RIG.smooth(points)` smoothed curves, `RIG.taper` tapered limbs, `RIG.ik2`.
- **Benchmark implementation: `scenes/09_postimp.js` (Van Gogh)** -- study its structure: flat underpainting
  -> style-renderer repaint (region swatch) -> character flat fill + fine strokes -> line work on top ->
  moving highlights.

## Hard requirements
1. **One scene skeleton**: the standard composition -- window (350,120)-(810,560), cat sitting
   (390,610)-(690,905), desk (810,620)-(1200,905), person (1120,200)-(1500,910). Every era of the source
   film aligns to these positions, and the transitions depend on them.
2. **Characters**: the person is a 17-year-old European blond girl wearing **the era's girl's clothing**
   (modest); the cat is the **orange-and-white cat** (orange tabby on head/back/tail, white muzzle/chest/
   belly/paws).
   They must be based on the `RIG.girl` / `RIG.cat` skeleton and choreography (the same skeleton, the same
   actions), but drawn in the era's technique: take the Path2Ds and fill/stroke/silhouette them yourself,
   add garments at the anchors, or era-deform the skeleton points (e.g. Egypt's frontal eye, black-figure
   silhouette).
3. **The picture must be alive**: the protagonist's actions come from `PAINT.choreo(lt,t)` (cup, tail,
   blink, breathe),
   plus 2-4 **small loops drawn from the era's visual motifs** -- the checklist lives in
   `../breakdown/shot-list.md` under each era's "in-shot actions" (examples: cave-paint animals running on two
   alternating poses, a scarab rolling the sun, a Greek key band scrolling, Vesuvius smoking, a gold-leaf
   highlight sweeping, an ornithopter flying past, cherry petals falling, light dabs twinkling...).
   Each era stays on screen only 0.25-1.4 s; the action must be **legible** inside that window.
4. **The style is made by code**: renderers/textures/lines turn it into that era's artwork, not clip art.
   Lines may "boil" at 8-12fps (boilSeed) for a hand-drawn feel.
5. **Performance**: <= 150ms per frame (1920x1080). Cache static parts with `PAINT.cached`. All randomness
   is seeded; the same t must draw the same frame.

## References
- The reference film's frames for that era: `../gen-art/ref/<id>.png` (composition, motifs, colors --
  everything but the counter; you extract frames from the reference film yourself; not distributed with the
  skill)
- AI character sheets (same composition, swapped to the blond girl + orange-white cat):
  `../gen-art/plates/<id>.png` -- use as art-direction reference only; **never paste the images into the
  frame**, everything is drawn by code.
- In-shot actions, transition origins: `../breakdown/shot-list.md`
- The reference film at 60fps: `../source-film/<reference>.mp4` (bring your own)

## Self-check (at least 3 rounds per era)
```sh
cd <your project dir>   # contains engine-project/ (copied from scripts/engine)
uv run --with playwright python engine-project/render.py --solo <id> --stills 0,0.3,0.6,0.9 --out renders/<id>
uv run --with playwright python engine-project/render.py --solo <id> --from 0 --to 1.2 --out renders/<id>/clip.mp4
```
Tile your frames side by side with the reference film's frames and the character sheets (PIL) and ask:
(1) can you tell the era/artist at a glance? (2) does the girl read as a 17-year-old blond girl and the cat
as an orange-white cat? (3) can you see the drawing move within 1 second? (4) any glitches (misalignment,
broken lines, wrong occlusion, blanks)?
Fix whichever fails and repeat until satisfied.

## Delivery
- `scenes/<id>.js`
- `notes/<id>.md`: which techniques you used (renderer parameters, palette, how the motif animation works,
  the traps you hit) -- **this is the experience that settles into the skill**; be concrete, write numbers.
