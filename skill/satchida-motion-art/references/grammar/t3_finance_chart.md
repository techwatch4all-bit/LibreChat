# t3_finance_chart · Finance data chart animation

> One-sentence grammar: **build the axes first, grow the data next, annotate one thing last; one color carries the protagonist while the rest dim to gray; values stay honest (bars from 0, units and sources on the chart) — animation decides only "how it appears", never "what it is".**
>
> Demo film: `scripts/engine/demos/t3_finance_chart/` (render with `render.py --film demos/t3_finance_chart`) (8s, 3 shots, all data fabricated, "sample data" badge bottom-right every shot) · overview `assets/grammar/t3_finance_chart-overview.jpg` · code `scripts/engine/demos/t3_finance_chart/`

## Start-up checks

1. **Every chart first states its "one thing".** The title is that conclusion; the annotation annotates only it; a chart with no such sentence does not get made — use a big number or switch grammar.
2. **Numbers must be mutually derivable.** The title's multiplier must be computable from the numbers on the chart (a ÷ b written in the annotation); the same figure across two shots must match; keep "grew to" and "grew by" straight.
3. **The data's growth moment lands on the voiceover's word.** Write several bar cues with `data.index` so each bar grows when it is spoken; do not show the title at second 0 and grow everything in one gulp.
4. **Hold after landing.** After numbers land, hold at least 0.5s; no uniform slow push; when a detail matters, slow-push there (~1s, Heer & Robertson: one step ≈1s, eased) as the voiceover points at it; punch 0.28s only for the film's most critical number; or use `zoomThrough` to push into that point.
5. **The same layout never runs 3+ charts in a row.** Thin red line + title + chart three times consecutively is report-flipping; insert one push into a detail, one slammed big number, or a cut back to real material.
6. **Keep chart shots inside the film's world.** The chart's background stays in the same color family as neighboring shots: dark films write `theme: "dark"`, or put the film's background into `safe.fill` (the chart follows it, switching to light text on dark); white-background reports belong only in films that are already white paper or web pages. Better: draw the chart onto an object in the film's world — `--alpha` gives a transparent clip to paste onto an in-frame screen, blackboard, or sheet of paper. Cutting from a night scene to a white-background line chart with a fixed title row gets "disconnected from the film" in review.

## ① Where it applies

