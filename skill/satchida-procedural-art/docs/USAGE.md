# Satchida Procedural Art · install & examples

[← README](../README.md) · [Styles](STYLES.md) · [Principles](PRINCIPLES.md) · [Usage](USAGE.md) · [Gallery](GALLERY.md) · [GIFs](GIFS.md)

### Install

```bash
# the skill ships inside this repository at skill/satchida-procedural-art;
# point a skill loader at that folder, then install the two dependencies:
pip install -r skill/satchida-procedural-art/requirements.txt   # numpy, Pillow
```

Titles and notes need a CJK font. macOS Kaiti/Songti, Linux Noto CJK and Windows KaiTi/SimSun are found automatically; you can also set `INKPAINT_FONT=/path/to/font`. Many styles also look for common Latin system fonts (a sans, a rounded bold, a script and a handwriting face, via `core.latin_font`); override any of them with `INKPAINT_FONT_<STYLE>`, e.g. `INKPAINT_FONT_HAND`. No font files are bundled.

### Quick start

```python
import sys; sys.path.insert(0, "lib")

# ink wash
from inkpaint import Painting
p = Painting(1920, 1080, seed=7); p.paper()
far = p.ridge(560, peaks=[(420, 150, 330), (1650, 110, 260)]); p.wash(far, dens=0.16, decay=170, mist_y=700)
main = p.peak(1130, 252, shoulders=[(1380, 70, 90)]); p.wash(main, dens=0.46, decay=240, mist_y=920)
p.cun(main, 530, 1730, shadow_x=1130); p.trails(main, (1130, 252), n=16, red_index=7)
p.mist(960, 70, 0.8); p.sun(1500, 190, 46); p.save("ink.png")

# watercolour
from watercolor import Watercolor, hexc
from core import blob_pts
w = Watercolor(1920, 1080, seed=1); w.paper()
w.gradient_wash(0, 540, top=hexc('#8fb0cf'), bottom=hexc('#f2cfae'))
leaf = w.shape(blob_pts(900, 760, 260, 90, rough=0.1), soft=2.5)
w.glaze(leaf, hexc('#a9c46b'), 0.75, edge=0.55, gran=0.35, bloom=1); w.save("watercolour.png")

# paper collage
from papercut import Collage
c = Collage(1920, 1080, seed=2); c.background('#232d66', texture='kraft')
c.piece(mask=c.circle_mask(1360, 300, 150), colour='#f6d77a', texture='crayon')
c.face(1360, 310, 128, mood='sleep'); c.save("collage.png")
```

### The example library

Every style has a complete runnable example: `python3 examples/<name>.py out.png --stages stages/`. `--stages` also writes the draw-on snapshots.

