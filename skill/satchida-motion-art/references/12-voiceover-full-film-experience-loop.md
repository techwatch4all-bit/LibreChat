# Full-film voiceover and experience flow-back

This page collects general methods from full-film voiceover production; it does not contain the author's private feedback archive. The clip interface is still doc 09, characters doc 10, the long-scroll demo doc 11.

## From voiceover to picture

Confirm the script, narration, and word-level timing first; only then build the style table and highlight list. Bind actions to keywords (like the reference code's `TM.cue`); do not hard-code every timestamp. The camera follows the content's outer frame; the subtitle zone is a constraint in camera space that pushes must also respect.

The whiteboard accumulates on one large canvas; a block's first stroke syncs with the camera's arrival; writing inside the block then follows speech rate. After `const B = DG.board(...)`, call `B.line(points, {smooth:false})` for rectangles to keep smoothing splines from bulging into ellipses. A full list's reading time starts when the last item has finished appearing — do not count drawing time as reading time.

For Vox collage, establish objects, relations, and camera first, then add paper texture and decoration. Presenter films should vary layouts and shot sizes up front — moving the character's position later cannot rescue monotonous blocking.

## Acceptance and freeze

`qa.py` provides determinism, efficiency, motion, smoothness, and text-framing cues. Framing can detect text cropping, overlapping text, subtitle zones, and near-blank areas; decorative large text may false-positive, so inspect the matching frames. For films on light backgrounds, use `subzone_gate.py` to double-check graphics entering the subtitle band; textured backgrounds are exempt from that dark-pixel threshold.

Before delivery, an agent that did not produce the film reviews it independently; long films get at least two reviewers. Record timecode, root cause, fix, and re-verification for each issue; keep regressions of old issues separate from discoveries of new ones. Accept against the specific problems; do not chase aggregate scores. When the same class of issue survives three rounds and two fix attempts, go back to the assets or engine capability; upstream script problems go back to the script.

After the user chooses, freeze code, timeline, mix, and subtitles together. Candidate films and the frozen version stay inside the project; never overwrite without confirmation.

## How experience flows back into the skill

Each round records phenomenon → root cause → fix → verification → destination. Style-specific issues go to the matching grammar card; cross-style methods to doc 09; character methods to doc 10; machine-measurable items to QA. Distill recurring pitfalls into start-up checks, and prefer turning them into engine capabilities over more prose rules. After changes, have an independent agent verify, and record it in CHANGELOG.

A project's private feedback, personal likeness prompts, and unpublished assets stay inside the project; the public skill takes only reusable methods and the necessary evidence.
