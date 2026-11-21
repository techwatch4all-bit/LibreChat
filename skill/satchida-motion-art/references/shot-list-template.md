# Shot list template: shot list first, then build

Track lane's step 1. Open-lane models are also advised to write one; running the lint is optional.

A shot list is this film's storyboard: first lock one style, then one row per shot, stating clearly what **objects are in frame, what they are doing, how the camera moves, how many characters of text appear on screen, and what method builds it**. If you can write this table, the film will not become one ever-lengthening PPT page, nor a collage changing style every shot; if a row cannot be written, that shot is not thought through yet — do not write code for it.

## How to write it

Copy the block below into `<project>/shot-list.md`, fill the three pre-table lines first, then fill one row per shot:

```markdown
Style: (one sentence: one style card or one drawing method, used for the whole film)
Palette: (a name from references/palettes.md, or 3–6 #hex values)
Character: (none / hands and backs only / frame library <path>)

| Time | Subject | Action | Camera | On-screen text | Method |
|---|---|---|---|---|---|
| 0–3 | (noun: a person, a thing) | (verb: what it is doing) | hold / slow push / pull out / glide / punch / slam / cut | (≤8 chars, may be empty) | (y4 clip shot01.json / scenes/xxx.js / material photo) |
```

| Column | What to write | What not to write |
|---|---|---|
| Time | `0–3`, `3–7.5`, or `0:03–0:07`; one shot's end is the next's start | |
| Subject | a noun, something you can point at on screen and say "that one": a slice of bread, one spore, the protagonist's hand | titles, bullets, text, lists, labels, subtitles, cards, backgrounds, "the scene", icons; empty shots, flat color, black frames, gradient backgrounds (protagonist not in frame) |
| Action | a verb, the subject's own action: drifts in, cracks open, tunnels in, gets cut off | appears, shows, displays, fades in, appears one by one |
| Camera | this shot's main move, chosen by "where the audience should look now": hold / slow push / pull out / glide / punch / slam / cut. Punch and slam are accents, only for reveals, reversals, key numbers; after pushing in, come back out. Usage and durations: `references/shot-language.md` | pushing on every shot; a uniform slow push on every shot |
| On-screen text | ≤8 characters per shot, may be empty; spoken lines go to subtitles | whole sentences of narration, three lines of bullets |
| Method | what builds it: which grammar's parameterized clip (write the spec file name), `scenes/<id>.js` code drawing, real material full-frame | a different grammar every shot |
| Labels (optional column) | small labels next to the object in this shot, separated by commas | more than 3 in one shot; a row of glowing capsules |

The three pre-table lines (style lock):

