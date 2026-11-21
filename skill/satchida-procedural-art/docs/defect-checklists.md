# Satchida Procedural Art · per-style defect checklists

Real failure modes observed per style. After rendering, open the picture and check every item for the style you used; fix the most visible problems first — typically 2-4 rounds.

English translation of the upstream defect list (section 3 of the original skill book). Every entry
was a failure that actually occurred; the right column is the fix. Method names are code identifiers
and unchanged.

## General checks (every style)

- **Plan the composition first.** Depth layers far → mid → subject → foreground.
- Decide where the visual focus sits.
- Keep enough negative space: ink wash at least 40% empty; watercolour and paper-cut also need room to breathe.
- One or two accent colours only: ink wash uses vermilion, paper-cut one bright hero colour.
- Decide where the inscription or paper label goes.
- **The picture must illustrate the actual content**, not be a random landscape.

## Ink wash (inkpaint.py)

| Problem | Fix |
|---|---|
| Far hills behind show through the main peak | Far to near; `wash` occludes what is behind it by default |
| Brush strokes read as ladders or beads | Landing spacing tied to bristles (`bristle_stroke` already handles it) |
| Paths read as hairs, or polylines as cracks | About 16 of them, smoothed with `spline`, painted only on the mountain, emerging from the mist |
| Texture strokes read as scattered commas | About 150 strokes, long and following the slope, concentrated on the shaded side |
| Ridge reads as a cartoon outline | Ridge line in pale ink (0.3) with flying-white; edges come from the wet rims |
| Pine needles read as a sea urchin | Fan-shaped needle tufts over a soft pale-ink wash |
| Main peak reads as an awl | Left and right slopes of different widths, plus shoulders and undulation |
| Far hills punched out as blocks with hard broken edges | Reserve the water with "mounds rising from below the water line", never by carving out a stretch |

## Watercolour (watercolor.py)

| Problem | Fix |
|---|---|
| Tooth reads as sandpaper or a scraped wall | Tooth lighting about 0.3, and the tooth fine |
| A dark ring in the leaf's middle reads as a bullseye | The second dark layer wet (soft about 16), pooling to one side, never concentric |
| Leaf stalks painted onto the leaf surface | Stalks first, clipped by `*(1 - leaf mask)` to outside the leaf only |
| Colours go muddy | No more than three glazes in one place; leave the lights as paper or lift them with `lift` |
| Dark masses drift outside the crown as isolated dots | Later glazes multiply by the first crown mask (slightly grown), darks pooling only inside |
| Branches tangle into a mess | Only 3–5, rising from the trunk outward into the crown, lengths set from the crown size |

## Paper collage (papercut.py)

| Problem | Fix |
|---|---|
| Large crayon texture reads as full-screen scratches | Big colour blocks use paper / kraft; crayon only for accents or small things |
| The torn paper's white rim is invisible | The rim must be 5–8 px wide (large-radius blur with a low threshold), and only on part of the edge |
| An extra shadow band along the top or left edge | Shadow offsets must not use wrap-around translation, which joins end to end; use zero-padded shifts (fixed) |
| The moon drawn with rays looks like a sun | Moon = crayon halo plus a few sparkles, never radiating lines |
| Faces too coarse and fierce | Line width about r×0.035, blush with `glow` |
| Little birds read as a blob | Birds are two thin arcs (width about 2.6), never a very short heavy stroke |
| Pieces cut off by the frame's edge | Subjects like clouds and balloons stay fully inside the picture, with margin |

## Coloured pencil (Korean style) (colorpencil.py)

| Problem | Fix |
|---|---|
| Colour so pale it is barely visible | Hatching dense enough (saturation builds with layers); do not clamp the grain threshold hard — use `pressure` to control how deep it presses |
| Cream, white porcelain and other white objects vanish | A warm milky-white base with pale violet-grey or blue-grey shadows, plus a little white highlight |

## Anime (anime.py)

| Problem | Fix |
|---|---|
| Clouds are perfect round bubbles with straight diagonal terminators | Irregular masses, many and varied in size; the shadow side is the crescent of "mass minus itself shifted toward the light" |
| Legs too long | Skirt hem to about the knee; visible legs about a third of the height |

## Editorial (risograph) (editorial.py)

| Problem | Fix |
|---|---|
| Blocks dead, like computer vectors | Every spot layer needs grain, uneven density and a few px of mis-registration |
| Too many colours | 4–5 spot inks; other colours from overprint (cyan over yellow is green) |

## Impasto oil (oilpaint.py)

| Problem | Fix |
|---|---|
| Strokes read as plastic tubes or plasticine | Restrain the relief: flat-topped ridged sections, highlight about 0.1, lighting range about 0.8–1.18 |
| Lots of bare ground between strokes | Ground strokes denser (density about 2), wide brushes filling first, then fine ones |

## Ukiyo-e (ukiyoe.py)

| Problem | Fix |
|---|---|
| Cloud bands semi-transparent, outlines showing through | Cloud bands on an opaque block (strength over 1, fully covering) |
| Title cartouche collides with cloud bands and the subject | Cartouche in empty sky, other elements making way for it |

## Pixel art (pixelart.py)

| Problem | Fix |
|---|---|
| A black band at the bottom of the background | Sky gradient and buildings both laid to the ground line, no gap |
| Glows become big square blocks of dots | Glow radius small (about 20 px), strength 0.4–0.5; flatten neon glows a little |

## Stop-motion clay (clay.py)

| Problem | Fix |
|---|---|
| Finger-smeared sky reads as crumpled foil | Wide fingerprints (40–70 px), a moderate count (200–350 strokes), soft low ridges (`smear` height about 4); lay several colours first, then smear, so the drag shows |
| Straight rectangular colour edges in the sky | Non-tileable noise must not be wrapped modulo — take windows inside the noise map (fixed) |
| Pre-laid colour blocks too hard-edged, still blocky after smearing | smoothstep transitions between colour blocks, then finger smear |
| Surf like rows of identical wallpaper patterns | Every wave's length, height and spacing random; only two or three rows, bigger nearer |
| Whale like a loaf of bread, tail flukes like two separate sausages | Round head, body narrowing backward into the water; flukes one whole wing-shaped outline with a central notch |
| Foreground water bulges where the hidden tail stem sits | Parts follow the height below them by default; keep hidden parts from reaching too deep, or cover the waterline with foam |

## Cyanotype (cyanotype.py)

| Problem | Fix |
|---|---|
| Fern reads as a row of arrows or sawteeth (fishbone) | Each pinna one whole leaf with a crenate edge, plus faint little veins; never separate little leaflets |
| Pinnae as ellipses then read as a mimosa | Same as above — fern pinnae are joined |
| Dandelion fluff almost invisible | Filament opacity about 0.3, lift about 1; lifted too high it dissolves into the penumbra |
| Coat edges like burrs, torn paper or motion blur | Modelled as horizontal brush passes: each bristle stops cleanly in its own place, dry breaks from horizontally stretched noise (fixed) |
| Stems cross the white lettering | Lettering in reserved space, stems routed around it |
| Floating seeds cropped by the coated edge, leaving a line | Small objects land fully inside the coated area |

## Cross-stitch (stitch.py)

| Problem | Fix |
|---|---|
| Short diagonal lines (sun rays) snapped into rows of L steps | A short diagonal is one stitch, hole to hole (large `step`) |
| Half stitches stacked on cross-stitch like an overlay texture | Real stitching never does that: the lights are cross-stitched in a lighter thread instead |
| Chimney fully covered by the roof, smoke crossing the title | Work out the roof outline before setting the chimney's height; smoke as small half-stitch puffs drifting into reserved space |
| Fabric grid too black, like graph paper | Hole darkness about 0.34, block undulation about 0.065 |
| Flowers and pine overlapping | Count the columns each thing occupies on the grid before placing |

## Vintage instrument panel (panel.py)

| Problem | Fix |
|---|---|
| Lurex in the grille cloth reads as rows of dots, like a punched plate | Lurex wefts take long floats (over three warps before diving), the glint varying slowly along them |
| Scale units squeezed against the last digit | Units outside the scale's end, or write the full value (530...1600 kHz) |
| Pale silkscreen text invisible on pale grille cloth | Screen-print colours separated from the substrate in luminance |
| A big expanse of grille cloth flat and fake | Cloth is translucent: let the round dark shadows of the speakers behind show faintly |

## Sticker collage × receipt (sticker.py)

| Problem | Fix |
|---|---|
| Bread with one long slash, like a sweet potato or leaf veins | Three overlapping diagonal slashes: pale crack plus dark curled edge, then flour |
| Bouquet flowers as concentric circles, like bullseyes or lollipops | Side-view tulips: two pointed outer petals, one pale petal in front |
| Stamp's small text pressed on the inner ring | Centre text moved up, the divider at +0.16r, short small text, all inside the inner ring |
| Receipt text too black, like a typewriter not thermal paper | Grey ink #4f525a, density about 0.8, slightly fuzzy edges, broken-pin column streaks and feed density |
| The receipt's right half greyed in a band | Horizontal curl pressed very small, only the long edges' ends lifting |
| The paper's contact shadow reads as a drawn black line | Paper contact shadow down to about 0.26 |
| Stamp unreadable over the barcode | Stamp it over the sparse area round the amounts and asterisks, pressing a little type only — more real |
| Stamp ink too even, like computer fill | Add pressure tilt, large-scale density variation and missed pinholes |
| Tag text overflowing the die-cut circle | Shorter text, smaller size |
| A big empty patch in the lower right | Add the round stall-number sticker; the second tag hangs from a long twine |

## Lab notebook × stickers (notebook.py)

| Problem | Fix |
|---|---|
| Pencil lines like clean vector ink: thin, even, too black | Hand-drawn width about 3 px, wobble about 1.6; graphite only on tooth peaks, keeping some grain even pressed hard |
| Light hatching and table rules broken into dot rows | Coverage keeps about forty per cent continuous pale grey; grain modulates only the rest (`_graphite` handles it) |
| Chart data points as little circles, like the letters o and c | Compressed little pencil dots (a very small spiral, pressure 1) |
| Curve drawn in one perfect stroke | Two strokes, the join slightly offset and slightly overlapped |
| Labels on the curve, units colliding with ticks | Labels below the curve in blank space, a little pencil arrow pointing over; units above the axis end |
| Stickers floating under the chart, unclear what they mean | A pencil dashed line from the best point to the axis; the sticker on the same x |
| Label-maker tape cut with V notches, like a banner | Straight cuts, slightly slanted, small rounded corners |
| Coffee ring like a soap bubble or lens | A fine dark tide line round the rim, the inside almost evenly pale; the ring broken in places, deeper on one side |
| Red-pen arrow covered by the sticky note pasted later | The arrow stops outside the note's edge, or paste the note before drawing the arrow |
| The headline's highlighter start pressed onto the previous word | Start computed by letter width, landing on the target word's left edge |

## Chalkboard (chalk.py)

| Problem | Fix |
|---|---|
| Chalk lines like clean vector lines: solid at full pressure, smooth edges | Even full pressure leaves about 15 % pits (threshold 0.98 − 0.86 × pressure); the tip's contact blurred by 0.26 × width, so edges fuzz and break |
| CJK (Hei) a step thinner than Helvetica Bold; bold 30 px complex glyphs mush | CJK bolded by size, less added bold at small sizes; below 40 px automatic extra pressure with reduced grain and edge distortion (handled) |
| The font's bold ∝ closed up by the chalk into something like ∞ | Hand-write it with `propto()`: the lemniscate's left lobe plus two tails to the right |
| Atmosphere side-shaded into one sulky rectangle, covering waves and labels above | Pressure about 0.3, strength about 0.6, `weight` for the gradient (denser near the ground), long fades at both ends |
| Last lesson's ghost erased again by the big swipes, or pressed under the new lesson hurting legibility | Ghost keep 0.26–0.34, big swipes strength at most 0.6; ghosts in blank areas (top, corners, between title and diagram) |
| GIF palette from the last frame only: full-screen green eats the colour slots, pastel chalk and the spectrum bar greying | Palette by weighted pixel samples, median cut (colourful ×5, bright ×2), all frames sharing one palette |

## Cyberpunk (cyberpunk.py)

| Problem | Fix |
|---|---|
| Reflections flipped about one horizon line, positions all wrong; distance occluded by the near walkway a black hole in the reflection | Each object flips about its own ground row, nearest first; occluded holes filled with that row's fog colour |
| Ground-floor shops too bright and large, the near wall a blown flat colour, goods as blocks like mildew or bar charts | Shop interiors 0.2–0.45, decaying from the ceiling down, darker to the sides, shelf side-shadows and human silhouettes; the nearest block gets more shutters and vending machines |
| Rain uniformly brightened into a full-screen grey curtain, splash rings huge like bubbles | Each rain streak coloured by the light around it, visible only near neon; splash rings 3–11 cm, bright only in puddles |
| Steam lit by the dark scene behind it, invisible | Steam lit by light spill (like a pale surface) plus forward scattering |
| Light trails flying along the street, all converging on the vanishing point, like lasers or wires | Let cars cross the street: appearing from behind one wall, arcing over, vanishing behind the other; strobe points |
| The hologram jellyfish's 1 px lines eaten by fog and scanlines; the C-shaped gonads read as the digits "93", the rear pair like a pair of eyes (a face) | Lines at least 2 px; gonads on a horizontal plane inside the bell, side-view pressed into a soft pink band; the sub-line in Light weight, tear slices kept off the lettering |

## Hand-drawn cartoon (cartoon.py)

| Problem | Fix |
|---|---|
| The sun outside the window painted onto the wall | Everything in the window multiplied by the glass mask; occluded outlines drawn only over the visible arc (`ellipse_pts` with a0/a1) |
| Arms straight out of the head ending in a ball, like antennae or lollipops | Shoulders mid-side on the body; arms drawn before the body; bend's sign elbows outward; gloves with a thumb, cuff and two finger lines |
| Two characters too close, one's glove landing on the other's face | Draw only the outer arm; the inner one hidden behind the body |
| Toast crayon in the middle of the bread like a dirty face | Toast colour only round the crumb's inner edge (outline minus inset outline), the middle where the face sits kept clean |
| Tooth too coarse, blocks like sandpaper | Tooth lighting about 0.026, halved where paint covers (handled) |
| Sparkle stars like diamonds | Star lines with exponent about 3, stretched vertically (handled) |
| White type invisible on beige paper; white clouds, gloves and smoke all little white balls crowding together | Pale type only on dark blocks; white balls spaced apart, no white clouds in the background |
| Flying crumbs landing on the face | `crumbs(..., avoid=character mask)` |
| GIF 2.3 MB: the pencil rough re-jittering every stage, screentone and crayon jittering too, every cross-fade re-encoding everything | Only ink lines boil; colour and pencil rough stay still on the paper; the rough's strength fixed after inking; shadows and texture merged into one stage (1.9 MB) |
| Butter's face pressed on the baseline; drips tiny, the puddle a yellow strip | Faces scaled to the object's front height and moved up; drips one stream hanging from the front edge to the puddle, drawn last over the outline |

## Isometric 2.5D (isometric.py)

| Problem | Fix |
|---|---|
| White walls greyed overall, darker than the gable above them | The height map's AO counted the building's own height into the wall; sides instead sample the horizon along the normal (and ±40°), counting only what stands in front (handled) |
| Eaves and crowns treated as solid columns, a black ring at wall tops | The top-down map records the top and bottom of the tallest "column": joined solids merge, floating ones stand alone, blocking only the elevation they actually cover; no crease under the eaves (handled) |
| A jagged grey band on flat-roofed walls | Column tops / bottoms must not interpolate across edges: a thin cornice interpolated makes a false floating slab at the wall edge; nearest-neighbour sampling (handled) |
| Long shadows' penumbra full of grain | After PCSS's per-pixel rotated sampling, one depth-preserving separable blur (handled) |
| Short wave lines on the sea standing upright | In iso view world (1, 1) is screen-vertical; wave lines run along world y − x to be screen-horizontal (handled) |
| Mortar like brown pointing, beach joints like logs | Grass tiles keep grass colour on their sides, only terraces show soil; joints about 0.028 cells |
| The island fills its slab, the beach a checkerboard ring, no island to see | Leave 1.5–2 cells of sea along the two front edges; beach only along part of the shore |
| Satellite dish face-on like a lollipop or road sign | Aim off the view axis (yaw about 125°, elevation about 50°); the reflector dark in the middle, a bright rim (handled) |
| Data cards' text too small, sparklines crushing the units | Cards about 2.9 × 1.65 cells, big numbers about 0.7 cells tall; sparklines start after "value + unit" (handled) |
| Leaders crossing roofs, cluttered | Cards grouped around their instruments, placed by `unproject()` from screen position; short leaders, never crossing a subject |
| Scattered meadow flowers like coloured sugar beads | Flowers on shrubs: `tree(kind='bush', flowers=...)` |

## Continuous line art (lineart.py)

| Problem | Fix |
|---|---|
| Paper plane as a small triangle, like a kite or pennant | A 3/4 top-down dart shape: near wing large, far wing foreshortened, a crease between; the pen enters through the tail notch and leaves at the nose, four corners kept sharp |
| The flight path taking off from the valley floor and landing back, unreadable where it went | The line flies out through house A's window, crossing the wall at the nose into house B's window; no ground between the houses |
| The loop on the climb, like a balloon or lasso hanging on the line | Loop at the path's top where it is near horizontal, `curl(..., aspect≈1.2)` for a rounder loop |
| Flight path as heavy as the houses, taking off and landing near the ground, reading as hills | The flight stretch `pressure=[(s0, s1, 0.62)]`, drawn light, rising straight from the window without dipping first |
| The path's end hooking down into the plane's tail, sticking to the rear wing as a sliver | The tail notch's coordinates are the path's last control point, approach flattened to about 35° |
| Shapes that must be reached from inside (windows, shoulders) cannot be strung in one line; retrace stubs ending in blunt caps | `retrace()` out and back (invisible in the final); retraces automatically lift and taper (handled) |
| Crown hugging the eaves, the two glued together | Leave gaps between objects |
| GIF: banded rings in the deep-blue gradient, the only amber window quantised to beige | Split the palette: 110 colours for the empty ground, 145 for what is drawn (saturated ×6); a fixed 4×4 Bayer dither before quantising, identical every frame |

## Soft 3D (soft3d.py)

| Problem | Fix |
|---|---|
| Dropped balls hovering above the letters; inexplicable dark patches on the letters | AO, shadows and dropped-ball queries used box distance outside the bounding box, balls resting on invisible boxes; exact distance everywhere the glyph distance grid covers (fixed) |
| A ring of black balls at the letters' feet; a black band on the letters' lower half | The ball-field distance sampled only 2×2 cells capped at half a cell, so cleared pockets' AO thought balls were adjacent; 3×3 cells capped at a full cell, AO radius 0.3, strength 1.25, floor 0.1 (fixed) |
| Letters rising from the ball sea leave a ring of empty slots showing black floor, like a cut-out | Displaced balls are not deleted; they pile at the feet by "fall into the nearest free pocket, stack up, keep three-point support": `part(pile=10, pile_top=0.3)` |
| Letters buried too deep — the s shows only its top like a c, the word reads "rice" | Raise s and e separately with `bob` so the lower bowl shows; `part(pile_top=0.3)` stacking one layer, never above the letters' lower half |
| Mint balls in shadow going grey-green and dirty | Lilac skylight multiplied by mint greys: shadows add subsurface fill in each material's own hue, skylight stronger, key weaker |
| Balls in straight rows running to the horizon, like striped wallpaper | Rotate the whole scene 30° so rows run diagonally |
| Letter edges jagged, highlights banded | Final 1.5× supersampled then Lanczos down; glyph distance blurred 2 px, normal-difference step 2.5 cells (handled) |
| Upper third bleached, a hard horizon between distance and backdrop | Fog colour equals the backdrop's horizon colour, fog distance about 42; raise the camera a little to show the sky gradient |
| GIF 3.4 MB, little yellow balls quantised into flat patches | Depth of field set with the camera first (soft in every stage), exposure folded into light strength, key and rim merged into one stage; palette samples colour ×5 |

## Shape morph (morph.py)

| Problem | Fix |
|---|---|
| Start points and winding unaligned, middle frames collapsing into shards | `normalise` first (same point count, clockwise, from the top), then `align` (FFT cross-correlation for the best start); a keyframe chain aligned in turn by `chain` |
| Five ghosts per transition with keyframes too large: snowflake and cloud lace ghosts piling into noise | Keyframes about sixty per cent of the panel width; only 3 ghosts per transition, the middle filled about 0.42, the sides thin lines with about 0.14 fill |
| Motion path as dots, confused with the matched points on middle frames, reading as a looping trail | Trail dashed (`trail(dash=)`); dots only mark matched points, listed separately in the legend |
| Speed lines equal length and spacing, like a ladder; by the river mistaken for water flow | No speed lines on the poster — speed from squash & stretch and ghost spacing |
| Tooth covering the cream clouds like sandpaper | Shapes stay pure flat: tooth only on exposed paper (`tooth` mask); panels and shapes carry only the slightest print grain |
| Closed splines overshooting right angles — a bump at the wave's bottom corner; the sun's thin rays as disconnected sticks | Spline only the curved parts, straight segments joined by lines; rays wedges with round caps, unified with the disc then outlined |
| Later ghosts over the earlier keyframe; labels drawn twice, darkened | After the ghosts, redraw the earlier keyframe (its in-shape details only); text and out-of-shape accents drawn once |
| "↺" has no glyph in the chosen CJK hei font, showing tofu | The loop arrow drawn with `outline` arcs plus a `chevron`, direction the tangent at the arc's end |

## Newspaper collage (newscollage.py)

| Problem | Fix |
|---|---|
| Gear like a grey biscuit: teeth as bright as the background, the window greyed by shadow, teeth finer than the halftone | Tooth face albedo about 0.56, metal 0.3, lathe-textured "bowtie" glints; lift about 8, background shadow 0.35; tooth pitch at least about 4 halftone dots (36 teeth at r=108), cut margin about 9 px |
| Mainspring as concentric circles, like a target | 4–5 turns, `flare` about 1.6: tight inside, loose outside, so it reads as a spiral |
| Typewriter font missing "→", showing tofu | Per-character glyph checks, missing glyphs falling back to a CJK hei (handled) |
| The question-mark clipping covering the clock's dial digits | Position from the previous letter's Frame, the title row smaller; the subject shifted right to make room |
| Red stamp on dense newsprint type, unreadable | Stamp it on the kraft paper's empty area |
| Postmark's ring text breaking as "CUR:OSTI" | Ring text at least 18 px; the stamp's misses as partial ink loss (0.3 + 0.7 × keep) so fine strokes never break (handled) |
| The cut photo's white margin even all round, like a die-cut sticker | Margin width wandering slowly along the perimeter (`wander` about 0.45), never cutting into the object (handled) |
| Scattered parts unreadable as flying out of the clock | Draw a few dashed arcs from the gap before placing parts, starts staggered so they never converge to a point; the nearest screw right by the gap |
| Clipped letters with neighbours: neighbours too big and black, stealing from the main letter | Neighbours about 0.075× size at density 0.62, a clear ring of space round the main letter |
| Newsprint show-through too heavy, the mirrored headline like a render error | Show-through opacity about 0.045, blurred 1.4 px |
| Kraft fibres too long and black, like cracks or hairs | Fibres 4–20 px, dark ones at density 0.2 |
| GIF palette filled by kraft and newsprint, the mustard slip going ochre | Palette sampling counting highly saturated pixels ×5 (colour error 24 → 2.7 / 255) |

