<h1 align="center">Satchida Procedural Art</h1>

<p align="center">
  <b>Painting with code — no image model.</b><br>
  Eighty-three built-in styles, every stroke computed: numpy + Pillow on a CPU.
</p>

<p align="center">
  <a href="#styles">83 styles</a> &nbsp;·&nbsp;
  <a href="#install">Install</a> &nbsp;·&nbsp;
  <a href="#quick-start">Quick start</a> &nbsp;·&nbsp;
  <a href="docs/GIFS.md">Draw-on GIFs</a> &nbsp;·&nbsp;
  <a href="SKILL.md">SKILL.md</a>
</p>

<p align="center">
  <a href="#styles"><img src="docs/hero.jpg" width="100%" alt="Twelve of the 83 styles: ink wash, oil-pastel portrait, impasto oil, watercolour, dreamy hills, synthwave, retro gouache, flat spot illustration, pastel vignette, shadow puppetry, children's crayon and pixel art"></a>
</p>

**What it is** — A procedural-painting skill plus a small painting library: eighty-three styles, from ink wash and impasto oil to stained glass, a ray-traced ball pit and a VHS tape, all plain Python with **numpy + Pillow** on a CPU.

**Why code** — Composition is directed, not sampled; the same seed gives the same picture; it runs offline with no GPU, key or quota; and every stage can be saved, so you can watch the picture being made.

**How it paints** — It plans the composition, writes a short scene script, then renders, looks and fixes against a per-style checklist of real failure modes, usually over 2–4 rounds. The whole playbook is in [SKILL.md](SKILL.md).

<p align="center">
  <img src="examples/drawing_moon_river.gif" width="640" alt="An ink-wash painting drawn stage by stage"><br>
  <sub><b>Ink wash</b> — every style is painted stage by stage like this · <a href="docs/GIFS.md">all 91 GIFs</a></sub>
</p>

## Origin

