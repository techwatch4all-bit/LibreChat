# 07 · Proven practices: what has been shown to work

This page records reusable methods from practice, with evidence and applicable conditions.

This page records only **things that worked**: the method, the evidence (what was measured / who reused it successfully under what conditions), why it works, and when to use it. Pitfalls live in each reference's "pitfalls" section. Every entry carries its source; when a later film reuses it successfully, add one line to the evidence; when a reuse fails, write down the boundary.

---

## 1. Directing and mechanics

**1. Transition = the next style's signature language.**
- Evidence: all 15 transitions of the art-history speedrun were designed this way; in the transfer tests, two independent agents (A and B) both rated it "the most valuable, most transferable sentence in the whole skill", and 9 new transitions (gold-foil spiral spreading, Scream color bands pressing down, flying-apron ribbons peeling off the old painting, polka dots growing, melting droplets, hard-edged sunlight, wet-paper bloom, VHS tearing...) fell out of this sentence almost directly, with no detours.
- Why: a transition does two jobs at once — farewell to the old style, a preview of the new one. Within 0.3 seconds the audience knows "who comes next".
- How: list the new style's most recognizable formal elements (materials, brushwork, motifs, medium glitches), pick one that can go "from nothing to full", and grow it out of an object inside the frame (cat, cup, head).

**2. Speedrun/traversal films: one rig, one choreography, N drawing methods = "the same pair of characters is traversing", for free.**
- Evidence: RIG.girl/RIG.cat return Path2D + anchors, reused by all 36 styles; both A and B said "when the style changes, the person and cat stand in the same spot with matching stance and motion automatically — that effect came for free".
- How: use only for "same scene, changing style" speedrun/traversal films: fix the character rig and motion curves first, then write styles; the style only changes "how to draw", never "where and how to move". Other subjects compose per subject, and the style itself may determine the composition — do not inherit this rig's stance.

**3. The protagonist's actions must be continuous across segments, running on whole-film time.**
- Evidence: transfer test A's first version replayed the drink per segment on local time; the review's words: "the audience sees her raise the cup five times, not one instant in five styles". After switching to whole-film time (`PAINT.cupCycle(t)`), poses matched on both sides of each transition and the "two heads" glitch disappeared.
- How: in speedrun/traversal films, character actions always use whole-film time t; only "performance exclusive to one segment" uses local lt.

**4. Beat-grid camera impact acts on both old and new layers.**
- Evidence: v1 impacted only the new layer; review measured the first 6 of 15 transitions lagging 0.1–0.17s; after impacting both layers, every transition's first visible change landed on the beat (±2 frames), beat-frame diffs 7–33.
- How: in any beat-synced edit, the beat frame must show a whole-screen visible change.

**5. Let the first painting "draw itself" at the opening.**
- Evidence: transfer test A's ink-wash segment opened with brushstrokes revealing per a reveal mask and ink blooming for the first 0.45s; review approved, and frame 0 was no longer blank paper.
- How: when the film's first segment has no transition to borrow, open with that style's "painting process" (brushstrokes writing out, print plates dropping one by one, pixels lighting row by row).

## 2. Visual quality

**6. Regional palettes matter more than color jitter.**
- Evidence: Van Gogh v1 only jittered colors and read as "noise of one blue"; only after giving each region a 7–8 color group (`P.swatch`) did it read as Van Gogh. A's Munch (separate groups for sky/fjord/mountain/wall/ground) copied this directly and worked.
- How: for any stroke/dab style, define color groups per region first; each stroke samples from its group, then mixes 30–45% of the underpainting color to preserve light and shade.

**7. Large areas go to the renderer; small objects and characters get their own layer; lines patched last.**
- Evidence: sunflowers and table legs were shattered into mush by big strokes; after splitting layers they were clear. B's Hopper "two-version light/dark clipping" is a generalization of this rule.
- Boundary: ink wash, print, and pattern classes run a different order (paper is the base, ink only adds; the pattern itself is the renderer) — see doc 04.

**8. Characters must pass through the same renderer too, or they look like pasted clip-art.**
- Evidence: across the 36 styles, the ones where characters also went through the renderer (Van Gogh fine strokes, mosaic stones, 8-bit pixels, Cubist facets, black-figure silhouettes, shadow-puppet cutouts) blended best; the weakest spots in each segment were the vector-only flat characters (ink-wash figure 6/10, Ghibli figure "reads as flat vector", Dalí "leans vector illustration").
- How: after flat-filling a character, apply at least one "that style's material treatment" — strokes, grain, paper-texture multiply, ink-bloom edges, halftone dots, plate misregistration.

