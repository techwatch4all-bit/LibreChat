# 16 · Style demo protocol: from "inspired flat illustration" to "recognizable at a glance as whose painting"

When to read: building or redoing the demo scene of any art style (`scenes/<id>.js`), or dispatching an agent — give it this page's path. Doc 15 governs "how to research a style and transfer it"; this page governs "what level a demo must reach to count, and how to get there step by step".

## Why the 17 demos added on 2026-10-15 were nearly unusable

On 2026-10-16 they were rendered to stills, viewed side by side, and compared against public-domain originals; five root causes were found (most of the 17 fit; 45 Renoir is an external bitmap + grid warp and 44 is curtained — not flat vector blocks — but both equally lacked original anchoring and a medium layer):

1. **Nobody looked at the originals.** Recipe cards had only text descriptions and museum links, so the builders (agents) painted from impressions. The result: most images were the same modern flat illustrator with a different palette — clean vector shapes, the style reduced to "palette + one layer of noise".
2. **Card wording removed the anchors too.** "Do not generalize from a single famous work" and "do not reuse compositions" were meant to prevent plagiarism but became "do not work from the originals". What must be prevented is copying famous works' figures and coordinates — not learning brushwork, material, color relations, or figure-construction logic.
3. **No "medium" layer.** The old benchmarks (Van Gogh 09, ink wash 17) are strong because the picture passes through real painting materials: flow-field strokes, dry brush, ink bloom. The new scenes ran 35–70 lines and only drew shapes, with no material pass.
4. **One subject applied to every style.** Washing machines, water wheels, and machine repair kept recurring (this redo round did not fully avoid it either: both 38 and 47 have "wooden crates / cargo" and 51 used a water wheel again — 47 has been changed to sacks; the rest are on the progress list), flattening each style's own narrative logic (Ma Yuan's corner, miniature's full coverage, Gauguin's cropping, Giotto's sightlines).
5. **No score threshold.** Self-checks covered only qa's technical items (renders, deterministic, no flicker); nobody asked the originals "does it look like it" — so running for 6 seconds counted as delivered.

## The protocol (in order; every step has an artifact)

### 1. Original anchoring

```sh
uv run <skill>/scripts/analyze/fetch_reference.py --out <project>/reference/<style> "Artist WorkA" "Artist WorkB" "Artist WorkC"
```

