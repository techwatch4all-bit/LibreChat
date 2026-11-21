# Clawd: Night at the Museum · GIF clips

Cut directly from the 98-second finished film *Clawd: Night at the Museum* v2. The full film (MP4, with score) is in Releases. This file does not include the film's project.

- `clawd-vangogh.gif`: 00:28.40–00:33.40, 5s, 720×405, 15fps. Diving into Van Gogh's *Wheat Field with Cypresses* → impasto Clawd runs through the wheat.
- `clawd-trex.gif`: 01:20.50–01:24.50, 4s, 640×360. The T. rex skeleton chases the flashlight spot like a cat chasing a laser pointer.
- `clawd-dawn.gif`: 01:34.00–01:38.00, 4s, 640×360. Dawn; the guard sets down his coffee; Clawd blinks once inside the frame.

Export parameters match the Super Mario set: original speed, 20fps, silent, looping forever, each clip with its own 192-color palette, Bayer dithering, then `gifsicle -O3`. The Van Gogh segment's impasto strokes are so dense that those parameters gave 12.5MB; switching to 15fps, 160 colors, and `gifsicle --lossy=40` brought it to 7.7MB.

## What the film uses

- Style: charcoal night scenes on dark brown paper; color appears only where the flashlight shines; on entering a painting, the style switches to that painter's own brushwork.
- The five paintings entered: Van Gogh's *Wheat Field with Cypresses* (Met 436535), Seurat's *Circus Sideshow* (437654), Vermeer's *Woman with a Water Pitcher* (437881), Rembrandt's *Aristotle with a Bust of Homer* (437394), and Leutze's *Washington Crossing the Delaware* (11417). All from The Metropolitan Museum of Art Open Access, `isPublicDomain: true` (CC0).
- The dinosaur and the elephant herd are charcoal linework drawn from real skeletons and anatomy; the guard appears only as hands and shadow — code never draws a human face.

## Copyright

Clawd is Anthropic's Claude Code mascot; the rights to its likeness belong to Anthropic. This film is an unofficial fan demo, not affiliated with Anthropic; the GIFs and the film exist only to show what this skill can do and are not covered by the repository's MIT license.