**9. Text inside a style reads better drawn as paths than set in a font.**
- Evidence: B's Cyrillic block letters (5×7 modules) and neon-tube kana; Rome's mosaic letters (monospace bold strokes, each ≥2 stones wide). A missing glyph in a font subset silently falls back to a system font and changes on another machine.
- How: titles, signs, and labels should be drawn as paths in the style's material first; when a font is unavoidable, verify the glyphs exist before use.

**10. The material's physical process is the renderer.**
- Evidence: ukiyo-e "fill offset (3,2)px against ink line + streaked horizontal brush marks" = woodblock printing; mosaic "layout computed once, colors flow through stones each frame" = how a real mosaic animates; gold foil "horizontal streak noise with y frequency 20× x" produced metal feel on the first try and was reused directly by A's Klimt.
- How: before writing a new renderer, ask "how is this kind of painting physically made in reality", and code that process.

**11. Small things must be bigger than intuition says.**
- Evidence: the ukiyo-e wave claw was illegible at 22–50px; 44–74px reads as The Great Wave; A scaled the Qi Baishi shrimp 1.45× and the flying apsara 1.35× before they read.

## 3. Motion

**12. Art-style frames: each era = one main action + 2–4 micro loops drawn from that style's motifs.**
- Evidence: pure image switching cannot show in-frame motion; the 16 segments built this way measured 1.6–14% motion area in qa, with zero jumps.
- Boundary: this rule governs art-style frames (the painting must stay alive). Explainer shots follow rule 29 — motion on events.
- How: motif action lists come from the deconstruction's motion heatmaps; without a reference film, list the style's 3 most recognizable formal elements yourself and give each a way to move.

**13. Let the direction field change continuously over time, not re-shuffle seeds at 8fps.**
- Evidence: whole-frame 8fps re-seeding measured frame diffs of 18–20 (larger than transitions); review read it as "the painting flickers". After fixing stroke positions and letting the direction field sway continuously, jumps hit 0 and motion area reached 9%. Boiling stays reserved for line art.

**14. A scrolling pattern's modulo period must equal the pattern's true period.**
- Evidence: A's polka-dot skirt modulo'd by spacing jumped on wraparound (frame diff 2.7×); modulo'd by the two-row period of the hex grid, the jump vanished.

## 4. Stability and efficiency

**15. Spec + benchmark implementation + grouped parallel agents passes in one round.**
- Evidence: 16 eras in 4 parallel groups, 30–35 minutes each, all delivered usable on the first pass; later 4 transfer-test groups (20 new styles) delivered in one round too. The spec states interface, available libraries, hard requirements, self-checks, delivery notes; the benchmark implementation lets the "five-layer structure" be copied.

**16. Always dispatch an independent review agent that watches only the finished film.**
- Evidence: the replication v1 review caught 4 classes of problems (beat lag, whole-frame flicker, too-still segments, the cat jumping character); transfer A's review caught "raised the cup five times", "two heads", "transparent arm"; B's review caught "ЧАЙ read as ЧАИ", "the pink dress reads as no clothes" — the makers themselves had watched 3 rounds without noticing.

**17. Accept with numbers: qa.py.**
- Evidence: motion area, still-frame pairs, jumps, real elapsed time (forced GPU flush), determinism — 16 segments verified in 40 seconds. First/last-frame diffs alone miss stalls (A: Klimt 33% change but 14/48 frame pairs still); JS-only timing reports fake 1ms numbers (B).

**18. All randomness seeded; the same t renders twice pixel-identically.**
- Evidence: all 36 styles passed cold/hot render comparison; renders don't flicker, and per-section re-renders can be stitched.

**19. Cache all static parts; draw only what moves each frame.**
- Evidence: Bauhaus 2.5ms, Pop 5ms, 8-bit 3ms; in B, 4 of 5 segments cached their whole base plate. The heaviest, Van Gogh (three full-frame stroke passes), is 117ms; the whole 60fps film still renders in under 2 minutes.

## 5. Deconstruction and references

**20. Reference frames lock composition for image generation; AI design sheets get grid overlays to read key points.**
- Evidence: gpt-image with an original frame as reference matched the original nearly pixel-for-pixel at 50% blend; the girl rig's hand-written v1 read like a boy — after a 20px grid overlay and point reading, one pass produced a 17-year-old blonde girl.

**21. The motion heatmap tells you "the painting is alive" before you start.**
- Evidence: before seeing the heatmap I assumed each segment was one painting; the heatmap showed 2.5–34% of area moving per segment, which decided the whole route.