- **Style**: one sentence stating the film's single drawing method, e.g. "warm-wood paper illustration, flat fill with fine pencil lines, one kitchen-afternoon side light for every shot". Scenes may change; style may not: cartoon people, dark code screens, starfield icons, white-background bar charts, paper, webpage screenshots taking turns — each shot fine alone, the whole film a collage.
- **Palette**: one set from `references/palettes.md`, or 3–6 hex values. Every clip spec writes the same `"theme"`; scenes use only these colors. No blue-purple gradients, deep-purple starfields, or neon cyan-purple. Only when the user names blue-purple (cyberpunk purple, Van Gogh's Starry Night) add one line "Blue-purple allowed: reason".
- **Character**: if people or anthropomorphic characters appear, read `references/character-fidelity.md` first. With image generation, generate AI frames and write "frame library <path>"; without, write "hands and backs only" or "none" and tell the story with hands, backs, silhouettes, and objects. Code-drawn chibi little people, white-shelled robots, coins and balls with faces are retired.

Five requirements — check each after writing:

1. **The first 3 seconds are one concrete small scene, and the ending lands on one action by the protagonist or main object**: the opening is a person or object doing something related to the topic — not a title, not "today we will talk about"; the ending is an action like into the pocket, book closed, pull out to the whole; text may be written on objects inside the frame, and it does not close on a centered quote card.
2. **One example runs the whole film, one style to the end**: the same loaf of bread, the same pair of hands, the same machine from start to finish, each shot telling what happens to it; every shot stays inside the style written in the style-lock line.
3. **Each shot 2–6 seconds**: individual shots may reach 8 seconds.
4. **Text-led shots ≤30%**: an object column that is a title/text, on-screen text over 7 characters, or built with y5 kinetic type — all count as text-led.
5. **Adjacent shots do not share a composition**: if this shot is a full-frame close-up, the next glides, switches to another object, or changes shot size. What changes is composition and camera, not style.

Two hard lines for the Method column (track lane step 3 repeats them): **a single parameterized clip lasts at most 8 seconds** (the same .json totals ≤8 seconds in the table); **one film uses at most 2 clip grammars**, all specs write the same `theme`, and remaining shots use scenes drawn in the same palette, or real material full-frame.

## Check

```sh
uv run <skill>/scripts/storyboard_lint.py <project>/shot-list.md --script <project>/script.txt   # with a voiceover script, pass --script
```

Every shot gets red/yellow/green plus a fix; any red exits nonzero. On red, fix the shot list and re-run — **no code until reds are clear**. Yellows may proceed, with item-by-item reasons in the delivery notes. lint checks: whether the pre-table style, palette, and characters lines are written; whether the palette has blue-purple hex values; whether the characters line is a code-drawn little person; whether the object column contains robots, little people, or stick figures while characters is not a frame library; whether y4 was used without a frame library; whether coins or balls were given faces; the object column may not be empty, layout words only, or empty shots/flat color/black frames; the action column must have action; on-screen text ≤8; neither the first nor last shot may be text-led; text-led ≤30%; with `--script`, numbers on screen (percentages, years, unit-bearing numbers) must be findable in the script (script numerals written as words also count); with a "Labels" column, over 3 labels in one shot is yellow; single shots 2–6 seconds (6–8s yellow, over 8s red); three consecutive shots with the same camera move is yellow ("hold" and "glide" do not count), three consecutive pushes inward is yellow, punch/slam/whip exceeding one third of shots is yellow; the same clip totaling over 8 seconds in the Method column, or more than 2 clip grammars, is red. "One example runs the film", "every shot truly uses one style", and "adjacent compositions differ" cannot be machine-checked — check them yourself.

## Example: why bread goes moldy (54 seconds, landscape)

This is a writing demonstration: do not copy its subject, objects, or shot order into your film. The same loaf of toast and Xiaoman's two hands run the whole film; the face never appears.

Style: warm-wood paper illustration, flat fill with fine pencil lines, one kitchen-afternoon side light for every shot
Palette: wood
Character: hands only (Xiaoman's hands, no face)

| Time | Subject | Action | Camera | On-screen text | Method |
|---|---|---|---|---|---|
| 0–3 | Xiaoman's hands and a bag of toast | Hands tear open the bread bag; fingertips stop on a green spot | hold | | scenes/kitchen.js |
| 3–6 | That green spot | The spot's edge grows a ring of white fuzz, spreading like a map | slow push | not there three days ago | material moldy-bread photo full-frame |
| 6–10 | One spore | The spore drifts in through the window gap, tumbling onto the bread | glide | spore | scenes/spore.js |
| 10–14 | That spore | The spore's shell cracks; one white thread stabs into the bread | punch | | scenes/spore.js |
| 14–18 | The crumb's air pockets | The thread branches through the pockets, rooting downward like a tree | pull out | mycelium | scenes/hyphae.js |
| 18–22 | Starch granules in the bread | The thread's tip sprays enzymes, snipping starch into sugars | slow push | starch→sugar | scenes/hyphae.js |
| 22–26 | The kitchen wall's thermo-hygrometer | The needle slides from 15°C to 28°C; condensation beads on the bag's inner wall | cut | 28°C | scenes/kitchen.js |
| 26–31 | Two mold-area curves | The counter curve races up; the fridge curve crawls at the bottom | hold | much slower in the fridge | t3 clip shot08.json |
| 31–35 | Little pillars on the mold surface | Pillars lift black spore balls, which pop open | slam | | scenes/hyphae.js |
| 35–39 | A cloud of spores | The cloud drifts across the table toward the next bag of buns | glide | next stop | scenes/spore.js |
| 39–43 | Xiaoman's hands and the bread knife | The blade lines up on the green corner, tempted to cut and keep eating | hold | just cut it off? | scenes/kitchen.js |
| 43–47 | The cut bread's cross-section | Perspective peels layer by layer; invisible mycelium long since covers half the loaf | punch | the invisible part | scenes/hyphae.js |
| 47–51 | Xiaoman's hands and the trash bin | Hands drop the whole bag in and close the lid | cut | | scenes/kitchen.js |
| 51–54 | Xiaoman's hands and a new bag of toast | Hands tuck the new loaf into the freezer; the door shuts and frost crawls up the bag | pull out | cold, dry, sealed | scenes/kitchen.js |

Why this table passes: the pre-table locks one style and one palette, and the person is hands only; the opening is hands tearing open the bag and spotting mold, not a title; the ending returns to the same hands tucking the new loaf into the freezer, with three words written inside the picture, not a quote card; the same toast runs start to finish; none of the 14 shots is text-led; the only parameterized clip is shot 8's t3 curve, whose spec writes `"theme": "wood"`, the same palette as the scenes; the camera follows "where the audience should look now": slow push to see detail (green spot, starch), glide following something moving (spore, spore cloud), pull out to see the whole (mycelium rooting, freezer door closing), hold when the picture moves by itself (the curve growing, the blade lining up); punch and slam used only three times, for the spore shell cracking, the spore ball popping, and the cross-section reveal — the three "so that's why" moments. Every push-in returns via pull out, glide, hold, or hard cut; no three consecutive shots push in. Shot 8's curve is illustrative and the finished film must carry a "sample data" badge.
