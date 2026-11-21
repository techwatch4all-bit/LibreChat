# 02_egypt · 1350 BC Egyptian Tomb Mural (pure code)

File: `scenes/02_egypt.js` (~460 lines). Performance: warm max 20.7ms / mean 10.5ms (1920×1080); `init()` pre-warms the cache at boot so the first frame no longer stalls 170ms. Determinism check passes.

## Pipeline
1. **Static layer `eg_static` (cached once)**: plaster wall → hieroglyph columns → window (cornice / color-block frame / white field / Aten sun disk / uraeus) → pottery jars ×3 → offering table with offerings → gold chair → blue bowl → floor line and bottom multi-layer friezes → deep-blue band → top/left/right color-block borders.
2. **Moving motifs (drawn every frame, cheap)**: water-glyph text flowing, Aten rays + tip little hands opening/closing, two long rays reaching out to hold the ankh before the cat, scarab pushing the sun ball.
3. **Characters**: redrawn in the Egyptian canon — not via RIG.drawGirl/drawCat; only anchors and choreography are taken from them.
4. **Mural surface**: `eg_surface` mottling layer `multiply` over the full frame + `P.grain` grain + 6 random-walk hairline cracks (cracks are drawn in the surface layer, so they cross over the figures, like real wall aging).

Egyptian murals are "no perspective, flat fills, outline lines"; here **no brush-stroke renderer is used at all**, and lines do not boil (clean 2.2–2.8px dark-brown lines `#2a1810` are what read right). Period feel comes entirely from the canon (profile face with frontal eye, frontal shoulders) + palette + ornament density.

## Palette
Wall `#eadcb8`→mottled darks `#d8c597`; four-color border red `#b8322a` blue `#2a58a8` yellow `#e2b13a` green `#2e8a55`, off-white `#f2ead6` between blocks, black seams `#231a14`; gold `#e0ab38`/dark gold `#a8741c`/bright gold `#f3d27a`; deep blue band `#1c2236`; column-divider red line `#9a2b22`; Aten sun disk `#c8372b`, rays `#c23a2a`, little hands `#b4452c`; skin `#e6b282` (light yellow-ochre of Egyptian women); cat orange `#e08a3c`, stripes `#b45a1c`, white `#f6efe0`; scarab lapis `#2c56b0` + turquoise `#3fa6a0`.

## Hieroglyphs (the most period-defining part)
- Wrote **24 glyph functions** (ankh, sun disk, bread, reed, owl, falcon, heron, horned viper, Eye of Horus, cartouche, scarab, seated figure, leg, arm, basket, house, three bars, feather, djed pillar, shen ring, jar, lotus, nfr, mouth, water), each drawn in 10–20 strokes within a ~50px box, each carrying its own candidate colors. Line width 3.1 (~3px after scaling), `round` caps.
- Column layout measured from the original: left 3 columns x=78..306/y=66..566, upper-middle 4 columns x=852..1172/y=66..452, right 4 columns x=1560..1866/y=252..882, cat-left 1 column x=298..366/y=614..886.
- Placement: seeded `U.rng(1350)`, filling column by column downward, glyph scale = column width/78×(1.0–1.14), spacing 6–11px; **no adjacent repeats within a column, same glyph ≤3 times per column, scarab/water downweighted 60%** (v1 had no limits and the wall filled with scarabs, like stickers).
- Placement is computed at module init and positions stored — so the water glyphs can stay out of the cache and be drawn separately each frame. Floor of at least 6 water glyphs.

## Motif animation (all driven only by lt/t, deterministic)
| Motif | Method | Numbers |
|---|---|---|
| Scarab pushing sun ball | x(lt)=800+642·(lt−0.394), measured 10.7px/frame from the original; modulo 2160 to loop; ball roll angle = center-x/radius; legs two pose sets `floor(lt*15)%2` (switch every 4 frames at 60fps) | Overall ×1.22, ball r=23×1.22 |
| Aten little hands open/close | open=0.5+0.5·sin(2π·lt/0.4+k·0.9), finger spread angle (0.1+0.24·open) | Period 0.4s, 13 in-window + 2 out-of-window |
| Rays trembling | tip x+=3·sin(7t+1.3k), y+=2·cos(6t+k) | ±3px |
| Water glyphs flowing | zigzag phase = floor(lt·12)·0.5, 12fps stepping, 4-step loop | 0.33s/loop, like hand-drawn frames |
| Holding the cup | `cup = lerp(0.8,1,choreo.cup)`: the original "keeps drinking with the cup at the mouth", so only the final 20% of the raise + choreo.sip head tilt | — |
| Cat | choreo.tail tail-flick (RIG.cat.tailPts), blink (t≈2.18–2.30, landing at lt≈0.77–0.89 here), breathe upper body | — |

Motion volume: lt 0.45↔0.9 (avoiding the beat-hit impact zoom) moves 3.5% of pixels, concentrated on ray little hands, cat tail, girl's head/arms, scarab — modest, but all on the line of sight.

