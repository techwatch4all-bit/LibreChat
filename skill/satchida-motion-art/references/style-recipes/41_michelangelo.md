# 41_michelangelo · Michelangelo: sculptural quality and pose tension

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/41_michelangelo.js`, run with `render.py --film style_studies --solo 41_michelangelo --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

The sculptural modeling shared across painting and drawing is the core; the Sistine ceiling is one reference among others; sculpture, mural, and late-period materials are not conflated.

## Transferable visual language

- Form: skeleton, stress, torsion, and compression model the mass; power comes from pose, not from adding muscles to every character.
- Contour: overlap and foreshortening are clear; the subject reads as a solid occupying real space.
- Color and light: light/dark establishes the large volume; the ceiling's clear color blocks can be referenced, drawing studies serve structure — they are not used directly as a combined palette.
- Space: strong subjects and negative shapes pull at each other; it can hold at ordinary viewpoints — no forced upward dome shot.

## What varies with need

Nudity, classical deities, the touching fingers, or fixed muscle proportions are not defaults; modern clothing and non-human subjects must hold equally well.

## Difference from neighboring styles

Distinct from Cortona: the force of masses and poses is the point, not exuberant groups, ceiling illusionism, and ornamental density.

## Production starting point (unvalidated)

Validate the stress silhouette and foreshortening first, then handle volume, clothing, and light. Performance is designed from the action's cause; code handles layering and transforms — a few ellipses must not impersonate an anatomically designed body.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- A rescuer pulling open a deformed door with force: stress must read through a uniform.
- A folding robotic arm extending and retracting: check non-human masses.
- A person quietly tying shoelaces: small actions can carry structural tension too.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [The Met's Michelangelo galleries: drawings, sculpture, design](https://www.metmuseum.org/exhibitions/listings/2017/michelangelo/exhibition-galleries)
- [Sistine ceiling official material](https://www.museivaticani.va/content/museivaticani/en/collezioni/musei/cappella-sistina/volta.html)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: stone crane arm; event: mechanical joints turning with sculptural stress; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~65, not registered as an implementation)

- Masterpiece anchoring: "Atlas Slave" (the unfinished statue trapped in rough stone), "Study for the Libyan Sibyl" (red-chalk back view), "Creation of Adam". The old version was a robot arm with a ball, unrelated to Michelangelo's spirit — discarded.
- Route: `scenes/41_michelangelo.js`. Grayscale form map (elliptical light/dark stacking out scapula, spine groove, latissimus; light from upper left) → deterministic hatching generated from shading + gradient (diagonal 50° dominant, cross-hatched in darks) → overall silhouette's boundary pixels thickened on the backlit side as interrupted chalk-grain contours → cached; at runtime revealed top-to-bottom by y, with the chalk following the sweep. The right side is the same figure flipped and shrunk from the old study; the paper has torn edges, mold spots, fibers, and a few lines of note-like scribbles.
- Key point: seams between parts must not get outlines (use the whole silhouette, otherwise the "doll assembly" shows); the fading bottom edge represents "unfinished".
- Still improvable: head too round, upper arm short, no true torso torsion; the contrast where light areas stay bare paper could be stronger.
