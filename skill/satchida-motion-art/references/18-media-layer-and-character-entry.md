# 18 · The medium layer: same scene, many drawing methods, characters repainted along with everything

When to read: making a "same scene through many drawing methods" film (art-history speedruns, traversal classes), when one drawing method must make "every stroke painted", or when an already-drawn character must walk into different styles without regenerating frames.

The conclusion first: split scene and drawing method into two passes. The scene only states "what color this is, whom it belongs to, which way the stroke travels"; the drawing method is a separate pass that paints it stroke by stroke from those three. Once split, one room function serves a dozen methods, and character frames are just one region of the scene, repainted along with every method.

"Drawing method" and "medium" below mean the same thing; in the film each method occupies one section, and the reference implementation's code calls it an era.

The complete runnable example is `scripts/engine/reference_films/painted_room/` (one room, 16 methods, 44 seconds). It is not the same engine as `scenes/`; in `scenes/` each style is one scene file, suited to films where every section has a different composition, while this suits films where the composition stays and the method changes. Doc 02 covers this film class's five-layer mechanism; this page covers how to make its "drawing method" layer deep.

## Two roads

- Modify: copy `painted_room/` and change the room, palette, and timeline (its README lists the three places to change). Most new methods can be assembled from the existing brush, dot, and tile traversals.
- Write your own: the seven sections below are the practices that held while building this engine; write your own from their logic. The parameters (stroke length, grid pitch, overlay alpha) are that film's numbers, not quotas.

## 1. The scene hands over two maps and a set of directions

Each frame, the scene is first painted into two offscreen maps: a color map (each thing's true color, gradients allowed) and a region map (each pixel belongs to one thing, one number per thing). Each thing also carries a stroke-direction field: walls brush vertically, floors follow the wood grain, the sky circles the moon, cat fur follows the body.

The drawing-method pass sees only these two maps: what color a point is, whom it belongs to, how far from an edge, how dense the surroundings are. It never needs to know whether it is painting a cat or a chair.

## 2. Paint stroke by stroke

Lay a grid over the frame, one stroke per cell: start slightly randomized inside the cell, walk along the direction field of the region the start belongs to, stop at the region's edge, and take the color from the start's true color, nudged a little. Paint coarse-to-fine in several passes; the fine passes land only where detail is dense (edges, facial features, small objects).

Do not paint one stroke as a uniform round-capped line — that reads as wool embroidery. Split one stroke into several bristles, each with start and end inset a little, so the stroke's two ends rag out; then brighten one side and darken the other for paint thickness.

Swap three things in the same traversal and you have another method: round dots make pointillism, small gapped squares make mosaic, large cells sampling color make pixels; flat fill plus halftone is print, flat fill plus paper texture and a few dry strokes is ink wash. The medium's own base (canvas, rock wall, paper, plaster) is laid before painting begins, and shows where strokes cannot cover — that is correct.

## 3. Outlines draw only the visible segment

Stroke a polygon's whole loop and occluded lines pass through things in front, like an X-ray. Sample a point every few pixels along the contour and check the region map once on each side of the normal: on one side itself, on the other not itself — only that segment draws. Body markings (the orange on the cat's back) register to the same group as their body shape and do not break the outer contour.

## 4. To move, take randomness by "cell + pass"

Still frames can use sequential randomness. Once things move, if one stroke is skipped this frame because its region changed, every later stroke's random number shifts and the whole painting re-shuffles every frame. Each stroke's random numbers come from hash(cell, pass, seed): where the picture did not change, the same stroke stays next frame; only where things passed do strokes change.

To make the frame "alive", let strokes drift slowly along their direction fields with life-cycle fade in/out — never re-shuffle the whole frame.

## 5. The picture updates at 12 cells; the camera runs on full frames

Scene and strokes render on time quantized to 1/12s; camera push/pull/glides and transition seams compute at the film's frame rate. It reads as hand-drawn "on twos" texture while the camera stays smooth, and render cost halves (one painted frame is cached and used for two frames).

## 6. Characters: treat existing frames as one region

Applies when: the character already has painted frames (frame library, hand-drawn, cel-shaded 3D) and this film cannot or will not regenerate a set per style. It is an extension of doc 10's method B (pasting a fixed frame library), not a replacement for C: with generation available and a character who should change costume per style, method C's ceiling is higher.

Three steps:

1. Paint this frame into the color map and write its silhouette into the region map. From that moment it is no different from the room's chair — every method repaints it with its own strokes.
2. When the colors clash with the era (black-figure pottery, ink wash, paper cuts, monochrome print), first map the frame's pixels by luminance into that era's three or four colors, then hand it to the method (in the reference implementation that is `film2.js`'s `HEROMAP`, with overlay amount `KEEP`).
3. Coarse strokes will smear the face. After painting, overlay the original frame at low alpha so the features read. How much depends on the method: coarser strokes overlay more; flat-fill classes need none.

Known edges: in very gray or very dark methods (Cubism, cave), characters easily wash out — give them a separate notch of brightness contrast; in flat-fill methods the character mostly keeps its original style with only colors changed, and going further needs a per-method transform (e.g. Egypt's profile-face law).

## 7. Transitions are the character's actions

A mask sweeping by itself shows "the film is changing style"; a seam following the character's body shows "he changed the world". Four kinds, rotated, landing on the music's beats:

- Pull: he reaches out and drags the next painting in from off-frame. The seam is a vertical curve bulging at hand height, with a fold's bright edge and shadow behind it.
- Walk: the seam rides on him as he crosses the frame; his front half and back half are two methods.
- Jump: on the landing frame, the new method splashes from his feet as an irregular circle and the room's contents bounce once.
- Wave: several brush sweeps pass from his hand's direction; wherever they pass changes.

He is painted in both eras' frames, and the seam cuts wherever he is, so no separate character transition is needed.

For the ending, release all methods at once (vertical strips drop in sequence, one method per strip, all painting the same room) — a stronger close than stopping on the last method.

Score and picture share one beat table: how many beats each method occupies is fixed first, and both picture cuts and score bars derive from it. One short motif changes instrument per section — the same idea as "one room, changing methods". Method in doc 05.

## Pitfalls

- In `file://` pages, loading images directly taints the canvas and frames cannot be exported. In the render script, read character frames as data URLs before passing them into the page.
- Per-pixel remapping of character colors is slow; cache by "frame + era".
- Repeatedly creating offscreen canvases eats memory; keep a pool and reuse by slot.
- In multi-process rendering, slow sections (impasto, pointillism) cluster in the film's middle; slice frames into small chunks and deal them round-robin to processes — do not cut into a few big contiguous ranges per process.
- However fine the methods, stills cannot show the film's rhythm. Watch it once at normal speed before delivery.
