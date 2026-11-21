#!/usr/bin/env python3
# /// script
# dependencies = ["playwright", "numpy", "pillow"]
# ///
"""Accept one code-animation project in one command: stability, efficiency, motion, smoothness -- numbers plus contact sheets. Run before delivery; the numbers go into delivery-notes.md.

    uv run qa.py --project <engine-project dir> [--film gallery] [--ids 01_cave,09_postimp] [--fps 30] [--out <dir>]
    uv run qa.py --spec <clip spec.json> [--out <dir>]      # parameterized clip (voiceover-pipeline animation segment): measured as one segment, portrait ok; transitions not measured
                                                            # asset fields share the same set as render.py (engine/spec_assets.py): image, frames, data.image, data.character

Per segment (each id in eras.js) it does four things:
  1. Stability: a scene load failure exits immediately (engine __bootErrors); cold render + warm render at the same instant are compared pixel by pixel (determinism).
  2. Efficiency: per-frame time -- the timing includes one getImageData(1x1) to force the GPU to finish (measuring only JS sync time reports a fake 1ms; migration test B hit this).
  3. Motion: skipping the 0.35s camera-impact after transitions, grabs frames at --fps over the segment's still region, reports mean motion area (share of pixels whose adjacent-frame change >12)
     and the "still pair" ratio (adjacent frames almost unchanged <0.05% -- migration test A showed first-vs-last diff alone misses stutter).
  4. Smoothness: peak / median of adjacent-frame diffs. >6 with peak >3% is recorded as a "jump" (whole-frame brush re-stroke at 8fps, a glitched frame, flicker all show up here).
     Camera moves (fast push 0.28s, pan 0.30s, smash in 0.17s, slow push 0.9s, find-next 0.7s, pull out 1.1s) are not jumps; they are recorded separately as "camera events": expand from the jump
     frame to both sides until frame diffs fall back; the run must be at least 2 frame pairs, no longer than 2s (+1 frame), and the last frame farthest from the first (pushed there and stayed,
     not flashed and returned); runs longer than 0.35s must also be smooth all the way, with no single-frame spike 2.5x larger than both neighbors. Before 2026-10-12 only runs within 0.35s counted,
     so a slow push was recorded as one long jump -- effectively forcing the model to make cameras faster.
     Isolated one or two frames (glitch, white flash, full-frame re-stroke), flash-and-return, and longer continuous runs are still recorded as jumps. Pixels only; no camera table is read,
     so a hand-written push is recognized just like CAM.track; the cost is that monotonic smooth large changes (e.g. a whole-frame swap into another image that happens to continue a push) are
     also treated as camera events.
Also runs "transition smoke": every segment with a transition renders full frames (renderFrame) at p=.25/.5/.75; errors count as page errors -- in-segment grabbing uses renderSolo, so transition
code never executes and a broken transition can still be all green (hit while porting the all-styles gallery).
The thresholds are empirical, not rules: motion between 0.5-8% looks good for most segments; still pairs >40% reads as stuck; for jumps >0 look at the frames before judging (an intentional beat
flash is not an error).
  5. Framing:
     From page load, records the screen bounding box of every fillText/strokeText; reported only when it persists >=0.3s at grab time --
     half-cut text (text partially clipped by the frame edge), overlapping text (two different strings pressing on each other), subtitle band (text falls into the subtitle band, burned-in
     subtitles would cover it);
     also "near blank" (the frame has almost no content: full-screen white flash, black). All are clues to "go look at this frame", not errors; they never fail qa.
     Boxes follow the canvas: text drawn into an offscreen buffer / sprite cache (including pre-warmed caches) then drawImage'd up, and text under a bitmap push, are all measured.
     Subtitle band: whole film defaults to y>920/1080 (--sub-band to change, 0 disables); --spec clips read the spec's safe.bottom; absent means not checked.
     Blind spots: (1) grabbing starts at max(--skip, transition duration) per segment, so problems in the segment head and inside transitions are invisible; a blank opening board with a pen
     or hand left in it (>0.3%) is not near blank. (2) Text drawn inside a clip (rolling numbers, stroke-order reveal) is only checked for half-cut text and subtitle band, not overlaps.
     (3) Text occluded by non-text objects (photos, paper clips, presenter, late cards) cannot be seen, and two fully covered strings can false-positive as overlap. (4) Graphics (flames,
     spaceships) entering the subtitle band are not seen; for light-background styles use the film-level scripts/subzone_gate.py.
     (5) Stroke-by-stroke handwriting reports per glyph; only looking at the frame locates it; decorative big text intentionally over the band or off-frame (like y5's giant watermark digits)
     will be reported -- look and let it go.

Outputs: <out>/qa.json (all numbers), <out>/qa.md (table), <out>/<id>.jpg (4-frame contact sheet + motion heat map).
"""
import argparse, base64, functools, http.server, io, json, socketserver, sys, threading, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'engine'))
import spec_assets
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
ap.add_argument('--project'); ap.add_argument('--spec', help='parameterized clip spec (runs clip.html, same set as render.py --spec)'); ap.add_argument('--ids'); ap.add_argument('--fps', type=float, default=30)
ap.add_argument('--out'); ap.add_argument('--film', default='', help='film name: reads eras_<name>.js'); ap.add_argument('--skip', type=float, default=0.35, help='seconds skipped at each segment start (camera impact)')
ap.add_argument('--sub-band', type=float, default=None, help='top edge of the subtitle band (fraction of frame height); whole film defaults to 0.852 (920/1080), --spec reads safe.bottom; 0 disables the subtitle-band check')
a = ap.parse_args()
if not (a.project or a.spec): ap.error('pass either --project or --spec')
spec, ALLOWED = None, set()
if a.spec:                                                 # same set as render.py: local assets (image / frames / character frame library) serve only files named in the spec
    sp = Path(a.spec).resolve(); spec = json.loads(sp.read_text())
    try: spec_assets.localize(spec, sp.parent, ALLOWED)
    except FileNotFoundError as e: raise SystemExit(str(e))
