# 09_postimp · 1889 Van Gogh (benchmark implementation)

File: `scripts/engine/scenes/09_postimp.js`, ~110ms per frame (three full-frame stroke passes). Other eras are written following its structure.

## Pipeline
Flat underpainting (wall/floor/window/bed large areas) → flow-field stroke repaint (region palettes) → props layer (table, chair, vase, picture frame, lamp, separate small strokes source-atop) → environment line art (deep blue 4.5px, boiling at 8fps) → characters (flat fill → fine strokes source-atop → fill-in lines and features) → moving highlights (lamp-halo dashed rings expanding, stars twinkling, steam).

## Key parameters
- Direction field: wall vertical −π/2 ± 0.22·noise; floor along perspective lines toward the vanishing point (960,330); starry sky along the nearest swirl's tangent + 0.3t rotation; lamp halo along the circle; bedhead vertical, sheets near-horizontal.
- Three stroke passes: non-wall non-floor cell10 len22 w6.5; wall cell14 len64 w8; floor cell12 len46 w8. Outline 0.8–0.9, mixed 40–45% deep blue. Reseeds at 8fps.
- Region palettes (P.swatch, mixBase 0.3–0.45): wall `#7f9be6 #5f7fd8 #a7bbf2 #6c6fd2 #8ad0e6 #c3cbf6 #4f6cc8 #9a8fe0`; starry sky `#22339a #2f4fb8 #5c86dc #8fb6ee #1b2a78 #3c6bd0`; floor `#c0573c #a8453a #d7774a #8e3b30 #5f8f6a #c96a52 #e08a5c`.
- 7 rings of orange/pale-orange spirals on the cat's body (clipped to the body, rotating 0.6rad/s) — the original's "swirl cat".

## Pitfalls
- One parameter set across the whole image smears into a carpet: wall, floor, everything-else must be three separate passes.
- Small objects get shattered by big strokes: always split them into the props layer.
- Color jitter alone gives "noise in one blue"; the Van Gogh feel comes from a dozen-plus hues inside each region palette.
