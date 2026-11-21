"""Local asset paths inside a clip spec: find them, verify existence, rewrite them into URLs the
local server can serve. Used by render.py (qa.py follows the same pattern).

Recognized fields (paths relative to the spec file; absolute paths also allowed; data: / http(s):
passes through untouched):
  cues[].image                 one image (screenshot, photo, a frame of footage)
  cues[].frames                frame sequence: a directory (.png/.jpg/.jpeg/.webp sorted by file
                               name) or an array of paths; paired with cues[].fps (default 30)
  data.image                   a grammar-level image (y1 uses it as the central object)
  data.character               y4 character: a preset name (neutral / bun / author) passes through
                               as-is (y4 retired code-drawn characters and errors at startup asking
                               for a frame library); a directory -> frame library (file name minus
                               extension = pose name); an object {frames: {pose: path} | directory}
                               works the same way
A missing file -> FileNotFoundError (the caller refuses to render; no blank frames).
"""
import urllib.parse
from pathlib import Path

FRAME_EXT = ('.png', '.jpg', '.jpeg', '.webp')
PRESETS = ('neutral', 'bun', 'author')


def _url(f, allowed):
    allowed.add(str(f))
    return '/__file__/' + urllib.parse.quote(str(f))


def _file(v, base, allowed, what):
    if not v or str(v).startswith(('data:', 'http:', 'https:')):
        return v
    f = (base / v).resolve()
    if not f.is_file():
        raise FileNotFoundError(f'spec {what} does not exist: {v} (relative to {base})')
    return _url(f, allowed)


def _dir_frames(v, base, what):
    d = (base / v).resolve()
    if not d.is_dir():
        return None
    files = sorted(p for p in d.iterdir() if p.suffix.lower() in FRAME_EXT)
    if not files:
        raise FileNotFoundError(f'the spec {what} directory is empty (no {"/".join(FRAME_EXT)}): {v}')
    return files


def localize(spec, base, allowed):
    """Rewrites spec in place. base = the spec's directory; allowed collects the absolute paths that
    may be served."""
    base = Path(base)
    for q in spec.get('cues', []):
        if q.get('image'):
            q['image'] = _file(q['image'], base, allowed, 'image')
        fr = q.get('frames')
        if isinstance(fr, str):
            files = _dir_frames(fr, base, 'frame sequence')
            if files is None:
                raise FileNotFoundError(f'the spec frame-sequence directory does not exist: {fr} (relative to {base})')
            q['frames'] = [_url(f, allowed) for f in files]
        elif isinstance(fr, list):
            if not fr:
                raise FileNotFoundError('spec frames is an empty array')
            q['frames'] = [_file(v, base, allowed, 'video frame') for v in fr]
    data = spec.get('data') or {}
    if data.get('image'):
        data['image'] = _file(data['image'], base, allowed, 'image')
    ch = data.get('character')
    if isinstance(ch, str) and ch not in PRESETS:
        files = _dir_frames(ch, base, 'character frame library')
        if files is None:
            raise FileNotFoundError(f'data.character is neither a preset ({" / ".join(PRESETS)}) nor a frame-library directory: {ch} (relative to {base})')
        data['character'] = {'frames': {f.stem: _url(f, allowed) for f in files}}
    elif isinstance(ch, dict):
        fr = ch.get('frames')
        if isinstance(fr, str):
            files = _dir_frames(fr, base, 'character frame library')
            if files is None:
                raise FileNotFoundError(f'data.character.frames directory does not exist: {fr} (relative to {base})')
            ch['frames'] = {f.stem: _url(f, allowed) for f in files}
        elif isinstance(fr, dict):
            ch['frames'] = {k: _file(v, base, allowed, f'character frame "{k}"') for k, v in fr.items()}
    return spec
