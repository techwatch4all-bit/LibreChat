# y4 · Storytime stick-character animation (YouTube storytime animation)

> One-sentence grammar: **the voiceover is the protagonist and the picture is its emoji sheet — the character snaps between a few poses (0.1s) then freezes; jokes land on a reaction close-up that goes silent at that instant.**

Representatives: TheOdd1sOut (James Rallison), Jaiden Animations, Domics. Tools: per Jaiden's FAQ and secondary sources, all three used Flash / Adobe Animate early on (no primary quote obtained; background only).

---

## ① Where it applies

**Use it:**
- First-person stories, failures, "my first time...": the voiceover has an arc and a pause-able punchline.
- The audience wants "this person": the creator's cartoon avatar appears every episode; they recognize the persona, not the craft (Pappis's genre study: avatars are "often distinguishable by hairstyle alone").
- Small budgets with a stable weekly cadence: one character, five or six poses, three mouths can fill an episode.

**Avoid:**
- Dense tutorials and data explanations → use y5 kinetic type or infographics. The audience will stare at the character waiting for jokes and never retain the numbers.
- Content without an "I" (industry news, product comparisons) → the character has no stance to perform and remains a talking sticker.
- Voiceover that is not funny and has no pauses → this style amplifies the voiceover; it will not rescue it.

## ② Picture construction

**Composition**
- Medium shot (waist up, head 25–35% of frame height) is the default framing; the character sits centered, biased to one side, leaving the other side for "what he is talking about" (a computer, the other person, an object).
- The background only states "where": a wall, a desk, a window — 3–5 large color blocks. White or flat-color backgrounds are fully valid too (Pappis: "a white background or a rough scene sketch").
- Reaction shots strip the environment: the face fills the frame (head radius ≈ 1/3 frame height), background a flat color + vignette.
- Punchline shots often invert: cut to an **extreme wide** where the person is tiny ("small and helpless" is itself the joke).

