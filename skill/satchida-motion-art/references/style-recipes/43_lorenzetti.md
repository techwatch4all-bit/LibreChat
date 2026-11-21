# 43_lorenzetti · Ambrogio Lorenzetti: readable social space

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/43_lorenzetti.js`, run with `render.py --film style_studies --solo 43_lorenzetti --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Urban narrative cross-checked against his other spatial works; not everything gets painted as a Siena civic mural.

## Transferable visual language

- Space: buildings, roads, doorways, and places connect many kinds of daily activity; local viewpoints can serve readability.
- Form: figures small but with clear action and occupational relations; architecture has volume, not flat icons.
- Color and light: earth tones, mineral colors, and detail shading stay unified; avoid an old-paper filter darkening all information.
- Narrative: several events can coexist, but with primary/secondary, paths, and clear causal links.

## What varies with need

Horizontal long scroll, city walls, medieval dress, or dense crowds are not mandatory; complexity comes from the current content.

## Difference from neighboring styles

Distinct from Persian miniature: space emphasizes the continuity of town fabric and daily activity; density is not built from all-over geometric pattern.

## Production starting point (unvalidated)

Build the world canvas from the current place's connection relations first, arrange visible paths for figures' activities, then paint in layers. Gaze guidance can use local motion and camera; avoid a row of mutually unrelated small cards.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- A modern logistics park: unloading, sorting, delivery interlinked.
- A single-room clinic: readable collaboration even in a small space.
- A personless greenhouse pipe network: with no figures, narrative connects through the actual facilities.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [Italian Ministry of Culture: the city and countryside of Good Government](https://catalogo.cultura.gov.it/approfondimento/l-allegoria-del-buon-governo-ambrogio-lorenzetti/il-buon-governo-citta-e-campagna)
- [Uffizi, "Presentation of Christ in the Temple": a different spatial subject](https://www.uffizi.it/opere/presentazione-al-tempio)
- [The complete fresco cycle: different narrative moods](https://en.wikipedia.org/wiki/The_Allegory_of_Good_and_Bad_Government)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: cutaway library; event: a red book slides down, lands in the book cart, and rides away with it; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.
- Fix: removed the book's mask-reset; the cart now stops to catch the book first and departs only after the book is bound to the frame; the review found no more flying back to the entrance.

## v2 implementation (2026-10-16, self-score ~72, not registered as an implementation)

- Figures redone (user feedback: "the figures still need drastic optimization"): small heads, long bodies, narrow shoulders with flared robes, fold lines, bright left / dark right, forefoot emerging from the hem, 3/4 view; 20 street figures walking in a loop, near large far small.

- Masterpiece anchoring: "Effects of Good Government in the City", "Allegory of Good Government" (two distinct works only). Signatures: buildings stacked one on another filling the upper half, pink/gray/ochre walls with rows of small arched windows, crenellated towers, ground-floor arcades cut open to reveal workshops, a band of small figures on the street each minding their own business, a dark-umber border band.
- Route: `scenes/43_lorenzetti.js`. Shape layer (sky → mid-ground low buildings → left/right main buildings → the cutaway cobbler's workshop → street → steps) → `MEDIUM.fresco`; small figures painted after each frame (circle dance, mule train, scaffolding hoisting stone, the cobbler, flags).
- Second round fixed: bare gray plaster showing in the middle, a figure stretching both arms like a cartoon, the mule overlapping the circle dance.
- Still improvable: street foot traffic should multiply several-fold; walls need a paint layer; small figures need more natural proportions and drapery; add streets receding in perspective.
