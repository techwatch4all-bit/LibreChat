# Y3 · Whiteboard hand-drawn explainer (RSA Animate type): video animation grammar card

One sentence: the speaker says a line, the hand writes that line and draws one figure on a big whiteboard; the camera follows the argument across the board and finally pulls out, so the audience sees the whole argument as one picture.

Demo film: `scripts/engine/demos/y3_whiteboard/` (render with `render.py --film demos/y3_whiteboard`) (8s, 3 shots, 2 transition types + closing pull-out); overview: `assets/grammar/y3_whiteboard-overview.jpg`
Basis: this style's research (the research notes and frame data stayed in the experiment archive and were not admitted to the skill; the numbers used are excerpted here). Measured RSA Animate's "Changing Education Paradigms" and Minute Physics' "Why is it Dark at Night?", plus VideoScribe's and Doodly's official docs and primary statements from Andrew Park and Henry Reich.

**Pick one type first; never mix**:
- RSA type: one big whiteboard, camera moving on the board, 5.3 moves per minute.
- Minute Physics type: one sheet per page, hard-cut sheet changes, 8.1 per minute, camera still.
- This card and the demo use the RSA type. Minute Physics type's key points are in ④ and ⑧.

## Start-up checks

1. **"Draw little, write much" is a storyboard-layer problem — fix the visual metaphor before the pen touches down.** For each board block, first write down the object or joke to draw, then decide the text; handwritten whole sentences never exceed one line. Count it: when over half the on-board text overlaps the voiceover's words at the same moment, it is "draw little, write much" — no amount of later puns or icons can rescue it.
2. **Rotate the block templates.** Blocks of the same structure — "year → object → orange label" or "dot → line of text → one icon" — never run more than 3 times in a film; switch to comparison (two panels side by side), flow (arrows chaining), enlarged detail, or one full picture.
3. **Framing is never hand-typed camera coordinates.** Back-compute from the current strokes' bounding box (frame then leave margins), and push half-cropped old text out of frame at the frame's edges.
4. **Line semantics are fixed from the first stroke.** Solid = happened, dashed = planned, dotted = cross-segment leader; things on the board can only be erased or kept — they never fade out.
5. **Every object's shape passes a "could this read as indecent" check.** Round-tipped, outward-flaring, round-bottomed vertical objects are the usual offenders — change to pointed tips and flat bases before drawing.

---

## ① Where it applies

**Use it:**
- Argument-driven content: talks, opinions, causal chains, historical threads. Content whose concepts relate and can be drawn as one map fits best. Andrew Park's words: "put information into space so people can see how things relate"【primary】.
- A short science piece on one reasoning chain, using the Minute Physics type.
- Steady speech with clear keywords. RSA's writing speed roughly equals speech rate, like "subtitles being handwritten"【measured】.

**Avoid it:**
- Content needing precise data charts — hand-drawn error is large.
- Content with complex action and spatial relations — the whiteboard has no depth.
- Content needing emotional intensity — single-color linework expresses weakly.
- Hoping it "improves understanding": Türkay 2016's experiment found no learning advantage over other forms. Its value is attention and companionship【secondary】.

## ② Picture construction

- **Colors** (RSA measured):
  - base: pure white `#FBFBFB`
  - line: black `#0A0503`
  - the only accent: orange, text `#EB701F`, fill `#F3742D`; hatched light-orange areas ≈ `#E9A67C`
  - orange is about 22% of all stroke pixels, used only on keywords and hatched fills.
  - Minute Physics, by contrast, uses pinkish off-white paper `#E7DBE1` with colored-pencil light yellow `#EDE6A2` and light blue `#B5CBE8`.
- **【this film】**: base `#FBFBFB`, line `#0A0503`, accent `#EF7226`. The cat's body gets one layer of 22%-alpha orange.
- **Line width**: RSA strokes are about 0.6–0.7% of frame height — 6–7px at 1080p; hatching about 0.3%; title glyph height about 5.5% of frame height. Minute Physics's lines are thicker, ~0.8%【measured】. 【this film】line width 6.5px.
- **Composition**:
  - RSA "plans the final full picture first, then paints it backwards"【primary】.
  - Each block holds 3–6 text-and-image groups, painted full before moving on.
  - A smooth move shifts only 0.23 frame widths at a time, so old and new blocks overlap heavily and the audience always sees the previous block's edge【measured】.
  - The ending's revealed full map is a very long horizontal scroll.
