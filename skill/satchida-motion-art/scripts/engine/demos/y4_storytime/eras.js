// Demo · Storytime simple-line character short, "The first time I had AI write code for me" (8.75s, five shots). Grammar card: references/grammar/y4_storytime.md
//   Preview index.html?film=demos/y4_storytime   Render render.py --film demos/y4_storytime --out y4.mp4 (voiceover track recorded separately; lip sync reads the envelope in vo_env.js)
// Shots cut on the voiceover (not on beats): one VO line ≈ one shot, with reaction shots placed in the "silence" between lines.
window.PUNCH = 0;                    // storytime does not lock to the music beat
window.FILM_DURATION = 8.75;
window.SCENE_LIBS = ['demos/y4_storytime/vo_env.js', 'demos/y4_storytime/story.js', 'demos/y4_storytime/world.js'];
window.SCENE_DIR = 'demos/y4_storytime';
window.ERAS = [
  { id: 's1_desk', dur: 2.0 },                                                  // Medium shot: talking to camera
  { id: 's2_screen', dur: 2.4, transition: { type: 'whip', dur: 0.26, dir: 1 } }, // Whip pan -> screen (over-the-shoulder). Whip on the breath between two lines, never mid-sentence
  { id: 's3_react', dur: 1.2, transition: { type: 'smash', dur: 0.32 } },        // Smash cut -> big reaction close-up (the silence)
  { id: 's4_wide', dur: 1.65, transition: { type: 'cut', dur: 0.02 } },          // Hard cut -> wide establishing shot of the same room
  { id: 's5_close', dur: 1.5, transition: { type: 'cut', dur: 0.02 } },          // Jump in -> close-up, punchline + freeze
];
