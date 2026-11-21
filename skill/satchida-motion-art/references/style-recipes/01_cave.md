# 01_cave · 40,000 BC Cave Rock Art (pure code)

File: `scenes/01_cave.js` (~330 lines). Final performance: warm max 22ms / mean 21.1ms; cold (cache build) happens at engine boot; determinism passes; motion diff at 0.2↔0.7s is 3.9% of pixels.

## Pipeline
1. **Rock wall (all cached as `cave_relief`/`cave_bg`)**
   - Height field computed at half resolution 960×540: `fbm(x·0.0022,4oct)·1.0 + fbm(x·0.011,3oct)·0.16 + noise(x·0.05)·0.03` (coordinates in full-resolution pixels).
   - Finite differences ×52 give normals; light L=(-0.55,-0.62,0.56) (upper left); `shade = clamp(0.5+(dot-0.56)·0.9)`; base color blended between `#ce925a` (bright ochre) / `#6e4426` (dark) / `#b6643a` (red patches) with two low-frequency fbm layers, then ×(0.72+shade·0.55). Upscaling to full screen uses smooth interpolation → soft relief.
   - Two `P.grain` layers stacked (dark 0.22 density α0.32, bright 0.10 α0.28) for grain; 10 random-walk cracks (turn ±0.45rad per step, step 14–40px, 12% chance to fork), with a bright line offset +1.6px underneath the dark line → carved-in look.
   - Vignette: radial gradient r 260→1180, outer ring α0.8; a static warm light at center uses lighter (α0.36) to light only the rock wall.
   - **Pitfall: once the mid-frequency coefficient of the relief grows (0.35, normals ×60), the whole wall turns into camouflage/dunes and the figures layered on top look like camouflage fatigues**. Only after dropping the mid-frequency to 0.16 and normals to ×52 does it read as rock.
