# Reference implementation: one room, sixteen ways of painting it (2026-11-09)

One room, one window, one cat seen from behind, painted from cave art all the way to pixels — 44.4 seconds, 16 painting styles; optionally a character walks in, and every style change is done by his own hand (pulled over, carried along, a jump that splatters, a wave that brushes it in), ending with all 16 styles landing at once. Method notes in `references/18-media-layer-and-character-entry.md`.

This is not the same engine as `scenes/` (01–55): the scenes here do not paint final pixels directly — they hand over "a color map + region-id map + stroke direction per region", and the media pass then paints them stroke by stroke. The same room function swaps media by swapping only that pass.

## Files

| File | What it is | What's most worth borrowing |
|---|---|---|
| `engine.js` | The painting-style engine `window.ENG` | `Scene / add / sprite` (two maps per scene), `paint` (strokes scattered on a grid, following the direction field, stopping at region edges), `brush` (one stroke split into bristles), `contours` (only visible outlines), `tex` (paper, stone, cracks, wood, fabric), and the direction fields `F.dir / radial / ring / swirl / along` |
| `film.js` | The room `room(pal, t, …)`, 10 palette+media sets, `swipes` (mask swept by a brush) | One room function fed different palettes; each media style is a 20–30 line function |
| `film2.js` | 6 more media styles, a 16-segment timeline, a character track, four transitions, camera | `segs / heroAt` (where the character is, what he does), `compose` (the seam follows the hand / rides on him / splatters from underfoot), `HEROMAP` (maps character frames to that era's few colors), `KEEP` (after painting, blend the original frames back a little) |
| `render.py` | Stills, specific frames, the full film (multiprocess, dealt out in 12-frame chunks) | Passing character frames into the page as data URLs |
| `score.abc` | The score: a four-note motif, one instrument swapped in per painting style | Sections and styles share one beat table (100 BPM, 4 or 6 beats per section) |

## Running it

Needs `uv` and Playwright's Chromium (first time: `uv run --with playwright playwright install chromium`); rendering the full film additionally needs `ffmpeg`.

```sh
uv run --with playwright python render.py --stills                 # one still per style, written to out/
uv run --with playwright python render.py --film --workers 6       # full film, 1066 frames, out/painted_room.mp4
uv run --with playwright python render.py --film --audio music.wav    # with your own audio track
```

`score.abc` is only a score; the repo ships no audio. Use any tool that can synthesize ABC notation to wav (see `references/05-rhythm-and-music.md` for the beat-grid approach), or swap in your own music aligned to the 100 BPM beat table.

The full film paints stroke by stroke, far slower than the `scenes/` films — check it with `--stills` and `--frames` first before rendering the whole thing. The impasto and pointillism sections are the slowest.

## Character frames

The repo ships no character frames. Without frames the room still plays, just with no one in it, and transitions still fire on schedule. To have your own character walk in: create the folder `角色帧/` in this directory (that name is a code key — the script's default — and stays as-is), one subfolder per action, containing transparent-background PNGs sorted by filename (about 8 frames per action, character facing right, feet at the bottom edge of the image). The action names below are the exact keys `film2.js` looks up; keep them as-is:

```
角色帧/走路(walk)/  伸手拖拽(reach-drag)/  挥手(wave)/  欢呼跳(cheer-jump)/  思考想通(idea-moment)/  待机眨眼(idle-blink)/
```

Or point `--sprites <dir>` somewhere else. Frames can come from an existing illustrated-frame library, hand drawings, a 3D-to-2D export — any already-drawn character frames.

## Making it your own film

- New subject: rewrite `room` in `film.js`, keeping how it hands over `Scene` (each thing via `S.add({ key, pts, fill, flow, … })`).
- New or added painting styles: add a palette entry to `PAL`, a function to `MEDIA`, a line to `ERAS` in `film2.js`, and a matching transition letter to `TRN` (`TRN` must be the same length as `ERAS`; one short and it errors out).
- New pacing: change the beats per section in `ERAS` and the transition letters in `TRN`; adjust the score's measures to match.
- Before inserting or deleting a section in the middle, look at the `segs` section of `film2.js`: a few actions are hard-coded to section indices (the "idea moment" after `T[3]` / `T[12]`, the moon pull at `T[10]`, the walking-position indices 2/6/10/14 in `WX`, and the `T[10]` push-in in `camera`). Appending at the end is safe; inserting in the middle means moving those indices too.

In the code, a painting style is called an era (a line in `ERAS`); palette and media function are matched by the same id. The second half of `film.js` still keeps the first-version timeline with only the cat and 10 styles (its own `ERAS`, `compose`, `window.FILM.frame`); rendering does not use it — `render.py` uses `FILM2` from `film2.js`; change the timeline in `film2.js` and that legacy section can be deleted.

The end title and the bottom-left year are this film's own content — swap them with the subject (`drawLabel`, and the `T_FIN` branch in `compose`).