Satchida Procedural Art is a rebrand and full English translation of the MIT-licensed
[claude-drawing-skill](https://github.com/cloveric/claude-drawing-skill) by cloveric. Rendering code,
styles and examples are functionally unchanged; see [PROVENANCE.md](PROVENANCE.md).

## Install

```bash
# the skill ships inside this repository at skill/satchida-procedural-art;
# point a skill loader at that folder, then install the two dependencies:
pip install -r skill/satchida-procedural-art/requirements.txt   # numpy, Pillow
```

Titles need a CJK font; system ones are found automatically, or set `INKPAINT_FONT=/path/to/font` ([more](docs/USAGE.md)).

## Quick start

Ask the assistant to *"draw it yourself"* or *"paint this with code"*, and name a style if you like.

Or run any example yourself:

```bash
cd skill/satchida-procedural-art
python3 examples/moon_river.py out.png --stages stages/   # ink wash + every stage
python3 examples/<name>.py out.png                        # one per style
```

→ [Every example command and the Python API in a few lines](docs/USAGE.md)

## Styles

Eighty-three styles in eight families — click any picture for the full-size image. Notes on every style: [docs/STYLES.md](docs/STYLES.md)

### Ink & paint

<table>
<tr><td align="center" colspan="2"><a href="examples/bawansiqian.jpg"><img src="docs/thumbs/bawansiqian.jpg" width="371" alt="Ink wash"></a><br><sub><b>Ink wash</b></sub></td><td align="center" colspan="2"><a href="examples/watercolor_autumn.jpg"><img src="docs/thumbs/watercolor_autumn.jpg" width="371" alt="Watercolour"></a><br><sub><b>Watercolour</b></sub></td></tr>
<tr><td align="center" colspan="2"><a href="examples/oil_wheatfield.jpg"><img src="docs/thumbs/oil_wheatfield.jpg" width="371" alt="Impasto oil"></a><br><sub><b>Impasto oil</b></sub></td><td align="center"><a href="examples/gouache_rainy_day.jpg"><img src="docs/thumbs/gouache_rainy_day.jpg" width="172" alt="Retro gouache"></a><br><sub><b>Retro gouache</b></sub></td><td align="center"><a href="examples/penwash_neighbours.jpg"><img src="docs/thumbs/penwash_neighbours.jpg" width="172" alt="Pen & wash"></a><br><sub><b>Pen & wash</b></sub></td></tr>
<tr><td align="center"><a href="examples/jiangnan_spring_water.jpg"><img src="docs/thumbs/jiangnan_spring_water.jpg" width="172" alt="Jiangnan garden"></a><br><sub><b>Jiangnan garden</b></sub></td><td align="center"><a href="examples/drybrush_noodle_counter.jpg"><img src="docs/thumbs/drybrush_noodle_counter.jpg" width="172" alt="Dry-brush blocks"></a><br><sub><b>Dry-brush blocks</b></sub></td><td align="center"><a href="examples/oilpastel_warm_cup.jpg"><img src="docs/thumbs/oilpastel_warm_cup.jpg" width="172" alt="Oil-pastel portrait"></a><br><sub><b>Oil-pastel portrait</b></sub></td><td align="center"><a href="examples/sunlitgreen_window_seat.jpg"><img src="docs/thumbs/sunlitgreen_window_seat.jpg" width="172" alt="Sunlit greenery"></a><br><sub><b>Sunlit greenery</b></sub></td></tr>
</table>

### Pencil, pen & pastel

<table>
<tr><td align="center"><a href="examples/colorpencil_dessert.jpg"><img src="docs/thumbs/colorpencil_dessert.jpg" width="172" alt="Coloured pencil"></a><br><sub><b>Coloured pencil</b></sub></td><td align="center"><a href="examples/graphite_bicycle.jpg"><img src="docs/thumbs/graphite_bicycle.jpg" width="172" alt="Graphite pencil"></a><br><sub><b>Graphite pencil</b></sub></td><td align="center"><a href="examples/crayon_picnic.jpg"><img src="docs/thumbs/crayon_picnic.jpg" width="172" alt="Children's crayon"></a><br><sub><b>Children's crayon</b></sub></td><td align="center"><a href="examples/ballpoint_board_game.jpg"><img src="docs/thumbs/ballpoint_board_game.jpg" width="172" alt="Ballpoint doodle"></a><br><sub><b>Ballpoint doodle</b></sub></td></tr>
<tr><td align="center"><a href="examples/lineart_paper_plane.jpg"><img src="docs/thumbs/lineart_paper_plane.jpg" width="172" alt="Continuous line art"></a><br><sub><b>Continuous line art</b></sub></td><td align="center"><a href="examples/sketchbook_reading_hour.jpg"><img src="docs/thumbs/sketchbook_reading_hour.jpg" width="172" alt="Sketchbook doodle"></a><br><sub><b>Sketchbook doodle</b></sub></td><td align="center"><a href="examples/pastelvignette_marmalade_scarf.jpg"><img src="docs/thumbs/pastelvignette_marmalade_scarf.jpg" width="172" alt="Pastel vignette"></a><br><sub><b>Pastel vignette</b></sub></td><td align="center"><a href="examples/nocturne_lava_sea.jpg"><img src="docs/thumbs/nocturne_lava_sea.jpg" width="172" alt="Hatched nocturne"></a><br><sub><b>Hatched nocturne</b></sub></td></tr>
</table>

### Picture books & illustration

<table>
<tr><td align="center"><a href="examples/anime_summer.jpg"><img src="docs/thumbs/anime_summer.jpg" width="172" alt="Anime"></a><br><sub><b>Anime</b></sub></td><td align="center"><a href="examples/cartoon_toaster.jpg"><img src="docs/thumbs/cartoon_toaster.jpg" width="172" alt="Hand-drawn cartoon"></a><br><sub><b>Hand-drawn cartoon</b></sub></td><td align="center"><a href="examples/flatvector_night_camp.jpg"><img src="docs/thumbs/flatvector_night_camp.jpg" width="172" alt="Flat vector"></a><br><sub><b>Flat vector</b></sub></td><td align="center"><a href="examples/storybook_acorn.jpg"><img src="docs/thumbs/storybook_acorn.jpg" width="172" alt="Storybook animation"></a><br><sub><b>Storybook animation</b></sub></td></tr>
<tr><td align="center"><a href="examples/bluebook_shared_umbrella.jpg"><img src="docs/thumbs/bluebook_shared_umbrella.jpg" width="172" alt="Blue picture book"></a><br><sub><b>Blue picture book</b></sub></td><td align="center"><a href="examples/twilight_paper_kite.jpg"><img src="docs/thumbs/twilight_paper_kite.jpg" width="172" alt="Twilight storybook"></a><br><sub><b>Twilight storybook</b></sub></td><td align="center"><a href="examples/pencilbook_tortoise_crossing.jpg"><img src="docs/thumbs/pencilbook_tortoise_crossing.jpg" width="172" alt="Warm pencil storybook"></a><br><sub><b>Warm pencil storybook</b></sub></td><td align="center"><a href="examples/colortown_festival_steps.jpg"><img src="docs/thumbs/colortown_festival_steps.jpg" width="172" alt="Colour town"></a><br><sub><b>Colour town</b></sub></td></tr>
<tr><td align="center"><a href="examples/poetichalloween_ghost_jar.jpg"><img src="docs/thumbs/poetichalloween_ghost_jar.jpg" width="172" alt="Poetic Halloween"></a><br><sub><b>Poetic Halloween</b></sub></td><td align="center"><a href="examples/spotillo_rainy_saturday_wide.jpg"><img src="docs/thumbs/spotillo_rainy_saturday_wide.jpg" width="172" alt="Flat spot illustration"></a><br><sub><b>Flat spot illustration</b></sub></td><td align="center"><a href="examples/grainbook_snow_walk.jpg"><img src="docs/thumbs/grainbook_snow_walk.jpg" width="172" alt="Grainy picture book"></a><br><sub><b>Grainy picture book</b></sub></td><td align="center"><a href="examples/dreamhills_long_walk.jpg"><img src="docs/thumbs/dreamhills_long_walk.jpg" width="172" alt="Dreamy hills"></a><br><sub><b>Dreamy hills</b></sub></td></tr>
</table>

### Print & poster

<table>
<tr><td align="center"><a href="examples/ukiyoe_fuji.jpg"><img src="docs/thumbs/ukiyoe_fuji.jpg" width="172" alt="Ukiyo-e woodblock"></a><br><sub><b>Ukiyo-e woodblock</b></sub></td><td align="center"><a href="examples/linocut_snowy_village.jpg"><img src="docs/thumbs/linocut_snowy_village.jpg" width="172" alt="Linocut"></a><br><sub><b>Linocut</b></sub></td><td align="center"><a href="examples/cyanotype_botanicals.jpg"><img src="docs/thumbs/cyanotype_botanicals.jpg" width="172" alt="Cyanotype"></a><br><sub><b>Cyanotype</b></sub></td><td align="center"><a href="examples/letterpress_circus.jpg"><img src="docs/thumbs/letterpress_circus.jpg" width="172" alt="Letterpress poster"></a><br><sub><b>Letterpress poster</b></sub></td></tr>
<tr><td align="center"><a href="examples/constructivism_radio.jpg"><img src="docs/thumbs/constructivism_radio.jpg" width="172" alt="Soviet constructivism"></a><br><sub><b>Soviet constructivism</b></sub></td><td align="center"><a href="examples/bauhaus_form_colour.jpg"><img src="docs/thumbs/bauhaus_form_colour.jpg" width="172" alt="Bauhaus geometric"></a><br><sub><b>Bauhaus geometric</b></sub></td><td align="center"><a href="examples/artdeco_express.jpg"><img src="docs/thumbs/artdeco_express.jpg" width="172" alt="Art Deco"></a><br><sub><b>Art Deco</b></sub></td><td align="center"><a href="examples/popart_cat_moods.jpg"><img src="docs/thumbs/popart_cat_moods.jpg" width="172" alt="Pop silkscreen"></a><br><sub><b>Pop silkscreen</b></sub></td></tr>
<tr><td align="center"><a href="examples/comic_rocket.jpg"><img src="docs/thumbs/comic_rocket.jpg" width="172" alt="Golden-age comic"></a><br><sub><b>Golden-age comic</b></sub></td><td align="center"><a href="examples/editorial_ideas.jpg"><img src="docs/thumbs/editorial_ideas.jpg" width="172" alt="Editorial (risograph)"></a><br><sub><b>Editorial (risograph)</b></sub></td><td align="center"><a href="examples/stencil_kite.jpg"><img src="docs/thumbs/stencil_kite.jpg" width="172" alt="Stencil graffiti"></a><br><sub><b>Stencil graffiti</b></sub></td><td align="center"><a href="examples/blueprint_lighthouse.jpg"><img src="docs/thumbs/blueprint_lighthouse.jpg" width="172" alt="Blueprint"></a><br><sub><b>Blueprint</b></sub></td></tr>
</table>

### Paper, thread & clay

<table>
<tr><td align="center"><a href="examples/papercut_balloons.jpg"><img src="docs/thumbs/papercut_balloons.jpg" width="172" alt="Paper collage"></a><br><sub><b>Paper collage</b></sub></td><td align="center"><a href="examples/newscollage_curiosity.jpg"><img src="docs/thumbs/newscollage_curiosity.jpg" width="172" alt="Newspaper collage"></a><br><sub><b>Newspaper collage</b></sub></td><td align="center"><a href="examples/sticker_market.jpg"><img src="docs/thumbs/sticker_market.jpg" width="172" alt="Sticker collage × receipt"></a><br><sub><b>Sticker collage × receipt</b></sub></td><td align="center"><a href="examples/silhouette_family.jpg"><img src="docs/thumbs/silhouette_family.jpg" width="172" alt="Silhouette"></a><br><sub><b>Silhouette</b></sub></td></tr>
<tr><td align="center"><a href="examples/clay_lighthouse.jpg"><img src="docs/thumbs/clay_lighthouse.jpg" width="172" alt="Stop-motion clay"></a><br><sub><b>Stop-motion clay</b></sub></td><td align="center"><a href="examples/stitch_sampler.jpg"><img src="docs/thumbs/stitch_sampler.jpg" width="172" alt="Cross-stitch"></a><br><sub><b>Cross-stitch</b></sub></td><td align="center"><a href="examples/patch_camping.jpg"><img src="docs/thumbs/patch_camping.jpg" width="172" alt="Embroidered patches"></a><br><sub><b>Embroidered patches</b></sub></td><td align="center"><a href="examples/perler_strawberry_coaster.jpg"><img src="docs/thumbs/perler_strawberry_coaster.jpg" width="172" alt="Perler beads"></a><br><sub><b>Perler beads</b></sub></td></tr>
</table>

### Ancient & historic

<table>
<tr><td align="center" colspan="2"><a href="examples/tomb_harvest.jpg"><img src="docs/thumbs/tomb_harvest.jpg" width="371" alt="Egyptian tomb painting"></a><br><sub><b>Egyptian tomb painting</b></sub></td><td align="center" colspan="2"><a href="examples/shadowpuppet_cuju.jpg"><img src="docs/thumbs/shadowpuppet_cuju.jpg" width="371" alt="Shadow puppetry"></a><br><sub><b>Shadow puppetry</b></sub></td></tr>
<tr><td align="center"><a href="examples/cave_hunt.jpg"><img src="docs/thumbs/cave_hunt.jpg" width="172" alt="Cave painting"></a><br><sub><b>Cave painting</b></sub></td><td align="center"><a href="examples/petroglyph_migration.jpg"><img src="docs/thumbs/petroglyph_migration.jpg" width="172" alt="Petroglyph"></a><br><sub><b>Petroglyph</b></sub></td><td align="center"><a href="examples/blackfigure_games.jpg"><img src="docs/thumbs/blackfigure_games.jpg" width="172" alt="Greek black-figure vase"></a><br><sub><b>Greek black-figure vase</b></sub></td><td align="center"><a href="examples/mosaic_harbor.jpg"><img src="docs/thumbs/mosaic_harbor.jpg" width="172" alt="Roman mosaic"></a><br><sub><b>Roman mosaic</b></sub></td></tr>
<tr><td align="center"><a href="examples/stainedglass_seasons.jpg"><img src="docs/thumbs/stainedglass_seasons.jpg" width="172" alt="Stained glass"></a><br><sub><b>Stained glass</b></sub></td><td align="center"><a href="examples/illuminated_starchart.jpg"><img src="docs/thumbs/illuminated_starchart.jpg" width="172" alt="Illuminated manuscript"></a><br><sub><b>Illuminated manuscript</b></sub></td><td align="center"><a href="examples/codex_ornithopter.jpg"><img src="docs/thumbs/codex_ornithopter.jpg" width="172" alt="Leonardo codex"></a><br><sub><b>Leonardo codex</b></sub></td><td align="center"><a href="examples/delft_canal.jpg"><img src="docs/thumbs/delft_canal.jpg" width="172" alt="Delft tiles"></a><br><sub><b>Delft tiles</b></sub></td></tr>
</table>

### Retro tech & screens

<table>
<tr><td align="center"><a href="examples/pixel_rainy_cafe.png"><img src="docs/thumbs/pixel_rainy_cafe.jpg" width="172" alt="Pixel art"></a><br><sub><b>Pixel art</b></sub></td><td align="center"><a href="examples/macpaint_garden.jpg"><img src="docs/thumbs/macpaint_garden.jpg" width="172" alt="1-bit paint program"></a><br><sub><b>1-bit paint program</b></sub></td><td align="center"><a href="examples/crt_weather.jpg"><img src="docs/thumbs/crt_weather.jpg" width="172" alt="Green-screen CRT"></a><br><sub><b>Green-screen CRT</b></sub></td><td align="center"><a href="examples/lineprinter_launch.jpg"><img src="docs/thumbs/lineprinter_launch.jpg" width="172" alt="ASCII art (line printer)"></a><br><sub><b>ASCII art (line printer)</b></sub></td></tr>
<tr><td align="center"><a href="examples/lowpoly_canyon.jpg"><img src="docs/thumbs/lowpoly_canyon.jpg" width="172" alt="Low poly"></a><br><sub><b>Low poly</b></sub></td><td align="center"><a href="examples/synthwave_coastline.jpg"><img src="docs/thumbs/synthwave_coastline.jpg" width="172" alt="Retro synthwave"></a><br><sub><b>Retro synthwave</b></sub></td><td align="center"><a href="examples/vhs_birthday.jpg"><img src="docs/thumbs/vhs_birthday.jpg" width="172" alt="VHS home video"></a><br><sub><b>VHS home video</b></sub></td><td align="center"><a href="examples/cyberpunk_neon_street.jpg"><img src="docs/thumbs/cyberpunk_neon_street.jpg" width="172" alt="Cyberpunk"></a><br><sub><b>Cyberpunk</b></sub></td></tr>
<tr><td align="center"><a href="examples/rubberhose_morning.jpg"><img src="docs/thumbs/rubberhose_morning.jpg" width="172" alt="1930s rubber hose"></a><br><sub><b>1930s rubber hose</b></sub></td><td align="center"><a href="examples/panel_radio.jpg"><img src="docs/thumbs/panel_radio.jpg" width="172" alt="Vintage instrument panel"></a><br><sub><b>Vintage instrument panel</b></sub></td><td align="center"><a href="examples/thermal_kitchen.jpg"><img src="docs/thumbs/thermal_kitchen.jpg" width="172" alt="Thermal camera"></a><br><sub><b>Thermal camera</b></sub></td><td align="center"><a href="examples/xray_luggage.jpg"><img src="docs/thumbs/xray_luggage.jpg" width="172" alt="X-ray"></a><br><sub><b>X-ray</b></sub></td></tr>
</table>

### 3D, UI & diagrams

<table>
<tr><td align="center"><a href="examples/soft3d_rise.jpg"><img src="docs/thumbs/soft3d_rise.jpg" width="172" alt="Soft 3D"></a><br><sub><b>Soft 3D</b></sub></td><td align="center"><a href="examples/isometric_weather_island.jpg"><img src="docs/thumbs/isometric_weather_island.jpg" width="172" alt="Isometric 2.5D"></a><br><sub><b>Isometric 2.5D</b></sub></td><td align="center"><a href="examples/aurora_morning.jpg"><img src="docs/thumbs/aurora_morning.jpg" width="172" alt="Aurora glass"></a><br><sub><b>Aurora glass</b></sub></td><td align="center"><a href="examples/morph_water_cycle.jpg"><img src="docs/thumbs/morph_water_cycle.jpg" width="172" alt="Shape morph"></a><br><sub><b>Shape morph</b></sub></td></tr>
<tr><td align="center"><a href="examples/pastelui_packing.jpg"><img src="docs/thumbs/pastelui_packing.jpg" width="172" alt="Pastel UI"></a><br><sub><b>Pastel UI</b></sub></td><td align="center"><a href="examples/obsidianui_reading_notes.jpg"><img src="docs/thumbs/obsidianui_reading_notes.jpg" width="172" alt="Obsidian UI"></a><br><sub><b>Obsidian UI</b></sub></td><td align="center"><a href="examples/canvasboard_moving_plan.jpg"><img src="docs/thumbs/canvasboard_moving_plan.jpg" width="172" alt="Canvas board"></a><br><sub><b>Canvas board</b></sub></td><td align="center"><a href="examples/flexoki_pour_over.jpg"><img src="docs/thumbs/flexoki_pour_over.jpg" width="172" alt="Flexoki paper"></a><br><sub><b>Flexoki paper</b></sub></td></tr>
<tr><td align="center"><a href="examples/notebook_brewing.jpg"><img src="docs/thumbs/notebook_brewing.jpg" width="172" alt="Lab notebook × stickers"></a><br><sub><b>Lab notebook × stickers</b></sub></td><td align="center"><a href="examples/grading_math_quiz.jpg"><img src="docs/thumbs/grading_math_quiz.jpg" width="172" alt="Exam grading"></a><br><sub><b>Exam grading</b></sub></td><td align="center"><a href="examples/overlay_city_map.jpg"><img src="docs/thumbs/overlay_city_map.jpg" width="172" alt="Overlay sheets"></a><br><sub><b>Overlay sheets</b></sub></td><td align="center"><a href="examples/chalk_lesson.jpg"><img src="docs/thumbs/chalk_lesson.jpg" width="172" alt="Chalkboard"></a><br><sub><b>Chalkboard</b></sub></td></tr>
</table>

## More

| Page | What's in it |
|---|---|
| [Styles](docs/STYLES.md) | What makes each style read as the real medium, and its module |
| [Principles](docs/PRINCIPLES.md) | The checklist the assistant goes through before handing over a picture |
| [Usage](docs/USAGE.md) | Install notes, fonts, Python snippets, every example command |
| [Gallery](docs/GALLERY.md) | Every example at full size, with its title (≈ 57 MB) |
| [Draw-on GIFs](docs/GIFS.md) | 91 GIFs of pictures being painted (≈ 104 MB) |
| [SKILL.md](SKILL.md) | The full skill: workflow, API reference, failure-mode lists, animation |

## Roadmap

- Per-stroke layer export, for stroke-by-stroke animation in Motion Canvas or Remotion.

---

MIT License · Original by Claude (Opus 5.5) with [@cloveric](https://github.com/cloveric) · Satchida rebrand and translation 2026

### Community link

This open-source project is linked to and endorsed by the LINUX DO community. https://linux.do/
