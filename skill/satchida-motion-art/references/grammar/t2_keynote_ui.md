# t2_keynote_ui · Keynote-style UI and spring motion

> One-sentence grammar: **one thing per screen; the product itself (screenshot, screen recording, physical object) is the protagonist; nouns and numbers land as the voiceover speaks them; text is tight; springs have no bounce or a light one.** Light-spot gradient backgrounds, frosted glass cards, gradient text, centered blur-emerge, and decorative floating are all optional packaging — use sparingly (see "Start-up checks").
>
> Demo film: `scripts/engine/demos/t2_keynote_ui/` (render with `render.py --film demos/t2_keynote_ui`) (8s, 3 shots) · overview `assets/grammar/t2_keynote_ui-overview.jpg` · code `scripts/engine/demos/t2_keynote_ui/`

## Start-up checks

1. **This set is the easiest to read as an AI template.** Light-spot gradient background + frosted glass cards + gradient text + centered blur-emerge + floating cards — deploy all five and the audience spots the template instantly. Before starting, ask: are there real product screenshots, screen recordings, or photos of the physical product? If yes, put them full-frame as the main picture and push into the part being discussed — skip light spots and glass; a film may pick at most two of the five packagings.
2. **Screenshots must be big.** In shots with a screenshot, its width is ≥80% of frame (≥90% portrait), and the camera pushes in only when the voiceover reaches the part that is illegible at full size (default slow push ~0.9s; punch 0.28s only when that part is a reveal or a comparison). One screenshot gets pushed at most once or twice; after pushing, pull back to the whole or glide to the next part. A small card floating on a sea of light spots is failure mode #4, "dead background". Parameterized clip t2 already behaves this way by default: screenshots laid full-frame (aspect kept, uncropped, surrounded by a darkened blurred copy of the same image), pushing over at the highlight (default slow push; spec top-level `data` `"camera": "snap"` switches to punch), and gliding between consecutive screenshots at the same magnification; the legacy glass card requires explicit `data.frame: "glass"`. For your own shots use `CAM.track` (camera move table) and `MD.cover` (full-frame + focus + push); how to choose moves: `../shot-language.md`.
3. **Count the layouts.** Write out every screen's layout from the storyboard (title screen, three cards side by side, big number, screenshot card); the same layout appearing ≥2 screens consecutively means switch: screenshot push, number slam, before/after comparison. A whole film cycling "title → three feature cards → big number" is a page-turning PPT.
4. **Hold after landing.** No floating cards, no uniform slow push to fill pauses; the next action lands the moment the voiceover speaks the noun or number. When the number is about that same screenshot just shown (a ratio of two timings, this page's conclusion), write `data.over: true` on number: the camera pulls back to the whole screenshot, the screenshot darkens, and the number slams on top — not a separate light-spot screen.
5. **Palette follows the product.** Background and accent take the product's own brand colors — no default purple-blue-cyan light spots; for bad news, serious events, and non-launch subjects, do not use this dark keynote base.

## ① Where it applies

- **Use**: product/feature launches, version updates, "three new features", pricing and parameter reveals, opening brand films, the "what is this product" section of a video. When the voiceover is **nouns + numbers** ("Plover 2", "320 milliseconds of latency", "1 million tokens") it fits best: one sentence, one screen; text emerges as nouns appear, numbers land as they are spoken.
- **Use**: when a UI screenshot must be explained clearly — screenshot full-frame, push into the part being discussed; glass cards and 3D rotation are optional packaging, use sparingly.
- **Avoid**: explaining mechanisms (glass and light spots carry no logic — use t1); data trends (use t3); serious incidents/bad financial news (this language carries a "good news" mood); when the content has no zoomable "protagonist" (only empty light-spot backgrounds); science, story, or news subjects — do not use this base as a universal template.

## ② Picture construction

| Item | Value | Basis |
|---|---|---|
| Background | near-black: here `#050508`; Apple `#000/#161617/#1d1d1f`; Linear `#08090a` (upper level `#0f1011/#141516`, body text `#f7f8f8`, border `#ffffff14`) | measured from both sites' CSS |
| Light spots (optional, sparing) | 4 radial-gradient blobs screen-composited → blurred 90px at 1/4 size → scaled to fill → 3.5% static grain against banding. Hues follow Stripe: purple `(150,90,238)`, blue `(56,104,255)`, cyan `(120,214,255)`, a little warm red `(255,96,84)`; a 38% black radial pressed in the center gives white text contrast | Stripe 2021 gradient `#a960ee #ff333d #90e0ff #ffcb57` |
| Light-spot motion (optional) | each blob drifts with amplitude 90–260px, period 9.5–13s, **avoiding a 5s period** (HIG: avoid ~0.2Hz sustained oscillation) | Apple HIG Motion |
| Glass card (optional, sparing) | backdrop blur 40px (Apple nav `saturate(180%) blur(20px)`; NN/g says bigger is better) + 7.5% white fill + top 14% white gradient light band + 1.5px gradient border (bright top-left, dark bottom-right) + large shadow (blur 70–80, y+30–40, α0.5) | apple.com globalheader.css; NN/g Glassmorphism |
| Corner radius | cards 36px; **concentric radii**: inner icon tile radius = 36 − padding 14 = 22 | WWDC25 "child radius = parent radius − padding" |
| Fonts | Inter (closest open source to SF Pro; Linear uses Inter); Chinese in Noto Sans-class. Headings weight 600, **large sizes tracked in −0.02 ~ −0.03em** (`T2.track`) | Apple 96px −0.015em, Linear 64px −0.022em, OpenAI 64px −0.03em |
| Text hierarchy | white `#f5f5f7` primary, `rgba(235,235,245,.6)` secondary, `#a7a7b4` eyebrow (+6px tracking); product names may use a white→lavender→pale-cyan horizontal gradient (optional, sparing: gradient text plus light spots together is the template look) | Apple site hierarchy conventions |
| Composition | one focus per screen; with a screenshot it goes full-frame (width ≥80%) and pushes into the part discussed; centered symmetric three-card rows (equal width 480, gap 52) only for feature lists without screenshots; big numbers take ≥55% of frame width | — |
| Shape language | rounded rectangles, capsules, thin-line icons (round-capped equal-width, SF Symbols temperament, `UI.icon`) | — |

## ③ Motion paths

- **Springs (the workhorse)**: SwiftUI duration+bounce parameterization, `MO.spring(t,{duration,bounce})`: mass=1, stiffness=(2π/d)², damping=4π(1−bounce)/d → damping ratio ζ=1−bounce. **Default bounce 0** (most versatile); 0.15 is crisp with almost no overshoot (here cards enter d=0.75, bubbles d=0.5); 0.3 visibly bounces; >0.4 is cartoonish for UI. `.smooth/.snappy/.bouncy` are all d=0.5.
- **Curves (non-spring)**: apple.com nav `.32s cubic-bezier(.4,0,.6,1)`; this film's text emergence uses CSS `ease`=`(.25,.1,.25,1)` (`MO.appleOut`); Linear's workhorse ease-out-quad `(.25,.46,.45,.94)` .16s; Stripe suggests <500ms and `(.2,1,.2,1)`. `MO.bezier(x1,y1,x2,y2)` covers all.
- **Text entrance** (centered blur-emerge is optional, sparing; every screen emerging this way becomes the template): blur 18–26px → 0, rise 16–40px → 0, opacity → 1, 0.7–1.0s (`TY.blurIn`). Eyebrow → product name → subtitle staggered 0.2–0.4s.
- **Card entrance**: from 170px below, around the Y axis ±0.55rad (≈31°, side cards facing outward), scale 0.9 → spring into place; three cards staggered 0.1s. 3D via `UI.persp` (vertical slice perspective, persp 1800px; Stripe uses 600, Linear 1000).
- **Camera and pauses**: hold after landing; no decorative floating, no uniform slow push to fill pauses. The camera moves only when the voiceover reaches the part of the screenshot that is illegible full-size: default slow push ~0.9s to that part, 0.7s glide to the next; punch 0.28s only for reveals and two-number comparisons; number or big-text slam 0.17s (1.55→0.94→1.0); hold length follows the voiceover. After pushing, pull back to the whole screenshot or glide to the next part — never shot after shot inward. The demo film's 7px card float (`MO.float`) and uniform camera push 1→1.045 are old practices — do not copy them.
- **Counting**: starts 0.25s after the card lands, runs 0.9s (one number counts once — after expanding full-screen it continues "1 million", never recounting from 0); `easeOutExpo` (CountUp.js's default easing) — the last digit settles slowly; digits are **tabular** (`TY.tabular`; Canvas cannot enable tnum — without it the count jitters).
- **Light sweep**: a bright band at −20°, 110–140px wide, sweeps 0.8–0.9s; on text, an offscreen layer with `source-atop` (lights only the text); on cards, `lighter`; the three cards' progress is computed from each one's screen position — the same light.

## ④ Transitions (the common 5)

1. **Blur push (blurPush)**: the old frame shrinks to 0.92 + blurs 24px + fades out; the new frame falls from 1.06 with blur to sharp 1.0, 0.55s, `ease`. **Layer an enlarged 1.08 heavily-blurred copy of the old frame underneath first**, so the shrinking frame shows no black edges. Here shots 1→2.
2. **Shared-element expand (expandRect)**: (the new picture's first frame is **opaque** inside the card — the card is translucent, and any cross-dissolve shows both frames' text stacked) the selected card (first scaled to 1.06, neighbors receding and dimming to 45%) expands from its own screen rectangle to full screen, corner radius 38→0, spring d=0.55 bounce 0; the new picture starts already scaled to card size inside it. **The selected card stops floating before expanding**, so the transition springs from a stable rectangle. Here shots 2→3.
3. **Match cut**: the same object at the same position in consecutive shots (product name → the card title's position).
4. **Mask wipe / light-sweep cut**: while a light band sweeps across, the frame changes behind it.
5. **Refraction instead of fade** (Liquid Glass): elements enter by gradually changing refraction/blur strength rather than dropping opacity (this film's text blur-emerge is that idea).

## ⑤ Rhythm and text

- **Shot lengths**: keynote talks hold a screen 5–8s (Jobs 2007 iPhone: 70 seconds over 9 screens ≈ 7.8s/screen); product quick cuts 1.5–3s. Here 2.6/3.0/2.4s.
- **One thing per screen**: one noun, one number, one card. After a dense stretch, insert one empty screen for the audience to breathe (Presentation Zen's counterweight).
- **Counterpoint with the voiceover**: text starts emerging 0.2–0.3s before the noun is spoken (emergence itself takes 0.7s, so it is sharp exactly when spoken); numbers **land** when the voiceover speaks the value — count start = spoken moment − count duration; the three cards' entrances map to "first, second, third".
- **Text**: title ≤6 characters or one product name; subtitle one sentence ≤16 characters; card: a 4-character title + one line of caption + one big number + unit (one size smaller, one gray step down).

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/t2_keynote_ui/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- Reused from the skill: `engine.js`, `render.py`, `PAINT.cached/hex`, `U.rng`.
- Newly written, now unified into `lib/ui.js` (`window.UI`): `mesh` (light-spot background), `grainTex`, `backdrop` (blurred copy, glass sampling), `shadow` (shadow only), `glass` (frosted card), `sheen` (light sweep, `comp` optional), `persp` (Y/X-axis fake 3D), `icon`, `rr/rrPath`, `scratch`.
- `lib/motion.js`: `spring/smoothSpring/snappy/bouncy`, `bezier/appleOut/emphasized`, `float`; numbers and text in `lib/typo.js`: `TY.count/tabular`, `TY.blurIn` (called MO.textIn in the experiments).
- Transitions (in `transitions_info.js` during the experiments, now in `transitions.js`): `blurPush`, `expandRect`.
- Performance: one light-spot pass (1/4 size) + one background blur copy per frame, mean 40–60ms/frame (qa with GPU flush); 8 seconds at 60fps renders in ~1 minute.
- Pitfalls (fixed in the library): (1) **blur pulls transparent pixels in from outside the canvas**, accumulating frame over frame on an uncleared offscreen — qa reported determinism ✗ — pad a non-blurred copy of the original underneath first; (2) perspective slices overlapping 0.75px striped on semi-transparent textures — integer-align slice boundaries end to end, and paint into an offscreen first, then composite with alpha; (3) `UI.sheen` sets a composite mode internally that overwrites an outer `source-atop`, so it became a parameter.

## ⑦ Representative works and primary references

- Representative: Apple iPhone/Apple Intelligence launch films and apple.com product pages; OpenAI GPT-4o / o-series launch videos; Linear's site and Linear Release videos; Stripe's 2020–21 site gradients.
- https://developer.apple.com/videos/play/wwdc2023/10158/ (Animate with springs: duration/bounce)
- https://developer.apple.com/videos/play/wwdc2018/803/ (Designing Fluid Interfaces: start from 100% damping)
- https://developer.apple.com/videos/play/wwdc2025/219/ (Meet Liquid Glass)
- https://developer.apple.com/design/human-interface-guidelines/materials , /motion , /typography
- https://www.nngroup.com/articles/glassmorphism/
- https://web.archive.org/web/20211015000000/https://stripe.com/ (gradient values)
- https://stripe.com/blog/connect-front-end-experience (<500ms, curves)
- https://linear.app/now/how-we-redesigned-the-linear-ui (LCH color, Inter)

## ⑧ The 3 easiest mistakes

1. **Nothing behind the glass.** Frosted glass only blurs what is behind it; on a dark flat background "glass" is just a gray rectangle. Paint colorful, undulating light spots first, then sample-blur at the card's screen position.
2. **Springs too bouncy, actions too many.** bounce defaults to 0, entrances at most 0.15–0.3; >0.4 instantly cheap. Move one group of things at a time.
3. **Big text not tracked in, light spots turning muddy.** Above 64px use −0.015~−0.03em; each light spot owns its color region (screen compositing + large blur) — never average several colors into gray-purple mud.

## qa numbers (skill `scripts/qa.py`, 2026-10-04, pre-review)

| Shot | Motion% | Still pairs% | Jumps | Mean/peak ms | Deterministic |
|---|---|---|---|---|---|
| t2_s1 | 0.58 | 35.4 | 0 | 39.8/51.4 | ✓ |
| t2_s2 | 2.62 | 8.5 | 0 | 60.2/65.0 | ✓ |
| t2_s3 | 1.84 | 9.6 | 0 | 44.3/51.0 | ✓ |

Note: t2_s1's "still pairs 35%" comes from the demo's light-spot drift and 4.5% uniform push (old practice); per-frame change fell below qa's pixel threshold (>12 levels), but sampling two frames 1s apart (1.6s vs 2.6s) showed 26.8% of pixels changing over 12 levels and 78% over 4. Still-pair numbers prove nothing either way: explainer films hold long by design, and a uniform-drift film with very low still pairs still reads like flipping PPT.

## Revisions (independent review → one fix round, 2026-10-04)

| Review finding | Fix |
|---|---|
| 🔴 2.55–2.75s and 5.6–5.85s transitions showed black edges around the frame | blurPush / expandRect now pad an enlarged 1.08, 30px-blurred copy of the old frame underneath |
| 🔴 During card expansion "long-term memory" and "1 million" showed double images; after expanding, the count restarted from 0 | the new picture's first frame is opaque inside the card; the full-screen page continues "1 million tokens" with the same figure, no recount |
| 🔴 At 6.95s the counter jumped from 999,023 to 1,000,000 in one frame, squeezing "tokens" | removed the duplicate counting with the item above; the unit is laid out from three measured widths, no longer hugging the text |
| 🟡 The end card held only 0.4s and y≈1020 left the safe area | end card emerges 1.2–1.8s, holds 0.6s, y=972; the dialog panel moved up 65px overall |
| ⚪ The card's "1 million" and the full screen's "1,000,000" disagreed | unified as "1 million" |

Post-revision qa:

| Shot | Motion% | Still pairs% | Jumps | Mean/peak ms | Deterministic |
|---|---|---|---|---|---|
| t2_s1 | 0.58 | 35.4 | 0 | 39.5/51.6 | ✓ |
| t2_s2 | 2.62 | 8.5 | 0 | 57.2/59.9 | ✓ |
| t2_s3 | 0.97 | 15.4 | 0 | 43.0/48.7 | ✓ |

(Transition smoke test: blurPush slowest at ~137ms/frame, including two full-screen blurs.)
