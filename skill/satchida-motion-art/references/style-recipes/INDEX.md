# Style Master Index (36 existing implementations + 16 research recipes, updated 2026-10-15)

> **Read this first: the 35 sample stills all share one composition** (window top-left, cat bottom-left, girl drinking from a cup on the right; `assets/all-styles-overview.jpg` is the same). That is the mechanism of the art-history speed-run video — the style changes, the scene stays — not the composition of these styles. For new subject matter, recompose for the subject: the renderer, brushwork, color logic, and motif motion from a card may be taken along; the room's coordinates, characters, and furniture must not.

To pick a style, first check the status and classification tables below, then open the corresponding card. "Quality" is the current implementation level (★★★ recognizable at a glance and directly usable; ★★ recognizable but with clear shortcomings; ★ needs a redo), not the difficulty of the style itself. The listed shortcoming is exactly what the next pass on that style should beat first.

Styles come in two layers. **Material layer**: brushwork, texture, and the treatment of light and color — can be laid over any subject (product explainers, data stories, narrative all work). **Era specimen**: the current sample makes the era's or the artist's motifs very prominent; used directly it suits speed-runs, time-travel, and homage; moving to new subject matter should re-derive the visual language and composition, and the sample's limits must not be treated as limits of the artist himself. When unsure, put it in the material layer; when a style touches both sides (e.g., Hopper's hard-edged light blocks are a transferable lighting treatment), judge by your usage.

## Status and transfer scope first

New research cards each ship a single-scene engineering prototype (`--film style_studies`), watchable but not yet validated for style fidelity or cross-scene transfer; the star ratings of the existing cards below do not apply to them. For first cross-subject use read [Method 15](../15-cross-scene-style-transfer.md). Material layer / era specimen is how the existing samples are organized, not a permanent limit on what subjects an artist's overall style can serve; transferability is validated by new scenes. Content and fixed coordinates from famous works do not enter the style definition.

## New research recipes (17; redone one by one under Protocol 16 starting 2026-10-16)

**Redo status**: 38 Giotto, 42 Guardi, 45 Renoir, 46 Pissarro, 47 Sisley, 48 Gauguin, 50 Ma Yuan, 51 Persian miniature, and 52 South Park have had their demos redone under [Protocol 16](../16-style-demo-95-point-protocol.md) (masterpiece anchoring + `lib/medium.js` medium channel). Self-scores 65–82, independent review 53–74 (42 and 45 not yet reviewed); **none reached 80, so all of them remain "research recipes", not implementations** — the taste items await Uncle Hua's review; the other 8 are still old prototypes from Oct 10–15 (quality roughly 35–55; do not treat them as usable implementations). Progress and each card's shortcomings: see [_redo-progress](_redo-progress.md). Old-version backups live in the skill root at `_archive/scenes_20261016/`.

| Card | Research scope | Implementation status |
|---|---|---|
| [38_giotto](38_giotto.md) | Giotto: mass and narrative relationship | Research recipe; single-scene prototype exists |
| [39_piero](39_piero.md) | Piero: geometric order and lucid volume | Research recipe; single-scene prototype exists |
| [40_raphael](40_raphael.md) | Raphael: harmonic organization and natural connection | Research recipe; single-scene prototype exists |
| [41_michelangelo](41_michelangelo.md) | Michelangelo: sculptural quality and pose tension | Research recipe; single-scene prototype exists |
| [42_guardi](42_guardi.md) | Guardi: air, broken light, and loose edges | Research recipe; single-scene prototype exists |
| [43_lorenzetti](43_lorenzetti.md) | Ambrogio Lorenzetti: readable social space | Research recipe; single-scene prototype exists |
| [44_cortona](44_cortona.md) | Pietro da Cortona: Baroque masses and flowing groups | Research recipe; single-scene prototype exists |
| [45_renoir](45_renoir.md) | Renoir: warm-cold interweave and figures with warmth | Research recipe; single-scene prototype exists |
| [46_pissarro](46_pissarro.md) | Pissarro: everyday flow and figures in setting | Research recipe; single-scene prototype exists |
| [47_sisley](47_sisley.md) | Sisley: air, weather, and coherent landscape | Research recipe; single-scene prototype exists |
| [48_gauguin](48_gauguin.md) | Gauguin: flat planes, outlines, and symbolic color | Research recipe; single-scene prototype exists |
| [49_chagall](49_chagall.md) | Chagall: space of memory and emotional color | Research recipe; single-scene prototype exists |
| [50_ma_yuan](50_ma_yuan.md) | Ma Yuan: offset center of gravity, negative space, refined brush-and-ink | Research recipe; single-scene prototype exists |
| [51_persian_miniature](51_persian_miniature.md) | Persian miniature: layered space and precise narrative | Research recipe; single-scene prototype exists |
| [52_south_park](52_south_park.md) | South Park: digital paper cut-outs and limited performance | Research recipe; single-scene prototype exists |
| [53_pixar](53_pixar.md) | Pixar: the style family of form, material, and performance | Research recipe; single-scene prototype exists |
| [55_dunhuang](55_dunhuang.md) | Dunhuang murals (Northern Dynasties): mineral pigments on dry mud walls, lines flying across | Research recipe; single-scene prototype (v1, ~72) |