root = Path(a.project).resolve() if a.project else Path(__file__).resolve().parent / 'engine'
out = Path(a.out) if a.out else (Path(a.spec).resolve().parent / 'qa' if a.spec else root.parent / 'qa'); out.mkdir(parents=True, exist_ok=True)
VW, VH = (spec.get('width', 1920), spec.get('height', 1080)) if spec else (1920, 1080)
if a.sub_band is None:   # clips feed the pipeline: subtitle clearance is written in the spec's safe.bottom; absent means no burned-in subtitles
    sb = ((spec or {}).get('safe') or {}).get('bottom', 0) if spec else None
    a.sub_band = 0.852 if sb is None else (1 - sb / VH if sb else 0)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
    def translate_path(self, path):
        if path.startswith('/__file__/'):
            f = urllib.parse.unquote(path[len('/__file__/'):].split('?')[0])
            return f if f in ALLOWED else '/nonexistent'
        return super().translate_path(path)
# Chromium may open idle connections while loading scripts in parallel.
class LocalServer(socketserver.ThreadingTCPServer):
    request_queue_size = 128
    daemon_threads = True

srv = LocalServer(('127.0.0.1', 0), functools.partial(Q, directory=str(root))); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

# Framing check: wrap fillText/strokeText and record the on-screen bounding box (under the current
# transform) of text drawn on the full-frame-size canvas.
TEXT_HOOK = '''(() => {
  // A text box is recorded on the canvas it was drawn on; when that canvas is drawImage'd
  // elsewhere, the box is transformed along with it.
  // This way text first drawn into an offscreen buffer then pushed as one bitmap (the presenter
  // films' bitmap push), or drawn into a sprite cache and pasted on the desk (Vox paper cutouts),
  // is measured too.
  const P = CanvasRenderingContext2D.prototype;
  const sv = P.save, rs = P.restore, cl = P.clip, di = P.drawImage, cr = P.clearRect, fr = P.fillRect;
  // Remember whether a clip is active: rolling numbers and stroke-order reveals draw inside a
  // clip, so their boxes are bigger than what is visible -- never used for the overlap check
  P.save = function () { (this.__cs || (this.__cs = [])).push(!!this.__clip); return sv.apply(this, arguments); };
  P.restore = function () { if (this.__cs && this.__cs.length) this.__clip = this.__cs.pop(); return rs.apply(this, arguments); };
  P.clip = function () { this.__clip = true; return cl.apply(this, arguments); };
  // When a whole canvas gets covered, clear that canvas's box record; otherwise after a cached
  // canvas repaints, the previous segment's text stays in the record (whiteboard s03's "rocket"
  // false-reporting into s04)
  const full = (ctx, x, y, w, h) => {                        // does this rectangle, under the current transform, cover the whole canvas (axis-aligned transforms only)
    const T = ctx.getTransform(); if (T.b !== 0 || T.c !== 0) return false;
    const xs = [T.a * x + T.e, T.a * (x + w) + T.e], ys = [T.d * y + T.f, T.d * (y + h) + T.f];
    return Math.min(...xs) <= 0 && Math.min(...ys) <= 0 && Math.max(...xs) >= ctx.canvas.width && Math.max(...ys) >= ctx.canvas.height;
  };
  const opaque = ctx => { const f = ctx.fillStyle; if (typeof f !== 'string') return false; const m = f.match(/^(rgba|hsla)\\(([^)]*)\\)/); return !m || +m[2].split(/[ ,\\/]+/).filter(Boolean)[3] >= 1; };
  P.clearRect = function (x, y, w, h) { if (full(this, x, y, w, h)) this.canvas.__tb = []; return cr.apply(this, arguments); };
  P.fillRect = function (x, y, w, h) { if (this.globalAlpha >= 1 && (this.globalCompositeOperation === 'copy' || (this.globalCompositeOperation === 'source-over' && opaque(this))) && full(this, x, y, w, h)) this.canvas.__tb = []; return fr.apply(this, arguments); };
  if (P.reset) { const rz = P.reset; P.reset = function () { this.canvas.__tb = []; this.__cs = []; this.__clip = false; return rz.apply(this, arguments); }; }
  const pid = P.putImageData;
  P.putImageData = function (im, x, y) { if (x <= 0 && y <= 0 && x + im.width >= this.canvas.width && y + im.height >= this.canvas.height) this.canvas.__tb = []; return pid.apply(this, arguments); };
  for (const k of ['width', 'height']) {                       // resizing a canvas clears it; clear the boxes too
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k);
    Object.defineProperty(HTMLCanvasElement.prototype, k, { get: d.get, set(v) { this.__tb = []; d.set.call(this, v); }, configurable: true });
  }
  const push = (ctx, rec) => { const L = ctx.canvas.__tb || (ctx.canvas.__tb = []); L.push(rec); if (L.length > 6000) L.splice(0, 3000); };   // canvases that clear locally and repaint repeatedly would grow forever; keep the most recent
  for (const fn of ['fillText', 'strokeText']) {
    const orig = P[fn];
    P[fn] = function (text, x, y, maxW) {
      if (this.globalAlpha > 0.15 && String(text).trim()) {     // recorded from load on: text pre-drawn into caches at startup (Vox prewarm) needs boxes too
        const m = this.measureText(text), T = this.getTransform();
        let x0 = x - m.actualBoundingBoxLeft, x1 = x + m.actualBoundingBoxRight;
        if (maxW && x1 - x0 > maxW) x1 = x0 + maxW;
        const y0 = y - m.actualBoundingBoxAscent, y1 = y + m.actualBoundingBoxDescent;
        const xs = [], ys = [];
        for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push(T.a * px + T.c * py + T.e); ys.push(T.b * px + T.d * py + T.f); }
        push(this, [String(text).slice(0, 24), xs, ys, !!this.__clip]);
      }
      return orig.apply(this, arguments);
    };
  }
  P.drawImage = function (src, ...a) {
    if (this.globalCompositeOperation === 'copy') this.canvas.__tb = [];
    const L = src && src.__tb;
    if (L && L.length && src !== this.canvas && this.globalAlpha > 0.5) {   // <=0.5 is usually motion ghosting / trail layers; don't propagate (whiteboard whip-pan ghosts would stack into a full screen of fake overlaps)
      let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw = sw, dh = sh;
      if (a.length === 2) [dx, dy] = a; else if (a.length === 4) [dx, dy, dw, dh] = a; else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
      const T = this.getTransform(), kx = dw / sw, ky = dh / sh, clip = !!this.__clip || a.length === 8;
      for (const [txt, xs, ys, c0] of L) {
        if (Math.max(...xs) < sx || Math.min(...xs) > sx + sw || Math.max(...ys) < sy || Math.min(...ys) > sy + sh) continue;
        const X = [], Y = [];
        for (let k = 0; k < 4; k++) { const u = dx + (xs[k] - sx) * kx, v = dy + (ys[k] - sy) * ky; X.push(T.a * u + T.c * v + T.e); Y.push(T.b * u + T.d * v + T.f); }
        push(this, [txt, X, Y, c0 || clip]);
      }
    }
    return di.call(this, src, ...a);
  };
})();'''
GRAB = '''async ([id, lt, full]) => {
  window.__tb = true; window.__canvas.__tb = [];
  const s = performance.now();
  if (full) { await window.prepare(lt); window.renderFrame(lt); } else window.renderSolo(id, lt);
  window.__canvas.getContext('2d').getImageData(0, 0, 1, 1);           // force the GPU to finish before stopping the clock
  const ms = performance.now() - s;
  const M = window.__canvas, tb = (M.__tb || []).map(([t, xs, ys, c]) => [t, xs.map(v => v / M.width), ys.map(v => v / M.height), c]); window.__tb = null;
  return [ms, window.__canvas.toDataURL('image/png').split(',')[1], tb];
}'''

