// World camera CAM: explainer films are not "segments plus transitions" but "one continuous world
// canvas + one camera".
// Iron rule: the camera is computed only from global film time (or the segment's local time), and the
// scene is redrawn vectorially every frame under the camera -- zoom transitions stay sharp forever,
// never upscaling a 1920px bitmap 20x into mush;
// the engine keeps drawing the previous segment into buffer A by t during the transition window, so
// "the previous shot's camera keeps pushing" holds naturally (live push).
// cam = { x, y, z, r }: world point (x,y) lands at frame center, zoom z (>1 pushes in), rotation r
// (radians) about center. Defaults x=960, y=540, z=1, r=0.
(() => {
let W = 1920, H = 1080; U.onStage((w, h) => { W = w; H = h; });   // canvas size follows U.setStage (default 1920x1080)
const { clamp, lerp } = U;
const CAM = window.CAM = {};
const n = cam => ({ x: cam.x ?? W / 2, y: cam.y ?? H / 2, z: cam.z ?? 1, r: cam.r || 0 });

// Apply the camera transform to c (no save/restore; the caller owns them)
CAM.apply = (c, cam) => { const k = n(cam); c.translate(W / 2, H / 2); if (k.r) c.rotate(k.r); c.scale(k.z, k.z); c.translate(-k.x, -k.y); };
// Draw fn(c) under the camera, with automatic save/restore
CAM.with = (c, cam, fn) => { c.save(); CAM.apply(c, cam); fn(c); c.restore(); };
// World -> screen / screen -> world
CAM.toScreen = (cam, x, y) => { const k = n(cam); let dx = (x - k.x) * k.z, dy = (y - k.y) * k.z; if (k.r) { const cs = Math.cos(k.r), sn = Math.sin(k.r); [dx, dy] = [dx * cs - dy * sn, dx * sn + dy * cs]; } return [W / 2 + dx, H / 2 + dy]; };
CAM.toWorld = (cam, sx, sy) => { const k = n(cam); let dx = sx - W / 2, dy = sy - H / 2; if (k.r) { const cs = Math.cos(-k.r), sn = Math.sin(-k.r); [dx, dy] = [dx * cs - dy * sn, dx * sn + dy * cs]; } return [k.x + dx / k.z, k.y + dy / k.z]; };

// ---------- Zoom ----------
// Logarithmic interpolation: z0->z1 multiplies by the same factor each frame; the audience feels a
// "constant-speed crossing of scales"; linear interpolation starts slow and ends violent. All push/pull
// zooms use it.
CAM.zlerp = (z0, z1, e) => z0 * Math.pow(z1 / z0, e);
// The minimum zoom needed to "dive through a circular aperture of radius r so the aperture covers the
// screen before the transition ends" = distance from aperture center to the farthest screen corner / r.
// With the aperture at frame center that's ~1101/r (the card's "zoom >= 1100/radius"). Any smaller and
// the final frame jumps because the aperture never covers the screen.
CAM.coverZoom = (r, cx = W / 2, cy = H / 2) => Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)) / r;
// Make world point (wx,wy) appear at screen (sx,sy) under zoom z: returns the camera. This is how a
// pushed object glides smoothly to frame center.
CAM.anchor = (wx, wy, z, sx, sy) => ({ x: wx - (sx - W / 2) / z, y: wy - (sy - H / 2) / z, z });
// Push into a world point: from the base camera, zoom interpolates logarithmically to Z (progress e);
// the point moves on screen from its original position toward frame center (progress k, default = e;
// k=0 = push in place around it).
// Used by "dive into the lens" (y1), "fill the photo then hard cut" (y2), "push into the latest data
// point" (t3, k=0).
CAM.pushTo = (base, wx, wy, Z, e, k = e, to = [W / 2, H / 2]) => {
  const s0 = CAM.toScreen(base, wx, wy), z = CAM.zlerp(n(base).z, Z, e);
  return CAM.anchor(wx, wy, z, lerp(s0[0], to[0], k), lerp(s0[1], to[1], k));
};

