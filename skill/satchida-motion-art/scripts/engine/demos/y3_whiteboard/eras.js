// Demo · Whiteboard hand-drawn explainer (RSA Animate style), "How AI learns to recognize cats" (8s, three shots). Grammar card: references/grammar/y3_whiteboard.md
//   Preview index.html?film=demos/y3_whiteboard   Render render.py --film demos/y3_whiteboard --out y3.mp4
// One big whiteboard = the world, with the camera moving across the board; the three segments share one draw function (DG.board's stroke timeline) — segments exist only for QA shot breakdown.
window.PUNCH = 0;
window.SCENE_LIBS = ['demos/_shared/hero.js', 'demos/y3_whiteboard/whiteboard.js'];
window.ERAS = [
  { id: 'y3_s1', dur: 2.5 },                                                  // Draw the cat, write "cat?", write the question
  { id: 'y3_s2', dur: 2.25, transition: { type: 'same', dur: 0.8 } },         // Whip pan (0.8s with motion blur, pen never leaves the board)
  { id: 'y3_s3', dur: 3.25, transition: { type: 'same', dur: 0.85 } },        // Smooth glide across the board -> draw Huashu, "It's a cat!" -> zoom out to see the whole picture
];
