# 02 · Mechanics: why the "Art History Speedrun" works

This page is the mechanism of "speedrun / traversal" films: one fixed scene, swapping a style or an era (art-history speedrun, 100 years of a city, one person from 18 to 80). Films of this class can all be built on the five layers below; explainer films, story films, and single-style shorts do not follow it — compose those for the subject.

## The five-layer mechanism

**1. One fixed scene skeleton.** Across 16 eras the window, table, cat, person, and year sign barely move (±40px). The audience's eye has anchors, so "what changed is the style" reads clearly. And because positions are fixed, transitions can originate from objects inside the frame (mosaic spreading from the cat's position, an iris opening from the cup).
→ Method (specific to speedrun/traversal films): first fix this film's composition coordinates and align every era to them. In code it is one constants file, not per-segment improvisation. Other subjects do not reuse this room's coordinates.

**2. Each era is a living painting.** Dwell 0.25–1.4 seconds, but the painting never stops: one continuous action by the protagonist (raising a cup to drink) plus 2–4 small loops **taken from that era's own visual motifs** — the cave-painting animal "runs as two alternating poses" (an animation of how cave paintings encode running legs), the Egyptian scarab pushes the sun, the Greek key band rolls, the Roman volcano smokes, the Gothic gold foil glints, the Renaissance ornithopter flies, the ukiyo-e great wave, Van Gogh's starry sky rotating, the Bauhaus pointer, the Pop four-grid color swap.
→ Method: per segment, list "the 3 most recognizable formal elements of this era" and make them move. The motion must be legible within the dwell window (short segments need quicker rhythms).

**3. Transition = the next era's signature language.** Into Egypt: stones/tapestry falling; into Greece: a pottery roller turning; into Rome: mosaic tiles flipping; into Gothic: parchment page turn; into Renaissance: divine light; into ukiyo-e: the Great Wave sweeping across; into Impressionism: brushstroke dabs filling the frame; into Van Gogh: a starry-sky vortex; into Art Nouveau: gold-edged organic forms growing; into Cubism: geometric shards; into Bauhaus: red-yellow-blue geometry spinning and enlarging; into Pop: lightning plus halftone dots; into 8-bit: pixelation; into raytracing: green wireframe → line-by-line render; into 2026: a three-color concentric-ring iris.
→ Method: do not pick a generic one from the transitions library — grow the transition out of "the most recognizable formal elements of the new style". Add camera impact on each transition's first frame (the scene layer scales to 1.03, returning to 1.0 over about 20 frames; the year sign does not scale) — the hit of the beat comes from that.

**4. The beat grid accelerates.** 128 BPM constant, with the eighth-note count per segment decreasing: 6 → 4×5 → 3×4 → 2×3 → 1×3 → an extended ending of 9+. The tempo never changes, yet the feel gets more and more urgent; the final stretch is lengthened to leave room for the joke. Transition durations shrink with it (0.4s → 0.13s), and the year roll shrinks too (0.55s → 0.07s).
→ Method: list the desired duration per segment, round to eighth notes, then fine-tune the whole set into a regular decrease. Every cut, musical onset, and SFX lands on the grid.

**5. One continuous narrative anchor + an ending character gag.** The year counter is the only continuous thing in the film: its value depends only on global time; during transitions the old and new layers display the same rolling number, each in its own typeface (the hand-written cave-painting numeral of 40,000 BC → the reed-pen numerals of 1350 BC → … → the geometric sans of 2026). The ending gives the character a gag (the cat slaps the cup off the table three times, the girl gasps, the signature writes itself), performed fully with anticipation, squash and stretch, follow-through, and secondary action — the first 11 seconds are "watch", these 4 seconds are "laugh", and the laugh is what gets shared.

## Additions (2026-10-04 transfer tests A–D)

- **Protagonist motion continues across segments**: the narrative anchor is not just the counter; the protagonist's actions also run on whole-film time. Redoing the action per segment shows the audience "she raised the cup five times" instead of "the same instant in five styles".
- **With a year counter, segments must be ordered by era**; if reordering is impossible, swap the badge for a sequence number or a style name (engine badges are pluggable). Hard-cut old and new badges at the transition midpoint to avoid overlapping text.
- **When the first segment has no transition to borrow, let the painting "draw itself"** (brushstrokes writing out, print layers dropping in one plate at a time, pixels lighting row by row).
- **The more complex the signature transition, the longer it runs**: the original's shapes are simple so 0.4s sufficed; gold foil, ribbons, and streamers need 0.48–0.5s.

For making the drawing-method layer deep (scene and method as two passes, stroke-by-stroke painting, transitions as the character's actions) see doc 18 and the reference implementation `scripts/engine/reference_films/painted_room/`.

## How to adapt to a new subject

| Layer | This film | For "100 years of one city" it could be |
|---|---|---|
| Skeleton | window/table/cat/person | the same street corner: streetlamp, shop sign, pedestrians, skyline |
| Living painting | era-motif micro loops | each decade's vehicles passing, sign typefaces flickering, things in the sky (kite → plane → drone) |
| Transition | next era's signature language | next decade's medium: burnt film edges, TV static, pixels, scanlines |
| Beat | 128 BPM decreasing | same |
| Anchor + gag | year counter + cat slapping the cup | year counter + the same pigeon stealing food in every era |

## Where not to learn it wrong

- Do not treat "16 eras" as a quota. The mechanism of the speedrun/traversal class is "styles change, skeleton stays"; 3 eras also work. It is not the mechanism for every subject.
- Do not replicate the original pixel by pixel. Replication is a means of learning the mechanism; the deliverable is your version after understanding (Huashu chose a blonde girl + an orange-white cat — swapping characters on the original's skeleton).
