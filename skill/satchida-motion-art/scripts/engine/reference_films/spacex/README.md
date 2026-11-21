# SpaceX narration-animation reference code

Scene-code snapshots in four treatments: mixed styles, whiteboard, Vox collage, and presenter. For learning and porting the camera work, keyword time anchors, and layout methods — not a turnkey renderable demo, and not the full engineering of the latest released films.

- `spacex/tm.js`: `TM.cue(seg, 'substring of narration')` hooks actions to spoken keywords; `timing.js` is this example's timing data and must be replaced for a new subject.
- `spacex_wb/common.js`: content framing `fit/declip/shot`, stroke scheduling `build`, stroke-order reveal `so/soAt`.
- `spacex_vox/common.js`: accumulating desktop `item/drawWorld/camEnd`, insert shots, occlusion registry.
- `spacex_lin/common.js`: presenter frame swaps, foot anchor, cross-segment poses and top bar; `tools/prep_presenter.py` demonstrates green-screen frame cutting.
- `eras_*.js`: the four segment tables; `transitions/`: the matching transitions.

## Usage boundaries

1. First copy the parent `scripts/engine/` into your own project, then place the film directories, segment tables, and transitions selected here into the corresponding spots at the project root. Keep the whiteboard segment-table filename `eras_wbx.js`; the actual asset paths are uniformly `spacex_wb/`.
2. The presenter sprites, mixed-style character frames, source-image prompts, and narration audio are not distributed with this snapshot. `presenter_meta.js` only provides the frame-table structure; you must regenerate the assets and metadata with your own character. A frame table being present does not mean the assets exist.
3. Fonts come from the parent project's `lib/fonts.js` and bundled fonts; Vox body text and the typewriter numerals already use the bundled LXGW WenKai and CMU respectively, avoiding missing-font surprises. The preprocessing script needs `numpy` and `Pillow`; before running `make_hand.py`, prepare your own `hand_raw_1.png` through `hand_raw_3.png` in its directory.
4. The sample text and numbers here are historical creation material, not current SpaceX facts you can quote directly. New work must re-verify the script and rebuild the narration timeline.
5. If you just want to run a complete demo first, use the parent `demos/` or `clips/` — do not start from this directory.

## Third-party stroke-order data

`spacex_wb/assets/strokes.js` takes its stroke medians from hanzi-writer-data 2.0.1 / Make Me a Hanzi; only the medians arrays for the characters used in the sample are kept, wrapped as a browser variable — the raw glyph outlines are not included. This derived data remains under the Arphic Public License; see `ARPHICPL.TXT` in the same directory. It is not covered by this repository's MIT license.

Upstream: https://github.com/chanind/hanzi-writer-data/tree/v2.0.1
Original data project: https://github.com/skishore/makemeahanzi
License text: https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT
