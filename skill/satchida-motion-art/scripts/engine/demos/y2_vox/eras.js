// Demo · Vox-style collage explainer, "How AI learns to recognize cats" (8s, three shots). Grammar card: references/grammar/y2_vox.md
//   Preview index.html?film=demos/y2_vox   Render render.py --film demos/y2_vox --out y2.mp4
// One large desk = the world; the camera glides smoothly at 60fps while the desk's clippings / highlighter / red pen / typing step at 12fps.
window.PUNCH = 0;
window.SCENE_LIBS = ['demos/_shared/hero.js', 'demos/y2_vox/vox.js'];
window.ERAS = [
  { id: 'y2_s1', dur: 2.6 },                                                 // Newspaper clipping + halftone photo: highlighter sweeping lines, red pen circling words, slow camera push
  { id: 'y2_s2', dur: 3.3, transition: { type: 'same', dur: 1.1 } },         // Pan along the red line to the evidence wall (same desk, camera moves continuously)
  { id: 'y2_s3', dur: 2.1, transition: { type: 'cut', dur: 1 / 60 } },       // Push fully into the small photo -> hard cut to a large scan of the same image, then pull out to reveal the black-background collage
];
