// Demo · 3b1b / manim-style explainer, "How a neural network layer turns pixels into a 'cat'" (8s, three shots). Grammar card: references/grammar/t1_3b1b.md
//   Preview index.html?film=demos/t1_3b1b   Render render.py --film demos/t1_3b1b --out t1.mp4
// Shot 1->2 has no transition: first frame = last frame of the previous shot, Transform continues (100 pixels become a column of neurons). Shot 2->3 dives into one hidden-layer neuron to see what it looks for.
window.PUNCH = 0;
window.SCENE_DIR = 'demos/t1_3b1b';
window.ERAS = [
  { id: 't1_s1', dur: 2.6 },
  { id: 't1_s2', dur: 2.8 },
  // cx,cy = screen position of the target neuron at the end of shot 2 (r = 22x1.1); live: shot 2 keeps pushing the camera itself during the transition (vector redraw)
  { id: 't1_s3', dur: 2.6, transition: { type: 'zoomThrough', dur: 0.75, cx: 850, cy: 391.5, zoom: 48, r0: 24.2, live: true, focus: [640, 585] } },
];
