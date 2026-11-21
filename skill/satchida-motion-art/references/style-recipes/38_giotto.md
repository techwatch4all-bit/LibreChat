# 38_giotto · Giotto: mass and narrative relationship

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); neither self-score nor independent review reached 80, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Giotto's mature narrative mural language is primary; panel paintings serve to check figure mass; do not describe all works as fresco.

## Transferable visual language

- Form: bodies as simple masses with weight; drapery folds explain stress and volume; faces and hands convey relationships.
- Space: figures can stand and touch; architecture and rock organize the events; later photographic perspective is not the goal.
- Color and light: fairly complete local color planes with graduated modeling; light/dark serves volume; background and subject share one world.
- Material: the fresco direction uses matte, fine grain, and soft color layers; gold-ground panel painting is another medium — no whole-layer gold overlay.

## What varies with need

Saints and mourning poses are not required. The gold halo, ultramarine sky, and decorative border are the shared signatures of the three Scrovegni originals; the v2 demo kept them (the halo went to a porter — both a joke and an identifier). Cracking and fading are conservation state, not core style.

## Difference from neighboring styles

Distinct from Piero: gesture and figure-relationship readability first; geometric order is not the protagonist. Distinct from Raphael: keeps plainer, heavier masses.

## Production starting point (unvalidated)

First draw the new scene as readable silhouettes and masses, layer by contact relationships, then matte color planes and drapery folds; do not substitute surface craquelure for modeling. Characters follow Method 10; material treatment must cover the characters.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Two people handing over a large box at a parcel depot: check gesture and weight.
- A disassembled machine inside a repair shop: mass feeling must remain without classical figures.
- A night-shift waiting room: after changing lighting and figure count, check whether space and color planes stay unified.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [Giotto, "Adoration of the Magi": mass and upward-viewed architecture](https://www.metmuseum.org/art/collection/search/436504)
- [Giotto, "Ognissanti Madonna": panel-medium comparison](https://www.uffizi.it/en/artworks/virgin-and-child-enthroned-surrounded-by-angels-and-saints-ognissanti-maesta)
- ["Lamentation (The Mourning of Christ)": narrative mural comparison](https://en.wikipedia.org/wiki/Lamentation_(The_Mourning_of_Christ))

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: waterwheel courtyard; event: the water wheel turning as it receives water, pots and courtyard showing heavy volume; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~65, taste items await Uncle Hua)

- Masterpiece anchoring: Scrovegni Chapel's "Lamentation", "Meeting at the Golden Gate", "Flight into Egypt" (`fetch_reference.py`). Stable signatures: ultramarine sky with gold stars, earth-red/ochre/olive-green robes, weighty bell-shaped robes, figures' gazes interlocking, diagonally placed gray-pink architecture blocks, a red-gold decorative band inside the frame.
- Route: `scenes/38_giotto.js`. Shape layer = sky (ultramarine soft blotches) → rock slope → architecture (crenellations + red-white diamond band under the eaves + archway) → ground → `MEDIUM.figure` three figures (robe, half-cape, coarse sleeves, big heads, almond eyes + gazes) → wooden crate; medium layer = `MEDIUM.fresco` (light blur + lime veil + plaster multiply + pinhole seams) + decorative border.
- Subject: two porters handing over a wooden crate at a dock warehouse door, a third person looking down at the crate corner; dynamics = the crate hand-over arc, hem micro-sway, landing dust, a bird crossing the sky.
- Measured: qa determinism ✓, no jumps, 36ms/frame; static frame pairs 27% (murals are naturally still; motion concentrates in the hand-over).
- Still improvable: faces and hands still simple; missing halos, angels, crowd density; drapery light/dark layering short of the original's multi-layer glazes; grass tufts too uniform.
