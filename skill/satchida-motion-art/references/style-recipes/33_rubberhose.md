# 33_rubberhose · 1930 rubber-hose cartoon

> Source: migration test D (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/33_rubberhose.js`.

Filename during the experiment: `scenes/r2_rubberhose.js`, ~20ms per frame.

**Pipeline**: paper-toned monochrome base (wallpaper vertical stripes + diamond dots, floor tile seams, watercolor darkening in corners, cached) → sky outside the window (sun face, clouds, tree) → window frame and polka-dot curtains → chair → table (curved legs + dancing flower) → girl → cat → `saturation` desaturation + multiply #f2e8d2 for fading → film layer.

**Key parameters**
- Beat bounce: `bnc(tq, ph) = |sin(π(tq/BEAT + ph))|`, BEAT = 60/128. Each object hops amp pixels around its own contact point: on landing squashed sx=1+0.09k, sy=1−0.09k; airborne stretched ~5%. Phases staggered by 0.25 beats: table 0.5, girl 0.25, cat 0.75, sun 0; the hair bow 0.05, slightly later than the body — counts as follow-through.
- Stepping: all characters and motifs use `tq = floor(t·12)/12` (on twos); cup drinking also steps at 12fps; the film layer uses floor(t·24).
- Character drawing: the armature provides anchors only.
  - Head: a big round face of radius 82 around headC.
  - Pie-cut eyes: white sockets + black pupils, a wedge cut from each pupil with arc(−1.45..−0.85); 3 lashes above.
  - Arms: rubber hose = one quadratic bezier from shoulder to hand, constant thickness, black edge +10px.
  - White gloves: 4 fingers, flared cuffs, 3 lines on the back of the hand.
  - Polka-dot dress to the ankle (the modest cut).
- Cat: body via `RIG.smooth(K.bodyPts)`, mid-gray #a39a84 (=orange), tabby #5e574b, white chest/paws #fbf7ec; tail a wavy rubber hose `sin(7q − 9tq)·26q`.
- Film layer:
  - Gate weave ±1.5/±2px.
  - Flicker: each cell overlays white α0.02–0.09, then black 0–0.06.
  - Scratches: 3 vertical lines, repositioned by floor(t·6), so one scratch lives several cells.
  - 14 dust specks per cell + the occasional hair.
  - Grain layer randomly translated ±20px per cell.
  - Rounded film gate: roundRect r60, plus vignette.

**Motif animation**: everything bounces on the beat, sun-face rays rotating 1.6rad/s with the face nodding on the beat, the dancing flower (stem ±0.35rad left/right, leaves waving as hands, petals turning), one smoke ring per beat, curtain hems flapping on the beat, film flicker and scratches. Moving area 40%, but most of it is film noise (see ② item 5).

**Pitfalls**
- The armature's cat body is a polyline; straight edges show instantly in cartoon — must smooth.
- The whole film is pressed to monochrome: the saturation desaturation must be applied uniformly once after the characters are drawn, otherwise gloves and the cup retain warm color.