Ghibli is not counted as new: [25_ghibli](25_ghibli.md) keeps the original watercolor-background implementation and adds overall visual-language and performance research; the latter cannot borrow the measured results of the old scene.

## Material layer (can be laid over any subject)

| id | Style | Core renderer / technique | Motif motion (how the painting comes alive) | Signature transition (entering it) | Quality | Current shortcoming |
|---|---|---|---|---|---|---|
| 09_postimp | Van Gogh | Three-pass flow-field brush strokes (wall vertical / ground perspective / everything else) + region palettes + outlining; props layer; visibleLines fill-in strokes | Starry-night swirls, lamp-halo rings expanding, directional field flickering like flames, swirl cat | Pulled into the starry swirl | ★★★ (benchmark) | Heaviest at 120 ms per frame |
| 08_impressionism | Impressionism | Region pastel palettes with short strokes (positions fixed), fine strokes for window scenes | Light spots drifting and flickering, poppies swaying, clouds moving, ribbon floating | Brush-stroke color dots covering the frame | ★★ | Faces and hands shattered by brush strokes |
| 29_seurat | Seurat pointillism | Optical mixing: 21 pure hues juxtaposed proportionally, complementary dots, equal-size dots | Light bleeding through, dots breathing | Frame crystallizing into round dots | ★★ | Too static; grid too regular |
| 25_ghibli | Ghibli (existing watercolor backgrounds + overall language research) | Watercolor washes (transparent layering + water-edge bleeding), cel-shaded crescent shadows | Gauze curtain billowing in the wind, grass swaying in sheets, dappled tree-shadow light | Wet-paper bleed | ★★ | Characters weaker than backgrounds |
| 17_ink | Chinese ink freehand (xieyi) | Brush-tip flying white (feibai), ink-bleed blur diffusion, negative space, seal stamps | Opening strokes writing themselves, ink bleeds spreading, shrimp whiskers twitching | (Opening of the speed-run) | ★★ | Characters not freehand enough (review 6/10) |
| 13_pop | Lichtenstein pop | Ben-Day dots via createPattern, heavy black outlines | Warhol four-panel recolor, thought-dot flash, cat hip-swivel, onomatopoeia box jitter | Lightning + dot rasterization | ★★★ | — |
| 14_8bit | 8-bit pixel | 240×135 per-pixel, 14-color palette, 1px black outline on parts | Tail, HUD heart blink, coin popping from the ? block (15–30 fps stepping) | Pixel blocks scaling up/down | ★★★ | Cat's head clipping into the windowsill |
| 26_vaporwave | Vaporwave / cyber neon | Neon two-color glow, perspective grid, VHS channel-split post, path-drawn neon-tube katakana | Sunset bars moving upward, grid rolling forward, sign flicker, tracking-noise band | VHS tearing + upward roll | ★★★ | Parts also glow at their seams |
| 35_shinkai | Shinkai light and shadow | Cumulonimbus clouds, Tyndall light shafts, cel hard-shadow bands, halos | Light particles drifting, clouds moving | Diagonal sweep of light | ★★ | Interior background density lacking |
| 32_rembrandt | Rembrandt chiaroscuro | Lighting map multiplied over the whole frame, window light + candlelight | Dust motes in the light shaft, cloud shadows dimming the window light | Old-film iris in/out | ★ | Characters flat (review 5/10); most in need of a redo |
| 11_cubism | Analytic Cubism | Semi-transparent gradient planes stacking space, facet tool (triangles not clipped), Picasso-style two-perspective face | CAFÉ letters swapping, window-pane facets sliding, newspaper trembling | Geometric shards misaligned then fitted | ★★ | Too bright; not enough deep-umber large planes |
| 30_matisse | Matisse cut-outs | Irregular scissor edges, pinned-paper drop shadows, saturated flat fills | Paper cut-outs drifting, seaweed swaying | Pinned cut-outs on blue paper sweeping across | ★★★ | Gouache brush marks too heavy |
| 16_2026 | Contemporary flat illustration | Grain stipple density function, flat color blocks without outlines | Character performance (jump / slapping cup / crack / gasp / signing), damped secondary motion | Three-color concentric-ring iris | ★★★ | — |
| 22_constructivism | Russian Constructivism (narrow use) | Grayscale photo halftone (variable dot diameter, 45°), red wedge on black circle, path-drawn Cyrillic block letters | Slogans stamped word by word then wave-jumping | (Opening of film B) | ★★★ | Missing the horn-shaped text cones |
| 12_bauhaus | Bauhaus (narrow use) | Pure geometric composition, Schlemmer figure joint discs | Pointer rod turning steep, Mondrian grid recoloring, cat batting the ball | Red-yellow-blue geometry rotating and scaling up | ★★★ | Cat's head off the armature position |
| 04_roman | Pompeii mosaic (narrow use) | Distance-field stone placement along contours, weighted L∞ Voronoi grout, layout computed once with color flowing per frame | Wave-pattern border flowing clockwise, Vesuvius smoking and spitting sparks | Mosaic tiles flipping and spreading from the cat | ★★★ | Little facial detail at small scale |
| 15_raytrace | Early ray-traced CGI (narrow use) | Uniform plastic shading, per-pixel checkerboard reflection, chrome-ball environment mapping | Purple ring rotating, lens flare, green glint in the cat's eye | Green wireframe → scanline render | ★★ | Cat legs like columns, face mask-like |

