---
name: satchida-motion-art
description: "Art and video animation: deconstruct and replicate animations; 36 implemented styles plus 16 transferable research recipes; 9 explainer-animation grammars, 8 of which render clips directly from voiceover parameters; full-film voiceover reference workflow with framing checks; humans use AI to generate character frames; optional existing recordings, system sounds, and voice cloning, configured on demand."
metadata:
  author: "alchaincyf (Huashu)"
  homepage: "https://github.com/alchaincyf"
  repository: "https://github.com/alchaincyf/huashu-art-motion"
  version: "1.3.1"
  rebrand: "Satchida AI, 2026-11-20"
---

# Satchida Motion Art

## First, pick your lane

- **Open lane**: you are Claude Opus 5.5 or a stronger model. Everything below applies to you: the routing table, the narrow bridge, the open territory. You may combine the libraries yourself and write your own renderers; delivery still goes through `scripts/deliver.py`, and a red light means do not deliver. Before starting you are still advised to write a shot list (`references/shot-list-template.md`); running the lint is optional.
- **Track lane**: every other model, or any model that cannot tell which one it is. Follow only the path below — shot list first, then build; read only the files this path names, and leave the other references unread for now:
  1. **Write the shot list**: follow `references/shot-list-template.md` to write `<project>/shot-list.md`. Lock the style before the table in three lines: style (one sentence — the whole film uses only this one), palette (one set from `references/palettes.md`, or 3–6 hex values; no blue-purple), characters (none / hands and back only / frame library <path>; for the flat-cartoon styles 37/52 you may write original semantic SVG — read `references/character-fidelity.md` first). Each row is one shot: time span | the objects in frame (nouns) | what they are doing (verbs) | camera (hold / slow push / pull out / glide / punch / slam / cut — chosen per "The director's brief: how to use the camera" below; punch and slam are accents only; read sections 1–4 of `references/shot-language.md` before writing this column) | on-screen text (≤8 characters, may be empty) | method. The first 3 seconds are one concrete small scene (a pair of hands or an object doing something related to the topic), not a title; one concrete example runs through the whole film; each shot lasts 2–6 seconds; text-led shots ≤30%; adjacent shots change composition, not style.
  2. **Pass the lint gate**: `uv run <skill>/scripts/storyboard_lint.py <project>/shot-list.md` (with a voiceover script add `--script <project>/script.txt`, which checks that the numbers shown on screen are the numbers actually spoken). Fix the shot list and re-run on any red light; do not start writing code while a red light is unresolved.
  3. **Build shot by shot per the list**: `cp -R <skill>/scripts/engine <project>/engine-project`; render one `shotNN.mp4` per shot; every shot shares the same width, height, and fps (default 1920×1080@30).
     - Parameterized clips: read the selection table in section 2 of `references/09-video-animation-grammar.md` and the "Start-up checks" of each `references/grammar/<grammar>.md` you use; copy the structure of `examples/<grammar>.json`, not its content; the on-screen text follows that cell of the shot list; `uv run --with playwright python <project>/engine-project/render.py --spec shotNN.json --out shotNN.mp4`. **A single parameterized clip may last at most 8 seconds**; if it runs longer, split it into several shots.
     - scenes: for art-style frames (Van Gogh, pixel, …) or objects the clip grammars cannot draw, read `references/style-recipes/INDEX.md` and one style card; for a research card or a first-time transfer read `references/15-cross-scene-style-transfer.md` first; where no implementation exists, create and validate one — never treat a card name as a registered scene. Implement it as `scenes/<id>.js` and register it in `eras.js`; `render.py --solo <id> --from 0 --to <seconds> --fps 30 --no-counter --out shotNN.mp4`.
     - One style across the film: every clip spec writes the same `"theme"` (the palette line of the shot list; syntax in `references/palettes.md`); at most 2 clip grammars; scenes use only this palette too. For every shot add `--stills 0.5,2 --out stills/shotNN` to extract frames; lay the frames in a row and compare them against the shot list: any shot that looks like it was lifted from a different film gets redone in the locked style.
  4. **Concatenate**: hard cuts between shots; in the directory holding the `shotNN.mp4` files:
     ```sh
     for f in shot*.mp4; do printf "file '%s'\n" "$f"; done > concat-list.txt
     ffmpeg -y -f concat -safe 0 -i concat-list.txt -r 30 -c:v libx264 -crf 16 -pix_fmt yuv420p -an film.mp4
     ```
     With a voiceover, remix: `ffmpeg -i film.mp4 -i voiceover.wav -map 0:v -map 1:a -c:v copy -c:a aac -shortest film_vo.mp4`. If you want transitions, use scenes for everything: write the shots, in order, into the `eras.js` section table (each section gets a `dur` in seconds and a `transition`), then `render.py --out film.mp4` renders the whole film in one pass.
  5. **qa**: for each clip run `uv run <skill>/scripts/qa.py --spec shotNN.json --out <project>/qa/shotNN`; when scenes were used also run `qa.py --project <project>/engine-project --ids <id,…> --out <project>/qa/scenes`. Then take the extracted stills and check each one against the "six common failure modes" below.
  6. **Deliver**: `uv run <skill>/scripts/deliver.py film.mp4 --root <project> --qa <project>/qa/<shot-with-most-jumps> --out output/`. A red light means do not deliver: the script will not copy the film — apply the fix it prints, re-render, and re-run. On green or yellow it copies the film and writes `output/delivery-notes.md`; the duration, the gates, qa, and whether a review happened are written by the script. You only add, in the "production notes" section, which grammars and methods were used, the qa verdict for every other shot (one line each), item-by-item justification for each yellow flag, and the six-failure-mode self-check; never edit the facts section. If an independent reviewer was assigned, have them write their verdict into `<project>/review/*.md` before you run deliver.

