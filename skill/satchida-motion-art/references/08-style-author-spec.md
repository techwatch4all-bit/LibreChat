# 08 · Style author spec (general version, for people and agents writing scenes)

> Replaces the earlier `era-author-spec.md`, which was bound to the replication project. When dispatching an agent to paint a style, give it this page's path plus the concrete "this project" information.

## Interface

A style section = `scenes/<id>.js`:

```js
SCENES['<id>'] = { draw(c, lt, t) { /* fill 1920×1080 */ }, init(IMG) { /* optional: one-time precompute */ } };
```

- `c` target 2D context; `lt` section-local time (seconds, counted from that section's transition start); `t` whole-film time.
- Section table `eras.js`: `{ id, eighths or dur, transition: { type, dur }, counter: {...} }`. Film length is computed from the section table.
- Transitions `transitions.js`: `TRANSITIONS.<name> = (c, A_old, B_new, p, o) => {}`.
- A missing scene file, syntax error, or unregistered id → the engine refuses to start; render/qa fail loudly. Never judge success by "it looks rendered".

## Read first (in order)

1. `references/02-mechanics.md` (five-layer mechanism; only for speedrun/traversal films), `04-pure-code-drawing.md` (pipeline, renderer quick reference, pitfalls), `07-proven-practices.md`.
2. `references/style-recipes/INDEX.md`: find the closest style as a starting point and read that card.
3. Benchmark implementation `scripts/engine/scenes/09_postimp.js`; the source of the scene closest to your style.
4. `lib/`: `paint.js` (noise/texture/renderers/palettes/choreo), `rig.js` (character rig, visibleLines), `kit.js` and other utility libraries. **Search the library before writing your own.**

## Two starting points

**With a reference film**: run `scripts/analyze/breakdown.py` first for reference frames (`ref/segNN.png`), motion heatmaps, and transition contact sheets, and deconstruct per doc 01. Reference frames decide composition, motifs, and palette; the heatmap decides "what moves in the painting".

**Without a reference film** (more common):
First read [cross-scene style distillation](15-cross-scene-style-transfer.md). While a new card is in research status, work enumeration, production hypotheses, and implementation evidence stay separate; rebuild the scene for the new subject, and do not inherit people/props/layouts from famous works.
1. Write down the style's 3–5 most recognizable formal elements (material, brushwork, palette, motif, medium traces). Check primary sources (original images, art-history descriptions); on first card creation look at several different works and record stable features and exceptions — never generalize all works from a single famous piece.
2. Give each element "a way to move" — how it would move in that painting's world (water trembles, paper floats, gold glints, plates misregister, film jitters).
3. Work out how this painting is physically made in reality (brushing, carving, printing, pasting, inlaying, spraying, rendering), and code that physical process as the renderer.
4. Produce one frame first: compare the still tile against originals; only when it reads at a glance, make it move.

## Hard requirements

1. **Composition**: speedrun/traversal films place things at the project-given composition coordinates (consistent across sections; transitions and "the same character traversing" depend on it). Other subjects compose per subject: the style decides how to compose and use light — do not inherit the demo room's coordinates.
2. **Characters**: speedrun/traversal films use the `RIG` rig and shared choreography, changing drawing method but not stance or motion; other subjects design characters and stances for the subject (humans via AI frame generation, see doc 10). **Characters must also pass through that style's material treatment** (strokes, grain, paper-texture multiply, ink-bloom edges, halftone dots, plate misregistration...) or they read as pasted clip-art — the most common weakness across the 36 styles. When line art is needed, use `drawGirl/drawCat`'s `mode:'line'` (internally routed through visibleLines, so it never draws through).
3. **The painting must be alive**: one main action + 2–4 motif micro loops, legible within the dwell window. In speedrun/traversal films character actions use whole-film time (`PAINT.cupCycle(t)` and the like), not reset per section.
4. **Smoothness**: never re-seed whole-frame randomness at low fps (reads as flicker); boiling is only for line art or motif regions. Deliberate "stepped frame rates" (rubber-hose 12fps, shadow puppet 10fps) use `stepTime` — that is style, not stutter. A scrolling pattern's modulo period equals the pattern's true period.
5. **Determinism**: all randomness is seeded; the same t renders twice pixel-identically.
6. **Performance**: static parts use `PAINT.cached`; pixel-reading offscreens use `willReadFrequently` and `g.reset()` each frame; target ≤150ms per frame (qa measures real time with GPU flush).
7. **Text**: text inside a style is preferably drawn as paths in that style's material; when using fonts, verify glyphs exist with `U.assertGlyphs` first (missing glyphs silently fall back to system fonts).
8. **Aging does not touch characters**: peeling, stains, and scratches stay in the background; give character regions a protected zone (Dunhuang flake spots landing on a back read as "a torn shirt").

## Self-check and delivery

```sh
uv run --with playwright python <project>/render.py --solo <id> --stills 0.4,0.6,0.8,1.0 --out <render>/<id>   # stills
uv run <skill>/scripts/qa.py --project <project> --ids <id>                                                    # numbers
```

Each section goes through at least 3 rounds: compare stills against original/reference tiles → qa for motion/still-frame pairs/jumps/elapsed/determinism → revise. Four questions: (1) Is it recognizable as that style at a glance? (2) Are the characters right, and do they blend with the background? (3) Within the dwell window, can you see the painting move — without flicker or stutter? (4) Any glitches (occlusion, broken lines, misalignment, blanks, overlapping text)?

Delivery: `scenes/<id>.js` + a recipe card (in `style-recipes/` format: pipeline, key parameters and hex values, how the motif animation works, signature transition, performance, pitfalls, still-improvable). Only field-tested numbers get written as parameters, performance, and quality verdicts; untested parts stay in research status. Validating one scene does not license claims of cross-scene validation. **Before delivering a multi-section film, dispatch an agent that did not build it to review only the finished film.**

## The three-direction hard gate when unattended

With the author present: for new style directions and character interpretations, produce three options on the same frame for him to pick.
With nobody to ask (automated tests, overnight batches): execute the direction stated in the task brief, and in the delivery notes list, one sentence each, "the two other directions that could have been offered", for him to choose on return.
