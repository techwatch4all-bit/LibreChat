# 28_monet · 1899 Monet "Water Lilies" + "Japanese Bridge"

> Source: migration test C (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/28_monet.js`.

Filename during the experiment: `scenes/k2_monet.js` (176 lines). ~105ms per frame, frame diff 30% (mostly the water surface boiling).

**Composition**: the wall is an Orangerie-style water lily mural (the whole wall is water); the window is the green Japanese bridge (arched bridge + wisteria + pond); green shutters of Giverny flank the window; the girl sits in front of the mural.

**Pipeline (09 benchmark structure)**
1. Underpainting `moBase`, repainted every frame because lilies drift and willow shadows sway.
   - Water: vertical gradient `#b9c7e6→#8fa6d6→#6c84bf→#5a72a8`, plus 4 pale pink-yellow sky reflections.
   - Willow shadows: 5 vertical bands, edges waving horizontally `sin(0.03y−3.2t+k)·14`.
   - Lilies: 10 clumps, ~100 notched ellipses total (rx 38–78, ry 12–21), 40% with pink/white flowers.
2. Four stroke passes:
   - Water: cell 9, len 34, w 6.5, **horizontal** angle≈0±0.06, boil 6.
   - Window view: cell 6, len 13, w 4.5, upper half diagonal strokes, lower half horizontal, boil 6.
   - Floor: cell 12, len 34, w 8, **boil 0**.
   - Window frame/shutters: cell 6, vertical and horizontal each, boil 0.
   - All passes outline 0 (Impressionism doesn't outline).
3. **The bridge gets its own layer**: first lay a dark shade backdrop `#24452a` behind the bridge in the underpainting; the bridge itself is carried on `#3f8a62` heavy lines (20px) with `#8fdcae` bright lines drawn over. Strokes at cell 5 with a 5-color pale blue-green palette. Without this, the bridge is swallowed by the leaf palette and vanishes entirely.
4. Region palettes:
   - Water `#5b6fb5 #7d8fd0 #9db5e0 #6aa0a8 #b7a6d8 #d9c8e8 #8fb8a8 #a6c4e8 #c8b0d8` (mix .45)
   - Leaves `#5f8f4a #7fae5a #3f6f4a #9cc070 #6f9a7a #b4cc78`
   - Pink `#f0a0b8 #f7d0dc #fff2f4 #e88aa0`
   - Floor `#c69a6a #b07a5a #d8b08a #9a6a7a #8a7aa8 #e0bc90`
5. Characters: fill-mode flat → source-atop fine strokes (cell 6, len 12; the white dress samples from `#fbf8f2 #e4e0f6 #cfd2ee #f8ecd0 #d8e8f2`) → **colored shadows**: a linear gradient overlaying warm yellow α.22 on the lit side and purple α.32 on the dark side (source-atop) → features only, in `#5a4f8a` fine lines.

**Motif animation**
- **Water light specks trembling**: 160 bright horizontal short strokes (`#fffbe8 #fdf0d0 #f8e0ec #e8f4ff`). Brightness `clamp(sin(t·(5..11)+φ)·sin(2.3t+i))`, hopping ±5px horizontally at 10fps.
- Lilies drifting `x+sin(1.3t+φ)·7+6t`, willow shadows waving, 3 ripples (dashed ellipses ry=rx·0.22, expanding and fading).
- Wisteria: 12 hanging clusters, each 9 pale-purple dots from large to small, swaying `sin(2.4t+0.9i)·8`. Straw hat's blue ribbon fluttering.

**Characters**: 1899 white summer dress, high collar, puff sleeves (shoulder ellipses), pale-blue sash; RIG straw hat colored `#ecd28a`.
**Pitfalls**
- Whole-frame 6fps boiling gave a 47% frame diff — the full screen was noise.
- V1 wisteria used thick lines and drew like smooth pills; changed to dot chains.
- The counter is unreadable on the stroke base — needs a blur-18 cream halo.

---
