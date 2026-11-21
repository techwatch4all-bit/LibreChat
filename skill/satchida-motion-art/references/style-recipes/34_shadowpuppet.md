# 34_shadowpuppet · Chinese shadow puppetry

> Source: migration test D (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/34_shadowpuppet.js`.

Filename during the experiment: `scenes/r3_piying.js`, ~121ms per frame (each leather part gets its own offscreen; many multiplies).

**Pipeline**: shadow screen (radial warm light from the oil lamp behind + screen-composited wick hotspot + 3px fabric weave, weave cached) → props layer (window lattice, table, vase flowers, square-back chair, cached) → butterfly → cat → girl, one offscreen layer per group → each layer first prints an offset soft shadow, then multiplies the body → rivets → control rods → wooden frame.

**Key parameters**
- Leather part function `piece(g, path, col, carve)`:
  - Fill color.
  - Carve patterns with destination-out inside the clip.
  - Inside the clip, stroke a same-color "leather edge" 2×edge wide so carvings never cut through the outer contour.
  - Stroke a 2.6px dark-brown edge #3a160a.
- Carving library:
  - Fish-roe dots: s14–22, r3–3.5.
  - Roundel flowers: 5-petal ellipses, s36–46.
  - Cloud scrolls: small Archimedean spirals, line width 3.4, s24–40.
  - Lattice: s26–32.
  - Carved lines: width 3–7.
- Stamping to the screen: `stamp(layer)` first multiplies α0.28, blur 6px, offset (7,5) — the ghost when the leather isn't flush against the screen; then multiplies the body. Translucency = screen color × leather color; overlapping leather naturally darkens.
- Colors: red #c0352a, green #2f7d4c, amber #d99a2e (blond hair = amber leather), yellow #e2bd4a, blue #2c5a8a, orange #d9782a (cat).
- Screen: radial #fff6d6 → #f2d7a0 → #cf9a58 → #7a4a20; flame disturbance `fl = 0.5·noise(3ts) + 0.3·noise(9ts)`, ts stepping at 15fps. Light center drifts ±26/±18px, hotspot radius 260+40·fl.
- The dan role's "empty face": after the hair is drawn, destination-out the whole face, stroke only the face contour, then add phoenix eyes (upturned long lines + lower lid + pupil dot), willow-leaf brows, lip dot.
- Orange-white cat mapping: orange = orange leather; white chest, muzzle, legs, paws = **fully carved out, leaving only the leather edge**; tabby = carved lines. This applies to all "silhouette/cut-out" styles: white areas are carved straight out.
- Motion:
  - The girl sways ±0.012rad around (1260,930); head rotates ±0.06 around the neck rivet.
  - Cup drinking steps at 10fps.
  - Loose wrist: dangle = 0.35·sin(11·ls)·(1 − 0.6·cup), the cup swinging with the hand.
  - Cat head nods around the neck 0.1·sin(6ts) + 0.05.
  - Tail: 4 hinged segments, each rotating relative to the previous by 0.3·sin(7ts − 0.9i) + 0.38, the whip tip lagging segment by segment.
  - The buyao hair ornament's bead strands swinging.
- Rods: 5px dark-brown lines, blur 1.2px, multiply, running from neck, wrist, cat's back, cat's head, and butterfly to the frame's bottom edge.

**Motif animation**: the lamp flame makes the whole screen's light patch jump, the butterfly (wings flipping with scaleX at 12fps, with its rod), wrist flicks, cat nodding and tail whip, buyao ornament. Moving area 6.8%.

**Pitfalls**
- A table leg over the dress: after multiply, red×green is nearly black — a black trapezoid. Overlap darkening is correct in shadow puppetry, but don't put overlaps on the visual focal point; just move the table leg.
- V1 cat forelegs were one solid orange rectangle covering the white chest. Only two nearly fully carved white legs read as "orange-white".
- Rods crossing the main body get messy: rods run downward and outward from the leather parts, never across other characters.
