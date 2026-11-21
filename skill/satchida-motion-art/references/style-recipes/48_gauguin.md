# 48_gauguin · Gauguin: flat planes, outlines, and symbolic color

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); neither self-score nor independent review reached 80, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Synthetism and flat symbolic color are primary; Brittany, Tahiti, and different media are not one fixed subject set.

## Transferable visual language

- Color: large color fields carry emotion and structure, not mechanical copies of natural color; colors need thematic grounds.
- Form: simplified shapes and fairly definite outlines support each other while still recognizing new subjects.
- Space: depth may compress, ground viewpoints raise, or stacking organizes it — but not every object entirely flat.
- Surface: large color fields keep subtle internal variation; they must not degrade into uniform black-outline vector fills.

## What varies with need

Tropical plants, brown skin, specific garments, or "exotic" ornament are not mandatory; cultural subject matter comes from user needs, never as a style shortcut.

## Difference from neighboring styles

Distinct from ordinary flat illustration: color fields carry emotional and symbolic relations. Distinct from Chagall: no inversion, floating, or broken space logic required.

## Production starting point (unvalidated)

Arrange the new scene's psychological center of gravity with a few large color fields first, then refine outlines, layering, and material. Motion may be fast or slow; color fields stay consistent per object; whole-frame random recoloring is forbidden.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- A modern night-shift convenience store.
- A set of personless repair tools.
- A hand-over during an office argument: recognition without tropical subject matter.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [The Met's Gauguin essay: cross-medium and symbolism](https://www.metmuseum.org/essays/paul-gauguin-1848-1903)
- ["The Siesta": figures and flat space](https://www.metmuseum.org/art/collection/search/436449)
- [The Met's Gauguin exhibition: differences among paintings, sculpture, prints](https://www.metmuseum.org/exhibitions/listings/2002/gauguin)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: dusk cloth-dyeing yard; event: wind billowing fabric, symbolic color fields supporting each other; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~65, taste items await Uncle Hua)

- Route: `scenes/48_gauguin.js`. All shapes go through `MEDIUM.flat` (short strips following stroke direction within same-colored blocks + deep ultramarine outlines, width 5–8px); a vermilion color field, yellow-ochre slope, and purple-brown diagonal trunks cleave the frame; the three white-capped women in the foreground get cropped by the picture frame; the boy leading a goat shrinks into the distance (shrunk so the immature modeling isn't magnified).
- Measured: qa determinism ✓, no jumps, 8ms/frame.
- Key lesson: polyline figures read as emoji; always use smooth closed curves (the scene's `smooth()`); hat wings must paint behind the face — the face must not be covered.
- Still improvable: the boy and goat are still childish; trunks too straight; missing Gauguin's large purple-brown shadows and symbolic small animals.