## Characters: the Egyptian canon
**Girl** (`RIG.girl({dy:-25})`, dy puts feet on the y=900 ground line):
- Profile face from `G.face`; **frontal eye** drawn by hand: almond white eye + black pupil r4.2 against the upper lid, upper eyeliner 3.2px dragging back 18px (kohl tail), long brow.
- **Frontal shoulders**: torso not G.torso — a wide trapezoid x 1270–1452 drawn by hand (both shoulders visible, wide at top, narrow at bottom).
- White linen: fill skin first, then overlay white at `alpha .9` → a hint of skin shows through = linen translucency; skirt gets 27 fine bezier pleats fanning from waist to hem (clipped inside the skirt, `rgba(120,96,70,.5)` 1.3px), chest pleats spaced 9px.
- Wide collar necklace: 5 concentric half-ellipses (blue/red/green/gold/blue, rx 50→88, ry 24→55), outer ring 18 red/blue alternating drop beads.
- **Gold braided wig**: wig silhouette clipped, 15 vertical braids drawn inside, each = 11.5px dark-gold base + 8.5px gold line + a diagonal herringbone tie every 8px (alternating direction), ends staggered. V1 used round beads everywhere — read as "gold caviar"; only long strips + diagonal ties read as braids.
- Gold headband (bezier 15px black / 11px gold / 3px bright gold) + back-falling band, big gold earrings, gold armlets (gold 8px + blue 2.5px bands).
- **Cup-holding arm**: the RIG default puts the hand at the cup's side and the shoulder mid-torso, throwing the elbow far away. Changed to "hand cupped under the cup (at the stem)", shoulder moved to the front shoulder (1282,476), `RIG.ik2(sh, hand, 140, 160, -1)` drops the elbow toward the chest.
- Blue lotus cup: petal-shaped cup body + three light-blue petal lines + stem, following G.cup's position/tilt.

**Cat = Bastet sitting pose** (`RIG.cat({dy:-5})` provides headC, tailPts, blink, breathe; body drawn by hand):
- Silhouette: upright chest + round haunches, **forelegs wrapped inside the silhouette**, one whole white panel from chest to front paws, then two lines split out the two forelegs + toe lines. V1 drew the forelegs as two separate white columns — bowling pins.
- Head turned to side + tall pointed ears + frontal almond eyes (yellow `#e8cf4a`, vertical pupils, black eyeliner tail), white muzzle, whiskers, gold earrings.
- Collar clipped inside "body ∪ head" (`Path2D.addPath` merge), otherwise the round head's stroke pokes out of the neck; gold Eye-of-Horus pendant.
- Orange tabby: 9 arcs on the back, 4 on thighs, 5 on the head in dark orange, one cross-band every 3 tail sample points, white tail tip.

## Pitfalls hit
- selfcheck's 0.2↔0.7 diff reads "everything moving" in this segment — that's the engine's beat-hit impact zoom (lt<0.36s), not the scene moving. Compare two frames at lt≥0.4 for real motion.
- `P.texture` takes ~170ms to generate the first time; pre-warm it in `init()` (called at engine boot), otherwise it stalls on T01 transition's first frame.
- The rubble chunks in the original reference are transition residue, not scene content — do not copy them (not in the design sheet either).
- Year-plate region 1500–1890×40–210 keeps only wall; the right hieroglyph columns start at y=252 exactly to avoid it.
- Review fix: at the cat's original size, ear tips at y≈530 pressed onto the window frame's bottom color blocks (y 530–560), like the cat's head shoved into the window frame. Fixed by anchoring at the paw base (540,898) and scaling the whole cat to 0.85 with a canvas transform (RIG.cat still s=1), ear tips land at y≈585; both long rays' tips converted with the same transform via `catPt()`, little hands still land on the cat's head/muzzle; topline and haunches shifted forward 12–20px for a longer Bastet sit. **Lesson: aligning cat/person and window frame to the standard composition frame each is not enough — the two frames sit very close at y≈540–600, so parts that exceed the armature box (like taller ears) need their own gap check against neighboring objects.**

## Fix v2: Egypt too static (review report item 3)
Metric: whole-film renderFrame, static segment frames 112–140, 480×270 per-frame mean absolute diff (counter masked). **Before 0.32 → after 0.84 (original 0.90)**, performance warm max 21.7ms.
- **Cup-drinking loop**: lt<0.35 raises to mouth per choreo; after that a loop every 0.6s `cup = 1 − 0.46·(1−cos 2πu)/2` (cup lowered from the mouth to 0.54 then raised back); while at the mouth add a head tilt `sip += 0.3·clamp((cup−0.78)/0.22)·(0.65+0.35·sin 13lt)`, head angle reaching ~0.2rad. This item contributes the most.
- **Inscriptions being written**: every 0.12s take 6 glyphs from a shuffled glyph list (seed 77, across all columns): first erase with a `drawImage` sub-rectangle of the wall texture, then draw the strokes with `setLineDash([p·95, 999])` (each subpath's dash restarts from its beginning — exactly like stroke-by-stroke writing), fill appears only at p>0.55; stroke color falls from bright gold `#f6c846` back to the original with a 10px gold shadowBlur afterglow, finished in 0.36s. About 18 glyphs are being written at any time.
- **Aten pulsing**: period 0.45s; ray lengths oscillate ±9% sequentially across the fan (phase −0.55k, like a wave sweeping), width 2.2→3.8, little hands scaling 0.9–1.2, finger spread 0.03–0.45; gold halo + bright ring pulsing outside the disk, the disk redrawn above the halo to stay red. Little-hand coordinates clamped inside the window (x 428–752, y≤512), otherwise half a hand gets clipped when rays extend.
- **Cat**: tail amplitude `tail·2.1 + 0.25·sin 9.5t`; the two ears give quick out-of-phase flicks (every ~0.38s for 0.1s, rotating 0.32–0.38rad around the ear-root midpoint).
- Lesson: thin-line motifs like Aten rays and water glyphs barely score in a 480×270 frame diff; **testing "visibly moving" needs local motion with enough area** (arm + head, whole glyphs erased/rewritten); thin-line wiggles are garnish only. V1's disk pulse laid translucent orange over the disk, which washed the red disk orange at the peak; changed to an outside halo + bright ring.
