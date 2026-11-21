# 11 · Long-scroll traversal film: one person walking right, through painting after painting

The method behind *Huashu Walks Through Famous Paintings* (2026-10-05, 123.7 seconds, 24 worlds). Unlike the art-history speedrun (one room, changing styles), this is **one horizontal long scroll**: each world is a horizontally extended painting, butted end to end; the hero keeps walking right, and the moment he crosses a boundary, his style and the world's change together.

Demo: `scripts/engine/demos/long_scroll/`, containing 3 segments (Egyptian murals → Monet's *Japanese Bridge* → 8-bit pixel), about 15.6 seconds.

```sh
uv run --with playwright python scripts/engine/render.py --film demos/long_scroll --stills 1,5,9 --out preview   # three stills
uv run --with playwright python scripts/engine/render.py --film demos/long_scroll --out long_scroll.mp4          # whole film
```

Browser preview: start a static server in `scripts/engine/` and open `index.html?film=demos/long_scroll`; `&only=28_monet,14_8bit` shows only those sections; `&v=330` tries another stride.

## Files

| File | What it does |
|---|---|
| `eras.js` | film entry: loads libraries, `FILM_ORDER` (section order), registers frame libraries, generates one section with `dur = WORLD.total` |
| `lib/world.js` | the skeleton `WORLD`: timeline (walk → stop to interact → walk), hero traversal, camera, boundary-cropped hero, boundaries, badges. **Read its header comment first** |
| `lib/crossing.js` | `XING`: reads frame libraries, draws character frames (`XING.actor`), stroke materials, the Monet world |
| `lib/acts.js` | `ACT`: small-scene utilities (skipping-stone trajectories and the like) |
| `lib/xing2_*.js` | small utilities shared by several segments, loaded on demand at the top of segment files |
| `segments/<id>.js` | one file per world, calling `WORLD.add({...})` |
| `frames/<key>/` | character frame library: 8 transparent PNGs + `meta.json` (per-frame foot anchor `ax/ay`, size, airborne flag `air`; `ref_h` is standing height in pixels) |

## Adding a segment

1. Create `segments/<id>.js` calling `WORLD.add({ id, year, name, w, hero, acts, back, front, seam })`; the interface is in `lib/world.js`'s header comment. The world itself is drawn in code — prefer adapting an existing style scene from `scenes/<id>.js` into a horizontally extended version (segment width 2000–2800).
2. Generate character frames: per world one "walking 8 frames", plus one "interacting 8 frames" where there is an interaction; have the image model repaint them in that style, green-screen, and slice (`scripts/key_split.py`, method in doc 10), place in `frames/<key>/`, and write `meta.json`.
3. Add `<id>` to `eras.js`'s `FILM_ORDER`.
4. Render stills to check both sides of boundaries, then run `qa.py --project scripts/engine --film demos/long_scroll`; determinism must be ✓.

## Key conventions (film-wide, hard-coded in the skeleton)

- **Ground line `WORLD.GROUND = 760`; standing hero height 300; hero at 720px in frame.** At segment ends (near x=0 and x=w, ±150px) the ground must return to 760, and the horizon should sit at 480–560 so both sides meet across boundaries. Bridges and stairs are allowed in between (`ground: lx => y`).
- **All events are timed relative to "interaction start".** Use `WORLD.actT(segment)` for the interaction's whole-film time and `r = S.t - WORLD.actT(ME)`; never write "N seconds into the segment". The film's stride later went from 330 to 560 and segments written this way needed no changes.
- **The camera only advances, never retreats.** Camera target = hero x − 720 + the interaction's forward `lead`, taken as the historical maximum then Gaussian-smoothed, so the whole run is monotone and stops/starts stay smooth. To hold the camera during an interaction, write `lead: 0`.
- **Each segment's boundary is drawn in that segment's signature language** (`seam`: paper edge, pixel checkerboard, colored-block divider...) — the long-scroll version of "transition = the next style's signature language".
- **The hero's walk fps scales with stride** (`hero.fps`), 8 frames per gait cycle; when the style needs an extra material pass, write `hero.draw(c, key, i, o, S)` in the segment to composite it yourself, without touching the shared library.
- **Music**: picture first, score after. Give each segment whole beats and micro-adjust tempo between 86–104 BPM so every boundary lands on a bar downbeat (measured: 24 boundaries, max error 11.7ms); ears cannot hear ±8% per-segment tempo differences.
- **Do not add gags the hero did not ask for.** The skeleton has a "souvenirs stacked on the hat" feature (`FILM_HAT_ITEMS`) that competes with the scene for attention; it is off by default.

More evidence and numbers: `07-proven-practices.md`, items 36–38.
