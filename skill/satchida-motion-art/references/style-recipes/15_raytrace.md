# 15_raytrace · 1993 early ray-traced CGI

No 3D engine — 2D Canvas "shading conventions" pretend to be a renderer's output.

## Plastic shading (every part passes through it)
`plastic(c, path, base, hx, hy, R)`:
1. Base color fill;
2. Radial gradient centered on the highlight point (hx,hy), radius R: 0→white .55, 0.28→white .06, 0.62→transparent, 1→deep purple `rgba(10,0,30,.42)` (edge darkening = volume);
3. Environment reflection: `lighter` ring of `rgba(70,150,150,.28)` stroke, width 0.18R, offset 0.04R left — the wall is teal, so the reflection is teal;
4. One hard-edged white elliptical specular highlight (0.16R × 0.09R, opacity .85). This stroke is the most 90s-Phong thing.

Limbs use `cyl()`: the gradient spans the limb's normal direction (dark .25 → white .5 narrow band at 22% → dark .45), plus a white fine highlight line along 20%–75%.
The girl uses RIG.girl's Path2Ds (long hair); the skirt swapped for blue plastic cylinder legs + knee ball joints, shoulders get ball joints too — that "toy figure" joint look.
The RIG cat's body is a polyline and plastic shading exposes the corners: `RIG.smooth(K.bodyPts)` first, then shade. Tabby marks drawn as "printed under the plastic" soft stripes with `filter: blur(2px)`.

## Scene
- Wall: radial gradient `#7dbcb9 → #64a6a6 → #3f8285`, light source at the window's position; the window's projection `blur(10px)` offset to the lower right.
- Outside the window: pink-purple gradient sky (`#a24cc4 → #df62ae → #f5a08a → #f8c070`), two mountain layers, a 28×26 pink wireframe grid over the mountains (early CG wireframe terrain), snow caps as jagged triangles.
- **Floor**: per-pixel perspective checkerboard, vanishing point (960,480), `X=(x-960)/dy, Z=1/dy`, cell TX=0.27, TZ=0.00029, 2×2 supersampled antialiasing, 35% fog within 140px of the near wall. Cached; cold start for the whole scene 53ms.
- **Reflections**: the object layer (chair/table/girl/cat) is painted to an offscreen layer, mirrored with `translate(0, 2*906); scale(1,-1)`, `globalAlpha .34`, drawn into the floor's clip region; props each mirror along their own contact line (cone 780, purple ring 846, chrome ball 800), and are **painted to their own layer first, then made translucent as a whole** — otherwise the purple ring's 140 small balls each at .34 stack up to opaque.
- Glass table: translucent green ellipse + thick edge + white stroke, one diagonal reflection sliding 260px per second.

## Small loops (must be visible within 0.23s)
- Purple ring: 140 balls arranged along a ring, spinning around the vertical axis at 7 rad/s, tilted 0.35, painted depth-sorted (first a dark-purple underlayer connecting the balls into a tube, then per-ball radial highlights). 0.23s turns 1.6 rad — from face-on to side-on, very visible.
- Chrome ball: per-frame per-pixel environment mapping (reflection vector down → checkerboard, up → pink-purple sky + one window light), checkerboard u coordinate shifting with `t*4.5` = spinning; Fresnel edge brightening. Diameter 104px, <2ms per frame.
- Lens flare (`lighter`): sun-core glow 170px pulsing ±8% at 23 rad/s; 12 star spikes rotating 1.6 rad/s; a horizontal streak 960px; 5 ghosts (circle + hexagon) laid along the "sun → frame center" line, sliding with `sin(t*5)*0.03`.
- Cat-eye green glint: `lighter` radial gradient radius 46px, pulsing ±25% at 18 rad/s.
- Cup drinking (choreo.cup), tail flick, blink, steam as usual.

## Pitfalls
- The transition's wireframe computes and caches edges from the frame where the new scene first appears (`once('edges')`), so the frame at lt≈0 must be complete — don't leave it blank or fading in.
- Performance: warm frames 23ms, cold start 53ms.