- **Use**: growth of revenue/profit/users, stock trends, market-share rank changes (bar chart race), regional comparisons (choropleth), inflection points around an event. When the voiceover contains **specific numbers, dates, comparisons** ("grew 8.7× over five years", "after March 2023").
- **Use**: passages that must feel "credible" — the audience will screenshot and fact-check.
- **Avoid**: only one number (a big number suffices — t2's counter); when the data is unreliable or you would not name a source (better no chart); explaining principles (use t1).

## ② Picture construction

| Item | Value | Basis |
|---|---|---|
| Background | white `#FFFFFF` (Economist web charts); or FT salmon `#FFF1E5`; dark films use `theme: "dark"` (`#0E1116` background, light text, cyan main bars) | Economist 2017 chart style guide; FT o-colors source |
| Layout | **top thin red rule (8px) + red flag top-left (96×22) + bold title (one conclusion) + subtitle (metric, unit) + source bottom-left** | Economist style guide layout example |
| Main palette | ECON RED `#E3120B`, blue `#006BA2`, cyan `#3EBCD2`, green `#379A8B`, yellow `#EBB434`, gray `#758D99`, black `#0C0C0C` | Economist chart palette |
| Emphasis | **one color for the protagonist, the rest fade to light gray** (here: the last bar stays blue, the rest transition to `#C6D2D8`) | Datawrapper "use gray to suppress secondary data" |
| Grid | horizontal gridlines only, fine gray (here α0.13, 1.5px); **only the zero baseline is a black solid line** (3px); y-axis tick values sit above the right-side gridline | Economist style guide |
| Fonts | The Economist uses Econ Sans (Cnd); here Roboto Condensed (numbers) + Noto Sans-class (Chinese). Title 700, subtitle/axis 400; axis text smallest, source smallest and lightest (75% black) | same |
| Up/down colors | **mainland-China A-shares: red up, green down** (this film); Hong Kong and Western markets: green up, red down. For Chinese-speaking audiences the chart must state "red up, green down"; colorblind-safe alternative: blue/orange + ▲▼ symbols | Jiang et al. 2014 (JBDM); Bloomberg terminal colorblind mode |
| Line width | main data line 5px (here), moving average 4px; annotation leader 2px | — |
| Shape language | rectangular bars, polyline + end dot, candle bodies + wicks, small dot + leader annotations | — |

## ③ Motion paths

- **Order (staging)**: layout 0–0.5s → gridlines drawn left to right one by one (lag 0.12, easeOutQuint) → x labels fade in and rise one by one → data → emphasis color change → annotation. Each stage ~0.5–1.3s. Heer & Robertson 2007: complex changes are staged, always eased, each step "as long as it needs" ≈1s; axes before data is industry convention (no empirical study, but it lets the audience learn the "ruler" before reading the "quantity").
- **Bars**: grow from the 0 baseline, easeOutQuint, staggered (lag 0.22, 1.3s total); value labels ride the bar tops with synced counting (`CH.bars`).
- **Line**: draws by **x (time)**, not arc length — time flows uniformly so steep segments draw faster and "the surge" reads; a 9px dot + price label rides the head (tabular digits); area gradient α0.14→0. Here 1.5s, smooth (the last price "lands" on the point). D3's official example is 5000ms linear — fine for standalone charts; video compresses to 1.5–2s.
- **Annotation**: triggers the instant the line head **passes** the event point (`tHit` computed from the easing's inverse) — the dot pops (spring d0.45 bounce0.25) + one pulse ring → the leader draws 0.12s later → text fades in 0.3s after. **One shot annotates one thing**.
- **Candles**: appear one by one (lag 0.06, 0.2–1.3s), bodies growing open→close, wicks expanding after; volume bars sync; the top-right price rolls with "the newest candle", colored by the move relative to the window's start.
- **Numbers**: count-up with easeOutExpo (CountUp.js default 2s; video 0.9–1.3s); all rolling digits tabular to prevent jitter.
- **Camera**: the camera holds once the chart lands; no uniform slow push; camera moves go where the voiceover points: slow push ~1s, or 0.7s glide to the next data group; punch 0.28s only for the film's one or two most critical numbers; during push transitions the camera keeps moving vectorially (never scaling a bitmap). The demo's uniform 1→1.03 push per shot is old practice — do not copy it.
- **Rank race (unused here)**: D3's official bar chart race: 250ms per keyframe, 10 interpolated frames between keys, 12 bars shown; position swaps ~0.5s; rank changes stagger so bars do not all jump at once.

## ④ Transitions (the common 5)

1. **Panel slide (slidePush)**: the new panel pushes in from the right while the old exits left, a brand-red vertical bar leading, 0.5s, `cubic-bezier(.7,0,.2,1)`. Here shots 1→2. The new panel starts assembling its layout during the push (red rule growing, title emerging).
2. **Push into detail (zoomThrough, live + bScale0)**: the camera pushes 6× around the newest data point (the old shot redraws vectorially), the new picture (the last 20 days of candles) dissolving in from 0.6×, its subject (the newest candle) aligned to the push point. Here shots 2→3. Without a round opening, always set `bScale0`, or the new picture floats like a small card in the middle.
3. **Morph between charts**: same data, new shape (bar → dot → line); move into position first, then morph (Heer & Robertson: scatter→bars translate then morph; stacked→grouped widens then drops). **Never morph between different metrics** (a revenue bar becoming a stock line implies the same units).
4. **Axis re-labeling**: when the data range changes, change ticks first (old ticks fade out, new fade in), then move the data.
5. **Hard cut with layout held**: same layout, new chart; the red rule/title do not move, only the content changes — The Economist's videos use this most.

## ⑤ Rhythm and text

- **Shot lengths**: one chart 2.5–6s; here 2.8/2.7/2.5s is a compressed version (in real use, one chart carries one or two voiceover sentences). Narrative shape: establisher → trigger → peak → resolution (Amini et al. 2015, 50 professional data videos).
- **Counterpoint with the voiceover**: numbers **land exactly when spoken** — bars finished, the label resting on 107.9 the moment "one hundred seven point nine" is said; annotations pop as the line passes the event, matching "after the March 2023 model launch". So fix the voiceover time points first and work the animation starts backward.
- **Text**: the title states the conclusion ("Revenue grew to nearly 9× the original in five years" — **"grew to", not "grew by"**: 8.7× means 8.7× the original = grew by 7.7×; review caught this), the subtitle states metric and unit ("annual revenue, RMB 100M"); the multiplier must be computable from the chart's numbers (107.9÷12.4=8.70); a non-zero axis is stated in the subtitle ("y-axis does not start at 0"); the source line sits bottom-left; fabricated data carries the "sample data" badge bottom-right in every shot.

## ⑥ Implementation notes

> After admission to the skill (2026-10-04 v0.4): this card's "newly written" general functions were unified into `scripts/engine/lib/` (renamed to the unified MO / CAM / DG / TY / CH / UI / CL / TOON); the demo film's own code is in `scripts/engine/demos/t3_finance_chart/`. The library quick reference and "how to choose a grammar for a voiceover segment" are in `references/09-video-animation-grammar.md`.

- Reused from the skill: `engine.js`, `render.py`, `U.rng` (all fabricated data is seeded and reproducible), `PAINT.hex`.
- Newly written `lib/chart.js` (`window.CH`): `lin` (scale with `inv`), `ticks` (1/2/2.5/5×10ᵏ ticks), `grid` (gridlines drawn one by one, zero line bold, tick values right-placed), `xLabels`, `bars` (grow from 0 + synced count + highlight/dim), `line` (by x, head dot, area), `yAt`, `candles` (per-candle, up/down colors configurable), `callout` (point → leader → text), `tag` (red flag), `demoBadge` (sample-data badge), `mixHex`.
- `lib/motion.js`: `lagged`, `quintOut/expoOut` (called easeOutQuint/easeOutExpo in the experiments), `spring` (annotation dot); `TY.count/tabular/fmt`.
- Transitions (now in `transitions.js`): `slidePush`, `zoomThrough` (live, bScale0, focus).
- Event timing: `tHit = start + duration × smooth⁻¹(event x-share)` (bisection inverse), so annotations always sync with the line head and changing the line's duration needs no hand retuning.

## ⑦ Representative works and primary references

- Representative: The Economist's web charts and videos; FT charts; Bloomberg Originals / Quicktake data segments; Flourish's bar chart race.
- Economist chart style guide 2017 (mirror): https://sa.ipaa.org.au/wp-content/uploads/2026/02/Economist-CHARTstyleguide_20170505.pdf
- FT palette source: https://unpkg.com/@financial-times/o-colors/src/scss/_palette.scss
- Heer & Robertson 2007, Animated Transitions in Statistical Data Graphics: https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf
- D3 bar chart race: https://observablehq.com/@d3/bar-chart-race-explained
- Correll et al. 2020 (the exaggeration effect of truncated axes; even axis markers do not save it): https://arxiv.org/abs/1907.02035
- Datawrapper: bars from zero https://www.datawrapper.de/academy/why-our-column-and-bar-charts-start-at-zero ; dual axes https://www.datawrapper.de/blog/dualaxis ; colorblindness https://www.datawrapper.de/blog/colorblindness-part2
- Cultural differences in red-up/green-down: https://onlinelibrary.wiley.com/doi/10.1002/bdm.1800
- CountUp.js (easeOutExpo, 2s): https://github.com/inorganik/countUp.js

## ⑧ The 3 easiest mistakes

1. **Truncating the axes.** Bars always start at 0; lines and candles may start elsewhere but must say so on the chart. Tufte's Lie Factor (graphical effect ÷ data effect) beyond 0.95–1.05 counts as distortion.
2. **Too many colors; everything is the protagonist.** One color tells the story, the rest go gray; who red/green means what must be stated for the audience (A-shares red up; Western markets red down).
3. **Animation so fancy the numbers cannot be read.** No bouncing bars, 3D bars, rotating pies; stage it, ease it, ~1s per step; hold at least 0.5s after numbers land so people can read.

## qa numbers (skill `scripts/qa.py`, 2026-10-04, pre-review)

| Shot | Motion% | Still pairs% | Jumps | Mean/peak ms | Deterministic |
|---|---|---|---|---|---|
| t3_s1 | 1.39 | 0.0 | 3 | 1.3/1.9 | ✓ |
| t3_s2 | 2.37 | 4.7 | 0 | 1.9/2.8 | ✓ |
| t3_s3 | 0.96 | 0.0 | 0 | 1.6/2.3 | ✓ |

Note: t3_s1's 3 "jumps" at lt 2.10/2.20/2.27s are exactly the frames where four bars turn blue→gray together (highlighting the protagonist) and the annotation pops — intentional large-scale change, not glitches.

## Revisions (independent review → one fix round, 2026-10-04)

| Review finding | Fix |
|---|---|
| 🔴 The title "grew nearly 9×" disagreed with the 8.7× annotation (should be "grew to") | changed to "Revenue grew to nearly 9× the original in five years"; the stock page states "grew to 7.5× the original" the same way |
| 🔴 The monthly-line end ¥268 did not match the daily K 286.40 (the push was into exactly that point) | monthly end = latest price 286.4; the second-to-last month's close = the daily K's start 242; **numbers across two shots must be mutually derivable** |
| 🟡 At 5.6s "¥268" and the counting price showed as two overlapping red numbers | the stock price's head label retracts within 0.2s of the push transition starting |
| 🟡 "Volume" pressed the candles and the volume bars touched the 240 gridline | the label moved to clear space at bottom-right; volume bars normalize to the max with a 6px gap |
| 🟡 The daily-K page could not be read in 2 seconds | dropped the 5-day moving average; candles finish in 1.3s, the parenthetical lands at 1.75s, hold 0.75s |
| ⚪ Red-up/green-down clashes with the brand red | kept (for A-share audiences); the subtitle states "red up, green down (A-share convention)"; an overseas version switches to green-up or blue/orange |

Post-revision qa:

| Shot | Motion% | Still pairs% | Jumps | Mean/peak ms | Deterministic |
|---|---|---|---|---|---|
| t3_s1 | 1.44 | 0.0 | 3 | 1.3/1.7 | ✓ |
| t3_s2 | 2.45 | 4.7 | 0 | 1.9/2.6 | ✓ |
| t3_s3 | 0.91 | 0.0 | 0 | 1.7/2.9 | ✓ |
