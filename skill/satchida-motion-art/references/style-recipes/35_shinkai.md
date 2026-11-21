# 35_shinkai · 2016 Shinkai light and shadow

> Source: migration test D (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/35_shinkai.js`.

Filename during the experiment: `scenes/r4_shinkai.js`, ~71ms per frame.

**Pipeline**: realistic interior (wall warm/cold gradients, wood floor perspective seams, aluminum-frame window, calendar, desk, cached) → sky + cumulonimbus + power poles and wires + distant rooftops + plane contrail + birds → glass droplets → white gauze curtains → window-shaped light patches on floor and wall (the wall patch carries the swaying curtain shadow) → potted plant → cat, girl (cel) → steam → Tyndall shafts + light dust → lens flare → bloom → soft-light warm/cold separation.

**Key parameters**
- Cel function `cel(c, p, base, shade, rim, {sd, rw, lx, ly})`:
  - Shade = clip(p) ∩ ¬(p translated (lx·sd, ly·sd)). Implemented with evenodd: one big rectangle + the translated p as the clip.
  - Rim light = clip(p) ∩ ¬(p translated rw in the opposite direction).
  - Light comes from the window, lx=−1, ly=−0.55, so shade falls on the lower right. sd: large parts 22–30, face 10, small parts 8; rw 3–9.
  - Line color #6a4632, width 2.2. Per-part order "fill → shade → rim → stroke"; occlusion is naturally correct, no visibleLines needed.
- The cat below the window is backlit: lx=0.5, ly=1, shade on the lower side, plus a ring of lighter warm rim light rgba(255,220,160,.55) on the head top and back.
- Colors: skin #ffe8dc/#f2b6a8; blond #f8d681/#d8a050; white uniform #fbfbfe/#b9c3dc; navy #2c3a66/#1b2446. Angel ring: a 9px bright arc across the back of the head, rgba(255,250,226,.85).
- Anime eyes: white 8×12, iris vertical gradient #1f3f7a → #3f7fd0 → #9fd4ff, two highlights, upper lid 3.4px with one corner lash.
- Cumulonimbus: 70+12 puffs. (1) all puffs painted as blue-gray silhouettes (linear gradient #b7c6e6 → #8297c6); (2) each puff paints a 0.82r white radial bright ball offset toward the sun (+0.22r, −0.3r); (3) the whole layer blurred 3px, then a 55% sharp layer on top. Each puff's radius breathes 0.05·sin(1.3t), the whole thing drifting 10px/s.
- Flare:
  - Sun core: r130.
  - 10 star spikes: lengths 90/170, rotating 0.25rad/s.
  - Horizontal streak: 840×4.
  - 5 hexagonal ghosts: along the sun→frame-center line at 0.45/0.75/1.25/1.6/2.0×, α 0.04–0.12.
- Tyndall: 3 wedges, blurred 18px then cached, screen, α 0.75 + 0.25·sin(3.4t). Light dust 60 particles, radial gradients, flickering.
- Bloom: the whole frame painted into a 480×270 small canvas → blur 6px, brightness 1.1 → screen α0.28 upscaled back on top.

**Motif animation**: cloud puffs churning and drifting, plane contrail, flock flapping, one droplet sliding down the glass (with a wet trail), white gauze curtains and their wall shadows swaying, potted leaves swaying, hair blown by wind, star spikes rotating, shafts flickering, light dust. Moving area 3.0%.

**Pitfalls**
- With the sun at the window frame's corner, the flare spills onto the wall like a lamp hung there. The sun must sit inside the glass, flare radius ≤130.
- V1 clouds were one radial gradient per puff plus a stroked "lit arc" — read as a pile of soap bubbles. The recipe is "silhouette + offset bright ball + blurred/sharp two layers".
- V1's full-frame horizontal streak was 1800px long — read as a bug line. Cut to 840px near the sun, α0.35.
- Droplets drawn as solid circles read as bubbles floating in the sky. Draw only the lower-edge arc, a transparent body at α0.22, and one highlight point.
- A variable name collision (two `const cg`) made the whole scene fail to load, and was silently replaced with a placeholder frame (see ② item 1).
