# Shot language: how to use the camera

The expansion of SKILL.md's "The director's brief: how to use the camera". Every number on this page states **when it applies and when it can be ignored**. Numbers come from measuring reference films and from films the author has voiced an opinion on; they are starting points, not quotas. If you have a better camera design, build it — then watch once at normal speed and compare side by side with the reference.

## 1. Ask three questions before moving the camera

1. **Where should the audience look at this moment? Can they see it clearly at the current shot size?** If it can be seen clearly, do not move. When the frame is moving on its own (live footage, a line being traced, a curve growing, water pouring), moving even less — a camera move steals the scene.
2. **Is this move a transition or an accent?** Carrying the eye somewhere new, establishing relations, building mood — that is a transition; use slow. Reveals, reversals, key numbers landing, punchlines — those are accents; only then use fast.
3. **What was the previous shot's move?** After pushing in, find a chance to pull out or glide away; never shot after shot pushing inward. The same move three times running and the audience hears a metronome.

## 2. The move table

| Move | What it is for | Reference numbers | Where the numbers come from | When the number can be ignored | Engine |
|---|---|---|---|---|---|
| hold | the audience is reading, the frame moves by itself, the silence after a punchline | hold length follows the voiceover; no bounds | Vox dwell segments' frame diff 0.0–0.1; 3b1b's wait is still | — | write no move |
| slow push | carry the eye to the next detail, step the emotion forward | 0.6–1.5s, sineInOut; push until "what must be read is readable", commonly 10–40% | Vox pushing into a photo 1.0–1.5s, finding a card 0.5–0.9s; 3b1b's native pushes ≈1s; Heer & Robertson 2007 suggest ~1s eased data transitions for statistical charts (about chart transitions, borrowed here as an analogy) | very large pushes (2×+) may run to 2s; when following musical beats, follow the beat | `CAM.track`'s `push` (default 0.9s), `to` |
| pull out | return to the whole, establish "where it is", close a section, endings | 0.8–2s, fast start, long-tail settle | Vox pulls out ≈1s; Kurzgesagt's fast pull-out reveals 0.2–2s, long tail | scale traversals (cell to Earth) follow y1 card section ④'s durations | `pull` (default 1.1s, `MO.longTail`) |
| glide / find the next thing | across one wall, one desk, from one item to the next; following something moving | 0.5–0.9s, sineInOut; chasing along a red line 1.3–1.8s, long tail | Vox field measurements | when following a moving object, speed follows the object | `glide` (default 0.7s) |
| punch | accent: reveal, reversal, key number | 0.25–0.35s pushing in 18–32%, then hold | the numbers the approved Nobel-literature film r3 used (doc 07 item 29, which also changed assets and background); School of Motion kinetic type "camera pushes 6 frames + 2-frame pull-back" | in kinetic type (y5) the punch is the main grammar, following accents; in other grammars it is rare | `punch`, or `to` with `dur: MO.PULSE.punch` |
| fast pan / whip | a sudden eye redirect ("I open my laptop → (screen)"), comedic timing | 0.26–0.30s, with motion blur | y4 whip measured 0.26s expoInOut | — | `pan`, `TRANSITIONS.whip` |
| slam | big text, numbers, stamping, the moment a new frame lands | 0.17s, 1.55→0.94→1.0 | approved films' implementations | at most once per shot; do not slam on every cut | `slam`, `MO.slam` |
| hard cut / jump-in | change shot size without camera motion: reaction close-ups, jumping one size nearer | 0 frames | y4 storytime: freeze + jump in; the joke lands on the cut | — | `cut` |
| slow drift, uniform slow push | mood shots, art-style frames where "the painting stays alive", MV lyrical passages, 5s+ emotional long takes | 1–4%/s as a starting point | no approved-film measurement: these are the y1/y2 demo films' numbers (4%/s, 1%/s), judged an old practice when used on explainer shots; never rejected on mood shots — after building, compare side by side with the reference | **in explainer films, a few percent of slow push per shot is PPT** (the film in doc 07 item 29); this usage is not allowed | `CAM.drift`, `CAM.at` |

Duration constants live in `MO.PULSE`; `CAM.track` without a kind is a slow push; `pull` without a k exactly cancels one default slow push, and the surest return to the whole is writing `z: base.z`. Parameterized clips (t2, y1, y2) default highlight to a slow push; `"camera": "snap"` in the spec's top-level `data` (`{"data": {"camera": "snap"}}` — writing it directly at spec top level (sibling of `grammar`) or in a cue's data does nothing and raises no error) switches the whole clip to punch, so use it only on segments that need the accent.

## 3. Counts and density: when they are enforced, when not

**Principle**: accent moves are like bold text — bold everything and nothing stands out. Pushes come back out.

