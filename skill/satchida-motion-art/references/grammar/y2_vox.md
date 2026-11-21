# Y2 · Vox-style collage explainer: video animation grammar card

One sentence: lay the argument on a desk of real material — clippings, photos, documents — and move the camera across it like an investigative journalist's eye; lines and pens draw in stepped strokes, and the evidentiary feel comes from "these things were genuinely placed here".

Demo film: `scripts/engine/demos/y2_vox/` (render with `render.py --film demos/y2_vox`) (8s, 3 shots, 2 transitions); overview: `assets/grammar/y2_vox-overview.jpg`
Basis: this style's research (the research notes and frame data stayed in the experiment archive and were not admitted to the skill; the numbers used are excerpted here). Sample of 5 films: Missing Chapter (2022), the psychedelic-poster film (2019), Vox Borders (2018), Johnny Harris (2026), plus a Vox 2026 live-action film as a control. 13 camera moves were fitted to easings, and colors sampled.

## Start-up checks

1. **Real material is the main picture.** Screenshots, source text, photos fill the frame or nearly so, pushed into the line being read; the desk is a world the camera travels through, not a backing color for small thumbnails. Measure it: more than 2 consecutive shots whose assets are under 60% of frame width is "picture-frame layout".
2. **Rotate "slide-in → typed label → red circle".** At storyboard time, list a reveal-action table: appears with the cut, push in, glide to the next card, highlighter sweep, red line connect, stamp, tear off... The same reveal sequence never runs more than 3 times. Evidence: one long film had 36 slide-ins among 37 labels; by the middle the audience could predict the next move.
3. **Text to be read sits on the top layer and draws last**, not following its object's stacking order. Photos, clips, and later cards covering text is this grammar's most recurring glitch.
4. **Camera landings are back-computed from what must be read at this moment** (frame the target then leave margins), never hand-typed coordinates; a neighbor card's half-visible label gets pushed out of frame.
5. **On an accumulating desk, after each new card, read all on-screen text in reading order.** Two cards' texts sitting close compose a wrong sentence ("exceeds" next to "acquired") — remove a card or complete the qualifier.
6. **A formal action of the same event is performed once.** An action performed in the wide schematic is not re-performed after pushing in, or it reads as "it happened again".

---

## ① Where it applies

**Use it:**
- Content with real archives, news, history, maps, people: "how did this happen", "who said what when".
- Journalistic voiceover: citations, evidence, causality. When the narration says "look at this line" or "note this number", the picture highlights exactly that.
- The moment the audience must "see the source with their own eyes": one quote, one set of numbers, one year.
- The demo film uses the real numbers of Google's 2012 "cat recognition" paper: 1,000 machines, 16,000 CPU cores, 10 million YouTube screenshots, no labels. Sources: arXiv:1112.6209 and Google's official blog.

**Avoid it:**
- Pure mechanism, pure concept, no real material to paste. Forcing it becomes "fake archives" — use Y1.
- Derivations and steps: use Y3.
- Content needing lots of character performance: paper-cut characters only move in steps.

## ② Picture construction

