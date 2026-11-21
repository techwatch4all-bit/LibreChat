# 22_constructivism · 1924 Russian Constructivist poster (Rodchenko / Lissitzky)

> Source: migration test B (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/22_constructivism.js`.

Filename during the experiment: `scenes/c1_constructivism.js` (~175 lines). Median 5ms per frame; frame diff 3.6%.

**Pipeline**
1. Base plate fully cached `cs_bg`: aged cream paper (`P.texture` `#e9dfc4`, dark `#d9c9a4`) → left slanted black bar (rotate −0.5), red square (rotate 0.26), 5 rows of "body text" black bars → right fine diagonals, red dot, black vertical bar with vertical geometric letters "ЧАЙ" → big black circle behind the figure's head (center (1330,395), r 215) → slanted red ground (0,905)→(1920,856) with a 12px black line along its top → window → black table (red edge, diagonal brace) → black block stool.
2. **Window = photo collage**: first draw a grayscale "photo" offscreen (sky gradient `#5e5e5e→#e8e8e8`, radial white clouds, dark factory silhouettes, chimneys), then halftone it with `halftone()` (cell 7, gain 0.8); the Shukhov Tower is drawn in crisp black lines over the halftone (five hyperboloid sections, each with two groups of 18 straight generators, phase offset ±1.1rad, back-face lines with sin<−0.2 omitted) — exactly the "photo + hand-drawing" collage.
3. **Skin = halftone photo**: face, neck, hands first painted as grayscale gradients (bright front, dark back, `#fafafa→#9c9c9c`) offscreen, then halftoned (cell 4.6, gain 0.74, 45°). Cream beneath the dots; the outer rim first stroked 7px `#fbf7ea` — that ring is the photo's cut-out white border. Features added in crisp black strokes; lips colored red by hand. Clothing is all cut-paper flat fills + 3px black lines; shadows use `shadeDots()`, dropping halftone dots inside paths by a density function.

**Key functions**
- `halftone(c, src, bx,by,bw,bh, cell, col, gain, ang=π/4)`: samples src's grayscale on a rotated grid, dot radius = cell·gain·√(1−L), only where alpha>128. **All dots merged into one path, filled once**. The face is ~3000 dots, <2ms.
- Geometric Cyrillic letters: 5×7 modules, each letter a set of rectangles or polygons (Й's slanted stroke is a quadrilateral, the breve a small rectangle above). **Each part filled separately**.

**Motif animation**
- Lissitzky's red wedge stabbing the black circle: apex travels along the 0.34rad axis, `70·(0.5−0.5cos(2π·1.6·lt))`.
- Red dashed ring outside the black circle: dash [46,22], `lineDashOffset = −260·lt`.
- Radio waves from the tower top: 4 red arcs, `r = 18 + ((1.4lt + k/4) mod 1)·230`, alpha and width decaying with phase.
- Ground slogan "ПЕЙТЕ ЧАЙ!": stamped letter by letter (letter k starts at 0.045k seconds, shrinking 1.5×→1 within 0.12s), afterwards the whole row wave-jumps `−10·max(0, sin(11lt − 0.8k))`; every 4th letter is black.
- Kerchief's two tails swaying `sin(9lt)·6`; cup steam three black polylines rising.

**Characters**: a Komsomol girl — red kerchief (13-point local head shape, front edge pulled back enough to show blond fringe, knotted at the nape with two triangular tails), white blouse + red neckerchief triangle + red cuffs, dark-gray long skirt (halftone shadows). Cat in cut-paper orange `#e2741c` + cream, 10px black stripes, tail tabby via dashed stroke, eyes square vertical-bar pupils.

**Palette**: paper `#e9dfc4`; red `#c8231c`/`#8f1711`; black `#151311`; cream `#f4ecd6`; blond `#e3b03e`/`#a87a1c`; cat orange `#e2741c`.

**Pitfalls**
- Й's breve in v1 was drawn above the letter cell (y=−1.7u): vertical stacking hid it under the previous letter and the skirt covered it in the ground slogan, reading "ЧАИ". Fixed by fitting the whole letter inside 7 cells (И part shifted down 1.7 cells), and the slogan is now painted above the characters (poster type over figures).
- А in v1 was two opposite slanted legs + crossbar merged in one path — the overlap canceled under nonzero, reading "В" when vertical. Fixed by filling parts separately.
- Ground slogan's baseline was at y=1060 in v1; letter bottoms went off-frame. Positioned by letter center with `translate(x, 990)`.
- Cheekbone shadow in v1 too heavy; after halftoning it looked like a mustache. The grayscale source's shadow alpha should be half of what flat fills use.

**Still improvable**: Rodchenko's more canonical form is "figure photo + horn-shaped text cone". The steam could become a red-black wedge text cone radiating from the cup mouth.
