# y5 · Kinetic typography / infographic motion (kinetic type)

> One-sentence grammar: **text is the actor — every keyword slams in on an accent; the main word is large enough to read at a glance; the other words rise from a "slot" to counterpoint the ear; the frame always has exactly one focus; the camera and the background texture keep moving while landed text stays still.**

Lineage: Saul Bass's *North by Northwest* (1959) title sequence is widely credited as the first large-scale use of kinetic type in a feature film; after 2008, YouTube's lyric/quote kinetic type (the After Effects generation) turned it into the standard grammar for explainer openers, lists, quotes, and data reveals.

## Start-up checks

1. **First confirm this segment should let text be the protagonist.** Use only for lists, quotes, numbers, and chapter cards; a stretch over 30–60 seconds of nothing but text switches grammar, or inserts an image or evidence object (screenshot, code card, chat bubble) every 2 pages.
2. **Count the characters.** Main word ≤4 characters, support line ≤14; only one thing enters at a time. Over the limit, split the page — do not shrink the font to cram.
3. **The same page type never runs 3+ pages consecutively.** "Big word + support line + top-left label" flipped 4 times running is a slideshow; insert one number-slam page, one evidence-object page, or one zoom-into-color-block transition between.
4. **Every landing is written as a beat number or a spoken word.** Landings off the beat grid and unaligned to words get deleted or moved onto them.
5. **Landed text does not move.** Energy goes to beat micro-pulses, page turns, and evidence objects entering; the main word does not drift or breathe.

---

## ① Where it applies

**Use it:**
- Explainers/lists/"X stages"/"3 reasons" openers and chapter cards: the information is **structure** (how many, which one, from what to what), not picture.
- Quotes, aphorisms, one-line conclusions: "reading it while watching" sticks better than "hearing it".
- Number explainers: one number, one shot; the number itself is the protagonist.
- Clear accent words in the voiceover ("not writing code — **describing requirements**").

**Avoid:**
- Stories and emotional arcs → no face, hard to empathize (use y4 characters).
- Long explanatory passages with full-screen text → the audience reads instead of listening, and cannot keep up. Over 30–60 seconds of pure kinetic text tires; use it for openers, chapter cards, and conclusion cards.
- Very long lists (>5 items) → switch to a static infographic told slowly.

## ② Picture construction

**Composition**: one main word per screen. The main word is left-aligned across the left 1/3–1/2 of frame (or mirrored right), the support line tight beneath it, and the other side holds one "evidence object" (code card, chat bubble, list). The corner holds a small label ("Stage 01") and the progress track. At least 130px margin on all sides.

**Type scale (demo film)**: main word 340px (PuHui 115 Black) : support line 96px (105 Heavy) : label 40px (85 Bold, +6px tracking) ≈ **3.4 : 1 : 0.4**. The main word must be readable in 0.3 seconds, so it gets only 2 characters.

**Palette**: each chapter owns one full-screen base color; changing chapters = changing base color (the color itself is the chapter number).

| Shot | Base | Main word | Accent |
|---|---|---|---|
| Title | yellow `#FFD23F` | ink `#111111` | white "3" in a coral circle `#FF5A36` |
| 01 complete | coral `#FF5A36` | white | yellow highlighter `#FFD23F` |
| 02 chat | navy `#14213D` | yellow | yellow highlighter, blue bubble `#3A86FF` |
| 03 agent | off-white `#F4EFE6` | ink | coral underline, green check `#2BB673` |

The film uses 4 base colors + ink + white, with exactly one accent at a time.