## Aurora glassmorphism (aurora.py)

| Problem | Fix |
|---|---|
| The front card covering the rear card's text ("Wednesday", "60%" cut in half) | Cards overlap only within each other's padding (never past it), text kept away from overlaps |
| The list's last row colliding with the bottom buttons | Compute the list's total height from the row pitch (about 84) first; buttons placed up from the card's bottom, grow the card if needed |
| Glass too "milky", like frosted plastic, nothing showing through | Milky tint about 0.24 (thicker toward the light, thinner away), saturate about 1.5; backdrop pools need enough hue separation |
| An orb just touching a card's edge, like sitting on top of it | Let orbs press genuinely 30–40% behind the glass — the blurred half is what reads "through glass"; never tangent to the card's edge either |
| Backdrop pools and ribbons almost fully hidden by cards | Ribbons routed through the gaps between cards, pools slightly more saturated |
| Sparkline's area fill ending as a blob of purple fog | Fill alpha about 0.16, fading over 22 px at each end (handled) |
| Bars too thin, empty full-height slots like ghost bars, "1" reading as a minus | Bar width half the pitch, empty slots alpha 0.1; x axis dates plus "Today" |
| GIF palette taken by the pale background, gradient controls quantised to grey, orbs contour-banded | Palette samples weighting saturated pixels (×6 / ×3, dark ×4), every frame adding the same 4×4 Bayer (about ±2.4 steps): identical per frame, so the "same as previous" transparency diff still works |

## Bauhaus geometric (bauhaus.py)

| Problem | Fix |
|---|---|
| Grain too heavy (about ten per cent bare paper), blocks like sandpaper, type like a worn rubber stamp | Bare-paper pits kept to about 2%, only in the squeegee's thin-film streaks; black least (GRAIN 0.4) |
| Pits clustered, like evenly scattered snow | Tooth as pixel-level white noise plus a few clusters; ink film also carries about ±2.5% density micro-texture, not relying on bare dots alone |
| Squares' right angles rounded | Plate edges only a 3×3 light blur plus noise threshold, never a large-radius blur |
| Margin small type, pencil edition number and colour bar over the crop marks | Left from x≈86, right to x≈1834, the colour bar's end at least 40 px from the crop line |
| Overprint colour bars all showing the top colour | Screen inks are near-opaque; overprint colour bars default off (`overprints=False`) |
| Black annotations unreadable on blue | Annotations on dark blocks knocked out of that plate (`knock=`), showing paper |
| "60°" degree mark too far away | Degree marks auto-tightened 0.1 em (`_KERN`) |
| Title colliding with the lecture details top right | Lay out each column's width by the 120 px module first; keep the details line short |

## Retro synthwave (synthwave.py)

| Problem | Fix |
|---|---|
| Sun blown to white by bloom, slits filled in by the halo | Sun base pressed to about 0.72, emission level about 0.4, letting bloom lift it back; slit thickness from 0.2 to 0.7 of the band pitch |
| Thin streak clouds crossing the sun like extra slits | No `streaks` in front of a slit sun; thin clouds only outside it |
| Sea reflection a smeared blob, like another sun underwater | Cut the water into horizontal bands by world depth, each band shifted sideways and randomly stretched or compressed about the sun's column (chaotic nearer), modulated by dashes; the light source's reflection about 2.4× the sky's |
| The far grid a flat orange fog band | Fog distance 150 m, fog darker and magenta-leaning; grid coverage computed in screen px, cells under a few px replaced by the average, never moiré |
| Tape noise like canvas texture, lines jittering and kinking everywhere | Noise about 0.014, stretched sideways; per-line jitter about 0.35 px, only one tracking band and the bottom's head-switching noise |
| Neon script's white core too thick, whole lines reading white; random dead tubes like render errors | White core only at the very middle of strokes, core about 0.5; dead tubes off by default |
| Palm crowns like firs, then like flat umbrellas | Frond elevations evenly spread from steep to average, two drooping dead fronds; leaflets sweep forward toward the tip in 3-D, splaying sideways before drooping, never hanging straight down |
| City placed in front of the wireframe mountains, dark on dark, towers like ghosts | City beside the vanishing point backed by the sunset's afterglow, mountains starting to the city's right |
| The island blocking the sun's lower half, eating the brightest reflection | The island only just overlapping the sun's left edge |
| Stage snapshots showing solid orange below the horizon, the sun's lower half on the ground | `sky()` lays an unlit dark ground first; the sun clipped at the horizon |

## Perler beads (perler.py)

| Problem | Fix |
|---|---|
| A solid dark-grey rectangle round the pegboard | Bead heights written only where beads cover (elsewhere -1e3), never lifting the whole window to board height |
| Ironed beads still separate donuts, barely different from unironed | `melt` controls together: outer radius +22%, smooth-min fusion width to 0.55 bead pitches, holes shrunk 74%, height down 40%, rim and hole chamfered separately; 0.4 half-melted (holes remain, beads fused, diamond gaps), 0.7 finished |
| Ironed coaster like hexagonal nuts dusted with icing | Seams only while half-melted (×(1 − m/0.7)²), the top keeping 5% pillow relief, ironing paper micro-texture 0.08 px |
| Tray beads stacked into towers | Loose beads land on what is below but capped at about one layer (`cap`); about 20 per cell on a jittered grid |
| Tweezers like chopsticks or strips of paper | Legs in a V, closed at the tail, open a bead's width at the tip, leg width 1.5→4.9 px; steel darker, reading as metal through brushed streaks and a narrow light-box reflection; the floating layer casting its own shadow |
| White beads' side walls with vertical stripes and stalactite jags | Side-wall AO and shadow sampled from the smoothed map inside the wall foot and wall top; wall top taking the max of the nearest rows; steep anti-aliased slopes shaded as walls |
| Hairline streaks on the ironing paper (a gentle slope) | Camera-facing gentle slopes stretch one row to about 1.1 screen rows; only over 1.5 counts as a wall |
| Highlights invisible, or a white ring on every bead | Use the light-box reflection: specular only when the mirror direction falls within 8° of the key (wider when rougher), giving two arcs — the upper-left rim and the far lip inside holes; Fresnel weight pressed to 0.08 |
| Ironing paper covering the label, its text going translucent | Later covers earlier; `on_top()` lifts the label and coaster to the top |
| The chart's pencil ticks crowding the previous column's count; dark green and leaf green both printed as G | Ticks directly on the bead icons; symbols printed as-is, never upper-cased |

## Petroglyph (pecked sandstone) (petroglyph.py)

