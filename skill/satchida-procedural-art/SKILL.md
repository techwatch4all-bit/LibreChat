---
name: satchida-procedural-art
description: "Satchida Procedural Art - paint with code, no image-generation model. Python + numpy + Pillow draws pictures stroke by stroke following the physics of brush, ink, pigment and paper. 82 built-in styles: ink wash, watercolor, paper-cut collage, colored pencil, anime background, riso editorial, impasto oil, ukiyo-e, pixel art, claymation, cyanotype, cross-stitch, cyberpunk neon, cartoon, isometric 2.5D, soft 3D, Bauhaus, synthwave, blueprint, low-poly, stained glass, Roman mosaic, Egyptian tomb, illuminated manuscript, da Vinci codex, letterpress, constructivism, Art Deco, pop art, ASCII, CRT terminal, VHS, shadow puppetry, retro gouache, picture books, pastel UI, whiteboards, Flexoki sheets, dreamy hills wallpapers, and many more (full table inside). Deterministic seeds make every picture reproducible; staged snapshots make draw-on animations possible. Use when the user says \"paint with code\", \"draw it yourself\", \"no image model\", \"procedural painting\", or names any of these styles."
---

# Satchida Procedural Art

Paint pictures with Python code only — numpy + Pillow, no image-generation model.
Every stroke is computed: composition and negative space are precisely controlled,
a fixed seed reproduces the same picture every time, and staged snapshots turn a
painting into a "being drawn" animation.

Rebranded for Satchida from the MIT-licensed upstream project; see `PROVENANCE.md`.

## When to use

The user asks you to "paint with code", "draw it yourself without an image model",
or names any style in the table below. Do not reach for an image-generation tool —
compose a scene script here instead. The result is a real PNG/JPG you deliver in
chat (and can register into the Studio Library via the `generate_procedural_art`
MCP tool).

## Styles (82 built in)

Style modules live in `lib/`; each exports one main class (or a helper toolkit).
Runnable reference scenes for most styles live in `examples/` (`.py` + rendered
`.jpg` quality benchmarks — always copy and adapt the closest example).

| Module | Look |
| --- | --- |
| inkpaint | Ink-wash landscape toolkit: washes, texture strokes, mist, seal and inscription |
| watercolor | Transparent watercolour on cold-press paper, glazes, blooms, dry-brush |
| papercut | Torn-paper collage with crayon texture and drop shadows |
| colorpencil | Soft Korean-style coloured-pencil illustration |
| anime | Japanese anime background art, cel-shaded, cumulus, sun flare |
| editorial | Riso-feel editorial illustration, spot inks, halftone, misregistration |
| oilpaint | Impasto oil painting with directional strokes and lit paint relief |
| ukiyoe | Japanese woodblock print, bokashi gradients, woodgrain, keyblock lines |
| pixelart | Retro pixel art, low-res + Bayer dither, crisp upscale |
| clay | Stop-motion plasticine relief under studio light |
| cyanotype | Prussian-blue sun print / photogram |
| stitch | Hand embroidery on Aida cloth: cross, back, satin, French knots |
| panel | Vintage radio / instrument front panels: walnut, brushed aluminium, knobs |
| sticker | Die-cut sticker collage + thermal receipt + washi tape |
| notebook | Lab notebook: graph paper, pencil charts, highlighter, red circles, sticky notes |
| chalk | Classroom chalkboard on green slate, chalk dust, eraser ghosts |
| cyberpunk | Rain-soaked neon street canyon, glass-tube signs, wet-road reflections |
| cartoon | Hand-drawn cartoon frame: blue-pencil roughs, brush-pen lines, cel shadows |
| isometric | Pastel isometric 2.5D miniature with one sun, floating data cards |
| lineart | Continuous single-line drawing, one accent eye colour |
| soft3d | Soft pastel 3D render: candy-ball sea, puffy letters, depth of field |
| morph | Shape-morph motion frames: outline morphs through shapes with onion skin |
| newscollage | Dada / magazine cut-and-paste collage on kraft board |
| aurora | Frosted-glass UI cards over an aurora / mesh gradient |
| bauhaus | Bauhaus geometric poster as a hand-pulled screen print |
| synthwave | 80s retro-future poster on a worn VHS tape: cut sun, neon grid, chrome |
| perler | Fuse beads on a pegboard, melted and fused |
| petroglyph | Pecked rock art on desert-varnished sandstone |
| tomb | Egyptian tomb wall painting, Theban New Kingdom style |
| mosaic | Roman floor mosaic: tesserae along contours, grout, inscribed plaque |
| stainedglass | Gothic stained-glass window, grisaille paint, silver stain, lead cames |
| illuminated | Late-medieval illuminated manuscript opening, gold leaf, blackletter |
| codex | Renaissance engineer's notebook: iron-gall ink, mirror writing, exploded machines |
| silhouette | Cut-paper silhouette portrait with gilt oval frame |
| letterpress | 1890s playbill letterpress poster: wood type, two-colour misregistration |
| constructivism | Soviet constructivist poster, two inks, halftone photo collage |
| artdeco | 1930s Art Deco travel poster: airbrush, frisket, stepped towers, rays |
| comic | Golden-age comic cover: brush-inked lines, Ben-Day dots, four-colour misprint |
| popart | Warhol-style pop silkscreen: flat colour fields, offset photo black |
| lineprinter | ASCII art off a 1970s line printer on greenbar paper |
| lowpoly | Late-90s 3D game frame from a tiny software rasterizer |
| stencil | Spray-paint stencil graffiti on board-marked concrete |
| blueprint | Engineering blueprint: inked tracing contact-printed in ferro-prussiate |
| crayon | Child's wax-crayon drawing on rough paper |
| crt | Green-screen CRT terminal showing ASCII art in glowing phosphor |
| thermal | Thermal-camera picture: paint a temperature field, then false-colour it |
| delft | Delft blue tile wall in tin glaze with a tile-picture panel |
| blackfigure | Attic black-figure vase: silhouette figures, incised detail |
| graphite | Pencil drawing in graphite on cartridge paper |
| xray | X-ray transmission picture: radiopaque bodies, false-colour intensity |
| rubberhose | 1930s black-and-white rubber-hose cartoon frame on old film |
| linocut | Black-and-white linoleum-block print with one spot-colour block |
| vhs | Home-video camcorder frame, tungsten cast, chroma bleed, REC overlay |
| flatvector | Layered flat vector landscape, bold palette, inter-layer shadows |
| storybook | Picture-book character animation frame: squash and stretch acting |
| ballpoint | Ballpoint pen doodles on copy paper, ink blobs, colored-pencil strips |
| overlay | Tracing-paper separations stacked on a light box |
| pastelui | Product-film interface frames on flat pastel fields |
| grading | Marked answer sheet on green felt: red pen, stamps, clips |
| shadowpuppet | Dyed-leather shadow puppets on a lamp-lit screen, carved theatre |
| penwash | Fineliner + watercolour sketch cards on a table |
| gouache | Retro gouache picture-book portraits, opaque layering |
| bluebook | Soft-blue limited-palette picture-book spread |
| jiangnan | Lush Chinese spring garden, fine gouache, willows, moon gate, reflections |
| drybrush | Mid-century dry-brush colour-block poster illustration |
| twilight | Dusk picture-book page: pastel sunset sky, wildflower slope, night half |
| nocturne | Hatched night-scene print: directional strokes, one warm light |
| obsidianui | Dark note-taking app drawn in code: markdown, graph view, purple accent |
| canvasboard | Dark dotted infinite whiteboard with cards and curved connectors |
| flexoki | Explainer sheets on warm Flexoki paper, lightweight diagram renderer |
| pencilbook | Warm coloured-pencil storybook spread, paper-tooth specks |
| colortown | Dense cheerful European hill town in gouache and fine ink |
| pastelvignette | Whimsical picture-book character vignette in soft pastel |
| poetichalloween | Melancholic surreal Halloween portraits, glowing sheet ghost |
| oilpastel | Oil-pastel portrait: bold dry waxy strokes, paper-tooth white specks |
| sketchbook | Sketchbook doodle: fine ink lines, rainbow stripes, round blush |
| spotillo | Japanese flat spot illustrations on white, one red accent |
| grainbook | Sweet mid-century grainy children's-book scene |
| dreamhills | Minimalist dreamy-hills phone wallpaper, velvet grass fur |
| sunlitgreen | Bright summer greenery, painted leaf clusters, dappled light |

