# 50_ma_yuan · Ma Yuan: offset center of gravity, negative space, refined brush-and-ink

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); neither self-score nor independent review reached 80, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

Southern Song Ma Yuan landscapes and poetic small scenes are the research range; "One-corner Ma" is an organizational tendency, not a fixed lower-left template, and does not equal all Chinese ink painting.

## Transferable visual language

- Space: the painted parts and the unpainted space establish each other's scale, direction, and situation; emptiness is not background awaiting fill.
- Brush and ink: sinewy outlines, texture strokes (cun), and tone variation form the near ground's texture; distance grows more condensed.
- Composition: offset center of gravity and branches/rocks reaching out of the frame form guidance; direction, ratio, and subject may change.
- Color and light: ink collaborates with restrained color; it is not whole-picture desaturation, blurring, or xuan-paper texture.

## What varies with need

Ancient figures, landscapes, one corner, a lone boat, plum blossoms, or a large blank screen are not mandatory; in modern scenes the negative space must still express space and event.

## Difference from neighboring styles

Distinct from Fan Kuan's monumental mass and dense texture dots; distinct from generic ink freehand — ink-bleed diffusion alone is not the identifying trait.

## Production starting point (unvalidated)

Arrange the new event with solids and negative shapes first, then explain structure with directional brush tips, wet/dry, and near/far tones. Motion in the emptiness only reveals what the story needs — never add particles to "fill blanks".

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- One person waiting on a winter-night platform.
- A folding tool opened on a personless workbench.
- Two people quickly passing an umbrella at a doorway: tests the relation of motion change and negative space.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [The Met, "Plum Blossoms in Moonlight": visual poetry and situation](https://www.metmuseum.org/art/collection/search/44638)
- [National Palace Museum, "Walking on a Mountain Path in Spring" collection display](https://south.npm.gov.tw/SelectionsDetailC004100.aspx?Cond=c693cd84-df8f-4e6f-8724-d7025ac43c20)
- [The Met's "Peach Blossom Spring" catalog: continue checking other bird-and-flower and landscape works](https://resources.metmuseum.org/resources/metpublications/pdf/Peach_Blossom_Spring_Gardens_and_Flowers_in_Chinese_Painting.pdf)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: a rain shelter at a cliff edge; event: a paper umbrella drifting across the emptiness with the wind; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, second-round self ~78, first-round independent review 74, taste items await Uncle Hua)

- Masterpiece anchoring: "Dancing and Singing on the Way Home", "Plum Rocks and Wild Ducks", "Walking on a Mountain Path in Spring". Signatures: silk ground with a golden-brown cast, one-corner composition, axe-cut texture strokes (broad flat side-brush), weeping willow long branches, tiny figures gazing into emptiness, pale-ink washed distant mountains without contour.
- Route: `scenes/50_ma_yuan.js`. `MEDIUM.silk` silk ground (warp/weft lines + haloed edges) → distant mountains blurred wash → rocks (polygon clipping + broad flat `P.brush` axe-cuts + fine hard texture strokes + interrupted contour) → old willow trunk (rhythmic heavy line) → dynamics: hanging strands (clustered, curved, varied lengths, each with `P.brush`, swaying in wind), the scholar (back view, one-stroke drapery, silk reserve, raised sleeve pointing to the distance), boat, birds, water lines → silk-texture multiply veil.
- Measured: qa determinism ✓, no jumps, 8ms/frame.
- Lessons: equidistant vertical hanging strands read as a fence; figures stay unfilled — back view + drapery lines is the stable recipe; mist bands use radial gradients, rectangular gradients expose seams at edges.
- Second-round trials: trunk segments widening read as bamboo joints; axe-cuts changed to polygon wedges read as arrows — both reverted; now using one continuous heavy line plus bark short strokes, and short broad-brush axe-cuts.
- Still improvable: rock axe-cuts still too dense; trunk's finishing stroke too blunt; the signature has only the seal, no characters.
