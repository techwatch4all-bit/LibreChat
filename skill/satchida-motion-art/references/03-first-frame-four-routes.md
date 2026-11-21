# 03 · One frame first, then make it move: four routes

When image generation or character images are involved, first pick the currently available tools or import existing assets per [the image capability guide](images.md); private character assets and platform choices are not defaults for all users.

The method the author (Huashu) asked for: first design one frame with artistic quality, then animate that frame as required. On 2026-10-04 one project ran all four routes for real; each has its own best use.

| Route | Who draws the picture | Who animates it | Field test | When to choose |
|---|---|---|---|---|
| **A pure code** | Canvas procedural drawing + style renderer | code (choreography curves, IK, particles, boiling lines) | the art-history replication main line (Huashu's choice) | when you must prove "a model can produce artistic animation directly in code"; when you need precise control of every element's motion; when you need dozens of styles (swap renderer, swap style); when frames must align to voiceover |
| **B AI layered assets + code motion** | image model draws per layer (green screen, original frame coordinates preserved) | code (displacement, arcs, squash, physics, effects) | the 2026 ending segment: 11 assets composited in one pass | when image quality must be highest and characters need complex performance; when the style is realistic/illustrative and code cannot draw it |
| **C video model first/last frames** | image model draws one frame | Seedance first/last frame (same image for both) | Lovart Seedance 2.0 Van Gogh test: the girl sets down and lifts the cup, the starry sky turns, the cat flicks its tail; composition holds throughout | when you want the organic feel of "the whole painting flowing" without precise control; mood/atmosphere shots |
| **D hybrid** | backgrounds via B/C, characters via A, or the reverse | code orchestrates the timeline uniformly | — | large films: backgrounds need texture, characters need control |

## The shared first step: one keyframe design

Whichever route, start from one "right frame":
- **With a reference film**: feed the segment's "last frame before the transition starts" as the reference image to gpt-image, with a prompt like "Keep the reference's composition, camera, every object's position and size, palette, and brushwork exactly; change only two things: ...". In the field test the 50% blend with the original matched nearly pixel for pixel — composition lock comes from the reference image, not from writing coordinates in text.
- **Without a reference film**: design the composition for the subject first (what is the subject, where in frame, where the camera goes) and use a white-model screenshot as the reference image. Only speedrun/traversal films pre-fix a scene skeleton (standard composition coordinates) that all segments align to.
- **Three-direction hard gate**: character interpretations for this film (era-appropriate dresses / the same person traversing / original design with a head swap) produced three options on the same frame for the user to pick. Choosing the frame where the original had a male character maximizes the visible difference.

Pitfalls of the design frame (all of them were hit):
- Writing a minor character (age 17) plus any word like "short skirt" gets the whole image rejected as sexual. Always write long, modest clothing and add "modest attire".
- Write fur color per body part: "orange-white cat (orange tabby on crown, back, and tail; white muzzle, chest, belly, and four paws)". Just "orange cat" renders fully orange.
- Describing an action ("holding a cup to drink") overpowers the reference's pose. To keep the pose, write only "keep the hand pose from the reference image".
- For text that will move (years, titles), have the model "remove it, leave a clean background" and let code draw it; decorative in-frame text goes into the prompt word by word.
- Run batch image generation serially. Attribute generation to the actual tool-call record, input/output linkage, and human visual verification; PNG metadata does not prove which model made an image. Asset intake: see [the image capability guide](images.md).

## Route B's key: green-screen assets keep the original frame coordinates

Use the design frame as the reference image, prompt: "Draw only the XX from the reference... everything else flat #00FF00, no shadows, ground, or text. Position, size, and orientation exactly as in the reference." The generated character already stands on the original frame's coordinates. When keying, **do not crop to the subject and lose the coordinates** — `scripts/key_green.py` crops while writing the top-left origin into sprites.json, so compositing pastes back at the original coordinates and aligns in one pass.

## Route C's key: first and last frames are the same image

Seedance 2.5/2.0 supports frames2video. Give the same design frame as first and last → the painting's contents move and return to the original composition, so the clip's head and tail can butt seamlessly into transitions. Prompt structure: (1) camera completely fixed (no push/pull/pan/zoom/shake); (2) keep composition/style/palette throughout — no photorealism, no adding/removing objects, no new text; (3) list item by item "what moves in the painting and how" (from the deconstruction's motion list). Generate 5 seconds, keep the best ~1 second, and time-warp to the beat.
Channel: any Seedance integration supporting first/last frames (frames2video) works; the point is the prompt itself. Video generation bills per call — trial a short duration first.

## Route A's key

See `04-pure-code-drawing.md`. In one sentence (for speedrun/traversal): one scene skeleton × shared choreography × one renderer per style × characters on a separate layer painted last × lines patched at the end. Other subjects swap the first two items for subject-designed composition and actions.