2. **"Pigment soaked into the rock"**
   - Every shape uses one drawing method `shape()`: first stroke with the **fuzz pattern** (sparse charcoal dots, width 2lw+7) → then stroke with the **ink pattern** (charcoal black, 7% random holes + big holes where noise >0.58, width 2lw) → finally a flat fill covering the inner half of the ring. Effect = solid charcoal line + spattered rough edge, and painter order handles occlusion naturally (arm covers the coat's line).
   - Charcoal "boiling": the two 256 patterns are randomly translated once every 1/9 s with `pattern.setTransform`; geometry stays, grain jumps — cheaper than jittering paths and does not deform them.
   - After the whole pigment layer is drawn, `source-atop` a `cave_figtex` overlay: rock shadow → black α(0.5-v)·150, bright spots → warm white α(v-0.5)·50, dark/bright grain, low-frequency damp/dry blotches α≤70. **The pigment layer has only one full-screen composite**, hence 19ms.
   - Fills are all opaque flats; color gets "dirtied" by the texture. Do not overlay pigment with multiply — the chalk white (the cat's white) would vanish.
3. **Negative-space handprints/paw prints**: a 320² temp canvas gets Gaussian spatter (σ46 · 3200 points α0.15–0.6 + σ28 · 1400 points), then `destination-out` a solid hand-shape mask, finally the mask fills `#f6e2bc` at α0.3. **The hand shape must be filled block by block into the mask**: adding the palm ellipse and finger capsules into one Path2D and filling once cancels out where subpath winding is opposite under nonzero, leaving gaps (hit in r4).
4. **Firelight**: each frame one radial-gradient layer, center (1000+40·noise(t·3.1), 540+26·noise(t·2.3)), intensity `0.13+0.09·noise(t·8.5)+0.04·sin(21t)`, **composited with overlay** (α = intensity×2.6). On top, another vignette that breathes opposite to the firelight. Pitfall: initially used lighter — the girl's blond hair and hide got washed to pink-white and lost ochre saturation; switching to overlay brought the color back.
5. **Embers**: `P.particles`, three groups (left 0–360 ×11, right 1540–1920 ×12, middle ×5), y drifting from 1110 to 120, life 5.5s; bright core r 2.2–4.6 + 3.2× halo, `|sin(6t+1.9i)|` flicker, `sin(q·π)` fade in/out at both ends, lighter composite.

## Motif animation
- **Bison/horse two-pose cycle**: `ph = floor(t·60/7)%2` (switches every 7 frames); two endpoint coordinate sets for legs (extended/folded), head rotating ±0.07rad around the neck point, whole body y alternating -3/+1px; horse phase-opposite to bison. Legs are charcoal lines only (as in the original), body a filled silhouette + one 22px dark wash along the spine (Lascaux-style shading).
- **Holding the cup**: did not use the RIG cup trajectory (table→mouth, with the table point at the girl's chest — unlike the original's "arm extended holding mid-air"). Custom: `hold=(1084,506)` → `mouth=HP(1224,380)`, progress `k = choreo(max(0,lt-0.95)).cup` (choreo curve shifted 0.95s, matching the original's cup raise at frame 58); arm uses `RIG.ik2(G.A.shoulder, cup+(34,10), 170,128,-1)`; `RIG.girl({cup:k})` still handles head tilt-back and the slight lift while drinking. k reaches 1 at lt≈1.85 (end of transition T01).
- **Steam**: three charcoal lines `x0 + sin(13q − 11t + 1.3j)·6`, height 58px, following the cup.
- **Cat**: RIG.cat head/eyes/nose/earInner/stripes/tailPts anchors + hand-drawn pear-shaped body, white chest, white forelegs, thigh arcs; tail = fuzz/ink/orange triple stroke + one cross-band every 4 sample points; blinking comes from choreo.blink.
- **Cat size (fix from review)**: at original RIG.cat size the ear tips sat at y≈535, poking into the mural frame's bottom edge (550). The whole cat was scaled 0.86 with a canvas transform anchored at the paw base (540,905) (translate→scale→translate; RIG.cat itself stays s=1), so ear tips land at y≈582, leaving ~30px above the frame bottom, paws unmoved. Line widths scale ×0.86 — no visible difference.
- **Title**: `Kalam-700` 78px letterSpacing 7, horizontally scaled to 930px width, `#9b2a18`, drawn into the pigment layer (so it also takes the rock texture). α = t<0.933 ? 1 : 1-(t-0.933)/0.2.

## Motion-pass redo (review metric: static segment frames 21–84, 480×270 per-frame mean frame diff)
Replica 0.62 vs original 0.86 — too static. Added local motion only, no full-screen flashing:
- Firelight: intensity `0.14+0.11·noise(9.5t)+0.04·sin23t+0.03·sin37t`, center wandering ±60/±36px (original ±40/±26). Tried bigger (±0.16, ±90px) — hit 1.22 and the frame swayed; dialed back.
- Embers 28→49 (left 20, right 20, middle 9), bright core r 2.6–5.4, halo α0.32 at 3.6×, flicker `0.3+0.7|sin|`.
- Handprints pulsing: each handprint overlays an r=105 warm radial gradient (lighter), α=0.2·clamp(0.5+0.9·noise(7t+3.7k)), each with its own phase.
- Bison/horse bobbing ±3→up/down 9px, left/right ±3px, head swing ±0.12rad.
- Cat head micro-motion (matching original frames 65–81): at lt 1.08–1.35 a `sin(πq)` envelope lifts the head, rotating −0.16rad around the neck point (596,680), RIG.cat look pushed to 1.5, ears micro-shaking ±0.06rad at 60Hz.
- Result: **0.62 → 1.06** (original 0.86); max 22ms per frame.

## Period-appropriate girl
Red ochre `#9c3520` silhouette (face/neck/arms/calves); profile face keeps only one almond eye (off-white sclera + black pupil + one lash, blinking becomes an arc) — this stroke is the key to "girl-ness"; blond hair filled in yellow ochre `#cf8f2c` + 6 wavy strands in `#6e3c0e` (amplitude growing with length), outline also wavy; the lower half of strands gradually stops following head rotation (HB function), so the whole hair mass doesn't whip when she tilts to drink. Knee-length hide dress = G.torso + hand-drawn hem (a ±16px jagged fur edge every 15px), `#b06a2c` + 26 "round spot + 7 small dots" leopard marks + 18 short hair strokes; seams are hidden by "stroke both pieces' edges first, then fill them together".

## Palette
Wall `#ce925a/#6e4426/#b6643a`; charcoal `#21150d`; red ochre `#9c3520`/dark `#74261a`; yellow ochre (cat) `#c9772f`; blond hair `#cf8f2c`/`#6e3c0e`; hide `#b06a2c`/spots `#4e2610`; chalk white `#f0dfbf`; bison `#8c3d22`/head `#76301a`; horse `#cf8236`; stone `#c98c50`/`#c08048`; tabletop `#d49a5a`; handprint `#8e2a1a`; ember `#ffe082`.

## Still improvable
- The girl's body uses the RIG's realistic curves — "too smooth" for a true rock-art figure; the more primitive approach is downsampling outline points to 12–16 and adding heavy hand-drawn jitter.
- The rock relief is static; firelight changes brightness but not shadow direction. A true "rock relief moving under flickering fire" needs two shade maps with different light directions interpolated by the firelight (+1 full-screen composite).
