# 32_rembrandt · 1642 Rembrandt chiaroscuro

> Source: migration test D (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/32_rembrandt.js`.

Filename during the experiment: `scenes/r1_rembrandt.js`, ~47ms per frame.

**Pipeline**: lit-state underpainting (the room painted in "fully lit" colors, leaded diamond-pane window, Turkish table carpet) → background repainted with brown broad strokes, then blurred 2.2px and layered at 75% (the worked-up ground) → table carpet on its own layer, fine strokes → characters flat + volumetric gradients + fine strokes → characters "lost-edge" treatment → **lighting map multiply** → window glass brightened with screen + cloud shadows sweeping → mane impasto → candle flame, shaft dust, steam → craquelure, grain, vignette cached layers + soft-light golden-brown glaze.

**Key parameters**
- Lighting map: base rgb(30,21,13), equivalent to ambient 0.13. Stacked with lighter:
  - Light shaft: wedge polygon, blur 40px, cached, α 0.8–0.95.
  - The window itself: r330.
  - Face pool: r250 α0.95. Chest: r230 α0.55. Cat: r240 α0.8. Tabletop: r280 α0.6.
  - Candle: r190+40·fc, α 0.6+0.4·fc.
  - The wall's "separation light" behind the girl: r300 α0.35. Rembrandt often lights the wall behind a figure's dark side to lift the figure out of the background.
  - After stacking, multiply over the whole frame.
- Flicker: `flick(t) = 0.5·noise(2.2t) + 0.25·noise(6.5t)`; light-pool centers drift ±14px with noise(0.9t); cloud shadow `cloud = 0.5 + 0.5·sin(2.2t − 0.6)` scales window light ×(1 − 0.35·cloud) while a dark radial blot crosses the glass at 260px/s.
- Background strokes: cell18, len54, w16, jitter 6, angle −0.9 + 1.6·noise(0.003); palette mixBase 0.7.
- Lost edges: the character layer first blurred 2.4px painted fully opaque, then a sharp layer at α0.62 on top. The dark side melts into the background while the features stay readable.
- Impasto (mane brush): one stroke = round(w/1.3) parallel fine hairs, each brightness ±17, ends randomly shortened 0–25%, width 1.4–2.6; an α0.28 shadow line below; 2+w/3 bright specks scattered above. Used only in lit areas: blond hair, collar, porcelain cup, pearl, cat's white chest, cat's head top.
- Overlay: craquelure α0.28×0.28; grain density 0.05 α0.12; vignette 0.75; soft-light rgba(200,140,60,.35).

**Motif animation**: candle flame (noise-driven lean and height jumps), window light dimmed by cloud shadow and recovering, 70 dust motes in the shaft (shown only inside it, flickering over 24 frames), cup drinking, steam. Moving area 8.0% (0.45↔1.0s).

**Pitfalls**
- V1 impasto was "shadow offset + main stroke + bright ridge", three tidy lines — read as white stickers/band-aids. Only the mane brush reads as paint.
- Copying a region back to the original (`drawImage(b, x,y,w,h…)`) brings back the un-stroked background too, forming rectangular patches. Props should be their own layer painted after the strokes, not region-copied.
- Grain density 0.12 / α0.2 covers the face in dirty specks; 0.05 / 0.12 is right.
- Hands must paint before the cup, otherwise the hand ellipse covers the porcelain. drawGirl's order is "hand → cup → thumb"; follow it when repainting by hand.
