# 39_piero · Piero: geometric order and lucid volume

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/39_piero.js`, run with `render.py --film style_studies --solo 39_piero --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Piero della Francesca's proportion, volume, and light relations are primary; the material difference between tempera and oil is preserved.

## Transferable visual language

- Form: the large shapes establish themselves first; head-to-body, drapery folds, and new props all have concise, complete volume.
- Space: proportion, spacing, perspective, and negative shapes constrain each other; order does not mean forced centered symmetry.
- Color and light: clear even light with restrained warm/cold; saturation varies with work and medium — no fixed cream filter.
- Edges: major form boundaries are clear; detail obeys the overall measure; aimless broken strokes are rare.

## What varies with need

Colonnades, biblical figures, still poses are not required; "serenity" must not force motion to slow down.

## Difference from neighboring styles

Unlike Raphael's soft groupings and gaze links: here you look first at shape spacing, geometric proportion, and even light.

## Production starting point (unvalidated)

Lay out the new scene's proportions and negative shapes with low-detail masses first; after checking perspective, model and color. Fast-moving characters must keep forms from scattering and occlusion readable; pure code starts from geometry and lighting, characters still follow the character rules.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- One person chasing a train in a subway station: fast motion does not break proportional order.
- Differently shaped appliances on a dining table: check volume relations without classical-subject recognition.
- Repair activity in a space greenhouse: do not reuse the original's colonnade; check light and space.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- ["The Baptism of Christ": tempera and geometric relations](https://www.nationalgallery.org.uk/paintings/piero-della-francesca-the-baptism-of-christ)
- ["The Nativity": oil color and narrative](https://www.nationalgallery.org.uk/paintings/piero-della-francesca-the-nativity)
- ["The Flagellation of Christ": front/back space comparison](https://en.wikipedia.org/wiki/The_Flagellation_of_Christ_(Piero_della_Francesca))

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: astronomy workshop; event: instrument rings turning and geometric order; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.