// ---------- Keyframes ----------
// keys = [{t, x, y, z, r, ease}]; ease applies "from the previous key to this one", default cubicInOut;
// z uses logarithmic interpolation.
// Translating along a path (the Vox desk, whiteboard pans/whips) is just a run of keyframes: smooth
// moves use sineInOut, long jumps use cubicInOut + motion blur, tracking along a line uses MO.longTail.
CAM.at = (keys, t) => {
  if (t <= keys[0].t) return { ...keys[0] };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) { const e = (b.ease || MO.cubicInOut)(MO.seg(t, a.t, b.t));
      return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: CAM.zlerp(a.z, b.z, e), r: lerp(a.r || 0, b.r || 0, e), v: e }; }
  }
  return { ...keys[keys.length - 1] };
};

// ---------- Camera move table (used by explainer films; which move when, see references/shot-language.md) ----------
// The defaults are transitional moves: slow push push, find-next glide, pull out pull (0.6-1.5s,
// sineInOut / long tail); accent moves: fast push punch, fast pan pan, slam in slam,
// reserved for reveals, numbers, reversals. Durations live in MO.PULSE. Within one film pushes must
// come and go: after pushing in, change it up with pull, glide or a hard cut -- never push inward shot
// after shot.
// CAM.track(base, events, t) -> cam: base is the starting camera {x, y, z}; events are time-sorted
// camera moves, the camera computed only from t (deterministic, frames may be skipped).
// Each move starts from "the camera where the previous move ended" and settles by at + dur; when two
// moves sit too close (the next starts before the last finishes), the next continues from the previous
// one's current position.
//   {at, kind: 'push', k?, x?, y?, dur?}    slow push (the default when kind is omitted): z multiplied
//                                           by (1+k) (k default 0.2), 0.9s sineInOut; giving x, y also
//                                           moves that world point to frame center.
//   {at, kind: 'pull', k?, x?, y?, z?, dur?} pull out: z multiplied by (1+k) (k default -1/6, exactly
//                                           canceling one default slow push; the steadiest way back to
//                                           the wide view is z: base.z), 1.1s long tail. Use it to return
//                                           to the whole and close a passage after pushing in.
//   {at, kind: 'glide', x, y, dur?}         find the next thing: zoom unchanged, frame center glides
//                                           smoothly to world point (x, y), 0.7s sineInOut. Moving from
//                                           one item to the next on the same wall.
//   {at, kind: 'to', x?, y?, z?, dur?, ease?} push to an explicit camera (pushing into a region of a
//                                           screenshot: compute z with MD.zoomFor); default 0.9s
//                                           sineInOut; dur: MO.PULSE.punch makes it an accent.
//   {at, kind: 'punch', k?, x?, y?, dur?}   fast push (accent): 0.28s cubicInOut, k default 0.25
//                                           (0.18-0.32). k may be negative (a fast pull).
//   {at, kind: 'pan', x, y, dur?}            fast pan (accent): same zoom, 0.30s. Sudden shifts of
//                                           attention, comic timing.
//   {at, kind: 'slam', dur?, from?}          whole-frame slam: z additionally multiplied by MO.slamK
//                                           (1.55->0.94->1.0, 0.17s). The frame a big word, number or
//                                           stamp lands.
//   {at, kind: 'shake', amp?, dur?}          shake: over dur (default 4 frames ~ 0.13s) the frame
//                                           bobs amp px vertically (default 14); pair with slam/stamp
//                                           on the same frame; at most twice per film.
//   {at, kind: 'cut', x?, y?, z?}            hard cut to this camera (no transition). Changing framing
//                                           does not require a camera move; jumping one step closer is a cut.
// The returned cam carries moving: true/false (whether it is moving at this instant), for motion blur
// and label show/hide.
CAM.track = (base, events, t) => {
  let cam = { x: base.x ?? W / 2, y: base.y ?? H / 2, z: base.z ?? 1 }, zMul = 1, dy = 0, moving = false;
  const evs = [...events].sort((a, b) => a.at - b.at);
  for (const e of evs) {
    if (t < e.at) break;
    const P = MO.PULSE, kind = e.kind || 'push';
    if (kind === 'cut') { cam = { x: e.x ?? cam.x, y: e.y ?? cam.y, z: e.z ?? cam.z }; continue; }
    if (kind === 'slam') { const d = e.dur || P.slam, k = (t - e.at) / d; if (k < 1) { zMul *= MO.slamK(k, e.from); moving = true; } continue; }
    if (kind === 'shake') { const d = e.dur || 4 / 30, k = (t - e.at) / d; if (k < 1) { dy += (e.amp ?? 14) * Math.sin(k * Math.PI * 4) * (1 - k) / cam.z; moving = true; } continue; }
    const D = { pan: P.pan, punch: P.punch, glide: P.glide, pull: P.pull, push: P.push, to: P.push }[kind] ?? P.push;
    const E = kind === 'punch' || kind === 'pan' || (e.dur && e.dur <= 0.35) ? MO.cubicInOut : kind === 'pull' ? MO.longTail : MO.sineInOut;   // a 'to' with an accent duration uses the fast-push curve too
    const d = e.dur || D, p = (e.ease || E)(clamp((t - e.at) / d));
    let to;
    if (kind === 'pan' || kind === 'glide') to = { x: e.x ?? cam.x, y: e.y ?? cam.y, z: cam.z };
    else if (kind === 'to') to = { x: e.x ?? cam.x, y: e.y ?? cam.y, z: e.z ?? cam.z };
    else if (kind === 'pull') to = { x: e.x ?? cam.x, y: e.y ?? cam.y, z: e.z ?? cam.z * (1 + (e.k ?? -1 / 6)) };   // default x5/6, exactly canceling one default slow push (x1.2)
    else to = { x: e.x ?? cam.x, y: e.y ?? cam.y, z: cam.z * (1 + (e.k ?? (kind === 'push' ? 0.2 : P.k))) };
    if (p < 1) moving = true;
    cam = { x: lerp(cam.x, to.x, p), y: lerp(cam.y, to.y, p), z: CAM.zlerp(cam.z, to.z, p) };
  }
  return { x: cam.x, y: cam.y + dy, z: cam.z * zMul, moving };
};

