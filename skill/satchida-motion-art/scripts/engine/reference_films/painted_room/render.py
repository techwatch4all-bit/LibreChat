"""One room, sixteen ways of painting it - rendering. All output is written to this directory's out/.
  uv run --with playwright python render.py --stills            one still per painting style
  uv run --with playwright python render.py --frames 0,100,300  specific frames of the full film
  uv run --with playwright python render.py --film [--workers 6] [--audio music.wav]
Character frames are optional: --sprites <dir> (default: the 角色帧/ folder in this directory — the name is a code key and stays as-is).
One subdirectory per action, transparent PNGs sorted by filename, action names matching the keys in film2.js:
走路(walk)、伸手拖拽(reach-drag)、挥手(wave)、欢呼跳(cheer-jump)、思考想通(idea-moment)、待机眨眼(idle-blink).
Without character frames the room still plays, just with no one in it.
"""
import base64, sys, pathlib, subprocess
from concurrent.futures import ProcessPoolExecutor
from playwright.sync_api import sync_playwright

here = pathlib.Path(__file__).resolve().parent
BLOCK = 12  # 12 frames per block, dealt round-robin to the worker processes so slow sections even out

def opt(args, name, default=None):
    return args[args.index(name) + 1] if name in args else default

def sprites(folder):
    d = pathlib.Path(folder)
    if not d.is_dir(): return {}
    # loading images directly over file:// taints the canvas and blocks frame export, so pass them in as data URLs
    return {a.name: ['data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted(a.glob('*.png'))] for a in sorted(d.iterdir()) if a.is_dir()}

def page_of(p, spr):
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.on('console', lambda m: print('console:', m.text)); pg.on('pageerror', lambda e: print('pageerror:', e))
    pg.goto((here / 'film.html').as_uri()); pg.evaluate('(m) => loadSprites(m)', sprites(spr))
    return b, pg

def save(data, f): f.write_bytes(base64.b64decode(data.split(',')[1]))

def work(job):
    frames, out, spr = job
    with sync_playwright() as p:
        br, pg = page_of(p, spr)
        for i in frames: save(pg.evaluate(f'FILM2.frame({i})'), pathlib.Path(out) / f'{i:05d}.jpg')
        br.close()
    return len(frames)

if __name__ == '__main__':
    args = sys.argv[1:]
    spr = opt(args, '--sprites', str(here / '角色帧'))
    out = here / 'out'; out.mkdir(exist_ok=True)
    if '--film' in args:
        workers = int(opt(args, '--workers', 6)); fr = out / 'frames'; fr.mkdir(exist_ok=True)
        with sync_playwright() as p:
            br, pg = page_of(p, spr); n = pg.evaluate('FILM2.frames'); fps = pg.evaluate('FILM2.FPS'); br.close()
        jobs = [([i for b in range(w * BLOCK, n, workers * BLOCK) for i in range(b, min(n, b + BLOCK))], str(fr), spr) for w in range(workers)]
        with ProcessPoolExecutor(workers) as ex:
            for r in ex.map(work, jobs): print('done', r, flush=True)
        mp4 = out / 'painted_room.mp4'; audio = opt(args, '--audio')
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', str(fr / '%05d.jpg')]
        if audio: cmd += ['-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest']
        subprocess.run(cmd + ['-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(mp4)], check=True)
        print('->', mp4, n, 'frames')
    else:
        with sync_playwright() as p:
            br, pg = page_of(p, spr)
            if '--frames' in args:
                for i in opt(args, '--frames').split(','):
                    save(pg.evaluate(f'FILM2.frame({i})'), out / f'frame_{int(i):05d}.jpg'); print('frame', i)
            else:
                for e in pg.evaluate('FILM2.ERAS.map(e=>[e.id,e.t0])'):
                    save(pg.evaluate(f"FILM2.still('{e[0]}', {e[1] + 1.4})"), out / f'era_{e[0]}.jpg'); print(e[0])
            br.close()
