# 45_renoir · Renoir: warm-cold interweave and figures with warmth

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); self-score ~58, not yet independently reviewed, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

The Impressionist language of the 1870s to early 1880s is preferred; the more linear turn of the 1880s and the late period's different modeling must be noted separately — do not claim one unified lifelong style.

## Transferable visual language

- Brushwork: soft and hard edges converting into each other; color touches visible but not shattering faces and hands.
- Color and light: warm skin interacting with cold reflections; shadows keep their color; no uniform orange wash over the whole painting.
- Form: rounded, tactile bodies and fabrics; intimacy comes from figure relations, not a uniform smiling face.
- Space: subject and setting share light color; near/far difference stays clear; interiors and exteriors reconfigure per the actual light.

## What varies with need

Luncheons, straw hats, dappled tree shade, French gardens, pink skin, or specific demographics are not mandatory; night scenes can also be studied for transfer.

## Difference from neighboring styles

Compared with Pissarro: more emphasis on figures, skin, and soft modeling. Compared with Sisley: landscape air is not the sole organizing center.

## Production starting point (unvalidated)

Build structure with reliable character material first; region by region, finer skin/hand strokes against looser environment strokes; color-light unified while material differences stay. Light patches only where a light source and occlusion actually hold.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Colleagues of different skin tones organizing equipment in an office.
- A personless breakfast table: recognition through color and touch, not pretty figures.
- One hurried hand-over at a small night shop: warm light must not equal slow motion.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [Phillips Collection, "Luncheon of the Boating Party"](https://www.phillipscollection.org/collection/luncheon-boating-party)
- [Art Institute of Chicago, "Two Sisters" study](https://publications.artic.edu/api/epub/paintingsanddrawings/135639/print_view)
- [Art Institute of Chicago, "Acrobats at the Cirque Fernando"](https://publications.artic.edu/api/epub/paintingsanddrawings/135637/print_view)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: spacecraft cabin repair; event: an arm over the generated underpainting, local pipe deformation, and a leak weakening; route: generated underpainting + code local deformation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.
- Explicit shortcoming: local mesh displacement is not full grasp/hand-swap/valve-turn performance; complex character interaction needs pose frames or hierarchical binding — a pretty underpainting must not paper over missing action.

## v2 implementation (2026-10-16, self-score ~58, not independently reviewed)

- Route: `scenes/45_renoir.js`. The old version was an external bitmap + mesh deformation, replaced with code drawing and the old version backed up. Shape layer = canopy / sky through leaf gaps / trunks / sand / table / distant crowd; `MEDIUM.broken` repaint: canopy and ground diagonal short strokes, the crowd its own layer of vertical fine strokes (if the crowd shared the ground's horizontal strokes they'd be smeared lying down); light-patch layer (warm-yellow bright patches / blue-violet shadow) repainted and cached separately, two copies offset fading in/out swaying, and falling onto the figures at low opacity; a foreground pair of dancers repainted per frame on a small canvas.
- Lesson: figures and background must repaint in separate layers with their own stroke directions; the light-patch layer over figures must drop opacity, otherwise figures get covered half-way.
- Still improvable: portraits lean doll-like; missing warm-pink skin and fabric highlights; mid-ground crowd too uniform.
