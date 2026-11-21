# 19_munch · Munch "The Scream"-style expressionism (1893)

> Source: migration test A (an independent agent implementation reading only the skill, 2026-10-04). Scene code was consolidated and moved to `scripts/engine/scenes/19_munch.js`.

Filename during the experiment: `scenes/03_munch.js` (~160 lines). Final version adjacent-frame median 2.27%, JS-side ~90–140ms per frame.

**Flow-line renderer `flowLines` (new)**
- Seeds: 24px jittered grid, ~3600 seeds. Each seed assigned a region (sky, fjord, mountain, wall, floor).
- Integrated along "a direction field that writhes over time", per-region parameters [steps, step, width, α]:
  - Final: sky [32,7,10,.78], fjord [26,6,9,.78], wall [42,7,13,.5], floor [32,8,12,.55], each stroke plus 0–8 random extra steps.
  - One stroke walks 200–300px.
  - History: v2 was [26,6,7,.85]; independent review still judged "Van Gogh at first glance", so strokes were lengthened, widened, and made more transparent.
- A stroke stops on leaving its region, so region boundaries stay clean.
- **No outlining, semi-transparent layered color**: Munch is thin long strokes. V1 copied Van Gogh's "dark outlines" and the wall became rows of caterpillar short strokes — Van Gogh at a glance. Only after removing outlines and raising steps 10→26 did it read Munch.
- Beneath, a flat base of the same color family (wall gradient `#a8401e` → `#5a1a14`); what shows through stroke gaps is the same color, not black.

**Direction field**
- Sky: `0.55·sin(x·.011 + y·.018 − 2.4t)`;
- Fjord: tangent around (620,470);
- Wall: vertical ±0.5 sinusoidal twist;
- Floor: toward vanishing point (1000,640).

**Blood-red sky**
- Seeds pick color bands by "waved y": `yy = y + 22·sin(x·.014 − 2.2t)`, band width 28px.
- 7-color cycle: `#e2541c #f08a24 #f4c03a #c8301e #e8743a #f6a63a #b82a1e`.
- The bands themselves writhe — that is "the sky flowing".

**The whole world flows**
At the end the whole painting is displaced per row `9·sin(y·.012 + 4.2t) + 4·sin(y·.031 − 6t)` and per column `6·sin(x·.009 − 3.6t)`, band width 4px, via `KIT.warpRows / warpCols`. Person, cat, table all sway together — much cheaper than drawing swaying lines separately.

**Motifs**
- In the window: bridge deck hatching, three railing bars (writhing with the world), two distant hatted figures.
- The screamer: skull face, hands pressed to cheeks, mouth opening/closing `7+2sin(9t)`, body swaying `sin(3.2t)·0.12`.
- Table and chair legs are trembling wavy lines.
- Girl: 1890s Norwegian dark gown + white collar, yellow-green face shadow (blur 8 `rgba(120,150,70,.4)`), 9 long blond locks as traveling waves `sin(9q − 7t)`.
- The cat's mouth slightly open, as if infected by the off-screen scream.

**Corner caption**: text painted to an offscreen layer, then twisted per-row by sine. Don't use comic-handwriting fonts like Kalam (review: breaks immersion); switched to IMFellEnglish.

**Pitfalls**
- After whole-frame row/column displacement, the left/right edges expose dark gaps. `KIT.warpRows/warpCols` gained a margin parameter: each row stretched 2×margin extra pixels; margin must be ≥ the maximum displacement.
- In line-art mode the cup-raising arm gets crossed by torso lines; re-covered with `KIT.nearArm` (see ②-16).
