# 01 · Deconstruction: take one animation clip and, within an hour, break it down to something you can code

The goal is not an impression piece — it is a **specification you can program against directly**: start/end frames of each segment, transition mechanics and parameters, in-shot action lists, numeric curves of counters/captions, composition coordinates, and the audio track's grid and instrumentation. Text is the index; numbers and contact sheets are the body.

First live run: 2026-10-04, deconstructing the 15-second "Art History Speedrun" on X (16 art eras, 15 transitions); the whole pipeline took about 1.5 hours (storyboard agent 79 minutes, audio-track agent 22 minutes, in parallel).

## 1. Physical parameters first (5 minutes)

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height,r_frame_rate,sample_rate -of default=nw=1 src.mp4
```
For X videos, take the highest tier from the syndication endpoint (pick the highest bitrate in `video_info.variants`) — do not screen-record. If the source is 60fps, deconstruct at 60fps; frame numbers are the shared language of every later spec (seconds = frames/60).

## 2. Three overview images (10 minutes)

1. **Contact sheet**: 4fps × 480px wide, 30 frames per tile, with timestamps. One glance tells you how many segments there are and what each is.
2. **Keyframe overview**: pick the cleanest full frame from each segment and tile them into a 4×5 grid. The map for all later work.
3. **Spectrogram**: `ffmpeg -lavfi showspectrumpic=s=1600x400:legend=1`. One glance shows whether the music changes instrumentation per segment, whether there are falling glissandi, crack transients, and beat hits. Clean harmonics with a hard cut at 16kHz = code synthesis + AAC.

## 3. Measure transitions and rhythm (15 minutes)

**Frame-by-frame grayscale difference**: downscale to 192×108 grayscale; average absolute difference between adjacent frames. Still segments <2, transition segments 10–37. Threshold 5 plus a 12-frame debounce finds every transition start in one pass. Save as `diff.npy` for all agents to share.

After finding starts, **fit the grid**: if the gaps between starts are integer multiples of a constant, there is a BPM grid (this film: start = 84 + 14.06·n frames, residual < 0.45 frames = 128 BPM eighth notes). Once the grid is confirmed, all timings of picture and music are written as "which eighth note".

**One 60fps contact sheet per transition**: starting 2 frames before the start, one tile every 2 frames for 0.5 seconds — 15 tiles. The mechanism is only readable here — descriptions like "8 vertical bars drop in sequence and bounce back" or "20px squares flip around the vertical axis, spreading outward from the cat's position" degrade to "squares transition" on a 4fps sheet.

**Take the reference frame as "the last frame before the transition starts"**, not the frame you find prettiest. Taking it too early mistakes the previous segment's transition debris (flying rubble) for picture content (the first Egypt version hit this).

## 4. In-shot motion: what actually moves inside each segment (15 minutes)

Motion heatmap: inside each segment's still interval, take the per-pixel maximum frame difference, overlay red on the grayscale base, and mark "share of area in motion".

The result overturned the first impression: it looked like "each segment is one painting", but in fact every segment has 2.5%–34% of its area moving — the cave-painting animal runs as two alternating poses, the scarab pushes the sun disk, the Greek key band rolls, Vesuvius smokes, gold-foil highlights sweep, the ornithopter flies by, the four-grid color swap... **Skip this step and what you build is "transitions between images", losing the continuous motion inside each scene.**

The heatmap tells you "where it moves"; then look into the 60fps frames for "how it moves" (period, amplitude, two-frame alternation vs. continuous).

## 5. How to write the brief when delegating to agents

- Storyboard and audio-track agents run in parallel, each with a complete brief: asset paths, known facts (frame rate, duration, rough segment table), required artifacts (`storyboard.md` / `spec.json` / contact-sheet directory / `audio-breakdown.md` / synthesis script), method requirements (prove with data, not imagination), and reply format (summary + the 3 most uncertain points).
- Have them **correct your list first**. On this film I misread the "1993→2026 iris transition" as a "Memphis era"; the storyboard agent corrected it in its first line.
- Treat omnimodal models "listening" to the track as candidate evidence only: instrument guesses are trustworthy, but BPM (it said 120, actually 128), motif note counts, and "one whoosh per segment" were all wrong — recalibrate with onset detection.

## 6. Artifact checklist (what you should have when done)

| Artifact | Use |
|---|---|
| `storyboard.md` + `spec.json` | Per-segment start/end frames, transition mechanics and parameters, in-shot actions, counter curves, composition coordinates |
| `transitions/T*.jpg` (60fps contact sheets) | Frame-by-frame reference when writing transition code |
| `in-shot-motion/motion-heatmap.jpg` | What moves in each segment, and how much |
| `ending-action/` (if there is character performance) | Per-frame centroid, trajectory, physical parameters (gravity px/frame²) |
| `audio-breakdown.md` + `synth.py` (template: `scripts/audio/synth_art_history_speedrun.py`) | BPM grid, eighth notes per segment, motifs, instrumentation, SFX sequence |
| `keyframes-overview.jpg` + `gen/ref/*.png` | Composition map, reference frame per segment |

Scripts: `scripts/analyze/` (contact sheets, grayscale diff, transition contact sheets, motion heatmaps); commands are in each script's docstring.
