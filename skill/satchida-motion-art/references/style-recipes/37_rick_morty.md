# 37_rick_morty · Rick & Morty flat-outline cartoon

When a shot list uses coded characters, write `Style: 37_rick_morty Rick & Morty-style flat cartoon` and `Characters: original semantic SVG characters` to enable the narrow exception of character checking; y4 still needs a frame library.


Source: the SVG single-frame replica and animation experiment of 2026-10-14. The 36th catalogued style; internal ID is 37_rick_morty to avoid overwriting the existing 36_picasso_blue. It is an independent style; crossing into other art movements is optional narrative.

## Checks before starting

- This example is an SVG pipeline; it cannot be added directly to the Canvas engine's eras.js or recorded with ordinary render.py — otherwise the SVG characters get dropped. Use this example's render.py to screenshot the whole page, or export video first and feed it into the engine as a clip. The old 35-style gallery and overview image stay as they are; this example previews separately.
- The example contains only the code-drawn room, girl, and cat; it depends on no original-film screenshots, Rick/Morty character assets, or audio. When migrating to new subject matter, keep the drawing method and rearrange the scene.
- This style permits drawing characters as semantic SVG per explicit reference — a narrow exception to the existing "characters via AI-generated frames" route; it does not extend to real-person portraits or arbitrary chibi characters.

## Runnable starting point

Copy the whole `scripts/engine/reference_films/rick_morty/` directory into the project. Opening index.html directly gives offline preview, playback, and time scrubbing. Node, APIs, and online fonts are all unnecessary.

```sh
uv run --with playwright playwright install chromium
uv run --with playwright python render.py --stills 0,1,2 --out verify
uv run --with playwright python render.py --from 0 --to 8 --fps 24 --out style36.mp4
```

Video export additionally needs ffmpeg. The entry defaults to 8 seconds silent; --to can specify longer. The per-frame interface `window.seek(t,state)`: t is non-negative seconds; omitting state auto-runs cup drinking and blinking; passing state gives full performance control. state includes `look:[x,y]`, `catLook:[x,y]` (each axis −1..1), `sip`, `catJump`, `gBlink`, `cBlink` (all 0..1). seek does not accumulate state and supports out-of-order rendering; auto-blink and tail sway depend on t.

File division of labor: svg-kit.js provides rounded-outline primitives, curves, seeded textures; room.js draws the layered characters and scene, with colors centralized in the C object; index.html handles preview and seek; render.py handles whole-page per-frame screenshots and encoding.

## Drawing and motion

1920×1088 original coordinates, viewBox `0 4 1920 1080`. Stroke #222323, default 2.35px, round caps and joins; detail lines 1.6–2.6px. Warm gray wall #cdbf96, wood floor #9b7752, skin #efc4a0, sky #a7d6ea; hard-edged flat fills, a few same-family dark sides, low-contrast mottling left in the background. Characters and props share the stroke; no realistic lighting is added for texture.

Faces rely on contour proportions, eyelids, and a few mouth curves; big whites, small dot pupils, no glassy highlighted eyes. Hair tips use mixedPath; cheeks and limbs use smoothPath. Body, head, arms+cup, eyelids, pupils are grouped; fix the static pose first, then move with the existing anchors. The tail generates a closed outline from a centerline + width; per-frame random shapes are forbidden.

Default performance: slow cup raise, small-angle head turns, gaze offsets, deterministic blinks, cat tail sway. catJump is a sinusoidal airborne progress, shared by body and tail; no landing squash and no walk cycle. While drinking, the shoulder anchor stays put and the cuff follows the cup.

## Migrating from the reference frame to other scenes

Test composition and occlusion first, then take region median colors; threshold-connected component analysis on the dark outline can assist coordinate measurement, but never treat auto-traced paths as a character armature. Group hands, eyes, face, hem, and furniture semantically; the static pose is the skeleton's frame 0. Walking needs toe-driven two-bone IK with phase advanced by actual distance; this example has no walk rig — do not claim arbitrary character walking support based on it.

Frontal characters walking sideways easily scissor their legs: widen the foot stance, shorten the stride, use gaze to turn; do not mirror characters with asymmetric clothing. Sort ground objects by foot/base y; clip wall textures with the same shapes. When SVG and Canvas share a page, isolate modules with an IIFE; SVG filters' userSpaceOnUse regions must use real canvas coordinates, never 0,0,1,1.

## Verification and follow-up backflow

The bundled render.py uses Chromium's `--disable-partial-raster` to avoid antialiasing differences from SVG partial rasterization. Independent re-verification 2026-10-14: under this config, cold start and out-of-order frame fetch [1,7,1,1,0,1] give a 0-pixel difference for the t=1 screenshot; ordinary browsers only guarantee deterministic DOM state — do not claim pixel-identical screenshots.

Read this card's shortcomings before use; write new findings back into this card with date, scene, evidence, and verification status. When an old conclusion fails, fix the original sentence first; a one-off experience doesn't become a whole-style rule; reproducible stable failures get fixed in code first and determinism-tested.