// ---------- Parallax ----------
// d=1 is the subject plane, d<1 farther, d>1 nearer. Far layers displace linearly by d and scale by
// z^d: when pushing deep, the background barely moves -- that is the sense of depth (Kurzgesagt's
// 5-layer parallax).
CAM.layer = (c, cam, d, fn) => { const k = n(cam); c.save(); CAM.apply(c, { x: lerp(W / 2, k.x, d), y: lerp(H / 2, k.y, d), z: Math.pow(k.z, d) }); fn(c); c.restore(); };

// ---------- Motion ----------
// The camera's instantaneous on-screen speed (px/frame at 60fps): camFn(t) -> cam. For motionBlur.
CAM.velocity = (camFn, t, dt = 1 / 60) => { const a = camFn(t), b = camFn(t - dt); const z = n(a).z; return [(n(a).x - n(b).x) * z, (n(a).y - n(b).y) * z]; };
// Motion blur: stack the whole frame n times along the velocity direction (for fast pans/whips;
// below 1.5px speed it degenerates to a single draw automatically). Blur length should stay shorter
// than the camera's displacement (PremiumBeat).
CAM.motionBlur = (c, src, vx, vy, k = 7) => {
  const sp = Math.hypot(vx, vy); if (sp < 1.5) { c.drawImage(src, 0, 0); return; }
  c.save(); for (let i = 0; i < k; i++) { const q = i / (k - 1) - 0.5; c.globalAlpha = i === 0 ? 1 : 1 / (i + 1); c.drawImage(src, -vx * q, -vy * q); } c.restore();
};
// Handheld micro-drift: two sine paths of different periods (continuous time, no flicker), returns
// [dx, dy] px. For art-style scenes and pure mood shots only; explainer shots that hold still hold
// still -- no drift added
CAM.drift = (t, amp = 6, seed = 0) => [amp * Math.sin(t * 0.9 + seed) + amp * 0.4 * Math.sin(t * 2.3 + seed * 2), amp * 0.7 * Math.sin(t * 1.1 + seed * 3)];
})();
