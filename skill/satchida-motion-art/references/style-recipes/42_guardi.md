# 42_guardi · Guardi: air, broken light, and loose edges

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); neither self-score nor independent review reached 80, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Air and brushwork in city views and capriccio architecture are primary; do not summarize all periods with one Venice image.

## Transferable visual language

- Brushwork: short, loose, clustered bright strokes; outlines broken and intermittent; key structures still legible.
- Color and light: local bright accents kept within silver-gray or warm gray; air ties buildings, figures, and distance together.
- Space: depth layers and small-scale figures establish environmental mass; accurate surveying is not the only goal.
- Material: buildings, water, and sky each get different stroke directions — never cover the screen with one grain.

## What varies with need

Venice, gondolas, canals, and ruins are not necessary conditions of the style; water in every scene is not mandatory.

## Difference from neighboring styles

Distinct from Canaletto's crisp surveyed feel; distinct from Sisley — do not merely swap into a generic sunny blue-green Impressionism.

## Production starting point (unvalidated)

First establish a readable urban/interior/industrial space, then let edges and bright strokes loosen with depth. Textures bind to world or object coordinates; motion must not reshuffle random numbers full-screen.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Passenger flow at an elevated station after rain.
- Opening the service door in a dry hangar: air without water.
- A market on a winter community square: swap season and subject scale.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- ["A Capriccio with a Ruined Arch"](https://www.nationalgallery.org.uk/paintings/francesco-guardi-a-caprice-with-a-ruined-arch)
- [National Gallery of Art, Francesco Guardi works](https://www.nga.gov/artists/1363-francesco-guardi/artworks)
- ["Lagoon Capriccio"](https://www.nationalgalleries.org/art-and-artists/13736/lagoon-capriccio)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: old harbor sailing skiff; event: a boat crossing broken light and loose building edges; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~78, taste items await Uncle Hua)

- Masterpiece anchoring: "Venetian Lagoon", "Grand Canal with the Rialto Bridge". Note: modern photos (Salute church) had mixed into the search results and were discarded. Signatures: low horizon, vast silver-gray-green air, slender sampans, figures small enough to be black bodies with one or two white and red touches, dry fast brush, loose edges.
- Route: `scenes/42_guardi.js`. Sky (broad cumulus, warm-bright and cool-dark) / island towers / water (long sky-light strips + island reflections) each pass `MEDIUM.broken` (fine dry strokes, low saturation); sampan and poling figure repainted on a small canvas with elongated darkened reflections; water displaced per row; drifting clouds; birds.
- Still improvable: the tower's strokes lean brick-stacking; figures are silhouettes only; missing Guardi's signature flickering white specks.
