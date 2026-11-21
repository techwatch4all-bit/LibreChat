# 15 · Transferring an artistic language to new scenes

When to read: adding a new art style, using an existing style on a different subject, splitting neighboring styles apart, or when the user names only an artist/studio. To look up one existing renderer parameter, read the matching implemented card directly. This page researches artistic language; it does not replace the user's new story, scene, or characters.

## First, separate four things

- **Style language**: strokes and materials, color relations, use of light, form, spatial organization. These should remain recognizable after the subject changes.
- **Compositional tendencies**: e.g. offset weight, group linkages, scale contrasts. Re-solve them for the new frame and events; they are not fixed coordinates or the same layout every shot.
- **Content and motifs**: the figures, clothes, bridges, boats, gardens, and deities inside famous paintings. Unless needed this time, they do not follow the style into the new work.
- **Narrative and action**: who wants what, what resists them, and how the action changes the situation. Speed, camera, and beats follow content; a quiet style can paint fast action, and limited animation can carry complex events.

Choosing an artist is not choosing one famous painting as a template. When a studio is named, first locate the film/director/period art scope: neither Ghibli nor Pixar uses one method across all works. Narrow by the user's examples and subject; when several equally reasonable directions exist, fold them into the existing three-direction design-sheet options rather than adding another formal approval round.

## Distilling across works

When establishing a scope for the first time, view at least 3 originals or 3 official clips of different scenes side by side, covering different subjects, scales, or lighting where possible. Consecutive frames, details of the same painting, and same-composition recolors do not count as independent samples. When material is short, state the gap plainly — do not pad the count or claim to have seen more. Mature cards with existing evidence are re-checked on demand; re-research every time is not required.

Write a short "style brief" to place before or beside the project's shot list:

1. Scope of application and the originals' provenance; verify attribution, medium, and period first.
2. 3–5 observable stable features, each noting which references support it and which do not apply.
3. Two points distinguishing it from the nearest neighbor style. For example, Renoir, Pissarro, and Sisley are not done when they cannot share one broken-stroke filter.
4. This scene's subject, events, space, and frame; reconstruct as needed — do not casually carry them over from references.
5. The visual relations to keep, the content that may change, and the technical route to verify.

Record "what appears in the painting" separately from "how the painter put it there". Palettes are written as dominant color relations and light/dark organization, never as a claim that some hex set is the artist's fixed standard; 3–6 dominant colors do not mean every pixel must use them. Texture, blending, shadow, and reflection should obey the dominant relations. Existing color preferences and gates still apply; genuine exceptions go through the existing process with a stated subject reason — never silently disable detection.

## Validate the new scene first, then make it a capability

Produce design sheets for this subject first, still under the existing three-direction mechanism. Figures, animals, props, and background must be handled together — form, edges, light, and material; never just swap a filter on the background. Pick the rendering route per current capability, stating which parts use code, existing assets, character frame libraries, or other approved tools.

The first time a research card is promoted to a transferable recipe, stress-test it on different scenes — typically a character in action, a no-character/object scene, and a scene with clearly changed scale or environment. Subjects may be inspired by the card's examples but must not turn those examples into new fixed templates. Whether a landscape painter can do character close-ups is an open question — do not promise in advance that all subjects are covered.

Check stills first: remove the artist's name and the famous work's iconography — do form, color-light, strokes, and space still read as that artist? Side by side with the nearest neighbor, is there a real difference? Then check motion: action contact, occlusion, texture coordinates, character identity, material consistency, and a watch at normal speed. A good still does not prove smooth animation; a sensible text plan does not prove the picture works.

## Keep status honest

- **Research recipe**: has sources and a clear visual hypothesis and can guide attempts; no dedicated implementation or picture validation. Do not call `render.py --solo <id>` on the strength of a Markdown card with a matching name.
- **Single-scene implementation**: has implementation, output, and check records, covering only that scene. Record the reference parameters and failure boundaries.
- **Cross-scene validated**: different new scenes passed independent picture review, with covered scope recorded; animation validation is written up separately. Procedural scenes register per doc 08; engine QA and delivery gates still apply.

One studio branch passing does not mean the whole family passes. A new card does not borrow an old card's stars, performance, or acceptance conclusions. Old cards' same-room parameters are historical implementation evidence, useful only in matching scenes.

## Experience flow-back

Before use, read the matching card's scope, weaknesses, and latest field results. After completion, record in the card: date, task and scene, sources, implementation/output evidence, observations, fixes, verification status, and boundaries. When new evidence overturns an old conclusion, edit the original sentence and check related routes; if a fault reproduces reliably, fix the tool first and test. User choices go into the taste profile; one work's traits do not become rules for all works.

Provenance of this process: the 2026-10 style-library expansion, where the user explicitly asked to focus on artists' overall styles and adapt across creative scenes. Source research and implementation hypotheses are kept separate; entries with insufficient evidence stay in research status.
