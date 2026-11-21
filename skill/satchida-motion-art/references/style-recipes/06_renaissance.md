# 06_renaissance · 1503 High Renaissance (Leonardo-style)

16–37ms per frame (median 16ms).

## Pipeline
1. Static layer `ren_static`: the room is painted on the original canvas first, then the whole layer drawn into the cache with `filter: blur(1.3px)` — effectively sfumato over the full frame. Room contents:
   - Wall: P.texture #43321f→#22180e, radial gradient from the window's glow, darkened at the top.
   - Window: semicircular arched window, stone frame lit from the left, distant view inside the opening.
   - Floor tiles: perspective checkerboard, computed by true projection: `y = 420 + f·h/Z`, `x = 960 + f·X/Z`, f=1029, h=5.75, Z stepping back 1.4 per tile from 16. The first row lands at y=790, then 825/868/922/989 — matching the original's row spacing. Tile colors #a88c64 and #5c2418, plus a soft-light light pool and a radial gradient darkening the edges (centered 760,960).
   - Square table with white cloth, ladder-back chair.
2. Distance view (aerial perspective): three mountain layers, bluer and paler with distance (#9fb4b8 → #7d9294), outlines generated with fbm. Then the lake, river valley (gray-green grading to warm ochre), a winding silver-white river (width growing 3→16px with distance), cypresses and round trees, stone bridge.
3. Each frame draws in order: river sparkle (24 light specks drifting downstream, flickering) → birds → flapping-wing machine (all three clipped inside the window opening) → character layer → light shaft and floating dust → overlay.
4. Overlay `ren_over` (cached, one drawImage):
   - Vignette: α0.3 at 0.55, α0.8 at the edge.
   - Amber varnish: α0.07.
   - Canvas weave: a line every 3px.
   - Oil-paint brush texture: 9000 strokes, α0.022/0.028, width 5–10, random direction.
   - Craquelure: P.craquelure at α0.32; then with `brightness(0) invert(1)` it becomes white lines, offset 1px, α0.16, `lighter` on top — simulating the bright edge of lifting paint skin.

## Sfumato
Characters are drawn into the offscreen layer `renChars` first, processing only region (320,180,1200,780). Composited back in two passes: `blur(2.6px)` fully opaque first, then a sharp layer at α0.38. That gives soft edges while the features stay readable. Characters get no outlines; all volume comes from gradients:
- Skirt folds: bright folds rgba(200,70,60,.3), dark folds rgba(40,0,0,.45).
- Velvet sleeves: a light band rgba(170,200,140,.45) drawn along the bone direction.
- Face: lit-from-left gradient plus eye-socket shadows.

## Motif animation
- Flapping-wing machine: 0–1.35s flies from x=470 to 740, bobbing and slightly pitching. The two bat wings flap at `up = 0.5+0.5·sin(t·12+phase)`, wing tips ranging −118 to +24px. Far wing scaled 0.78×, darkened, phase offset 0.5. Wing construction: leading-edge spar + 6 radiating ribs + scalloped trailing membrane; the rudder also swings. V1 was a flat "paper airplane" — unrecognizable as Leonardo's flying machine; only after redrawing as today's rib-fan wing does it read.
- Light shaft: wedge drawn once into cache with `blur(28px)`, composited per frame with screen. V1 filled the polygon per frame — two hard edges looked fake. Dust is 46 particles slowly rising along the shaft and flickering.
- The girl sips from a silver cup per the choreography, eyes closing when cup>0.7. The cat keeps smiling with narrowed eyes, tail swaying.

## Pitfalls
- V1 oil texture used 26000 strokes at α0.05 with direction following noise — the whole wall looked like a Van Gogh swirl (Post-Impressionism). Dropped to 9000 strokes, α0.025, random direction to return to the classical-painting feel.
- The cat's body inner-edge darkening used 26px at α0.45, making the cream body look like a glass dome. Changed to 14px at α0.22, and the white chest now uses a radial gradient to "sfumato" the orange fur in, with no hard boundary.
- V1 floor tiles were too bright and contrasty — vector illustration. Must darken the surroundings and keep only the light pool the window light hits.

## v2 fixes (review: too static 0.20 vs 0.46; protagonist blurred while the window view is sharp — depth of field inverted)
- Sfumato changed to: blur layer 1.6px (was 2.6), sharp layer α0.82 (was 0.38). Soft edges kept; features and outlines now clear.
- Flapping machine scaled ×1.6, flight path 440→790, pitch ±0.07; birds up to 14, scaled 1–1.8×.
- Cat: head nuzzling ±0.16rad around the neck, narrowed eyes alternating tight/loose, tail ×2.2, breath ×3, look turning left/right. Girl: hair tips swaying ±11px, sip ×1.6.
- Cloud shadows drifting past the valley outside the window; shaft brightness varying 0.75±0.35 with "cloud over sun"; dust 70 particles.
- Static-segment frame diff: 0.20 (review metric) / 0.30 (mine) → 0.37. Original 0.43.
