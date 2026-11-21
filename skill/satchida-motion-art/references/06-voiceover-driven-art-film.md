# 06 · Voiceover-driven art short film (method draft, awaiting first real film)

Goal: from a voiceover's expression, produce an animated film with coherent shots and picture, in a chosen era or artist's style. The newest full-film method is in `12-voiceover-full-film-experience-loop.md`.

> ⚠️ This page is a scheme extrapolated from the art-history-speedrun engine and **has not yet run on a real voiceover**. After the first film, delete this line and write the field results back.

## Differences from the speedrun film

| | Speedrun film | Voiceover short |
|---|---|---|
| Timeline | BPM grid | word-level voiceover timestamps (from your transcription tool, e.g. Whisper-class word-level timestamps) |
| Style | style changes per segment | **one style throughout** (one artist / one era) |
| Camera | fixed position | needs camera language: push/pull, pan, shot-size cuts, follow |
| Narrative | skeleton fixed, style changes | style fixed, content follows the voiceover |

## Pipeline

1. **Voiceover → shot list**: cut by sentence; for each sentence decide "what is on screen during this line" (concrete object / metaphor / character action / text), mark camera type (wide / medium / close-up / push / pan) and duration (from word-level timestamps). Show the user a 5–10 row shot list before building.
2. **Style = renderer + palette + line**: pick the closest card from `style-recipes/` as the starting point; for a style that does not exist, write a new renderer per section 3 of doc 04. Produce one frame first (three-direction hard gate: the same frame of the same voiceover line in three style interpretations for the user to choose).
3. **A world, not a frame**: voiceover films cut between shots, so build the scene as a "world canvas" larger than the frame (e.g. 5760×3240) with elements in world coordinates; the camera = a viewport (center, zoom, rotation). The renderer draws the frame the viewport sees, with brush sizes defined in screen pixels — so strokes do not thicken when pushing in. That is the key to "the painting is moving", not "an image is being scaled".
4. **Flow between shots**:
   - Within one scene: viewport interpolation (push/pull/pan) with ease-in-out.
   - Between scenes: transition in that style's own language (Van Gogh = a brushstroke vortex sweeping away; ukiyo-e = the wave; ink wash = a bloom) — layer-3 mechanism of doc 02.
   - Match cuts: the previous shot's shape matches the next shot's shape (cup rim → moon).
5. **Text and voiceover**: keywords can be written into the painting in that style's typeface/brush (mosaic letters, calligraphy, neon); no generic subtitle bars — subtitles belong to the edit pipeline on another track.
6. **Music**: doc 05's grid method still applies, but the grid yields to the voiceover rhythm (transitions and musical accents go where sentences pause).
7. **Acceptance**: watch side by side with the voiceover; every sentence's picture must be telling the same thing; every shot must be moving; the style must be recognizable at a glance.

## Division of labor with the video pipeline

Transcription, timing, mixing, and delivery of the voiceover run in your video pipeline; this skill owns only the "art animation picture" track, producing one silent MP4 or ProRes as the visual track for the edit project.
