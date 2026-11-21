# 18_klimt · Klimt golden phase (1907)

> Source: migration test A (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/18_klimt.js`.

Filename during the experiment: `scenes/02_klimt.js` (223 lines). 0.45↔0.9s diff is 32.9% (mostly from the flowing light), adjacent-frame median 0.40%, but 14 of 48 pairs are nearly static (see ②-2).

**Pipeline**
Gold-leaf wall (cached) → gold-dust four-pointed stars twinkling (lighter) → window "Birch Forest" stippling → black-and-white checkerboard gold frame → flower-carpet floor → Hoffmann black-and-white checkered table → diagonal flowing light (painted before the characters, who naturally occlude it) → cat → girl's gold robe (pattern layer via silhouette source-in) → realistic face and hands → flower crown → gold sleeves, gold cup → golden steam.

**Gold leaf**
- Per pixel: `f = 0.5 + fbm(x·.004)·0.55 + noise(x·.003, y·.08)·0.5 ± 0.05`, interpolated between `[120,78,18]→[196,148,52]→[246,216,128]`.
- Every 96px a very faint square seam, indicating gold leaf laid piece by piece.
- Wall: gold leaf × a 480×270 small fbm image upscaled, multiplied (brown-gold mottling, like "The Kiss"'s ground), then 9000 gold dust specks and dark dust scattered.

**Ornaments (gold robe)**
- 150 random points, four kinds:
  - Concentric circles three-color (30%): red-white-blue, blue-gold-red, purple-white-gold;
  - Gold spiral on dark-umber ground (32%), each rotating ±3rad/s;
  - Horus-style eye motifs (22%), blinking in turn: closed when `sin(2.2t+φ)>0.86`;
  - White dot clusters + red heart (16%).
- The hem has another 60 black-and-white vertical rectangles with gold outline — the language of the man's robe in "The Kiss".
- **Flat ornament against realistic face**: face and hands express volume with radial gradients (highlight `#fbe8da` → `#f0cfb8` → `#d8a88c` → edge `#b88068`), blurred blush and eye-socket shadows, only a 1.2px pale outline. The gold robe has a 3px dark outline. This contrast is Klimt.

**Others**
- Window "Birch Forest": 2600 autumn-leaf-colored ellipse dots, 6 birch trunks with black marks; 14 falling leaves tumbling down.
- Flower carpet: 260 concentric-circle flowers, larger when nearer (6→20px), heads nodding `sin(4.2t+φ)·0.18r`.
- Flowing light: a bright band 520px wide, α.24, sheared `transform(1,0,−0.45,1)`, lighter, sweeping −200→2300 **at constant speed** over 1.15s.
- Gold dust: 420 specks, four-pointed stars when `sin(t·sp+φ)>0.55`. V1 stars too big, like Christmas ornaments; radius changed from `s·(1+2.2a)` to `s·(0.6+1.1a)`.

**Pitfalls**
- Doing `source-in` per ornament erases the previous ones — see ②-7.
- Flowing light at α .38 reads as lens flare; pressed to .24.
- V1 had static stretches between adjacent frames: blinking is intermittent, flowing light is a soft gradient. After adding three things, static frame pairs fell from 20/36 to 0/36:
  - 34 gold-leaf flakes tumbling down (150px/s, squares and circles, gold gradients);
  - Gold dust rising at 26px/s;
  - Flower nod amplitude raised 0.18 → 0.35.
- V1 put gold spirals on the cat's face too; review said "like a rash" — now body only, count cut to 46.
