# 52_south_park · South Park: digital paper cut-outs and limited performance

Status: research recipe; the demo was redone under Protocol 16 on 2026-10-16 (see "v2 implementation" at the end); neither self-score nor independent review reached 80, so it is not registered as an implementation.

## Checks before starting

First read [cross-scene style transfer](../15-cross-scene-style-transfer.md), then this card. Works are used to compare visual language; figures, objects, compositions, and shots are not copied directly. The stable traits below are research generalizations; the implementation and migration plans are unvalidated hypotheses; never present them as official parameters or measured capabilities.

## Scope

The series' main digital cut-out visual and performance language is the research subject; special episodes' realism, anime pastiche, etc. are not defaults. The official 2013 FAQ evidences the digital reconstruction of paper cut-outs; do not use it to claim any current software version.

## Transferable visual language

- Form: geometricized, clear big silhouettes with few key features; new characters get their own proportions and costume identifiers.
- Material: flat paper-sheet layering, restrained texture, and occlusion — it does not auto-upgrade to glossy 3D or thick paper dioramas.
- Space: backgrounds supply place and contact for action; characters and props share the flat scale.
- Performance: mouth shapes, eye direction, pose switches, and pauses carry the information; limited motion does not mean characters puppet-slide the whole time.

## What varies with need

The four leads, the snowy town, the school bus, or the dialogue are not copied; learning the visuals does not require adding offensive jokes.

## Difference from neighboring styles

Distinct from Rick & Morty's fine outlines and more flexible linear characters; distinct from shadow puppetry's translucent material and rod joints.

## Production starting point (unvalidated)

When this style is explicitly chosen, the shot list writes `Style: 52_south_park South Park-style digital cut-outs` and `Characters: original semantic SVG paper characters`; original semantic SVG paper characters are allowed, organized by part/pivot/expression state; this is a narrow exception for this flat style, not extended to real persons or other styles. Paper grain binds to part coordinates; footsteps and contact have state — not just whole-group translation. When frame generation is needed, Method 10 remains available.

Motion speed, frame rate, camera, and score are set per the current narrative; do not equate the imagery's quiet temperament with slow motion. Engineering follows the [style author spec](../08-style-author-spec.md); an engine id is registered only after a new renderer is implemented.

## Cross-scene validation prompts (not fixed templates)

- Newly designed adult property staff discussing a leak.
- A personless vending machine jamming: limited motion still reads clearly.
- A multi-person evacuation in fast motion: tests whether restricted modeling stays readable.

Pick at least tests with different subjects / spatial scales / subject types; a full run every time is not required. Record static and dynamic acceptance separately; ranges not covered stay marked as unvalidated.

## References and evidence boundaries

- [South Park Studios: official FAQ on digital reconstruction of construction paper](https://southpark.cc.com/news/712d55/faq-do-you-still-use-construction-paper-to-animate-the-show)
- [Official episode portal: comparing clips across places and actions at production time](https://southpark.cc.com/)

First-hand collection/production material verifies works and methods; encyclopedia entries only assist locating. Work still requires actually viewing multiple originals or different-scene clips and recording stable traits and exceptions; a work list is not a completed multi-image visual experiment.

## Backflow after use

Before use, read this section's latest validated conclusions; currently there is only a technical check on a 6-second single-scene output; style fidelity and cross-scene visual validation are incomplete. Record only findings that affect results: date, subject, route taken, reference and output paths/hashes, problems, fixes, verification status, and scope. Fix failed conclusions by editing the original sentence, not appending contradictory rules. Research hypotheses rise to implementation recipes only after cross-scene reproduction; reproducible engineering problems get fixed in tooling first and tested. User preferences go into the taste profile separately, without expanding authorization.


### 2026-10-15 · Single-scene prototype backflow

- Scene: laundromat mishap; event: original adult character presses a button, socks fly out, a startled reaction; route: code drawing and animation.
- Checks: determinism re-test, full MP4 decode, independent sampled-frame review; the short-film quick-motion metric rated yellow under existing gates — it cannot be extrapolated to long-film compliance.
- Boundary: this only proves the engineering runs and is watchable; artist/studio style similarity remains limited; geometry, palette, or texture parameters are not final standards.

## v2 implementation (2026-10-16, self-score ~75, taste items await Uncle Hua)

- Signatures: cut-paper feel (jittered edges, paper fibers), eyes as two white ellipses with black dots pressed to the face, trapezoid bodies, black stub-legs, flat fills + thin black outlines, whole-block translation / rotation around pivots.
- Route: `scenes/52_south_park.js`. Every shape cut with jittered edges via `P.cut`; `kid()` animated around neck/shoulder pivots; the mouth a black half-ellipse opening/closing; falling snow stepping at 12fps. Subject changed to a bus stop: the school bus sliding in, doors snapping open, kids queueing and hopping aboard. Costume palettes avoid named-character combinations.
- Measured: qa determinism ✓, no jumps, 6ms/frame, motion 5.3%.
- Still improvable: the kids are all one mold; boarding is only translation plus a hop; missing lip-sync to dialogue.