```bash
python3 examples/bawansiqian.py         out.png --stages stages/   # ink wash: The 84,000 Dharma Gates
python3 examples/moon_river.py          out.png                    # ink wash: The Moon in Ten Thousand Rivers
python3 examples/watercolor_autumn.py   out.png                    # watercolour: Autumn Lake
python3 examples/watercolor_washes.py   out.png --layout cover     # watercolour: wash backgrounds (--layout bill, --seed N for variants)
python3 examples/papercut_balloons.py   out.png                    # paper collage: Balloon Day
python3 examples/colorpencil_dessert.py out.png                    # coloured pencil: Afternoon Dessert
python3 examples/anime_summer.py        out.png                    # anime: Summer Sky
python3 examples/editorial_ideas.py     out.png                    # editorial riso: Growing Ideas
python3 examples/oil_wheatfield.py      out.png                    # impasto oil: Swirling Sky over the Wheat Field
python3 examples/ukiyoe_fuji.py         out.png                    # ukiyo-e: Fuji at Dawn
python3 examples/pixel_rainy_cafe.py    out.png                    # pixel art: Rainy Night Cafe
python3 examples/clay_lighthouse.py     out.png                    # stop-motion clay: Lighthouse Island
python3 examples/cyanotype_botanicals.py out.png                   # cyanotype: Sun Print Botanicals
python3 examples/stitch_sampler.py      out.png                    # cross-stitch: Home Sampler
python3 examples/panel_radio.py         out.png                    # retro panel: Aurora 64 radio
python3 examples/sticker_market.py      out.png                    # sticker collage x receipt: Weekend Market
python3 examples/notebook_brewing.py    out.png                    # lab notebook x stickers: Coffee Brewing Experiment
python3 examples/chalk_lesson.py        out.png                    # chalkboard: Why is the sky blue
python3 examples/cyberpunk_neon_street.py out.png                  # cyberpunk: Neon District
python3 examples/cartoon_toaster.py     out.png                    # hand-drawn cartoon: Good Morning, Toast
python3 examples/isometric_weather_island.py out.png               # isometric 2.5D: Island Weather Station
python3 examples/lineart_paper_plane.py out.png                    # continuous line art: From Window to Window
python3 examples/soft3d_rise.py         out.png                    # soft 3D: Rise
python3 examples/morph_water_cycle.py   out.png                    # shape morph: A Drop's Round Trip
python3 examples/newscollage_curiosity.py out.png                  # newspaper collage: Curiosity Weekly · Take It Apart
python3 examples/aurora_morning.py      out.png                    # aurora glassmorphism: Morning Plan
python3 examples/bauhaus_form_colour.py out.png                    # Bauhaus geometric: Form & Colour
python3 examples/synthwave_coastline.py out.png                    # retro synthwave: Coastline 1987
python3 examples/perler_strawberry_coaster.py out.png              # perler beads: Strawberry Coaster
python3 examples/petroglyph_migration.py out.png                   # petroglyph: Migration Season
python3 examples/tomb_harvest.py        out.png                    # Egyptian tomb painting: Harvest on the Nile
python3 examples/mosaic_harbor.py       out.png                    # Roman mosaic: The Day's Catch
python3 examples/stainedglass_seasons.py out.png                   # stained glass: Window of the Seasons
python3 examples/illuminated_starchart.py out.png                  # illuminated manuscript: Liber Stellarum
python3 examples/codex_ornithopter.py   out.png                    # Leonardo codex: The Ornithopter
python3 examples/silhouette_family.py   out.png                    # silhouette: Shades of the Wren Household
python3 examples/letterpress_circus.py  out.png                    # letterpress poster: The Circus Is Coming
python3 examples/constructivism_radio.py out.png                   # Soviet constructivism: Radio
python3 examples/artdeco_express.py     out.png                    # Art Deco: Night Express
python3 examples/comic_rocket.py        out.png                    # golden-age comic: Rocket Squad
python3 examples/popart_cat_moods.py    out.png                    # pop silkscreen: Six Moods of a Cat
python3 examples/lineprinter_launch.py  out.png                    # ASCII art (line printer): Liftoff Trace
python3 examples/lowpoly_canyon.py      out.png                    # low poly: Canyon Run
python3 examples/stencil_kite.py        out.png                    # stencil graffiti: Hold On
python3 examples/patch_camping.py       out.png                    # embroidered patches: Three Nights Out
python3 examples/blueprint_lighthouse.py out.png                   # blueprint: Halvard Rock Light
python3 examples/crayon_picnic.py       out.png                    # children's crayon: My Weekend
python3 examples/crt_weather.py         out.png                    # green-screen CRT: Bring an Umbrella?
python3 examples/thermal_kitchen.py     out.png                    # thermal camera: Kitchen Heat Map
python3 examples/delft_canal.py         out.png                    # Delft tiles: Canal Town · A Gust of Wind
python3 examples/cave_hunt.py           out.png                    # cave painting: The Hunt by the Fire
python3 examples/macpaint_garden.py     out.png                    # 1-bit paint program: Windowsill Garden
python3 examples/blackfigure_games.py   out.png                    # Greek black-figure vase: Games on a Vase
python3 examples/graphite_bicycle.py    out.png                    # graphite pencil: The Bread Run
python3 examples/xray_luggage.py        out.png                    # X-ray: Bag 0417
python3 examples/rubberhose_morning.py  out.png                    # 1930s rubber hose: Seven O'Clock
python3 examples/linocut_snowy_village.py out.png                  # linocut: Homeward, First Snow
python3 examples/vhs_birthday.py        out.png                    # VHS home video: Blow Out the Candles
python3 examples/flatvector_night_camp.py out.png                  # flat vector: Night Camp
python3 examples/storybook_acorn.py     out.jpg --gif out.gif      # storybook animation: An Acorn's Autumn
python3 examples/ballpoint_board_game.py out.png                   # ballpoint doodle: Snakes & Ladders, Round 7
python3 examples/overlay_city_map.py    out.jpg --stages stages/   # overlay sheets: Larkhaven on Foot
python3 examples/pastelui_packing.py    out.jpg --stages stages/   # pastel UI: Pack Check
python3 examples/grading_math_quiz.py   out.jpg --stages stages/   # exam grading: Unit Test, Graded
python3 examples/shadowpuppet_cuju.py  out.jpg --stages stages/   # shadow puppetry: Cuju by Lamplight
python3 examples/penwash_neighbours.py  out.jpg --stages stages/   # pen & wash: Sketchbook Neighbours
python3 examples/gouache_rainy_day.py   out.jpg --stages stages/   # retro gouache: Rainy-Day Portraits
python3 examples/bluebook_shared_umbrella.py out.jpg --stages stages/   # blue picture book: The Shared Umbrella
python3 examples/jiangnan_spring_water.py out.jpg --stages stages/   # Jiangnan garden: Spring Water Garden
python3 examples/drybrush_noodle_counter.py out.jpg --stages stages/   # dry-brush blocks: Noodle Counter
python3 examples/twilight_paper_kite.py out.jpg --stages stages/   # twilight storybook: The Kite at the Edge of Night
python3 examples/nocturne_lava_sea.py out.jpg --stages stages/   # hatched nocturne: Lava Meets the Sea
python3 examples/obsidianui_reading_notes.py out.jpg --stages stages/   # Obsidian UI: Reading Notes
python3 examples/canvasboard_moving_plan.py out.jpg --stages stages/   # canvas board: Moving Plan
python3 examples/flexoki_pour_over.py out.jpg --stages stages/   # Flexoki paper: Pour-over, in five diagrams
python3 examples/pencilbook_tortoise_crossing.py out.jpg --stages stages/   # warm pencil storybook: The Tortoise Crossing
python3 examples/colortown_festival_steps.py out.jpg --stages stages/   # colour town: Festival Steps After the Rain
python3 examples/pastelvignette_marmalade_scarf.py out.jpg --stages stages/   # pastel vignette: The Marmalade Scarf
python3 examples/poetichalloween_ghost_jar.py out.jpg --stages stages/   # poetic Halloween: The Ghost in the Jar
python3 examples/oilpastel_warm_cup.py out.jpg --stages stages/   # oil-pastel portrait: Something Warm to Hold
python3 examples/sketchbook_reading_hour.py out.jpg --stages stages/   # sketchbook doodle: The Reading Hour
python3 examples/sketchbook_kite_day.py out.jpg --stages stages/   # sketchbook doodle: Kite Day (16:9)
python3 examples/spotillo_rainy_saturday.py out.jpg --stages stages/   # flat spot illustration: A Rainy Saturday (--layout wide for 16:9)
python3 examples/grainbook_snow_walk.py out.jpg --stages stages/   # grainy picture book: The Evening Walk (--layout wide for 16:9)
python3 examples/grainbook_duck_pond.py out.jpg --stages stages/   # grainy picture book: Feeding the Ducks (16:9)
python3 examples/dreamhills_long_walk.py out.jpg --stages stages/   # dreamy hills: The Long Walk (1:2 phone wallpaper, --preset night or noon)
python3 examples/dreamhills_long_walk.py out.jpg --layout wide      # dreamy hills: the same picture laid out 16:9
python3 examples/sunlitgreen_window_seat.py out.jpg --stages stages/   # sunlit greenery: The Window Seat (9:16 wallpaper, --layout wide for 16:9, --preset late for evening gold)
python3 examples/sunlitgreen_stream_steps.py out.jpg --stages stages/  # sunlit greenery: Steps Down to the Stream (9:16, --layout wide for 16:9)
```