- **Text**: RSA uses all-caps hand-printed lettering (comic-dialogue style). 【this film】Chinese uses LXGW WenKai, subset to woff.
- **The hand**:
  - A real right hand holding a black marker enters from the **lower right**, forearm slanting down-right, occluding 15–25% of frame.
  - When not drawing, the whole hand leaves. On-screen hand time: RSA 49%, Minute Physics 40%【measured】.
  - 【this film】code-drawn hand: bare forearm with a dark side and arm hair, index finger pressing a black marker, scale 0.82, swaying gently at 7 rad/s.

## ③ Motion paths

- **Writing speed**【measured, 9 samples】:
  - Body text median ~16 chars/sec.
  - Opening titles are half as slow, ~7.5 chars/sec, to "set the thesis".
  - Speech is ~13 chars/sec, so writing speed roughly equals speech rate.
  - 【this film】body 16 chars/sec; "cat?" written at the title's 7.5 chars/sec.
- **Drawing speed**【measured + distilled】:
  - Small icons 0.5–1s, character heads ~2s.
  - RSA's median newly-inked area is 0.25% of frame per second.
  - Complex illustrations are never drawn live: either pre-painted and revealed as the camera moves over, or hard-cut in whole with the hand only coloring.
- **【this film】**:
  - Line speed 2600 world pixels/sec, about 2× RSA's live measurement. An 8-second demo must compress; real films slow down.
  - Stroke durations compute from length ÷ speed, each stroke at least 0.04s, pen lifts 0.02s apart.
  - Each stroke eases internally with sineInOut, slow at start and end.
  - Huashu reveals over 0.7s with "Reveal": the pen tip walks an 8-row zigzag through his joint bounding boxes; `DG.revealMask` turns walked areas into a clip, and the linework shows only inside it.
  - The first version traced all parts simultaneously with `setLineDash` while the pen walked the joints; review judged "the pen does not lead the line" — hence the change.
  - Chinese has no stroke-order data, so each glyph reveals via a 3-row zigzag, the pen tip running back and forth — it looks like writing.
- **Speed multiplier**: Henry Reich photographs once per second and holds each photo 2 frames while drawing — ≈12× speed. RSA infers 5–8×【primary + inference】.
- **"Handless" pops**: some of RSA's orange keywords pop in whole, post-production, with no hand drawing them (ANAESTHETIC, CREATIVITY)【measured】. 【this film】"×10 million" and "It's a cat!" pop with 0.3s backOut(2.2), no hand visiting.
- **Pen-tip path**:
  - When strokes are <0.25s apart, the pen tip arcs from the previous stroke's end to the next start (sineInOut, lifted 30px).
  - Longer gaps lift the hand out of frame: 0.35s cubicIn retreating off the lower right.
  - 0.3s before the next stroke begins, it enters from the lower right with cubicOut.
- **Continuous motion**: the whiteboard film's "life" is the hand always drawing. RSA's line-drawing activity barely correlates with spoken-word density (|r|<0.07): when speech pauses, the hand does not stop【measured】.

## ④ Transitions (the common 5)

