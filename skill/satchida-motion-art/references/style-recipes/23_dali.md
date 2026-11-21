# 23_dali · 1931 Dali surrealism ("The Persistence of Memory")

> Source: migration test B (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/23_dali.js`.

Filename during the experiment: `scenes/c2_dali.js` (~235 lines). Median 47ms per frame (first frame 84ms); frame diff 4.6%.

**Pipeline**
1. The base plate splits into three caches because shadows must be sandwiched between them: `dali_bg` (sky, sea, rocks, ground) → shadows painted each frame → `dali_wall` (the broken wall fragment with the window + dead branch) → `dali_block` (stone block table + stool) → soft watches → characters.
2. **Volumetric fill `vol(c, path, x0,y0,x1,y1, a, b, occl, blur)`**: linear gradient fill, then inside the clip an inner shadow by stroking a dark ring with shadowBlur. No line art anywhere in the film; the academic roundness comes entirely from this.
3. **Long shadows**: each object's silhouette is projected to the ground with a shear affine, `setTransform(1, 0, −kx, ky, kx·yg, yg·(1−ky))`, where yg is that object's ground line (wall 700, table/cat 905, person 930). All silhouettes painted into one offscreen (pure black) first, then composited whole at α 0.55, blur 1.5px — prevents overlapping shadows from darkening. Clipped to ground only (y > 594). `kx = 0.85 + 0.6·easeInOut(lt/1.2)`: shadows visibly lengthen over 1.2s.
4. **Soft watch `softMap(o, sag)`**: disc local coordinates (u,v) → screen. v ≤ fold lies on the surface (y compressed to 0.28–0.32); v > fold hangs down: `X = cx + u·(1 − flare·q)`, `Y = … + d·(0.62 + 0.3·sag) + central-droop Gaussian + sin ripples`. Outer frame, dial, 12 marks, two hands (sampled along the mapping into soft lines), crease highlight — **all go through the same mapping**.

**Key parameters**: `flare = −0.12`; negative lets the hanging part spread outward like soft cloth with a round lower edge; positive would pinch into a waffle cone. drip 0.18–0.4. sag goes 0.1 → 1.4 over 1.2s: v1 was 0.35→1.0 and review said "the watch isn't visibly dripping". Three watches: windowsill R72, table edge R88, dead branch R64 (fold −34, mostly hanging). Hand speeds 4.5–6.5 rad/s.

**Motif animation**: three soft watches sag continuously, hands turning at different speeds; the stilted elephant on the horizon (four thin legs stepping alternately with π/2 phase offset, knee micro-bend at 0.52 height, body micro-bobbing at 14Hz, obelisk on its back) moving left 70px per second; 9 ants crawling in ellipses around the orange pocket watch; long shadows lengthening; cat tail softening and drooping (tail tip y + q²·34).

**Characters**: a Spanish girl, pale-blue long dress + white collar, blond bun, no line art, volume via gradients + inner shadows, features in dark-umber fine lines. Cat in gradient orange, stripes as translucent blur-2px strokes (soft), eyes radial gradients; white chest now a smooth ellipse (606,768) 40×92 instead of `K.white`.

**Palette**: sky `#22407c → #5f88bd → #e9dcae`; sea `#8aa6b8 → #4f6f86`; rocks `#e8c27a / #9a6a34`; ground `#d2ad70 → #7a5129`; wall `#f4ead2 → #cdbf9f`; watch gold `#f0d27c / #9a7426`, dial `#f6efd6`.

**Pitfalls**
- V1 shadows were cast toward the viewer (ky>0 downward) and got eaten by the frame's bottom edge. The sun must sit low in the left foreground with shadows lying to the right-rear (y′ = yg − ky·(yg − y)).
- Shadows fall on the ground, so they must be painted beneath the wall and the table — hence the base plate must split into layers, not cache as one.
- Soft watch with flare>0 and larger drip becomes the waffle cone.
- This segment's counter sits on a deep-blue sky; the default dark-umber digits were invisible — switched to cream digits + dark shadow.

**Still improvable**: the figures still lean vector-illustration; finer highlights and dark reflected lights would help. The reclining soft "self-portrait" creature from "The Persistence of Memory" could be the fourth motif.
