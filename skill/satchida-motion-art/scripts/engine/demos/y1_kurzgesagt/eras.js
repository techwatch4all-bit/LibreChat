// Demo · Kurzgesagt-style flat science explainer, "How AI learns to recognize cats" (8s, three shots). Grammar card: references/grammar/y1_kurzgesagt.md
//   Preview index.html?film=demos/y1_kurzgesagt   Render render.py --film demos/y1_kurzgesagt --out y1.mp4
// Shots cut on the voiceover, dur in seconds; explainer films should not use beat punches (PUNCH = 0). Camera motion is computed inside scenes from time (CAM); transitions only control how A and B composite.
window.PUNCH = 0;
window.SCENE_LIBS = ['demos/_shared/hero.js', 'demos/y1_kurzgesagt/kurzgesagt.js'];
window.ERAS = [
  { id: 'y1_s1', dur: 2.6 },                                                                         // Night hillside: 5-layer parallax slow push, robot scanning the cat
  { id: 'y1_s2', dur: 2.7, transition: { type: 'lensReveal', dur: 1.0, lens: t => Y1.lensAt(t) } },  // Dive into the lens: camera pushes exponentially into the eye; inside the eye is the next world
  { id: 'y1_s3', dur: 2.7, transition: { type: 'matchCut', dur: 0.9 } },                             // Fill then pull out: fill on the yellow output node -> pull out from a yellow eye
];
