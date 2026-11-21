# 25_ghibli · Ghibli visual family: overall language + existing background implementation


## 2026-10-15 · Overall language research (pending cross-scene validation)

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md). The lower half of this card is engineering experience from one existing room scene; it proves that some watercolor/cel techniques run — it does not represent the whole Ghibli system and is not a composition template for new films.

**Scope first.** "My Neighbor Totoro", "Kiki's Delivery Service", and "Spirited Away" can be used to study figures, hand-painted backgrounds, and everyday motion in different settings; "The Tale of the Princess Kaguya" has clearly different line work and negative-space organization and must not be forced into the same watercolor-background recipe. For production, choose the film/author scope matching the current content; compare clips across different places, lighting, and actions — don't pick only forest vistas. The official [works and scene stills](https://www.ghibli.jp/works/) page can locate references; the [scene-stills release notice](https://www.ghibli.jp/info/013344/) does not equal unlimited usage rights for all material.

**Transferable research dimensions.** (1) Character silhouettes, expressions, and key actions are clear, backgrounds carry their own observation and material detail; (2) characters and environment are compatible in perspective, light direction, contact shadows, and color — it does not require painting both with the same watercolor texture; (3) everyday motion has body weight, an order of using objects, and reactions; (4) environmental motion has causes — wind, gravity, contact; (5) the scene has both habitable structure and narrative use. These are initial research generalizations; parts that fail in a specific film change the scope.

**Content is variable.** Green forests, rural houses, a girl, a cat, brooms, good food, and giant clouds are not required. Subject matter can be a city repair shop, a night-shift transit depot, or a fictional equipment bay. Do not equate "sense of life" with a fixed slow tempo; tense passages also need accurate action.

**Production assumptions.** Start from the current scene's space and light; character design independently validates proportions, silhouettes, and expressions; build a frame library per Method 10 or import assets, then composite and choreograph in code. Background washes are an optional material technique, not "multiply the character sheet by paper grain and call it done". The existing `scenes/25_ghibli.js` is reference for local background technique; characters and new spaces must be redesigned; complex turns or interactions cannot be faked by translating the same image.

**Migration stress tests (todo).** Finding a lost item in a city self-service laundromat; a personless automatic irrigation facility starting up; two adult repair technicians completing an emergency patch inside a space capsule. None are new templates — they only test transfer ability that doesn't depend on forests, girls, and slow motion.

**Backflow.** Record each time: film scope, scene, route taken, image/animation evidence, character-environment consistency and contact issues; when an old conclusion fails, fix the original sentence first. A single-scene pass cannot grade the whole studio. Current status: the existing background implementation keeps its original quality; the overall visual and performance direction is still research.

## Existing watercolor-background example (historical implementation, not a style definition)

> Source: migration test B (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/25_ghibli.js`.

Filename during the experiment: `scenes/c4_ghibli.js` (~270 lines). Median 17ms per frame, **first frame 619ms** (watercolor base cache); frame diff 5.1%.

**Watercolor renderer**
- `deform(pts, depth, amp, r)`: midpoint displacement. Each round pushes every edge's midpoint along its normal by an approximately Gaussian amount (3 uniform numbers summed), magnitude proportional to edge length (min(1, len/80)), amp×0.6 per round.
- `wash(g, pts, color, {layers, alpha, amp, seed, edge, blend, fill})`: first deform 3 rounds for the base shape; each layer deforms 2 more rounds, filled at low alpha with `multiply` (transparent pigment layering), with an α=edge 1.6px same-color edge stroke. The edge strokes layer up — that is the **water-edge deposit** of pigment at boundaries. fill can take a gradient (sky, wall).
- Common parameters: large wall areas layers 5, α 0.4, amp 12; color blooms layers 3, α 0.045, amp 40 (heavy deformation); wood boards layers 3, α 0.5, amp 3, edge 0.14; opaque whites (window frame, tablecloth, clouds) use `blend:'source-over'`, α 0.9–0.95.
- Wall = radial-gradient wash (bright near window `#fbf3e0` → corner `#dcc49a`) + 28 heavily-deformed transparent color blooms (warm yellow, pink, blue-gray, pale green alternating) + dark blooms in two corners. Wainscot and floor are washed plank **by plank** with shifted tones. Finally `multiply` α 0.3 of a high-frequency paper-grain texture.
- Clouds: opaque white puffs (16 puffs, edges drawn with wash) + a bottom blue-gray gradient overlaid `source-atop`, cached as a sprite. The big camphor tree is also a sprite, swaying ±0.025rad around its root.

**Cel characters `cel(c, p, base, shade, dx, dy)`**: fill the whole shape with the shade color first, then inside clip(p) fill the base color after translating the shape toward the light by (−dx, −dy) — leaving only a crescent shadow on the dark side. Finally stroke 2.4px warm-brown `#4a3428`. One function is Ghibli's two-tone cel.

**Motif animation**
- White gauze curtains: two panels, hems billowing `q²·(90 + 70·gust)`, gust = 0.55 + 0.45·sin(3.2lt + phase), plus small ripples `sin(7lt + 6q)`; 3 semi-transparent wash layers with fixed seeds, so edges don't boil.
- 360 grass blades outside the window: wind arrives in gusts, `wind = 0.5 + 0.5·sin(3.1t − 0.018x)`, phase advancing along x — you can see a wave of wind sweeping the slope.
- Clouds drifting 22–30px/s; canopy swaying gently; 34 komorebi light patches on the wall (`screen` warm-yellow radial gradients, positions drifting with noise, brightness flickering `sin(5t + 1.7i)`); daisies on the table nodding; the girl's long hair blowing right-backward (7-point smooth, pushed by wind); red bow streamers trembling; tablecloth drape swinging.

**Characters**: long blond hair + big red bow (homage to Kiki's Delivery Service, not a copy), teal long dress + white apron + white cuffs; the cat in warm orange + cream cel. The broom leaning against the wall in the background is an Easter egg.
**Characters' watercolor fill**: review said "backgrounds read, characters don't (flat vector)". Characters are first painted into offscreen L; a separate texture layer M is built (paper grain α 0.8 + 40 transparent color blooms `charBloom`, α 0.1, amp 16); M is cut by L's silhouette with `destination-in`, then composited back with `multiply`. Line color softened from `#4a3428` to `#6a4a38`.
**Curtains**: review said they don't billow. gust frequency 3.2 → 5.4, billow `q²·(60 + 150·gust)`.

**Pitfalls**
- With color blooms at α 0.07×4 layers and multiply grain at 0.5, the wall looked like moldy old parchment. Ghibli rooms are bright: bloom α down to 0.045×3 layers, gradient brightened one step overall.
- V1 built the wall from two rectangular washes (right side darker) — a hard seam appeared at x≈1100. Dark areas need heavily-deformed polygons (amp 60), not rectangles.

**Still improvable**: characters are still flat; Ghibli-style hair highlight blocks could be added; the floor light patches could carry flowing curtain shadows.

---


### 2026-10-15 · New-scene engineering prototype

Added `54_ghibli_lab`, a street-facing repair shop with a tram passing and objects/environment micro-motion; run with `render.py --film style_studies --solo 54_ghibli_lab --from 0 --to 6`. Code is separate from the original 25 room. Determinism and decoding pass; independent review found no technical red flags blocking this round's research display; it still leans procedural illustration, short of studio-film-level recognition, and has not been cross-scene validated.
