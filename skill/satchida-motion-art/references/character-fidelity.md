# Character fidelity: draw them properly, or show no face

Whenever people, anthropomorphic characters, mascots, robots, or anything with a face appears in the picture, read this page before starting. The author watched films made by several models and said:

- "The little people and robot characters used in many videos are far too poor; we should define some of the precision and effort requirements ourselves"
- "The colors and the people's style are somewhat AI slop"; "the interfaces with coins and little people are somewhat AI slop"

**A crude character is worse than no character.** When the audience sees a round-headed bean-eyed little person, their first reaction is "made by AI", and however good the rest is, that one look drags it down.

## Pick a route first: three general routes plus a narrow exception on two flat-cartoon cards

The shot list's pre-table "Characters" line records which route you chose:

| Characters line says | When to use it | How |
|---|---|---|
| `frame library <path>` | image generation is available (the session has an image tool, or the user supplied character art) | build an AI-generated frame library with methods B/C from `references/10-characters.md`, then pass the "delivery line" below |
| `hands and backs only` | no image generation, but the story needs a person | draw only hands (holding something, pointing, putting something in a pocket), backs, silhouettes, over-the-shoulder; no face in frame |
| `none` | the story can be told by objects alone | objects play the lead: a battery, a loaf of bread, a book — told through shape, color, and action, with no face added |

**The 37/52 flat-cartoon exception.** When Rick & Morty or South Park direction is explicitly chosen, original semantic SVG characters may be designed per the matching card. The shot list writes `Style: 37_rick_morty …` or `Style: 52_south_park …`, and characters write `Characters: original semantic SVG …`. This is an exception of means, not of inspection: still check silhouette, identity, part hierarchy, contact, expression, and action; flat fills and simplified joints are judged by that style — do not impose rules 2/4/5 below's realistic structure, two-tone shading, and three material details. Live-action/realistic or other styles do not apply; writing just "SVG" does not activate the exception. The South Park research card has a single-scene prototype, but new characters and new subjects still need redesign and validation. `y4` still accepts only frame libraries — the SVG exception cannot bypass its input contract.

**Retired** (code-drawn, instantly AI-flavored; lint and review both block them):

- Generic chibi little people: round head, bean eyes, blush, no neck, body a rounded rectangle.
- White-shelled robots: white round shell, blue visor, one antenna, floating or jetting.
- Things with faces: coins with smiley faces, lithium ions with frowns, balls with eyes, batteries with expressions.
- Stick figures and Haring figures when used to act a story (drawing an indicative symbol in the whiteboard grammar is not acting a story).

**Exception: the whole film's protagonist is an anthropomorphized object.** A jumping paintbrush, a desk lamp, as the film's protagonist, having passed the "three-direction hard gate" with the user picking a design, may have a face and expressions: on a promo film, the faceless brush was judged "too formal, too boring", and only the faced cartoon brush passed. The difference is effort: a protagonist is designed (identity props, body structure, performance) and passes the delivery line below; what was retired is slapping emoji faces onto coins, balls, and ions in passing.

`y4` clips accept only frame libraries (`data.character.frames`); without one, startup fails. The engine's code-drawn characters (`lib/toon.js` neutral/bun/author) are no longer for finished films.

## The delivery line: library characters must pass these eight

First take a character close-up screenshot (zoomed 2×) and check each item below, recording results in the delivery notes. Failures go back to the generation step for a redo, or switch to "hands and backs only".

1. **Silhouette is recognizable**: fill the character solid black — you can still tell who it is and what action it is doing. A person assembled from a circle plus rounded rectangle cannot.
2. **Proportion has a skeleton**: neck, shoulders, elbows, wrists; head-to-body ratio set by the style, unchanged for the same character across the film.
3. **Hands are hands**: finger or glove shapes are visible, and objects are genuinely held (the object sits in the hand, not beside it).
4. **At least two shading layers**: base color + shadow, plus a highlight or rim light; the light direction matches the scene.
5. **At least three material details**: garment folds, stitching, hair groups, fabric weave, shoelaces, watch straps... whatever this character should have.
6. **Performance is specific**: every appearance has an expression + pose matching that shot's content (frowning at a phone, exhaling and pocketing the phone), not just blinking and bobbing.
7. **Same set as the style**: the character's lines, coloring, and palette share the background's drawing method — not a sticker pasted onto another painting.
8. **Consistent across shots**: the same character's features, hair, clothes, and palette match in every shot.

## Objects get no faces: how objects "act"

Bringing a concept to life does not need a face.

- **Shape and action**: lithium ions huddle and slow when cold; spread out and rush when hot. A battery bar drains cell by cell in the cold wind.
- **Scale**: something smashes from palm-sized to filling the frame.
- **Contrast**: the same object twice, side by side — one frozen, one normal.
- **Real objects**: a real battery cross-section, real frost texture, real screenshots.

## Self-check

Before delivery, sample 6 frames containing characters or objects, lay them side by side, and ask three questions:

1. Anything that looks like a "default AI little person" or a "white-shelled robot"? If so, change routes.
2. Did anything that should not have a face get one? If so, remove the face and tell it with action.
3. Do character and background share one drawing method? If not, redo the character in the style, or keep the person to hands only.
