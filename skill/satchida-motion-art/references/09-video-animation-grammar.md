# 09 · Video animation grammar: 8 drawing methods for YouTube explainer / tech / AI / finance films

Read this when making the "animated segments" of narrated explainer films. It is the index of the 8 grammar cards (`references/grammar/`), the selection table, cross-grammar rules, the library quick reference, and the clip contract for voiceover pipelines.

All 8 grammars have directly renderable demo films (`scripts/engine/demos/<grammar>/`, pixel-identical to the experimental originals when admitted; after the 2026-10-05 fix of `TY.charsIn` alpha, the y1 demo film's title fades out over 0.55s as originally intended — those 0.55s of frames differ from the original) and parameterized clips (`scripts/engine/clips/<grammar>.js`, feed one JSON and get a frame-accurate video segment).

---

## 1. Overview

| Grammar | Fits | One-sentence core | Typical shot length | Main easing | Main transitions | Card | Demo |
|---|---|---|---|---|---|---|---|
| **y1 Kurzgesagt flat science** | scale journeys, "what's inside", mechanism systems; a calm, storytelling explainer voice | draw an abstraction as one concrete object inside an infinitely zoomable glowing world; the camera travels between scales; the environment gently moves while the subject changes on voiceover nodes, then holds | hard-cut shots 7–9s, visual units change every 4.6–6.7s | `MO.k75` = bezier(.75,0,.25,1); loops `MO.easyEase` | zoom-into `lensReveal`, fill-then-pull-out `matchCut` (log camera push) | `grammar/y1_kurzgesagt.md` | `--film demos/y1_kurzgesagt` |
| **y2 Vox collage** | argument over real archives, news, screenshots, people; "look at this line", "note this number" | the argument sits on a desk of real material, the camera moves across it like an investigative journalist's eye, lines and pens drawn in stepped strokes | slow lane median 3.3s (one card 3–7s); fast lane 1.4–1.8s | camera `MO.sineInOut` / long-tail `MO.longTail`; elements step at 12fps | hard cuts, pan along a red line `same`, push into a photo → hard cut `cut` | `grammar/y2_vox.md` | `--film demos/y2_vox` |
| **y3 whiteboard (RSA)** | reasoning chains, steps, "why"; deriving while narrating | write a line as it is said; the camera follows the argument across one big whiteboard, ending pulled out to the whole map | median dwell per block 6.6s | on-board pan `MO.sineInOut` 1.2–2.4s; far jumps 0.8s whip + motion blur | same board `same` (camera motion is the transition), pull-out ending | `grammar/y3_whiteboard.md` | `--film demos/y3_whiteboard` |
| **y4 storytime stick characters** | first-person stories, failures, jokes; the audience wants "this person" | the voiceover is the protagonist and the picture is its emoji sheet: poses snap in 0.1s then freeze; jokes land on a reaction close-up that goes silent | ASL 2.43s (median 1.87s) | pose swap `MO.expoOut` 0.1s + `MO.settle` squash rebound; character 24fps | hard cut `cut`, smash `smash`, whip `whip`, jump-in | `grammar/y4_storytime.md` | `--film demos/y4_storytime` |
| **y5 kinetic type** | lists, "X stages", quotes, number openers, chapter cards | text is the actor: keywords slam in on accents, the main word is large enough to read at a glance, the frame always has one focus | one shot per bar (≈2s at 120 BPM) | `MO.expoOut` entrance, `MO.springHz` slam, exit `MO.expoIn` faster | zoom into a color block `fillZoom`, bands `bands`, page push `push` | `grammar/y5_kinetic_type.md` | `--film demos/y5_kinetic_type` |
| **t1 3Blue1Brown** | one mechanism becoming another step by step: networks, matrices, gradients, probability | on black, only the one thing being explained; Transform turns the previous concept directly into the next; color = concept name, almost no cuts | one animation 1–3s + 1s hold; one concept 8–20s | `MO.smooth` (6t⁵−15t⁴+10t³), used almost everywhere | Transform continuation (no cut), camera through `zoomThrough`, `fadeShift` | `grammar/t1_3b1b.md` | `--film demos/t1_3b1b` |
| **t2 keynote UI** | product/feature launches, updates, tutorial steps, parameter reveals | one thing per screen, product screenshots or physical product as protagonist and pushed into, nouns and numbers landing as spoken; light-spot backgrounds and glass cards are optional, use sparingly | keynote screen 5–8s; product quick cuts 1.5–3s | `MO.spring` bounce 0–0.15, `MO.appleOut` | blur push `blurPush`, card expand `expandRect` | `grammar/t2_keynote_ui.md` | `--film demos/t2_keynote_ui` |
| **t3 finance charts** | revenue, stock price, share, inflection points; numbers the audience will screenshot and fact-check | build the axes first, grow the data next, annotate one thing last; values stay honest — animation only decides how things appear | one chart 2.5–6s | `MO.quintOut`, line `MO.smooth` | panel slide `slidePush`, zoom into detail `zoomThrough` (live + bScale0), hard cut with layout held | `grammar/t3_finance_chart.md` | `--film demos/t3_finance_chart` |

Overview images: `assets/grammar/<grammar>_overview.jpg` (one frame per shot).

Demo commands (from `scripts/`):

```sh
uv run --with playwright python engine/render.py --film demos/y1_kurzgesagt --out y1.mp4            # render demo film
uv run scripts/qa.py --project scripts/engine --film demos/y1_kurzgesagt --out <dir>               # accept (run from the skill root)
# Preview: start a local server and open scripts/engine/index.html?film=demos/y1_kurzgesagt, drag the timeline
```

Demo films are compressed to ~8 seconds, 2.5–3× real-film density, only to show the full grammar in one demo. In real use, slow to the shot lengths in the table above.

---

## 2. How to choose a grammar for one voiceover segment

Look at what the segment is doing, then pick the drawing method. A film may switch grammars between segments but never mixes within one segment.

| The segment is... | Pick | Avoid | Why |
|---|---|---|---|
| Explaining one concept, one mechanism ("how does a neural network...") | **t1 3b1b** (derivations, formulas) or **y1 Kurzgesagt** (scale, cuteness) | y2 (nothing real to paste; it becomes fake archives) | mechanisms read clearly through morphing and scale |
| News, events, history with screenshots and quotes | **y2 Vox** | y1 (flat cartoons dilute credibility) | the audience wants to see the source with their own eyes |
| Your own story, failures, jokes | **y4 storytime** | t2 (carries a "good news" mood) | the joke lives in the reaction shot's pause |
| Lists, key points, stages, one quote | **y5 kinetic type** | t1 (nothing to morph) | the information is structure, not picture |
| Products, tutorial steps, features, parameters | **t2 keynote UI** (screenshot full-frame and push in; glass cards optional) | t1 (glass and light spots carry no logic; the reverse holds too) | one thing per screen, nouns and numbers as protagonist |
| Numbers, growth, trends, comparisons | **t3 finance charts** | t2's big number (only when there is exactly one number) | you need axes and units, and the numbers must survive fact-checking |
| Deriving step by step while narrating | **y3 whiteboard** | a single full-screen switch | write a line as it is said; the pull-out is the landing |

Two fallbacks:
- Real screenshots to show → t2 (tutorials, clean) or y2 (argument, evidentiary). Screenshots are the main picture, as full-frame as possible, always aspect-preserving, never cropping key UI.
- Only one number in a segment → do not draw a chart; use a t2/y5 big number counting up, landing the moment the voiceover speaks the value.

---

## 3. Cross-grammar rules

Rules distilled from the 8 cards that hold across grammars. Sources in parentheses.

1. **The camera depends only on time; the scene redraws per camera vector.** Push, pan, and through-shots are the same world canvas redrawn under a different camera — so a 60× zoom stays sharp, and within a transition the previous shot keeps pushing the camera on time (`zoomThrough`'s `live:true`). (y1 ⑥ "key architecture"; y3 ⑥; t1 ④-2)
2. **Zoom logarithmically; passing through a round opening needs enough magnification.** `CAM.zlerp` magnifies by the same factor each frame; linear interpolation starts slow then jerks. To pass into an opening of radius r, magnification ≥ distance from opening center to the farthest screen corner / r (≈1100/r when centered, `CAM.coverZoom`). (y1 ⑧-2; t1 ④-2)
3. **Align the reveal frame to the beat or the spoken word.** Transitions count from the new section's start, so make the frame where the new picture first shows land on a bar line: section start = bar line − reveal point × transition duration (`MO.onBeat`). Numbers land when the voiceover speaks them: count start = spoken moment − count duration. Whiteboard writing starts ~0.5s after the matching phrase. (y5 ④ "counterpoint tricks"; t2 ⑤; t3 ⑤; y3 ⑤)
4. **Structure first, then data, then annotation.** Axes appear first, data grows next, annotation last; one shot annotates one thing; 3b1b Writes the problem before demonstrating; keynote goes eyebrow → product name → subtitle. (t3 ③; t1 ⑤; t2 ③)
5. **One focus per screen.** At any moment only one thing enters; everything else is still; main word to support line at least 3:1; background saturation, contrast, and stroke width one notch below the protagonist. (y5 ⑧-1; t2 ⑤; y4 ⑧-2)
6. **Slow entrance, fast exit, and a hold after landing.** Entrances 0.3–0.4s, exits ~0.18s; after a number lands, hold at least 0.5s, hold ≥0.9s after a punchline; 3b1b waits ~1s after each animation. (y5 ⑤; t3 ⑧-3; y4 ⑤; t1 ⑤)
7. **Motion on events; the camera comes back.** The camera moves only when the audience's eye wants to go somewhere new: transitions use slow push, glide, pull-out (0.6–1.5s, eased, measured from Vox and 3b1b), punches (0.28s, 18–32% in) and slams (0.17s, 1.55→0.94→1.0) are only for reveals, reversals, and key numbers; after pushing in, pull out or glide away — never three consecutive shots inward. The same move in every shot is PPT, whether it is a uniform slow push (the Nobel-literature film r2: "it feels exactly like a PowerPoint deck") or a punch per shot (the Nobel-economics short: 102 seconds, ~48 pushes, "too many moves, and way too fast, not smooth at all"). Numbers and big words slam onto objects inside the film's world (screens, battery bars, price tags, blackboards), never on a standalone flat-color text card — blind reviewers read such cards like white-background chart inserts: "a PPT page got inserted". Already in the engine: `CAM.track` (camera move table; no move written = slow push), `MO.slam` (element slam), constants in `MO.PULSE`; parameterized clips t2/y1/y2 default highlight to a slow push, and `"camera": "snap"` in the spec's top-level `data` switches to punch; there is no built-in uniform slow push or breathing. The environment layer (Kurzgesagt star twinkle, particles) may move gently forever; storytime is 70% completely still, alive through snap cuts and holds. Art-style speedruns are a different matter — the painting must stay alive (see doc 04). Move table, per-grammar camera register, and when counts are enforced: `shot-language.md`. (y1 ③, ⑧-1; y4 ⑧-1; t2 ③)
8. **Two frame rates: camera smooth, elements stepped.** Vox: camera smooth, paper/highlighter/typing step at 12fps (shoot on twos); storytime: character 24fps, camera 60fps. Everything silky reads like a corporate promo; everything stepped wobbles. (y2 ③, ⑧-1; y4 ③)
9. **Color = concept; few accent colors.** One color carries one concept (a formula's W and its edges both blue); beyond 3–4 semantic colors the audience stops tracking; Vox is black, paper white, one red; whiteboard is black plus one orange. (t1 ⑧-3; t3 ⑧-2; y2 ⑧-3; y3 ⑧-3)
10. **Transitions at breaths and topic changes, never mid-sentence.** Whips cut between two sentences; reaction shots sit in silence; whiteboard pans land on new arguments; Vox hard cuts follow punctuation. (y4 ⑤; y3 ⑤; y2 ④)
11. **Review must check logic and numeric consistency, not just looks.** Caught in the field: "'grew 8.7×' should be 'grew to 8.7× the original'"; after expanding full-screen the count restarted from 0; explaining the hidden layer but connecting to pixels; multipliers must be computable from the numbers on the chart. (t3 revision table; t2 revision table; t1 ⑥)
12. **Real material is the main picture; keep it as-is.** With screenshots, photos, footage, or source text, show them full-frame or near-full-frame, push into the part being discussed, and let code only explain, annotate, and move the camera (`MD.cover` full-frame + focus + push, `MD.print` a print, `MD.label` a black torn-edge label; in parameterized clips, t2's screenshot cards and y2's photos are full-frame or 80–90% of frame by default); screenshots keep aspect and never crop key UI; data changes only "how it appears", never "what it is"; bars always start at 0, and a non-zero axis must be labeled; fabricated data carries a "sample data" badge in every shot, real data never gets it. (t3 ②, ⑧-1; clip contract)

---

## 4. Library quick reference (`scripts/engine/lib/`, already loaded by index.html and clip.html)

| File | Namespace | What it has |
|---|---|---|
| `motion.js` | `MO` | camera-move durations `PULSE` (transitions push/glide/pull, accents punch/pan/slam) / `slamK/slam` (slam 1.55→0.94→1.0) / `pulse` (action progress), `seg/at/anim/step` (12fps stepping), manim `smooth/thereAndBack/rushInto/rushFrom/doubleSmooth/wiggle/lagged`, `sineInOut/cubic*/quart/quint/expo*/backOut/elasticOut`, `bezier` and `appleOut/emphasized/k75/easyEase/longTail`, SwiftUI `spring/smoothSpring/snappy/bouncy`, `springHz/settle`, `float`, `invert` (easing inverse), `beat/onBeat` (bar alignment). Canvas sizing `U.setStage/onStage` lives in `util.js` |
| `camera.js` | `CAM` | `apply/with`, `toScreen/toWorld`, `zlerp` (log zoom), `coverZoom`, `anchor`, `pushTo` (push to a point; the point glides to center or zooms in place), `at` (keyframes, pan along a path), **`track` (camera move table: `push` slow push (default) / `pull` pull out / `glide` find next thing / `to` push to a given camera / `punch` fast push / `pan` fast pan / `slam` whole-frame slam / `shake` shake / `cut` hard cut — computed only from t)**, `layer` (parallax), `velocity/motionBlur` (whip blur), `drift` (handheld micro-drift, only for art styles and pure mood shots) |
| `diagram.js` | `DG` | point lists `cum/len/pointAt/drawPartial` (trace stroke by stroke) / `xform/arcPts/ellipsePts/hand` (hand-drawn wobble) / `revealMask/zigzag` (Reveal), Transform `rectPts/circlePts/morph/shape`, colors `mix/mixA/rgba`, 3b1b palette `MANIM` (×1.5 saturated) / `saturate`, `math/write` (manim Write, outline first then fill), `neuron/edgeEnds/edge/flash`, `indicate/circumscribe/brace`, whiteboard `board` (stroke timeline + inter-stroke glide), `pen` (marker) |
| `typo.js` | `TY` | `text/width/font`, `wrap/fit` (wrapping; `fit` shrinks until it truly fits: lines ≤ maxLines and every measured line fits, even a single long English word; `soft:true` returns `ok:false` when it does not fit, so you can change plans; `balance:true` balances multi-line lengths), `charsIn` (per-character rise), `rise` (mask rise), `pop`, `blurIn` (emerge from blur), `typed/typedCount` (typing), `marker/underline`, `slam` (keyword slam), `keyword/keywordMarker` (keyword emphasis), `fmt/count/tabular` (counting and tabular figures) |
| `chart.js` | `CH` | `lin/ticks`, `grid/xLabels` (axes first), `bars` (grow from 0 + synced count + highlight/dim), `line/yAt`, `candles`, `callout` (point → leader → text), `tag/demoBadge/frame` (Economist layout) |
| `ui.js` | `UI` | `mesh` (light-spot background), `grainTex`, `backdrop`, `shadow`, `glass` (frosted card), `sheen` (light sweep), `persp` (fake 3D), `icon`, `rr/rrPath/scratch` |
| `collage.js` | `CL` | `paperTile/fillPaper` (paper texture), `tornEdge/tornRect` (torn edges), `halftone/photo` (halftone photos), `placed/shadowed/slideIn` (tilted slide-in that flattens), `tape/pin`, `stringPts/string` (red thread), `highlight` (rough-edge highlighter), `stickerEdge` (paper-cut white edge) |
| `media.js` | `MD` | real material as subject: `cover` (full-frame, focus `fx/fy`, push `z`, crop `crop`, `fit:'contain'` shows the whole thing uncropped), `toScreen` (point/box on an asset → screen coordinates), `focusFor/zoomFor` (how much zoom a target needs), `print` (print/polaroid: white border, aged paper, shadow, tape), `label` (black torn-edge label, 12fps typing), `frameAt` (frame from a sequence), `size`. Missing assets always error — never a blank frame |
| `toon.js` | `TOON` | `flat` (two-tone faceting), `glow/vgrad/circle/ellipse`, `bean` (bean character, for demo films and white-model rehearsals only — never in finished films; parameterized clip y4 no longer calls it) and `LOOKS/look`, `POSES`, `poseAt` (pose-to-pose + rebound), `blinkAt`, `alive`, `env/mouth` (lip sync from envelope), `sweat/mark` |

Transitions live at the end of `transitions.js` under "transitions for the YouTube explainer grammars": `same / lensReveal / matchCut / whip / smash / fillZoom / bands / push / zoomThrough / blurPush / expandRect / slidePush / fadeShift`, each with one line of description and parameters. Hard cuts use the original `cut`.

Small engine changes relevant here: portrait whole films with `render.py --film <name> --width 1080 --height 1920` (or set `window.FILM_SIZE = [1080, 1920]` in eras.js); engine, transitions, camera, and libraries all compute against the current canvas — the 35 art-style scenes were only ever drawn landscape; a section's `clip` (video frame sequence) fills the frame by default, or write `clipDraw(c, frame, lt, t)` to place it yourself (push, focus, print); missing frames or images error out and refuse to render; sections may write `dur` (seconds) instead of `eighths`; `window.BPM` changes the beat; explainer films set `window.PUNCH = 0` to disable beat impact (or per-transition `punch`); `window.SCENE_LIBS / SCENE_DIR` let one film keep its code in its own directory (that is how demos are organized).

**Experiment-era old names → current names** (for reading archived experiment code): `YT.camAt→CAM.at`, `YT.camForAnchor→CAM.anchor`, `YT.apply/camera→CAM.apply/with` (camera fields `zoom/rot` became `z/r`), `YT.ease.*→MO.*`, `YT.spring(t,f,d)→MO.springHz`, `YT.textIn→TY.charsIn`, `YT.type→TY.typed`, `YT.partial→DG.drawPartial`, `YT.at→DG.pointAt`, `YT.circlePts→DG.ellipsePts`, `YT.paperTile/halftone/tornEdge→CL.*`, `YT.bean/POSES/mouth→TOON.*`, `MN.*→DG.*` (`lerpPts→morph`, `C→MANIM`, `FONT_RM→FONT.rm`), `GL.*→UI.*`, `MO.textIn→TY.blurIn`, `MO.count/fmt/tabular→TY.*`, `easeOutQuint/easeOutExpo→quintOut/expoOut`, transitions `k_lens→lensReveal`, `k_fill→matchCut`, `hardcut→cut`, and y5's `zoomThrough→fillZoom` (a name clash with 3b1b's camera-through).

Fonts: Chinese sans uses `PuHui-Medium/Bold/Heavy/Black` (the open-source build actually ships Noto Sans SC 500/700/800/900 under the original family names; see `lib/fonts.js`), whiteboard uses `LXGWWenKai-500`; both are subsets of the full GB2312 6,763 hanzi set, so new subjects rarely need re-subsetting. Formulas use `CMU-rm/it`, keynote `Inter`, finance numbers `RobotoCondensed`. `NotoSansSC/NotoSerifSC` contain only the characters used by the three demo films — do not use them for new content.

---

## 5. Clip contract (for a voiceover pipeline's "animated segments")

The voiceover video pipeline (whichever you use) calls these 8 grammars for animated segments; the pipeline acts as director, choosing grammar and computing cues from word-level voiceover timestamps. This section is the contract between both sides.

### Entry point

**Wrap a script around this inside the pipeline; do not hand-type the steps below**: draft takes duration from the film timeline, emits the word list and a spec draft → render parses words, calls this section's render.py, counts frames, swaps into the edit project, freezes → verify checks each chapter's frame sync. The author's own pipeline is wired this way (that part is not open-sourced with this repo). Below is the engine's own interface.

```sh
cd <skill>/scripts
uv run --with playwright python engine/render.py --spec clip.json --out clip.mp4            # silent H.264 yuv420p
uv run --with playwright python engine/render.py --spec clip.json --alpha --out clip.mov    # ProRes 4444 with alpha (no background, for pipeline compositing)
uv run --with playwright python engine/render.py --spec clip.json --stills 0.5,2,4 --out stills/   # extract frames to check
# Preview: local server, open scripts/engine/clip.html?spec=examples/t3_finance_chart.json, drag the timeline
```

- Duration strictly equals `duration`: frames = round(duration × fps), frame i's time is i / fps. H.264 gets one keyframe per second (GOP = fps), so pipeline renderers can seek per second without freezing.
- **A single clip lasts at most 8 seconds.** When `duration` exceeds 8 seconds render.py prints one loud warning at the start and one at the end, without erroring (the pipeline has legitimate long clips). A clip that runs too long reads as a PPT page: one layout to the end, bullets piling up, a background dead from start to finish. A film is split into shots, one spec per shot (or one scenes section), shots changing composition but not style (one theme, at most 2 grammars), then concatenated (SKILL.md track lane steps 3–4, `references/shot-list-template.md`). Some sample specs run 8.5–10 seconds — they demonstrate how one segment is written, not how long a film is.
- **One palette for the film: `theme`.** Every spec in a film writes the same `"theme"`: a palette name `paper`, `poster`, `ink`, `navy`, `bauhaus`, `snow`, `wood`, `chalk` (values in `references/palettes.md`), or an object `{"name": "wood", "accent": "#B8452A"}` overriding one or two keys, or a full 6-key `{bg, surface, ink, sub, accent, accent2}`. A wrong name, an object missing keys (with no `name`), or non-#hex values → startup failure. Grammars that honor theme do not paint large gradient backgrounds or neon glows; auxiliary colors all derive from these 6. Without a theme, each grammar uses its own default (y1 defaults to flat deep ink — no longer a deep-purple starfield). t3 additionally accepts the legacy `"light"`, `"dark"`, and its own theme object; `"paper"` now means the paper palette.
- Width/height and fps come from the spec, default 1920×1080@30; portrait is `width: 1080, height: 1920` (or command line `--width 1080 --height 1920` overrides the spec); every grammar has portrait layout.
- Asset paths in a spec are relative to the spec file (absolute paths also work); render.py serves only files the spec names. Recognized fields: `cues[].image`, `cues[].frames` (video frame sequences: one directory or a path array), `data.image`, `data.character` (y4 frame library directory). Path resolution: `engine/spec_assets.py`.
- Measure a clip: `uv run qa.py --spec <clip.json>` (from `scripts/`; treats the clip as one segment measuring determinism, motion, still-frame pairs, isolated jumps, elapsed time; portrait scales with frame size; monotone smooth push/pull/glides and slams under 2 seconds count as camera events, not jumps).
- Deliver: `uv run deliver.py clip.mp4 --spec <clip.json> --out output/`. The gate `film_gate.py` runs first (fast-motion frame share < 0.035 red; an empty-frame run of 0.3s or more in the middle is red no matter how short the clip; no copy, nonzero exit). On pass it copies and writes `delivery-notes.md` with the facts section written by the script. The gate was calibrated on 1–2 minute films — numbers are noisy on clips ≤10s; if the clip will be concatenated into a film, run deliver.py on the film.
- Page errors (a grammar file failing, missing image or video frames) → nonzero exit, no output. `qa.py --spec` and render.py share asset resolution (`engine/spec_assets.py`), including `frames` and character frame libraries. Hanzi missing from the bundled subset only warn (they fall back to system fonts and may change on another machine); common characters are all in the subset.

### spec

```json
{
  "grammar": "t3_finance_chart",          // pick 1 of 8: t1_3b1b | t2_keynote_ui | t3_finance_chart | y1_kurzgesagt | y2_vox | y3_whiteboard | y4_storytime | y5_kinetic_type
  "duration": 7, "fps": 30, "width": 1920, "height": 1080,
  "safe": { "top": 0, "bottom": 520 },     // optional: margins to keep clear (px), see below
  "alpha": false,                          // optional: true = no background drawn (render.py --alpha sets it automatically)
  "theme": "wood",                         // every spec in a film writes the same: palette name or object, see "one palette for the film"
  "data": { ... },                        // grammar-level parameters; recognized fields per grammar below; unknown fields are ignored
  "cues": [ { "at": 1.2, "kind": "bar", "text": "...", "sub": "...", "data": { ... }, "image": "screenshot.png", "dur": 1.0 } ]
}
```

**Common cue fields** (which grammar reads what is listed per grammar below):

| Field | Meaning |
|---|---|
| `at` | seconds, required. "The reveal frame": the element first becomes visible at t = at (animations count internally from the frame before at). Exception: for `number`, at is when the number **lands**. Cues need not be sorted; clip.js sorts them; cues with at beyond duration are warned and dropped (invisible, no layout cost). |
| `kind` | required. **An unrecognized kind does not error and draws nothing** — write against the table below. |
| `text` | main text: title, bullet, label, bubble source line, insert-shot big text. |
| `sub` | support text: t2 card caption, y5 support line, y4 the short line actually shown in the bubble, y4 the line he types in the insert. |
| `image` | image path, relative to the spec file (absolute paths, `data:`, `http(s):` also work). Missing file → refuses to render. |
| `frames` / `fps` / `loop` | video frame sequence (t2 screenshot cards, y2 photos): one directory (png/jpg/webp sorted by name) or a path array; plays from at at `fps` (default 30), freezes on the last frame, `loop: true` to loop. Layout is set by the first frame. Missing frames → refuses to render. |
| `data` | this cue's own parameters (`index`, `rect`, `icon`...), per grammar below. |
| `dur` | only a few kinds read it: t1's title/point/equation/line, t3's bar/line/candle, y1's enter, y4's react/insert. Written elsewhere it is ignored. |

**`safe`**: `{top, bottom, left, right, fill?}` (px, default 0). clip.js passes it, plus the cleared content box `ctx.box = {x, y, w, h}`, to the grammar; `fill` is an optional color painted over the cleared margins after render (in portrait films this makes the chart a "card" in the same position and base as neighboring contain screenshots; not painted under `--alpha`). **All 8 grammars honor `top` / `bottom`** (each grammar object declares `safe: true`, content is laid out only within top..H−bottom: t3's axes and source line, y2's camera zoom and picture center, t1/t2/y1/y3/y5's layouts, y4's bubbles and insert big text); **no grammar currently lays out against `left` / `right`** — those only get `fill` painted while content still sits at the edges. Portrait 1080×1920 voiceover films burn subtitles around 1400–1520, so `bottom` 490–570; landscape usually `bottom` 160–220. To add safe support to a new grammar, follow t3: add `safe.top` to vertical layout baselines, subtract `safe.bottom` from bottom elements, or lay out directly against `ctx.box`, and declare `safe: true` on the grammar object (if a spec supplies safe and the grammar did not declare it, clip.js console.warns).

**`number` (big number) rules** — only t2, t3, y5 honor it; the other 5 ignore it:

| Item | Rule |
|---|---|
| Value | `data.value` (a number, may be negative; defaults to 0). Counts from 0 to value (expoOut, fast then slow); negatives use a true minus sign "−"; thousands separators added automatically. |
| Format | `data.prefix` (e.g. `"¥"`), `data.suffix` (e.g. `"%"`, `" million"` — write spaces yourself), `data.decimals` (default **0**; t3's `spec.data.decimals` governs only bar labels — **number does not inherit it**, restate decimals in the cue). |
| Caption | write any of `text`, `sub`, `data.text`; clip.js unifies them. |
| Small label | `data.label`: t2 draws it above the number, y5 top-left of the page; t3 does not draw it. |
| Timing | `at` = the moment the number lands. t2 and t3 start counting at at−0.9s; y5 turns the page and starts counting at at−0.7s. So number's at must be ≥0.9 (y5 0.7), or frame 0 already shows most of the count. |
| Position | t2: its own screen; the previous screen exits starting at−0.9s, not stacked on a card; t3: a reserved strip above the chart area, right-aligned, caption left of the number; y5: its own page. |

### Cues per grammar

Each section below lists spec-level `data` on the first line and cues in the table. The "minimal spec" is the least that renders a decent segment — copy the structure, swap content for your subject; the first cue is always a picture event, not a title.

#### t1_3b1b (3b1b / manim explainer: formulas, curves, points)

spec-level data: none.

| kind | Fields | Notes | Example |
|---|---|---|---|
| `title` | `text`, `data.color`, `dur` | Writes from at; a new title shifts the old one up and fades it; shrink font first, then wrap to two lines. Not for openers — frame 0 shows an object first | `{"at":4,"kind":"title","text":"Attention is a weighted average"}` |
| `equation` | `data.tokens` or `text`, `dur` (first 1.2s, then 1.5s) | token: `{s, it?, col?, gap?, sub?, sup?, size?}`, `col` as manim color names (`BLUE_C` `YELLOW` `GREEN_C` `TEAL_C` `RED_C`…) or #hex. With only text, auto-splits: single letters italic, consecutive letters (softmax) upright. From the second onward it Transform-continues from the previous | `{"at":1,"kind":"equation","text":"softmax(QK)V"}` |
| `point` | `text`, `dur` | One line per point, Written; new points gray the old. If space runs out: first let the curve yield (portrait 50%→30%), then shrink font (≥0.6×), and only then roll the whole block up as the newest point arrives, fading the oldest (warns) | `{"at":3,"kind":"point","text":"Compute similarity first"}` |
| `line` | `data.values` (evenly spaced y) or `data.points` (`[[x,y],…]`), `text` = curve label, `data.color`, `dur` | Axes are Created first, then the curve is drawn; from the second line onward it morphs from the previous. With a line present: landscape text left/chart right, portrait chart top/text bottom | `{"at":2,"kind":"line","text":"Loss","data":{"values":[9,5,3,2,1.5]}}` |
| `highlight` | `data.index` (which point, 0-based, default newest) or `data.target:"equation"` | Indicate + yellow box held | `{"at":5,"kind":"highlight","data":{"index":0}}` |

Minimal spec:
```json
{"grammar":"t1_3b1b","duration":6,"cues":[
  {"at":0,"kind":"line","text":"Weight of each word","data":{"values":[1,2,7,2,1]}},
  {"at":1.6,"kind":"equation","text":"softmax(QK)V"},
  {"at":3.4,"kind":"point","text":"Similar words get larger weights"},
  {"at":4.6,"kind":"highlight","data":{"target":"equation"}}]}
```

#### t2_keynote_ui (keynote-style UI: feature cards, screenshot cards, big numbers)

spec-level data: `eyebrow` (small text above the title), `title`, `subtitle`, `accent` (accent color, default `#3d6bff`), `frame` (screenshot-card packaging: default `"full"` full-frame; `"glass"` is the legacy frosted card — optional, use sparingly).

| kind | Fields | Notes | Example |
|---|---|---|---|
| `title` | `text`/`sub` override data.title/subtitle | Emerges from blur from at. Not for openers — show a screenshot or number first | `{"at":5,"kind":"title"}` |
| `card` / `step` / `image` (synonyms) | `text` card title, `sub` caption, `image` screenshot; `data.step` sets the number; image-less cards may add `data.icon` (`wave memory agent clock phone layers chart code check play bolt lock`), `data.value/prefix/suffix/decimals/label` (on-card counter) | With an image (default `frame:"full"`): one per screen, screenshot laid full-frame (aspect kept, uncropped; `data.fit:"cover"` crops to fill using `data.focus:[fx,fy]`), surrounded by a darkened blurred copy of the same image; `text`/`sub` are black torn-edge labels at the bottom-left; hard-cuts in at the at frame (0.17s light slam); when the previous screen was also a full-frame screenshot, glides across at the same magnification for 0.30s. `data.frame:"glass"` uses the legacy glass card. Also reads `frames` (screen-recording frames). Without an image: up to 3 consecutive cards side by side on one screen | `{"at":2,"kind":"card","text":"Image from one sentence","sub":"No prompt writing","data":{"icon":"bolt"}}` |
| `highlight` | `data.rect=[x,y,w,h]` (relative to the screenshot 0..1), `text` optional label, `data.fill` (the framed share of frame after push, default 0.42) | Frames a region of the current screenshot and darkens the rest; in full-frame mode the camera pushes there too (at least 18% in, at most 2.6×; default slow push 0.9s, spec top-level `data.camera:"snap"` gives a 0.28s punch); the next highlight on the same image glides there (default 0.7s, snap 0.30s) | `{"at":5,"kind":"highlight","data":{"rect":[0.6,0.2,0.2,0.1]}}` |
| `number` | see the number rules above; `data.over: true` | Its own screen. With `data.over: true` and a full-frame screenshot before it: no new screen — the camera pulls back to the whole screenshot, the screenshot darkens, and the number slams on top counting up — use it when the number is about that very screenshot, not a light-spot background | `{"at":4,"kind":"number","text":"Monthly active users","data":{"value":1.2,"decimals":1,"suffix":" million"}}` |

Minimal spec:
```json
{"grammar":"t2_keynote_ui","duration":6,"cues":[
  {"at":0.9,"kind":"number","text":"Monthly active users","data":{"value":1.2,"decimals":1,"suffix":" million"}},
  {"at":2.4,"kind":"card","text":"Voice input","sub":"Turns speech into text","data":{"icon":"wave"}},
  {"at":3.6,"kind":"card","text":"Long-term memory","sub":"Remembers what you said last time","data":{"icon":"memory"}}]}
```
This is the image-less form. With a product screenshot, lead with a screenshot card (`{"at":0,"kind":"card","image":"screenshot.png","text":"…"}`, see `examples/t2_keynote_ui.json`; two real screenshots full-frame + push + glide, see `examples/t2_fullbleed_pulse.json`).

#### t3_finance_chart (Economist-style data charts)

spec-level data: `title`, `unit` (subtitle: metric and unit; shrink first, then wrap to two lines), `source` (bottom-left source; same fitting, and it clears the bottom-right badge), `badge?` (bottom-right badge drawn only if written, e.g. "sample data"; never on real data), `chart: "bar"|"line"|"candle"`, `series: [{label, value, color?}]` or candles `[{label, o, h, l, c}]`, `decimals` (bar/point labels, default 1), `prefix`, `suffix`, `highlight: {index, text, sub}`, `colors: {main, accent, dim}`, `upDown: "cn"` (red up, green down — default) `|"us"`, `xAxis: "category"|"time"` (bars name every category by default; lines/candles thin by time by default), `theme` (may also be written at spec-level `theme`): `"light"` (white background, default) `|"dark"` (dark background, light text), the eight palette names (`"paper"` is now the paper palette) or `{bg, ink, sub, grid, bar, dim, red…}`; with no theme but `safe.fill` set to the film's background, the chart uses it, switching to dark background + light text automatically.

**Keep chart shots inside the film's world**: the chart's background stays in the same color family as the shots before and after (dark films use `theme:"dark"` or put the film's background into `safe.fill`); a white-background report belongs only in films that are already white paper or web pages. Better: draw the chart onto an object in the film's world — `--alpha` gives a transparent clip to paste onto a screen, blackboard, or sheet of paper inside the film. Suddenly cutting to a white-background line chart with a fixed title row inside a night scene gets "disconnected from the whole film" in review.

| kind | Fields | Notes | Example |
|---|---|---|---|
| `title` | — | When the layout (title, subtitle, source) appears. Optional: without it, the layout appears with the axes at second 0 | `{"at":0,"kind":"title"}` |
| `bar` / `line` / `candle` | `dur` (default scales with count); bars may be written as several bar cues, each with `data.index` (number or array) = these bars grow at this moment | Axes → data grows. Bars always start at 0; if a line/candle y-axis does not start at 0, the subtitle gains "y-axis does not start at 0" automatically; negative bars write their value below the bar base and annotations walk downward; if category names do not fit, shrink then stack two lines; the annotated bar always keeps its name; ticks round to the step's decimal places | `{"at":1.2,"kind":"bar"}` |
| `highlight` | `text`/`sub` override data.highlight, `data.index` which bar | At the at frame the annotation dot pops, leader + text; if a slanted position would cover other bars or values, move directly above that bar — if the top has no room, one extra tick is added automatically | `{"at":4,"kind":"highlight","data":{"index":2},"text":"Highest"}` |
| `number` | see the number rules above | A reserved strip above the chart area, never covering a line head | `{"at":5,"kind":"number","text":"Latest close","data":{"value":259.97,"prefix":"¥","decimals":2}}` |

Minimal spec:
```json
{"grammar":"t3_finance_chart","duration":6,"data":{"title":"R&D spend at three companies","unit":"2024, RMB 100M","source":"Source: sample data","badge":"Sample data","chart":"bar",
  "series":[{"label":"A","value":120},{"label":"B","value":86},{"label":"C","value":43}]},"cues":[
  {"at":0.3,"kind":"bar"},{"at":3.5,"kind":"highlight","data":{"index":0},"text":"Largest"}]}
```

#### y1_kurzgesagt (flat science: center object + satellite nodes + scale traversal)

spec-level data: `center` (the first layer's center object name), `center_style: {color, shape: "circle"|"rounded"|"hex"|"diamond", ring: true}` (when absent, a neutral style is generated from the name: color and shape derive from the text, same name same style, no orbit ring), `image` (crops a real image into the center object, the name moving into a capsule below), `flow: true` (nodes chained in sequence with signals flowing through, numbered — for "what happens first"). The environment layer (star twinkle, particles, signal pulses) moves gently forever; the center object, nodes, and labels hold after landing; the camera does not slow-push.

| kind | Fields | Notes | Example |
|---|---|---|---|
| `title` | `text` | Top title rises per character; fades over 0.5s starting at the first highlight or enter's at. Not for openers — frame 0 shows a node first | `{"at":1,"kind":"title","text":"What one search goes through"}` |
| `point` | `text`, `data.color` | One satellite node + label capsule of the current layer. ≤3 sit on the upper arc, ≥4 wrap a full circle. Labels are clamped into frame per the current shot; long labels shrink first | `{"at":1.4,"kind":"point","text":"Tokenize"}` |
| `highlight` | `data.index` (counts only the current layer's points, 0-based, default newest) | Pushes to that node (~30%; default slow push 0.9s, spec top-level `data.camera:"snap"` gives a 0.28s punch) and dims the rest; when already pushed, the next highlight glides over at the same magnification | `{"at":5,"kind":"highlight","data":{"index":1}}` |
| `enter` | `data.index` (which node to enter, default newest), `text` (new center name, defaults to the node name), `data.style` (the new center's center_style), `dur` (default 1.6) | Scale traversal: the push starts at the at frame, around at+0.55×dur the screen is fully one color and switches to the new layer, and at+dur the new center object has pulled out; subsequent points belong to the new layer (the first new point's at goes after at+dur) | `{"at":4,"kind":"enter","data":{"index":0},"text":"Tokenizer"}` |

Minimal spec:
```json
{"grammar":"y1_kurzgesagt","duration":6,"data":{"center":"Search engine"},"cues":[
  {"at":0.3,"kind":"point","text":"Crawl"},{"at":1.1,"kind":"point","text":"Index"},
  {"at":2.2,"kind":"enter","data":{"index":1},"text":"Inverted index"},
  {"at":4.2,"kind":"point","text":"word → page"}]}
```

#### y2_vox (collage desk: screenshots, clippings, red lines, highlighter)

spec-level data: none.

| kind | Fields | Notes | Example |
|---|---|---|---|
| `image` / `clip` (synonyms) | `image` or `frames` (video frames), `text` = the black torn-edge label pressed at the bottom-left (12fps typing), `data.halftone: true` converts to grayscale halftone, `data.fit:"cover"` + `data.focus` + `data.aspect` crop to fill by focus | Slides onto the desk from at; arrives as a print (white border, aged paper, shadow, tape), aspect kept by default. When the camera rests on one, it fills 80–90% of frame. Landscape lays left→right, portrait top→bottom; the red line is traced first, and the camera glides there 0.30s before at | `{"at":1,"kind":"image","image":"screenshot.png","text":"Homepage"}` |
| `title` | `text` (empty or whitespace-only warns and is skipped) | Black-background white-text label bar, typing 13 chars/sec. Good for a closing thesis, not an opener | `{"at":5,"kind":"title","text":"This event has three leads"}` |
| `point` | `text` | Horizontal-thread index card, typed (short gaps speed up to at most 40 chars/sec) | `{"at":4,"kind":"point","text":"Published a day before the announcement"}` |
| `highlight` | `data.rect=[x,y,w,h]` (relative to **the current image** 0..1; with `fit:"cover"`, relative to the cropped frame) | Highlighter sweeps → red circle → camera pushes there (default slow push 0.9s, spec top-level `data.camera:"snap"` gives a 0.28s punch; when the box starts off-screen the camera glides first and arrives one frame before at). Eyeballed rects are often off 20–30% — check with `--stills` first | `{"at":2.5,"kind":"highlight","data":{"rect":[0.1,0.2,0.3,0.1]}}` |

Minimal spec (y2 needs real material: with no screenshots, photos, or source text to paste, do not pick y2 — see section 2):
```json
{"grammar":"y2_vox","duration":6,"cues":[
  {"at":0,"kind":"image","image":"screenshot.png","text":"Official announcement"},
  {"at":1.6,"kind":"highlight","data":{"rect":[0.1,0.2,0.3,0.1]}},
  {"at":4,"kind":"point","text":"Two weeks later the site changed its price"}]}
```

#### y3_whiteboard (whiteboard hand-drawn: write a line as it is said, draw icons, circle the point)

spec-level data: none.

| kind | Fields | Notes | Example |
|---|---|---|---|
| `title` | `text` | Starts at 7.5 chars/sec, speeds up automatically when the next cue nears. Not for openers — the first stroke is drawn first | `{"at":4,"kind":"title","text":"Why write tests"}` |
| `point` | `text` | Draws a small circle as the bullet first, then writes, from 16 chars/sec | `{"at":1.5,"kind":"point","text":"Someone watches your code as you change it"}` |
| `draw` | `data.icon` (`person cat network doc chat bulb check cross screen stack gear target clock chart`; a wrong name warns and only the caption is written), `text` = caption under the icon (shrinks first when tight), `data.arrow: false` omits the arrow | Sits beside the line just written; consecutive draws are chained with orange arrows | `{"at":2.5,"kind":"draw","text":"Automated checks","data":{"icon":"check"}}` |
| `image` | `image` | Zigzag reveal + hand-drawn frame, aspect kept | `{"at":4,"kind":"image","image":"sketch.png"}` |
| `highlight` | `data.index` (which one, 0-based), `data.target`: `"title"` / `"draw"` / `"image"` (default counts points), `data.style: "underline"` | Orange circle or underline; without index = the line written most recently | `{"at":5,"kind":"highlight","data":{"index":0,"style":"underline"}}` |

Minimal spec:
```json
{"grammar":"y3_whiteboard","duration":6,"cues":[
  {"at":0,"kind":"draw","text":"Automated checks","data":{"icon":"check"}},
  {"at":1.4,"kind":"point","text":"Someone watches your code as you change it"},
  {"at":3.0,"kind":"draw","text":"Refactor without fear","data":{"icon":"gear"}},
  {"at":4.6,"kind":"highlight","data":{"target":"draw","index":0}}]}
```

#### y4_storytime (bean character storytelling: bubbles, reaction close-ups, inserts)

spec-level data: `character` — **must be your own frame library** (AI-generated frames, see `references/10-characters.md`, delivery line in `references/character-fidelity.md`); the code-drawn presets (`neutral`/`bun`/`author`) and style objects are retired — with or without them, startup fails. Without image generation, do not use y4: switch to y2/y5 or scenes that tell the story with hands and objects. The frame library takes one directory (render.py uses file names without extension as pose names: `rest talk point shrug type stiff react back`, `<pose>_open` is the open-mouth frame) or `{"frames": {"talk": "me/talk.png", …}}`; frames are transparent-background, feet centered at the image's bottom edge, and at least `rest` or `talk` is required. The camera holds and the character does not breathe; change comes from snap cuts, reaction close-ups slamming in, and inserts. With `window.VO_ENV` the lip sync follows the voiceover envelope, otherwise it synthesizes from character counts. safe clears only text (bubbles, insert big text); the character, desk, and reaction close-up face are graphics and will reach into the subtitle band in portrait — subtitles pressed over the body stay readable, but do not expect them to yield.

| kind | Fields | Notes | Example |
|---|---|---|---|
| `point` / `title` (synonyms) | `text` = the spoken line (sets mouth-open duration, ≈6.5 chars/sec), `sub` = the short line actually shown in the bubble (≤12 chars best; shown only when written), `data.pose`: `talk` / `point` / `shrug` / `type` | The bubble pops and the mouth starts at the at frame | `{"at":0.1,"kind":"point","text":"I asked it to fix a typo for me,","sub":"just one character"}` |
| `highlight` | `data.mark` (default "?") | "?" "!" pops + worried shrug | `{"at":4,"kind":"highlight","data":{"mark":"!"}}` |
| `react` | `dur` (from at, default to the next cue) | Jumps to the big reaction close-up: dead-fish eyes + sweat drop, speechless | `{"at":3,"kind":"react"}` |
| `insert` | `sub` = the line he types on the computer (wraps, at most 3 lines), `text` = the big text that slams in, `data.hit` (**absolute seconds**, default at+1.3, or at+0.4 without sub), `data.count` + `data.unit` (the top-right counter stops at this number when the text slams), `data.app` (window title, default "AI Assistant"), `dur` (from at, default to the next cue) | Cuts to the desk monitor close-up: typing → replies scroll faster and faster like a code wall → big text slams | `{"at":2,"kind":"insert","sub":"Fix a typo","text":"Changed 40 files","data":{"hit":3.4}}` |

Minimal spec:
```json
{"grammar":"y4_storytime","duration":6,"cues":[
  {"at":0.1,"kind":"insert","sub":"Fix one typo","text":"Changed 40 files","data":{"hit":1.5}},
  {"at":2.6,"kind":"react"},
  {"at":4.0,"kind":"point","text":"I only asked it to change one character.","sub":"just one character"}]}
```

#### y5_kinetic_type (kinetic text: one cue per page)

spec-level data: `palette: [[background, text], …]` (rotated per page).

| kind | Fields | Notes | Example |
|---|---|---|---|
| `title` / `point` | `text` main word (shrinks automatically when long, at most two lines), `sub` support line, `data.label` (small top-left label), `data.key` (the word inside the support line to color), `data.num` (giant background number) | The main word slams in at the at frame; page turns are band wipes (starting 0.3s before at). Two or more points = a list: draws a progress track + giant background numbers | `{"at":1.8,"kind":"point","text":"Slow","sub":"change one thing at a time","data":{"label":"01","key":"one thing"}}` |
| `number` | see the number rules above | One page, one big number | `{"at":4,"kind":"number","sub":"First-pass success rate","data":{"value":87.5,"decimals":1,"suffix":"%"}}` |
| `highlight` | `data.word` (a word inside the main word; without it, sweeps the whole main word) | Highlighter + a quick scale-up; when the highlighter matches the text color (yellow text on deep blue), the highlighted word inverts to the background color. A word not in the main word warns and does nothing (words in the support line use `data.key`) | `{"at":3,"kind":"highlight","data":{"word":"Slow"}}` |

Minimal spec:
```json
{"grammar":"y5_kinetic_type","duration":5,"cues":[
  {"at":0.7,"kind":"number","sub":"First-pass success rate","data":{"value":87.5,"decimals":1,"suffix":"%"}},
  {"at":2.2,"kind":"point","text":"Slow","sub":"change one thing at a time","data":{"key":"one thing"}},
  {"at":3.6,"kind":"highlight","data":{"word":"Slow"}}]}
```

### Samples (`scripts/engine/examples/`)

```sh
cd <skill>/scripts
uv run --with playwright python engine/render.py --spec engine/examples/t3_finance_chart.json --out t3.mp4   # NVIDIA five fiscal years of revenue (real 10-K data): bars grow in three passes, each on a word
uv run --with playwright python engine/render.py --spec engine/examples/t2_keynote_ui.json   --out t2.mp4   # screenshot card opener + framed number, portrait screenshots, then one big number
uv run --with playwright python engine/render.py --spec engine/examples/t1_3b1b.json         --out t1.mp4   # gradient descent: loss curve first, formula morphs, curve morphs
uv run --with playwright python engine/render.py --spec engine/examples/y2_vox.json          --out y2.mp4   # screenshot opener pasted on the desk, highlighter + red circle + push, closing label thesis
uv run --with playwright python engine/render.py --spec engine/examples/y3_whiteboard.json   --out y3.mp4   # whiteboard: draw first, then write, icons and lines alternating, ending circled on the first drawing
uv run --with playwright python engine/render.py --spec engine/examples/t2_fullbleed_pulse.json --out t2b.mp4   # two real terminal screenshots full-frame: push to the timer, glide to the second, pull back to the whole screenshot, number slams to close (number's data.over)
# Also: y1_kurzgesagt (a drop of seawater → into one diatom) / y4_storytime (screen close-up opener) / y5_kinetic_type (number slam opener); any sample adds --width 1080 --height 1920 for portrait; sample assets in examples/assets/: the three charts are t3's own rendered final frames (numbers landed, no playback bar, no paths), the two terminal screenshots are captures of real python3 -m timeit output
# Samples teach the writing: do not copy their subjects, compositions, or assets into your film
```

### Reminders for the pipeline director

- Do not stuff one segment with too many cues: per section 1's shot lengths, 2–5 cues in a 3–8 second segment is comfortable; too dense and the writing speeds up unwillingly and the camera cannot arrive in time.
- **Three baselines for writing specs** (slideshow PPT mostly comes from violating these): the first cue is a picture event (curve, screenshot, data growing, zoom-in, icon, screen close-up, number slam), not a second-0 title; text cues (title, point) are no more than half, and the same kind never appears 3 times in a row; every on-screen `text`/`sub` is ≤14 characters, spoken lines go to subtitles (y4's `text` only sets mouth timing and does not display when `sub` is written, so it is exempt).
- Grammars that draw text (t1/t3/y3/y5) compete with the pipeline's burned subtitles for attention; when compositing, move subtitles away or do not burn them over this segment.
- Transparent mode (`--alpha`) removes only the background layer; element shadows remain; y2's paper pieces and t2's glass cards read as "cards floating over the picture" on transparent backgrounds. On transparent t3, text carries a glow of the theme's background color (default white paper/black text = white glow; `theme:"dark"` = light text, dark glow), so it stays readable over other footage; t1's white text carries a dark glow.
- **Portrait screenshots: frame the half-sentence the voiceover is speaking.** On a portrait desk a screenshot is ~900px wide, and 16px web body text needs a 2–2.5× push to read; framing a full-width passage (box near frame width) leaves no room for the red circle and the camera cannot push in. A sentence spanning two lines splits into two highlights, each on one keyword (2026-10-04 field test: after splitting, the push reached 2.4× and text height ~50px). Eyeballed rects are often off 20–30% — render one `--stills` frame to check first.
- **Stepped animations inside grammar files must count from at.** "Shoot on twos"-style stepping that floors against an absolute time grid (`MO.step(t, 12)`) shows elements up to one step before at (2 frames early at 30fps). Write `MO.step(t − at, 12)` so at is the first frame. y4's character frames still step on absolute 24fps and cue landings may differ by 1 frame — check before use.

---

## 6. Regression (when admitted to the skill, 2026-10-04)

| Object | Result |
|---|---|
| 16 original sections (`eras.js`), 36-segment all-style gallery (`--film gallery`) | 61 sample times before/after pixel-identical; qa clean everywhere, determinism ✓, motion/jump numbers unchanged, elapsed time back-to-back 21.5 → 22.3 ms/frame (within noise) |
| 8 demo films vs experimental originals | each film 16 sample times (including transition windows) pixel-identical; qa 25 sections all clean, determinism ✓; motion, jumps, elapsed matching the original project (each demo's first section moved its start from 8/16s to 0, so qa sampling windows differ and first-section numbers vary slightly) |
| After the 2026-10-05 final-review fixes | 8 samples + 16 original sections + 36 gallery + 8 demo films = 87 sections, qa determinism ✓ all, no page errors; sample stills changed only as intended (t2 off by one color step = determinism fix, y5 deep-blue page keywords turned orange, y1 title now truly fades); the independent final review of 36 specs (landscape samples, portrait, stress, boundary, alpha) found no 🔴 |
| After 2026-10-10 pulse moves, real-material items, and portrait whole films entered the engine | 16 original sections, 36 gallery, 8 demo films, long-scroll demo — 18 sample times each, landscape before/after pixel-identical (demo y4 explicitly uses `char: 'author'`); all 9 samples rendered landscape and portrait with qa determinism ✓; the portrait test film's push / bands / iris / comicPanels transitions computed correctly at 1080×1920 |
| Known jumps | y1_s3 (the middle of the 42×→1× pull-out), y2_s2/s3 (fast whip and pushing into a photo), t1_s3 (passing into a neuron), y5's beat accents — all designed camera moves or beat flashes present in the originals. From 2026-10-10, qa counts monotone push/pull/glides shorter than 0.35s as camera events: the demo films' t1_s3 1.51s, y5 k4_agent 2.2s, and t3_s1 2.1s are reclassified as camera events; the rest exceed 0.35s (or are single-frame shoots-on-twos jumps) and still count as jumps |
| 2026-10-10 gate and one-command delivery | before/after the qa change: the 8 demo films' and 9 sample specs' motion, still-frame pairs, determinism, framing unchanged; jumps only lost the ones reclassified as camera events (as events: 3 in demo films, 1 in sample t2_keynote_ui, 3 in y4_storytime, 2 in y5_kinetic_type — all 0.07–0.34s pushes, slams, or pose snaps), while pushes longer than 0.35s and shoot-on-twos single-frame jumps still report; on a synthetic film (same three images, 3s per shot): a uniform 7.5% slow push per shot gives fast-motion share 0.000 red, one 0.3s 30% punch per shot gives 0.095 green; in whole-film mode a single 0.3s punch used to count as 8 jumps and now counts as 1 camera event, while a one-frame white flash still counts as a jump |

---

## 7. Pitfalls

- **(2026-10-04, live pipeline hookup) y2: after a push, the next box starts off-screen and the highlighter sweeps outside the frame.** The audience saw it 7 frames late. Fixed: when a box's start is outside the current shot, the camera glides there first and arrives one frame before at, then reveals; the push's magnification is also constrained by "keep the red circle inside the frame" (the circle is 1.24× the box's width, 1.5× its height).
- **(2026-10-04, parameterized-clip review) t3: ticks lied, categories lost names, big numbers clipped line heads.** `fmtTick` kept decimals only when the step was <1 — at step 2.5, −2.5/2.5/7.5 printed as −3/3/8; portrait thinned 10 category bars by `ceil(n/6)` and the annotated "first" bar happened to lose its name; number sat fixed at the chart's top-right, exactly where a rising line's head lands. All three fixed (see section 5's t3 row).
- **(same review) y2: the camera left before the text card finished typing.** Departure keyed only on the next item's at−0.95. Now it departs on "typed + 0.5s hold" (at the latest at−0.4), and short gaps raise typing from 13 to at most 40 chars/sec.
- **(same review) PuHui Medium/Bold render the ideographic space with zero width.** The source fonts (Alibaba PuHuiTi 3.0 weights 65/85) have zero width there, so "USD　y-axis does not start at 0" stuck together. `font_subset.py` sets it to the width of "one" when subsetting; existing files were fixed with `--fix-widths`.
- **(same review) t3 portrait's annotation landed on the burned subtitle band.** Portrait chart bottom at y≈1660, annotation at y≈1460, overlapping subtitles (1400–1520) of a 1080×1920 film. Added `safe`.

- **(2026-10-05, parameterized-clip final review) everything passed on the samples, then broke out of frame on portrait and real lengths.** The independent final review of 33 specs (landscape samples, self-written portrait, stress, boundary, alpha) found 12 🔴: y2's empty text deadlocked the renderer; y5's deep-blue page highlighter matched the yellow text and painted the main word out, and portrait long numbers left the frame; t1 portrait's 7 points pressed into the subtitle band; t3 portrait's subtitle and source left the frame, annotations pressed neighboring bars, transparent backgrounds hid dark text; y1 portrait labels were clipped; y3 portrait captions left the frame; y4 portrait typing overflowed the bubble; t2 renders of the same moment differed by one color step (a reused buffer held the previous frame). Self-testing also found `TY.charsIn` not multiplying by the outer alpha (y1's title "fade" was a one-frame disappearance), t3's lowest negative bar value pressing its category name, and `TY.fit` counting lines but not measuring widths. Rule: **everywhere that "does not fit" needs a fallback — shrink first, then wrap, then yield space, and only then warn**; layouts tuned only on sample lengths break at the first real voiceover.

- **Two experiment groups each shipped a `window.YT` with entirely different APIs.** On merge they were split by function into 8 namespaces, and same-name-different-meaning items were renamed: G2's `zoomThrough` (zoom into a color block) → `fillZoom`; G2's `spring(t, freq, decay)` → `MO.springHz`; G1's `circlePts` (opening ellipse) → `DG.ellipsePts`.
- **woff2 fonts failed glyph checks.** The engine's `U.loadCmaps` only parses WOFF1/TTF; G3's woff2 console.errored on load and qa failed it. On admission everything was converted to woff.
- **Backgrounds keyed on whole-film time change phase with the film's position on its timeline.** The keynote demo's light spots were laid out for 8–16s; as a standalone film the composition changed, so `T2.PHASE = 8` preserves the approved picture. Parameterized clips key light spots on clip time only and are unaffected.
- **Ticks must wrap the whole dataset.** `CH.ticks` only returned in-range integer ticks — with max 130 the top tick could be 100 and a bar would poke out of the axes; clips now pad one step above and below.
- **System fonts are not in the skill.** The Vox demo's serif (Songti SC) and the kinetic demo's code font (Menlo) used macOS system fonts and change on other machines; parameterized clips were all switched to skill-bundled fonts.


## Full-film voiceover and the 9th grammar

The 8 above all have parameterized clips. There is also [presenter-style finance explainers](grammar/y6_presenter_explainer.md), which ships a grammar and full-film reference code but no parameterized clips yet. For complete voiceover production, framing checks, and experience flow-back see [full-film voiceover and flow-back](12-voiceover-full-film-experience-loop.md).