def frame_issues(tb, band):
    """Framing issues in one frame: [(kind, text)]. All coordinates are fractions of the frame."""
    out, vis = [], []
    for txt, cxs, cys, clipped in tb:
        x0, y0, x1, y1 = min(cxs), min(cys), max(cxs), max(cys)
        ang = float(np.arctan2((cys[1] - cys[0]) * VH, (cxs[1] - cxs[0]) * VW))
        w, h = x1 - x0, y1 - y0
        if w <= 0 or h <= 0 or h < 0.008: continue                 # tiny text (<9px) ignored
        ix0, iy0, ix1, iy1 = max(x0, 0), max(y0, 0), min(x1, 1), min(y1, 1)
        if ix1 <= ix0 or iy1 <= iy0: continue                      # fully off-frame: the camera never saw it, doesn't count
        frac = (ix1 - ix0) * (iy1 - iy0) / (w * h)
        if frac < 0.9 and frac > 0.1: out.append(('half-cut text', txt))
        if band and iy1 > band + 0.004 and frac > 0.1: out.append(('subtitle band', txt))
        if not clipped: vis.append((txt, ang, cxs, cys))
    def box(v, ang):                                                    # take the bounding box in ang's frame: two lines of a tilted label won't "overlap" just because their axis-aligned boxes grew
        c, s_ = np.cos(-ang), np.sin(-ang)
        u = [x * c - y * s_ * VH / VW for x, y in zip(v[2], v[3])]; w = [x * s_ * VW / VH + y * c for x, y in zip(v[2], v[3])]
        return min(u), min(w), max(u), max(w)
    for i in range(len(vis)):
        for j in range(i + 1, len(vis)):
            a, b = vis[i], vis[j]
            if a[0] == b[0]: continue                                   # the same string drawn twice (stroke + fill, drop shadow)
            same = abs(a[1] - b[1]) < 0.02; ang = a[1] if same else 0.0
            A, B = box(a, ang), box(b, ang)
            if not same:                                                # different angles (handwriting jitter per glyph): axis-aligned boxes fatten; shrink each by 12% before comparing
                A, B = [(r[0] + (r[2] - r[0]) * .12, r[1] + (r[3] - r[1]) * .12, r[2] - (r[2] - r[0]) * .12, r[3] - (r[3] - r[1]) * .12) for r in (A, B)]
            ow = min(A[2], B[2]) - max(A[0], B[0]); oh = min(A[3], B[3]) - max(A[1], B[1])
            if ow <= 0 or oh <= 0: continue
            small = min((A[2] - A[0]) * (A[3] - A[1]), (B[2] - B[0]) * (B[3] - B[1]))
            if ow * oh / small > 0.3: out.append(('overlapping text', a[0] + ' | ' + b[0]))
    return out