| Situation | Enforced? | How to judge |
|---|---|---|
| Explainer, science, finance, whiteboard, Vox films | yes | punch + slam + whip under one third of shots (lint ⑯); no three consecutive pushes inward (lint ⑮); a film with "push count" above 8 per minute reports yellow in film_gate — watch it once at normal speed |
| Douyin/Channels-style first-3-second hooks | density not enforced | hooks may be dense; after 3 seconds return to normal rhythm |
| Kinetic type (y5), beat-synced music sections | punch count not enforced | the camera follows beats and accents; rhythm comes from the music |
| Stories, comedy (y4) | pushes enforced, cuts not | mainly freeze + hard-cut jump-ins; pushes are rare |
| MVs, mood films | enforced by emotion | the author's words (2026-10-11): "the camera moves and transitions feel monotonous and dry, lacking variety, lacking emotional expression." Verse: slow pushes and drifts; chorus: faster; bridge: pull out; transition peaks on the beat |
| Art-style speedruns, traversal classes | pushes not enforced; "is the painting alive" is | each era one main action + 2 motif loops; the camera may drift forever |
| 3b1b (t1) | pushes enforced | the camera follows the object being watched: smooth, one push ≈1s, still during wait; punch only when the conclusion lands |
| Keynote, screenshot tutorials (t2) | pushes enforced | screenshots full-frame; slow push only to the part being discussed, once or twice per image, then pull back to the whole or glide to the next part |
| Finance charts (t3) | pushes enforced | hold while the chart grows; slow push ≈1s when pointing at a datum; punch only for the film's one or two most critical numbers |
| Kurzgesagt (y1) | pushes enforced, environment layer not | the environment may move gently forever; named nodes get slow pushes, enter/exit follow scale-traversal durations |
| Vox desk (y2), whiteboard (y3) | pushes enforced, glides free | one whole world canvas; gliding between items is the main grammar and may chain; push for the line being read, pull out after reading |

**Negative ruler**: on 2026-10-12 a portrait Nobel-economics short, 102 seconds, 44 shots, pushed in ~48 times in code (once every 2.1s), always inward, each 0.28s pushing 10–26%, with almost no pull-outs or glides. The author: "There are way too many zoom-in camera moves. Too many, and way too fast — not smooth at all." film_gate measured ~12 pushes per minute on that film (a lower bound; half the pushes on live footage go unmeasured).

## 4. With full-frame real material: the easiest trap

When one shot holds one full-frame photo or video, the camera's only move is pushing in, and the film becomes "cut, push, cut, push". That Nobel short was exactly that. Remedies:

- **If the footage itself is moving, hold.** People walking and hands moving inside the footage plus a push on top read as shaky.
- **One image gets pushed at most once or twice**, and only when "this part is unreadable at full-frame width". Pushing every time a noun is spoken is scoring the voiceover with a metronome.
- **Change the entrance**: pull out from close to reveal the whole; glide in from one side; hard-cut from the previous shot's landing to the same shot size.
- **Several assets to be discussed in sequence go onto one world canvas** (`MD.print` prints laid on the investigation desk, see the y2 card), and the camera glides between items — pushes and glides then alternate naturally.
- **A cut does not mean pushing again.** Every shot starting from 1.0 and pushing stacks into zoom-in after zoom-in.
- **The investigation desk is not a shrunken display.** When the camera rests on one item it fills 80–90% of frame (y2 card); large bare desk appears only mid-move and in the closing pull-out. In the 2026-10-12 A/B, the reworked film used a desk and cut pushes from 15 to 8, but at rest the photo filled only half the frame width with too much beige desk showing.
- **Portrait placing a landscape illustration: crop first, then place.** A 16:9 illustration dropped whole into 9:16 leaves a middle strip with empty top and bottom; crop to the part the voiceover is discussing into a portrait composition, then make the print or go full-frame; the whole image is reserved for the closing pull-out. Two independent agents hit this same rule on the same day.

## 5. How to self-check

- Shot-list stage: `storyboard_lint.py` checks three consecutive shots with the same move (hold does not count), three consecutive pushes inward, accents over one third, and a table with no moves at all.
- Finished-film stage: film_gate.py's "push count" yellow means pushes are dense — go look; "fast-motion frame share" red means the film barely moves. Note: a 1s 20% slow push scores about the same as a 0.28s punch on this metric (2026-10-12, measured on the Nobel short's three frames: 0.28s pushes 3 frames, 1.0s pushes 4–7, 2.0s pushes 3–10, all counted fast-moving) — do not speed up your camera just to pass the gate.
- **Camera smoothness cannot be seen in stills.** A still grid shows composition only; watch the finished film at normal speed start to finish, or at least its densest 30 seconds.

## 6. Sources and history

| Date | Film | What happened | Where it landed on this page |
|---|---|---|---|
| 2026-10-08 | a Nobel-literature explainer, r2 → r3 | r2 used a uniform 7.5% push per shot plus a fixed beige background, title bar, and picture frame, judged "it feels exactly like a PowerPoint deck"; r3 changed four things at once: full-frame real footage, dark real environment, page furniture removed, hold → 0.28s punch → hold — "much better now; just post it when done" | the drift row's "not allowed" usage and the punch row's source. Four changes at once, so attribution is unclear; later only "punch at every voiceover node" got written up as a rule — the "same move every shot" disease re-encoded at a new speed. On 2026-10-12 the author rewatched: "the literature film was mediocre; the physics one was decent" |
| 2026-10-10 | A Day of Claude opening, r4 | "very good, keep this rhythm": slam, a 0.35s violent pull-out into a cross-section panorama, paper-plane glide, floating dust added to stills | what was approved was a mixed set of moves — both pull-out and glide were in it |
| 2026-10-05 | SpaceX whiteboard | the author picked r6; r17 pushed 5 more times than r6 (unconfirmed whether that is what won him over) | unconfirmed |
| 2026-10-11 | a Monet MV for "Qi Li Xiang" | "the camera moves and transitions feel monotonous and dry, lacking variety, lacking emotional expression" | section 3's MV row |
| 2026-10-12 | the Nobel-economics short | "there are way too many zoom-in camera moves. Too many, and way too fast — not smooth at all" | section 3's negative ruler, section 4 |
