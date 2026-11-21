# Transitions added by the migration tests (A–D)

<!-- From migration test A -->
## Transitions (new block at the end of `transitions.js`)

| Transition | Enters | Technique and parameters |
|---|---|---|
| `goldLeaf` 0.5s | Klimt | 72px blocks. Order key = distance from the girl's head (1300,380) ×0.78 + azimuth ×0.12 + random ×0.08, so the gold leaf spirals outward. Each block q = (1.32p−key)/0.32: for q<0.5 a gold flake lands from 1.3× scale with rotation, a gold-gradient highlight moving with q, pressed with spiral, eye, or concentric-circle dark patterns; for 0.5<q<1, B is revealed as the flake fades out. |
| `screamWarp` 0.5s | Munch | The old painting warps per-row by sine, amplitude 70e. The wave front `y = lerp(−180, H+220, e) + 80sin(x·.0055 + 7p)` pushes from top to bottom; above the front is the new painting (its warp 60(1−e) settling). The front presses 4 bands of 26px color: `#b82a1e #e2541c #f08a24 #f4c03a`. |
| `apsara` 0.5s | Dunhuang | Front `x = lerp(W+260, −300, e) + 110sin(y·.006 + 5p)` sweeps right-to-left; the right side is the new painting. On the front ride 3 streamers (malachite green, earth red, azurite, widths 44/38/32, traveling wave, white dashed floral tracing). Left of the front, the old painting's fragments (taken directly from A's pixel blocks) tumble down on parabolas — the "old paint flaking off". |
| `dotBloom` 0.48s | Kusama | 58px hex grid; dots grow from the cat (540,760) by distance order (outBack, maxing at 0.74 spacing — just covering the frame), each dot clipping out the new painting. Not-yet-full dots carry a white outline fading gradually. |

---

<!-- From migration test B -->
## Transitions `transitions_b.js`

| Enters | Name | Technique | Parameters | Per frame |
|---|---|---|---|---|
| Dali | `melt` | The old frame sags down in 4px vertical columns (`sag = 0.22·edge·e`, stretched 0.3); the new frame sits above the liquid surface edge(x), where edge = an overall falling line (−160 → H+40, easeInOut) + 26 round-headed droplets (width 10–32, length 60–280, profile `(1−u²)^0.3`, each with its own start phase) + a sin wave; the surface gets a dark edge (blur 3) + highlight | 0.36s | 86ms |
| Hopper | `sunShaft` | The old frame `multiply` cool green `rgba(70,120,110, 0.7·min(1,2p))` sinks into shadow; a slanted light block (slope 260px) sweeps its right edge across the screen, containing the new frame + `screen` warm light (0.45 → 0 receding within p 0.6–1) + one window-mullion slant shadow traveling with it; a bright edge on the leading rim | 0.34s | 76ms |
| Ghibli | `bleed` | 5 color blooms open in sequence by t0 (the window opens first), radius `q·1400·k`, q=easeInOut(seg(p,t0,t0+0.66)), boundary `R·(1 + 0.28·fbm(angle) + 0.05·sin 9a)`; outside, a 70px blur-18 bright halo (the water arrives first), inside is the new frame, edges 5px `multiply` brown water stains. Halo and stain alpha both ×(1−q) | 0.38s | 127ms |
| Vaporwave | `vhs` | First half old, second half new; the p 0.38–0.62 span does "vertical sync loss" — whole-frame upward roll + a 40px black bar; tear bands of random height 6–54px sample from A/B (probability of taking B = p), horizontal shift ±130·sin(πp); magenta/cyan single-channel copies offset ±14 with `screen`; 160 snow lines | 0.30s | 88ms |

Common thread: every transition is "the new style's physical process", not a generic wipe — melting is liquid, Hopper is light, watercolor is water, VHS is tape. When designing, first ask: "by what physical process would this style's image appear?"

---

<!-- From migration test C -->
## Transitions (`transitions_c.js`)