def persistent(ts, per_frame, min_s=0.3):
    """A problem is reported only after persisting >=min_s seconds (the few frames with half-cut
    text while the camera pans past are normal)."""
    runs, open_ = [], {}
    for k, t in enumerate(ts):
        cur = set(per_frame[k])
        for key in list(open_):
            if key not in cur:
                t0, t1 = open_.pop(key)
                if t1 - t0 >= min_s: runs.append((key, t0, t1))
        for key in cur:
            if key in open_: open_[key] = (open_[key][0], t)
            else: open_[key] = (t, t)
    runs += [(key, t0, t1) for key, (t0, t1) in open_.items() if t1 - t0 >= min_s]
    return sorted(runs, key=lambda r: r[1])

def merge_runs(runs):
    """Glyph-by-glyph handwriting produces one entry per glyph: merge same-kind, time-overlapping
    runs into one and concatenate the text."""
    out = []
    for (kind, txt), t0, t1 in sorted(runs, key=lambda r: (r[0][0], r[1])):
        if out and out[-1][0] == kind and t0 <= out[-1][3] + 0.05:
            o = out[-1]; o[3] = max(o[3], t1)
            if txt and txt not in o[1].split(' / ') and len(o[1]) < 60: o[1] = (o[1] + ' / ' + txt).strip(' / ')
        else: out.append([kind, txt, t0, t1])
    return sorted(out, key=lambda r: r[2])