**Palette (the demo film's actual values)**

| Part | Value | Note |
|---|---|---|
| Skin | `#FFE2CC` | light, near-white — TheOdd1sOut's "marshmallow person" is pure white; Jaiden leans warm white |
| Hat / white tee | `#FFFFFF`, hat band `#E4E4E8` | white objects stand on black outlines |
| Shorts | `#CDBB97` | |
| Character line | `#1B1B1F` | the film's blackest black |
| Wall / desk / floor | `#DCE9EC` / `#E2C29B` / `#E8DCC8` | low saturation, high value: the background is always "lighter" than the character |
| Background line | `#5B6470` 3px | lighter and more than half thinner than the character line |
| Reaction-shot void | `#3D405B` + radial vignette | cold, dark, pressing all attention onto the face |
| Mouth / tongue / blush | `#6E2430` / `#F07B7B` / `rgba(255,140,120,.35)` | the only saturated color inside the mouth; one open-close cycle is very visible |

**Line width**: character line = head radius × 0.05 (minimum 4px) — medium shot R=165 → 8px, big close-up R=360 → 12px, wide R=95 → 6px. Lines thicken and thin with shot scale (Flash's default behavior); background lines stay 3px. **Character line ≥ background line × 2** is why "the person always pops out" in this style.

**Shape language**: all circles, all obtuse. The head is a slightly flattened circle (1.0R wide × 0.93R tall), the body a bean (1.0R × 1.2R), full height 3.2R — **the head is ~58% of height**. Arms are one round-capped tube with no elbow and no fingers; the hand is a circle. No right angles, except props.

**Character design (Huashu's storytime version)**
- Two signatures kept: the **pure white bucket hat** (rounded-trapezoid crown + wide downward-sloping brim + light gray band) and **round black glasses** (frame stroke 1.5× the outline stroke — the glasses are this face's "eyes"). From the original likeness only the white tee, khaki shorts, and black watch remain (a small black patch on the near wrist).
- Eyes are black dots inside the lenses (0.075R) with one white highlight; "dead-fish eyes" shrink the dot to 0.035R and drop the highlight.
- Expression rides mainly on the **eyebrows** (the short thick line between brim and frames): raised = surprise, inner ends raised = aggrieved, flat = speechless. The mouth has five: smile arc, flat line, wave (worried), half-open, full-open.
- A bit of black hair shows at the sideburns, telling the audience there is hair under the hat, not baldness.

## ③ Motion paths

**Original-film measurements (this crawl, 480p re-uploads, first/last 10 seconds removed; method: 160×90 grayscale frame diff)**

| | TheOdd1sOut "Mom's punishment" (30fps, 475s) | Jaiden Animations "Being Not Straight" (24fps, 902s) |
|---|---|---|
| Average shot length ASL | **2.43s** (median 1.87s, IQR 1.03–3.07s) | **5.73s** (median 3.21s, IQR 1.67–6.67s) |
| Completely still adjacent frames | **70.7%** | 51.2% |
| Still-run length | median **0.40s**, p75 0.70s | median 0.08s (= an on-twos pause) |
| Motion-run length | median **100ms** (3 frames) | median 42ms (1 frame) |

Reading: TheOdd1sOut is **snap (0.1s) → freeze (0.4–0.7s) → snap again**, 70% of the time completely still; Jaiden is **continuously moving on twos** (12 drawings/sec) with longer shots. In the Toon Boom interview, Hallis Blaney, animation supervisor on Netflix's *Oddballs*, put it best: "TheOdd1sOut is pose-to-pose, very little animation... basically switching between images", and the hardest part of adapting it to series was keeping that snappiness while avoiding "too soft, too slow". The demo takes the middle: pose snaps follow TheOdd1sOut; breathing and lip sync follow Jaiden.

**Demo film parameters**

| Motion | How | Numbers |
|---|---|---|
| Character frame rate | all character motion steps at 24fps (`MO.step(t,24)`); camera smooth at 60fps | Flash default 24 |
| Pose swap | arm target interpolated with `expoOut` | **0.10s** (2–3 frames at 24fps) |
| Pose rebound | at swap, the body squashes vertically 7%, Ebberts spring rebound (volume preserved, horizontal counter) | `settle(dt, -0.07, freq 3.5, decay 9)`, ≈0.35s to settle |
| Lip sync | reads the voiceover RMS envelope, **reshaping allowed only every 1/12s** (on twos); three mouths | envelope <0.06 closed, <0.22 half-open, else full |
| Talking nod | head sinks while the mouth is open | 0.015R × mouth-open level |
| Breathing | body scales vertically | ±1.2%, period 1.6s |
| Blink | fixed schedule, 2.4–3.6s apart | 2 frames closed @24fps (83ms); "speechless" slow blink 3 frames |
| Gaze | the dot shifts toward a pointed object | 0.09R |
| Camera | the demo used medium, close-up, slow-push medium, and slow-pull wide (a slow push every shot — old practice); new films hold by default with change from hard cuts and jump-ins; slams only for the punchline | demo: medium +3.5%/2.0s; close-up +6%/1.2s; wide 0.53→0.50 (quintOut); medium close 1.90→1.98 |
| Opening | camera 1.04→1.01 lands (0.5s expoOut), replacing "frozen frame one" | |
| Sweat drop | slides down along the face's side at the temple | 0.9s, expoOut blended with linear |
| Lens glare | a white diagonal band sweeps the two lenses | 0.3s |
| "?" | pops overhead, backOut overshoot 30%, then wobbles ±3° | 0.26s |

Entrances/exits: storytime almost has no "entrance animations" — the character is already in place and already talking on the first frame after the cut. Props and symbols (?! sweat drop, numbers) are the only pop-ins (`backOut`, overshoot 15–30%).

## ④ Transitions (the common 5)

1. **Hard cut** — the overwhelming majority. One voiceover sentence, one shot; a new sentence cuts. The demo's S3→S4 (close-up → the same room's extreme wide) is a hard cut, the size contrast making the joke.
2. **Smash cut to a reaction close-up** — the new frame is there on frame one, springing from 1.22× (freq 3, decay 11) back to 1, the first 2 frames pressed with a 55% white flash and a low "thud". Used for "after saying something absurd → his face". `TRANSITIONS.smash`.
3. **Whip pan** — the camera whips toward "what he is looking at", `expoInOut` 0.26s, 16 offset copies stacked mid-way for horizontal motion blur, with a whoosh. Used for eye redirects like "I open my laptop → (screen)". `TRANSITIONS.whip`.
4. **Push in / jump-in** — the same framing cuts straight to ~2× closer without changing the background. Used for "he repeats himself", "he realizes", "the punchline line". The demo's S4→S5: saying "these..." in the wide, hard-cutting to a 1.9× medium close at the breath before "where to stick it" — only then is the joke face readable. The prerequisite is that wide and close are **the same world canvas, only the camera changes** (`world.js`), or the jump glitches.
5. **Over-the-shoulder / POV** — cut to what he sees (screen, phone, the other person) with the back of his head in the foreground. The demo's S2: Huashu's back — white hat + band, ears, glasses arm hooked on the ear, short black hair, nape, white tee collar, with a cold rim light around the screen side (the first version drew a pure black silhouette and review read it as "another shadow person"); the foreground does not follow the camera's push, only rises with breathing, parallaxing against the screen, and the frame instantly "has space".

## ⑤ Rhythm and text

- **Shots follow voiceover sentences, not musical beats**: one sentence ≈ one shot. The demo's 5 shots average 1.75s (2.0 / 2.4 / 1.2 / 1.65 / 1.5), inside TheOdd1sOut's measured IQR 1.03–3.07s.
- **Transitions land in the breath between sentences; subtitles and cuts change on the same frame**: the first version's whip cut across the first two words of "it in one go"; review flagged "the cut lands mid-sentence"; changed to L1 ends (1.87s) → whip at 2.0s → lands 2.26s → he speaks at 2.30s.
- **Reaction shots sit in the silence between sentences**: the demo's S3 runs a full 1.3s with no line, only crickets — that pause is the joke. In the edit: after the absurd line ("three thousand lines"), **do not take the next sentence immediately**; leave 0.8–1.5s for the face.
- **Hold ≥0.9s after the punchline**: the "?" pops at 7.80s and the film ends at 8.75s, letting the SFX tail finish naturally (the first version left 0.4s; review: "the laugh beat got cut off").
- **Text**: native YouTube storytime burns no subtitles (CC carries it); only "must-be-seen" text goes in the frame — on-screen text and key numbers (the demo's "3000 lines" in PuHui Black 230px, `#FFCB6B`, slamming in with 23% overshoot). Chinese platforms need burned subtitles: white 50px, black stroke 10px, whole lines in and out, no animation (moving subtitles compete with the character for attention).
- On-frame numbers align to the **same syllable** as the voiceover: the "three thousand" syllable (3.70s) = 3000 slams = the low thump = the screen shakes (9Hz, decaying over 0.3s).

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/y4_storytime/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- **Reused from the skill**: engine (section table, offscreen compositing of old and new during transitions, `GLOBAL_OVERLAY`), `render.py`, `PAINT.cached` (the room background cached whole), `U.rng` seeded randomness (the code waterfall's color-block layout).
- **Two engine changes (merged into the skill engine)**: any section in the section table may write `dur` (seconds) directly, no eighth-note rounding needed — storytime cuts on the voiceover, not the beat; transitions may write `punch: 0` (or film-level `window.PUNCH = 0`) to disable the engine's default beat impact (storytime has no beat).
- **Newly written, now unified** (`lib/toon.js` / `typo.js` / `camera.js` / `motion.js`; transitions into `transitions.js`):
  - `TOON.bean(c, {x, y, s, char, pose, expr, mouth, blink, look, squash, bob, tilt, lw})`: front-facing bean character, all programmatic Path2D, returning hand and head coordinates (for positioning props and symbols). This code-drawn bean character is reserved for demo films and white-model rehearsals only: after watching several models' films, the author judged code-drawn little people an instant AI tell (his words: "the little people and robot characters used in many videos are far too poor"). Parameterized clip y4 accepts only your own frame library (`data.character.frames`, AI-generated frames, see doc 10 and `references/character-fidelity.md`); without one, startup fails.
  - `TOON.POSES`: rest / talk / point / type / shrug / stiff; each pose is just two hand targets relative to the shoulders (units: head radius).
  - `TOON.mouth(t)`: reads `window.VO_ENV` (the 60fps RMS envelope exported by the audio script), quantized on twos to 0/1/2.
  - `MO.springHz / settle / backOut / expoOut / step`, `CAM.with`, `CAM.drift` (the handheld micro-drift the demo used; new films hold means hold, without it), `TOON.sweat`, `TOON.mark`.
  - Transitions `whip`, `smash` (y5's zoom-into-color-block transition was renamed `fillZoom` on admission; plus `bands / push`).
- **This film's `y4_storytime/story.js`**: `STORY.poseAt(keys, t)` (pose timeline + swap rebound), `blinkAt`, `alive` (nod + breath), subtitle overlay.
- **Audio (`build_y4.py` in the experiment archive, not admitted to the skill)**: lays the voiceover, synthesizes SFX (whoosh, keyboard, bloop, thump, "thud", crickets, pip, boing), and exports `vo_env.js`. The voiceover is macOS `say`'s Eddy placeholder — **after the real narration replaces it, re-export the envelope and the lip sync follows automatically**.
- **One room, three shot sizes**: `y4_storytime/world.js` paints the room as one world canvas (x −1000..2900, y −700..1700, static parts cached whole); S1 (zoom 1.01–1.045), S4 (0.53→0.50), S5 (1.90→1.98) change only `CAM.with`. The bookshelf, plants, and chandelier visible only in the wide were in the world all along. The world must exceed the widest camera by a margin, or camera drift reveals black edges (the first version's three black edges all came from this).
- Key parameters: character 24fps, lips 12/sec, pose swap 0.1s + 7% rebound, character line 0.05R.

## ⑦ Representative works and primary references

- TheOdd1sOut channel: https://www.youtube.com/@theodd1sout ; the measured re-upload of "Mom's punishment": https://www.bilibili.com/video/BV14s411M7x4
- Jaiden Animations channel: https://www.youtube.com/@JaidenAnimations ; the measured re-upload of "Being Not Straight": https://www.bilibili.com/video/BV1xu411r734
- Domics channel: https://www.youtube.com/@Domics
- Toon Boom × Atomic Cartoons, *Oddballs* from YouTube to series ("pose-to-pose, very little animation", "he never did lip sync on YouTube", "too soft, too slow"): https://www.toonboom.com/atomic-cartoons-on-bringing-oddballs-from-youtube-to-series
- Konstantinos Pappis, *The Odd Ones Out: The Rise of YouTube Storytime Animation* (Animation Studies; genre history and visual grammar: round-faced avatars, white backgrounds, no frame-by-frame, closer to animated storyboards): https://journal.animationstudies.org/article/id/135/
- TheOdd1sOut wiki (the "marshmallow person" description): https://en.wikipedia.org/wiki/TheOdd1sOut
- Dan Ebberts inertia-bounce expression (the source of freq 3, decay 5): http://www.motionscript.com/articles/bounce-and-overshoot.html
- Maker experience post "add a little bounce on pose swaps": https://forum.wickeditor.com/t/whoever-wants-to-make-a-storytime-animation/5940

## ⑧ The 3 easiest mistakes

1. **Treating it as "fully animated", everything moving.** This style's life is "snap + freeze": TheOdd1sOut is 70% completely still frames. Everything drifting slowly reads soft and rhythmless (the *Oddballs* team's dreaded "too soft, too slow"). Pose swaps must hit 0.1s and then **truly stop**; persistent micro-motion goes only to breathing, blinks, and small background objects, amplitude ≤1–2%.
2. **Painting the background as beautifully as the character.** Background saturation, contrast, and line width are all one notch below the character (here background line 3px gray vs character 8px black). Once the background is busy, the audience's eye leaves the face and the voiceover's joke is lost.
3. **Reaction shots without silence.** Taking the next sentence immediately after the absurd line explains the joke away. Reaction shots sit in the voiceover's blank, at least 0.8s. The camera holds, with only one or two small details (sweat, slow blink, one drooping brow); to strengthen, jump one size nearer at the punchline (hard cut to ~2× closer) or slam 0.17s — never fill with a uniform slow push.

---

## Demo film

- Finished film: `scripts/engine/demos/y4_storytime/` (render with `render.py --film demos/y4_storytime`) (8.75s, 60fps, with placeholder narration + SFX); one frame per shot overview: `assets/grammar/y4_storytime-overview.jpg`
- Project: `scripts/engine/demos/y4_storytime/` (`eras.js` section table, `story.js`, `world.js` world canvas, `s1_desk.js / s2_screen.js / s3_react.js / s4_wide.js / s5_close.js`), shared parts in `scripts/engine/lib/`
- Shot list: S1 medium, talking to camera (0–2.0s) → whip → S2 over-the-shoulder at the screen, code waterfall + "3000 lines" (2.0–4.4s) → smash → S3 big reaction close-up, silence (4.4–5.6s) → hard cut → S4 same-room wide "I asked it: these...", glancing at and pointing at the computer (5.6–7.25s) → jump-in → S5 medium close shrug "stick it where?" + "?", holding (7.25–8.75s)

## Review rework (independent agent watched only the finished film)

The first review's five "must fix" items, all handled:
1. Three black-edge glitches (S1 left/top, the smash rebound scaling below 1, S4's camera drifting down) → world canvas enlarged + `smash` scale clamped ≥1. After rework, a four-edge frame scan found 0 frames showing black.
2. The punchline had no breath → S5 split out as a jump-in shot, holding 0.95s after the "?".
3. S1 and S4 were not the same room → rebuilt as one world canvas with camera changes.
4. The over-shoulder silhouette read as another person → painted back-view identity marks + rim light.
5. The whip cut mid-sentence and the second subtitle lagged → the whip moved into the breath, subtitles sharing the cut's frame.
Two "could be better" items handled: S3's second cricket followed 0.15s later by a drooping brow (originally the SFX at 5.23s and the expression at 5.38s mismatched); S4's two pauses gained "glance at the computer → back to camera" and pointing at the computer while saying "these". Subtitles dropped the space between the on-screen Chinese and the Arabic numerals (the original lines read "let AI help me" and "3000 lines").
Not changed: the lines are uniform-width vector strokes with no hand-drawn wobble — that is TheOdd1sOut/Jaiden's Flash vector line as it is; kept.

## qa.py numbers (post-rework, `uv run scripts/qa.py --project scripts/engine --film demos/y4_storytime`)

| Section | Motion% | Still pairs% | Jumps | Mean/peak ms | Deterministic |
|---|---|---|---|---|---|
| s1_desk | 1.47 | 8.6 | 0 | 9.9/10.4 | ✓ |
| s2_screen | 6.0 | 0.0 | 0 | 1.7/3.8 | ✓ |
| s3_react | 1.73 | 0.0 | 0 | 5.6/6.1 | ✓ |
| s4_wide | 0.77 | 16.2 | 0 | 9.6/9.9 | ✓ |
| s5_close | 3.27 | 3.1 | 0 | 10.9/11.4 | ✓ |

Transition smoke test (whole-frame peak): whip 47.9ms, smash 10.1ms, cut 15.7 / 20.5ms. The first version reported 1 jump each in s1, s2, s4 (opening settle, 3000 slamming, the wide's opening fast pull-out); post-rework 0.
Reading this table: qa's empirical threshold "still pairs >40% reads as stuck" **does not apply to storytime** — TheOdd1sOut's original is 70.7% completely still adjacent frames; that is style, not stutter. This film's still pairs run 0–16%, much "livelier" than the original, deliberately taking Jaiden-style continuous breathing; to read more like TheOdd1sOut, switch off breathing, nodding, and background micro-loops, keeping only lip sync and pose snaps (still pairs would rise sharply; not measured this time).
