# Palettes: one set of colors per film

The "Palette" line before the shot list picks one named set from here, or defines 3–6 hex values by the rules at the end. Every parameterized clip's spec writes the same `"theme"`, and scenes use only these colors too (lightness and alpha adjustments are fine — never introduce a new hue).

## First, the forbidden zone

**Blue-purple gradient backgrounds, deep-purple starfields, neon cyan-purple glows, purple frosted glass**: the author's words — "we need to avoid the garbage blue/purple gradient palettes; that is very AI slop". These are the defaults AI animation falls into most often, and audiences read them instantly as "made by AI".

`deliver.py` measures it: a frame with over 30% blue-purple (hue 225°–300°, saturation ≥0.30) counts as a blue-purple frame; above 30% of the film is a red light and it is not released. When the subject itself demands blue-purple (a user-named cyberpunk purple, a Van Gogh Starry Night-style frame), deliver with `--allow-blue-purple "reason"`, which downgrades to yellow, and the reason lands in the delivery notes' facts section.

Navy flat fills (hue about 210°, see `navy` below) are not in the forbidden zone: it is a deliberate single background color, not a gradient and not glowing.

## The eight ready-made palettes

Each has 6 keys: `bg` background, `surface` cards/paper/panels, `ink` main text, `sub` secondary text and fine lines, `accent` primary accent, `accent2` secondary accent. In a clip spec write `"theme": "wood"`, or as an object `{"name": "wood", "accent": "#B8452A"}` to override a single key.

| Name | Fits | bg | surface | ink | sub | accent | accent2 |
|---|---|---|---|---|---|---|---|
| `paper` | humanities, history, reading, explaining an idea | #F3EDE2 | #FBF8F2 | #1B1A17 | #6B655B | #C8402F | #2F5D62 |
| `poster` poster yellow | opinions, conflict, science that needs one line to land | #FFD23F | #FFF6D6 | #111111 | #4A4433 | #FF5A36 | #14213D |
| `ink` deep ink | tech, night scenes, serious topics | #121417 | #1E2226 | #F2EFE8 | #A39E93 | #F2B33D | #5FB3A1 |
| `navy` navy | products, data, phones and electronics (flat, no gradient) | #0D1B2A | #16293D | #EEF3F6 | #8FA3B3 | #5CC8E0 | #F2A93B |
| `bauhaus` | design, structure, geometry, process | #EFE9DD | #FFFFFF | #111111 | #555555 | #D62828 | #1D4E89 |
| `snow` | winter, medical, clean, labs | #E9EEF0 | #FFFFFF | #1F2A30 | #5E6B72 | #D9482B | #3E7C8C |
| `wood` warm wood | life, kitchens, handcraft, home matters | #EDE3D1 | #F7F1E6 | #2B2622 | #7A6E62 | #C4552D | #3F5B4B |
| `chalk` blackboard | classroom, derivation, formulas, teaching | #23302B | #2E3D37 | #F1EFE6 | #A9B3AA | #F4D35E | #E87D5A |

## Defining your own

- 3–6 colors: one background, one surface, one main text color, one secondary text color, one or two accents. An accent marks one thing per shot.
- Fix the background first: light base (paper, snow, wood) or dark base (ink, navy, blackboard) — the film never jumps between light and dark.
- Keep hex values out of the blue-purple zone: hue 225°–300° with saturation ≥0.30 never becomes a background or a large area. `storyboard_lint` checks palette values; landing in this zone is a red light.
- No gradient backgrounds, no neon outer glow. Layer with paper texture, grain, or two flat tone layers.
- With real material (screenshots, photos), take one or two accents from the material; the background stays with this set.

## Self-check

Before delivery, lay the extracted stills in a row and look: is the background in one brightness band from start to finish, are there only those one or two accents, and did any shot suddenly sprout "another film's colors" — a white-background bar chart, a purple starfield, a neon border? If so, repaint that shot to the palette.
