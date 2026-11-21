# 04 · Pure code drawing: paint a frame with real artistic quality on Canvas and make it alive

This page's main line is pure code drawing: scenes and objects come from procedures and style renderers; people, anthropomorphic characters, and robots are not drawn into the finished film with code — for the generated-frame approach see doc 10, for the delivery line see `character-fidelity.md`. This page is the method summary after finishing 16 styles the first time; each style's concrete parameters live in `style-recipes/<id>.md`.

## 1. Project skeleton (`scripts/engine/`, copy it and start a new film)

```
index.html      load order: lib/fonts → lib/util → lib/paint → lib/rig → eras → transitions → scenes/index → engine
eras.js         section table: id, eighth-note count (eighths), transition {type,dur,delay,cx,cy}, year-sign style
scenes/<id>.js  one file per section: SCENES['<id>'] = { draw(c, lt, t) }   ← most of the work lives here
transitions.js  transition library: (c, A_old, B_new, p, o) → draw one frame
engine.js       beat grid → per-section t0/t1; during transitions old and new each draw into offscreen buffers and hand over to the transition; beat camera impact; year counter (value depends only on global t)
lib/paint.js    noise, texture, hand-drawn boiling lines, style renderers, regional palette swatch, shared choreo, heat haze, particles
lib/rig.js      character rig: RIG.girl / RIG.cat → per-part Path2D + anchors; drawGirl/drawCat (mode: fill/line); ik2, smooth, taper
render.py       headless Chromium calls renderFrame(t) per frame → PNG pipe → ffmpeg 60fps, can mix audio; --solo <id> single-section preview, --stills extracts stills
compare.py      original | replica side-by-side tile at matching times
```

Render speed: a 15-second 60fps whole film takes about 90 seconds (M-series Mac). Per-frame cost of a single section is mostly 5–40ms; the heaviest, Van Gogh, is 110ms.

## 2. How to paint one style (five layers; benchmark `scenes/09_postimp.js`)

> The five layers are the default order for oil/print classes, not universal: **ink wash** runs reversed (paper is the base, ink only accumulates upward, large areas stay blank — never fill first); **pattern classes** (Kusama, Bauhaus) are "flat fill then scatter patterns" where the pattern itself is the renderer; **chiaroscuro** is "paint the bright version first, then multiply by a light map".

1. **Flat underpainting**: large areas (wall, floor, sky, out the window) are placed with correct position and light using flat colors/gradients. This layer fixes the composition; the style is not yet visible.
2. **Style renderer repaints**: use the underpainting as a color source and repaint the whole frame in that style's brushwork — Van Gogh's flow-field long strokes, Impressionist short dabs, mosaic stones, ukiyo-e color-plate offset + patterns, Cubist facets, Pop halftone, 8-bit low-res per-pixel, raytraced per-pixel shading... The renderer decides "whose painting this is".
3. **Small objects get their own layer**: small things like chairs, vases, and frames get shattered into mush if run through the renderer together with large areas. Draw them separately with finer parameters, `source-atop` only onto themselves.
4. **Characters**: speedrun/traversal films use one rig (RIG) and one shared choreography, swapping only the drawing method (other subjects design characters for the subject) — flat fill, then that style's fine texture, then clear contours and features last. Characters are where the audience's eye lands; they must read as who they are.
5. **Living highlights**: era-motif micro loops (see doc 02). Continuous motion uses continuous time; hand-drawn lines use 8–12fps seed-swapped "boiling" for a handmade feel.

## 3. Style renderer quick reference (in `lib/paint.js` or written per scene)