At least 3 **different works** (doc 15's standard). The script pulls public-domain images from Wikimedia Commons, stores them locally, extracts a dominant palette, and produces a contact sheet. Then **actually look at that contact sheet** and write down:

- 5 signature features, each marked "must / bonus / forbidden". Example, Ma Yuan — must: one-corner composition, large blank space, axe-cut texture strokes; bonus: drooping willow, a tiny figure looking into emptiness; forbidden: full-coverage fill, vivid color.
- Dominant palette (take the script's extracted values; state what the lights lean toward and what the darks lean toward).
- How this painting is physically made in reality (brushing, carving, tracing, coating, pasting). That physical process is the renderer's spec.

### 2. Recompose the subject by the style's own logic

Do not copy famous works' figures and coordinates, but learn **how it organizes a picture**: Ma Yuan's blank space + one corner; miniatures standing the ground plane up and filling it, architecture cut open; Gauguin cropping the foreground and dividing with diagonals; Giotto locking figures together by sightlines; Impressionism giving the sky half the canvas and letting water break the shore into broken strokes. Write one sentence stating "this style's composition rule", then lay out the new subject by it. **One subject may not be used by a second style.**

### 3. Paint the "clean form", then pass the "medium channel"

Layering noise on flat vectors is forbidden as a style. Scenes split into two layers:

- Form layer: draw objects, people, and space cleanly (Canvas paths or offscreen canvases).
- Medium layer: pass the form layer through real painting materials with `lib/medium.js` or the older libraries.

| Channel | What it does | Used by |
|---|---|---|
| `MEDIUM.broken(src, o)` | repaints as stroke-by-stroke broken strokes; lights lean warm, darks cool | Impressionism (Sisley, Pissarro, Guardi, Renoir) |
| `MEDIUM.fresco(c, plate, o)` + `MEDIUM.plaster` | pigment absorbed by lime + plaster grain, pinholes, seams | fresco (Giotto, Piero, Raphael) |
| `MEDIUM.silk` + `P.brush` / `P.inkWash` | silk weave, dry brush, ink in five tones | ink wash (Ma Yuan) |
| `MEDIUM.flat(c, path, fill, o)` | cloisonné enamel: same-color blocks with short strokes following the brush direction + thick uneven dark outlines | Gauguin, synthetism, stained glass |
| `MEDIUM.figure(c, o)` | clothed figures with volume: robes, capes, folds, sightlines | murals, miniatures, flat narrative classes |
| `MEDIUM.outline / hatchFill` | variable-width lines, hatching | woodcut, engraving, miniature dark areas |

When the library has no matching channel, write one channel function into `medium.js` — never hard-code it inside one scene.

### 4. One frame first, side by side

Produce a still first; do not animate first.

```sh
uv run --with playwright python <project>/render.py --film style_studies --solo <id> --stills 3 --no-counter --out render/<id>
uv run <skill>/scripts/analyze/side_by_side.py --ref reference/<style> --frame render/<id>/t003.00.png --out compare/<id>.jpg
```

"Recognizable at a glance as whose painting" can only be answered holding that side-by-side image.

### 5. Make the painting alive: the style's own motion logic

One main action + 2 motif loops (doc 08, item 3). Each style moves its own way: ink follows wind, brushstrokes breathe, water shatters reflections, murals barely move but sightlines and handoffs do. Not every style gets the same fades.

### 6. Score; threshold 80; at most two rounds

| Item | Points | How to judge |
|---|---|---|
| Signature hits | 35 | check against step 1's "must" list one by one; 7 points off per miss |
| Medium credibility | 20 | zoom 1:1: real painting material, or vector + noise |
| Composition and narrative | 15 | does it use the style's own organizing logic; is the event legible at a glance |
| Figure and object construction | 15 | weight and relations; juvenile at a glance or sticker-like scores below 8 |
| Motion | 10 | alive without flicker; motion on events |
| Technical | 5 | qa's determinism, framing, elapsed time |

**Two one-vote vetoes**: signature hits below 25; figures or the subject juvenile at a glance (doodle feel). AI judges factual items only; taste items (is the composition pleasing) belong to the author. Self-scores are for ranking only and are never written as "meets the bar". After two rounds below 80, record status as a research recipe, put the sticking point in the card's "still improvable", and do not register it as implemented.

**Self-scores inflate.** This batch (2026-10-16) self-scored ~10 points higher on average than independent review (up to 17). Therefore: score tables must carry item scores and the signature list; the independent recheck score sits beside the self-score and the lower one wins; if a one-vote-veto item appears in the progress table's "current weaknesses" column, status may not say "complete".

## The figure rules (the most fragile link in the new styles)

This section **merges into one rule** with SKILL.md's narrow-bridge character rules, which governs:

- **General styles**: real people / the user / anthropomorphic characters go through AI frame generation + keying (methods B/C); code handles only position, frame swaps, and material; without image generation, hands and backs only.
- **Narrow exception (explicitly chosen flat-narrative classes, code-drawn people allowed)**: 37 Rick & Morty, 52 South Park paper cutouts, and the 2026-10-16 redone mural/miniature/synthetism demos (38 Giotto, 48 Gauguin, 51 Persian miniature). These three are **research-grade demos, not character solutions for delivered films**: when a delivered film needs a protagonist the audience should identify with, still use B/C.
- Even exception figures need weight and sightlines: eyes oriented toward the other, hands reaching for objects, drapery following force. Round heads on pill bodies do not pass.
- Do not enlarge figures that did not work: shrink to long shot or back view, or let the frame crop the foreground figure.
- Do not borrow a named character's costume color combination (52 swapped its teal hat + light pom-pom for exactly this reason); subjects should not wholesale-copy an original's title-card composition either.

## Known pitfalls

- **The fetched originals must be checked against the contact sheet**: search results mix in maps, modern photographs, and framed wall rephotographs from museums (42 Guardi's third hit was a modern church photo; 47's third was a framed rephotograph; 50's first and third were the original and the color study of the same *Walking on a Mountain Path in Spring*). `fetch_reference.py` only does near-duplicate removal and central-80% color sampling — it cannot tell "is this really this painter" or "are these three different works"; a human must look. Confirm against the contact sheet before writing work titles into a scene's header comment.

- Paint the "form layer" first, then repaint — **the repaint canvas must be drawn in local coordinates** (like a boat), not a whole-screen repaint every frame, or it will be slow. Small movers like boats and people: draw to a small canvas → `MEDIUM.broken` → paste back.
- In nine-argument `drawImage`, `sx+sw` beyond the source width renders blank; sky drift uses `sx = t*speed` with a source wider than the stage (47's sky is 2600 wide).
- Edge-gap pinholes had two sources, both fixed: `M.broken`'s base now pads 14px before blurring; row-by-row water displacement needs the destination widened (`dx-24, W+48`), or the displaced ends reveal the base color.
- Ma Yuan-class ink wash: hanging strands must cluster, curve, and vary in length — evenly spaced verticals read as a fence. Figures always go "back view + one clothing stroke + silk left blank", never filled.
- Gauguin-class: shapes are always round, never polylines — polyline figures read as emoji.

## This round's (2026-10-16) progress and self-scores

See the status column in `references/style-recipes/INDEX.md` and `style-recipes/_redo-progress.md`. Self-scores are for ranking, not acceptance verdicts.