1. **On-board smooth move or push/pull** (RSA's workhorse, 41 times).
   - 1.2–2.4s, **easeInOutSine**: measured peak/mean speed ratio 1.49; theoretical sine is 1.57.
   - One pan moves ~0.23 frame widths, overlapping the previous block ~75%.
   - 【this film】Transition B: 0.9s sineInOut (4.7→5.6s), diagonal move ~0.5 frame widths while pushing to 1.12×. As the move starts, the hand is drawing an orange connector leading to the new area — the hand leads the camera.
2. **Whip**: fast pan with motion blur, ~0.8s, moving 0.5–1.2 frame widths, for jumping to a far region of the board (RSA 15 times).
   - 【this film】Transition A: 0.8s cubicInOut horizontal move of nearly one screen. Only in these 0.8s are 9 copies stacked along the velocity direction for blur; smooth moves and pull-outs stay sharp.
3. **Pull-out reveal of the whole map** (ending).
   - RSA's outro: gray fills → 0.6s fast pull-out → ~9s pan across the long scroll → pull out further to the whole map.
   - VideoScribe's default has "Zoom at end?" checked【primary】.
   - 【this film】6.85→7.5s sineInOut pulls to 0.45×, holds 0.5s, while the whole board gains a very light gray `#EEEEEC` wash over 0.5s.
4. **Cloud or explosion wipe**: cartoon smoke fills then disperses, ~1s (RSA once).
5. **Hard cut**: hard-cut to a pre-painted figure (RSA, occasionally); Minute Physics type's sheet-change hard cut (its workhorse, 8.1/min); Minute Physics inverts the whole frame for "night".

**Note**: "pushing into a frame or thought bubble" and "page turns" never appear in the sample films. This film's first version built a "push into the thought bubble"; after the research it became a whip plus smooth move.

## ⑤ Rhythm and text

- **Per-block dwell**: RSA median 6.6s between camera moves (IQR 4.0–13.8s); Minute Physics median 7.1s per shot【measured】. The demo fits 3 blocks in 8s, ~2.5× real-film density.
- **Aligning with the voiceover (core)**【measured】:
  - Writing starts 0.2–0.8s after the matching phrase begins, median +0.5s.
  - Writing finishes within 1s of the phrase ending: writing while speaking, slightly behind, **never ahead**.
  - The exception is visual setup (pill bottles, arrows), drawn a few seconds early to wait for the line.
  - Minute Physics drops the image the moment the noun is spoken, median +0.3s.
- **Transitions follow topics, not pauses**: a new board block maps to a new argument【measured + distilled】.
- **Music**: RSA has **no music** under the speech. Minute Physics scores throughout, ~9dB under the voice【measured】.
- **Tool defaults**:
  - VideoScribe's default post-draw dwell is 0.5s【primary】, camera moves default 1s【secondary】.
  - Doodly draws each asset over 3s by default【primary】.

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/y3_whiteboard/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- Reused from the skill:
  - `KIT.densify / KIT.resample`: Catmull-Rom densification then equal arc-length resampling; `DG.hand` adds low-frequency noise on top
  - `PAINT.noise`, `PAINT.cached`
  - `HUASHU.build/pose/details`: Huashu linework
  - engine's transition interface
- Newly written, now unified (`lib/diagram.js` / `camera.js`):
  - `DG.cum / DG.pointAt / DG.drawPartial`: polylines traced by length, returning the pen-tip position.
  - `CAM.at`: keyframe camera.
  - `CAM.motionBlur`: motion blur.
  - `DG.revealMask / DG.zigzag`: zigzag reveal masks (added after review).
- The demo film's own (`demos/y3_whiteboard/whiteboard.js`; stroke timeline, inter-stroke glide, marker entered the library as `DG.board` / `B.penAt` / `DG.pen`):
  - **Stroke timeline**: `addLine / addText / addPop / addFill` queue in order; durations compute automatically from length and speed; delivery prints `Y3.timeline` to check each block's end time. The first version scheduled block 2 to 7.9s — 2.5s after the camera move — found only via this number.
  - `drawStroke`: five kinds — line, text, pop, fill, character. Text and characters both reveal through zigzag masks, the pen tip taken directly from the mask's leading edge.
  - `penAt`: pen tip and hand paths, including inter-stroke glide, hand exits, and entries.
  - `drawHand`: the hand and marker.
  - Eraser smudge texture lives in screen space, following camera pan only, not zoom — otherwise a 5× push turns it into big gray blotches.
- **Key architecture**: all three shots paint the same board with the same camera; every transition is `same`. The "transition" is itself camera motion, so nothing on the board can ever jump mid-transition.

## ⑦ Representative works and primary references

- Samples:
  - RSA ANIMATE: Changing Education Paradigms https://www.youtube.com/watch?v=zDZFcDGpL4U
  - MinutePhysics: Why is it Dark at Night? https://www.youtube.com/watch?v=gxJ4M7tyLRE
- Andrew Park interview (Sketchnote Army 2025) https://sketchnotearmy.com/blog/2025/11/18/andrew-park
- Cognitive Media "hairy hand" https://www.hairyhand.co/about
- VideoScribe official docs:
  - Camera and Zoom at end https://help.videoscribe.co/knowledge/use-zoom-and-set-the-camera
  - Draw entrance https://help.videoscribe.co/knowledge/draw
  - Entrance animations https://help.videoscribe.co/knowledge/entrance-animations
- Doodly defaults https://support.voomly.com/en/articles/12735753-doodly-how-do-i-customize-video-settings
- Learning-effect research (secondary citation) https://en.wikipedia.org/wiki/Whiteboard_animation

## ⑧ The 3 easiest mistakes

1. **Filling a block before speaking, or speaking before drawing**. The whiteboard's magic is "say a line, write a line": writing speed equals speech rate, ~0.5s behind the voiceover. Draw-first makes the audience wait; speak-first makes the drawing a redundant retelling. Complex illustrations are never drawn live — pre-paint them and reveal as the camera moves over.
2. **Cutting whole-screen to the next blank block every time**. RSA's smooth move shifts only 0.23 frame widths, old and new regions overlapping heavily, so the audience always knows where they are on one big picture. Only far jumps get the 0.8s whip with blur. The ending must pull out to the whole map — it is this genre's landing.
3. **Too many colors, lines too thin or too uniform, the hand hanging in frame forever**. Black plus one accent only; line width ~0.65% of frame height. The hand enters only while drawing and exits lower-right when done; accent words may pop without the hand. Also never mix RSA and Minute Physics: either one big whiteboard with camera moves, or one sheet per page with hard cuts.

---

## Review and revisions (independent agent watched only the finished film, 6/10 — lowest of the three)

Review findings and this round's handling:
- "The pen tip does not lead the line; several of Huashu's strokes appear at once; text is mask-erased":
  - Huashu switched to VideoScribe's Reveal method: the complete linework hides beneath; the pen tip walks an 8-row zigzag, revealing where it passes, always on the leading edge.
  - Text became per-glyph writing: each glyph gets a duration, the pen tip zigzags 3 rows inside the glyph box, the mask revealing along.
  - Newly written `DG.revealMask` (same-winding rectangles unioned — nonzero winding keeps overlaps) and `DG.zigzag`.
- "0.4s dead zone after the whip": block 2 moved earlier to start drawing at 3.12s, the hand entering as the whip settles.
- "The screenshot frame's border crosses the cat's head": each frame fills one layer of board color before stroking, so the front frame covers the back frame's lines.
- "'Find the pattern yourself' was cut in half at the top": block 3 moved down 60px overall.
- "After the pull-out, the gray base and smudges read as a dirty wall": the gray lightened to `#EEEEEC` and smudge alpha halved.
- "The wide shot held only 0.15s and the three groups never connected":
  - Block 1's ending gained an orange arrow pointing right, giving the whip a direction.
  - Block 2's ending draws an orange connector toward block 3; the hand leads the camera.
  - The pull-out moved earlier to 6.85–7.5s, the wide shot holding 0.5s.
- "The hand is a blue-sleeved cartoon hand": changed to a bare forearm with a dark side and arm hair, closer to RSA's real hand. Still code-drawn.

## QA (skill `scripts/qa.py`, final post-revision)

| Shot | Measured window (in-shot s) | Motion area% mean/peak | Still pairs% | Jump frames | Per-frame ms mean/peak | Deterministic |
|---|---|---|---|---|---|---|
| y3_s1 | 0.35–2.48 | 3.1 / 5.31 | 0.0 | 0 | 6.5 / 6.9 | ✓ pixel-identical |
| y3_s2 | 0.8–2.23 | 4.65 / 9.57 | 0.0 | 0 | 6.5 / 7.3 | ✓ pixel-identical |
| y3_s3 | 0.85–3.23 | 4.45 / 10.94 | 0.0 | 0 | 8.3 / 9.0 | ✓ pixel-identical |

Transition smoke test (one render per transition, slowest frame): y3_s2 (same) 46.9ms; y3_s3 (same) 14ms

Reading:
- All three shots have zero jumps: every "transition" is camera motion on the same board, and nothing on the board can jump.
- Motion area 3–4.7% comes mostly from the hand and the line being drawn; higher during camera moves.
- Under 10ms per frame because everything is vector lines with no pixel-level processing.

Re-run: `uv run scripts/qa.py --project scripts/engine --film demos/y3_whiteboard --out <dir>` (the table above is the experiment's numbers; for the post-admission re-run see doc 09's regression table).
