// SpaceX: These 24 Years - single-style edition (wbx: whiteboard reference implementation). Segment lengths come from spacex/timing.js (same narration as the mixed-style edition); do not hand-edit segment lengths.
// Each segment's entry transition is written by that segment's scene file: ERAS.find(e => e.id === 'sXX').transition = { type, dur } (single-style films usually use same = the camera move on one canvas is the transition).
window.PUNCH = 0;
window.SCENE_LIBS = ['spacex/timing.js', 'spacex/tm.js', 'spacex/rockets.js', 'spacex_wb/assets/strokes.js', 'spacex_wb/common.js'];   // this film's own shared scripts can be appended here (e.g. 'spacex_wb/common.js')
window.SCENE_DIR = 'spacex_wb/scenes';
window.EXTRA_ASSETS = ['spacex_wb/assets/hand_1.png', 'spacex_wb/assets/hand_2.png', 'spacex_wb/assets/hand_3.png'];   // the pen-holding hand (gpt-image line art, green-screen keyed, see assets/make_hand.py)
window.ERAS = ['s01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','s12'].map(id => ({ id, get dur() { return TIMING.seg[id].dur; } }));