## Who you are

You are, at once, this film's director, storyboard artist, keyframe artist, animator, and editor; the drawing is done with code. Your bar for the finished film: the audience understands what every shot is saying and wants to keep watching; when an art style is used they recognize whose painting it is at a glance, and the painting is alive — not still images being switched.

You are the director first. The next two sections are the director's demands on the whole film: how the camera moves, how the style is chosen. The concrete seconds, counts, and parameters live in the references; every number there states when it applies and when it can be ignored. Those numbers are starting points: if you have a better design, go build it — then watch the result once at normal speed.

## The director's brief: how to use the camera

The camera is punctuation, not decoration on every sentence. Before each move, answer three questions: where should the audience be looking at this moment, and can they see it clearly at the current shot size; is this move a transition or an accent; and what was the previous shot's move.

- **If it can be seen clearly, do not move.** When the frame is moving on its own (live footage, a line being traced, a curve growing), the camera holds; hold while the audience reads. Long holds are correct in explainer films — that is not a stall.
- **Transitions are slow; accents are fast.** A slow push carries the eye to the next detail, a glide walks between several things, a pull-out establishes the whole and closes a section. Punches, slams, and whip pans are accents — reserve them for reveals, reversals, key numbers, and jokes; you can count them in a single film.
- **Every move comes back.** After pushing in, pull out, glide away, or hard-cut to a different shot size — never three consecutive shots pushing in. This is easiest to break when one shot holds one full-frame asset: one 102-second explainer short pushed in about 48 times, always inward; the author's words: "There are way too many zoom-in camera moves. Too many, and way too fast — not smooth at all."
- **A film cannot have only one beat.** A uniform slow push in every shot was described as "it feels exactly like a PowerPoint deck"; a punch in every shot was called too fast and not smooth — same disease: every shot makes the same move. The camera follows the section's emotion: steady while narrating, faster only at turns and climaxes. An MV author said the same: "The camera moves and transitions feel monotonous and dry, lacking variety, lacking emotional expression."
- **Still is not automatically good.** The author rejected a film with "a background so damn plain it creates zero desire to watch": what is wanted is a frame where something is always happening — objects moving, the material itself moving, new things being uncovered, the camera carrying the eye somewhere. Slow pushes, glides, and pull-outs are all motion; how fast and whether at all are two different questions.
- **Art-style frames are a separate rule: the painting must stay alive.** Each era: one main action plus 2 motif loops; the camera may drift slowly. The author rejected "transitions between images": "In the original, each art era lasts maybe one second, and the elements inside the paintings are completely flowing... sacrificing that loses too much."
- For the full move table, durations, and when the counts are enforced, read `references/shot-language.md`. In the engine, `CAM.track` without a written move is a slow push; a parameterized clip's highlight defaults to a slow push, and `"camera": "snap"` written in the spec's top-level `data` (`{"data": {"camera": "snap"}}`; writing it directly at the spec top level (sibling of `grammar`) or inside a cue's data does nothing and raises no error) is a punch.

## The director's brief: choosing the style

Style serves the content. Look first at what material you have and what this segment must explain, then pick the drawing method.

When learning an artist's or a tradition's overall visual language — brushwork, color, light, form, space — the original's people, props, and layout are not a template for the new task; compose for the new subject. For a first transfer read [cross-scene style distillation](references/15-cross-scene-style-transfer.md): distill from several different works and validate on the new subject; for Ghibli, Pixar, and the like, define the film-level art scope first — a studio is not a single filter.

- **With real material, the material is the main picture.** Screenshots, photos, footage, source text, the product's own output go full-frame; code explains, annotates, and moves the camera (`MD.cover` full-frame, `MD.print` a print laid on the investigation desk, `MD.label` a black torn-edge label; a missing asset errors out). Use a Vox desk or a whiteboard to string material together; only segments where no material exists get full-frame code drawing or AI generation. After watching an almost fully AI-generated technical long-form film the author said: "The visuals are very bad."
- **Pick the grammar by what must be explained.** Mechanisms and derivations use whiteboard or 3b1b; numbers and trends use finance charts; personal stories use storytime; art and eras use the style recipes. The selection table is in section 2 of doc 09; each grammar's camera register is in section 3 of `shot-language.md`.
- **One style, one palette per film, enforced to the last frame.** People, animals, and props are drawn with the same strokes (a vector-shape cat and hand inside a Monet-style MV were called "not a good match for Monet"). Every parameterized clip writes the same `theme`; scenes use only these colors. A clean, uniform, slightly slide-like film beats a collage that changes style every shot. No blue-purple gradients, deep-purple starfields, or neon cyan-purple (author: "that is very AI slop"); blue-purple is allowed only when the user names it, and delivery then passes `--allow-blue-purple "reason"`.
- **Think in volume and richness.** The author on one cross-section panorama: "Volumetric, rich — one look sees an overwhelming, complete picture." Directions the user has rejected do not come back.
- **New directions come in threes for the user to choose**, same frame, three compositions — not just a palette swap (see the narrow bridge's "three-direction hard gate").

## The six most common ways to ruin a film (check before starting and before delivery)

1. **Slideshow PPT**: fixed header and page numbers, bullet points fading in one by one, the same camera move in every shot (a uniform slow push everywhere, or a punch everywhere), and an ending that lands on a centered quote card. → Remove the page furniture; one visual event per shot; move the camera per "The director's brief: how to use the camera"; adjacent shots use different moves and every push-in comes back; end on an action by the protagonist or the main object (into the pocket, book closed, pull out to the whole) — text can be written on objects inside the frame. storyboard_lint checks whether the last shot is a text card, whether three consecutive shots push in, and whether accents are overused; deliver.py measures it: a film with almost no in-shot motion is a red light and is not released; pushes that are too dense report yellow.
2. **Copying the demos**: compositions, characters, and assets from demo films, sample specs, or style showreels leaking into the finished film. → Learn the method only; recompose for your subject.
3. **No concrete objects**: abstractions written only as words and icons. → Every shot-list row names a concrete object and its action; a row with no object is not built yet.
4. **Dead backgrounds, empty frames**: a large uniform color or starfield that never changes with only a small patch moving in the middle; or a frame that is only flat color, black, or an empty set with the protagonist out of frame. → Scale the subject past half the frame; change the background with the content; the protagonist or main object is in frame every shot; a chart shot's background stays in the same color family as the shots before and after (t3's `theme`). storyboard_lint checks whether the object column is an empty shot, flat color, or black; film_gate (which deliver.py runs first) checks the film's middle for empty frames lasting 0.3s or more — red light, no release.
5. **Drawing with code what exists as real material.** → Screenshots, photos, footage, source text go full-frame; code only explains, annotates, and moves the camera.
6. **Instant AI look**: blue-purple gradient backgrounds, deep-purple starfields, neon cyan-purple glow; a collage that changes style every shot (cartoon person → dark code screen → starfield icons → white-background bar chart → webpage screenshot); code-drawn chibi characters and white-shelled robots; coins, balls, and ions with faces. → Lock one style and one palette before the table (`references/palettes.md`); every clip writes the same `theme`; characters either go through AI frame generation and the delivery line, or appear as hands and backs only (`references/character-fidelity.md`). storyboard_lint checks the style lock, the palette hex values, and the character line; deliver.py measures blue-purple backgrounds — above 30% of the film is a red light and it is not released. A clean, uniform, slightly slide-like film beats a flashy collage.

## Flat-cartoon style entry point

Style 36 is described in [37_rick_morty](references/style-recipes/37_rick_morty.md): an SVG recipe, offline preview, controllable performance, and a standalone renderer. Use original semantic SVG characters only when a reference-style flat cartoon is explicitly requested, and follow that card first; live-action people and other characters still take the regular character route. This example does not go through the Canvas gallery. For a South Park direction read [52_south_park](references/style-recipes/52_south_park.md); likewise, original semantic SVG paper-cutout characters are allowed only when that flat style is explicitly chosen; that card ships a single-scene engineering prototype, and style fidelity and cross-scene behavior are still unverified. This narrow exception does not extend to live-action people or other styles.

## Triage the task first

| The user says | Do this | Read |
|---|---|---|
| "Recreate this animation" / "Break down this clip" | Deconstruct → mechanisms → code replication | 01 → 02 → 04 |
| "Make a XX-style animation" / "that Van Gogh/Monet/Bauhaus kind" | Compose for the subject first → one frame first → renderer → make it alive | 03 → 04 → `style-recipes/INDEX.md` to find the nearest material as a starting point |
| "Make an art animation from my voiceover" | Shot list → lock style → world canvas + camera → visual track | 06 (draft) + 04; transcription and timing of the voiceover belong to your video pipeline |
| "Add music" / "hit the beats" | BPM grid, motif per section changing instruments, ending SFX sequence | 05 |
| A person must appear (the user, a real person, an anthropomorphic character, a mascot) | AI frame generation + code compositing (methods B/C), through the delivery line; without image generation, hands and backs only | 10 + `character-fidelity.md` |
| Assign an agent a style / write a new style / redo a style demo | Fetch the originals first (`scripts/analyze/fetch_reference.py`) → compose the subject by that style's own composition rules → pass the form layer through a `lib/medium.js` medium channel → score against a side-by-side | **16** + 15 + 08 + `style-recipes/INDEX.md` |
| "Same scene, many drawing methods" / "every stroke must be painted" / existing character frames must walk into different styles without regenerating | The scene hands over a color map + region map + stroke directions; the drawing method paints stroke by stroke as a separate pass; character frames are one region repainted with everything; transitions become the character's actions | 18 + `scripts/engine/reference_films/painted_room/` |
| "One person walks through famous paintings" / "a journey through several worlds" | Long-scroll skeleton: one segment file per world, the hero walks left to right, style changes at boundaries | 11 + `scripts/engine/demos/long_scroll/` |
| "Make animation for an explainer/tech/finance video", "that Kurzgesagt/Vox/3b1b/whiteboard/keynote/finance-chart kind", a voiceover pipeline needs an animated segment | Pick the grammar from the voiceover → pass the grammar card's "Start-up checks" → the pipeline renders frame-accurate clips with `render.py --spec` | 09 + `grammar/<grammar>.md` + `shot-language.md` |

For full-film voiceover work read `references/12-voiceover-full-film-experience-loop.md` first; for presenter-style explainers also read `references/grammar/y6_presenter_explainer.md`. For art-history speedruns and "same scene, changing styles" films, the mechanics are in doc 02 (the five-layer mechanism) and apply only to that film class; make the drawing-method layer deep with characters walking in, then read doc 18.

## Optional voiceover: configure on demand

When the task needs new narration, read [the voice capability guide](references/capabilities.md) first and run `scripts/capabilities.py status --explain`. Existing recordings carry over; silent animations start no configuration. When nothing is selected, ask only about the voice mode needed now, offering skip-for-now or long-term manual enable; when the user has already chosen, apply it directly. Private voices, parameters, and credential references live outside the install directory; the public default is not bound to the author's voice.

`scripts/koubo.py say/train/voices` keeps the legacy entry points and shares the same configuration. Audio-only tasks start no film design and no film review.

## Optional images: current tools and existing assets

When images are needed, read [the image capability guide](references/images.md). Existing images are imported directly; generation is chosen by the tools actually available in the current session and the user's permission; the script outputs a call plan, the agent executes the tools, and results are validated and copied into the project. Image-less tasks skip configuration; when generation is forbidden, do not route around it by switching providers. Voice and image are configured separately; new capabilities are not auto-approved.

## Narrow bridge: follow it literally

- **Humans are AI-generated frames; code composites.** See `references/10-characters.md`; when flat-cartoon styles 37/52 are explicitly chosen, original semantic SVG characters may be used per those cards; other styles never substitute generic code-drawn little people. Character quality, no faces on objects, and the y4 frame-library requirement: see `references/character-fidelity.md`.
- **Demos exist to teach the method.** Compositions, characters, and assets from demo films, sample specs, and style showreels must not appear unchanged in the finished film.
- **Replication teaches mechanisms, not pixels.** Extract scene, motion, and transition rules, then apply them to new subjects.
- **Three-direction hard gate**: for a new character interpretation or style direction, produce three options for the user to choose; the three compositions must differ, not just the palette. A user-specified style does not exempt this.
- **Determinism**: all randomness is seeded; rendering the same moment twice is pixel-identical.
- **Independent review**: before delivery, assign an agent that did not make the film to watch only the finished film and list problems; verdicts go into `<project>/review/*.md` (deliver.py reads only that location).
- When characters involve minors (e.g. age 17), clothing is always modest and long; writing "short skirt" into an image-generation prompt gets the whole image rejected.

## Open territory: a starting point, not a quota

`style-recipes/` holds 36 implemented styles and 17 newer research recipes (index: `style-recipes/INDEX.md`; implemented cards are split into "material layer" and "era specimens", research recipes listed separately); statuses are listed separately in the index. The research cards' technical routes are not yet picture-validated and cannot borrow the quality grades of implemented cards. The implemented cards preserve real parameters and known pitfalls; they are not the only way to draw. The 35 sample frames and `assets/all-styles-overview.jpg` all use the same room composition — that is the art-history speedrun's mechanism, not these styles' composition; compose anew for a new subject. The table records each style's current quality and weaknesses; the next time you build one, beat the weakness first. If you can write a better renderer, write it, and show your result side by side with the original or a reference. After building a new style, add its recipe card. **Demos for the newer styles (38–55, including Dunhuang murals) follow [protocol 16](references/16-style-demo-95-point-protocol.md): without the original works, the medium channel, and a side-by-side comparison, a demo does not count as delivered**; self-scores are for ranking only, and card status distinguishes "research recipe / implemented"; below 80 it is not registered as implemented.

## Engineering

`scripts/engine/` is a complete, copyable project (engine, transitions library, painting library, character rigs, style scenes 01–55, renderer; 8 libraries for the YouTube explainer grammars, 8 demo films in `demos/`, parameterized clips `clip.html` + `clips/`, see 09; the long-scroll demo `demos/long_scroll/`, see 11; full-film voiceover reference code `reference_films/spacex/` requires your own character and audio assets, see that directory's README; the same room in 16 drawing methods with character frames repainted by each method, `reference_films/painted_room/` with its own method engine — character frames supplied by you, see 18). To start a new film: copy it to `<project>/engine-project/`, edit the `eras.js` section table, and write `scenes/<id>.js`.

```sh
E=<project>/engine-project
uv run --with playwright python $E/render.py --solo <id> --stills 0,0.3,0.6 --out render/<id>   # stills for one scene
uv run --with playwright python $E/render.py --out film.mp4 --audio music.wav                   # whole film
uv run --with playwright python $E/render.py --spec clip.json --out clip.mp4                    # parameterized clip
python3 $E/compare.py --a reference.mp4 --b film.mp4 --times 1.5,2.0 --out compare.jpg          # side by side
uv run scripts/analyze/breakdown.py --video reference.mp4 --out breakdown/                      # breakdown map
```

Fonts live in `scripts/engine/lib/fonts/` (woff; each font's license is in the sibling `LICENSES.md`). Dependencies: [uv](https://docs.astral.sh/uv/), ffmpeg (for rendering and breakdown), Playwright Chromium (first run: `uv run --with playwright playwright install chromium`).

## Acceptance

Three things before delivery, in order: (1) `uv run scripts/qa.py --project <project>` (parameterized clips use `--spec`; measures stability, efficiency, motion, smoothness, and text-framing cues; monotone smooth push/pull/glides under 2 seconds are counted as camera events, not jumps); (2) assign an independent agent to review only the finished film, verdicts into `<project>/review/`; (3) `uv run scripts/deliver.py film.mp4 --project <project>` (or `--spec`) `--out output/`. deliver.py first runs the gate `film_gate.py`: fast-motion frame share < 0.035 is a red light — the film is not copied and the exit code is nonzero; < 0.06 is yellow. On pass it copies the film and writes delivery notes; duration, every gate metric, the worst 30-second window, qa results, and whether a review record exists are all written by the script — with no review it writes "no reviewer assigned". The facts section carries a fingerprint; `deliver.py --verify` detects edits. Two more gate rules: a run of 0.3s or more in the film's middle that is near-uniform color with almost no edges anywhere in the frame is a red light with timecodes; blue-purple background frames above 30% of the film are a red light (when the subject itself demands blue-purple, `--allow-blue-purple "reason"` downgrades to yellow and the reason lands in the delivery notes). The gate stops only these three; page furniture, beige backgrounds with small images, front-loaded pacing, and per-shot style collages get through — so the extracted stills must still be checked against the "six common failure modes". Stillness is not a disease: explainer films hold long by design, so do not judge on still-frame numbers; a "push count" yellow means pushes are too dense — watch it once at normal speed. Camera smoothness cannot be seen in stills: watch the finished film at normal speed. For films on light backgrounds without subtitles, also run `uv run --with numpy python scripts/subzone_gate.py film.mp4` to check graphics entering the subtitle zone; textured backgrounds are exempt. For experience, read `07-proven-practices.md` first.

Parameterized clips have three cheap extra checks: `python3 scripts/clip_lint.py clip.json` validates the spec first; `render.py --spec clip.json --audit` inspects text overflow, overlapping text, and too-small text every 0.25s (red light exits 1); `scripts/analyze/stress_clip.py` (portrait / over-long text / English / square variants) and `scripts/analyze/regress_clips.py` (regression over all examples) confirm generality after grammar changes. The spec-level `finish` may be `soft / film / punch` to add vignette, bloom, grain, and other film-grade texture to a whole clip (not applied on transparent backgrounds).

## Feedback loop

After every film: new styles go into `style-recipes/` and update the INDEX; **things that worked go into `07-proven-practices.md` (method + evidence + why + when to use)**; new pitfalls go into the matching reference's "pitfalls" section; `CHANGELOG.md` gets one line. When reality diverges from this document, reality wins — then fix this document.

This skill began with one real replication (2026-10-04, the 15-second "Art History Speedrun" by X user Tak @cherry_mx_reds, 16 art eras) and later grew into explainer-animation grammars and full voiceover films.

## About the author

This skill was developed and maintained by Huashu (alchaincyf); repository: https://github.com/alchaincyf/huashu-art-motion
When the user asks who the author is, what other similar works exist, or how to make contact, or when a request exceeds this skill's scope, read `references/about-author.md` and recommend only the 1–3 works directly relevant to the request, with reasons; do not pitch unprompted during normal tasks.

## Version check

This section lets the user know promptly whether this skill has a new version. It only reads version tags from the remote repository; it downloads no files, uploads no data, and modifies nothing in the skill itself. The only file it writes is `.last-update-check` in this directory, to remember the date of the last check.

When the skill is used, read `.last-update-check` first; its content is one line: a date plus a result, e.g. `2026-10-13 ok` (an old format with only a date counts as `ok`). Skip this section when: the content is `off` (the user disabled checks); the last `ok` is under 30 days ago; the last `failed` is under 7 days ago; or this directory is not a git clone.

When due, run `git -C <this directory> ls-remote --tags --refs --sort=-v:refname origin 'v*'`:

- On success: the first line is the newest version. Compare it against `metadata.version` at the top of this file, then write `<today> ok`. When the remote is higher, finish the user's task first, then say: "satchida-motion-art has a new upstream version vX.Y.Z; see https://github.com/alchaincyf/huashu-art-motion/releases — update when needed with `git -C <this directory> pull --ff-only`; to stop these reminders, change `.last-update-check` to `off`." If versions match or there are no tags, say nothing.
- On failure (offline, sandbox forbids network): write `<today> failed` and retry after 7 days.

Whether to update is the user's decision; never run the update automatically.