def near_blank(f):
    """Fewer than 0.3% of pixels differing from the frame's dominant color by >24 reads as
    "almost no content"."""
    med = np.median(f.reshape(-1, 3), axis=0)
    return float((np.abs(f - med).max(axis=2) > 24).mean()) < 0.003
def img(b64, w=480): return np.asarray(Image.open(io.BytesIO(base64.b64decode(b64))).convert('RGB').resize((w, round(w * VH / VW)))).astype(np.int16)   # scaled by frame shape; portrait is not squashed

def camera_events(frames, diffs, idx, fps, max_s=2.0):
    """Pick camera moves (push/pull, pan, smash in) out of the jumps (criteria: header item 4).
    idx: frame-pair indexes where jumps were found. Returns (indexes still counting as jumps,
    camera events [(l, r)])."""
    keep, events = [], []
    for i in idx:
        if any(l <= i <= r for l, r in events): continue
        thr = max(0.5, 0.1 * diffs[i]); l = r = i
        while l > 0 and diffs[l - 1] > thr: l -= 1
        while r < len(diffs) - 1 and diffs[r + 1] > thr: r += 1
        n = r - l + 1
        far = [float(np.abs(frames[k] - frames[l]).mean()) for k in range(l + 1, r + 2)]   # how far each frame in the run is from the first
        smooth = n <= 0.35 * fps + 1 or all(diffs[k] <= 2.5 * max(diffs[k - 1], diffs[k + 1]) + 0.5 for k in range(l + 1, r))   # runs longer than 0.35s must stay smooth; no single-frame spike in between
        if 2 <= n <= max_s * fps + 1 and far[-1] >= 0.8 * max(far) and smooth: events.append((l, r))
        else: keep.append(i)
    return [i for i in keep if not any(l <= i <= r for l, r in events)], events