- **Three-color system** (Missing Chapter measured):
  - near-black base `#171716`
  - paper white `#E0DCDA`–`#EEEDED`
  - one red in two grades: bright red `#B65255` for lines, dark red `#93403C` for fills
  - highlighter yellow `#DACF08` (darker, more olive than the Vox logo's `#FFF200`. Logo yellow is rarely used at large area in the films)
  - old map paper `#E4DCCF`, parchment `#CFB195`
  - No pure white, no pure black.
- **【this film】**:
  - Desk `#e4ddcf`, tiled paper texture with fibers and low-frequency light/dark.
  - Clue red `#b8433f`, slightly brighter than measured, because it must be readable at 1080p.
  - Highlighter `rgba(218,207,8,.9)`, composited with multiply.
  - Shot 3 is one large black card stock `#1b1b1a` on the desk, desk showing on all four edges.
- **Materials**:
  - Photos are always grayscale halftone (45°), white-bordered, taped down with two translucent strips.
  - Clippings are torn-edged, yellowed, with serif titles.
  - Labels are Borders-style black-background white-text bold bars ("2012 · Google").
  - Index cards are ruled paper.
  - Paper texture is **static**. Measured dwell-segment frame diff 0.0–0.1 — no per-frame grain; that is Johnny Harris 2026's film-grain look, not Vox.
- **Shadows are very weak**. On black cards at 360p, shadows are nearly invisible【measured】. 【this film】uniform blur 10, offset (3,6), α 0.28.
- **Deliberately imperfect**: Vox's art director's words — "You don't want it to look perfect because that might make it look more like an ad than an editorial piece"【primary】.
- **Characters**: real people's photos cut out as stickers with white edges and shadows. 【this film】Huashu uses `HUASHU.draw`, offsetting the silhouette 12px in 16 directions over a paper-white underlay as the sticker edge.

## ③ Motion paths

- **Two frame rates (core)**【measured】:
  - The camera layer is smooth 24fps motion.
  - The element layer (map regions growing, red lines tracing, typing, hand-drawn circles, pop-ins) steps at 12fps "on twos". In the psychedelic-poster film, 52% of motion frames carry the move-stop-move fingerprint.
  - 【this film】The camera computes continuously at 60fps; all elements quantize with `MO.step(t, 12)` before computing progress. qa measured 16.9% still pairs on shot 1 — the on-twos freeze, not a stall.
- **Camera easings**【13 segments measured】:
  - Duration median 1.29s, range 0.71–1.96s, **none linear**.
  - 7 segments symmetric easeInOutSine (≈ AE's default Easy Ease) for long-distance "find the next card".
  - 6 segments fast-start, long-tail settle, close to `cubic-bezier(.33,0,.2,1)`, for "pull-out reveal" and "chasing along the clue".
- **【this film】camera**:
  - Shot 1: after the highlighter sweep, a 1.5s sineInOut push toward that line (1.14→1.28). BD's measurements show a sweep is often followed by one push.
  - Transition A: 1.1s long-tail bezier.
  - Transition B: 0.6s sineInOut push.
  - Shot 3: 0.85s long-tail bezier pull-out.
  - Those measured durations (push 0.6–1.5s, pull-out ≈1s, chase 1.3–1.8s) are new films' defaults. The demo's shot-1 opening 0.9s slow push (1.14→1.165, only 2%, bringing nothing in) and shot 3's post-pull-out 1%/s uniform drift are old practice — do not copy.
- **Entrances**【measured】:
  - Archive photos and clippings **appear with the cut**, no pop, no drop.
  - Only when tracing a timeline does the next card slide in from off-frame with a 5–15° tilt, flattening on arrival, ~0.8s.
  - 【this film】Small photos and the Huashu sticker use `slideIn`: 0.55s quartOut, flattening from a 12° tilt, 12fps stepping.
- **Lines and pens**【measured】:
  - Red underline completes in 0.5–1s.
  - Red ellipse ≈1s, one stroke, ends open and slightly crossed.
  - Highlighter bar 1.5–3s per line, sweeping with the spoken words.
  - Typing ≈13 chars/sec, on twos.
  - 【this film】Red circle 0.65s, highlighter 0.9s (demo-compressed), typing 13 chars/sec, red lines 0.5s each staggered 0.15s, the counter rolls to 10,000,000 over 1.4s cubicOut.
- **The camera holds while dwelling**: measured dwell frame diff 0.0–0.1 — when Vox's desk stops, it stops. While a card animates internally (tracing, highlighting, typing) the camera does not move; on a purely static image held long, push in where the voiceover reaches the readable part (find a card 0.5–0.9s, push in 1.0–1.5s, eased; punch 0.28s only for the reveal), or glide to the next card — never uniform slow drift.

## ④ Transitions (the common 6)

1. **Hard cut**: the overwhelming majority, cut points following narration punctuation【measured】.
2. **Pan along a red line (timeline tracing)**: the camera moves horizontally along one red line, 1.3–1.8s, long-tail easing; the next card slides in from the right, tilted, then flattens.
   - 【this film】Transition A: the red line runs from the clipping's highlighted line to the evidence wall's counter label; the camera chases over 1.1s with short motion blur along the velocity direction (7 stacked copies, factor 0.6).
3. **Push into paper or a photo → cut straight to a high-resolution scan of the same image**: 1.0–1.4s, S-curve easing.
   - 【this film】Transition B: push until the wall's small photo fills frame (log interpolation to z≈9.6); hard-cut to a large scan of the same image (halftone dots coarsening, read as "a clearer copy"); then 4.
4. **Pull out from one photo → reveal the whole collage**: ~1.0s, fast start, long tail (measured MC 2:30).
5. **Map regions growing, routes tracing**: 2.5–3.5s, on twos, the line head carrying a solid red dot.
6. **Real hand page-turns and paper pulls** (Missing Chapter's signature): in code, approximate as "paper sliding in along an arc with shadow changes".

**Note**: "torn-paper transitions" never appear once across the 5 sample films. It is a template-site habit, not Vox grammar. This film's first version used torn paper and removed it after the research.

## ⑤ Rhythm and text

- **Shot lengths**【measured, collage segments】:
  - Two lanes: slow (Missing Chapter) median 3.3s, ~12 cuts/min, one card held 3–7s, carried by in-card tracing and highlighting.
  - Fast (psychedelic posters 1.8s, Johnny Harris 1.4s) ~25–33 cuts/min, images barely moving, rhythm from cutting.
- **Aligning with the voiceover**:
  - Highlighter, typing, and tracing speeds lock to speech rate, not musical beats.
  - Johnny Harris: "Each word must correspond to a movement or action within the animation" — his scripts are written in two columns【primary】.
  - Joss Fong changes the music about every 20s【primary】.
- **Text**:
  - Names and places in small serif type, white, below photos.
  - Black-background timeline titles typed per character, 13 chars/sec, with a red line spanning the frame.
  - Quotes emerge in handwriting with an "ink blooming" feel, ~2s, then red bars follow the text line by line【measured】.
  - 【this film】Clippings and cards use a serif (Songti-class), big labels PuHui-Heavy, numbers Anton.

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/y2_vox/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- Reused from the skill:
  - `PAINT.cached`, `PAINT.scratch`: all paper, photos, clippings pre-rendered once as sprites
  - `PAINT.grain`: static grain
  - `PAINT.noise/fbm`
  - `KIT.densify/resample`: hand-drawn circles
  - `HUASHU.build/pose/draw`
  - engine's transition interface
- Newly written, now unified (`lib/collage.js` / `camera.js` / `diagram.js` / `motion.js`):
  - `MO.step(t,12)`: on twos.
  - `CL.paperTile`: tileable paper texture, sampled on a torus so it is seamless, with fibers.
  - `CL.halftone`: grayscale to 45° dots, batched into one path and filled once.
  - `CL.tornEdge`: torn edges.
  - `DG.hand / DG.drawPartial / DG.cum`: hand-drawn lines traced by length.
  - `CAM.motionBlur`: frames stacked along the velocity direction.
  - New films' real-material items: `MD.print` (a print: white border, aged paper, shadow, tape; crop by focus), `MD.label` (black torn-edge label, 12fps typing), `MD.cover` (full-frame + focus + push, for hard cuts into live footage); camera via `CAM.track`'s glide and push, punch only for accents. Parameterized clip y2 already uses this set: photos at 80–90% of frame, camera defaulting to a 0.7s glide to the next item and highlight slow push 0.9s (spec top-level `data` `"camera": "snap"` gives a 0.30s glide and 0.28s punch), never a uniform slow push.
  - `MO.bezier`: long-tail easing `(.33,0,.2,1)`.
- The demo film's own (`demos/y2_vox/vox.js`; `slideIn / highlight / stringPts` entered the library as `CL.slideIn / CL.highlight / CL.stringPts`):
  - `slideIn`: tilted slide-in that flattens.
  - `highlight`: rough-edged highlighter band, multiply.
  - `stringPts`: red thread with sag.
  - `deskCam`: desk camera keyframes with a final push.
- **Key architecture**:
  - Shots 1 and 2 are the same desk world and the same camera. Transition A uses `same` (A and B are literally the same painting); the pan is done entirely by the camera.
  - Shot 3 is the desk's large black card. Transition B uses `cut`, cutting at the full-coverage frame.
- **Performance**: shot 3 runs 73/89ms per frame (mean/peak); the Huashu sticker pads 16 offset underlays per frame. The sticker edge could be cached and recomputed only on 12fps pose swaps.

## ⑦ Representative works and primary references

- Samples:
  - Missing Chapter "The case to rename this famous Christmas plant" https://www.youtube.com/watch?v=lLSUjl4WatY
  - "Where the 1960s 'psychedelic' look came from" https://www.youtube.com/watch?v=9vuqI2v2IRs
  - Vox Borders "China is erasing its border with Hong Kong" https://www.youtube.com/watch?v=MQyxG4vTyZ8
  - Johnny Harris "The Internet Didn't Fail. It Was Taken." https://www.youtube.com/watch?v=0rKDo3hKbVk
- Primary:
  - Vox art director Joey Sendaydiego interview https://www.storybench.org/how-vox-uses-animation-to-make-complicated-topics-digestible-for-everyone/
  - Joss Fong interview https://www.theopennotebook.com/2020/01/07/videogram-how-a-vox-video-explains-the-science-behind-the-first-photo-of-a-black-hole/
  - Johnny Harris "How I Make My Maps" https://www.youtube.com/watch?v=GsojLuJpe_0
- Secondary: PremiumBeat "Replicating Vox motion graphic" https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/
- Demo film facts:
  - Le et al., ICML 2012, arXiv:1112.6209 https://arxiv.org/abs/1112.6209
  - Google official blog 2012-06-26 https://blog.google/innovation-and-ai/products/using-large-scale-brain-simulations-for/

## ⑧ The 3 easiest mistakes

1. **Everything silky at 60fps together**. Half of collage's handmade feel is the two-frame-rate "camera glides, elements step". All silky reads like a corporate promo; all 12fps makes the camera woozy.
2. **Template grammar posing as Vox**: torn paper, every image popping in and dropping, per-frame paper jitter. None of these appear in the measurements; Vox's photos exist with the cut, its paper texture is dead, and its transitions are mostly hard cuts and pushes. The flashier the entrances, the less it reads as an "editorial piece".
3. **Vox logo yellow as a large-area base, too many colors**. The film's yellow is a highlighter in the `#DACF08` grade, used only to underline points. The body is "black, paper white, one red", plus one accent — enough.

**Never eyeball a parameterized clip's `highlight.rect` against a preview image.** rect is 0..1 coordinates relative to that image; estimating from a shrunken screenshot is typically off 0.05–0.1 overall, landing the highlighter and red circle on the neighboring word. Measure pixels on the full-size image and divide by width/height; when the asset is a webpage screenshot, read the target text's bounding box straight from the DOM and convert to a share of the screenshot element (a community-contributed method, see issue #6):

```js
const box = document.querySelector('#abs').getBoundingClientRect();   // the element used for the screenshot
// find the text node containing the target text in the body, and its offset i
const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 'cat faces'.length);
const q = r.getBoundingClientRect();
[(q.x - box.x) / box.width, (q.y - box.y) / box.height, q.width / box.width, q.height / box.height];
// → fill into data.rect; after filling, use render.py --stills to take one frame after the highlight's at and check it
```

---

## Review and revisions (independent agent watched only the finished film, 8/10)

Review findings and this round's handling:
- "Shot 3 goes pure black; one big desk is broken": changed to one large black card stock laid on the same desk, desk texture showing on all four edges. Still Missing Chapter's black-card grammar, but the desk never breaks.
- "0–0.9s completely still": the demo film then added an opening slow push (1.14→1.165). The current practice: the first event lands within 0.3s (the photo exists with the cut; highlighter or red line starts immediately), or one 0.17s slam opens.
- "The halftone-blurred image filled the screen too long": the push shrank from 0.7s to 0.6s and the pull-out from 1.0s to 0.85s. The pull-out starts at z=3.68 so the photo's screen width matches across the hard cut, and the large image gained tape at the same position — the hard cut reads as "a clearer copy".
- "The blank paper strip appeared first": the strip now slides in tilted, typing moved up to 0.4s.
- "The protagonist cut in half-body from the right in one frame": the start moved to 1100px off-screen, so 12fps's first step is still off-screen.
- "The highlighter had not finished when the film ended": typing, red circle, and highlighter all moved earlier; the highlighter finishes at 1.8s, then holds 0.3s.
- "The word 'cat' in its head was too small": raised to 40px.
- "The camera is smooth throughout; on twos is not enough": unchanged. The research measured Vox as "camera smooth at 24fps, elements stepping at 12fps"; stepping the camera too would contradict the measurement.

## QA (skill `scripts/qa.py`, final post-revision)

| Shot | Measured window (in-shot s) | Motion area% mean/peak | Still pairs% | Jump frames | Per-frame ms mean/peak | Deterministic |
|---|---|---|---|---|---|---|
| y2_s1 | 0.35–2.58 | 11.02 / 16.71 | 3.1 | 0 | 17.4 / 20.3 | ✓ pixel-identical |
| y2_s2 | 1.1–3.28 | 16.09 / 76.76 | 3.1 | 16 (2.77–3.28s continuous) | 23.4 / 52.2 | ✓ pixel-identical |
| y2_s3 | 0.35–2.08 | 7.77 / 37.41 | 0.0 | 14 (0.39–0.83s continuous) | 73.3 / 88.5 | ✓ pixel-identical |

Transition smoke test (one render per transition, slowest frame): y2_s2 (same) 55.2ms; y2_s3 (hardcut) 43.8ms

Reading:
- **Shot 2's jumps** run 2.77–3.28s continuously — the 0.6s push into the wall's small photo, up to 9.6×.
- **Shot 3's jumps** run 0.39–0.83s continuously — the 0.85s pull-out reveal after the hard cut.
- Both are whole-screen zooms, designed camera motion. The hard cut itself lands on shot 3's frame 0, outside the measured window.
- **Still pairs 3.1%**: from the element layer's on-twos (12fps freezes). The first version's camera never moved at the opening and this number was 16.9%; after review flagged "0–0.9s completely still", the opening slow push brought it to 3.1%. A lower number here does not mean better: a uniform slow push can crush still pairs while still reading like flipping PPT; the correct fix for an still opening is making the first event happen earlier.
- **Shot 3's 73/89ms per frame** is the heaviest of the three films: the Huashu sticker pads 16 offset white edges per frame, plus black card texture. To speed up, recompute the sticker only on 12fps pose swaps and reuse otherwise.

Re-run: `uv run scripts/qa.py --project scripts/engine --film demos/y2_vox --out <dir>` (the table above is the experiment's numbers; for the post-admission re-run see doc 09's regression table).