**Shape language**: text is the biggest shape; auxiliary shapes are only rounded rectangles (card r=26, bubble r=30, keycap r=22), true circles (number bases), and slanted color blocks (highlighter, slope 0.18). The background is a 64px-pitch dot grid (opacity 6–10%). No outlined text, no drop-shadow text (the only shadow is a card's offset shadow at 8–18%).

## ③ Motion paths

**Entrances (chosen by "importance")**

| Element | Method | Curve and duration |
|---|---|---|
| Main word | **slam**: scales 1.7→1, opacity 0→1 in the first 0.06s | underdamped spring `1−e^(−10t)·cos(2π·2.2t)`, ~8% overshoot, ≈0.35s to settle |
| Title's first word | slam + rotation −8°→0 | same |
| Support line, label | **rise from slot**: pushed from +1.2× glyph height to 0 inside a baseline mask | `expoOut`, 0.30–0.35s |
| Number / icon / bubble / keycap | **pop**: scale 0→1 | `backOut`, s=2.6–3.0 (overshoot 17–20%), 0.30–0.42s |
| Card | **slide in**: from +700px or +260px below, with a 3.4° rotation settling | `expoOut` 0.40s |
| Typing | per-character truncation | 13 characters in 0.5s (26 chars/sec), cursor blinking at 2Hz |
| Code completion | gray text flashes in **0 frames** (completion is instantaneous by nature) → solidifies on Tab | keycap presses 14% in, rebounding as `e^(−18t)` |
| Highlighter / underline | brushes left to right | `expoOut` 0.30s, brushed 1–3 eighth notes after the text appears |
| Keyword scale-up | at the accent beat, scales to 1.35× and pins, the highlighter scaling with it | spring freq 2.5 / decay 9, on the same beat as the paired action (Tab, check) |
| Giant stage number | 900px, opacity 5–13%, pressed into the lower right, falling 1.35×→1 then drifting diagonally at 14/10 px/s | spring freq 2 / decay 8 |
| Check | the check's stroke draws by arc length while the box scales 1→1.25→1 | 0.22s; the strikethrough follows 0.08s later |

**Exits**: faster than entrances, with accelerating curves (`expoIn`), 0.18s, staggered 0.03s between elements, simultaneously scaling to 0.6, dropping 60px, going transparent. **Exits are faster than entrances** — the audience's attention has already left before the exit starts. The demo title section's final beat: everything except the "3" exits, leaving only one shape to zoom into.

**Stagger**: words in one line stagger one eighth note (0.25s at 120 BPM); a group of small elements (three checks) also spaces one eighth apart.

**Persistent motion (landed text does not move; other things do)**
- Camera micro-drift: two sine paths, amplitude 5px, periods ~7s / 2.7s; very slow rotation ±0.5°.
- Beat micro-pulse: every quarter beat the whole screen scales 1.2%, decaying as `e^(−25t)` (≈0.12s) — the frame "breathes" with the kick.
- Background dot grid translates diagonally at 36px/s.
- Closing beat: the camera pulls out 6% (`expoOut` 0.5s), everything shrinking slightly — "resolve".

**Original-film comparison (two YouTube lyric kinetic-type re-uploads crawled this time, 30fps)**: completely still adjacent frames total only 10.3% (DISCORD) / 21.2% (Charlie Puth), the frame moving 70–80% of the time — the opposite of storytime's 71% still; large visual events (full-screen changes >1.5% peaks) average one every 0.66s / 0.83s, close to **one per beat** (the two tracks run ~105 / 99 BPM, one beat 0.57 / 0.60s). The demo's big-event density is one per eighth (0.25s), twice the lyric films' — explainer openers can be this dense; long films should spread to one per beat.

## ④ Transitions (the demo's 3 + the common 2)

1. **Zoom through**: the camera charges into a shape from the previous screen (the "3"'s coral circle); the shape's color = the next screen's base color; after it fills the frame the next screen settles from 1.25× to 1. The first 55% of the time `expoIn` enlarges to 30×, the last 45% `expoOut` lands. `TRANSITIONS.fillZoom` (called zoomThrough in the experiments, renamed on admission to avoid clashing with 3b1b's camera-through), parameters `cx, cy, k, maxZoom, fill`.
2. **Band wipe (bands)**: three slanted color bands (yellow → white → navy) relay left to right, staggered 12%; the last band is the new picture's base color, and the new picture shows behind the bands. 0.5s `expoInOut`. `TRANSITIONS.bands`.
3. **Push (push)**: old and new translate together, like sliding to the next block on one long canvas. 0.35s `expoInOut`. `TRANSITIONS.push`.
4. **Mask wipe**: a shape (circle, rectangle strip, the text itself) acts as a mask growing to reveal the new picture. The skill's original `iris` works.
5. **Text morph / text as transition**: a word from the previous screen enlarges into the full-screen color block, or one word whips out carrying the old frame with it.

**Counterpoint trick (this round's most valuable finding)**: in the engine, transitions start from the new section's `t0`, so to make the frame where "the new picture shows" land exactly on the bar line, the section's start = **bar line − the transition's reveal point × transition duration**. Demo: fillZoom's reveal point p=0.55, duration 0.45 → start 1.75 (reveal at 2.00); bands' reveal point ≈0.6, 0.5s → start 3.70; push uses expoInOut, whose perceived "arrival" is 90% displacement (p≈0.58) rather than p=1 → start 5.80 (the first version computed from p=1 giving 5.65, and review measured "the push finishing 8 frames before the beat"). All in-shot landings are also written as beat numbers `KT.b(n)`, never seconds.

## ⑤ Rhythm and text

- **120 BPM, 4 bars + 1 closing beat (8.5s), one shot per bar** (title / stage one / stage two / stage three); inside each shot: beat 1 the main word slams (+ the giant background stage number), beat 1.5 an evidence object, beat 2 the support line, beat 3 an evidence action, beat 3.5 keyword scale-up + highlight, beat 4 breathing room or exit; then beat 16 (8.0s) the closing accent, holding still 0.5s after. All four shots share one beat grid, changing only left/right and content — from the second shot on, the audience "knows where the next hit lands", which is exactly where rhythm feel comes from.
- **Main words land on strong beats (each bar's first beat)** with a low-frequency impact; small elements land on eighth notes with pops; 0.3s before a transition, a rising noise sweep carries the ear to the next bar.
- Every picture landing has a sound, every accent a picture — the demo's SFX table lives in the experiment archive's `build_y5.py` (not admitted to the skill), one-to-one with the beat numbers in `scenes/*.js`.
- **Dwell long enough to read**: the English video-text guideline gives 13 chars/sec as a floor (SSW); no primary Chinese standard was found, so use the subtitle industry's empirical ceiling of 7–9 chars/sec (unverified, treated as experience). A 2-character main word holds at least 0.5s; a 7–8 character support line at least 1.0s.
- When counterpointing with the voiceover: the main word = the voiceover's accent word, and **the picture may be early, never late — at most 1 frame early** — humans are far more sensitive to "sound leading picture" than "sound lagging picture" (broadcast A/V sync tolerance EBU R37: sound may lead ≤40ms, lag ≤60ms).

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/y5_kinetic_type/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- **Reused from the skill**: engine (section table, transition old/new layers, `renderFrame`), `render.py`, `U.clamp / lerp / rng`; `PAINT` not needed (this style uses no textures).
- **Engine changes (merged into the skill engine)**: `window.BPM` configurable (default 128; this film 120); any section may write `dur` seconds; transitions may set `punch:0` (this film uses its own beat micro-pulse, pulsing on beats, not on transition starts).
- **Newly written, now unified** (`lib/motion.js` / `typo.js` / `camera.js`; transitions into `transitions.js`):
  - Easings: `expoOut / expoIn / expoInOut / quintOut / backOut(p, s) / spring(t, freq, decay) / settle(t, amp, freq, decay)`.
  - Text: `TY.text` (scale/rotation about any point, stroke, tracking), `TY.width`, `TY.rise` (mask rise), `TY.pop` (pop in), `TY.typed` (typing), `TY.marker` (highlighter slanted block), `TY.underline`.
  - Camera: `CAM.with(c, {x, y, z, r}, fn)`, `CAM.drift`.
  - Transitions: `fillZoom`, `bands`, `push`.
- **This film's `y5_kinetic_type/kinetic.js`**: `KT.b(n)` beat numbers, `KT.SZ` type scale, `KT.bump` beat micro-pulse, `KT.slam` main-word slam, `KT.dots` dot grid, progress track (painted on the fixed `GLOBAL_OVERLAY` layer, value depending only on whole-film time — doc 02's "continuous narrative anchor" usage; the first version painted it per section and it jumped with page pushes), `KT.key / keyMarker` (keywords rise first, then scale and pin on the accent beat), `KT.bigNum` (giant background stage number), `KT.cam`.
- **Chinese fonts**: the demo used Alibaba PuHuiTi 3.0 in four weights (Black/Heavy/Bold/Medium); the open-source build swapped in Noto Sans SC 900/800/700/500 for licensing, keeping the family names `PuHui-*`, with a full GB2312 subset (`scripts/font_subset.py --gb2312`) — new subjects rarely need re-subsetting.
- **Music (`build_y5.py` in the experiment archive, not admitted to the skill)**: numpy-synthesized drums (kick each beat, clap on 2/4, hats off-beat) + bass (one root note's eighth notes per bar) + event SFX (main word = boom, small elements = pop, typing = click, check = rising pop, pre-transition = riser).

## ⑦ Representative works and primary references

- Saul Bass title archive (Art of the Title): https://www.artofthetitle.com/designer/saul-bass/
- Wikipedia "Kinetic typography" (motion typography / fluid typography classes; Bass as the feature-film pioneer): https://en.wikipedia.org/wiki/Kinetic_typography
- School of Motion "Kinetic Typography in After Effects" Part 2 (frame counts: small words slide in 4 frames, the main word slams in 6 frames + 2-frame overshoot settle; the camera pushes 6 frames + 2-frame pull-back; "the camera should move a beat late, as if pushed by the sound"): https://www.schoolofmotion.com/blog/kinetic-typography-after-effects-part-2
- School of Motion Part 3 (drops accelerate rather than ease out; on impact the whole comp scales up then returns to 100%): https://schoolofmotion.com/blog/kinetic-typography-after-effects-part-3
- Dan Ebberts inertia-bounce expression (`amp·sin(2πft)/e^(decay·t)`, default freq 3 / decay 5): http://www.motionscript.com/articles/bounce-and-overshoot.html
- Lee, Forlizzi, Hudson, "The Kinetic Typography Engine" (UIST 2002; animated text expressing emotion and tone): https://dl.acm.org/doi/10.1145/571985.571997
- Video text dwell time: https://www.ssw.com.au/rules/post-production-do-you-give-enough-time-to-read-texts-in-your-videos
- The two measured re-uploads: DISCORD [Kinetic Typography] https://www.bilibili.com/video/BV1ts411S7Xa ; Charlie Puth – We Don't Talk Anymore (Kinetic Typography) https://www.bilibili.com/video/BV1by4y1r74Y

## ⑧ The 3 easiest mistakes

1. **All text the same size, all moving together.** No hierarchy, no focus; the audience does not know what to read first. Main word to support line at least 3:1; only one thing "enters" at a time; everything else still.
2. **Text drifting forever.** Text cannot move while being read (it will not sink in). Persistent motion goes to camera drift, beat pulses, and the background dot grid; the main word pins 0.35s after slamming in.
3. **Animations off the beat, or landing on transition starts.** A transition's first frame is not the accent; the frame where "the new picture shows" is. Shift section starts back by "reveal point × duration", and write every in-shot landing as a beat number; each landing outside the grid loosens the whole film by one notch.

---

## Demo film

- Finished film: `scripts/engine/demos/y5_kinetic_type/` (render with `render.py --film demos/y5_kinetic_type`) (8.5s, 60fps, synthesized score at 120 BPM); one frame per shot overview: `assets/grammar/y5_kinetic_type-overview.jpg`
- Project: `scripts/engine/demos/y5_kinetic_type/` (`eras.js`, `kinetic.js`, `k1_title.js / k2_complete.js / k3_chat.js / k4_agent.js`), shared parts in `scripts/engine/lib/`
- Shot list: K1 title "The ③ stages of AI writing code" → zoom through → K2 "complete" (code card + gray completion + Tab) → band wipe → K3 "chat" (you one line, it a whole paragraph) → push → K4 "agent" (the TODO's three items check themselves off) + progress track full

## Review rework (independent agent watched only the finished film)

Review verdict: "the opening 0–2s is textbook kinetic type; the '3' circle zooming into the camera to become the next section's base color is the film's best design"; "A/V counterpoint nearly perfect — all visual events land on the 120 BPM grid, sharing a frame with the kick drum". Five "must fix" items, handled as follows:
1. **Support lines held too briefly** (0.6–0.9s) → support lines moved one beat earlier and compressed to 6–7 characters ("it completes the next line", "one sentence swaps a whole paragraph", "you only say what you want"), readable time 1.0–1.5s (stage 2 still tight; a real film with voiceover suffices); the film gained 0.5s.
2. **Stage 2's support line nearly hit the AI panel** (14px) → the support line shortened and right-aligned, clearance >180px.
3. **The page push was 8 frames early and the progress track jumped with it** → section starts recomputed at 90% displacement (5.80); the progress track moved to the fixed `GLOBAL_OVERLAY` layer, its color changing on the reveal frame.
4. **The stage sections were not kinetic enough** (numbers too small, keywords highlighted but never enlarged) → added giant background stage numbers 1/2/3; keywords scale to 1.35× on the accent beat.
5. **No closing hit; everything went gray after checking off** → added the beat-16 closing accent (camera pulls out 6% + 3.5% pulse + low frequency + high bell), checked items turn green instead of gray, content shifted down 70px to fill the bottom blank.
Also: the code card switched to a monospace font (Menlo).
Not adopted: "stretch each section to 2.5–3s, film 10–11s total" — the demo targets ~8 seconds, so character counts were compressed instead of lengthening.

## qa.py numbers (post-rework, `uv run scripts/qa.py --project scripts/engine --film demos/y5_kinetic_type`)

| Section | Motion% | Still pairs% | Jumps | Mean/peak ms | Deterministic |
|---|---|---|---|---|---|
| k1_title | 2.37 | 0.0 | 1 (t=1.63, title exit) | 1.0/1.6 | ✓ |
| k2_complete | 2.39 | 0.0 | 0 | 1.5/3.2 | ✓ |
| k3_chat | 2.59 | 0.0 | 1 (t=4.54, AI bubble grows) | 1.6/2.2 | ✓ |
| k4_agent | 2.88 | 0.0 | 3 (t=6.29 Agent + task card; t=8.00/8.04 closing accent) | 1.6/2.0 | ✓ |

Transition smoke test (whole-frame peak): fillZoom 6.8ms, bands 4.8ms, push 3.8ms. All 5 jumps were inspected frame by frame — all intentional beat accents (qa doc: "intentional beat flashes are not errors"). Kinetic's jumps should land on beats — take jump times and check them against the beat grid; the ones that do not match are the bugs.
After rework, a four-edge frame scan found 0 frames showing black.