report = {'project': str(root), 'spec': str(Path(a.spec).resolve()) if a.spec else None, 'segments': []}
errors = []
with sync_playwright() as p:
    br = p.chromium.launch(args=['--enable-gpu-rasterization', '--ignore-gpu-blocklist'])
    pg = br.new_page(viewport={'width': VW, 'height': VH})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)   # missing glyphs etc. surface via console.error
    pg.add_init_script(TEXT_HOOK)
    if spec:
        pg.add_init_script('window.CLIP_SPEC = ' + json.dumps(spec, ensure_ascii=False) + ';')
        pg.goto(f'http://127.0.0.1:{port}/clip.html?render=1')
    else:
        pg.goto(f'http://127.0.0.1:{port}/index.html?render=1' + (f'&film={a.film}' if a.film else ''))
    pg.wait_for_function('window.__ready === true || !!window.__bootFailed', timeout=180000)
    bf = pg.evaluate('window.__bootFailed || null')
    if bf: raise SystemExit('Scene load failed:\n' + bf)
    segs = [{'id': Path(a.spec).resolve().parent.name, 't0': 0, 't1': spec['duration'], 'tr': 0}] if spec else \
        pg.evaluate('ERAS.map(e => ({id: e.id, t0: e.t0, t1: Math.min(e.t1, window.__total), tr: e.transition ? e.transition.dur + (e.transition.delay || 0) : 0}))')
    want = set(a.ids.split(',')) if a.ids else None
    for s in segs:
        if want and s['id'] not in want: continue
        dur = s['t1'] - s['t0']; lt0 = max(a.skip, s['tr']) if s['t0'] > 0 else 0.0
        lt1 = max(lt0 + 0.2, dur - 0.02)
        n = max(4, int((lt1 - lt0) * a.fps))
        ts = [lt0 + (lt1 - lt0) * i / (n - 1) for i in range(n)]
        full = bool(spec)                                   # clips have no renderSolo; render full frames
        cold_ms, cold, _ = pg.evaluate(GRAB, [s['id'], ts[-1], full])
        frames, ms, tbs = [], [], []
        for t in ts:
            m, b64, tb = pg.evaluate(GRAB, [s['id'], t, full]); ms.append(m); frames.append(img(b64)); tbs.append(tb or [])
        _, again, _ = pg.evaluate(GRAB, [s['id'], ts[-1], full])
        det = int(np.abs(img(again) - frames[-1]).max()); det_cold = int(np.abs(img(cold) - frames[-1]).max())
        diffs = np.array([(np.abs(frames[i + 1] - frames[i]).max(axis=2) > 12).mean() * 100 for i in range(len(frames) - 1)])
        med = float(np.median(diffs)) if len(diffs) else 0
        if spec:   # clips are mostly "move once, hold": the whole-segment median is ~0, so continuous push/slide runs would be recorded as jumps. Clips only count isolated jumps: 6x the median of the 3 pairs on each side
            loc = lambda i: float(np.median(np.r_[diffs[max(0, i - 3):i], diffs[i + 1:i + 4]])) if len(diffs) > 1 else 0
            sidx = [i for i, d in enumerate(diffs) if d > 3 and d > 6 * max(loc(i), 0.05)]
        else:
            sidx = [i for i, d in enumerate(diffs) if d > 3 and d > 6 * max(med, 0.05)]
        sidx, cams = camera_events(frames, diffs, sidx, a.fps)
        spikes = [round(ts[i + 1], 3) for i in sidx]
        still = float((diffs < 0.05).mean() * 100)
        heat = np.zeros(frames[0].shape[:2]); [heat.__iadd__((np.abs(frames[i + 1] - frames[i]).max(axis=2) > 12)) for i in range(len(frames) - 1)]
        rec = {'id': s['id'], 'window_lt': [round(lt0, 3), round(lt1, 3)], 'frames': n,
               'ms_mean': round(float(np.mean(ms)), 1), 'ms_max': round(float(np.max(ms)), 1), 'ms_cold': round(cold_ms, 1),
               'deterministic': det == 0 and det_cold == 0, 'det_maxdiff': max(det, det_cold),
               'motion_pct': round(float(diffs.mean()), 2), 'motion_max': round(float(diffs.max()), 2), 'still_pairs_pct': round(still, 1),
               'spike_ratio': round(float(diffs.max() / max(med, 0.05)), 1), 'spikes_at_lt': spikes,
               'camera_events_lt': [[round(ts[l], 3), round(ts[r + 1], 3)] for l, r in cams]}
        frame_runs = merge_runs(persistent(ts, [frame_issues(tb, a.sub_band) for tb in tbs]) +
                                persistent(ts, [[('near blank', '')] if near_blank(f) else [] for f in frames]))
        rec['framing'] = [{'kind': k, 'text': txt, 'lt': [round(t0, 2), round(t1, 2)], 't': [round(s['t0'] + t0, 2), round(s['t0'] + t1, 2)]} for k, txt, t0, t1 in frame_runs]
        rec['text_tracked'] = sum(map(len, tbs))
        report['segments'].append(rec)
        # Contact sheet: 4 frames + heat map
        pick = [frames[int(k)] for k in np.linspace(0, n - 1, 4)]
        H_, W_ = frames[0].shape[:2]; S = Image.new('RGB', (W_ * 5, H_ + 20), 'white'); dr = ImageDraw.Draw(S)
        for k, f in enumerate(pick): S.paste(Image.fromarray(f.astype(np.uint8)), (k * W_, 20))
        hm = np.clip(heat / max(1, heat.max()) * 255, 0, 255).astype(np.uint8)
        base = Image.fromarray(pick[0].astype(np.uint8)).convert('L').convert('RGB'); red = np.zeros((H_, W_, 3), np.uint8); red[..., 0] = hm
        S.paste(Image.blend(base, Image.fromarray(red), 0.6), (4 * W_, 20))
        dr.text((4, 4), f"{s['id']}  motion {rec['motion_pct']}%  still pairs {rec['still_pairs_pct']}%  jumps {len(spikes)}  camera events {len(cams)}  {rec['ms_mean']}/{rec['ms_max']}ms  deterministic {'ok' if rec['deterministic'] else 'NO'}", fill='black')
        S.save(out / f"{s['id']}.jpg", quality=85)
        print(f"{s['id']:<18} motion {rec['motion_pct']:>5}%  still pairs {rec['still_pairs_pct']:>5}%  jumps {len(spikes)}  camera events {len(cams)}  {rec['ms_mean']:>6}/{rec['ms_max']:>6}ms  deterministic {'ok' if rec['deterministic'] else 'NO ' + str(rec['det_maxdiff'])}  framing {len(rec['framing'])}")
        for r in rec['framing']: print(f"    {r['kind']}  {r['t'][0]:.2f}-{r['t'][1]:.2f}s  {r['text']}")
    # Transition smoke: only checks renderability and time; not part of the motion/smoothness criteria
    report['transitions'] = []
    for s in ([] if spec else pg.evaluate('ERAS.map(e => ({id: e.id, t0: e.t0, tr: e.transition ? {type: e.transition.type, dur: e.transition.dur, delay: e.transition.delay || 0} : null}))')):
        if not s['tr'] or (want and s['id'] not in want): continue
        ms_tr = []
        for p in (0.25, 0.5, 0.75):
            t = s['t0'] + s['tr']['delay'] + s['tr']['dur'] * p
            try:
                m, *_ = pg.evaluate(GRAB, [s['id'], t, True]); ms_tr.append(m)
            except Exception as ex:
                errors.append(f"transition {s['tr']['type']} (entering {s['id']}) p={p}: {str(ex).splitlines()[0]}")
        report['transitions'].append({'id': s['id'], 'type': s['tr']['type'], 'ms_max': round(max(ms_tr), 1) if ms_tr else None})
    if report['transitions']: print('transition smoke:', len(report['transitions']), 'checked, slowest', max((r['ms_max'] or 0, r['type']) for r in report['transitions']))
    br.close()
