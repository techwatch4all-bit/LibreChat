# 51_persian_miniature · Persian miniature: layered space and precise narrative

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); self-score ~80 with taste items pending, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Not a single artist or era. Initial focus on late-Timurid Herat and early-Safavid Tabriz book ateliers; pick one scope before production, never mixing all Persian/Mughal painting.

## Transferable visual language

- Space: raised viewpoint, unfolded architecture, and stacked scenery let multiple events read simultaneously; single-point perspective is not force-fitted.
- Form: fine lines, clear poses, and precise small objects narrate together; figures are not pattern filler.
- Color: mineral-saturated fields and fine ornament discipline each other; gold belongs to appropriate material layers.
- Composition: text blocks, borders, and the picture may answer each other; the organizational logic survives even in new scenes without text.

## What varies with need

Gardens, palaces, carpets, Persian script, borders, or horsemen are not mandatory; do not patch together ornaments from different regions as fake historical accuracy.

## Difference from neighboring styles

Distinct from the Mughal natural-observation card's precise sketching, and distinct from Lorenzetti's continuous civic space; never lump the three as "refined oriental painting".

## Production starting point (unvalidated)

Rebuild multi-layered places and action routes for the new subject; figure layering and pattern layering stay separate; patterns follow their surfaces and must not drift in motion. Text needs real content and reliable glyphs — otherwise do not fake calligraphy.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Book circulation in a multi-tier city library.
- A modern food factory's full collaboration process.
- Layered overhaul of a single machine: no garden or palace needed to validate transfer.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [The Met: study of the Shahnama of Shah Tahmasp](https://www.metmuseum.org/essays/the-shahnama-of-shah-tahmasp)
- [The Met: cross-period Shahnama collection note](https://www.metmuseum.org/art/collection/search/446551)
- [The Met court-art teaching material: comparing different folios](https://www.metmuseum.org/learn/educators/curriculum-resources/~/media/Files/Learn/For%20Educators/Publications%20for%20Educators/Islamic%20Teacher%20Resource/Unit5.pdf)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: a waterworks courtyard; event: a water wheel and water flow in layered space; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~80, taste items await Uncle Hua)

- Masterpiece anchoring: Herat "Yusuf and Zulaykha", the garden bather folio, a Shah Tahmasp Shahnama folio. Signatures: the ground reads as a raised tapestry (bird's-eye laid flat), buildings cut open to reveal interiors, all-over geometric tiling, gold-edged + lapis-blue borders, text blocks entering the picture, small side-facing figures with big turbans.
- Route: `scenes/51_persian_miniature.js`, flat fills + dark-umber outlines throughout; star tiles modulo-tiled all over; octagonal pool, zigzag water channel (gold-edged + celadon), canopy dot-leaves; dynamics = the water wheel turning, gold channel waves flowing along the zigzag, goldfish circling the pool, petals drifting, the gardener's rocker, the reader breathing.
- Measured: qa determinism ✓, no jumps, 3ms/frame.
- Still improvable: figures too small and simple; the text block is fake connected script; the ground lacks layering.