| Problem | Fix |
|---|---|
| Desert varnish like wood grain, like a hanging striped curtain | No full-canvas vertical stripe noise; the film near-uniform (0.86 ± 0.09), seep streaks separate objects: mostly starting at the top, narrowing and paling downward, drifting slightly, edges ±2.5 px |
| Seep streaks like a barcode (hard-topped black rectangles) | Streak tops fading in over 50 px, length fading over the last 30–100%, never painted down from a hard-edged rectangle source |
| Streaks smearing into smoke puffs hanging under the sheep like shadows | Never whole-map bicubic-upscaled into soft blobs; only ±2.5 px of transition sideways, smooth vertically |
| Streaks like matchsticks or reed blinds | Widths log-normal (median about 18 px), about 110 of them, thickening the varnish only 0.2, manganese 0.6; plus about 26 wider pale streaks (varnish washed thin) |
| The thin-varnish "windows" as camouflage blotches | No blocky windows; pale areas also vertical seep streaks |
| Pecking too sparse, glyphs like sprinkled chalk dust | Pit count ≈ 3.4 × glyph area / pit area; depths saturate when summed (dmax ≈ 2.9 px), interiors full with only small dark seams, outlines ragged at one pit's scale |
| Sheep elongated like sausages, the herd joined end to end into a band | Deeper bodies (−0.20 to 0.15 of length), thicker necks; rams one row, ewes and lambs another, spaced apart |
| Spalls like pasted smooth ellipses ringed in black | Outline broken into 14–40 px segments, each curving inward into little shell arcs; AO weakened (depth 2.4 / 7 / 22); scar grain halved, fresh orange with iron banding, a ring of pale weathered rind at the lip |
| Lichen like green paint dots, like coins | Low-saturation olive, ellipses with irregular lobed edges, crackle, little black apothecia, satellite dots around, alpha about 0.7 |
| Sun spiral's centre as an "f", rays floating far from the spiral | Spiral starts at 1.4 rad and 10% radius, the centre a single small dot; rays start 1.7 line-widths beyond the outermost ring |
| Hoofprints like equals signs or random dots | Both lobes converge toward the centreline from heel to tip into a heart (size ≥ 30 px, peck size 0.66); the first print well clear of the sheep |
| Child's handprint smudged | Handprints ≥ about 95 px, peck size 0.62, density 1.2, for fingers to separate |
| Bare sandstone like a plank (bedding like wood grain, pits like nail holes) | Bedding amplitude halved and intermittent; stone colour varying only 1–3% by bedding; pits become 7–26 px shallow saucers |
| A black band at the top and left edges | Pad the height map with edge replication before shadow marching (zero-padding beyond the edge casts a wall's shadow) |
| The ledge reading as one crack | A 34 px step gives a visible under-ledge shadow; a kinked ledge line + slight rounding |
| New and old pecking only "brand new" and "ghost" | Add the middle age 0.3 (crescent, tallies, the atlatl hunter): 0 fresh, 0.3 centuries, 0.6–0.7 almost re-covered |
| GIF: olive-green lichen quantised to grey | Reserve 6 palette slots for greenish pixels; the "same as previous" placeholder uses magenta |

## Egyptian tomb painting (tomb.py)

| Problem | Fix |
|---|---|
| The bending figure still frontal wide-shouldered, the rear shoulder above the head, the arm across the chest like a sash | Shoulder width narrows sideways by the lean (at 32° lean only about 15% remains), both arms leaving the chest; seated poses take `turn` directly |
| The squatting scribe's feet rotated 180° soles-up, arms tangled | The tucked foot mirrored (`mb=True`, toes backward), elbow IK always bending downward, `turn=0.45` narrowing the torso |
| Plaster losses like pasted brown flakes with a shiny white rim | Built as a real height map: 8 px deep holes, low-angle light marching shadows (a shadow band on the upper-left inner wall), AO at the hole's near floor; the gypsum rim only 2–4 px and intermittent, paint around the mouth flaking in steps |
| The ground wash covering the red sketch inside figures, losses showing only yellow ground | The ground wash is brushed around the shapes to be coloured (`ground(around=True)`): the red sketch survives until the colour step in the animation; losses on figures show the red grid and sketch on plaster (`age(zones=...)` can pick spots) |
| Every worker in a broad collar, master and labourer indistinguishable | Only the overseer and the scribe wear collars; labourers bare-chested, some with cropped hair (`wig='cap'`, ears showing) |
| Hieroglyphic numbers ∩‖ read as "ΛI": the stroke hidden behind ∩'s legs | 0.78 em after each ∩, strokes 0.3 em apart, size 46 px and up |
| The grain sack's centre crease like a smiley | The crease moved to one side of the sack, running vertically |
| The fig tree's crown as a grid of dots, like polka-dot cloth | Pointed leaves in rows, staggered, the next row covering the last (like scales), greens alternating by row; the waterskin on a cut branch |
| The hoeing figure pushing a stick, the measure like a book | The hoe as an inverted V: both hands on the shaft, a wide blade lashed at the top slanting into the soil, a rope tie in the middle; the measure a tapering wooden bucket, grain heaped at the mouth, tilted and pouring a stream |
| The carrying figure's hand at the forehead, the sack over the face | The rear hand raised to hold, the load on the rear shoulder behind the head (z between torso and raised arm); part details' z offsets only +0.002, or the basket's weave jumps over the arm |
| Egyptian blue like wormy noise | Blue and green as sparse bright crystals over dark grains (`T_cryst`), the generic grain pressed to 0.05 |
| The ground wash's diagonal brush strokes tiled across the wall, like rain | Two directions, intermittent by large-scale noise, amplitude 0.012–0.015 |
| The tide line like a pen line crossing figures | A soft band about 0.012 H wide, the upper edge slightly clearer, browning downward |
| GIF 3.7 MB (whole-wall grain re-encoding half the pixels each cross-fade) | Keyframes smoothed 1 px gaussian first; at quantisation, colours within 10 steps of an already-displayed colour keep the previous frame's index (the transparency diff still works, self-checks still per-frame) → 1.85 MB |

## Roman mosaic (mosaic.py)

| Problem | Fix |
|---|---|
| Stones like puffed pillows, the whole floor like rubble | The ground is polished: stone tops only 1.5–2 px high, bevel radius about 1.7 px, diffuse 0.45 + 0.55; stone-cut jitter 4.5%, chipped corners 20%, rotation ±1.6° |
| Pale blue and pink stones mixed into a grey fish body | Stone matching compared in the opponent space "lightness + red-green + yellow-blue", chroma weight 2.6, jitter mostly on lightness (handled) |
| The contour row too wide and long (about 13 px deep instead of 8), the second contour row never laid | The ridge-line max-filter radius checking "is there another row inside" was smaller than the row pitch, so every row thought itself last and widened inward: radius 2 × row pitch (fixed) |
| The wave border's whole ring missing, only white rows left | The local period was multiplied by the band height twice, waves drawn thousands of px away: period / (1.5 × band height) then × band height |
| The border's waves as thin S lines, like scrollwork not waves | The wave body is a solid mass growing out of the black frame, the crest curling back along a tapering heavy line, leaving a white "eye" |
| The furled sail on its yard like an umbrella | A square sail hanging from the yard bulging to one side, vertical reef lines in pale stones |
| The little gull ringed by two halos, like trapped in a bubble | Everything takes one halo ring; the second only for large figures (boat, lighthouse, tabula, net, octopus), measured with the first ring included |
| Fish in the net cut to fragments by the net lines, unreadable | Fish laid first (eye, gill lines, contour, fill), net lines after, breaking automatically against fish |
| The stolen fish too small and against the net, the theft unreadable | The fish about 150 px, dragged outside the net, the octopus's longest arm curling round its tail |
| The sky's lacuna like a grey plus sign | Lacunae in the border and sea, against cracks; the old mortar bed darkened and warmed, leaving stone sockets |
| Red crumbs at the tabula's ear tips, small text like dashes | After filling ears, only holes larger than half a stone are tucked (`tuck(small=0.55)`); letter stones at cap height / 5.6, never under 5.6 px |
| GIF 3.2 MB: the last cross-fade changing everything | Stage snapshots and the final frame rendered at `stage_ss` (same resolution); patina only in patches, never darkening the whole; pixels within 10/255 of what is on screen treated as "unchanged" → 1.57 MB |
| GIF: golden flames and rays going pink-orange | Palette split in two: saturated pixels sampled evenly across 12 hue sectors, median-cut 48 separately, 207 for the rest |
| Peak memory 2.6 GB | 2× rendering in 96-row bands; the sketch, noise and crack maps kept at 1× and upscaled per strip; paint / shade / sinopia computed only inside masks' bounds → 1.35 GB |

## Stained glass (stainedglass.py)

| Problem | Fix |
|---|---|
| Lead like semi-transparent grey pencil lines | Halo over lead kept to about twenty per cent, lead pressed to about #2c2d31 (handled) |
| One streak crossing several neighbouring pieces like a filter | Each piece takes a different position in the sheet: streaks given a random phase per piece, direction random per piece too (handled) |
| Each canopy clump its own sheet, lead ringed round circles, like soap bubbles or grapes | The whole crown one `glass()` call (greens randomly distributed to pieces); the clumps' volume from paint: a shaded crescent, a run of scalloped trace along the lower rim, leaf shapes scratched out of the matt on the lit side |
| Little leaves traced round, collapsing into tangled lines at scale | Shade side solid leaf shapes (opacity about 0.8) with veins scratched out; lit side leaf shapes scratched from the matt |
| Twigs also cut as glass, two leads sandwiching a brown line like a ladder; the winter tree one "Y" | Glass cut only for the trunk and branches 16 px wide or more, big branches bent; finer branches and twigs `trace`d onto the sky |
| An extra ring of radial pieces round the sun, an extra circular lead at the rim | Region boundaries are always lead: one sky, one `glass()` call |
| Swallows like jets | Swift silhouettes seen from below: sickle-shaped swept wings, a short body, a deep forked tail |
| Saddle bars crossing exactly through the robin's head and nest | Set bar heights first (286 / 490 / 694 in the example); bird, nest, sun and lettering avoid them |
| A copper wire knot at every lead crossing, bars like stitches | Only a few knots per bar (handled) |
| A label band cut in the middle, lead through the letters | Short labels' band one whole piece |
| The trunk cut into bamboo segments | Trunk and large branches elongated vertically (`aspect=1.8, angle=π/2`) |
| The painted branch showing through the canopy assembling with the painted leaves into letter-like black blocks | Painted branches only where sky shows (`trace(..., clip=)`) |
| The whole window dark and dull after leading | Glass darkened under lead only 4.5 px at 0.22 (handled) |
| Images differing with and without `--stages` | Noise and bubbles that formed at render time now seeded at construction, so snapshots no longer shift the random stream (handled) |
| GIF 3.3 MB: wall spill following the window each stage, the whole wall re-encoded every cross-fade | Before `daylight()` the wall uses fixed neutral spill; cross-fade pixels with colour error ≤ 18 (keyframes ≤ 6) keep the previous frame (1.8 MB) |
| Small shapes allocating full-canvas arrays for blur and masks: 44 s, 1.6 GB | `matt / shade / circle / ellipse / poly / saddle_bar / lancet` computed inside bounds only (about 4 s, about 1 GB) |

## Illuminated manuscript (illuminated.py)

| Problem | Fix |
|---|---|
| Vellum like a scraped wall or stucco | The cover's fine grain leaked under the pages: cover relief only on exposed cover; skin relief low-frequency only (scale about 240 px, amplitude about 6 px, doubled near the page edges) |
| Body text overflowing into the roundel; the rubric headline squeezed onto two lines | Measure with `text_width` before writing: at x-height 18 px a line is about 45 characters, keep headlines short; position the diagram only after counting the body lines |
| The narrow column beside the initial justified with cavernous word gaps | Stretch capped at 2.2 word spaces; then hyphenate by Latin syllables (handled), else left-align |
| Burnished gold like yellow paint with horizontal straw streaks | Gold is a mirror, its colour the room it reflects: put the flat's reflection on the window light's slope (window direction z≈0.8), give the gesso large-scale polishing relief (scale about 60 px, ±2 px) for the light bands; the burnishing streaks' amplitude to 0.04, gold seams 0.12 |
| The same gold bright on one page, olive-black on the other | Camera pulled back (z≈6000, near-orthographic), shading from surface normals only, never drifting with screen position |
| The astrolabe's rete too heavy, covering the plate, unreadable as an astrolabe | Slim the rete (ecliptic ring 0.06R, beams 0.017R, star pointers 0.024R), add an azimuth circle (through zenith and nadir, drawn above the horizon only), ink 0.75 px at opacity 0.85 |
| Planet names in the roundel stacked in one column | Each name written along its own ring, angles staggered into steps (150° → 36°) |
| Venus in the sphere roundel covered by ultramarine | Gold first, colour after; paint masks multiply by (1 − gold), avoiding gilded areas |
| Ivy leaves like little gold bells pressed onto text and border bars | Leaf shapes need two sharp side points and deep notches; before placing leaves, flowers and gold beads: leaf tip and side points at least 9 px from text, at least "leaf length + 3" px from border bars; tendrils must not bend back through a bar |
| The initial's white dashes like hand-drawn pluses | Drop the dashes, keep the white mid-stroke line and the three-dot groups |
| The secondary initial's red tendrils pressing into the red headline like fishbone | Tendrils 16 px left of the letter; hooks only toward the margin, alternating lengths, curled ends |
| Show-through too heavy, like a render error | Show-through opacity 0.03, blurred 1.6 px |
| GIF: rose and gold quantised to brown | Palette sampling counting saturated pixels ×5 |

## Leonardo codex (codex.py)

| Problem | Fix |
|---|---|
| Hatching like a curly mop, like waves | Never cut one long hatch into a chain of individually bent strokes; the hand hatches row by row: one level's strokes share a set of slightly offset row boundaries, long strokes breaking only there, 0–2 px gaps or overlaps; jitter down to 0.1, all strokes bending to the same side |
| Membranes blacked out like curtains | Each membrane's tone from `between()` — a 0→1 field from the front rib to the rear one, value t²: blank at the front rib, hatching from the rear, crossing only deepest, so the membrane bulges |
| The wing's trailing edge bulging in segments | Bat-wing membranes sag inward between spar tips; mirrored to the left wing the normal flips, so the bend direction is decided as "toward some point inside the wing", never hard-coded left or right |
| Wing stubby and round like a sail | Finger-bone spars fanning from the wrist, the tip pulled to a point, chord shortening outward |
| Red-chalk wing like a comb or fringe | Feathers never fully outlined: only the vane's outer edge, a round tip and the covert's tail segment (`overlapped=True`), one overlapping the next; tips round, never pointed; primaries longer than secondaries, the outer few spread about 7° as "fingers"; hatching near the vane edge (the shadow cast by the feather covering it), coverts as rows of small arcs rubbed open |
| One feather like a veined leaf | Barbules every 2.6 px, very fine and light, slanting toward the tip; add a bare rachis stretch and two barble gaps |
| Fan hatching intermittent in patches | Do not land tone exactly on the hatching threshold (noise flips it half in, half out); give evenly hatched areas shade clearly above the threshold |
| Stylus guides crossing the whole page like scratches | The compass scores only short arcs where needed (wing tips ±12°); centre and shoulder lines may run long; incisions are colourless, reading only in raking light |
| The crank like an L-shaped iron plate | The crank arm gets a boss at the axle, the wooden handle longer and thicker, with dot-dash lines showing it sliding along the axle |
| Exploded-view parts colliding with the wing | Work out the projection first: camera azimuth to +22°, the axis reaching lower-left, axis shortened to 250, the crank landing in blank paper |
| Old paper too clean, like fresh print stock | Besides foxing, large soft yellowed clouds (unevenly aged sizing); foxing needs a clear small core, never just a blurred halo |
| Foxing halos cut into squares | Each spot's compute box sized by the halo radius (about 7× the spot), not the spot itself |
| Ink going grey | Iron-gall leans warm: amber-brown thin, deep umber thick, crossings darker; paper fibres softly breaking the lines |
| The bird sequence just a run of "V"s | Each bird a body, tail feathers, wrist kink and spread primaries, flapping one up-down cycle per `phase` |

## Silhouette (silhouette.py)

| Problem | Fix |
|---|---|
| Ringlets as stacked ellipses, like grapes | `ringlet()`: one long strip swaying side to side, bulging per turn, thinning downward (about 5 turns); shell gold only one short diagonal stroke per turn |
| Hair shell gold as random little arcs, like bubbles; ten even parallel lines read as a striped helmet | About six strands of varying length, combed from forehead to nape along the mass, width about 2 design units |
| The hat brim an even straight strip, like a stick skewering the head | The brim `snip`ped along an S centreline: thickest at the crown (about 22), tapering to 3 at both ends, the front edge tipping up, the rear drooping |
| Crown gathers converging to a point, like a tent | Gathers as short non-crossing arcs; the crown's top edge `scallop`ed into a row of little bulges for the gathered look |
| The bow as two rings with round holes, like glasses, half hidden by the brim | Rings stretched to ellipses, a narrow slit cut between (about 0.12 wide); placed above the brim against the card |
| The cat tall and narrow with a tiny head, like a bowling pin | `sheet(warp=)` rescales without re-coordinate-ing: the head 1.12× and lowered, the body pressed to 0.62 toward the cushion, hips widened; then cut the eyes and the gaps between legs |
| The ship's two triangular sails overlapping and covering the jib; mainsail and spanker one black mass | The second sail wholly right of the first's trailing edge; the mainsail's lowest course furled (a row of little curls under the yard); the spanker tucked under the main topsail; at least 14 design units between yards; sails keep sharp points, only trailing edges bulging |
| The frame's outer rim's red bole worn into large brown patches | Bole shows only on crests: noise scale 5 px (2× sampled then ×2), threshold 0.66–0.80, strength 0.6 |
| Name and small text touching the black outline band | The ellipse narrows downward: compute hw = rx·√(1−(dy/ry)²) per line before sizing; name 32 px, small text at most 25 characters |
| Wallpaper stripes ruler-straight and crisp, like modern printing | Plate masks drift about ±0.9 px sideways, the cream ink at opacity 0.66, each sheet printed separately with its own offset and alignment, plus a yellowing layer |
| GIF: the crimson silk cords quantised to brown; black paper under glass reflections banded | Palette samples weighted: saturated ×5, crimson ×15, glare-lifted black (luminance 0.075–0.28) ×7, plus the same 4×4 Bayer (about ±2.4 steps) |
| Peak memory 1.1 GB: full-frame `blur` and fine-scale `noise2d` spawning float64 intermediates | Rail shadows depend only on y — computed 1-D; full-frame fine noise as white noise plus a 3×3 mean; the 2× gilt frame rendered in 192-row bands (24 overlapping), to about 0.6 GB |

## Letterpress poster (letterpress.py)

| Problem | Fix |
|---|---|
| Large solids full of white dots like a noise filter, woodcut blacks greying | Misses only inside solids, tooth threshold above 0.975, about 1–5%; almost none at pooled edges; wood type's dents and soft spots down to 0.15–0.35 |
| The elephant's front legs reaching diagonally to a far drum like propped elbows | Rotate the whole body up about the hips (about 22°), all four legs vertical; the drum under the front shoulder, its top = shoulder height + front leg length (legs 4% shorter than hind) |
| Elephant like a bald ball plus a hose, ears like a second head, like a spaniel's, like a hood | Trunk root about one head high (104→26 tapering), merging into the forehead; ears fan-shaped: the front arc hugging behind the eye, the top below the crown so the dome shows, the rear edge wavy, the bottom tapering; small tusks and an open mouth |
| Leg roots drawing round-headed rings inside the body, like inserted posts | Cut the far legs first; the near body, head, trunk, near leg and tail merged into one silhouette with one outer cut, plus a few short interior contour lines at thigh and elbow |
| Hatching uniformly dense, the elephant a striped barrel | Hatch width follows tone (`hatch`'s `tone`), lo about 0.3: the brightest back tapering out naturally; the body arc hatching about a distant centre, legs vertical, the trunk diagonal with cross wrinkles |
| Drum stripes printing as one red wedge | Stripe phase = arcsin(u)·9 − y/9, 4–5 diagonal stripes visible on the front, hoops left above and below |
| The little cap like a red beret, like a cherry | The fez as a straight-edged `poly` (no smooth closed curve), the tassel hanging from the crown backward |
| Trunk tip touching the wire, like reaching to grab it | Trunk tip about 70 px clear of the wire, curling toward the performer |
| Composition drifted right, a big gap between masts and elephant | Elephant centred between the masts; engraved-style serifs behind: horizontal hairlines, ellipses fading outward, each surrounded by a blurred white rim cleared before inking |
| The dancer's standing leg two thin lines, the pole across her chest | Legs thickened (17→9 px) with black ballet shoes; elbows bent down, the pole at waist height |
| The circus ring's rim running off the right edge; sawdust and ground shadow too black, like stains | Ring half-width computed from the mast spacing; sawdust density 0.0035 and only at the feet, the shadow horizontal hatching (tone 0.55) |
| Paper-edge nicks as black dots, like ink blots | Only 3 nicks, 3–7 px |
| Peak memory 1.5 GB | `press` in 240-row bands; woodcut masks released after printing (1.19 GB) |

## Soviet constructivism (constructivism.py)

| Problem | Fix |
|---|---|
| The lattice tower screened into a solid dotted cone, no lattice | Per section from 24 members down to 16 → 8 (fewer higher), members thickened (0.55 m tapering to about 0.27 m); the far half's members albedo up to ×6.5 lighter; fog distance 520 → 2600 m (or the whole tower washes to flat mid-grey); pre-screen blur 0.3 → 0.12 grid (`soften=0.12`) so the top cross-braces separate |
| Radio photo unrecognisable: the horn face-on a black ball, the valves white lumps | Horn axis about 60° off the view axis, the flared bell and its dark interior visible from the side; brass albedo 0.45, metalness 0.5, base black lacquer; glass tubes albedo 0.42 with an internal anode band |
| The radio panel like a camera (two equal ivory dials like lenses) | One black bakelite dial (nickel ring + white graduations) plus two small knobs, terminals, a nameplate, honeycomb coils on top, a flex from horn to body; photo enlarged 1.16×, screen pitch 6.5 → 5.5 px |
| Numbers missing from the numbered squares | Black radio waves printed over the labels — black on black knocks out nothing. The waves stay within the wedge's ±9° and stop at the horn; labels outside the waves |
| Radio arcs filling half the sheet like a comb or ribs | Wave fronts only near the wedge, from the tower tip to the horn; width thinning with radius (`grow=-0.045`); upper edge only to +6.5°, clear of the title |
| In the slanted labels, digits running outside the squares | Squares and digits both placed by `along()` from the same lower-left corner; never one rotating about its centre and one about a corner |
| The cut photo on paper colour, the scissor margin invisible | Put the photo over red blocks, black bars or the wedge: a big red block rising from the black bar behind the radio, the wedge reaching under the horn |
| Red showing only as slivers round the photo, like a render error | The red block larger than the photo (410 px tall), running from the black bar up under the title; gaps scissors cannot enter bridged with `close=`, holes enclosed by the photo filled automatically (scissors only go round the outside) |
| The wedge's straight end showing a red corner beside the horn | The wedge reaching just 20 px past the horn, half-angle 5.6°, about the horn's width, its end wholly hidden under the cut photo |
| Creases too weak, like a drawn hairline | Ink cracking intermittently along creases (about 2–3 px wide), ±3 px wear bands each side lightening ink at most 22%, plus one bright and one dark crease ridge and a grime band |
| The pin hole one black dot | A rust halo ringed round the hole, biased to one side |
| Red mis-registration showing 2 px of paper at the right edge | Pad plates 8 px with edge replication before offsetting: the print is trimmed after printing, no white edge |
| After filling holes the cut photo printed full of ground halftone | `ImageDraw.floodfill` does nothing silently on images from `Image.fromarray()` — `.copy()` first, then fill |

## Art Deco (artdeco.py)

| Problem | Fix |
|---|---|
| Fingerprint-like stripes under the nose; normals jumping | "Scaling a cross-section toward a point" is not a valid distance field (hit residual 0.19 m); the exact cross-section of a vertical core segment inflated by R (straight walls, a rounded roof, flat-cut bottom), the nose only stretched along the track (underestimates distance only, safe to march), residual 0.008 m |
| The nose vertical, like a tram | The core's front edge raked (`rake` about 2.2 m), the nose leaning forward-down |
| The headlamp floating ahead of the nose; the cream window band cut vertically on the nose | The raked nose actually extends far beyond nose_len (a vertical edge inflated): bisect for the real nose surface; lamp, stripe convergence and the plain nose cap all measured from the true tip; stripes stopping 14% short, the window band tapering to a point |
| The body a few thin gold lines away from one flat red | Add the cream window band (1.95–3.15 m) and gold lines above and below; the waistline converging onto the nose in section coordinates as speed lines |
| Clock and crown floating above the roofline, poking into the title | Clock on the top level's body (`top_windows=False` leaving that level's windows blank), the crown from the top level's top edge; near rooftops all below the subtitle |
| Gold rules crossing the subtitle text | Draw the subtitle first for its width; the rules run from the title's ends to 28 px outside the subtitle |
| Headlamp one big white blob, like an eye | Lamp ball radius 0.3 m, chrome ring 0.47 m, halo 80 / 10 px, emission 0.85 |
| The beam pointing back at the body | A 60 m endpoint runs behind the camera and flips; end at min(60, 0.6·Z/dz) |
| The lamp lights rails invisible in frame | Guard rail 0.56 m with the camera only 1.4 m above the track hid the deck; rail down to 0.25 m, camera 2 m; Lambert at grazing angles only about 0.1 — wrapped instead (×5 capped), the rails two bright lines leading in from lower left |
| Airbrush grain too coarse, beam and rays like sand | Grain = fixed noise × 0.2 × d(1−d): only in thin film, none in solid or empty; rays' grain 0.45 |
| River reflections like camouflage patches | Ripple noise sampled in compressed depth coordinates, stretched about 90× sideways, two layers only: long and sparse near, fine and dense far |
| The moon's reflection too weak, black sky reflecting as much as the moon | Mirror weighted by luminance (0.45 + 1.3·smoothstep(0.35, 0.85, luminance)), the moon and windows pulling a light path |
| Window reflections as isolated bright dots under the viaduct | Off in the example (`lights(r, reflect=False)`); if used, lengthen the stretch |
| Lunar maria as dirty blotches | Maria smoothstep-edged at density 0.13, grain 0.25 |
| GIF: the red body quantised to brown blocks, the sky banding | Weighted palette (saturated ×5, bright ×2) + the same 4×4 Bayer every frame (about ±2.4 steps); quantise only 255 real colours, the transparent placeholder magenta — otherwise the darkest pixels become transparent (9-frame self-check failed) |

## Golden-age comic (comic.py)

| Problem | Fix |
|---|---|
| Feathering like comb teeth or ruler ticks: equal length, spacing, perfectly parallel | Lengths riding two slow noises (0.25–1.15×), spacing ±30%, each stroke slightly bent and about 4° off parallel; landing on the shadow edge, shorter toward the light |
| Feathering crossing the lettering on a white colour ring, RS-1 read as RS-T | The hatching's `clip` removes the text's region |
| The brown of C40 M70 Y100 (helmet, shaded hills) breaking green under an 11 px coarse screen | No blue plate for brown: M70 Y100 + black 40% / 70% (`BROWN` / `DARK_BROWN`) |
| Seven equal sky bands like a flag; middle steps screened on two plates, dots too busy covering figures | `edges=` for unequal bands; transitions on one plate where possible (blue 40%, blue 20%, yellow 40%), two-plate overlaps only at the top one or two bands |
| The moon halo's concentric rings over every band, cutting a blue disc into the orange band | No halo; `rings()` only within a single band |
| The wind-blown scarf covering the rear dog's head, the dog a white blob | Scarf up and back (comic exaggeration), dog moved back; rear seat drawn before front; dog's face pure white (unscreened) with black ears and nose, gold goggles |
| Goggles bigger than the face, like a second head; the windshield like two teeth or an extra tail fin | One lens pushed up on the forehead; windshield removed, only the cockpit rim left |
| The pilot drawn after the hull, legs outside it | Draw the person first, then the hull: `part` erases what it covers, the cockpit rim added last |
| The exhaust a screened grey box; flame's outer deep orange the same as the sky, hidden by the tail fin and smoke | Jet black with a silver rim; the flame five layers red → deep orange → orange → yellow → white, smoke eating only the flame's end, the tail fin smaller, the middle fin crossing the portholes removed |
| Smoke puffs as jagged stars screened orange, like a rock pile | Puffs near-circular with slight undulation on white; black 20% only on the lower-right crescent, yellow 40% on the flame side |
| The right mesa unreadable as a cliff: slope, feathering and shade mixed, the shade breaking dark green | A flat top plus a vertical cliff face: a black shadow under the rim, cracks feathering downward (`feather(along=(0, 1))`), a talus slope in another colour at the foot |
| The horizon crossing Sparky's head; he is too small, the joke invisible | Horizon lowered to chest height; figure enlarged 1.15×, the flying cap moved off his hand |
| GIF over 2 MB (2.34 MB), halftones moiré-ing when downscaled | Downscale to 720 wide with BOX not LANCZOS: 1.79 MB, dots still faintly visible |
| Memory peak 1.25 GB | Halftone threshold maps etc. cached as float16; printing in 180-row bands; the logo computed only in its clip region; ageing confined to its own areas: about 0.85 GB |

## Pop silkscreen (popart.py)

| Problem | Fix |
|---|---|
| Black diagonal lines across several panels | Closed-eye stroke width `sin(πt) ** 0.7` — at the ends sin is −1e-16, the power gives NaN, the polygon runs to the window origin. `stroke()` now `nan_to_num`s and clamps width ≥ 0; clip `sin` to 0..1 in custom `profile`s |
| White horizontal streaks over the ground colour, like scratches | Ground `dry=0`, `streak` about 0.012; brush texture stretched (about 140 × 7 px); dry drag only round a shape's edge |
| Starved screens showing a neat woven grid, like a digital pattern | Cloth's effect on the ink film down to 0.035; starvation comes from squeegee-direction streaks, about 5 px cluster noise and one dry patch |
| The closed-eye ∩ too thin over an elliptical eyeshadow, reading "brow + open eye" | Closed-eye arc about 0.10 units, tapering at both ends; the happy panel no eyeshadow, blush instead; the sleepy panel's eyeshadow a closed lid shape, only above the closed line |
| At density 0.84 the face barely prints | 0.92–0.95 "starved but legible", 1.0 normal, 1.1–1.15 flooded; flood above about 0.5 clogs half the face |
| In the flooded panel the far ear a black bowler; flattened, the ear's outline crossing the head tabby in an X | Beyond 40° of ear rotation, print only the concha's halftone and outline the upper rim; the head tabby line hidden by the ear is not printed |
| The far ear's shadow and outline splitting: the outline a floating stick, ear hairs a shuttlecock | The whole far ear one shaded mass to its outer edge; 4 ear hairs, about 0.026 units wide |
| The tongue a red blob under the mouth | The tongue extends past the lips (down to about 0.74 units); the black screen draws a U rim and a centre line on the tip |
| A pale hairline ring round every panel edge, like an inner outline | Paint ridge relief 0.9 → 0.35 |
| The long arc tabby on the left shoulder like "wings" | The lit chest stripe not printed solid — a halftone band only (tone about 0.38) |
| Peak memory 1.08 GB | The script stacked 60+ full-window masks then `np.stack`ed them; `canvas()` and compositing allocated full-frame temporaries. Accumulate masks in place with `np.maximum`, colour layers computed per panel, cloth and compositing in 180-row bands: about 0.46 GB (before/after the mask change, output byte-identical) |
| GIF: black halftone and six palettes' mixes mis-quantised (p99 error 100) | Palette samples: post-key panels ×3, refined with `kmeans=4`: p99 to 39, pixels over error 70 from 3.7% to 0.03%, size unchanged |

## ASCII art (line printer) (lineprinter.py)

| Problem | Fix |
|---|---|
| Body and smoke toned with letters like I H M N, reading as words "IMM", "HNM" | Fill characters only symbols: body `. : + % # #@`, smoke `. : % @ # #@`; letters only for real text |
| Line characters picked by shape similarity: the truss tower as `<> <>`, `^V` | Pick by direction and position instead: direction measured in real pixels (cells are tall), steep | / \, flat `' - . _` by height in the cell, X / + only where two lines cross |
| Diagonals and verticals pressing both neighbouring cells, `//` `\\` `)\|` everywhere | Between two adjacent same-direction cells of one line keep only the more-stroked one (non-maximum suppression; diagonals also require the same character, so peaks' /\ survive) |
| Truss brace crossings landing at four-corner junctions, `\_/` `/-\` in the middle, no X | Braces run one column and one row at a time through cell centres: tower width 6 columns (5 inside), crossings land on centres as X; horizontal braces on row centres — on row borders they split between two rows and neither reaches threshold |
| Outlines also drawn between body, roll marks and flame; stray \| and ---- inside the body | Role grouping (`group='rocket'`): no outlines within a group, only the outer silhouette outlined |
| Every puff outlined with error-diffused tone, gibberish beneath | Puffs `edge='all'` but `inner_max=0.5`: ( ) and .-' only on bright crowns, dark parts tone only; light from above plus a self-shadow at the base (`lift`), dither down to 0.2; fewer larger puffs (radius 5.5–10 columns) |
| Text too clean, like laser print or a screenshot | Glyphs first blurred about 0.5 px by ink spread, then thresholded against ribbon weave and paper tooth: enough force prints solid, weak force thins, breaks and speckles — never greys; bold glyphs |
| ' ! streaks inside the flame like quotes and beads; the inner cone as a chain of () | The flame grows straight from the body's base, same group, no random jitter |
| The flame two ( ) verticals around blank space, unreadable as firing | The flame a bright column widening downward from the nozzle: the outer `plume` role a smoke sheath grading from . to % @ # by off-axis distance (darkening past u>0.45), the inner `core` role a few stripes spreading from the nozzle flickering along their length (! \| at the nozzle, : . ' below); no random jitter in either, so it stays symmetric |
| Two foreground puffs squeezing the bright column into a funnel, the flame reading as narrowing | Foreground puffs moved out (13.5 columns off-axis), a small puff each side of the column catching the sheath, the middle puff's ____ crown meeting the column's base |
| The nose cone one version shouldered out, another too blunt like a dome | The cone a bullet curve half-width = R·(2s − s²), polygon computed point by point, no spline |
| Random-dot "morning mist" in the left sky like dirt on paper, cutting a vertical edge at column 94 | Removed; empty sky stays blank, the large right void balanced by a distant water tower |
| The header "RUN ... PAGE" too close to the reference's format | Invented fields: JOB 4471 / SHEET 2 |
| The bottom smoke row cut half a line by the frame's bottom | 8.5-inch-deep paper (`page_in=8.5`, 51 rows a page), `ppi` lowered so the whole sheet with both tear lines is in frame, desk showing either side; `erase` from `page_rows − 2`, leaving two margin rows to the tear line; the tear line and crease deepened |
| The sun a ring of lines with distant rays, birds scattered like afterthoughts | Sun disc filled . : darker at the rim (. centre, : edge), rays hugging the disc, eight equal; birds in a V formation toward the sun |
| GIF: the red ballpoint quantised to grey | Too few red pixels to win even weighted: 14 palette slots reserved for red |
| Peak memory about 1 GB | Paper composited per channel, the image composited in 480-row bands: about 0.7 GB |

## Low poly (1999 3D) (lowpoly.py)

| Problem | Fix |
|---|---|
| Vertical green stripes all over cliffs, horizontal strata on the flats instead | Materials offset one cell: each face takes the profile point toward the inside (the smaller end index), so cliffs follow strata and flats follow scrub |
| River-bed triangles poking out of the water | Painter sort by average depth let submerged river beds compute "nearer" than the surface: faces fully underwater are not generated at all (`canyon(buried=)`), the water takes a −2 sort bias, drawn like a decal |
| The water a washed-out cyan | Ripples down to 16 dashes and darker, water spec 0.35; water is bright against the light anyway, add nothing |
| Composition copied from the reference: plane dead below, the big ring dead centre, rings nested behind one another | Track re-routed to a right-hand bend, camera behind-right of the plane, `aim()` putting the plane on the lower-left third, gold hoops along the diagonal to the upper right |
| The outer bend's walls blocking the whole sky, sun and flare gone | Canyon lowered (`height=0.75`), camera to about 2.6 m above the plane, FOV 52°, about twenty per cent sky left |
| Dead astern the plane is a "+", clipped by the bottom edge | Camera up and behind-right, seeing the wings' upper surfaces; plane about 11 m away |
| A ledge about the camera's height read as a glowing crack | Camera height away from ledge heights (ledges about 11.8 / 20 m, camera about 16.6 m) |
| Gold hoops thin and olive, unreadable as polyhedra | Tube radius 0.6 (radius 3.4), 12×5 faces, warm gold #ffaa1a, glow 0.28, spec 2.0, shine 4: shaded faces orange, lit faces yellow, facing faces flashing white |
| Plane and hoops grey and dull against the light | Shading light set separately from the drawn sun: `light(lift=26)` raises it 26° (games did the same) |
| A hollow ring in the flare like an extra gold hoop; a green hexagon dead centre like a stone | Flare only small dots and solid hexagons; near centre only 2 px dots, the large hexagon far out and fainter |
| '"' bold joins its marks into one bar; 1'07"42 reads "1'07-42" | Two columns between the marks (`'#  #'`); no slash on zero, only italic reads unlike 8 |
| The propeller disc nearly invisible, a grey smear | Translucent disc alpha 0.36 plus a brighter tip ring |
| Junipers black silhouettes against the light | Trees carry glow 0.3, leaf colour lifted |
| GIF 2.08 MB with the gold HUD browning | Downscale with BOX not LANCZOS (no ringing on hard pixel edges), palette samples saturated ×5: 1.63 MB |

## Stencil graffiti (stencil.py)

| Problem | Fix |
|---|---|
| A big stippled rectangle round every stencil (clearest round the kite, swallows and letters), at first even thin straight lines hugging the card edges | Spray regions extended 2.5 cone-widths outward so paint off the card still lands on the wall; the "card ghost" coefficient down to 0.0035; sweep reversals decelerating only to 0.55, never pooling at the ends |
| Every edge 6–8 px of burr, like mould, no crisp core | Card lift no longer rises to 1 with distance from tape: mostly flat (0.15 + 0.35 × tape distance + 0.5 × local bow); creep only 1.8 px blur weighted 0.2 + 0.5 × lift; overspray mist two layers 7 / 24 px at 0.022 / 0.012 |
| Drips everywhere: white drips running from the scarf across coat and trousers, dripping above every bridge | Drips only from true lower edges (empty 7 and 12 px below; bridges do not count); count capped by amount × min(26, 2 + excess/40), white 0.06, grey 0.2, black 0.7; drip ridges down to 0.45 + 0.25 × width/3, or they ghost through later coats as white lines |
| Three coats grey mush: grey nearly as dark as black, white patchy stipple, black only edges | Grey to #7b7c79; white hiding power 2.0, three coats; black shadows deepened (torso 34, legs 18 / 44 px), `shade_side(wobble=)` making shadow edges hand-cut |
| Swallows like jets | Crescent swept wings (one up one down), slim body, long forked tail |
| The scarf first like noodles, then "VAV", finally a raised striped arm with fingers | Two narrow tails of different lengths from a knot in front of the neck, drifting slightly up and forward; only horizontal stripes, no shadow crescents on the tails; tassels fanned apart, never touching (touching encloses an island the bridge frames into a box) |
| Brim over the eyes, the chin shadow like a moustache | Brim up 6 units, eyes enlarged, nose tip forward, mouth a gap in the outline; the chin shadow into the grey card, thinner |
| The kid leaning forward, torso like an egg | Upper body arched back 9° more about the hips, front leg straight heel-down toe-up, rear leg bent bracing; puffer shortened to the hips and narrowed |
| Black-card snapshots spraying the whole card black, unreadable what was cut | Paint on the card as "dust" (0.82 × (1 − e^−0.55D), kraft showing through), cut edges lit on one side by the card's thickness |
| Wall like a plank wall, grain too clear; cracks like drawn black lines; efflorescence a white dashed line | Wood relief halved and pressed only within patches; cement mottling and laitance added; cracks thinner and paler; efflorescence broken by noise |
| Council buff one blurred rounded rectangle | Vertical roller passes: each with its own start and end heights (stepped edges), dry streaked ends, overlaps slightly darker, the old signature showing through a little |
| GIF: the red kite going brick red, the pink signature lost | Palette samples weighted: red ×12, other saturated ×5, black ×3, plus the same 4×4 Bayer (about ±2.4); transparent placeholder magenta, not black |

## Embroidered patches (patch.py)

| Problem | Fix |
|---|---|
| Denim like printed 45° stripes, pale wefts bright and heavy | Warp denser than weft (1.5 × 2.5 px), wales about 60°; wefts showing only dots, randomly per dot; warps with slub dye variation and wear; rendered 2× then reduced |
| Satin border like a barcode, black and white bars too hard | Satin cross-sections flattened (relief ×0.6), grooves between rows only to 0.74 |
| Fill like brickwork | Needle-hole pits darkening only 30%; row starts drifting ±6% |
| Satin flat, no "sheen along the thread" | Satin floats padded (rise about 0.11 × length, at most 3.2 px), one bright-to-dark transition within a single float |
| Dark threads washed out by highlights; the compass's points' lit and dark halves indistinguishable | Highlights ×0.62 overall; lit halves not too bright (bright red #cf4637 / dark red #721a14) |
| Peak's lit faces too white, snow caps merging into the mountain | Mountain lit faces mid grey-blue; white reserved for satin snow; shade clearly darker |
| Flame in vertical satin with floats split into staggered short stitches, reading as fill | Stitch direction horizontal (about ±15°), maxlen to 90; outer, middle and inner flames layered |
| Lake ripples crossing the tent and running past the badge onto border and denim | Detail stitches ordered before what covers them; `run(clip=badge mask)`, the path kept inside the border |
| Radial moiré in the satin border's rounded corners | Stitch pitch computed from the phase gradient, single-float relief faded below about 2 px; corner radius at least twice the border width (34 px vs 17 px) |
| Periodic dark bars and dots in the merrowed edge, the colour beneath showing through | Two causes: 2.6 px wraps beating against the pixel grid — subsample 4× in (s, d) and average; PIL's coarse polylines leave pinhole gaps in the band — a 5×5 max filter after |
| Rocker lettering crowding the merrowed ends | Size 42, span 98°, tracking 0.05 of size |
| The whole badge group too small, the top third empty | Design coordinates ×1.14 and shifted up; the needle placed separately in canvas coordinates, never scaled off-frame |
| GIF: gold merrow and campfire quantised to orange-brown | Palette samples: warm saturated ×5, bright ×2 (warm mean error 9.5 → 5.6) |

## Blueprint (blueprint.py)

| Problem | Fix |
|---|---|
| Fine text and lines blurred over large areas like out of focus — notes, title blocks and leaders unreadable | `core.blur` quantises sub-pixel sigma to 0 or about 1.4 px, whole "poor contact" regions blurred 1.4 px: the library's true gaussian `_gauss`, 0.55 good contact, 0.9 poor; single-stroke pen widths at least 1 px |
| "Ink-out" noise as one big patch, the second half of a line fading | Ink-outs only at the 0.84–0.96 peaks of 3 px fine noise, gated by a 90 px scale; ink-outs cut density only 45% |
| Decimal points missing: 17.90 printed 1790 | The period is a 0.08-unit segment, its round cap 1 px: strokes shorter than 0.2 units always drawn as solid dots |
| Fangsong CJK in the title block not printing; bolded, it mushes | Fangsong strokes too fine — the print S-curve treats them as faint pencil: condense first (0.82), then a 3×3 max filter and ×1.35 to solidify; never 5×5, it blurs |
| The section's spiral stair like floor slabs | Sectioned treads are solid white bars, the far half only `fine`: the far treads' front edges and the wall-hugging tread-riser zigzag to `thin`, plus a wall-hugging spiral soffit line; sectioned treads only 0.13 m thick |
| Section wall window openings like cracks or mis-set masonry | Openings splayed larger inside (outer ±0.38 m, inner ±0.55 m), the sash recessed 0.25 m, drawn heavy then thin |
| Dimension numbers unreadable over hatching | `dim()` defaults `clear=True`: hatching scraped from behind numbers first — draftsmen did exactly that |
| Scale-bar ticks scrambled, a white stretch elsewhere | "px per cell" mistaken for "px per unit": the interface is now `scale_bar(x, y, px_per_unit, units)`, ticks use real values |
| The lens detail's prisms like stacked throwing knives and arrows | Prisms drawn too large (a long light face): the path shortened to L1 0.1 m, L2 0.03 m, glass shown with 30° fine section hatching |
| The lantern cornice and sill as two big white blocks covering the notes; the dome arc running to the border | Thin outlines with metal cross-hatching; the dome only its springing stretch, broken by a break line; the beam note moved above the detail |
| The plan's UP arrow a full circle, unreadable, blending into the pencil construction circle | Only about 205° of arc, a dot at the start, an arrowhead at the end, UP at the start; the concentric pencil circle removed |
| The A-A cut mark colliding with the section's right-hand leaders; low levels (±0.00, −1.80) over rock and wave lines | Cut line shortened to 0.56 m outside the wall, both views shifted left, leaders from 806; the two low levels to the section's right, wave lines cut before them |
| The water stain a grey disc | Modelled as "water spread, then dried twice": two drying fronts each leaving a clear brown tide line, the inside only about thirty per cent paler with mottling |
| Crease crossings like bright stars | Crossing wear radius 7 px lightening only 38%, crease whitening mixing only 0.2 |
| GIF: the red pencil going grey-blue | Median-cut 238 colours over all keyframes first, then 17 more cut from red-pencil pixels alone (`claude_drawing/blueprint_work/make_gif_bp.py`) |

## Children's crayon (crayon.py)

| Problem | Fix |
|---|---|
| First version's fills like even sandpaper, no back-and-forth passes, indistinguishable from pencil or airbrush | Tooth pre-averaged along the stroke direction (bilinear ±6 px, mixed 0.35 : 0.65 with the original) then re-equalised, so skipped pits stretch into along-stroke streaks; pass pitch = width × (2.3 − 1.6 × density), each pass's pressure = pressure × (0.84 + 0.36 × slow noise); tooth finer (1.7 / 3.8 / 14 px layers) |
| Wax like plasticine relief, blank paper like a scraped wall | Lighting: wax height 1.35 → 0.55 (then blur 1.6), tooth relief 1.1 → 0.65 |
| The hillside line crossing faces and skirts | `line(..., avoid=c.grow(OBJ, 10))`: lines stop behind things; every object's inner mask collected into OBJ first |
| Later tulips, butterfly and signature over the grass — red + green browning, violet text unreadable | Crayon is translucent multiplicative and cannot cover: things outlined first, big areas (sky, hillside, grass) filled `avoid=U(OBJ, c.drawn())` (which is how children colour), objects coloured on white paper last |
| Arms, hands, dog legs and flower stems swallowed by grass | `drawn()` (already-drawn lines) added to avoid; dog legs re-pressed at 17 px after the body's colour, a dot for each paw |
| Sky coloured around the title, blue passes still crossing the letters (red going violet, orange going green) | Turns at avoided edges must be "careful": stopping 0.45 × width inside the boundary, no overshoot; avoided things' coverage × (1 − 0.9 × mask); gaps narrower than 0.7 × width never entered |
| Title like heavy Hei: a complex glyph mushed, its right half lost | Thin-font glyphs Zhang–Suen thinned to centrelines then inflated with a round crayon (size × 0.068 default, 11.5 px for the title); hand jitter 0.045 × size at scale 0.55 × size; tracking from real glyph widths (so Latin never spreads) |
| The signature lost between tulip stems | Moved to the space below the flowers, the grass leaving an 18 px halo (`c.grow(name's wax, 18)`) |
| The crayons on the paper: wrapper like a barber pole / barcode, wax like plastic, the third standing upright | Wrapper: two fine lines at each end + a wave band + a pale label with one line of pseudo-text (no brand); wax matte (highlight exponent 12, strength 0.13), the snap slightly brighter; radius 22 px (about 7 mm across, a real crayon's scale on 1920 px A4), only two: one worn, one snapped with half its paper peeled |
| Butterfly wings looped too full, two blobs covering the body | Wings 7 px off the body, back-and-forth fills, yellow dots added; body and round-tipped antennae last |
| Sunglasses a grey-black patch, unreadable as glass | `burnish()` presses the black into the pits: white specks close, mixing with the yellow beneath into deep olive with a waxy sheen; the ball treated the same |
| Chimney smoke an equal-radius spiral, like a spring | Loops growing upward (9 → 33 px), drifting up-right, grey lightly pressed |
| GIF last frame EOFError | The final `stage()` identical to the finished picture gets merged: no `stage()` before `save()` (section 4 already notes this) |
| GIF: small violet and pink areas going grey | Palette samples weighted: saturated ×5, bright ×2 (1.47 → 1.33 MB, 0 mismatched frames) |

## Green-screen CRT terminal (crt.py)

| Problem | Fix |
|---|---|
| Barrel distortion used cross terms in normalised coordinates (u·v²); on widescreen, corner glyphs sheared into italics | True radial distortion in pixels: src = p·(1 + k·\|p\|²/hw²), k = 0.065; letters straight, edges still bulging |
| Reversed YES and the status bar's dark text unreadable: half-dot stretch and video bandwidth ate 1-dot strokes | Half-dot stretch done at half-dot resolution, and before reverse video; the status bar `dim+rev` |
| Cloud interiors using - = + line-like glyphs, reading as `/=-\` gibberish | Clouds `outline='cloud'`: slopes always ( ), flat tops and bottoms _ . - '; interiors only . :, brightness from dim → normal → bold, never fancier glyphs |
| Silhouettes paired `//` `((`, both cells acting as edge | Silhouettes one cell thick: when neighbours share a glyph, keep the cell nearest coverage 0.5, classify the other inside or outside |
| Cloud bases a row of scallops `(...)(....)` | `puffs(base=integer rows)`: the bottom `flat` row filled across the cloud's width, small gaps between bubbles closed; the whole base struck as one `_` |
| A fine-line crescent reading as S or < in 5×7 | No outline — filled with bold % # @ (`outline=None`); inner radius about the outer's, offset right about 0.45r |
| The sun like a hexagonal hive, its downward rays like legs | Sun with a `cloud` outline plus a radial gradient . : + * % # @; only the 9 rays above the horizon |
| In tall cells, the coverage centroid used as the normal, slopes picking wrong glyphs | Normals scaled inversely by cell size: nx = −mx/cw, ny = −my/ch |
| The glow greying the whole screen green, losing the black ground | Mid and far glow applied to L² only (bold glows, dim does not); `brightness` down to 0.016 |
| The house louder than the weather; the cursor block touching the reversed YES into one frame | Walls and roof `dim`, only night windows bold #; half a command typed after the prompt (`forecast --tomorrow`), the cursor at its end |
| GIF: ringing round the bezel rim, dark glass and window reflections banding | Downscale to 720 wide with BOX, the same 4×4 Bayer every frame before quantising (about ±2.4), palette samples green ×4, bright ×2 |
| Peak memory 834 MB | Thumbwheels, LED and embossed icons computed in local windows; the bezel chamfer's screen-facing amount cached; no full-frame int64 grids per render. To about 0.73 GB |

## Thermal camera (thermal.py)

| Problem | Fix |
|---|---|
| The floor hidden by the bottom scale bar, the cat half shown, paw prints invisible | Camera panned down more (vanishing y 150 → 100, focal 1900 → 1750), about 200 px of floor; the bottom bar 78 px |
| Auto histogram equalisation stretched the 20–24 °C room into magenta, cat and wall the same colour | A hand-tuned curve `camera(curve=)`: fridge 0–0.05, room 0.23–0.29, prints 0.35–0.5, cat 0.6–0.72, pot 0.9, only the burner ring to white; equalisation mixed only 0.22, keeping some local contrast |
| Pot and kettle saturated into two white blocks, the pot a giant mug | The curve puts 100 °C at 0.91; the pot wider and lower with a rolled rim and side loop handles; the polished lid `emissivity=0.55` reading a step cooler than the body, so the lid shows itself; pot body, kettle and loaves take `limb=`, cooling at outlines for volume |
| The oven door a giant orange rectangle dead centre, stealing focus, the same colour as the cat | Oven cooled (frame 23–26.5 °C, glass 26.5–31.5 °C, only the top seal 46 °C); a damp tea towel on the handle (17.5–20 °C, evaporative cooling) breaking the big mass |
| The wall's heat halo behind the stove a glowing column to the top of frame | `soak` limited to behind the pot to under the hood, reach 38, strength 0.4, `onto` below the hood's bottom edge, pot-kettle-hood carved out |
| The fridge's cold cave unreadable on the floor: 8–18 °C crushed into the palette's darkest stretch | The iron palette's low end lifted (0.14 → #1f0e6e, 0.24 → #3d1192), the curve giving 2–19 °C the 0–0.23 range; the cave's core to 6.5 °C |
| The cave's noise-thresholded edges a camouflage blotch | `pool()` reworked as soft cold tongues branching from the source: flattened by floor perspective, decaying along the tongue, then blurred |
| The fridge interior dead black, shelves and bottles invisible | Shelf front edges as 10.5 °C bright lines, bottles 6–8 °C above the walls; the freezer drawer's panel back to near room temperature (it is insulated), so the cold pouring down it reads |
| The fridge's side panel crossing in front of the lower cabinet, an extra slanted edge | The panel only above the counter and 10 cm inside the cabinet's front |
| The compressor grille at the fridge's foot a pink bar beside the black cave, like a fault | Removed |
| The cat a flat silhouette; the Sp3 cross over its eyes | `limb=` added (grazing-angle emissivity drop, cooler fur tips), a thin chest coat +1.4 °C, the hind leg's kink darkened; eyes 38.6 °C with the curve steepened 35–39 °C; Sp3 moved to the chest |
| The hind leg's ellipse cooling in a ring, like a mosquito coil | The hind leg's limb down to 1.2 °C |
| The line profile's curve dark violet on dark ground | The curve a white line with a black rim, a palette-coloured band drawn beneath |
| The L1 dashed line over the paw prints | The dash 1 px |
| GIF: steam and wall halo contour-banded, OSD white text quantised to pale yellow | Palette samples saturated ×5, bright ×2, the same 4×4 Bayer every frame (about ±2.4); pure white, pure black, REC red, the coldest marker's blue and two greys forced into the palette |

## Delft tiles (delft.py)

| Problem | Fix |
|---|---|
| Cobalt like fluorescent royal blue, obviously a screen colour | Colour from per-channel Beer-Lambert absorption, k = (2.3, 1.95, 0.95): pale washes grey-blue, dense lines purple-navy (`COBALT_K`) |
| The window reflection a shimmer of white flecks with furry edges, unreadable as a window | Orange-peel micro-texture removed, glaze relief only an about 46 px slow wave at ±0.15 px, plus each tile's dome (±0.3 px) and tilt; mullion width must exceed the highlight's blur (soft 3.5) or the panes wash into white |
| The height field's gradient had x and y swapped, chamfer lighting and reflections offset on the wrong axis | `np.gradient` returns (d/dy, d/dx) — write `hy, hx = np.gradient(h)` |
| Crazing wall to wall, like crushed ice | Per-tile crazing Beta(1, 2.6), lines darkening only 13%, most tiles nearly clean |
| One crack crossing several tiles like a pen line | Cracks clipped per tile, stopping at joints, darkening only 50% |
| Joints 5 px too wide, the wall a relief grid | Joints 3.6 px (13 cm tiles are 3–4 mm), bevel 3.4 px, height 1.3 px |
| Clouds one flat rectangle | A cloud is the upper envelope of a run of bulges: high left, low right (wind from the left), each bulge one stroke with sharp corners between; the baseline broken into two or three stretches, the wash fading upward from the bottom |
| Crowns like balloon strings or cauliflower | Only the outer silhouette scalloped; inside, two rings of shrunken scallop arcs on the shaded side; the second wash graded, never one crescent per clump |
| Flour sacks on the barge like a row of portholes; leeboards like hanging sacks | Sacks sitting on the deck, only the upper half and the tied neck outlined; leeboards fan-shaped boards narrower at the top, drawn first and `occlude`d, the hull's lines never crossing them |
| The distant tree line like a row of eggs; smoke like wires | `bushes()`: little scalloped hillocks on the horizon with faint washes; smoke a run of curls growing and paling |
| The person a child in a skirt, the dog a dachshund | Person: hair and tips streaming forward, mouth open, cuffs turned, breeches, stockings, buckled shoes, leaning forward, the rear leg kicking; dog: all four paws off the ground in a leap, ears and tail streaming back, a dark patch on the back, no hatching (it reads as zebra stripes) |
| Washing hanging lifeless, no wind | Sheets and shirts' hems streaming right almost horizontally, moved to open ground near the shore, not hidden behind trees |
| The window reflection on one right-hand tile as sharp-edged pure-white shards, reading as a missing tile or render error | Reflection layered as "screen" over the glaze (`img + (white − img) × s`, s at most about 0.65), the blue lines still showing through the brightest parts; blur width 6, panes shrunk to 112 × 150; moved onto the upper-right cloud and sky, spanning two or three tiles, breaking and offsetting at joints — unmistakably a glaze reflection |
| Chips as orange dots, like rust | Radius 5–11 px showing the buff body (`BODY`), the lit side shadowed by the glaze rim, the pit's shaded wall bright |
| GIF 3.4 MB | Palette samples blue ×3; pixels within 10/255 of what is shown recorded transparent → 1.7 MB |

## Cave painting (cave.py)

| Problem | Fix |
|---|---|
| Pigment greyed, like faded watercolour | The spray's interior keeping only half its coverage (rim 0.35 × mottle × 0.32 smoke): main density 0.95–0.97, rim ≤ 0.2, airborne smoke down to 0.16, contrast 1.18 and saturation 1.18 added after the exponential tone curve |
| The wall like a quilt or cotton clouds | Solution scallop cells 70 px deep 6 px too regular: enlarged to 110 px, 1.8 px deep, in patches only; smooth-noise large relief reads as cloud and smoke — a ridged noise (1−\|2n−1\|)² × 10 px layered for rock ribs (cubic, amplitude 22, becomes mesas) |
| The wall like sandpaper or crumpled paper | Low-angle fire light magnifies per-pixel grain: height grain 0.55 → 0.12, the 40 px meso relief only 1.1 px, albedo grain 0.022 |
| Wall-to-wall black dots like polka dots; lightened, they became white glints | Small solution pits down to 60, depth 0.3 × radius, pits darkening albedo 30% (mud collected), so grazing light never leaves only bright rims |
| Clumps of "dirty shadows" on the wall | The fat lamp's grazing light pulling long shadows off the 80 px large relief: large relief to 46 px, only the campfire casts (not the lamp), shadows darkening at most 70%, soft 5 px |
| Bosses casting black blobs across the fire like stains | Small bosses (18 px) under grazing light are all shadow: bosses only where animals will be painted, 26–38 px high, with the animal covering their shaded face |
| An extra scratch at fold ends | Signed distance flips sign past a polyline's end along the last segment's extension: faded over 220 px at both ends by arc length |
| Hand stencils like red-outlined ellipses or donuts | Spraying the whole hand blurred once leaves no pigment round fine fingers and a hard outer cut: 11 puffs instead, each a gaussian aimed at fingertips and hand sides (2/3 at the upper half), summed 1 − exp(−1.8·c), edges fading naturally, mist specks outside; the forearm blocking only half |
| Handprints smoke-darkened into grey gloves | Smoke 0.22, a narrow column (spread 0.22), prints density 0.95, spread 26 |
| Two black thigh masses on the hindquarters | Leg strokes landing at 0.13 body-lengths wide from the hip filled the whole thigh black: the `legs` part = legs × (1 − body), only below the body outline |
| Bison head and hump one black mass, no face | Hump blown black, head deep red 0.62; the eye a pale almond (kaolin) first, then a black pupil |
| Bison like a rectangular box on table legs | Contour redrawn: a back line high in front and low behind, a towering shoulder hump, a deep chest and beard, the belly line tucking back, small haunches, short thin legs |
| A white gap between mane and neck; regions (head, belly) leaking onto legs | Mane strokes pressed onto the neck's spine line; regions intersect `body` only, never the whole silhouette |
| Antlers like a small comb | Antlers enlarged, the beam sweeping back, 5 tines, width 0.04 → 0.012 body-lengths |
| Cracks like hanging strings or twigs (the upper horse looks strung up) | Thin zigzag slits: tapering ends, random widths, 4 px deep, at most one short branch; never crossing an animal |
| The campfire a ball of white light | Flame emission halved, each tongue drawn at 2× and blurred only 1.3 px, 15 tongues, orange outside yellow within, a 0.55 centre hotspot; fire power 1.6, falloff 1150 |
| Fire stones like bone knobs, logs like dumbbells | 16 small stones (11-point irregular outlines, dark, dome exponent 0.85) flanking and behind the fire; logs radiating from the fire's heart toward the viewer, lit as cylinders (tops lit by the fire) with glowing cracks |
| The ground-pigment heap a flat colour patch | Heap height 1.3 × radius, colour edges softened, so the low fire light gives it a lit and a shaded face |
| Paint-loss flakes like confetti or white dust | 12-point smooth flakes, 1.5–4 px, only where coverage > 0.6, 28 of them; the exposed stone × 0.93, no height difference (or grazing light rings every flake) |
| Charcoal sketches invisible in the GIF | Sketch lines a band about 2.6 px wide (blurred by width then the 0.12–0.88 iso-band), strength 0.7, two passes |
| Charcoal contours like strings of beads | Coverage = line band × (0.5 + 0.5 × grip), never relying on the rock's "bite" alone |
| Bison tail tip like a lollipop, sparks like rain | Tail tip one short heavy black stroke; sparks down to 11, 2–6 px, only above the tongues |

## 1-bit paint program (macpaint.py)

| Problem | Fix |
|---|---|
| Writing one line of Shadow-style text erased the whole picture | Images from `Image.fromarray()` are read-only; `ImageDraw.floodfill` silently does nothing on them, so the glyph-finding flood fill treated the whole picture as a counter; `.copy()` first, then fill (the `bucket` uses the same flood fill) |
| The butterfly invisible over gingham curtains and clouds; the lasso's marching ants framing the curtain pattern behind into a mess | Small things on the emptiest ground (the sky's white band); the butterfly white wings + black tips + black dots — white with black edges reads best in 1-bit; the finished picture's selection a rectangle, lasso only on pure white, or pass the object's own mask to `select(lasso=)` |
| The spray shadow under the sill like a dirty lawn; pot-side and cloud-base spray like scribbles | Airbrush one light pass under the sill's lower edge only (radius 8, density 0.22) over a 50% grey pattern band; pot shadows small grey-pattern ellipses; no spray at cloud bases |
| Hills, lawn and fence outside all pattern, pots lost in the background | Fence deleted, lawn the sparsest `dots`, hills 25%; pots darkened (body 50%, shaded side 75%), rims lightest |
| The sky's top band at 12.5% too dense, the window no brighter than the wall | Sky `mist → faint → white` three bands, wallpaper `sprigs`: the window (the light source) is the brightest thing in the picture |
| The round tree exactly behind the sprout or sunflower, like a lollipop growing from the flower; a mullion exactly behind the day-14 pot like a stake | Distant small things never overlap foreground plants (tree deleted); pots shifted aside, clear of mullions |
| The right curtain's coordinates not mirrored, its lower half hidden behind the black cat | Draw only the left curtain, `copy(rect, to, flip=True, mask=curtain mask)` flipping it to the right (the era's Flip Horizontal); masked, so the wallpaper behind does not travel; the cat moved out of the curtain |
| The front-facing black cat a blob, whiskers on the curtain | Side view instead: elliptical haunch, slanted chest ellipse, front legs, head, muzzle, two triangular ears assembled into a silhouette, white lines for the leg and haunch division, collar, inner ears and eye; whiskers by XOR (`invert`) — white on the black face, black off it |
| The watering can's spout and drop unreadable over gingham | The can moved into the window opening, spout tip at the day-2 pot's rim, one drop left; the left sill a seed packet, the label row gaining day 0 |
| With two pots moved together, the day-2 and day-14 labels collide | Label centres independent of the pots, given their own coordinates |
| The zoom window over the main window's title bar | Placed where the calendar has not yet been drawn; the zoom framing eye, ear tips and a little wallpaper, so "cell by cell" reads |

## Greek black-figure vase (blackfigure.py)

| Problem | Fix |
|---|---|
| Horses swimming on the ground line: bellies 0.1 horse-heights off the ground, four legs horizontal | Bodies raised (belly 0.43, withers 0.93); the near foreleg folded high, the far foreleg reaching forward-down, both hind legs kicking back-down, hooves on the ground line |
| The driver shorter than the horses' backs, like a doll | The chariot box above the axle, the driver 0.9 horse-heights leaning 0.24, head level with the horses' ears; the breastplate hiding the white robe's lower half |
| The white horse buried mid-team, only white legs showing | The white horse the farthest, head highest (a 0.2 neck kink), on the chariot at the pot front's centre |
| The neck palmettes like pylons: petals straight spikes, tendrils running vertically up | Nine-lobed round-tipped fans (long centre, short sides), a red palm heart with one incised line; tendrils drooping arcs from below the heart to the lotus hangs; each lotus one long petal plus two out-curled |
| A large white haze over the left horse team, like an extra white horse | It is the big softbox reflected in the black glaze: the box narrowed to a vertical strip (reflection azimuth -0.90..-0.76), strength 9 → 6, plus a very weak broad soft light |
| A white triangle dead centre on the foot ring | The environment "ceiling" rectangle's light reflecting off the foot ring's top; replaced by one very soft dome light |
| Ageing too far: white crust patches, roots too bright, added white flaking like a dalmatian | Crust only on the lower body, threshold raised, strength 0.7; root marks 35–75 opacity; added white flaking about 20% in large pieces, leaving 20% plus a matte ghost |
| The mend a too-regular beige ellipse, the chip a white triangle | Mend outline jittered 0.42 fbm, tinted darker ochre-orange, its black parts grey-black, a few glue cracks outside; chips 24-point fbm outlines, the exposed fabric dark orange #c98a60 |
| The foot ring's black glaze like wood grain | Thin-glaze reddening's horizontal stripe noise too strong: glaze thickness base to 0.78, stripe weight to 0.08; the unfired slip's stripes weakened too |
| Handles like wire; throwing rings on the clay too visible | Tube radius 0.046R → 0.072R; throwing rings' normal perturbation 0.018 → 0.009, faintly visible only in reflections |
| GIF: the dark wall's spotlight and bare clay contour-banded | Palette weighted-sampled over all keyframes (saturated ×5, bright ×2), median cut, the same 4×4 Bayer before each frame's quantise (about ±2.4), the transparent placeholder magenta |

## Graphite pencil (graphite.py)

| Problem | Fix |
|---|---|
| Contours nearly invisible, the whole drawing washed out | A 1.5 px line anti-aliased covers each pixel only half, and the tooth threshold counts coverage, so lines dissolve into sparse grain: how deep the tip presses computed from √coverage (by pressure, not pixel coverage); contour graphite ×2 (`gain`), free strokes ×1.6, form hatching ×1.3 |
| Paper like rough watercolour paper, mottled all over | Tooth mostly about 1.6 px fine grain (fine layer σ 0.3×, coarse σ 1.3×), felt texture only 0.05, relief light 0.07; fine grain at σ 0.7 becomes sandpaper |
| Side-of-lead tone in diagonal bands and cloud blotches | Three passes at 11° apart, rows 0.42 widths apart, pressure jittering only ±10%, stroke edges softened 0.22 widths; side strokes resampled at 8 px (with rasterisation speed-up, large side-shading about 3.6× faster) |
| Bright seams between hatched patches | Lift-off taper only 20% of stroke length (was 32%), each stroke ±3 px over or short at seams, seams drifting per row |
| The "unfinished" edges like airbrushed fades | Beyond tone falling by finish^0.6, hatching and side strokes dropped whole strokes at a time by their midpoint's finish, thinning outward; lines keeping 35% pressure at the paper edge |
| The stump smearing edge graphite across to the far side, black blobs at the top | Smearing must not `np.roll` (it wraps); edge-extended translation instead |
| A white ring round the car body | The stump normalises its blur inside the mask (`contain=True`): only the mask's graphite evens out, never wiping the car's blankness into the wall |
| The car's shadow on the wall a smudged ghost car | No spokes in the shadow, edges blurred only 1 px, hatching only no side-tone base, the stucco wall's wash avoiding the shadow, tone down to 0.4 — the car read first |
| The corner side wall a strange grey wedge | The building too low (top edge only y −60, 1.6 m), its top slanting into frame: apex to y −1400 (three storeys), the side wall's far end ended raggedly by noise, a notch at the sign |
| The frame a white silhouette of two lines | The frame a dark lacquered tube: form hatching along it, heavier on the shaded side, a little reflection at the outermost edge, a stump smoothing along it, finally a hard eraser highlight |
| The baguette almost all white | Side-tone the crust's base first, then two interleaved form-hatching passes along the loaf's axis, a 4B pressed along the underside; the slash lifted with a kneaded eraser, a deeper line under the lower lip |
| The door one dark grey mass stealing the picture | Door to 0.42 as four recessed panels: a dark edge top and left, eraser bright lines bottom and right; the deepest only the doorway's left wall and top |
| Margin notes unreadable over the cobbles | Notes and the swatch strip get no cobble outlines and no hatching |
| The 2H–8B under the swatches unreadable | Size 22, grade 2B, pressure 0.95 |
| 40 s render, 1 GB peak | Rasterisation precomputing each segment's width and value into lists; masks (polygons, bands) drawn in bounds only; coordinates as broadcast row/column vectors, never full-frame mgrid; tooth convolved with small float32 kernels; finished full-frame masks `del`ed promptly: 11 s, about 0.72 GB |
| GIF 2.07 MB | Tooth grain re-encoding whole regions each cross-fade: cross-fade pixels within 7/255 of what is shown keep the previous frame (transparent), 1.26 MB |

## X-ray (xray.py)

| Problem | Fix |
|---|---|
| The dinosaur skeleton the picture's star yet faint and small, its skull clipped by the case's corner | Bone radius and thickness ×1.6 (cast toy bones are chunky), the whole skeleton to 1.02×; neck lowered, skull down 22 px and back 6 px, the whole skeleton inside the rounded corners |
| The whole image too dark, objects sunk in ink | Display curve's full-white point A=11 → 8.5, knee 0.32 → 0.30; phosphor glow 0.35 → 0.5 |
| Sweater and jeans reading darker than the empty case, like black mats | Measured: they are brighter than the case (red 35 vs 19) — lit fold edges made them read dark; density up (sweater 0.33 → 0.5, jeans 0.9 → 1.15) with knit / twill texture, so folds read as cloth |
| The material pseudo-colour view all orange: the rubber belt counted organic | Real machines calibrate the belt as air: `belt()` records its own attenuation, subtracted in the pseudo-colour view so the empty belt is white |
| The skeleton's steel pin inflating its Zeff | Readings background-subtracted by the median in a ring outside the object, then the median of per-pixel A_lo/A_hi ratios (not the ratio of sums): plaster reads 14.4, water 6.9 |
| The legend's "INORGANIC" crowding the METAL block | The legend laid out by text width, not equal division |
| The conclusions' text running out of the sidebar | Lines capped at 40 characters (16 px mono) |
| The zoom inset labelled "×0.8" framing the whole skeleton — it is a reduction | Frame only skull and chest, about 1.4× |
| Flag 1 over the case's bright rim and the combination lock, unreadable | Flag text on a dark backing; reading and flag on one line |
| Eight umbrella ribs symmetrically paired into four sticks; the canopy nearly invisible | Ribs' phases staggered 0.3 pitches round the shaft; canopy 14 layers at density 1.3 with arc creases |
| The belt's steel-hook joint beside the sidebar, like a zip | Moved to the frame's far left |
| One palette for the GIF: the pseudo-colour inset's green skeleton going grey-blue, CLEAR / REMOVE whitening | Palette cut in two segments: blue-film pixels 186 colours, colour pixels (orange, green, red, amber) 69; the same 4×4 Bayer every frame (about ±2.4) |
| Peak memory 0.86 GB | Scatter at quarter resolution; blur through sliced views (no `np.take` copies); OSD glow via Pillow uint8 blur; vignette broadcast, not `mgrid` |

## 1930s rubber hose (rubberhose.py)

| Problem | Fix |
|---|---|
| The frame too clean, like vector art with a filter | Lens softness 0.85 px, corners one step more; grain 0.07 heaviest in mid-tones by √(v(1−v)) plus a half-resolution clump layer; blacks lifted to 0.075, whites pressed to 0.93, plus gate weave and a rounded gate |
| The sun's fist like a lidded jar or salt cellar | Fist = palm ellipse + a row of 4 little circles on top (curled fingers, a scalloped rim) + finger-gap dashes + the thumb across the front; cuff shortened to 0.36 |
| The nightcap's brim a flat ellipse lying on the pillow like a halo | Cap on the pillow's upper-right corner, its body growing from the corner and drooping right-down, the brim a wide band along the cap's mouth; never a flat ellipse on a character's head |
| The pillow a box, like toast | Superellipse exponent 0.5 → 0.72, edge midpoints in 13%, corners pushed out (pillow corners), no tilt, short crease strokes at the corners |
| Slippers like top hats or burgers | Drawn slightly from above: a long oval sole + the rear half open showing the inside (a pale opening, a mid-grey insole) + a plush toe covering the front + a pompom, eyes on the toe |
| The sun's ring of triangles like the reference's sun (or a crown); wavy lines read as lashes or bugs | A scalloped halo + one short heavy ray per notch (alternating lengths, slightly tapered both ends) |
| "RRRING!" letters crowded | Tracking 0.78 → 0.9 of width; odd and even letters tilted oppositely ±10°, staggered 0.12 of size |
| Kick speed lines hugging the nightstand like cracks; vertical lines under the jumping slipper like nails | No speed lines touching furniture; three short rays outside the tiptoe (tapping the floor); two "︶" arcs under the jumping slipper |
| The quilt's checkerboard too loud | Dark squares only 0.17 darker (was 0.3) |
| The floor a big blank | The window casting a trapezoid of sunlight (9 px soft edge, brightened 0.45) plus a window-bar shadow; the slippers dance in the light |
| GIF: the pencil stage nearly invisible | Pencil drawn twice (1.7 px / 1.1 px), strength 0.8 |
| GIF 2.34 MB | Film grain re-encoding most pixels each cross-fade: pixels within 8/255 of what is shown keep the previous frame (transparent), self-check against the displayed frames, 1.54 MB |

## Linocut (linocut.py)

| Problem | Fix |
|---|---|
| White wind streaks in the sky too many and wide, the night sky grey-white, the big black-white contrast gone | Streaks 520 → 300, widths 2–6.5 px to 1.6–5 px; cut densely only in two diagonal cloud bands, nothing within 215 px of the moon; the sky kept sixty-seventy per cent black |
| Three black spots carved on the moon like a smiley | No maria — five concentric arcs on the shaded side for tone (V-gouge, 2.2 → 4.2 px wide, heavier outward); halo segments 0.35–1.2 rad with 0.15–0.6 rad gaps, or it reads as a bullseye |
| Chimney smoke invisible over the white snowfield, two black lines; as a string of puffs it read as pearls or a caterpillar | Smoke as overlapping puffs: spaced by arc-length "radius × 0.8", growing upward, filling the whole path; a 2 px black rim where it crosses white (`outline(cut=False)`); a black curl every third puff; both smoke lines' control points jittered so they never match |
| The chimney like a ladder | No row of horizontal slits — two short grey joints, a white snow cap on top |
| The bare tree's root one black triangle | Root spread 1.9 × dry width down to 1.05× |
| Treetops flat-topped in segments, like pruned | The last tier's width down to 0.5 px (`brush`'s `end`), high forks to 1–2 branches |
| Figures against the black house, heads merging; faces carved as white circles, like ghosts; snowflakes on faces like stars | Figures onto the snow (heads below the snowfield's edge); faces left-facing profile silhouettes (forehead, nose tip, mouth, chin) with one black dot for an eye; `speckle(region=)` avoiding figures, dog, woodpile and lantern |
| Sled firewood like a bench or crate | A woodpile seen slightly from behind: six log ends in 3-2-1, growth rings and one crack in the white ends; the bodies black with two bark cuts along them |
| The black block embossed, every white cut with bright and dark slanted edges | Embossing kept slight: normal shading × 0.3, clamped ±3.5% |
| Spot colour machine-flat and fake | The colour block takes mottle 0.25: pale ink shows tooth and film unevenness |
| Clearing chatter like hairs or pencil scratches | Straight short cuts along the cutting direction, 1–3 in parallel groups (ridges between neighbouring cuts), about 2/3 as many |
| The doorway light first a neat trapezoid, then boot-shaped | The far end ragged by sine plus randomness, both sides fanning outward; a few U-gouge cuts across the colour block, the black block's snow ridge crossing the light |
| GIF: the lantern's yellow quantised to beige | Median-cut 238 colours, then 16 more cut from saturated pixels (saturation > 0.28); transparent placeholder magenta |

## VHS home video (vhs.py)

| Problem | Fix |
|---|---|
| The floor lamp's column a white stripe top to bottom, the wall washed white | CCD smear accumulated per column only from "far over full well" overflow (threshold 2.2 — only point lights like flames reach it), never the column max; the shade's wall glow 0.9 / 0.45 → 0.38 / 0.2; bloom threshold 0.85 → 1.0, lag 0.95 → 1.2 |
| The candle-lit cream also crossing threshold, a wide orange column | Candle 0.42 → 0.3, radius 300 → 280; smear counts only overflow over 2.2 |
| The shade a grey-white square under the pennants, unreadable as a lamp | Shade down 60 px clear of the pennants; emission with side falloff, brass bands top and bottom, a cap and finial, a warm outer glow |
| The foreground child's torso a mustard block the colour of the wallpaper | A teal ringer tee instead, clashing with the room's orange; silhouette redrawn: bigger head, sloped shoulders, upper arm to the elbow, forearm reaching to the table with background showing between elbow and body; scapula lines, radiating hair strands, two ears, a warm rim toward the cake |
| The party hat too small, blue-white stripes eaten by wallpaper | Hat to 1.75 × head radius, red-yellow spiral stripes, tilted 24° toward the cake, a foil pompom, casting a little shadow on the head |
| Just-blown candles' smoke like glowing white rods, the tape adding more flame-like streaks | Smoke grey and non-emissive: one curling plume thin to thick, fading upward; also "smoke 1.0" and "lit" shared one value — candle state is now `'lit'` / 0–1 smoke |
| OSD 0 read as 8, W as U / H, PM as PN | The character generator bolds every dot rightward, 1-dot gaps filling shut: 0 loses its slash, W and M 7 dots wide |
| The zoom bar's ticks and fine frame mushing on tape | Drawn in the same bitmap as the font: frame + solid fill + one cursor, no ticks |
| The teddy on the rust sofa, invisible | Sofa to avocado velvet, bear to honey |
| Ring wallpaper too contrasty, dominating the room | `contrast=0.72` pulling the pattern toward the ground; sheet seams and a few px offset, reading as pasted wallpaper |
| The TV screen's centre an orange blob, like a hole in the glass | The window's cool reflection in the screen's upper-left instead |
| White text on the yellow pennant invisible | Text colour auto-switched by flag luminance: pale flags get dark brown letters |
| Dropouts all equal length, like rain | Count 45 → 24, lengths exponential: mostly 1–2 samples, occasionally one long streak |
| Without snapshots, `stage()` still fully composited: 13 s render; peak 1.15 GB | With `keep_stages=False`, `stage()` does nothing (examples set it by `--stages`); bloom's two large radii at quarter resolution; big colour blurs per channel: 6 s, 0.85 GB |

## Flat vector (flatvector.py)

| Problem | Fix |
|---|---|
| The old "weekend bookshop" rejected by the user: things stacked wall to wall, faceless "corporate flat" figures awkwardly proportioned, one all-over blue oppressive | Remade as a landscape: layers of big shapes (triangle mountain, wavy hills, round moon) over lots of empty sky; one 70 px figure silhouette only; night blue and violet cold against orange and sand warm, seven colours total |
| In-layer texture like wood grain, vertical streaks on moon and clouds | Fibre amplitude 1.6% → 0.8%, streaks shorter and finer (14 × 2 px grid), each layer a different offset; whole-picture grain 1.1% |
| Cloud like a loaf: a chunky rounded-rectangle base with a dark under-band | Three or four circles of different sizes on one flat baseline over a thin pill; shade = cloud minus itself shifted toward the light, only a lower-right crescent |
| A translucent smoke column over the violet mountain and magenta hills, grey and dirty | Smoke deleted; translucent shapes only over one flat colour (the sand's light ring, the head-torch beam) |
| Flame flat-cut at the base like a candle; logs hidden behind it; the stone ring jarring blue-violet | Flame as `teardrop()` (a circle + two tangents to a point) with two side tongues, three nested layers; logs crossed in front of the fire's feet with pale saw cuts; stones pale violet-grey |
| The hiker's orange pack and tent's orange tip against the orange hill band, invisible (no outlines) | Person and tent moved onto the yellow sand, so their surroundings are one contrasting colour |
| The trail breaking at the snow line: cream dashes invisible on snow | `trail()` returns a mask; `path & peak['snow']` recoloured violet-grey, the path reaching the summit flag |
| Campfire glow invisible; sparks drifting to the hill band, unconnected to the fire | Glow four layers at alpha 0.2 in `tone(SAND, 0.5)`; sparks only 120–190 px above the flame |
| GIF: cross-fades between big layers (night blue → orange → sand) full of coarse noise | Palette samples plus the 1/3 and 2/3 cross-fade frames; cross-fades dithered with one fixed 4×4 Bayer only where the keyframes differ. Dithering whole frames is 1.5 MB; Floyd–Steinberg gives 1.97 MB and dithers into the magenta placeholder, 5 frames mismatched |

## Storybook animation (storybook.py)

| Problem | Fix |
|---|---|
| Far hills too tall and full, crushing the sky; a beige paper seam showing between banks above the water | Far hill tops pressed to 470–660, the mint hills' base reaching the frame bottom (hidden behind the banks), the lavender's base stopping at 760 (hidden behind mint); lavender's `lead` smaller than mint's (300 vs 360), so lavender's lower edge never shows in the animation |
| Key poses crowded on the poster: the landing squash and the anticipation stacked at one point, the digging ghost behind the seedling, the ending leaf overlapping the drifting one | Only six poses spread along the path (fall stretch, landing squash, roll, leap, drift, somersault); the ending sprout drawn by the "last frame" itself (`final=True` draws the acorn cap on the seedling); `props=False` skips prop end positions, drawing only leaf ghosts simultaneous with the character |
| Vertical speed lines over the landing frame's head | Speed lines are added from the previous frame's velocity, and the frame before landing was still falling fast: the impact pose writes `speed=False` |
| Crayon ticks never drawn | The "inside" test was blur(a) > 0.97 while the watercolour layer's opacity is 0.96–0.97: a relative threshold 0.97 × a.max() |
| Crayon ticks shattering into specks like rows of tiny text | At 1920 wide the tooth is too fine — breaking by tooth becomes dots: a coarser 3.5 px grain breaking less; fewer, longer, heavier ticks (44 × 5 px) at opacity 0.55 |
| White reflections on the river like scrawled writing | 16 white strokes 80 px long arching slightly upward, denser near the water (top_bias), plus 9 dark-blue ripples bending down |
| Crown accents first like diseased dots, then camouflage squares | Thirty-odd little oak-leaf shapes "printed" on instead (two autumn colours, translucent); the crown's lower-right shade crescent widened (offset 40, 46 px) |
| The acorn's branch hidden by the crown, the acorn floating | The right crown shrunk so the branch tip and fruiting twig stick out; trunk and branch layers under the crown |
| Handwriting order wrong: "little" written back-half first, the opening l last | The start point picks "leftmost after de-italics": the key from x − 0.3y to x + 0.35y (right-leaning letters have tops right of bottoms); at 720 wide hairlines broke — the text mask gains 1.6 design px of stroke width |
| Follow-drawn hills and slopes' front edge a 120 px fog band | Soft edges were proportional to layer width (0.06 × 2000 px): capped at 14 design px, the front edge a crisp wet rim |
| The green hillside fully painted 0.2 s in, a vertical "cliff" beside the tree | The opening draws only tree and inked horizon; the hillside's green and far hills go in the "looking at leaves" second (1.95–2.9 s), the left stretch first (`pre=`), the rest following the roll (`follow=`) |
| Digging soil grains falling into the grass | Grains below the ground are not drawn |
| The digging's first frames cropping the acorn with a straight edge | The mound pops 0.1 s into the dig, covering the clip edge |
| Confetti tiny and all over the text | Confetti enlarged (10–19 px), bursting below the text and spreading wider (spread 1500, start width 640) |
| At 12.5 fps the roll turns 40-50° a frame, jumpy | 15 fps; GIF delays are centiseconds, so accumulated rounding writes 7, 7, 6 alternating, averaging exactly 15 fps |

## Ballpoint doodle (ballpoint.py)

| Problem | Fix |
|---|---|
| Snake too thin like an earthworm, pieces unreadable | Snake heads 54 / 44 / 38 px (about half to sixty per cent of a cell), head wider than neck; snail and clouds 1.1–1.3×, the cloud's face 84 px |
| Ladder rungs and grid lines crossing the snail and cloud | Pieces first; the later snake, ladders and grid lines `clip`ped by the pieces' masks (strokes stop before what is drawn); the grid's colour also avoids snake and pieces |
| The hop's red dashed arcs like zigzag Vs | One 14-point parabolic arc per hop (24 px high) with an arrowhead, no three-point spline |
| Hop counts 1–4 over the square numbers, "1" invisible on a grid line | Arcs spanning the cell's lower 0.4, numbers at the arc's crown offset 13 px right, clear of lines |
| "+24!" split by a grid line, "nooo~" squeezed by sweat drops and the cloud | Whole annotations inside one empty cell; the cloud keeps one side sweat drop, hands removed |
| A fold crease as one bright white line across the picture | Crease valleys only 0.1 deep and 3 px wide, a little wobble along it, reading mostly from the two sides' different slopes |
| Blind indentations from the page above like embossed white letters | Blind groove depth ×0.55, faintly visible only in raking light |
| Handwritten letters colliding (slow read as dow) | Each letter's advance from its own jittered size, tracking default 1.04, advance jitter down to 2% |
| Colons, i and ! losing their dots | Skeleton components smaller than 0.11 of size drawn as dots, even single pixels |
| Ink gloops after square numbers like decimal points | Small digits' gloop down to 0.15 |
| A gap in the snake head's outline; nostrils and mouth like extra eyes | The head's arc to ±148°, body sides from the path's 4th point; nostrils and mouth removed — ink eyes, pencil blush and red tongue only |
| The red dashed arrow along the ladder crossing the snail shell | The arrow on the ladder's piece-free side (+40 px), clipped by the pieces' masks too |
| The groove's bright rim beside ink lines too strong, like embossing | Groove lighting gain 0.16 → 0.13, clamped ±0.1 |
| GIF: snake and grid pencil colours quantised to earth brown | A two-part palette: 150 colours median-cut from "coloured ×5" samples, 104 more cut only from coloured pixels (saturation > 0.12); 49 frames about 0.6 MB |

## Overlay sheets (overlay.py)

| Problem | Fix |
|---|---|
| Three tracing sheets stacked, the whole picture grey and dirty, backlit formation like marble | Tracing transmission 0.955 → 0.98, formation amplitude 5% → 2% at a finer scale (6 / 22 px); the base sheet's formation only 1% |
| Under a lifted sheet everything blurred into one dark mass | Diffusion blur σ 5.5 → 2.8 px (tracing), shadow opacity 0.30 → 0.22, the part of the shadow falling under the sheet halved again (room light comes through the paper) |
| Tape like a grey plastic sheet | Tape is crepe paper: half transmitting, half reflecting room light (I·T·0.58 + T·0.36), colour warm cream `#f7ebcf`, crepe and fibre darkening only 3–4% |
| Tape on the yellow park an olive blotch | Tape never over colour blocks: on paper edges crossing blocks, or another corner |
| A curled corner a grey diagonal band like a dirt mark | The shadow band narrowed (0.11R, darkening only 7%) with a crease highlight; curls only on blank margins — the blue sheet's curl where layers are densest removed entirely |
| Knocked-out stop numbers unreadable | Knockout means "the layer beneath shows": a stop over a dark landmark (station, market hall, castle, lighthouse) turns its number dark grey. Move stops onto pale streets, parks or water |
| Walk route and tram line stacked on one street into a purple-black line | They share the road in separate lanes: tram 4 px left, walk 6 px right |
| The tram line crossing the street name "STATION ROAD" | The name moved to another street, or deleted |
| 8–15 px slivers of blocks between park and road, like a dashed line | Recursive-split leaf blocks thinner than 12 px by short-axis thickness (3.46 × short-axis sigma) dropped as open ground |
| GIF 5.1 MB: every sheet landing re-encoding whole textured regions | See section 4: only re-send pixels that clearly changed, the lamp-on cross-fade undithered; 1.9 MB |
| After skipping small changes, contour-like blotches in the lightbox gradient and on the sea | The difference split into a smooth component (2 px blur) and a detail residual judged separately; 900 ms keyframes chase the smooth component to within 3 steps; lamp-on frames sent pixel-exact |

## Pastel UI (pastelui.py)

| Problem | Fix |
|---|---|
| The magnifier over the four-day forecast: columns 86 px, the lens covering "Mon" and clipping half of "18°", the pink selection becoming two bars in the lens | Three days instead (113 px each), dates and temperatures 66 / 76 px from the icon centres — just outside the lens; lens radius 47, magnification 1.42, the lens seeing only that rain cloud |
| The green marker over the text's lower half like a strike-through | The marker's bottom edge about 0.22 em below the baseline (32 px text: drop 7, height 13), under the feet only |
| About 100 px empty under both panes | Body line pitch 70 → 72, the first line down 10 px, the progress bar against the forecast card |
| "Per [document wallet]: passport and tickets are in" reads awkwardly | The ref chip opens the line: "In [document wallet ✓], passport and tickets are in;" |
| On the mint field the step strip and pills go green, clashing with PASS green | Screens with ✓ / ✗ use the blue field (accent blue); green reserved for pass |
| The back easing finishing 99% in two steps, five-step pops reading as instant | Window and panel pops six steps |
| GIF: the orange critter and spark going pink, green badges cyan, the cream disc dithering pink | These colours are small and appear late, so median cut gives them no slots: the whole UI palette (47 exact values) forced into the palette, the last frame sampled ×8 |
| 84 stage snapshots in memory, peak 1.27 GB | `stage()` stores PNG-compressed bytes (compress_level=1), peak about 0.54 GB |

## Exam grading (grading.py)

| Problem | Fix |
|---|---|
| The red ring crossing the "=" | "6 (days)" left one space (about 11 px) — not enough for a 3 px ring and margins: the candidate leaves two spaces after "=" (about 23 px), the ring 12 px from the "6", 11 px from the "=", 18 px to the right |
| The leader crossing the whole answer box diagonally, long and messy | In the grading column "Notes" is the first row, level with the faulty line, the leader a gentle arc |
| Stamps covering the grading column's captions | About 104 px per row, stamps 60 tall at size 28, centres about 42 px below the caption baseline |
| One stamp end too pale, "WRITING" unreadable | The light end's pressure 0.52 → 0.58 → 0.64: still dry at one end with the thin border breaking, but legible |
| Red ink like computer type, no density variation | Red absorbs strongly in green and blue, so past density 0.8 it barely deepens: let density float about 0.74 (pressure ±0.20, two mottle scales, turns pooling up to +0.26, measured about 0.4–1.2), edges +0.18, bleed blurred 1.7 px; note text mottling at 0.7 × size, so one letter carries light and dark |
| The wavy line a sine curve | Period and amplitude both drifting on 1-D noise, the whole line sagging slightly |
| The binder clip's handles like two hairpins | Real clips: each wire handle spans the whole clip — legs at both ends, one beam on top; two drawn, the rear lower and in shadow |
| The stamp block a biscuit, its knob a chocolate ball | Wood grain ran the wrong way (high frequency along the long side): high frequency across the block, low along it plus a twist; the knob same-family wood with turning marks and a dark ring at its root |
| A teal ring on the paper when the stamp presses | The shadow colour was tinted green for the felt and went teal on beige paper: near-neutral (0.15, 0.14, 0.12) instead — on felt the shadow is still green |
| The score ring's top over the "7"'s head | Ring vertical radius 0.66h → 0.70h, 0.30h more sideways, starting at −118° upper left |
| 113 stage snapshots of 1920×1080 | Give `stages_dir` so `stage()` writes PNGs immediately (compress_level=1), peak about 0.78 GB |

## Shadow puppetry (shadowpuppet.py)

| Problem | Fix |
|---|---|
| Screen like a white wall, colour printed on paper, not glowing | Halo falloff too slow and hotspot too white: halo radius to 0.47W × 0.64H, base brightness 0.20 → 0.10, the hotspot pressed to amber (1, 0.75, 0.37) with deep-orange edges; a soft-shouldered tone curve, lights only slightly blooming |
| Clothes like fishnet stockings, holes everywhere | Hollowing too dense: large robes keep solid colour, patterns only in stretches (26 cloud heads on the skirt, 17 scales on the chest, one cloud run on the sleeve), trousers one dot column on the outer seam only; one pattern cell at least about 12 px on canvas |
| Puppets spindly, long-necked, small-headed | Torso widened to about 90, legs shortened (thigh 100, shin to sole 116), head ×1.15 separately, the neck joint down 7 |
| A black mass at both shoulders | Both upper arms carried shoulder guards stacked on the cloud collar: only the near arm keeps one |
| A raised arm covering the face | Side-on, the shoulder sits right under the head, so a near arm past about 140° crosses the face: high raises use the far arm (up and back), the near arm slanting forward-up (130–147°); the final pose one hand high (far arm back-up) and one low (near arm forward-down) with a knee raised |
| A puppet at d = 0.05 wholly blurred | Blur grew too fast and the double shadow too small: σ = 0.5 + 16d, scale 1 + 0.30d (the two wick shadows about 5 px apart), giving one crisp shadow plus a soft double edge, not defocus |
| Frieze and brackets lit orange all over | Spill computed from the whole cloth, including behind the wood: only exposed cloth counts (× (1 − wood mask)); wood faces are dark, only edges near the glow keeping a warm rim |
| Brackets just a few thin lines | One quarter-circle carved panel instead, hollowed in the middle with wide rims, three volutes inside |
| The ball in the goal's eye like a pale flower | Too pale and too many holes: solid ochre, a red core, six black seams, one lens hole per panel, radius 28 |
| Two red figures crowded (plumes sweeping a team-mate's head, a hand on the captain's back) | Plumes for the leaning kicker, the mate a three-pronged crown, spaced to 262 / 612; the kicker yielding left, foot inside the left post |
| GIF: bright red and green trousers quantised to brick and grey-green | Puppets appear last, so uniform sampling averaged these away: the final frame sampled ×8, then 105 colours cut only from the last frames' saturated and cool colours (teal, green), six k-means rounds, last-frame p99 error 34 → 16 |
| The lamp's final flicker costing 360 KB | Every flicker changes the whole cloth, resending whole frames: one dimming only (7%); lighting up trimmed 7 → 5 frames |
| Peak 1.2 GB building the stage | Relief lighting computed full-frame: now segmented along the lintel, the two pillars and the sill, far spill at half resolution, gate and floor band at 2×; peak about 0.8 GB (stages about 0.9 GB) |

## Pen & wash (penwash.py)

| Problem | Fix |
|---|---|
| Cards like scraped walls, washes grainy like pencil | Tooth lighting 0.42 → 0.20; wash grain 0.35 → 0.14, brush streaks 0.18 → 0.08 (background blocks 0.2 / 0.12). Grain and streaks only just visible |
| Nose, tongue and crumbs as white rings | Small regions were still slipping 3–5 px and leaving 2 px gaps, squeezing the colour out: `wash()` scales slip, gaps and edge jitter by the region's equivalent radius (under 16 px shrinking proportionally, floor 0.22×) |
| The little whistling "o" under the beard read as letter p | A circle under a beard is a letter: removed, whistling carried by the two notes beside it |
| The red domed helmet read as a toadstool | Red top + white vents + one big highlight is a mushroom: cobalt helmet, dark vent slots, coral stripe, no big highlight; brim over the eyebrows with both eyes peeking out below, so "helmet too big" reads |
| The watering can like a kettle | Body leaning about 14°, the long spout slanting out from the front base with a rose head of little holes, the handle arcing over the top |
| The white apron ellipse like a snowman's belly; a blue-sleeved white chest read as a penguin | A round white chef body + a narrower cobalt bib apron; the pocket outlined only — as an uncoloured part it becomes a white hole turning the apron into a "6" |
| The child's second eye, nose and tongue outside the face outline | Features inside the head's outline, only the nose bumping the edge; the handlebar in front of the face, never crossing it |
| The transparent barrel shadowless, floating on the table, with an orange glint | Transparent parts' shadow density 0.62 (solid is 1), caustic brightening only 0.10; a little matte on the barrel (+0.08) reads plastic, not glass |
| Wood grain like laminate flooring, breaking suddenly mid-plank | Each plank generated separately with 1–2 cathedral arches; never `np.roll` texture (it breaks at the wrap), a fresh plank right of the butt joint |
| Pens too small, the table's lower third empty | True scale: at about 9 cm card width the fineliner is longer than the card (640 px, r 16), the water brush 600 px, r 24 |
| GIF: pale blue and sage background blocks going grey-teal and beige, yellow clothes orange | Oak is itself saturated, so "saturated ×5" gave all slots to the wood: 56 colours cut only from empty table, 198 only from pixels differing from it; last-frame p99 error 35 → 23 |

## Retro gouache (gouache.py)

| Problem | Fix |
|---|---|
| Background like sausages with round heads, colour jumping block to block | Every stroke landing fully loaded does that: the under layer's long strokes nearly one colour (vj 0.012), drying only at the tail; the lighter and darker scumbles landing half-dry (load 0.72–0.74, dry about 0.5), catching only tooth peaks and breaking into streaks; the imprimatura laid as one thin flat coat first, then strokes |
| Hat and face like plates, the rim lit rather than the surface | "Blur then square-root" pillows are flat-centred and steep-edged, and the light too lateral: height normalised to the mask's inner value then square-rooted as a dome, light gaining a frontal component (−0.44, −0.56, 0.70), relief default 0.55 (faces 0.45–0.5) |
| Skin shadows purple-grey in patches | `ramp()`'s default cool leans violet — right for clothes, not skin: skin a warm five-step (#c0705d → #fbe3cc) or `ramp(..., cool='#a02a3a')`; `model_form`'s default ambient 0.08 keeps mask edges off the deepest step, so same-colour sleeves stop sprouting stray dark strokes at their edges |
| The big red nose like camouflage | Caused by large opaque strokes laying steps: `sphere_shade` with small strokes, alpha 0.55, density 3.2, wet base 0.9, soft 0.3 at ramp boundaries |
| The rain hat read as a sun helmet, brim like a swim ring, raindrops like rivets and pearls, ties like chopsticks | Crown seams and ties removed, the crown lowered and rounded; the brim not pillow-modelled — height all 0 flat, the drooping sides shaded, a dark edge below, a bright edge on top; raindrops translucent: yellower and more saturated than the hat, an amber shadow lower-right, a small caustic glint opposite, tiny white highlights, scattered — never in a row |
| The little fish read as a bird's head | The mouth outside the head became a black ball, the eye against the rim rolled white: mouth into the snout with a pale lip ring, eye only slightly off-centre; fish enlarged, bright silver over the navy sweater |
| Scarf like a neck pillow or sausage, steam from nose to cup like a runny nose | One U-ring with round ends hanging off the shoulders: wrap twice instead, the lower coil on the shoulder casting on the upper, the hanging end drawn first (behind both coils); two steam wisps leaning from the cup's mouth, stopping on the scarf, clear of the nose |
| A tower of curls like cinnamon rolls | Every curl brightest at centre with concentric strokes: curls become rings with dark hollow centres, the bulge at 0.5 r; curls down to about 30 at radii 34–60; plus hundreds of upward-combed long strands and a few flyaways joining them into one hairdo (no deepest colour in that pass — dark long lines read as scratches) |
| The collar's two leaves like cushions | Two puffy collar leaves to a notched flat lapel (relief 0.25), the red turtleneck's V showing beneath |
| Texture landing on parts in front (turtleneck ribbing on the lapel, coat highlights on the cup) | `knit`, `rib`, `dry_highlight` multiply or add onto paint already in the mask: masks first multiply by (1 − parts in front) |
| Hat and coat large clean areas, like plastic | Missing the final dry highlights: `dry_highlight` dragging half-dry pale colour only where lit > 0.62–0.7; domes take `angle='fall'` (down the slope) — 'contour' draws a whirlpool |
| GIF: pupils and lid lines going blue | Median cut's darkest colour was the sweater's navy: three dark neutrals forced in, plus 9 more cut only from last-frame pixels with error > 18 |

## Blue picture book (bluebook.py)

| Problem | Fix |
|---|---|
| White streaks all through the blue background blocks, like scratched chalk | Pressure mottle and lanes were changing coverage — at pressure 0.7 thirty per cent of paper showed: coverage only from `pressure` (about 0.95) and tooth; mottle and lanes change pigment density only; tooth only half dragged along the stroke (`streak` 0.45), leaving fine white specks inside |
| White paper greyed and dirty | Tooth's value on white 0.022 → 0.012, print specks 0.016 → 0.009; paper to a whiter #fbfaf5 |
| Ink dots like spiky blots | Dot radii random per vertex: low-frequency variation round the ring instead |
| The bear's furry outline a broken dotted line | Little arcs too short and dry: 16–30 px long, gaps 0.62 of the mean length (arcs overlapping slightly), dry 0.12, gaps left at 12% of positions |
| Coral flowers and the umbrella's reflection browning on dark | Wax's translucent mixing (colour × base^0.55) darkens over deep teal and blue: accents on dark grounds use opaque `medium='gouache'` (reflection alpha 0.8); large items like umbrella and hair reserved white in the background blocks (`avoid`), crayon on white paper |
| Later colour covering ink lines, the eyes' white highlights gone | Ink coverage kept in `K`; later colour multiplies by (1 − 0.9·K); highlights `over_ink=1`, chalk 0.5 |
| The umbrella arm crossing the child's face | Both arms leave the right shoulder, reaching up on the head's right: confirm the arms' x at head height exceeds the head's right edge |
| Grass blades and scribbles on the bear's legs and the child; boots white with a few grey lines | `blades`, `scribble` take `clip=1 − foreground mask`; the small boots filled first with near-black opaque gouache, scribbles over |
| The bear greyed and blue | Too much pale blue shading, hatching and rain on the bear: shade only a narrow strip at the far right, hatch rows 14–16 apart at density 0.6–0.7, only 45 rain strokes on the bear, powder blue |
| The bear's nose at the umbrella's edge, not "only the nose is dry" | The muzzle lengthened left (rx 80 → 92), the nose centred in the umbrella's rain shadow; rain leaving a dry column under the umbrella by slant, splashes and hanging drops on the crown and ears |
| Scribbled darks a comb, one black band across the page | The dark mask's top edge was straight, all turns on one line: thresholded blobs of "darker downward + low-frequency noise" instead (deep teal shrubs 0.66, blue shrubs 0.9), strokes 5.2 px in 4.6 px rows overlapping into a mass; blue shrubs navy not black; shrub baselines wavy |
| The snail as a mustard disc on a bench back | The back removed; a pale blue glass pane added to the shelter (opaque gouache, alpha 0.82), the snail on the seat, eyestalks and the small smile in front of the pale glass to be visible |
| Far trees flat painted balloons | Smaller, nearer the sky at #a3c1e2, two overlapping into an irregular crown, vertical dry trunk strokes; the tree behind the child deleted, lest it read as a balloon behind her head |
| Lines like marker: too thin and even | Main outlines about 20% heavier (child's head 5.2, bear fur 4.2, umbrella 4.8), `swell` 0.3–0.35; `outline` re-traces a stretch 35% of the time, offset 1.5–3 px |
| Rain like digital rain: equal length and density | Deep blue 560 strokes (10–40 px), cornflower 260, chalk white 240 — three values, lengths spread |
| The duck's head entering the sky block, tinted blue | Ducks lowered and added to the background blocks' `avoid` |
| A background block's corner dry stroke poking past the paper | Edge-hugging dry strokes `clip`ped near the block's border |
| The print step greying the paper, the GIF's last frame darkening | "Black lifted to ink" was mixing 5% dark ink overall: now c0 + colour × (1 − c0), whites untouched, only black lifted |

## Jiangnan garden (jiangnan.py)

| Problem | Fix |
|---|---|
| Crowns as noisy green balls ("broccoli") | Each clump lit as a dome; the dark base paints the clump cores then 1.7× larger dark leaves (the base's edge itself leafy), leaves breaking the silhouette, bright leaves in 5–14-leaf clusters only where lit value is high; 24 clumps at 0.15–0.34 sizes for a broken silhouette; trees behind the house far 0.3, the row behind 0.4–0.6, bluer and flatter with distance |
| The willow one lime-green curtain | Willow strands 3–9 to a tress with gaps between; leaves 3–5 px, width only 0.28 of length; rear tresses darker and bluer, front lighter and yellower, the lit side brighter still |
| Thin black arcs over the willow's top, like umbrella ribs | Boughs first, then a hanging-leaf crown covering them, thirty per cent of strands emerging from the crown, so the crown's top is never a hard line |
| Near willow strands like braids | Leaves strictly alternating made herringbone: hung randomly to one side, splaying 0.18–0.5 rad from the stem, varied lengths; only 34 strands, each sparser, leaves thinner (width 0.22) |
| The zigzag bridge a row of grey railings lying on the water | Too near, too large, railings too high, posts too dense: the start pulled back to 15 m, rails 0.5 m, a post every 1.9 m; at 3 m eye height the near railing hides the whole deck — only the far railing kept (many zigzag bridges have one side only), so slabs and joints show and the zigzag reads |
| The bridge deck a plank floating on water | Deck sides and pier normals inverted, camera-facing faces culled: normals (−e_z, 0, e_x), so deck thickness and piers appear |
| The stone bridge pitted like granite | Canvas texture 0.07 → 0.025, each face only a slight value jitter |
| Vertical streaks on the water too heavy, like rain | Fine verticals 3.5% → 1.3%, vertical blur 9 → 14 px; plus horizontal strokes sampling the water itself, so it reads painted |
| Lily pads cartoon plates with red rims | Curled rims showing red backs only 12%, rims thinner; the near half's darkening alpha 0.45 with the inner edge at 0.55 / 0.3 (no longer a ring line), the far edge one pale rim; pads in clusters, not covering the water |
| The white blossom tree a mauve-grey cotton mass | The flat dark base shrunk to 0.55 of clumps and turned green-dark, underpainted with dark petal and deep leaf strokes; clusters ×1.5 with 12–25 petals each, sunward petals whiter |
| Flat mauve-brown blotches in the pink shrubs | Smooth elliptical dark bases to stroke-built ones (45% deep leaf + 55% dark petal), ellipses only at clump centres |
| A black square mid-window like a hole; with paper, like a blank sign | Side windows take the papered ground; the lantern brocade's empty centre shrunk to 40% wide, 34% high |
| The openwork window blocked by willow strands | Moved to the wall stretch between moon gate and teahouse |
| The roof dead black, no tiles readable | Tile ramp lifted; pan tiles' lit side 0.6, tile lips +0.3 with shadow −0.26 below, brighter toward the eave (mirroring sky) |
| The flying egret a white feather | Wings wide and swept back, five primaries at the tips, the far wing greyed, neck tucked, legs trailing |
| Far hills fully hidden by trees, no depth | Two ridge lines raised 40–70 px; a 60 px fade at the feet (else the GIF's first frames show a hard line) |
| The far bank's right a whitened fog wall | Bank shrubs and little trees added down to the water |
| Flat light, no spring sun | Leaf dapple on walls, platforms and the bridge (thresholded cold blotches, heavier nearer the casting tree; on the bridge limited by its mask, never darkening water); the eave shadow 0.42 → 0.5 |
| All trees alike | A tray pine behind the wall (needles fine, barely drooping); white little flowers and curved, rim-lit iris leaves in the foreground (were stiff green spikes) |
| Wall and water too clean, like vectors | A faint stroke layer on the wall (alpha 0.6, value −3.5% to +2.5%); finish adds softness, lit halo, teal shadows |

## Dry-brush blocks (drybrush.py)

| Problem | Fix |
|---|---|
| Blocks full of "ladder rungs" perpendicular to the stroke, like crayon hatching, not dry brush | The anisotropic noise was an upscaled coarse grid — aligned columns thresholded into rungs: white noise blurred along the direction (done at 1/f resolution then pulled back); dry-brush teeth a mix of bristle streaks + drag marks + tooth, dried places clustered dots of varying width, never hairs |
| Whole empty columns in places | 1-D blurs used zero-padded edges, darkening texture tile borders — blocks or wrapped strokes hitting them left empty columns: textures wrap instead |
| Rungs still on curved strokes | Pillow's thick `line()` quantised segment directions, about sixty per cent of pixels assigned to the wrong segment: one floating quadrilateral perpendicular to each segment with round joins, plus a half-pixel offset fix (median error −0.7 px) |
| Concentric rings at stroke ends | End texture coordinates pinned: texture extends past the tip along arc length; drying starts later (`dry_from`), landings blunter and fuller |
| Tines reaching too far, trailing long tails | Tines grow only from the soft band, the body's scumble lightened too |
| The coat neat parallel stripes, hatching up close | Each pass broken into strokes of varying length and value (`stroke_len`); the dark half nearly solid (`load` 1.02), the navy strokes dragged across it 4 → 3; lit and dark halves brushed in different directions |
| One block NaN in the first version | The soy-sauce bottle passed `dark=None` and mixing used it: no dark, no mix |
| Hat like a beanie, beard like a wizard's goatee, bowl small and flat | Cropped white hair instead (dry scumble on crown and temples, another colour on the shaded side), a wider shorter white beard, a bigger deeper bowl |
| White hair too tall, like a wig | The hair outline's top pressed down (−1.12 → −1.06); at delivery the hair still reads slightly wig-like |
| Steam first wires, then a scumble band of grey fog | Low-pressure strokes only touching a few long tines read as lines; steam removed in the end |
| The backdrop slab like rain, vertical stripes everywhere | Both passes shared one texture window, seams against seams: each pass its own window; the reference's slab is roller's flat fine dots, not bristle streaks: `tooth='roller'` and `scratches()` added, `backdrop()` defaulting to roller |
| The backdrop's dry specks landing on the stroke starts' top edges | Dry-rubbed edges weighted by direction, only on the stroke-direction sides, landing edges kept clean |
| Glasses like sunglasses | Lens darkness 0.45 → 0.22 |
| The near arm merging into the coat | The sleeve navy with a little teal, separated from the coat's lit half |
| The hand first like bread, then a cork | Seen from the thumb side: a lit back, four alternating fingers (the lowest in shadow), dark lines between, a thumb above, one dry knuckle highlight, a beige cuff and sleeve separating it from the coat; at delivery the hand is still the weakest part |
| The bowl rim's dry tines like speed lines | Bowl tines 14 → 5 px, bands 16 → 6 px |
| Dark streaks on the porcelain bowl showing the black coat behind | At contact pressure about 0.97 the texture window's variation leaves about 7% gaps, glaring on dark: `load` allowed above 1 (cap 1.08), the bowl at 1.05 |
| The nose invisible, its tip a mouth | The cheek shade's boundary pushed out (0.18 → 0.34), the nose side darker brown, a bright bridge stroke, a smaller warm tip and a shadow beneath |
| The teal block's scumble too busy | Scumble 0.2 → 0.07, drying postponed to each pass's later stretch (`dry_from` 0.72–0.95) |
| `jacket(light=+1)` raised an error outright | The dark half's x range had its bounds swapped: the dark half chosen by light direction |

## Twilight storybook (twilight.py)

| Problem | Fix |
|---|---|
| NaN leaking in the first sky | The cloud envelope sin(πu) dips slightly below 0 at the ends, then ^0.55: clipped to 0..1 first |
| Clouds thin lines | Rewritten lens-shaped: one flat lens plus 4–5 rounded masses (higher mid), blurred outlines, flatter crisper bottoms, lighter above and denser below |
| The dusk-night boundary grey fog | The transition band re-saturated (`richness`), the night side near the boundary leaning indigo (indigo lifted), boundary noise scale 90 → 170 at half amplitude: dusk → mauve → indigo → black |
| After the re-saturation, a wall of neon violet | `richness` 0.9 → 0.5, indigo pressed back a little |
| The dusk-night boundary a straight diagonal | The boundary polyline a six-point arc (night pressing over like a dome), the transition 150 → 185 px |
| Lavender too deep and loud, clouds melting into sky | All six stops lifted and desaturated; clouds slightly darker, their tops mixing toward pale at 0.4 → 0.22 |
| The Milky Way's rift too weak | A brighter narrower core added, the rift narrowed and deepened (`rift` 0.65 → 0.8); at delivery the band still smoky, the rift still weaker than the reference |
| Too many, too large four-point stars, some near the boundary and horizon | 9 → 6, sizes 9–17 → 7–13 px, only where nightness > 0.8 and 180 px above the horizon |
| Crest flowers a dense bright band | Coverage falling with distance (0.24 + 0.32 t, t 0 at crest to 1 at the bottom edge), distant flowers sinking into the hazy ground (`haze`) |
| The kite deep in night, greyed blue by nightness shading | The kite moved into the transition band, keeping its coral |
| The character's sunset-side rim grey; warmed, it became a hard brown band | Rim warm apricot, 3 px inside the contour, blurred 1.4 px, at most 0.6, fading downward |
| The inset's target marker invisible on the coral kite | Marker ring and leader fixed to deep ink (`leader_colour`) |
| Inset labels overflowing the disc, dimension numbers on lines | `dimension()` numbers placed on their "upper" side away from the object; the spanning "14" collided with the bridle: removed, replaced by an `across=True` "ø 6" diameter note led outside the member |
| Patchwork stripe fields like flags | Field colours desaturated and closer together, ridge undulation increased, hedge lines 0.45, fading at the bottom |
| Stage snapshots missing grain, vignette and torn edge, mismatching the final | `finish()` records parameters and applies in render — moved before the first stroke |

## Hatched nocturne (nocturne.py)

| Problem | Fix |
|---|---|
| Concentric whirlpools in cloud puffs, like Van Gogh's sky | Strokes followed clump tangents everywhere: inside puffs they follow the rising column (with the wind at the top), tangents mixed in only at the rim (radius 0.55–0.97), at most 0.75 |
| Isolated black dots all over sea and clouds, like dirt | Tooth gaps are single pixels letting the dark ground show: tooth pre-dragged along 8 directions, each stroke reading its own, so misses stretch into short streaks; default pressure 0.9 → 0.95, sea and reflection 0.96–0.975; ground from #0a0f27 to #0d1331 |
| Lava rivulets like lightning striking the sea | Straight segments with big forks in yellow-white: a walk with momentum (always turning toward its end, leaving the summit down the slope), branches forking only 0.18–0.5 rad; emission colours pressed to 0.3–0.92 on the ramp (mostly orange-red), only beads and the front yellowing |
| As a walk, rivulets looped like spaghetti | Turn noise too strong and pull too weak: per-step turn 0.035·wander (decaying 0.85), pull 0.16–0.46 |
| Where lava meets the sea a smooth white blob, like an explosion | Light as radiating stroke rings (yellow-white → orange → red, ramp starts 0.28–0.72); the smooth white core shrunk to 0.11 r, bloom 0.18; flattened sideways (0.6); two small hot sources along the entering rivulets |
| The lit cloud salmon pink | Orange screened onto blue-grey is pink: lit clouds `glow(blend='paint')`, colour = light × receptivity + a little dark ambient — that is red-orange; a very faint added layer only on the brightest base |
| The steam column's base like flames | Upward long strokes, saturated yellow-orange, a dark seam in the middle: strokes near the source `whiten` 0.6 toward warm white (steam is white), base puffs mixing more tangent (curling), bright strokes at pressure 0.97, density 1.8 |
| The sky's pale short strokes like falling snow | Too many, too bright, too short: only on noise highs (in patches and bands), density 0.35 → 0.16, length 18–42, width 1.1–1.7, value only 0.3 over the ground |
| The sky saturated royal blue, not night | Sky and sea ramps darkened and desaturated toward indigo and cold grey-blue; zenith value 0.04, horizon 0.6 |
| White horizontal lines at the reflection's side edges | Mirror sampling pushed by ripples onto the beige paper margin outside the picture: sampling coordinates clamped inside |
| Orange-red patches on the reef, like lava there too | The reef is far from the source and its rim too strong: rim 0.9 → 0.14; the figures' rim 0.45 |
| The plate mark's lines running to the paper's edge | Distance to four infinite lines was used: distance to the rectangle instead, the top and left dark lines only within it |
| The final image's picture area ringed brown | Bloom blurred the beige margin's brightness in too: bloom samples only brightness inside the picture |
| The far island invisible | Too low and the horizon sky's colour: island raised 10–15 px, the darkest land ramp |
| The two figures invisible on the dark sea | A small patch of pale glitter behind them (short horizontal strokes, outside the reef) sets the silhouettes up; figures 40–44 px, the scarf the only bright colour |
| NaN on lava paths | In float32 sin(π) is a tiny negative, and ** 0.8 gives NaN: clipped to 0–1 first |

## Obsidian UI (obsidianui.py)

| Problem | Fix |
|---|---|
| Graph links crossing label text ("Fox", "B612", "Lamplighter"), text garbled | Labels stroked first in a 3 px pane-colour ring (`text(halo=3)`), links stopping short of words; nodes placed so links enter from above or the side |
| "Six planets—Little Prince—Snake" nearly collinear, reading as one line through the centre node | Nodes either side never on one line: both sides lowered (+40 / +22 px), the two edges a shallow V |
| The graph "growing" seventy per cent full by frame two, like popping in | The circular reveal's easing ease-out → ease-in-out, 6 → 7 steps, soft edge 40 px |
| In the GIF clicking "Reading" shows no click: the violet click ring on a violet button | The ring very pale violet-white (#ece4ff), radius 34, 3.5 px, three frames scaling 0.4× → 1.15× while fading; the button pressed lightly (0.97) then released (1.06) |
| GIF self-check EOFError | The final stage (status bar) identical to the finished image, Pillow merging identical frames: quantised frames identical to what is shown are not stored separately, their duration merged into the previous frame |

## Canvas board (canvasboard.py)

| Problem | Fix |
|---|---|
| The red card's ground browning like old wood | Card tint 7% → 5% (`tint`), the border carrying the colour |
| A card's lower half empty; another card's last line over its frame | Card heights follow content: `Card` blocks return their tops, `Card.y` the next block's position — lay out content, then set height; checklist line pitch 1.62 → 1.72 |
| The timeline's vertical line invisible | #4a4a4a at 2.5 px vanishes at 0.72 zoom: #4d4d4d at 3 px, grey dots #6a6a6a, the last dot violet with a pale halo |
| An edge label like "Arrive 13:30" covering most of a short edge | Only 120–160 board px between groups: the label shrunk to "13:30", anchors moved to 0.84 / 0.7 of the card sides, giving the curve an S |
| The floor plan's handwritten "Bed goes in first" on the route's bend; beside the desk, it reads as about the desk | Beside the route's start (outside the front door, under the plan's bottom edge), on the same line as the lower-left "About 68 m²" |
| Card "drops" with back easing finishing 78% in the first in-between — popping, not falling | A new drop easing: accelerating fall by (u / 0.72)², then a 6% bounce settling; starts 110 up, 5% larger, half transparent, big shadow |
| When loose cards drop, the camera bounces too | `tween()`'s camera takes `cam_ease` separately (default io) |
| The quote card's text revealing with the bounce, shrinking as it bounces | After the card settles, the two lines are written in their own `quote` stage |
| GIF: camera pans leaving faint ghost blocks and vertical stripes | Group grounds (#212121), card shadows and board (#1c1c1c) differ by about 5 steps — inside the 7-step "unchanged" tolerance, so panned-away pixels were not resent: camera-moving frames tolerance 1, other in-betweens 6, keyframes 2 |
| GIF 1.51 MB, over budget | The fixed Bayer dither re-encoded whole camera frames: the board is flat, never banding — Bayer removed; pan 7 → 6 frames, down 5 → 4, zoom out 8 → 7, 1.36 MB; after the ghost fix 1.47 MB |
| Peak 0.78 GB at stage time | Zooming needs a new float size every frame and the font cache grew forever: cleared past 160 entries, peak about 0.62 GB |

## Flexoki paper (flexoki.py)

| Problem | Fix |
|---|---|
| Heavy titles in PingFang Semibold too thin for that Black-heading look; Lantinghei Heavy heavy enough but a different letterform | PingFang Semibold plus a faux-bold stroke of size/50 px (about 1.2 px on a 62 px title), Latin SF Pro 800 |
| Legend values in SF Mono reading "30  g", digits and units too far apart | Legend values default to the text face; mono only for indexes, time ticks and code |
| The sequence's time column in the faintest #B7B5AC, decoration not information | #878580, medium; the faintest grey only for indexes and axis ticks |
| Two-row cards' seams misaligned (row one split at 1000 / 1024, row two at 616 / 640 and 1136 / 1160), seams everywhere | Sequence and comparison cards all 640 wide, the right column sharing the 1136 / 1160 seam; the flowchart card widens to 1016, row one's gap 50 → about 89 px |
| Flowchart row two's two edges unequal (122 / 158 px) | "Pour in two stages" centred between "Serve" and the diamond's left vertex, both edges equal |
| GIF self-check EOFError: the hold after the last action identical to the last action frame, Pillow merging identical frames | Frames unchanged after quantisation are not sent separately; their duration added to the previous frame |
| GIF: large paper areas off by a few steps (last-frame median error 2) | Pillow's palette quantisation searches a reduced colour cube: exact nearest-colour lookup in numpy (computed once per colour, cached), colours within 2 steps of a Flexoki value snapped to it |
| GIF: the red "no", pale yellow notes and violet dots' edges going orange and grey (single-pixel error to 49) | These saturated intermediates too small for median cut: 60 slots cut only from saturated pixels away from Flexoki values; pixels over error 20: 478 → 166 |

## Warm pencil storybook (pencilbook.py)

| Problem | Fix |
|---|---|
| First version full of large white specks, like crayon on rough paper, not pencil | Too much mid and large scale in the tooth, and each stroke covering too little: tooth mostly 1 px grain (1 px 0.6 → 0.8, 2 px 0.45 → 0.38, 6 px 0.25 → 0.12, 22 px 0.12 → 0.05), default pressure 0.62 → 0.74, some wax settling in pits (`floor`, finally 0.34), strokes lighter (alpha 0.9 → 0.62) in more passes — specks fine and tinted |
| Modelled shadows scattered dark dashes, like rain | Shadows came only from landing probability: the region doubles as per-pixel pressure (`fade` = region^0.65) with landing probability its square root, so shadows grade smoothly |
| The early hillside showing through the later shell, its lower half greened | Pencil is translucent and later colour mixes with what is beneath: foreground masks (tortoise, tree, post, child, stones) computed first, sky, hillside and water `avoid`ing them, like a painter reserving the subject |
| Moss covering half the shell like turf with a triangular-toothed hem | Only the crown's band, as dozens of overlapping individually lit pads; a ring of small pads and scattered clumps at the hem, hanging strands of long moss |
| After the pads, green mildew patches on the shell | The main band's pads dense enough to merge: two rows per position, radii 26–42 |
| Grooves between scutes pale lines outlined dark | Grooves are unpainted gaps between scutes: deep brown lines drawn along (u, v) boundaries (two passes, broken), a pale gold rim added beneath |
| Scute boundaries straight lines, the shell like joined boards | Rib boundaries bulge slightly outward mid-span, each scute lit as its own dome (cream-yellow lit side, ochre-red shaded) |
| Four legs straight posts, the tortoise a table | Front legs stepping forward, hind legs kicking back, feet widening toward the water; the far legs tucked behind the near ones, pressed dark; a cool shadow under the belly; the tortoise down 34 px, showing shorter legs |
| The neck a square striped cardboard | Neck flat-topped with a drooping underside (loose skin under the throat), folds forward-bowing arcs at uneven spacing, three throat pleats |
| The child too small, face unreadable, hair exploding | Height 172 → 206 px; hair spreading from just above the crown in long nearly straight locks (curl 0.1 → 0.03), tips half-gathered — that is a bob; blush radius 0.3 → 0.2 of head radius |
| The child's face melting into the pale water behind | Skin one step darker (the pale base cream to light pink), a very faint same-colour contour round the face; legs cornflower / denim tights, not powder blue |
| The lantern's glow radiating like star rays | Glow strokes randomised along surrounding surfaces (never radiating), density 1.3 → 1.0–1.1 |
| A paper-white ring round the pole lantern | The blanking mask used for the sky was larger than the lantern: the lantern's own colour is solid enough, no blanking |
| The cloud base's warm colour a thin line, outlining the cloud | Only the cloud's lowest 26 px band sampled then blurred, rose removed |
| Rim light on the shaded side | The lit side is where the mask's gradient faces the light: side = 0.82·gx + 0.45·gy — the sign was flipped |
| The shell's warm rim painted onto moss, a pale arc in it | Rim only on bare shell (minus moss, hanging moss, crown and post) |
| Stripes across the post like a candy cane | Slim things never cross-hatched: strokes follow the post (`contour()`), crossing angle 26° → 8° |
| Crowns a yellow sponge | Clumps smaller and more separated (0.42–0.7 r from centre, radii 0.3–0.44 r), each lit alone, shade ochre-red, gaps between clumps |
| GIF 1.58 MB, over budget | Ordinary cross-fades change the whole sky and stream slightly each frame, re-sending fine pencil texture: each pixel completes its transition in only about 2 of 5 frames (ordered by soft noise plus a left-to-right sweep, like pencil laid patch by patch), 0.99 MB; removing Bayer made it larger (1.67 MB) |

## Colour town (colortown.py)

| Problem | Fix |
|---|---|
| The sky's horizontal streaks too visible, like brushed metal | Sky mostly scumble (0.35), horizontal streaks a separate translucent layer (0.25) |
| Clouds a grainy grey mass, dirty | Cloud texture 0.8 → 0.22, the underside transitioning to warm grey only, no grain |
| Window frames' corners drawn twice, messy | Box corner overshoot probability 0.5 → 0.28, overshoot 0–1.8 → 0.3–1.3 px, non-overshoots within −0.4–0.3 px |
| Window boxes a thin band with a few dots, not "overflowing" | A leaf mass piled above the box (2.4 × box height): leaves dark outside to pale inside, flower dots on them, big ones with pale centres, vines trailing in front |
| Roses strings of red dots; pink roses with white highlights, like bubbles | Blooms irregular cups (radius undulating over 4–5 petals), a darker heart, three dark petal arcs, a pale rim mixed with the base colour (never white), two leaves tucked beside each; pink roses on pale walls, red on white |
| Shutter slats dense and black, like striped blinds, the wall busy | Slat pitch 2.6 → 3.6 widths, opacity 0.45 → 0.32; shutters on only some windows (`shutter_p`), 0.3 on near white walls |
| Two dark arched openings above the clock tower's clock, like eyes | Three narrow louvred openings instead (pale wood slats) |
| Two trees invisible behind front-roof rows | Trees drawn after the back row of houses and before the square-edge houses, crowns raised |
| Crowns an even pale-green print with a smooth outline | Each clump lit as a dome, lower clumps first, pale only on lit tips (the ramp's palest yellow-green removed); the dark base shrunk to 0.9×, leaves scattered to 1.06×, so the silhouette is leaf-edged |
| White walls greyed and dirty | Pale colours' texture and mottle scaled by brightness (0.72–0.95 down to about 45%), the foot glaze 0.13 → 0.1 |
| Walls like planks, vertical brush too heavy | Walls take `PLASTER` weights: scumble 0.7 + vertical 0.5, mottle 1.2 |
| Reflections' vertical edges stepped; below, photographic grey blur; horizontal scan-like lines on the paving | Ripple scale 6 → 18 px growing slower with distance, per-column smooth offsets added, stretching vertical farther; paving scumble; after the reflection the joints re-inked faintly |
| A dark ball at every figure's feet (mirrored heads) | No more mirror-drawing figures: `mirror()` reflects the actually drawn pixels, a vertical tail fading downward at strength 0.35–0.5 |
| The largest near bunting hanging across the clock face | The rope's height at the tower's columns computed first and the endpoints moved, passing below the clock (about y 684, the clock ring's lower edge about 616) |
| The florist's sign cream letters on cream, invisible | `house()` gained `letters`; the florist takes deep teal-green |
| Colour too full — near walls as saturated as the middle, nowhere for the eye to rest | The left canyon wall to pale pink, white and pale yellow, the right white walls, saturated houses concentrated in the middle cluster; white and cream houses mixed into every middle row |
| Hillside houses as identical boxy rows, like shelves | A row generator: widths, heights and plinths all randomly offset, about twenty per cent pointed gables, ten per cent narrow tower houses, fifteen per cent terracotta, attic windows random among round, square and arch |
| One parameter change reshuffled the generator's stream and a house covered the tower's lower half | The stretch in front of the tower (x 300–520) fixed as its own row, lowered, no pointed gables |
| Cleanup fixed a coordinate bug shoving stones off-frame; exposed stones differing 7% checker-boarding under reflections | Stone value spread 7% → 2.5%, joint colour near stone (#a29f98), so beneath reflections it is wet flagstone |

## Pastel vignette (pastelvignette.py)

| Problem | Fix |
|---|---|
| Coat strokes grains of rice and rain: short, narrow, uniform, square-ended | Both ends taper by along-position (round landing, flicked lift), width 18–34 px, length 70–180 px, soft sides 0.6 of the half-width, colour varying only within the lit ramp (plus a 46 px-scale noise), never jumping light-dark |
| `ragged()` growing blue islands far outside the coat | Noise was added to the blurred mask then thresholded, so zero-mask areas crossed too: the threshold itself wanders 0.14–0.86, the edge only wavering near the original shape |
| The hem a torn-paper edge; faded, a frost band of white dots; strokes dragged down, paint streaming | The rubbed base closed by a smooth fade field, breaking into tooth specks less at the edge (the flat layer's `edge` 0.9 → 0.15, the modelled 0.5); dry strokes' landings running about 45 px past the base, per-pixel pressure and dryness following the same fade; hem strokes slanting toward the centreline along the hem's folds (left half upper-left to lower-right, right half mirrored, at most 32°), never straight down |
| The coat's dark strokes like scratches: bright bristle streaks glaring on dark | Dark strokes widened to 20–34 px, lengthened to 90–180 px, soft sides 0.85, streaks 0.2, alpha 0.45 |
| The cat's body an unfurred orange flat in front of her neck | The flat, modelled and furred masks disagreed (the flat included the neck stretch, the later two removed it): each layer's "visible part" computed once from front-to-back occlusion and reused |
| The cat over her shoulder a uniform orange tube (a feather boa), the neck a long pink column | The cat wraps the neck from the front: thick at the chest by its head and at the haunch (130 px), the belly thinner (88 px) and drooping; a hanging hind leg and paw added on the far side, draping with the tail in front of the coat; the neck showing only a short stretch below the chin |
| Cat fur like a hedgehog: bright stiff spikes all over, a bristly rim | A wide soft stroke layer first on the lit ramp (5–10 px, alpha 0.55), main fine tufts alpha 0.5–0.55 at density 0.45–0.6; the silhouette's `fluff()` fixed in count (900 head, 900 body), alpha 0.45–0.5, colour from a few px inside |
| The cat's eyes flattened by an orange lid, like anger; the tail tip a cut tube | Cat eyes `lid=0`, only the dark rims; a ball at the tail's end, cream fur tips over it |
| Hair a helmet parted centre; the right forehead bald to the crown | A side part: a sheet swept from the part to the temple added on its right; the hair's outline pushed out by low-frequency undulation (amplitude 12 px), locks waving beneath |
| The fringe following the face's outline, the forehead still a full egg | The fringe's lower edge crosses the forehead: high at the part, low at the far side, slanting across 20–30 px above the brows |
| Hair combed parallel fine lines | `strands(lock=(14, 10))`: a lock per 14 strands sharing root area, offsets, bend and shade, the fall's flow undulating ±24° by sin |
| Long straight lines flying off the crown, like scratches | Flyaways at the hair edge kept to 50 (fringe 14 more), bend 2.0, offset 20°, alpha 0.6 |
| Lashes a comb; the eye white ringed round the iris, staring | No individual lashes; the line flicks out at the outer corner (`flick` 0.32–0.38); the upper lid covers the iris's top (`lid` 0.12 → 0.2) |
| Brows thin and choppy, inner-high, worried | A soft pastel band first (1.25 wide, alpha 0.35), then one 0.7 wide (alpha 0.55), fine hairs 40 → 24 at alpha 0.7 → 0.45; the arch centred, the inner end not raised |
| Blush too faint and small, not the reference's big circles | Radius to 60–76 px, strength 0.6 → 0.72 |
| She reads as a child | Eyes low in a round face is a child's proportion: the eyeline to the head's true middle (face-local v 20 → 2), chin narrowed to a point, eyes a size smaller, nose lengthened; smaller eyes alone do not do it |
| The nose only a red dot | `nose()` gained `shade`: the bridge's soft shadow 0.28 → 0.5, plus the red tip |
| The pencil town behind a grey stain | The grey rub kept at 0.16, fading down and sideways, mostly pencil lines only |
| A second eucalyptus sprig crossing the main one in an X; leaves in a ladder | The second sprig removed; leaves staggered ±0.3 spacings along the stem, angle jitter 8° → 14°, sizes 56–108 px |
| Peak memory 0.92 GB | Rasterised sub-pixel arrays int64/float64 → int32/float32, batches splitting into y-bands past 2.5M sub-pixels; the 8-direction tooth stored uint8 (66 MB → 17 MB); `contour()` computed only near shapes; the scene's 37 retained masks and lit fields float16 on assignment: 0.74–0.77 GB; against the pre-change output, p99 differs 0 steps, only 1141 pixels near the cat's head over 10 — invisible |

## Poetic Halloween (poetichalloween.py)

| Problem | Fix |
|---|---|
| The ghosts' light lighting the whole hedge bright green and orange, night becoming afternoon, "one glowing accent" gone; a translucent bright band at the hedge's top | Point falloff 1/(1+(d/r)²)^1.2 → ^2, ghost light radius 2.2 → 1.15 body widths, `illuminate()`'s base 0.3 → 0.15; receptivity a blurred hedge mask, never hard-edged |
| Leaves like starfish: lobes thin, pointed and face-on, each half lit half dark along the midrib, the hedge flat like collage | Lobes widened, notches shallower (0.42–0.56 of radius), serration heavier; each squashed randomly to 0.55–1× (seen from the side), the fold's value gap 0.22 → 0.16; each casting a soft shadow down-right first (about 0.1 leaf-length offset, 0.06 blur), giving the hedge depth |
| The flush like a rash: two coarse red patches under the eyes | Specks on the single-pixel fine texture `ST`, the smooth red layer dominant; the flush's field a band round the eyes (denser below) crossing the nose bridge, cheeks a very faint, almost speck-only red |
| The nose only a red dot | `nose()` treats it as a small volume: a tube along the bridge with a round tip, modelled by light, a violet-grey (0.55) on the shaded side, the tip's shadow below, reddening downward |
| The face a flat white mask | Modelling dome scale 44 → 84, light further left, the ramp reaching 0; a soft violet-grey rim, grey eye sockets, a little shadow under the near cheek, a very faint warm pink on both cheeks; the face's lower half shortened, chin rounded |
| The neck a white rectangle | The scarf up to the chin, hiding it |
| The hat wrong three times: a pointed witch hat like an elf's; a soft tube on top like a rhino horn or teapot handle | A slouchy burlap cloche: a low dome, a short downturned brim (weave following the brim's arc), loose twine hanging from the brim's edge, a twine band with a small bow |
| Rusty through-lines in the burlap like stitching or a grid | `burlap(rust=...)` defaults 0 |
| The far hair sheet like a headphone; the fringe black goggles | The whole hair shaded up one lit ramp; that sheet's dark edge only on the face-hugging inner side (multiplied by a mask near the face); the fringe's upper half its own sheen band, plus a low-contrast fine strand layer |
| The cupped mittens like a crab or two bread rolls; with the jar, the mittens hiding it entirely | Mittens smaller, holding the jar's lower half from both sides, thumbs in front; the jar enlarged to 148 wide, 204 px tall |
| Scarf and mitten reds louder than the ghosts' glow | The wool ramp's ceiling 0.85 → 0.68–0.7, the scarf's light receptivity 0.8 → 0.45 |
| A whitened rim round the sleeve's top corner | The sleeve's top highlight only on the forearm (multiplied by two soft patches near it) |
| Peak memory 1.07 GB | Full-frame `wash()` computed in row bands; function orientation fields evaluated only where used; `soften()` blurring only near shapes (scene and library mask blurs both switched to it); render in row bands; print grain precomputed in `ground()`; rasterisation 800k sub-pixels per band: 0.71–0.81 GB, also 12.4 s → about 10 s |

## Oil-pastel portrait (oilpastel.py)

| Problem | Fix |
|---|---|
| First version the figure too small; hair a helmet with a black ribbon hanging behind; the face's pale skin reading as plaster under wax thickness | Half-length on a square canvas, face enlarged (face-local to canvas 0.92 → 1.25); hair no longer falling from behind the ears to the neck; no skin base — the face is the paper, peach only on the shaded side and under the chin; wax thickness weakening with paleness (pale weakest), amplitude ±7% → ±5%, blur 1.1 → 1.5 |
| Gloves two translucent pale-blue panes showing the coat's strokes; navy streaks in the cup's mouth | The coat's `spill` shifted its whole mask down, running into the tops of the holes left by gloves and cup: the coat's fill takes `avoid` (the union of everything in front) |
| At pressure 1.0 still twenty per cent white, the second layer not covering the first | Tail drying ignored `dry`, always relieving the last 22%: now scaled by `dry` (`dry=0` never dries); within a batch the top stroke wins, its soft sides and dry tail carving the stroke below white, so `fill()` defaults to 3 passes with side relief 0.2 → 0.12; waxed paper's take-up 0.3 → 0.55. Same patch measured: white 23% → 6–15% (by `dry` and `streak`) |
| The coat snowing: white specks too many, too large | The tooth's 9 px layer weight 0.3 → 0.18; body pressure 0.84 → 0.96–0.97, a drier extra layer only at the hem (0.88, `dry` 0.42) running out |
| Eyes two small black blocks staring | `eye()` rewritten: the upper lid pressed by `lid`, the iris to 0.42 of eye width drawn only inside the opening, the outer corner thickened and flicked; looking down by the lowered lid, never by moving the iris |
| Brows like pen lines: thin, smooth, pointed both ends | `brow()` taper 0.55 → 0.4, side relief 0.45, width 13 → 17–19 px |
| Hair like a beret: a hard horizontal edge at the forehead, strokes sweeping right, bulging past the face on the left | The hair's outer contour hugs the forehead on the far side; the flow field aims just above-left of the bun (not the bun itself), forehead strokes rising then sweeping back; base density 2.4 → 1.8, then 70 tapering long strands from the hairline clipped to a slightly enlarged hair mask (a ragged but contained outline); one lock at the temple |
| Fingers a row of white slats with black lines, like a barcode | Each finger a round-capped tube: a pale peach layer, a peach line on the underside, one deep peach stroke at the tip, black lines only beneath the fingers; fingers resting on the darker kraft sleeve |
| Gloves two pale-blue ellipses | Colour deepened (cool / cool_deep halves), the near one a wedge from knuckles to wrist with rows of pale short bars as stitches, an outer black line, ribbed cuff |
| The scarf coils' ends like brush heads | The flow field followed the contour, going horizontal at the ends with tines facing out: each coil a fixed vertical field (−86° / −90° plus a little perturbation) |
| The hem stopping on a ruler line | `spill` ran the same distance everywhere: each edge stretch its own distance (26 px-scale noise), the sleeves spilling too |
| A large peach mass on the face's near side (profile, neck and ear merged), a black line over the ear | The profile's peach a band hugging the contour only, density 1.4 → 1.0, plus a peach jawline; the scarf raised against the jaw, the neck a small glimpse; the ear's hair strand cut short above the ear |
| Two black vertical bars under the cup like legs | The hem layer no longer mixes black — navy and deep navy only |
| Steam a broken dashed line | `wisp()` break probability 0.25 → 0.1, segments 40–110 → 70–160 px, width 8 → 15 |
| Square corners at the coat's lower sides (elbows) | The sleeve mask multiplied by the coat's; the coat outline's closing spline overshooting at the lower corners, points added |
| Peak memory 0.99 GB | Scene masks uint8 instead of float16, keeping only visible parts and a few whole shapes needed later; rasterisation 0.9M → 0.6M sub-pixels per band: 0.76 GB, output differing from before only p99 6 steps |

## Sketchbook doodle (sketchbook.py)

| Problem | Fix |
|---|---|
| Hair parted centre yet a bald round forehead, the two locks like horns | The part's point on the forehead lowered (y 527 → 548), the hairline sweeping from there to the temples like two curtains; hair avoids only the "visible face" (the face ellipse minus above the hairline), not the whole face |
| Hair curled in ringlets: amplitude 4.2 px, period 64 px, phase turning 2.5 times across a lock | Period 110 px, amplitude 5 px, `wave_root` 0 (straight at the crown, bending downward), `cohere` 0.6; 34 strands a side |
| Fingers a row of big white claws (4 per hand, 18–23 px long, 13 px thick) | 3 per hand, 13–15 px long, about 9 px thick, tilting with the book |
| The yellow sun on the teal book cover turned green; the yellow daisy clip in black hair invisible | Colours multiply — pale over dark only darkens: the spot reserved inside the cover's fill and the hair first (`avoid=`), then sun and clip drawn |
| The stool's rear leg showing between her legs, like a third leg | Removed; the stool keeps its two front legs and one stretcher |
| The sleeve outlined with `tube_pts()`' closed contour, a horizontal stroke across the shoulder at the start | The sleeve outlined as one open line (both sides plus cuff), the start hidden in the shoulder |
| Leaf side veins poking out of the leaf and flying far | Side vein ends written "leaf-edge point × w + midrib point × 0.1" — the weights do not sum to 1, pulling points to the origin: w and 1 − w |
| The figure perfectly left-right symmetric (sleeves, legs and shoes mirroring), like a vector icon | One leg hanging higher and further out, both toes turned in; the book tilted −4°; the right arm's coordinates given separately, never mirrored |
| Both steam wisps curling a little loop on top, like springs | Only the first curls, its radius following height (at least 9% of it), the rest fainter, shorter, uncurled |
| Blush a smeared pale pink (strength 0.72, edge blurred 0.9 px) | Strength 0.95, edge blur 0.7 px: one crisp round pink dot |
| The kite boy: hair locks drawn separately with crown gaps, like a wig; the red lips like lipstick | One `hair()` call with six guides fanning from nape to fringe, hair between every neighbouring pair (the separated sides naturally flicking up); the mouth an upcurved line with a dot of red beneath |
| The full square page downscaled to 405 px in the GIF (0.25×), hair-thin ink nearly invisible | The GIF crops 1100×1100 round the drawing first, then scales (0.37×); see section 4 |

## Flat spot illustration (spotillo.py)

| Problem | Fix |
|---|---|
| The head floating above the collar on a stick neck | Pose presets lower the head (standing head centre −5.5 → −5.2 head heights), the neck a short paper-white tube with only a fine front line; the chin nearly touching the collar |
| The near arm merging into the same-colour sweater, unreadable | Near arms and legs take `gap` (white seams), arms `gap_keep` 0.92, legs 0.85; the first version's gap threshold comparison was reversed — only about 8% of edges had seams, fixed |
| Two parallel white arcs on the crown, like closed eyes on the back of the head | White hair strands short and nearly straight, staggered, running with the hair toward the face |
| White Z folds in the elbow like lightning | One soft arc inside the bend plus a short one beside it |
| Hands claws: diverging red lines on the mitten tip | A gripping hand's front edge carries four finger bumps, the fine outline following them, red lines running back from between fingers to their roots |
| Hair a smooth helmet | The hair outline's undulation wavelength 80 → 34 (`lumps`), two tapered tufts at the nape; beside the chin on a lying figure it read as sideburns — removed |
| The stove a grey box with two black dots, like a face | A cabinet instead: a wood-toned top, door seams, a row of small knobs, two handles |
| The armchair's back like a surfboard; with arms, a giant cushion covering the legs over a heavy dark base edge | Back lowered with a rounded top; arms thinner and shorter, laid over after the person (`armchair()` returns `'arm'`); the base the chair's own colour, separated only by white seams |
| The sleeper's chest an upright open book like a box | `book(open_='tent')`: a closed book is a low solid "^" (the back cover) with a pale page edge beneath and a white spine line; the first attempt failed because 'tent' is also truthy and took the open-book branch |
| Red-socked feet like red boots | Socked feet drawn narrower, rounder-toed, no sole or outline, 0.44 head heights |
| Two z's stacked into one big Z | z's smaller and spaced, one stroke each |
| Cat food and bowl the same ground colour, invisible | Bowl `wood_light`, food `wood` |
| Rain only on the left, landing on the tote bag | Rain both sides, none in the umbrella's column, a dry patch round bag, leek and legs |
| The bench's `y` was the seat, unlike chair / stool / table (`y` the ground) | Unified: `y` ground, `h` seat height |
| 'cap' indistinguishable from short hair | Short hair gains a hat in its own colour (`hat`): crown, brim, one seam and a top button |
| Blank paper exported to JPG as flat digital white (sigma 0) | Tooth 0.6% → 1.2%: blank corners 0.49 steps (reference 0.44–0.48) |
| The first 16:9 as a 3 + 2 grid at 64 px head heights, vignettes tiny, a big empty middle | The tall umbrella one occupies the left column, the other four a 2 × 2 on the right, head heights 84 px |

## Grainy picture book (grainbook.py)

| Problem | Fix |
|---|---|
| Streaks in large skies long and hard, like slanting rain | Streak grids 60 × 3 → 26 × 3.6 px × k, streak colouring slope 3.2 → 2.2, `streak` default 0.35 → 0.28, sky 0.3 |
| Shape edges clean vector edges, not the reference's fray | Edge-threshold noise was nearly all streaks and meso: streak 0.42 + tooth 0.6 + meso 0.35, blur 1.7 → 2.2 px × k, threshold band 0.40–0.60 → 0.35–0.65; the frayed ring 7% darker (`rim`) |
| With coarser grain and more specks, the page like scattered sand | Tooth back to 1 px-scale fine grain, `G` gaining only one about 1 px clustered layer; speck rates bright 1.2% / dark 0.9% down to 0.5% / 0.35%; `scumble`'s colour skipping keyed to streaks (`skip=0.8`), not salt-and-pepper |
| Sky bands horizontal hard edges, like a flag | `bands(blend=)`: each colour dry-brushed up into the one above (about 40 px × k, coverage 0.4), layer edges fraying |
| `mottle` patches like camouflage floating on sky and snow | Patch edges widened (threshold ±0.015 → ±0.05, `edge` 1.8, `soft` 2.5, `dry` 0.55), differing less from the ground; ground pale patches via `scumble` |
| Flanking pines neat and spiky with snow dots, like Christmas trees | `pine()` tier lengths random 0.62–1.22×, 14% of branches empty, angles ±9°, the dark trunk showing only at the base; falling snow about halved |
| The child in a red hat, white brim and pompom, like Santa's | Hat mustard yellow; red reserved for scarf and mittens |
| Chimney smoke a run of slanted little blobs, like doodles | `smoke()` three large faint rounds, streaks 0.15, dry edges, growing up against the chimney mouth |
| Window light laying square patches on the snow, like reflections in water | Removed |
| A path tramped from cottage to frame bottom like a light shaft | Removed; large faint dark blotches on the snow instead |
| The dog long-bodied with straight legs, like a table; white belly like taped-on | Body to 0.33×, diagonal legs trotting, white moved to the chest |
| Snowflakes landing exactly on the child's eyes | `snow(avoid=face)` |
| Walking, the scarf's tail flying sideways like a wing | The tail hanging back-down from the far shoulder |
| Big eyes' pupils nearly filling the whites, like two black buttons | Pupil radius 0.27 × (width + height) → 0.25 × width |
| Long hair one black curtain, the face set in a wig | Hair mass biased away from the turn (behind), narrow in front of the face, ragged tips; the sitting girl `hair_len` 0.75 |
| The crumb-tossing hand like a thumbs-up | An upturned palm leaning forward as a flat ellipse, no thumb |
| The red-coated child against the red house, merging into the wall | Coat to a contrasting colour (bright blue in the example) |
| Colours greyer than the reference (mean chroma 87 / 78, reference 72–134) | Cobalt, vermilion, orange and peach snows pushed to the reference's measured colours, mean chroma about 100 |
| Far-ridge firs a few px tall, invisible | Portrait 70 → 95 px, wide 46 → 66 px |

## Dreamy hills (dreamhills.py)

| Problem | Fix |
|---|---|
| Grass banded in horizontal stripes | Strokes sorted by root y then composited in chunks, each chunk's tips joining into a bright line; the sort key jittered ±1.2 blade lengths, chunks no longer straight rows |
| Warm key and cool sky summed in RGB, hills a greyish mauve | Two ramps instead: light computes value only, colour from `warm`, mixed toward `cool` by the sky's share |
| Exposure too high, values crushed at the ramp tops, hills bleached | `expo` 1.45 → 0.62 (lavender) / 0.6 (ember); values mostly 0.3–0.75 |
| A whole hillside one colour, unreadable which way it faces | The normal's sideways component used to vanish one `foot` down: the smoothed ridge slope retained, a dome's left half facing left all the way |
| Light bands' height field stepped by integer distance, fine vertical striping on slopes | Linear interpolation along the distance direction |
| Troughs only darkened, still the same orange — no air between hills | Trough occlusion takes the key first (ao²), skylight once, so troughs cool (navy at night, lilac at dawn) |
| At night the shaded side sprinkled orange grass, the terminator smeared | Per-blade normal jitter too large against a very narrow warm-cool boundary; `jitter` per palette (lavender 0.24, ember 0.07), tips biased to the key 0.3 → 0.1 |
| Night hills like day: all front faces equally bright | The key moved from frontal to a side-back rake (−0.85, 0.38, −0.05), left-facing slopes lit, fronts and the right sinking into navy |
| Cumulus cotton balls stacked in rows with vertical seams | Puffs on a dome front with one or two rounded heads, a row of overlapping large puffs holding the base, small puffs breaking out above; normals from the blurred height field |
| Dark fine creases across the cumulus | Front puffs' own soft edges let sky leak past them: coverage the union of all puffs' soft discs, the height field's slope limited to 2.2 |
| Little balls floating free above small clouds | Small puffs only hugging the body (within 0.2 of their radius of the nearest large puff's edge) |
| A square bright frame round the lantern walker | The halo smoothstep-ed to 0 before the patch edge |
| The night sky almost starless | Stars about 10× too dim (0.06 → 0.5), Milky Way dust 0.02 → 0.28 |
| Foreground grass thin and see-through like straw, flowers colour dots | Grass 2.6–6 px wide × k at opacity gain 1.6, brightening only toward the tips (`tpow` 2.2), taller brighter; flowers 13 px × k on the tallest tips |
| Noon's distant blue-hazed hills grey-pink | Saffron fog to warm white, a mid-ground hill added |
| The walker standing, strides too small | `stride` 0.5 → 0.9 |

## Sunlit greenery (sunlitgreen.py)

| Problem | Fix |
|---|---|
| Leaves scattered as uniform coloured confetti, like noise or broccoli | Per-tone layered shapes instead: each tone one whole mass, only its edge stamped with outward leaf clusters; light and shade from sub-clumps packed in the big domes, each bright on its sunward face |
| Solid tone blocks' edges mushy, smooth round clumps showing under leaves | Solid blocks thresholded with about 1 px anti-aliasing only; near trees `fill=0` leaf-paved, only the darkest layer a solid base |
| Sky holes straight-edged blue polygons, like leaked colour | Hole colours lifted toward pale sky, three leaves pressed over each rim, hole outlines becoming leaf-bitten concavities |
| "Confetti" leaves like crystals or diamonds | Pointed oval leaves mixed with 9-sided round leaves |
| Bright masses one even yellow-green | `mottle`: some leaves swapped a tone up or down, bright and dark interleaved |
| Crowns a packed solid ball | `airy`: coarse noise hollows the clump's outer zone into sprays showing sky; noise finer than about 4 leaves gets refilled by edge leaves, invisible |
| Cumulus stacked balls, one with a hole | Clump height fields melted before normals and three tones; coverage closed once, filling small holes |
| The house drab, wall light patches nearly invisible | Walls a cool pale grey-blue base (shaded), patches warm cream screened at strength 1, so light and shade separate |
| Floor leaf shadows spilled paint or little animal silhouettes | Shadow masses' edges rings of outward pointed leaf clusters, leaves to 34 px × k, sun-fleck sprays halved |
| The sill's sun patch a straight-edged white band cutting the cushion in half | Cushions painted lit directly, then cool leaf shadow `dapple(mode='shade')` over |
| Cushions flat boards of one colour | `soft()` gained `dome` for mid relief, `levels='q'` quantile-cut tones |
| A lone dark-blue ellipse at the pot's foot, blue dots at stone bases, like holes | Pots cylinder-banded vertically; `soft(clean=...)` merges too-small tone islands |
| Bark strokes teardrop dots, like leopard spots | Fine long along-the-trunk strokes differing only slightly in colour |
| Water uniform green dashes, no reflection | Reflections: the whole picture flipped, each band offset sideways, smeared and compressed to a dozen colours, cut by horizontal strokes; far a mirror, near sparse |
| Water grey-green with no sky light | Bed olive-teal with saturated pebbles, near reflection coverage 0.08 → 0.32, `reflect_scale` 1.4, the sky's blue reaching near water |
| Stones floating on the water | `wet=`: underwater parts dyed, the stone's own broken reflection, a bright ripple line at the waterline |
| Stone steps like ladder rungs floating | Steps set into a green slope with shrubs covering both ends, a dark seam under each tread, treads dappled |
| The foreground potted plant a ladder of plastic leaves | A small ficus with a `canopy()` crown instead (`hole_colour` the wall colour), one clump of large dark leaves near |
| Evening patches still pale cream on pale walls | `sunlight(tint=...)`: a little amber multiplied after the screen |