srv.shutdown()
srv.server_close()
report['page_errors'] = errors
json.dump(report, open(out / 'qa.json', 'w'), ensure_ascii=False, indent=1)
rows = ['| Segment | Motion% | Still pairs% | Jumps | Camera events | Mean/Peak ms | Cold ms | Deterministic | Framing |', '|---|---|---|---|---|---|---|---|---|']
for r in report['segments']:
    rows.append(f"| {r['id']} | {r['motion_pct']} | {r['still_pairs_pct']} | {len(r['spikes_at_lt'])} {r['spikes_at_lt'][:3]} | {len(r['camera_events_lt'])} | {r['ms_mean']}/{r['ms_max']} | {r['ms_cold']} | {'ok' if r['deterministic'] else 'NO'} | {len(r['framing'])} |")
fr = [(r['id'], x) for r in report['segments'] for x in r['framing']]
if fr: rows += ['', 'Framing clues (whole-film seconds, persistent >=0.3s; look at the frame before judging):'] + [f"- {x['kind']} {x['t'][0]:.2f}-{x['t'][1]:.2f}s ({i}) {x['text']}" for i, x in fr]
if report.get('transitions'): rows += ['', 'Transition smoke (full frames, peak ms): ' + ', '.join(f"{r['type']}->{r['id']} {r['ms_max']}" for r in report['transitions'])]
(out / 'qa.md').write_text('\n'.join(rows) + ('\n\nPage errors:\n' + '\n'.join(errors) if errors else '') + '\n')
print('->', out / 'qa.md')
if not spec and root != Path(__file__).resolve().parent / 'engine':   # experience-backflow fallback (doc 11, section 1): qa must run before delivery, so remind here without failing qa
    import re, time
    draft = next((d / 'experience-backflow-draft.md' for d in (root.parent, root.parent.parent) if (d / 'experience-backflow-draft.md').exists()), None)
    if not draft: print(f'Backflow reminder: the project root ({root.parent.name}) has no experience-backflow-draft.md yet. Append a few entries after each round; format: section 4 of the skill\'s evolution-protocol reference (references/12-voiceover-full-film-experience-loop.md).')
    else:
        txt = draft.read_text(); age = (time.time() - draft.stat().st_mtime) / 60
        tail = txt.rsplit('> watermark', 1)[-1] if '> watermark' in txt else txt     # below the watermark = not yet written back into the skill
        n = len(re.findall(r'^### \[', tail, re.M))
        print(f'Backflow reminder: experience-backflow-draft.md was last written {age:.0f} minutes ago; {n} entries not yet written back into the skill (consolidate per doc 11\'s home table when wrapping up; after consolidating, append "> watermark <time>" at the end of the draft).')
if errors: raise SystemExit('Page runtime errors: %d; see qa.md' % len(errors))
