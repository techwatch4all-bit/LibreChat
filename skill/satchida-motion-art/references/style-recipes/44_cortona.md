# 44_cortona · Pietro da Cortona: Baroque masses and flowing groups

Status: research recipe + single-scene engineering prototype; established and implemented 2026-10-15. Ships with `scenes/44_cortona.js`, run with `render.py --film style_studies --solo 44_cortona --from 0 --to 6`; not yet validated for style fidelity or cross-scene transfer — this does not upgrade it to a mature style.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Group organization, color-light, and space in grand decorative painting and narrative pictures are primary; ceiling effects are an application branch.

## Transferable visual language

- Form: full-bodied figures, fabric, and environmental masses forming mutually pushing-and-pulling groups.
- Space: diagonal links, interpenetrating depth, and local frame-breaking create continuity; compositions are regenerated for new events.
- Color and light: rich warm and cold colors supporting each other; bright/dark divides dense content into readable layers.
- Material: architecture, painting, and ornament may continue into each other, but each keeps its own boundary and physical touch.

## What varies with need

Full-screen angels, cloud banks, emblems, gold trim, upward shots, or spirals are not mandatory; everyday scenes must still have a clear event first.

## Difference from neighboring styles

Distinct from Michelangelo's single-figure tension; distinct from Pozzo's architecture-perspective-illusion-first route.

## Production starting point (unvalidated)

Draw three large group layers and their lighting relations first, controlling density with occlusion and color-light; details come after. If breaking the frame or doing ceilings, measure the observation point — ornament must not cover the action.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- A grand theater's backstage scene change happening simultaneously: real activities form the groups.
- Lifting equipment in a repair yard: primary/secondary masses and diagonal relations.
- A two-person dining-table vignette: at reduced scale, organization stays abundant but restrained.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [Uffizi: the Stove Room's Four Ages of Man frescoes, cross-checked with ceiling works](https://www.uffizi.it/en/artworks/stove-room)
- [Museum With No Frontiers: Barberini ceiling database entry](https://baroqueart.museumwnf.org/database_item.php?id=monument%3BBAR%3Bit%3BMon11%3B18%3Bit&pageT=N)
- [Painter and works catalog: continue with non-ceiling works](https://en.wikipedia.org/wiki/Pietro_da_Cortona)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: theater scene change; event: suspended props and layered curtain motion; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~70, not registered as an implementation)

- Masterpiece anchoring: "Allegory of Divine Providence" Barberini ceiling, "The Rape of the Sabine Women" (two distinct works only; a third entry duplicating the first was deduplicated and dropped). Signatures: stucco frames with gilded roundels, central warm-gold radiating light, cloud banks stacked into volume, crowds swirling around the center, sashes and figures spilling over the frame.
- Route: `scenes/44_cortona.js`. Three stucco bands + egg-and-dart + gold roundels in four corners → opening sky gradient with radiating light → cloud banks (a single undulating outline as a whole, lit along the toward-center direction, outer arcs tracing the puffs) → crowd (M.figure swirling around the center) + red-blue sashes unfurled along ellipse normals → the central white-robed figure breathing with the gold light → MEDIUM.fresco.
- Lesson: stacking spherical radial gradients per puff reads as soap bubbles; clouds must first become one undulating whole, then be lit along the light direction. Sash width must unfurl along the path's normal; a fixed angle turns them into hairs.
- Still improvable: figures still bell-robed; missing strong foreshortening and strong chiaroscuro; highlight arcs lean cartoonish.