**22. Fit the grid with "largest step at 80% inliers".**
- Evidence: minimum-residual fitting picks a tiny step to force-fit every point; after the change, 14.1 frames (128 BPM eighths) were fit from 16 detected points, with 3 false positives marked as outliers.

## 6. Scale-up (2026-10-04 evening, 36 styles integrated)

**23. Let independent agents build their own wheels first, then unify into a library.**
- Evidence: the 4 transfer groups each wrote their own brushes/renderers/post effects; on integration they merged into brush.js (7), render.js (14), post.js (6); after porting 20 segments to the shared library, 16 segments matched the original project pixel-for-pixel outside the character box — the library's API carries real usage.
- Why: unifying first designs abstractions nobody uses; let real styles grow first, and only things appearing twice or more enter the library (the converse of "three repetitions beat premature abstraction" also holds: the third repetition is when you harvest).

**24. Transfer tests are the best requirements document.**
- Evidence: the brief "read only the skill, build styles it lacks, write feedback" made 4 agents return 60+ concrete issues (silent degradation, hard-coded film length, unflushed timing, rig bugs, mislabeled dabs), each with a repro; none of these surfaced while the author used it themselves.
- How: each time the skill gains a major capability, dispatch 2 agents who may only read the skill, on subjects it has not seen, requiring a return of "what helped / where they got stuck".

**25. Acceptance tools must themselves be accepted.**
- Evidence: qa.py once reported all-green but never executed transition code — one transition referenced a nonexistent function and whole frames crashed without any report; a "transition smoke test" was added and caught it. Glyph checking via measureText under-reported on Mac; switched to reading the font file's character table.
- How: for every check, deliberately cause one failure (delete a scene, break a transition, use a missing glyph) and confirm it actually goes red.

## 7. Video animation grammars (2026-10-04 evening, 5 YouTube + 3 tech/finance)

**26. Measure sample films before fixing the grammar.**
- Evidence: G1's first Vox used torn-paper transitions; a frame-by-frame count of 5 real Vox films found zero instances; the whiteboard's first version pushed into thought bubbles, also absent from RSA films. G2 measured one TheOdd1sOut film: average shot 2.4s, 70% of adjacent frames completely still — the opposite of the intuition "animation should always move".
- How: before defining a grammar, run 2–5 representative films through `breakdown.py` for shot lengths, still ratios, and transition types, then write the card. Remembered "style signatures" are often someone else's.

**27. The camera depends only on time; transition functions only composite two shots.**
- Evidence: Kurzgesagt's 60× scale traversal stays sharp because everything redraws vectorially; Vox's desk and whiteboard "transitions" are the camera motion itself, qa jumps 0. G3: push-through transitions let the old shot keep pushing the camera itself rather than scaling a screenshot — to pass through a round object, magnification ≥ 1100/radius, or the last frame jumps.
- How: world canvas + viewport; never scale pre-rendered bitmaps as a transition.

**28. The "reveal" frame is the accent.**
- Evidence: G2's kinetic type set the section start to "bar line − reveal point × transition duration", so all visual events share a frame with the kick drum. Same principle as rule 4 (two-layer beat impact) in another form.

**29. Still is not stuck; but "every shot moves a bit" and "every shot slowly pushes" are the same disease.**
- Evidence: in storytime, 70% still frames are the style (the joke lands on "cut to the reaction close-up and shut up"); kinetic type stops moving once words land, giving motion to camera and background. One Nobel-literature explainer (2026-10-08) with the same voiceover, same assets, same 31-shot storyboard: r2 used a uniform 7.5% push per shot plus a fixed beige background, title bar, and picture frame — the author said "it feels exactly like a PowerPoint deck, terrible"; r3 switched to full-frame real footage, a dark real environment, removed page furniture, and moves of hold → 0.28s push 18–32% → hold, 0.30s same-magnification glide, 0.17s slam — approved. Completely still frames rose from 16% to 72%, fast-motion frames from 0.7% to 10%. All four changed at once, so which one mattered is unclear. Then "punch at every voiceover node" got written up as a global rule, and on 2026-10-12 a 102-second Nobel-economics short pushed in about 48 times, always inward — the author said "too many moves, and way too fast, not smooth at all"; the same day, rewatching the literature film: "the literature film was mediocre".
- How: qa's "still-frame pairs >40% reads as stuck" does not apply to explainer, story, or text genres — holding is correct. The root of "reads like PPT" is "every shot makes the same move", whether that move is a slow push or a punch. Move the camera by "where the audience should look now": transitions use slow push, glide, pull-out (0.6–1.5s); punch and slam are reserved for accents; after pushing in, come back out. The move table and when counts are enforced: see `shot-language.md`.

