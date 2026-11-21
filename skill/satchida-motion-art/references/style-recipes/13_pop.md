# 13_pop · 1962 Pop Art (Lichtenstein comic panel + Warhol four-grid)

File: `scenes/13_pop.js` (~230 lines). Performance: warm mean 6ms, max 9ms, first frame ≈45ms; determinism passes; motion diff lt 0.34→0.46 moves 11.6% of pixels. Segment hold 0.47s (T12 yellow-lightning dot-rasterization transition 0.16s).

## Pipeline
1. **Ben-Day dots = `createPattern`, zero cost**: a pitch×pitch small tile with 4 corners + center = 5 circles makes a 45° grid (diagonal spacing pitch/√2). Wall: pitch 24, r5.6, white on blue `#2f5cc8` (diagonal 17px, matching the 17px period measured from the original by FFT); skin: pitch 13, r3.3, red `#e2483c` on skin tone `#fae0cc`; yellow floor: pitch 14 r2.2 α0.18 faint print dots. Skin uses `fillStyle = pattern; fill(path)` — two orders of magnitude faster than `PAINT.halftone` (per-point getImageData), and the pattern aligns to screen coordinates so it doesn't "swim" as characters move.
2. **Base plate fully cached `pop_bg`**: comic panel outer frame 6px black; white baseboard 754–792 (6px black lines above/below); yellow floor 796→990/1003 (horizon slightly slanted); red band; MEANWHILE... (`Bangers-400` 46px, yellow ground black frame 5px); Warhol white picture frame + windowsill blue line; blue chair; paper grain.
3. **All characters are "heavy black outline 5px + flat fill"**, one function `ink(c, path, fill, lw)` all the way; highlights are white heavy short strokes; shadows use `hatch()`: inside an ellipse clip, black diagonals at 10px spacing, 3.5px wide.

## Motif animation
- **Warhol four-grid recoloring**: 4 color schemes (ground/face/lower face/eyeshadow/lipstick), `step = floor(lt·11)` (≈ every 5.5 frames, original swaps at frames 601, 605/606, 612), cell i uses scheme `(i+step)%4`. Cat face = RIG.smooth's 9-point head shape + lower-face ellipse + right-side black block (the silkscreen's misregistered shadow) + eyeshadow/lipstick/nose/whiskers; the upper-right cell gets two white glass reflections.
- **Thought-bubble dots flashing in sequence**: original "dot 1 frames 612–615, dot 2 614–617, dot 3 616–618" → one 12-frame cycle, dot k lit when `((f-2k) mod 12) < 4` (r20, hopping 6px), else r12. Bubble = 10 circles all stroked 11px black first, then all filled white (cheapest way to get the union outline).
- **WIGGLE WIGGLE explosion box jitter**: 30fps stepping hash jitter ±8px/±6px/±0.03rad; outer white explosion (14 points, radii 128/178 randomized) + inner yellow explosion + two lines `Bangers-400` 82px red text (12px black stroke + 4px black drop shadow); 10 black triangle action lines around, length pulsing `0.85+0.25·sin(40lt+2i)`.
- **Cat hip-swiveling, ready to pounce**: RIG.cat anchors period-adapted — crouched low: body a 10-point custom contour (origin at `K.box`), head `K.headC + (22,104)` lowered into the body, forepaws white ellipses reaching forward; swivel: `wig = sin(lt·2π·6)·16` (6Hz, ~3 times in 0.47s), point weights `clamp((560-x)/140)` → displacement grows toward the rear, hips lifting `|wig|·0.6` at the same time; stripes and tail follow the same deformation; three curved action lines beside the haunches move with wig.
- **Girl with cup**: RIG IK cup hold; cup = white cup + blue diagonal stripes + coffee; steam two black wavy lines jittering at 14Hz.

## Girl (Lichtenstein)
- Big blond waves: hair mass (19-point smooth, rear edge bulging `sin(2.1i+4t)·14`) + 7 curl circles (r30–48, along the rear edge), **all stroked 10px black first, then all filled yellow = union outline**; each curl contains one 4.5px black C-arc + one deep-gold `#d9a514` arc = Lichtenstein's sculptural curls; 5 black S-strands, 2 white highlights.
- Skin (face, neck, hands, legs) all red Ben-Day dots; red dress (cut at the knee, hem clipped with a curve not a rectangle) + white highlight band; two dotted legs + red heels (7-point polygon); big eyes (white eye 12×8.5, blue iris r7, highlight dot) + 3 heavy lashes + brows raised 5px; red lips enlarged.

## Palette
Black `#141414`; paper `#f3eedb`; blue `#2f5cc8`; yellow `#f7d52c`; red `#d8232a`/`#a8161c`; white `#fbf8ee`; skin `#fae0cc` + dots `#e2483c`; blond hair `#f8d62c`/`#d9a514`; cat `#f39a2c`/`#c4561a`; Warhol grounds `#9ccf3a/#e0359a/#2fc0b0/#f08a2a`.

## Pitfalls
- The cat head drawn at RIG's original position floats above the lowered body (a gap); in the crouch the head must move down ~100px into the body.
- V1 hair was one yellow sheet with slight waves — from afar like a draped cloth. Lichtenstein's blond recognition comes from "curl circles + black C-arcs".

## Still improvable
- The original's girl has a teardrop and white collar (the classic Lichtenstein crying girl); the design sheet removed it and I didn't add it either. For a more "comic" feel, add a speech balloon.