| Renderer | Fits | Key |
|---|---|---|
| `strokes` flow-field strokes | Van Gogh, expressionism, oil paint | write the direction field per region (wall vertical, floor along perspective, starry sky along the vortex); the **regional palette** matters more than color jitter; a dark stroke edge on every stroke gives thickness |
| `dabs` color dots | Impressionism | warm/cool-shifted elliptical dabs; **this is not pointillism** (no fixed pure palette, dots unequal in size — that's what makes it Impressionist) |
| optical-mix pointillism (29_seurat) | Seurat, neo-impressionism | pure palette juxtaposed by proportion, equal dot sizes, complementary dots, light bleed at the chiaroscuro boundary |
| tessellation (04_roman, custom) | mosaic, stained glass | layout computed once, colors flow through stones every frame; stones follow contours (distance-field isolines); stones are 8–28% larger than half-spacing so the midline cuts a gap |
| color plates + patterns (07_ukiyoe) | ukiyo-e, woodcut, silkscreen | fill offset (3,2)px against the ink line; patterns as CanvasPattern; horizontal brush streaks blooming |
| `facets` | Cubism, low poly | semi-transparent gradient faces stacked into space; don't clip triangles so silhouettes gain straight edges |
| `halftone` | Pop, old print | a small tile `createPattern` is 10× faster than per-dot; 45° grid |
| low-res per-pixel (14_8bit) | pixel art, retro games | draw at 240×135 then nearest-neighbor upscale; cap 14 colors; 1px black outline per part |
| per-pixel shading (15_raytrace) | early CGI, plastic, metal | uniform plastic shading (base + radial darkening + environment reflection + hard highlight); mirrored ground reflections |
| gold leaf (05_gothic) | gilding, icons, ornament | per-pixel polish texture + embossed dark lines offset 1px from bright lines; highlights land only on a "goldness" mask |
| sfumato (06_renaissance) | classical oil painting | whole-layer soft blur + semi-transparent sharp layer; craquelure + canvas weave + vignette + yellow glaze |
| variable-width paths (10_nouveau) | Art Nouveau, calligraphic lines, print | offset both sides of a point list by width into a polygon; a darkened offset silhouette underneath = thick outside, thin inside |
| grain dabs (16_2026) | contemporary flat illustration | scatter dots inside shapes, density a function of position; static parts all cached |
| dry brush + ink bloom (17_ink) | ink wash, calligraphy, Eastern freehand | tip-in/tip-out, dry-brush from equal arc-length sampling; `filter='blur()'` blooms (deterministic on Chromium); paper is the base, ink only adds |
| long curved flow strokes + per-row warp (19_munch) | expressionism, flowing feel | long strokes following the flow field for 20–30 steps; whole frame sinusoidally displaced per row (margin ≥ max displacement to avoid gaps) |
| watercolor wash (25_ghibli) | Ghibli backgrounds, watercolor | transparent layered color + water-edge marks; water-edge stroke alpha fades as it expands |
| grayscale-photo halftone (22_constructivism) | constructivism, old newspapers, photo collage | dot radius keyed to brightness, 45° grid, batched into one path and filled once |
| two-version light/dark clipping + clipped long shadows (24_hopper, 23_dali) | Hopper, surrealism, hard light | paint bright and dark versions, clip by light patches; shadows via clipped affine transforms |
| VHS channel-split post (26_vaporwave) | vaporwave, retro video | RGB misalignment, scanlines, tracking-noise bands as a post overlay |
| light-map multiply (32_rembrandt) | chiaroscuro, night scenes, candlelight | paint the bright version, then multiply a light map (window light + candle radial) |
| cel hard-shadow bands (35_shinkai) | Japanese animation, Shinkai | part minus its translated self = hard shadow band; lit bright edges |
| stepped frame rate `stepTime(t,fps)` (33_rubberhose, 34_shadowpuppet) | old animation, shadow puppetry, stop motion | 12fps/10fps choppiness is half the style, not a defect |

## 4. Characters: one rig, a dozen drawing methods

- Don't hand-wave rig coordinates: overlay a 20px grid on an AI design sheet (or any reference), read key points per part, and smooth into Path2D with Catmull-Rom (`RIG.smooth`). The first hand-written girl read like a boy; after measuring points, one pass read as a 17-year-old blonde girl.
- Sitting naturally hides the legs in a long skirt; holding a cup uses two-bone IK (upper arm 165 / forearm 122), elbow pinned downward.
- Anchors `G.A` (crown, forehead, neck, chest, waist, knees, hands...) let each style add costume: Egyptian broad collar, Gothic halo, ukiyo-e shimada hair, Bauhaus joint discs, Pop big waves.
- Styles may stylize the rig (Egyptian profile-face/frontal-eye, black-figure silhouette, Cubist half-blue face, pixelation) but stance and action rhythm must match the rig — this is where "the same pair of characters is traversing" comes from.
- Big ending performances (jump, collapse, paw stretch, gasp) need not be forced into the generic rig: 16_2026 builds its own pose library (each pose a set of local key points, interpolated numerically), squashes with the sole as axis, and flips at the flattest frame.

## 5. Making the painting "alive": action lists and how to measure

- Per segment at minimum: one continuous protagonist action (choreo.cup) plus 2–4 motif micro loops. Short segments (<0.5s) need 15–30fps stepping to read.
- Self-check motion volume: render two frames (**avoid the beat camera impact 0.35s after a transition**, or the whole screen counts as moving) and diff them. First-pass numbers (after zoom settles, 0.45↔0.9s): cave 2.8%, Egypt 3.4%, Rome 6.4%, Greece 9.9%; the original's heatmaps for the same segments: 6.9%, 6.2%, 17.3%, 11.6%. If too still, add motif actions.
- Moving things should sit at the focal point (in the speedrun demo: the person, cat, window; for new subjects the focus follows your composition).

## 6. Pitfalls

- **Composite modes**: per-pattern `source-in` clears each other (Klimt's gold robe vanished entirely) — paint the pattern onto a full scratch canvas first, then `source-in` once by silhouette; `destination-out` on the section canvas digs transparent holes that become black in video — dig in an offscreen buffer and paste; paper texture/grain over a character cannot use `source-atop` (paper color whitens the figure) — clip the texture layer with `destination-in` by silhouette, then multiply it back.
- Self-drawn glyphs: two opposite-winding strokes in one path cancel under nonzero winding, leaving holes — fill each part separately.
- "Melting" transitions: having the new frame drip down as round-headed droplets (profile `(1-u²)^0.3`); dragging the old frame downward produces spikes, not droplets.
- Set transition duration by "the visible part": an inOut easing barely changes at either end — a complex signature transition at 0.34s is only readable for 0.2s and reads as a plain wipe; give it 0.48–0.5s.
- Semi-transparent layered pieces like shadow puppets/paper cuts multiply to black at overlaps — tune order and opacity per material.

- `putImageData` straight to the target canvas bypasses the engine's camera-impact zoom and transition clipping — write to an offscreen buffer, then `drawImage`.
- Offscreen contexts that read pixels need `{willReadFrequently:true}`; call `g.reset()` every frame or the previous frame's lineJoin/state leaks, and frame 0 disagrees with the rest.
- `drawGirl(mode:'line')` at the top layer draws occluded outlines through the body (far sleeve through torso, hat brim through hair). Use `RIG.visibleLines(key, (g, lineColor) => draw the whole thing, trueLineColor, box)`: draw twice with the same method, swapping the line color to white as a sentinel — pixels that differ between the two passes are unoccluded lines (including facial lines). Order: fill → style texture → visibleLines patch-up.
- **Camera impact must hit both old and new layers**: impact only the new layer and the transition's first frames show no motion on the incoming side — "sound arrives before picture" (v1 review measured a 0.1–0.17s lag).
- **Whole-frame strokes re-seeded at 8fps = flicker, not life**: review measured whole-screen jumps of 18–20, larger than transitions. Fix stroke positions; let the direction field change continuously over time (flame-like sway); boiling is only for line art.
- Do not re-parameterize only the dynamic region (stone size, stroke density) — when still, it reads as a patch.
- In coarse-grain styles (mosaic/pixel), text needs monospace bold strokes (each stroke ≥2 grains wide); thin fonts break.
- Make small things bigger than feels right: the ukiyo-e wave claw read at nothing as 22–50px; 44–74px is "The Great Wave".
- Determinism: all randomness is seeded; rendering the same t twice must be pixel-identical, otherwise the render flickers.

## 7. Delegation (multiple agents painting in parallel)

Write `era-author-spec.md` first (interface, available libraries, benchmark, hard requirements, reference files, self-check commands, delivery notes), then dispatch agents in groups of 4 eras. The spec says explicitly "do not modify lib/ or other agents' files". Each group returns in 30–35 minutes, and notes sediment directly into `style-recipes/`. The first 16 sections all passed in one round, mainly thanks to the spec plus a benchmark implementation.
