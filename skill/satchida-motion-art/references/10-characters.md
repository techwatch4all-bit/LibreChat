# 10 · Characters: humans are AI-generated frames; code composites

When image generation or character images are involved, first pick the currently available tools or import existing assets per [the image capability guide](images.md); private character assets and platform choices are not defaults for all users.

## Choosing how to implement a character

The same character can be implemented three ways (side-by-side images of A and B in `assets/character/author-avatar-comparison.jpg`; C's results in the Kurzgesagt and whiteboard demo films):
- **A code-drawn**: only for motion white-models, rehearsals, and purely geometric symbols (blocks, terminals — things that are geometric by nature). People, anthropomorphic characters, robots, and objects with faces are not drawn into finished films with code; see `references/character-fidelity.md`.
- **B paste from a fixed frame library**: easiest way to keep a character consistent, but the library's style must be reconciled with the scene.
- **C generate action frames in the film's style, then composite**: use a reference image to hold identity, key out the green screen, and hand motion and materials to code.

Live-action and anthropomorphic characters use only B or C, then pass the delivery line in `references/character-fidelity.md`; without image generation, show hands and backs only, or no people at all. Style cards preserve the known weaknesses of each character class.

## B: paste from a fixed frame library

- Frame library: your own finalized character frames (e.g. waving, dragging — 8 transparent PNGs per action; generic action frames must be prepared by you; the three sample segments' character frames ship with the long-scroll demo in `scripts/engine/demos/long_scroll/frames/`).
- Loaded as image assets at engine startup; rendering swaps frames by `floor(t*9)%8` — limited animation, no tweening.
- Anchored at the foot's center; `face=-1` flips horizontally.
- Give the frames the film's material (Vox adds white paper-cut edges and shadows; stroke-based styles may run a fine-stroke pass over the frame with source-atop).

B's extension: when the same frames must walk into many styles without regenerating, treat the frame as one region of the scene and hand it to the method engine for repainting (remap colors by luminance, then overlay a bit of the original frame to preserve the face); method and boundaries in doc 18, section 6.

## C: generate a set in the film's style

1. **Generate**: use a reference-capable image model like gpt-image (prompt craft reference: [huashu-gpt-image](https://github.com/alchaincyf/huashu-gpt-image)); run batches serially. ref = the character's three-view design sheet or the master frame of an existing library; the prompt states:
   - The style's **formal grammar** (not just "XX style"): Kurzgesagt pure color blocks with no outlines and shadows one shade darker in the same hue; Vox black-and-white halftone clipping photos + white paper-cut edges; whiteboard black marker linework + orange hatching; Monet short strokes of light...
   - **Pose and camera alignment** ("side-on facing right, arm extended pointing right"); for motion, one sprite sheet with multiple frames (4×2 eight frames, frame count stated first, "same character" to lock consistency, give only key poses and let the model interpolate, "each frame stands centered at the bottom of its cell, same size").
   - Green screen `#00B140` (white hats and white tees cannot use white backgrounds).
   - Character sheet (using the Huashu likeness as the example): **pure white** bucket hat (models love drawing light gray — write it hard), round black glasses, white tee, khaki shorts, white clogs, black watch on the left wrist, big head small body.
2. **Verify**: attribute generation to the actual tool-call record, input/output linkage, and human visual verification; PNG metadata does not prove which model made an image. Asset intake: see [the image capability guide](images.md).
3. **Key and slice**: `scripts/key_split.py` (de-green, slice poses by column; whiteboard linework uses `--white` to crop without keying, pasted with multiply); use `scripts/key_green.py` when original frame coordinates must be preserved.
4. **Composite**: code decides only position, size, orientation, frame-swap timing, and material; interactive props (pebbles, ripples) are still drawn in code and aligned to the hand's position.

## When code-drawing is still used

In finished films: silhouettes, backs, hands (drawn properly in the film's style), and things that are geometric by nature (blocks, terminal windows). Robots, chibi characters, stick figures acting stories, and faces on objects are retired; reasons and alternatives in `references/character-fidelity.md`. `lib/rig.js`'s girl/cat rigs, `rig_huashu.js`, and `lib/toon.js` remain: for motion reference (where hands and feet are, to anchor AI frames), white-model rehearsals, and the already-finalized characters of art-history-speedrun-style demos.
