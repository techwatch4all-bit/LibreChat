# 40_raphael · Raphael: harmonic organization and natural connection

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/40_raphael.js`, run with `render.py --film style_studies --solo 40_raphael --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

The mature period's forms, figure connections, and clear space are primary; early Perugino influence and the later period's stronger theatricality are not forcibly merged into one averaged style.

## Transferable visual language

- Form: continuous contours; bodies and drapery modeled with roundness; figures idealized but with definite action.
- Space: primary and secondary groups, gazes, and gestures interconnect; triangular organization is an optional method, not a fixed layout.
- Color and light: layered red-blue against neutral relations, readable skin, soft volume; re-derive the dominant colors for each new scene.
- Detail: frame information has priorities; architecture, props, and figures jointly support the main event.

## What varies with need

"The School of Athens"' arch, two central figures, Madonna and Child, or period costume are not mandatory; do not arrange every shot as a central triangle.

## Difference from neighboring styles

Distinct from Piero's sense of measure: organic connection weighs more here. Distinct from Michelangelo: not every body is tightened into strained sculpture.

## Production starting point (unvalidated)

Draw a relations map of people and objects first, then choose the composition for the current action; unify characters and environment across color blocks, light direction, and soft/hard edges. Without the original's subject, the frame should still read clear, rounded, organized.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- A community repair class: many people each doing one related thing.
- A product workbench: even a no-person shot must have primary/secondary and form connections.
- Two-person collaboration in a narrow kitchen: tests a non-grandiose architectural scene.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [National Gallery Raphael collection: different phases and subjects](https://www.nationalgallery.org.uk/artists/raphael)
- ["The Madonna of the Pinks": intimate action](https://www.nationalgallery.org.uk/paintings/raphael-the-madonna-of-the-pinks-la-madonna-dei-garofani)
- ["The School of Athens": group comparison](https://en.wikipedia.org/wiki/The_School_of_Athens)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: gardening workbench; event: a kettle pouring and red-blue fabric organization; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~70, not registered as an implementation)

- Masterpiece anchoring: "The School of Athens", "Disputa", "Parnassus". Signatures: semicircular lunette windows + gold-brown/red/ultramarine decorative bands, central perspective barrel vault with coffering, a patch of sky at the far end, checkerboard floor, niche statues, saturated robe colors in conversing groups.
- Route: `scenes/40_raphael.js`. The vault recedes toward the vanishing point in geometric progression with N=9 layers, each layer cut into coffer cells by angle, side walls alternating pilasters/niches, floor checkerboard drawn by layer and column; figures use `MEDIUM.figure` with hands and eyes pointing at each other (book, astrolabe, scroll); three small figures walk along the floor in the distance.
- Still improvable: figures' identical bell robes and samey faces; niche statues read as candles; missing skin and fabric luster.