## Era specimens (suited to speed-runs, time-travel, homage)

| id | Style | Core renderer / technique | Motif motion (how the painting comes alive) | Signature transition (entering it) | Quality | Current shortcoming |
|---|---|---|---|---|---|---|
| 01_cave | Cave rock art | Noise-relief rock wall + charcoal stippled rough edges + ochre soaked into the rock | Animals running alternating between two poses, firelight flicker, embers | (Opening) | ★★★ | Human figures too cartoonish, not primitive enough |
| 02_egypt | Egyptian tomb mural | Profile-face frontal-eye canon, flat fills with fine outlines, 24 handwritten hieroglyphs | Scarab pushing the sun, Aten rays' little hands opening/closing, hieroglyphs rewritten stroke by stroke | Tapestry strips dropping and bouncing back | ★★★ | Cup-holding elbow stiff |
| 03_greek | Attic black-figure | Black silhouettes + terracotta incised lines + purple-red with white dots | Meander band scrolling backward, boat bobbing and dolphins leaping, lyre swinging | Vase rolling to turn the surface | ★★★ | Skirt a bit thick |
| 05_gothic | Gothic illuminated manuscript | Per-pixel gold leaf (brushed + embossed 1px-offset highlight lines), gold-hue mask highlights | Gold-leaf diagonal highlight sweep, vines swaying, snail crawling, mouse running | Parchment page turn | ★★★ | Blond hair reads like a hood |
| 06_renaissance | Renaissance sfumato | Whole-layer light blur + high-opacity sharp layer, craquelure / canvas grain / amber varnish | Da Vinci flapping-wing machine flying past, river sparkle, floating dust | Divine light from the window | ★★ | Cat too cartoonish; overall too static |
| 10_nouveau | Mucha Art Nouveau | Variable-width path strokes (thick outside, thin inside), offset silhouette backing | Sun rising, halo rotating, flowers swaying, S-shaped steam, curls waving | Gold-edged organic forms growing | ★★★ | Cat pose stiff |
| 18_klimt | Klimt golden phase | Reuses the gothic gold leaf, spiral/eye motifs, realistic face with flat gold robe | Eye motifs on the robe blinking in turn, gold flecks drifting | Gold leaf spiraling out from the head | ★★★ | Hand on the table missing its sleeve |
| 19_munch | Munch expressionism | Long curved flow strokes (20–30 steps along the flow field), per-row sinusoidal warp of the whole world | Whole painting twisting, blood-red sky flowing | Scream color bands pressing down from above | ★★ | Wall once read as Van Gogh |
| 20_dunhuang | Dunhuang mural | Mineral colors on an earth-red ground, flaking patches (background only), saturation fade | Apsaras' streamers, ceiling (caisson) motifs drifting, lamp flame | Streamers sweeping past, old paint flaking down | ★★ | Apsara figures rough |
| 21_kusama | Kusama polka dots | Hand-drawn irregular circles, hex grid modulated by true period | Dots pulsing outward from the cat ring by ring, pumpkin, infinity mirror room | Dots growing into a clip of the new painting | ★★★ | Figure same color as the wall, held only by the outline |
| 23_dali | Dali surrealism | Soft-clock deformation, long-shadow shear affine | Clock melting downward, long-legged elephant walking, ants circling the watch, shadows lengthening | New painting dripping down with rounded-head droplets | ★★ | Figures lean vector-illustration |
| 24_hopper | Hopper American realism | Dual-version light/shadow clipping (bright/dark versions clipped by light blocks), hard-edged light patches | Light patch slowly sweeping over the face, shadow figure on the wall drinking tea in sync | Hard-edged sunlight sweeping across | ★★★ | Cat in shadow the whole time |
| 27_kirby | Marvel Kirby galaxy era | Four-color halftone dots, misregistered plates, feathered crosshatch black-block shadows, krackle energy dots | Big onomatopoeia letters, panel-cut cat-eye close-up, energy dots | (Opening of film C) | ★★ | Reads more like Lichtenstein; missing Kirby perspective and blocky fists |
| 28_monet | Monet water lilies and Japanese bridge | Short-stroke water reflections, light trembling on the water | Lilies drifting, willow shadows swaying, ripples spreading | Water rippling open | ★★ | Awkward space: wall is pond water, floor is wood |
| 31_haring | Keith Haring | Thick black uniform-width lines, radiating motion lines | Little figures dancing with 8fps hard cuts, everything bouncing to the BPM | Dancing figure scaling up, new painting inside the body | ★★★ | Girl not Haring enough |
| 33_rubberhose | 1930 rubber-hose cartoon | Pie-cut eyes, noodle arms, white gloves, 12fps stepping, film-scratch flicker | Everything bouncing on the beat | (Old reel before the lamp lights behind the screen) | ★★★ | Motion is mostly film noise |
| 34_shadowpuppet | Chinese shadow puppetry | Translucent donkey-hide cut-outs, riveted joints, 10fps stepping, oil lamp behind the screen | Rod-driven stiff joints, wrist flicks | Lamp lighting up behind the screen | ★★★ | Overlapping parts multiply to black; 121 ms is slow |
| 36_picasso_blue | Picasso blue period | Monochrome blues, broad strokes, Prussian-blue heavy outlines, elongated figures | Slow breathing | Color draining to blue, then a broad brush sweep | ★★ | Figures not melancholic enough |
| 37_rick_morty | [Rick & Morty](37_rick_morty.md) | SVG rounded-corner dark-gray thin outlines, flat fills, mottled background | Holding cup, blinking, gaze, tail sway | Defined separately by narrative | ★★ | Standalone SVG preview/render, not inside the old 35-style Canvas gallery; no walk rig |

## Quality distribution of the existing 36 implementations and next steps

- ★★★ 20 styles, ★★ 15 styles, ★ 1 style.
- **The most common shortcoming is characters**: once backgrounds pass the style renderer they look like the style, but characters drawn as flat fills on a vector skeleton look pasted on (positive-lesson No. 8). The next quality round starts from "characters also pass the same renderer / get reshaped in that style's idiom": Rembrandt, Picasso Blue, Ink, Ghibli, Dali, Marvel.
- Transition collection: `_transition-migration-tests.md` (A–D, 19 new) + notes inside each card.