| Enters | Name | Technique and parameters |
|---|---|---|
| Monet | `ripple` | (distance denominator 1700; a fill-in fade starts at p>.7 so the corners are clear by p≈.85) The old frame displaces horizontally per 6px row by sine, `dx=sin(0.045y−26p)·46·sin(π·min(1,1.2p))·(0.4+|y−cy|/H)` — like a reflection stirred up. The new frame emerges through a clip made of 3600 **horizontal short-stroke ellipses** (length 40–110, height 9–17), rippling outward ring by ring by elliptical distance to the cup (1000,600) (y×1.9). The front is 3 pale dashed ellipses, dashOffset following p; mid-span 140 water-glint horizontal lines flicker. At p>.85 a fade-in layer tops up. |
| Seurat | `pointill` | Grid pitch 14: dots grow from 0 to r=6.4 (first 30%), the old frame beneath fading to paper color. Each dot's recolor moment `0.5·(0.6x/W+0.4y/H)+0.25·hash+0.15` — upper-left first, with randomness; at the recolor instant the dot jumps 1.35×. From p>.6 the new frame develops under the dots, and from p>.7 they retract. Each frame needs one getImageData each for A and B. |
| Matisse | `cutouts` | A cobalt-blue paper 1100px wide (edges irregular sin cut) sweeps right-to-left, shadow (14,10) blur 12. The paper carries 260 gouache strokes, pinning white/yellow seaweed (stem + 7 fingers), yellow/pink 6-point stars (turning with p), red discs, each with its own shadow. Past the paper's right edge, the new frame is already showing. |
| Haring | `radiant` | A V-shaped dancing figure, scale `s=0.15·320^easeInOut(p)`, magnifying from the cup as origin. First "stroke 30px black + fill black" makes the outer contour, then in an offscreen the limbs fill white and `source-in` the new frame — the new painting inside the body; the outer 16 radiating lines jump at 8fps; a fill-in fade starts at p>.82. V1's exponent was too slow (`0.08·40^…`: only 300px tall for the first 80% of time, then a hard cut); V2's `0.15·120^…` still left gaps at the end, closed by a ~1-frame fade that review judged a flash frame; final: `s=0.15·320^easeInOut(p)`. |

**General transition lessons**:
- Pixel-needing transitions (pointillism, water waves) do one getImageData each for A/B per frame, ~10ms — acceptable.
- For "the new painting hides inside a shape" transitions, once the shape is a multi-segment union, do not `clip(union Path2D)`: inconsistent subpath winding cancels into holes. Instead fill white offscreen, then `source-in`.

<!-- From migration test D -->
## Transitions (segment D at the end of `transitions.js`)

| Transition | New style's signature | Technique and parameters |
|---|---|---|
| `irisFilm` Rembrandt→rubber hose | 30s cartoon's iris in/out + old film | (1) p<0.5: the old frame progressively gains `sepia(q) grayscale(0.7q) contrast(1+0.3q)`, a black iris closing onto the cup rim (1236,420), R = R0·(1 − easeIn(q)), R0 the distance to the farthest corner (2) p≥0.5: the new frame springs open by R0·outBack(q) (3) the circle is 48 segments, hand-wobble ±1.5% at 12fps (4) film flicker, scratches, and dust layered throughout |
| `lampGlow` rubber hose→shadow puppet | Lighting the lamp behind the screen | (1) the old frame multiplies rgba(70,34,12, min(1, 2.2p)), darkening like a lamp dying (2) the new frame reveals through a destination-in radial mask (solid within 0.55R, transparent at the rim), R = 1500·inOut(seg(p, .12, 1)), with flame jitter ±7% (3) a lighter warm glow sin(πp) plus one small flame |
| `flareSweep` shadow puppet→Shinkai | Light leak, light sweep | A slanted (k=0.35) dividing line sweeps −500 → W+700 (inOut). Left is the new frame, right the old. On the divide, 3 lighter light bands: width 520 α0.55 warm, 160 α0.85 white, 60 α0.6 teal. Plus a horizontal streak, 40 light particles, 3 hexagonal ghosts |
| `blueBrush` Shinkai→blue period | Color drained away + broad dry brush | (1) the old frame `color`-blends rgba(45,90,148, min(1, 2.2p)) until only blue remains; then multiply darkens (2) 6 broad strokes (each height H/6+90) staggered ±18, brushing left-to-right in sequence with 0.07 staggered starts. Each head is a quadratic curve, top/bottom edges jittered 6–7px by sine (3) within 80–280px behind the head, 26 dark/light gradient bristle lines (the paint not yet spread evenly) |

The general steps of transition design (suggested for layer 3 of doc 02): find the physical process in the new style that "appears, lights up, sweeps" → use it to "contaminate" the old frame first → let the new frame emerge from that process's shape → add a brief highlight or overshoot on the beat.
