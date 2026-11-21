# 53_pixar · Pixar: the style family of form, material, and performance

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/53_pixar.js`, run with `render.py --film style_studies --solo 53_pixar --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Pixar is not one style. First choose a film-level art scope per need; "Luca"'s graphic painted feel and "Soul"'s realistic New York plus abstract soul world must not be blended without explanation.

## Transferable visual language

- Form: design recognizable silhouettes and size ratios first, surface detail after; big eyes, round faces, and smooth plastic are not a universal definition.
- Material: materials carry story and character; cloth, skin, metal must differ; reflections never override the art direction.
- Light and color: light guides narrative focus and may stylize physics; there is no fixed gold rim light or blue-purple background.
- Performance: pose, weight, gaze, and anticipation/follow-through stay coherent; emotion comes from action causality, not randomly swapped expression textures.

## What varies with need

Not every object gets a face, and no one cute-face template applies to all; existing characters are not copied and Pixar software is not mandated.

## Difference from neighboring styles

Distinct from the early-ray-trace CGI card's uniform plastic and reflecting ball; this card designs form, varied materials, and performance together. Boundaries between films must also be discerned.

## Production starting point (unvalidated)

Faceless-object scenes may use 3D modeling with physics/keyframes; human and anthropomorphic characters currently follow Method 10's frame-library/composite route. Full 3D character modeling and rigging remains unbuilt capability — it must not bypass the entry's character rules or claim support; only screen-validated branches may be called effective. Pure-code requirements must not be faked with a simple sphere-cylinder person or one AI background; expose the modeling, rigging, and lighting capability gaps first.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- An original adult repair technician diagnosing a machine fault.
- An unbalanced washing machine in a personless laundromat: an event without adding a face.
- A newly designed animal character carrying objects on a slippery floor: check mass, contact, and material.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [Pixar RenderMan: stylization across form, material, light, and FX](https://prod.renderman.pixar.com/stories/stylization-at-pixar)
- [Pixar "Luca": film-level art scope](https://www.pixar.com/luca)
- [Pixar "Soul": the realistic-environment branch](https://www.pixar.com/soul)
- [Pixar RenderMan: "Soul"'s cinematography, material, and light](https://renderman.pixar.com/stories/cinematography-with-soul)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: the faceless washing machine; event: drum obstruction, body shaking, cloth landing after the door opens; route: procedural 3D.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.
- Fix: door opening now precedes cloth release, and the cloth's end point is constrained by the floor tile height; independent review retired the original timing and floor-hugging issues. This is an analytic mesh, not physical cloth simulation.
