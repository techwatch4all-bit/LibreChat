# Y6 · Presenter-style finance explainer

A cartoon presenter threads information across paper, charts, and keywords. Fits business history, product mechanisms, and knowledge explainers with emotional reactions. Reference code in `scripts/engine/reference_films/spacex/spacex_lin/`; this is the 9th grammar card, with no standalone parameterized clip yet and no bundled character sprites.

## Start-up checks

- The storyboard assigns layouts first: side-on presenting, full-screen numbers, left/right comparison, the character entering the chart, reaction close-ups. Never fix "person left, chart right" for the whole film.
- Generate frames at least at two shot sizes — full body and chest-up; sitting and leaning poses need real matching frames.
- Each segment's first `cast` keyframe states `x` and `s` explicitly, preventing cross-segment inheritance regressions.
- Nested drawing multiplies alpha with `*=`, preserving the outer fade.
- The top-bar year, subtitles, and section titles read the same time source.
- Run `qa.py`'s text framing on the first version; for films on light backgrounds without subtitles, also run `subzone_gate.py`.

## Frames and action

The character uses AI-generated frames; code controls foot anchors, position, size, and frame swaps. Poses hard-cut with a slight pop, avoiding double images from dissolving between different outlines. Talking and closed mouths switch with the voiceover timeline; lip sync stops during pauses; walking uses complete gait frames. Pose heights align by median; reaction close-ups use chest-up assets — never blow up a full-frame screenshot.

Numbers land when the voiceover speaks them. While counting, do not lead with claims like "over" or "+"; the emphasis circle appears after the number lands. The pause after the highlight is reserved at the script and voiceover stage.

## Reference implementation

`common.js` provides `presenterFrame`, `drawFigure`, `hud`, `yearAt`, `popK`, and `L.cast`. `prep_presenter.py` demonstrates frame slicing and foot anchors. The transition `transitions/lin_page.js` only turns pages; the presenter and top bar may continue across pages.

Known limits: text occluded by the figure and characters cropped by pushes still need eyeball review; the reference code's whole-frame bitmap pushes crop easily — new films should prefer the scene camera. Assets and voiceover must be supplied by you; this card is not a complete ready-to-render film template.