`lib/core.py` holds shared helpers (`spline`, `curve`, `blob_pts`, `fbm1d`,
`noise2d`, `blur`, `polygon_mask`, `bristle_stroke`, fonts, height-field lighting).

## Workflow (do this for every picture)

1. **Plan the composition first.** Decide the visual focus, keep generous
   negative space (ink-wash at least 40% empty), use one or two accent colours
   only, and place any inscription or label deliberately. The picture must
   illustrate the actual content, not be a random landscape.
2. **Write the scene script**: copy the closest example from `examples/` and
   adapt it. Scenes run on any Python 3 with numpy + Pillow:
   `python scene.py out.png`.
3. **Render and look at your own picture.** Open the PNG and check it against
   the style's defect list in `docs/defect-checklists.md`; typically iterate
   2-4 rounds, fixing only the most visible problem each round. Save old
   versions as `_v1/_v2` for comparison.
4. **Deliver**: save as JPG (quality 92) and deliver it in the current chat.
   To make a "being drawn" animation add `--stages DIR`; the script writes a
   snapshot per `stage('name')` call plus a final frame.

When the Satchida Art MCP tools are available, you may instead call
`generate_procedural_art(style, prompt, palette, seed, scene_py)` — it runs the
scene you supply (or a matching example) and publishes the result to the Studio
Library at `/generated/...`, returning the in-app URL directly.

## Interface cheat-sheet

Full per-style API reference: `docs/style-api.md`.
Defect lists and quality bar per style: `docs/defect-checklists.md`.
Style gallery and benchmarks: `docs/GALLERY.md`, `docs/STYLES.md`, `USAGE.md`,
`PRINCIPLES.md`.

Common entry pattern:

```python
import sys; sys.path.insert(0, "<skill-dir>/lib")
from core import spline, curve, blob_pts, fbm1d, blur, polygon_mask
# from watercolor import Watercolor, hexc
# p = Watercolor(1920, 1080, seed=7)
# ... compose with the style's methods ...
# p.save('out.png')   # or scene.save('out.png', stages_dir='stages')
```

Each style module documents its class methods in its module docstring (English).
Seeds are deterministic: same seed, same picture. Fonts resolve automatically
(per-platform fallbacks) or via the `INKPAINT_FONT` environment variable.

## File map

- `lib/` — one module per style + `core.py` shared helpers
- `examples/` — runnable reference scenes and rendered JPG benchmarks
- `docs/` — style API, defect checklists, gallery, principles, usage
- `requirements.txt` — numpy, Pillow (the only dependencies)

Rebrand: Satchida AI. Upstream work is MIT-licensed; see `LICENSE` and
`PROVENANCE.md` for attribution.
