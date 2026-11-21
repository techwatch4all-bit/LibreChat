# 49_chagall · Chagall: space of memory and emotional color

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/49_chagall.js`, run with `render.py --film style_studies --solo 49_chagall --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

The poetic space of his paintings is primary; early village works, late religious paintings, and stage/glass media are compared separately — their differences are not flattened.

## Transferable visual language

- Space: direction, scale, and adjacency may obey emotion, but viewers still need to read the main action.
- Color: color fields and local shapes jointly express mood — no fixed set of high-saturation blue-red required.
- Form: figures, animals, and objects keep recognizable character; exaggeration and deformation stay connected.
- Narrative: realistic details and memory images can coexist; images come from the new story, not a ready-made symbol list.

## What varies with need

Floating couples, fiddlers, goats, or Russian villages are not mandatory; this space-and-color system can be studied without flight.

## Difference from neighboring styles

Distinct from Gauguin's large planes and outlines; distinct from Dali's realistic vision — merely liquefying realistic objects does not make it Chagall.

## Production starting point (unvalidated)

Clarify the current reality relations and emotional relations first, then decide where scale or direction changes; all deformations keep character identity and object contact continuous. Motion rhythm is decided by the narrative.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Two remote colleagues collaborating across time zones.
- Moving boxes and memories in a personless room.
- A hasty farewell at a train station: avoid auto-adding flying couples.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [MoMA, "I and the Village"](https://www.moma.org/collection/works/78984)
- [MoMA, "The Birthday"](https://www.moma.org/collection/works/79360/)
- [Musée National Marc Chagall: the boundary of the religious-theme collection](https://www.culture.gouv.fr/rechercher-une-publication-du-ministere-de-la-culture/repertoire-des-informations-publiques/Musees-des-Beaux-arts/musee-national-marc-chagall)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: the memory of moving house; event: an old box opens, flowers and letters flying toward inverted space; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.
