# 47_sisley · Sisley: air, weather, and coherent landscape

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); self-score ~80 with taste items pending, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

His landscape language is the main known base; interiors, close character shots, and sci-fi are migration experiments — do not claim the artist already had mature examples of these.

## Transferable visual language

- Color and light: sky and weather drive the ground, buildings, and water; not every frame is sunny blue-green.
- Brushwork: lighter, broken color touches follow surface direction; distance simplifies while the near stays legible.
- Space: air layers are continuous; horizons and roads and such structures guide viewing — not just a water-surface backdrop.
- Form: small figures and buildings keep the landscape scale; large figure close-ups need separate validation.

## What varies with need

Rivers, bridges, sunny days, French countryside are not mandatory; snow, flood, or overcast can serve as change comparisons.

## Difference from neighboring styles

Distinct from Monet's close-range water-lily color field; also does not default to Pissarro's dense activity or Guardi's looser urban silhouettes.

## Production starting point (unvalidated)

Unify ambient light and depth first, then handle sky, hard surfaces, and organics with separate strokes. When new figures enlarge, redo structure and local stroke density — do not simply scale up the small dot figures.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- A winter industrial park with no river water.
- One boarding at a suburban bus stop after rain.
- Indoor greenhouse maintenance: as a transfer stress test beyond the original landscape range.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [National Gallery Sisley collection and biography](https://www.nationalgallery.org.uk/artists/alfred-sisley)
- ["The Watering Place at Marly-le-Roi" and the snow series](https://www.nationalgallery.org.uk/paintings/alfred-sisley-the-watering-place-at-marly-le-roi)
- [National Galleries Scotland: snow-scene comparison](https://www.nationalgalleries.org/art-and-artists/artists/alfred-sisley)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: snowfield train; event: a train crossing coherent snow and sky; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~80, taste items await Uncle Hua)

- Route: `scenes/47_sisley.js`. Three layers each repainted and cached: sky (2600-wide cumulus: warm-white body + pale-lilac-gray shadow side + warm-yellow lit side, `MEDIUM.broken` horizontal long strokes), water (sky-light reflections + mirrored, darkened house/tree/pole reflections, horizontal long strokes), and the scenery above the water (half-flooded inn, poplars, telegraph poles, far bank). Dynamics = clouds drifting slowly, water displaced per row growing nearer/larger, the ferry (small canvas → broken → composited back), stern wake.
- Subject: the village entrance after flooding, a ferryman poling a boat loaded with a wooden crate.
- Measured: qa determinism ✓, no jumps, 14ms/frame.
- Fixed: `broken` expanded 14px before blurring, and the per-row water displacement's target width widened, eliminating a row of gapped dots at the left edge.
- Still improvable: the roof reads as one flat slab; the boat's reflection is too dark; figures are silhouettes only.
