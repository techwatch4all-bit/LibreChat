# Y1 · Kurzgesagt flat science: video animation grammar card

One sentence: draw an abstraction as one concrete object, place it in an infinitely zoomable glowing world, and let the camera travel between scales; the environment layer (stars, particles) may move gently forever while the subject and information change on voiceover nodes, then hold.

Demo film: `scripts/engine/demos/y1_kurzgesagt/` (render with `render.py --film demos/y1_kurzgesagt`) (8s, 3 shots, 2 transitions); overview: `assets/grammar/y1_kurzgesagt-overview.jpg`
Basis: this style's research (the research notes and frame data stayed in the experiment archive and were not admitted to the skill; the numbers used are excerpted here) (2025 measurements of two films + 2014 "The Immune System", plus the official Skillshare course transcript). Numbers marked 【measured】【primary】 come from there; 【this film】 marks parameters actually used in the demo film.

## Start-up checks

1. **First write this segment's visual metaphor: what object is the abstraction?** (a cell, gears, pipes, a city, a drop of water...). A sentence with no object should not become a glowing ball with a few label capsules.
2. **The demo film's and samples' orange center planet is one implementation, not this grammar's signature.** The center object changes shape and color with the subject. Parameterized clip y1's center object is set by the spec: `data.center_style` (color, shape, orbit ring or not) or `data.image` (crops a real image into the center object); when absent, a neutral style is generated from the name — no longer that orange planet. It draws only "center object + satellite nodes", fitting layered "what's inside" explanations; when the subject is not that structure, write your own shots (`demos/y1_kurzgesagt/` and `lib/`'s `CAM`, `TOON`) or switch grammar.
3. **At least one state change per narration sentence** (pop, morph, zoom-in, pull-out). Count sentence by sentence: two consecutive sentences with no change need an event added — never pad with floating and slow pushes.
4. **The subject holds after landing.** The environment layer (star twinkle, particle drift, distant clouds) may move gently forever; the subject and labels get no floating or breathing, and no uniform slow push fills pauses.
5. **Pause before diving in.** Before a scale transition, let the object you will enter hold ≥0.3s and light up, so the audience knows which one comes next; zoom logarithmically (`CAM.zlerp`).

---

## ① Where it applies

**Use it:**
- Scale journeys and "what's inside": from cells to galaxies, from one pixel to one model, or "zoom in and you find...". Scale transitions are this style's signature.
- Mechanisms and systems: neural networks, the immune system, energy flows. Best for drawing invisible processes as glowing particles and lines.
- A calm, storytelling explainer voice. Kurzgesagt runs ~168 words/min; one hard-cut shot carries about 2 sentences【measured】.
- When a "serious but cute" tone is wanted, with a mascot or a flock of birds delivering jokes.

**Avoid it:**
- Real people, real events, archival evidence: flat cartoons dilute credibility — such content uses Y2 collage.
- Steps and reasoning chains: written out one step at a time reads better — Y3 whiteboard.
- Tiny budgets. This style's quality rests entirely on "something moves in every frame"; the official films take 1,200+ hours each【primary】. A shortcut Kurzgesagt looks like a cheap PPT.

## ② Picture construction

- **Pick the era first**. 2025 is the dark family: dark pixels 61–68%, saturation median 0.84–0.89. 2014 is light gray-white with low saturation. The two never mix【measured】. The demo's first two shots use the 2025 dark family and the third, daytime, uses the bright family — mimicking their "change the section, change the whole color temperature" habit.
- **Palette** (2025 dark family, color-sampled):
  - Base: `#05020F` / `#0E0631` / `#25155E`
  - Secondary base: `#191670`, `#3826A3`, `#5F58DB`
  - Accent cyan: `#32BAEE`, `#7DD3DC`
  - Accent orange-yellow (emitters): `#F48301`, `#E07919`, `#FACC12`, glow core `#F9EF93`
  - Magenta: `#BE3A95`, `#C83C7F`
  - Highlights and white text: `#E7DFE1`, `#F9FCFB`
  - Rule: one dark base with 2–3 high-saturation accents, mutually contrasting (orange-yellow vs indigo, cyan vs magenta)【measured + distilled】
  - **The deep-purple base above is a deconstruction record only — do not copy it into films.** The author watched several AI-made films and said "we need to avoid the garbage blue/purple gradient palettes; that is very AI slop"; the deep-purple starfield is precisely such films' most common instant AI tell, and `deliver.py` measures blue-purple backgrounds and red-lights them. For a dark family use `references/palettes.md`'s `ink` (deep ink) or `navy` (navy flat fill), keeping the rule "one dark base + 2–3 high-saturation accents"; parameterized clip y1 just writes `"theme"`, and when absent it defaults to flat deep ink.
- **Shape language**:
  - No outlines. Shadows are same-hue blocks one shade darker; highlights are white ellipses or one arc【distilled】.
  - Rounded corners everywhere. Creatures are blob-organic; character heads are round; limbs are round-capped tubes.
  - Emitters always carry a radial glow. The dark base exists to make glow work.
- **【this film】two-tone faceting**: `flat(c, path, base, shadow, highlight, v, w)`. Two offsets inside the shape: a shadow band lower-right, a thin highlight edge upper-left. v≈(10,12)px, w≈(4,5)px. Huashu's parts also pass through this, so he and the scene share one drawing method and never read as pasted.
- **Composition**: the subject sits on the lower-middle third line, leaving sky above for stars and labels. Scenes use 5–6 parallax layers: stars d=0.05, moon 0.12, far hills 0.3, near slope 0.65, subject 1.0, foreground leaves 1.5 (near blurred, dark). The official count is unpublished; measured 2–5 layers【distilled】.
- **Characters**:
  - Kurzgesagt birds: egg-shaped bodies, big white eyes, small black pupils set forward, orange triangular beaks. Wings are leaf shapes one shade darker than the body; each bird gets one color【primary + distilled】.
  - 【this film】The cat is a teardrop body with a round head, triangle ears with magenta inner ears, big white eyes; the robot is a rounded shell with a dark screen face and one glowing lens eye; Huashu uses `HUASHU.build`'s point pose, every part passing through two-tone faceting.

## ③ Motion paths

- **Official easings**【primary, Skillshare】:
  - Regular actions 50 frames (0.83s at 60fps). For crispness use 30/20/10 frames; pops use 5–10 frames.
  - Looping actions use Easy Ease 33.3%, ≈ `cubic-bezier(.333,0,.667,1)`.
  - Other actions use 75% influence, ≈ `cubic-bezier(.75,0,.25,1)`: very soft start, fast middle, very soft end.
- **Pop**【measured】: cards grow to 90% within 0.25s, overshoot to 108% at frame 20 (the probe card 114%), settling to 100% in ~0.5s.
  - 【this film】ID labels use `backOut(q, 1.1)`, 0.5s.
- **Stagger**: same-class elements stagger 10–20 frames, limbs 3–4 frames, 20-frame pauses between actions【primary】.
  - 【this film】Titles stagger per character 45ms, each 0.5s cubicOut. The pixel cat's 144 blocks stagger by distance to center 35ms/cell, each 0.5s backOut(1.4) flying in from the edges. The neural network lights layer by layer every 0.32s, nodes popping 0.35s.
- **Ambient micro-motion and subject holds**: in 2025 films, completely still stretches within any 0.5s total only 0.3%【measured】; what moves is the environment layer (star twinkle, particle drift, glow) and the thing currently being explained.
  - Explainer shots: the subject and information elements hold after landing; actions sit on voiceover nodes (pop, morph, push, dive).
  - Pure mood shots (title, section-change breathing room) may keep light ambient motion: stars twinkling, particles drifting, the distance moving slowly.
  - Blinks: 5 frames closed, 10 open, irregular intervals, **eyes never shrink to 0**【primary】.
  - 【this film】170 stars, each twinkling at its own phase 1–3.5 rad/s. Foreground leaves `blur(7px)` for depth of field. The robot bobs ±12px with jet light jittered by a 23/37Hz dual sine. The cat's tail swings as two bezier segments. Grass blades swing at 2.1 rad/s. Firefly particles drift at layers 0.8–1.3. Signal pulses loop continuously along the edges.
- **Camera**【measured】:
  - 2025 films zoom ~1/3 of the time, pan ~10%, rotate ~5%; pull-outs outnumber push-ins. Zooms are mostly scale traversals and reveals, not pause-filling.
  - New films' named-node shots: hold → slow push ~0.9s → hold; 0.7s glide between nodes; punch 0.28s or slam 0.17s only for reveals; hold length follows the voiceover; after pushing, return via pull-out (④ fast pull-out reveal). Scale traversals follow ④'s durations.
  - 【this film】Shot 1 used a 2.6s uniform push 1.00→1.10 — old practice; do not copy it.

## ④ Transitions (the common 6)

1. **Push-through → object color fills the screen → new scene** (the scale transition's standard form).
   - Measured: immune 1:48, ~1.4s, accelerating then decelerating, peak mid-way.
   - 【this film】Transition B:
     - The camera pushes logarithmically into the lit output node (0.45s, cubicIn) until the screen is fully yellow.
     - At midpoint ±3 frames, dissolve to the robot's glowing eye. Both sides' highlights sit upper-left, so the cut is invisible.
     - Then pull out (42→1) over 1.45s cubicInOut, landing in the daytime palette.
     - Do not use expoOut: its initial slope is too steep and the first frame jumps most of the scale away.
2. **Dive into an object; inside it is the next world** (a traversal variant).
   - 【this film】Transition A, 1.0s: the camera pushes logarithmically (`bezier(.75,0,.25,1)`) into the robot's lens (1.1→60). The next shot shows only inside the "lens circle", which grows with the push until it covers the screen, ringed by a cyan halo. The next shot simultaneously emerges from 0.42× expoOut.
3. **Fast pull-out reveal**: 0.2–2s, fast start, long-tail settle (measured per 0.2s: 1.074→1.040→…→1.0006). Connects the micro to the macro.
4. **Light or flash fills the frame**: use an in-frame light source for a white-out, ~0.5s.
5. **Sweep wipe**: an object or light band sweeps diagonally across with speed lines, ~0.4s.
6. **Multiply until full**: for "so many that...", 3–6s.

Two more points【measured】:
- Hard cuts are rare, about 5 per minute, following narration sentence starts, 0–0.2s early.
- Most other picture changes are 0.3–0.6s designed transitions, one every 4.6–6.7s.

## ⑤ Rhythm and text

- **Shot lengths**【measured】:
  - Hard-cut shots median 7–9s, mean ~11.5s.
  - But "visual units" change every 4.6–6.7s via designed transitions.
  - At least one state change per narration sentence: pop a label, swap an annotation, morph, or transition.
- **Aligning with the voiceover**: narration sentence timestamps are the skeleton; hard cuts sit 0–0.2s before new sentence starts【measured】. The score is composed after picture lock (Epic Mountain)【primary】.
- **Text**:
  - Annotations first draw a thin white leader, then type the text, ~40 chars/sec; one annotation per narration sentence, erased character by character after ~3s【measured】.
  - Chapter title cards every 2–3 minutes, full screen, appearing word by word, background blurred.
  - Label capsules are big-radius, filled with saturated flat color, holding bold sans text.
- **【this film】**:
  - 3 shots in 8s is ~3× normal density, only to show the whole grammar in one demo. Real films go 7–9s per shot.
  - Titles use PuHui-Heavy 76px, rising per character.
  - Layer labels use PuHui-Medium 40px with an extending underline.

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/y1_kurzgesagt/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- Reused from the skill:
  - `PAINT.cached`, `U.rng`: determinism
  - `RIG.smooth`: smooths point lists into Path2D — the cat, hills, leaves
  - `HUASHU.build/pose/details`: Huashu
  - `PAINT.noise`
  - engine's section table, transition interface, offscreen A/B buffers
- Newly written, now unified (`lib/camera.js` / `motion.js` / `typo.js`):
  - `CAM.at(keys, t)`: keyframe camera with logarithmic zoom. `CAM.zlerp` magnifies by the same factor per frame, making scale transitions constant-speed traversals. New films' holds and named nodes use `CAM.track` (default slow push, glide between nodes, pull out; punch/slam only for accents; hold otherwise); parameterized clip y1's highlight defaults to slow push; spec top-level `data` `"camera": "snap"` switches to punch.
  - `CAM.anchor`: keeps the target point gliding to frame center while zooming.
  - `MO.bezier(x1,y1,x2,y2)`: brings AE/CSS bezier easings into code, solved by Newton's method.
  - `MO.*`: sine, quint, expo, back, elastic and more.
  - `TY.charsIn`: per-character entrance.
- The demo film's own (`demos/y1_kurzgesagt/kurzgesagt.js`; `flat` entered the library as `TOON.flat`, `layer` as `CAM.layer`):
  - `flat()`: two-tone faceting.
  - `layer(c, cam, d, fn)`: parallax layer. Displacement linear in d, scaling by `z^d` — far layers barely move during deep pushes.
  - `Y1.cat`, `Y1.bot`, `Y1.bird`: three characters.
  - `Y1.lensAt(t)`: the lens circle's screen coordinates for transition A.
- **Key architecture**:
  - The camera depends only on whole-film time. Inside a transition window, the engine keeps drawing the previous shot into the A buffer; that shot computes its own "diving in" camera.
  - So zoom transitions are always vector redraws — never a 1920px bitmap blown up 60× into mush.
  - Transition functions (`transitions.js`'s `lensReveal`, `matchCut`) only decide "how A and B composite".
- Engine changes (only this experiment's copy):
  - Any section in `eras.js` may write `dur` (seconds).
  - Beat camera impact now defaults off, enabled only by `transition.punch:true`. Explainers should not have beat jolts.

## ⑦ Representative works and primary references

- Samples:
  - How Are Memories Stored Inside Your Brain? (2025) https://www.youtube.com/watch?v=PqtggjVAi8M
  - Why Humanity Will Never Leave The Solar System (2025) https://www.youtube.com/watch?v=Cyl3X88KEgg
  - The Immune System Explained I (2014) https://www.youtube.com/watch?v=zQGOcOUBi6s
- Official course (easing, loops, birds, character motion transcript):
  - Skillshare "Motion Graphics with Kurzgesagt" Part 1 https://www.skillshare.com/en/classes/motion-graphics-with-kurzgesagt-part-1/631970755
  - Part 3 https://www.skillshare.com/en/classes/motion-graphics-with-kurzgesagt-part-3/140140401
- Official behind-the-scenes:
  - 1,200 hours per film: https://www.youtube.com/watch?v=uFk0mgljtns
  - Official self-description: https://kurzgesagt.org/what-we-do?visit=videos
- Score: Epic Mountain https://www.epic-mountain.com

## ⑧ The 3 easiest mistakes

1. **Turning "always moving" into everyone breathing**. Measured: in 2025 films, still stretches total 0.3% — but what moves is the environment layer and the thing being explained, not every element floating. Explainer shots: the subject holds after landing; actions sit on voiceover nodes. Pure mood shots keep light ambient motion like star twinkle and particle drift. Motion padded by everyone floating and uniform slow pushes still reads as PPT.
2. **Linear zoom interpolation, or scaling bitmaps**.
   - Linear z starts slow and ends violent; the traversal feel breaks. Use logarithmic interpolation.
   - Blowing up the previous shot's screenshot 20× turns to mosaic. The scene must redraw itself at the larger z.
3. **Bright noisy palettes, or outlines on things**.
   - 2025 Kurzgesagt is "dark base + 2–3 glowing accents", carried by glow.
   - Black outlines or a mid-brightness base slide into children's books or corporate flat illustration.
   - Shadows are the same hue one shade darker — never gray.

---

## Review and revisions (independent agent watched only the finished film, 7/10)

Review findings and this round's handling:
- "Cat, grass, hills have outlines — looks like children's illustration": grass blades changed from lines to filled thin triangles; the hilltops' bright edge pressed to one shade from the base color.
- "The black block bottom-left looks like dirt": foreground leaves got `blur(7px)` for depth of field and lightened from near-black to `#0E0631`.
- "The title vanished in one frame": changed to a 0.55s sineInOut fade.
- "Shot 3's cat turned orange→black with no explanation": the orange cat stays at Huashu's feet as "the known cat"; above the black cat a leader and small text "an unknown cat" appear first, then the ID label pops.
- "At 7.8s the bird intersects the robot": the bird's height moved to 175/225px.
- "The ending 7.1–8.0 is almost still": the demo film then added a 4%/s slow push. The current practice: end on an event (fast pull-out to see the whole, or dive into the next layer), then hold.
- "At 3.03–3.10s the pixel cat is half-clipped by the lens circle": unchanged. This is the normal state of the "dive-in" reveal process.

## QA (skill `scripts/qa.py`, 2026-10-04, final post-revision)

| Shot | Measured window (in-shot s) | Motion area% mean/peak | Still pairs% | Jump frames | Per-frame ms mean/peak | Deterministic |
|---|---|---|---|---|---|---|
| y1_s1 | 0.0–2.58 | 1.57 / 2.58 | 0.0 | 0 | 32.9 / 34.6 | ✓ pixel-identical |
| y1_s2 | 1–2.68 | 3.36 / 4.42 | 0.0 | 0 | 6.1 / 7.2 | ✓ pixel-identical |
| y1_s3 | 0.9–2.68 | 17.94 / 91.88 | 0.0 | 8 (1.04–1.28s continuous) | 11.2 / 16.0 | ✓ pixel-identical |

Transition smoke test (one render per transition, slowest frame): y1_s2 (k_lens) 48.3ms; y1_s3 (k_fill) 36ms

Reading:
- **Shot 3's 8 jump frames** fall within 1.04–1.28s as one continuous stretch — the middle of "pulling out of the robot's eye" at 42×→1×, whole screen scaling, hence the 92% motion peak. This is a designed scale transition, not a glitch.
  - The first version used expoOut; its initial slope was so steep the first frame jumped from 42× to 15×, flagged by both review and qa.
  - Switched to cubicInOut, peak mid-way, matching measured Kurzgesagt "traversal push" shape.
- **Shot 1's 33ms/frame**: foreground leaves added `filter: blur(7px)` for depth of field, slower than the 9ms before blurring, still far under the 150ms ceiling.
- Motion area 1.6–3.4% looks low because Kurzgesagt's micro-motion is "many small things each moving on their own": stars, particles, tails, floating, pulses. Measured: in 2025 films completely still stretches total 0.3%; here all three shots' still pairs are 0%, matching. But still pairs at 0% only proves the environment moves, not that it explains well — still check whether the extracted frames flip like pages.

Re-run: `uv run scripts/qa.py --project scripts/engine --film demos/y1_kurzgesagt --out <dir>` (the table above is the experiment's numbers; for the post-admission re-run see doc 09's regression table).