**30. Review must check logic and numeric consistency, not just looks.**
- Evidence: G3's review caught "the output neuron connects to the hidden layer, not the pixels", "'grew 9×' should be 'grew to 9× the original'", "monthly-line end ¥268 does not match the daily-K end ¥286.40" — all three had flawless visuals and wrong content. Finance charts' hard rules: axes must not truncate misleadingly (if truncated, explicitly state "y-axis does not start at 0"), units, sources, sample-data badges.

**31. One focus per screen; structure first, then data, then annotate one thing only.**
- Evidence: kinetic "the key word slams in, the rest rise from a mask"; finance "axes first, data next, one annotation last"; 3b1b "one color means one concept; morphing turns the previous concept directly into the next, almost no cuts" — three grammars independently reached the same conclusion.

## 8. Characters

**32. Humans go to the image model; code only composites — divide labor by "who is best", not by "how pure the route is".**
- Evidence: in a three-direction comparison of the same frame, the code-drawn chibi was judged "awful"; both G2's frame library and AI frames repainted in style "worked great"; across the 36 styles, the most common weakness was also the characters. Code's strength is regularity (stroke fields, geometry, camera, timing, physics, determinism); the model's strength is "correctness" of faces and human forms.
- How: see doc 10. For each layer, first ask "who draws this best", then decide what draws it.

## 9. Hooking into the voiceover pipeline (2026-10-04 night, end-to-end field test)

**33. Render clips to the finished film's frame counts, with windows taken from the film's timeline — cuts and speed changes need no special handling.**
- Evidence: between the two beats being replaced lay a 3.65s pause removed by the rough cut, which had also sped up the section; treating them as one continuous stretch of film time (119 frames), rendering, and swapping in produced, after compile, that shot's `rate` = 1.0 and 119 rendered frames = 119 shot frames; only 1 chapter re-rendered (30–57s), the other 7 untouched. Chapter frames diffed against clip frames gave motion frames 28/29, 127/137 with offset 0 (the rest was encoding noise, symmetric).
- Why: the pipeline's director layer works in source seconds, the film in film seconds, and the animation lives only in the film. Taking windows from the film's timeline bypasses three conversions: speed, cuts, and "beat end = next beat start".
- How: wrap "draft (window from film timeline, spec draft) → render → verify (frame-sync check)" in a small script inside the pipeline; see doc 09's "clip contract".

**34. Cues name "which word", not "which second"; convert to frames before rendering.**
- Evidence: 5 cues (bars growing, callout popping, clipping revealed, two highlighter passes) landed within −0.48 to +0.09 frames of word starts, all from frame rounding; when the voiceover changed and window frame counts changed, render rejected outright instead of silently misaligning.
- Why: seconds are secondhand numbers copied from word lists, and each copy can err; the word is the director's true intent (the callout pops when a number is spoken), and conversion belongs to the script.
- How: `{"word": "7.8", "kind": "highlight"}`; add `nth` for repeated words, `offset` to lead.

**35. Portrait screenshots with text: split the spoken half-sentence into two highlighter passes, each on one keyword.**
- Evidence: framing the whole passage (width 0.93) left no room for the red circle, the camera couldn't push in, body text at ~20px was unreadable on a phone; split by the voiceover into two half-sentence boxes, each on one keyword, pushed in 2.4×, text height ~50px; when the second box was off-screen the camera glided there first, then revealed.
- Why: portrait's bottleneck is frame width; one focus can be only half a sentence; Vox is inherently the grammar of "look at this line", so circling line by line with the voiceover fits naturally.
- How: crop screenshots from the original frame (keep one `_source-frame` copy); verify rects with a `--stills` render first — eyeballing is often off 20–30%.

