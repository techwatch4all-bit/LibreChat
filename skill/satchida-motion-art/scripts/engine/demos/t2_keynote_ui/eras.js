// Demo · Launch-event style (Apple keynote / product-launch UI), "Three features of Plover 2" (8s, three shots; product and numbers are fictional). Grammar card: references/grammar/t2_keynote_ui.md
//   Preview index.html?film=demos/t2_keynote_ui   Render render.py --film demos/t2_keynote_ui --out t2.mp4
// The light-spot background depends only on global film time t, so the three shots blend seamlessly; card -> fullscreen is a shared-element expand (rect = the middle card's screen rectangle at the end of shot 2).
window.PUNCH = 0;
window.SCENE_DIR = 'demos/t2_keynote_ui';
window.ERAS = [
  { id: 't2_s1', dur: 2.6 },
  { id: 't2_s2', dur: 3.0, transition: { type: 'blurPush', dur: 0.55 } },
  { id: 't2_s3', dur: 2.4, transition: { type: 'expandRect', dur: 0.6, rect: { x: 705.6, y: 252.6, w: 508.8, h: 614.8 }, r: 38 } },
];
