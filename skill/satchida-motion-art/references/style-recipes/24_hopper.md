# 24_hopper · 1942 Hopper American realism (hard light blocks)

> Source: migration test B (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/24_hopper.js`.

Filename during the experiment: `scenes/c3_hopper.js` (~150 lines). Median 13ms per frame (first frame 54ms); frame diff 6.0%.

**Core technique "dual-version clipping"**: one `room(g, K)` function paints two caches with two color schemes — the backlit version `SH` (cool green walls `#5d8679`, dark floor `#5b3d2b`) and the lit version `LT` (warm yellow walls `#efcf8f`, bright floor `#c98b52`). Each frame first paints the backlit version, then clips the lit version into a moving light-patch polygon; light/shadow edges are naturally hard and the patch can translate as a whole. Characters and furniture likewise: `girl(c, K, G)` paints once in backlit colors, then once clipped into the diagonal light band in lit colors.

**Light-patch geometry** (dx = 30 − 95·easeInOut(lt/1.25), moving left ~95px over 1.2s)
- Wall patch WP: (1420+dx, 250) → (1920, 470) → (1920, 730) → (1420+dx, 730)
- Floor patch FP: attached below the wall patch, spreading toward lower right
- Figure light band OP: left edge from (1345+dx, 0) to (1185+dx, 1080). The light edge sweeps across the girl's face in this span, from half-face backlit to full-face lit
- Window-mullion shadows: vertical bars 24px + one diagonal bar parallel to the patch's top edge
- **The figure's cast shadow on the wall** = the figure silhouette translated (+150, +18), painted into an offscreen, `source-in`-filled into the backlit base, then painted back into the patch region. The effect is the backlit wall showing through inside the light patch, in sync with the figure's pose.

**Motif animation**: slow light-patch drift (the core); outside the window, the barber pole of the red-brick building across the street (homage to "Early Sunday Morning"), red-blue diagonals scrolling upward at 60px/s; shade-cord swaying `sin(4.2lt)·0.07rad`; 26 dust motes inside the light band (shown only right of the light edge); steam.

**Texture**: oil drag-brush uses vertically elongated fbm (x·0.06, y·0.006) dominant with diagonal as support, generated at 1/4 resolution then upscaled, `soft-light` α 0.2. Outside each window opening, a 10px hard shadow on the right, shades pulled to different heights (0.25–0.7) — Hopper's details.

**Palette**: backlit wall `#5d8679`, wainscot `#4b6d63`, floor `#5b3d2b`; lit wall `#efcf8f`, wainscot `#d8ad68`, floor `#c98b52`; dress backlit `#7a2c2a` / lit `#cc4a3c`; blond hair backlit `#a8893f` / lit `#f3d67e`; brick `#b4553a`.

**Pitfalls**
- V1 brush marks used horizontal fbm at α 0.35 — the wall looked like watered marble. Hopper's walls are flat; brush marks can only be barely-there.
- While editing code, a comment was inserted into the middle of a line, commenting out the rest of that line (watch for this in Python batch edits).

**Characters**: v1 was an updo + long red dress; review said "reads as an adult woman, not 17". Changed to shoulder-length loose hair (`hair:'long'`) + a blue headband, and she reads young. The cat's white chest uses a smooth ellipse; backlit white `#dcd6c8` (v1's `#c4bdac` read as a gray-white cat).

**Still improvable**: the cat is in shadow the whole time and reads dark (a trade-off for the loneliness). Could give the cat a small patch of light from the back window.