**36. Grammars with on-screen text yield to the subtitle band; do not make subtitles yield to the animation.**
- Evidence: t3 portrait's annotation landed at y≈1460, overlapping burned subtitles (1400–1520); adding `safe` moved the chart to 300–1430, sharing the safe area with the film's other contain assets, and extracted frames showed zero occlusion. The first independent review said "a full white screen between dark screenshots jumps in brightness the most"; adding `safe.fill` = the film's background turned the top and bottom strips into the same dark base as neighboring screenshots, and the chart became a card in the same position.
- Why: subtitles are burned uniformly at export; moving them per segment means touching the export chain; the animation is parameterized, so moving itself is cheapest.
- How: the spec writes `safe` (the pipeline's draft computes it from ASS and contain_box).

## 9. From demo films to reusable clips

**33. A good demo film ≠ a good parameterized clip; parameterization needs its own review.**
- Evidence: all 8 grammar demo films passed independent review; after extraction into spec-driven clips and re-review, only 3 were directly usable: swapping in real data exposed tick-rounding errors, category labels got stripped, big numbers clipped line heads; the subtitle-yield parameter was ignored in 6/8; the camera left before the text card finished typing; the whiteboard's last frame had the pen covering the word "not", inverting the meaning. Demo inputs are author-picked; clip inputs come from the pipeline.
- How: parameterized-clip review must change inputs — negatives, decimals, long titles, portrait, no screenshots, transparent backgrounds, over-long text — at least one "unfriendly" spec per case; the sample assets used for acceptance must themselves be clean (a table-of-contents screenshot is not a sample).

## 10. Hooking into voiceover video

**34. Render animation segments to "film duration + word-level timing", with keyframes landing on key words.**
- Evidence: in a copy of a portrait voiceover film, two sections of one chapter were replaced with animation (t3 finance chart on a number comparison, y2 Vox on official-text screenshots); frame counts matched the shots exactly, 7 keywords within −0.48 to +0.09 frames.
- Why: animation appears only where a screen recording explains poorly (one number comparison, one official quote); before and after are still a real person and a screen recording; picture events reveal as he speaks the word, as if he were pointing at it.
- How: give it the beat → take film duration and word times → generate spec → render → freeze and backfill (interface in doc 09, "clip contract"). Numbers come only from a source table, with the source written on the chart.

**35. Do not add narrative gags he did not ask for.**
- Experience: continuously accumulating decorations on a character steals attention from the scene; narrative gags should be confirmed in sample films first.
- How: review feedback of "missing something" is information for him to judge, not authorization to add it; for structural gags, show them in a sample film or direction note and wait for his nod.

## 2026-10-05 00:34:23 +0800 · Assign grammars by explanatory task within one voiceover

Method: real posts/drafts used a Vox evidence desk for tracing and highlighting; rules/controlled comparisons/sound-picture relations used 3b1b's continuous object transforms; after locking voice, subtitles, and timeline, the picture was rebuilt. Evidence: a voiceover film's 467.8s narration and 270 subtitles survived the full restyle; the final two MP4s' AAC raw-packet hashes matched the locked mix; no post-publication retention data yet. Why: the picture carries each passage's explanatory act; materials serve readability; grammars permit stillness after reading or derivation, and do not pad motion with background micro-motion. Applies to: voiceover films alternating real material and mechanism explanation.

## 11. Long-scroll traversal film (Huashu walks through famous paintings, 2026-10-05)

**36. One skeleton file + parallel per segment: 24 worlds, 4 agent groups, assembled in one pass.**
- Evidence (the skeleton and 3 segments ship in `scripts/engine/demos/long_scroll/`, method in doc 11): `lib/world.js` defines only the segment interface (width, ground line, walk frames, interaction at/dur/frame, back/front/seam), hero traversal, boundary-cropped hero, badges; four groups wrote 6 segments each, sorted by era and joined into 123.7s with qa determinism ✓ and 0 jumps; review checked 23 boundaries' ground height and hero continuity — all passed. The key is film-wide constants (ground line 760, height 300, stride) hard-coded in the skeleton.
- How: write the skeleton and interface first, then dispatch groups; in the interface **all events are timed relative to "interaction start"** (`WORLD.actT`, `item.atAct`), never "N seconds into the segment" — the film's stride later went from 330 to 560 and not one segment needed retiming.

**37. Per-segment tempo micro-adjustment puts music boundaries on bar downbeats.**
- Evidence: with 24 boundary times fixed, a single BPM missed by 112ms at best; after giving each segment whole beats and micro-adjusting tempo between 86–104 BPM, all 24 boundaries landed on bar downbeats, max error 11.7ms, average 3ms.
- How: when the picture is fixed first and music follows, do not force one BPM; ears cannot hear ±8% per-segment tempo differences, but they hear an instrument change missing the downbeat.

**38. The camera only advances, never retreats.**
- Evidence: v1 stepped the camera forward during interactions and pulled back at the end; 17/24 segments showed 68–256px "rewinds" — invisible to qa, obvious in review. After "target = historical maximum + Gaussian smoothing", the film never retreats and stops/starts are smooth.
- How: for lateral long-scroll follow cameras, make the camera position function monotonic; a qa check for "camera retreats" would be even better.
