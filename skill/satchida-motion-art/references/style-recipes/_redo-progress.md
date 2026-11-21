# Redo progress for the new style demos (from 2026-10-16; protocol in doc 16)

The old scenes (2026-10-15 version) are backed up in `_archive/scenes_20261016/`. The redone new scenes directly overwrite `scripts/engine/scenes/<id>.js`, same id, same `--film style_studies`.
The original artwork references themselves are not committed (re-run `fetch_reference.py` when needed); the overview and side-by-side images live in `assets/style-evidence-v2/`, so later reviewers can re-check the scores.

Self-scores are for ranking (protocol step 6); taste items belong to Uncle Hua.

| id | Style | Status | Self-score | Independent review | Current shortcoming (beat this first next round) |
|---|---|---|---|---|---|
| 38 | Giotto | Research recipe (figures redone) | ~70 | ~53 (first round) | Differentiate the three figures' silhouettes (robe widths differ), hands become palm + fingers, both hands truly cradle the crate during the hand-over; still missing crowd density, plaster too grainy |
| 42 | Guardi | Research recipe (v2 demo done, not independently reviewed) | ~78 | — | Tower strokes lean brick-stacking; figures are silhouettes only; missing flickering white specks |
| 46 | Pissarro | Research recipe (v2 demo done, under 80) | ~75 | ~58 | Canopies like cauliflower, trunks like palms; figures small now but faces still simple; the tree blocking the church has been removed |
| 47 | Sisley | Research recipe (v2 demo done, under 80) | ~80 | ~68 | Houses like flat slabs, windows as black blocks; poplars like seaweed; left-edge gaps, telegraph poles, and cargo switched to sacks are fixed |
| 48 | Gauguin | Research recipe (women's heads repainted) | ~74 | — | Women now side profile + tall white hat crown + white shoulder cape, calf now spotted; the boy is still too simple, trunk mass too large |
| 50 | Ma Yuan | Research recipe (v2 second round, closest to 80) | ~78 (second-round self, not independently reviewed) | ~74 (first round) | Axe-cuts still too dense after switching to short broad wedge strokes; the trunk uses one continuous heavy line (segmented read as bamboo joints, polygon axe-cuts read as arrows — both trials abandoned); the signature has only the seal; qa timed out loading under heavy machine load, so multiple-instant still frames with no errors and motion were used instead |
| 51 | Persian miniature | Research recipe (figures redone) | ~72 | ~63 (first round) | Figures changed to Safavid style: elongated, small heads, tall turbans with red aigrette rods, waist-tied robes, scattered small flowers; the reader is too small, face expressionless |
| 52 | South Park-style cut-outs | Research recipe (v2 demo done, under 80) | ~75 | ~63 | Fixed: single-file queue boarding without overlap, the sign no longer blocked, the near-Cartman hat color swapped; still the original show's title-sequence-style subject |
| 39–41, 43, 44 | Piero, Raphael, Michelangelo, Lorenzetti, Cortona | Not redone | Old ~35 | — | 39/40/43/44 go through the fresco channel (but the fresco channel currently has only 38 as a case, itself only ~53 — don't treat it as a proven capability); 41 needs sculptural figures |
| 45 | Renoir | Research recipe (figures redone) | ~72 | — | Figures now elongated (narrow shoulders, cinched waist, bell skirt, small head, curved arms), a foreground embracing waltz pair (woman in front); the background crowd is still small and too evenly arranged; missing the original's pastel skin glow |
| 49 | Chagall | Not redone | Old ~40 | — | Space of memory: floating, tilting, emotional color fields |
| 53 | Pixar | Not redone | Old ~55 | — | Materials and subsurface light; three.js route |
| 54 | Ghibli direction | Not redone | Old ~45 | — | Clouds, wind, watercolor background density |

"Independent review" scores come from a review agent that took no part in production on 2026-10-16, scoring per doc 16's rubric (its full report was not persisted; the key points were absorbed into the table above and the protocol). Self and review differ by 7–17 points; the lower governs. **None reached 80, so all are written as "research recipes", not registered as implementations** — this is protocol step 6's own rule.

Evidence (overview image, six side-by-side originals): `assets/style-evidence-v2/`.

## How to run the next round (copy this round's proven workflow)

1. `fetch_reference.py` pulls 3 originals → review the contact sheet → write 5 signatures (must-have / bonus / forbidden).
2. Recompose the subject per the style's own composition rules; shape layer → `lib/medium.js` channel.
3. One frame first → `side_by_side.py` side-by-side → score. At most two rounds.
4. Fill results back into this table, and update the recipe card's "Status" and "Still improvable" with measured conclusions.
| 43 | Lorenzetti | Research recipe (v2 three rounds, figures redone) | ~72 | — | Figures now elongated robes, 3/4 side view, with a 20-person crowd; still missing the original's paint-layer thickness and perspective depth; only two distinct originals |
| 40 | Raphael | Research recipe (v2 one round, figures reuse figure) | ~70 | — | Perspective vault coffering and checkerboard floor hold, three groups' hands and eyes interlock; figures are still bell-robed with samey faces; missing the original's skin and fabric luster |
| 41 | Michelangelo | Research recipe (v2 two rounds, red-chalk drawing route) | ~70 | — | S-curve torsion, long arms, scapula/latissimus shading hold; the head is still too round, missing hand detail; the lit-area paper contrast could be stronger |
| 44 | Cortona | Research recipe (v2 three rounds: cloud banks redone) | ~70 | — | Frame + gold roundels + central radiating gold light + cloud banks + swirling crowd + red-blue sashes hold; figures still bell-robed, missing Baroque strong foreshortening and chiaroscuro; the clouds' highlight arcs lean cartoonish; only two distinct originals |
