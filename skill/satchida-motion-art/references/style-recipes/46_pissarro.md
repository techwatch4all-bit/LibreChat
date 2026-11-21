# 46_pissarro · Pissarro: everyday flow and figures in setting

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); neither self-score nor independent review reached 80, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

His Impressionist urban and rural language is preferred; the Neo-Impressionist pointillist phase is annotated separately and never mixed with loose strokes in one shot.

## Transferable visual language

- Brushwork: small directional color touches build roads, buildings, vegetation, and figures — not random noise.
- Color and light: weather and time of day govern local color; even in shadow there are environmental reflections.
- Space: viewpoints from elevated down to ground level all work; pedestrians and activities are embedded in a credible setting.
- Form: figures are usually participants in a living event, with position, scale, and action — not scattered decorative dots.

## What varies with need

Parisian boulevards, bird's-eye views, carriages, peasants, or rain are not mandatory; observation points are re-derived per scene.

## Difference from neighboring styles

Distinct from Renoir's soft figure modeling and from Sisley's landscapes governed by the sky/ground macro relation; this card focuses on living activity happening in a setting.

## Production starting point (unvalidated)

Let street/interior surface strokes vary with direction and depth; figure motion keeps stable seeds and region masks; crowd density comes from the story — adding people must not paper over an empty frame.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Multiple people packing luggage in a co-working area.
- Automated winter-warehouse sorting: equipment activity replaces pedestrians.
- A rural pop-up clinic opening: change the street-scene subject and viewpoint.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- ["The Boulevard Montmartre at Night": urban and serial observation](https://www.nationalgallery.org.uk/paintings/camille-pissarro-the-boulevard-montmartre-at-night)
- ["The Avenue, Sydenham": a different urban space](https://www.nationalgallery.org.uk/paintings/camille-pissarro-the-avenue-sydenham)
- ["The Pork Butcher": close-range labor subject](https://www.nationalgallery.org.uk/paintings/camille-pissarro-the-pork-butcher)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: autumn orchard; event: a cart pushed from behind, figures entering the setting's color touches; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~75, taste items await Uncle Hua)

- Route: `scenes/46_pissarro.js`. Shape layer (sky / distant church and hills / patchwork fields / path / six trees) → `MEDIUM.broken` (sky horizontal long strokes, ground following the terrain's flow, canopy multi-directional short strokes, warm-bright/cool-dark complementary jitter) → cached; dynamics = drifting clouds, leaves-aloft strokes on the canopy's top layer, pedestrians (small canvas → broken → composited back) approaching along the path.
- Subject: a market-day rural path, two basket-carrying peasant women and a cart pusher; the path carries the gaze into the depth; tree shadows crossing road and fields.
- Measured: qa determinism ✓, no jumps, 18ms/frame.
- Still improvable: figures' faces are white blobs; the church is covered by near trees; canopies lean "fuzzy balls", missing branches showing through; separation from Sisley (47) currently rests on shorter, multi-directional strokes and orange-pink flickers inside the greens — still to be validated side by side.
