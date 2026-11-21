"""Layout audit: samples one frame every 0.25 s of a parameterized clip and aggregates text layout
problems. Called by render.py --spec X --audit.
Red (exit code 1): text out of bounds, swallowed by the safe area, two different strings pressing on
each other. Yellow: text below the readable floor (when it is not a deliberate footnote size, judge
by hand).
"""
import json


def run(pg, spec, grab, step=0.25):
    W, H, dur = spec.get('width', 1920), spec.get('height', 1080), spec['duration']
    safe = {'top': 0, 'bottom': 0, 'left': 0, 'right': 0, **(spec.get('safe') or {})}
    short = min(W, H); floor = 0.0204 * short                      # 1080 short side ~ 22px
    ts = [round(i * step, 3) for i in range(int(dur / step) + 1)] + [round(dur - 1 / spec.get('fps', 30), 3)]
    seen, red, yel = {}, [], []
    for t in ts:
        pg.evaluate('t => { window.__AUDIT.length = 0; window.__auditT = t; }', t)
        pg.evaluate(grab, t)
        items = [i for i in pg.evaluate('window.__AUDIT') if i['a'] > 0.35]
        for it in items:
            w, h = it['x1'] - it['x0'], it['y1'] - it['y0']
            if w < 1 or h < 1: continue
            vis = max(0, min(it['x1'], W) - max(it['x0'], 0)) * max(0, min(it['y1'], H) - max(it['y0'], 0)) / (w * h)
            if 0 < vis < 0.97 and it['px'] >= 8:             # vis==0: the whole string is off-canvas (inside a transition/camera pan), doesn't count
                k = ('out of bounds', it['text'][:20]); seen.setdefault(k, [t, t, f'visible {vis:.0%}, size {it["px"]:.0f}px', 0]); seen[k][1] = t; seen[k][3] += 1
            elif (safe['top'] or safe['bottom'] or safe['left'] or safe['right']) and (it['y0'] < safe['top'] - 2 or it['y1'] > H - safe['bottom'] + 2 or it['x0'] < safe['left'] - 2 or it['x1'] > W - safe['right'] + 2) and it['px'] >= 20:
                k = ('in safe area', it['text'][:20]); seen.setdefault(k, [t, t, f'size {it["px"]:.0f}px', 0]); seen[k][1] = t; seen[k][3] += 1
            if it['px'] < floor and len(it['text']) >= 3 and it['px'] >= 6:
                k = ('text too small', it['text'][:20]); seen.setdefault(k, [t, t, f'{it["px"]:.0f}px < floor {floor:.0f}px', 0]); seen[k][1] = t; seen[k][3] += 1
        # Pressing on each other
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if a['text'] == b['text'] or a['px'] < 14 or b['px'] < 14 or len(a['text'].strip()) <= 2 or len(b['text'].strip()) <= 2: continue   # single characters are mostly formula/icon parts, deliberately stacked
                ox, oy = min(a['x1'], b['x1']) - max(a['x0'], b['x0']), min(a['y1'], b['y1']) - max(a['y0'], b['y0'])
                if ox <= 2 or oy <= 2: continue
                sm = min((a['x1'] - a['x0']) * (a['y1'] - a['y0']), (b['x1'] - b['x0']) * (b['y1'] - b['y0']))
                if sm > 0 and ox * oy / sm > 0.3:
                    k = ('overlapping text', (a['text'][:10] + ' x ' + b['text'][:10])); seen.setdefault(k, [t, t, f'overlap {ox * oy / sm:.0%}', 0]); seen[k][1] = t; seen[k][3] += 1
    for (kind, txt), (t0, t1, note, cnt) in seen.items():
        if cnt < 2: continue                   # seen at a single sample: usually a transition instant, don't report
        if kind == 'out of bounds' and cnt < 3: continue  # a screen-swap push lasts ~0.4s: the old picture being pushed out is a designed action; out-of-bounds must persist 3 samples (>=0.5s) to count
        row = {'kind': kind, 'text': txt, 't0': t0, 't1': t1, 'note': note}
        (yel if kind == 'text too small' else red).append(row)
    print(f'layout audit {W}x{H} {dur}s: red {len(red)} yellow {len(yel)}')
    for r in red: print(f"  RED {r['kind']}  '{r['text']}'  {r['t0']}-{r['t1']}s  {r['note']}")
    for r in yel: print(f"  YELLOW {r['kind']}  '{r['text']}'  {r['t0']}-{r['t1']}s  {r['note']}")
    if not red and not yel: print('  OK: no layout problems found')
    return {'red': red, 'yellow': yel, 'size': [W, H], 'duration': dur}
