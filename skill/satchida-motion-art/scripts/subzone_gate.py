#!/usr/bin/env python3
"""Subtitle-band gate: scans the no-subtitles cut of a film and reports timecodes where picture
content (text, outlines, rockets, flames) enters the subtitle band.

    python3 subzone_gate.py <no-subs.mp4> [--band 920] [--fps 10] [--thresh 150]

qa.py checks text boxes; this script additionally checks whether graphics enter the subtitle band.
It counts dark pixels (gray < 95), so it suits only clean light-ground styles (whiteboard, cream
paper, keynote light). Textured grounds (Vox kraft-paper desk) produce floods of false positives via
band-dominant-color diff: those styles rely on qa.py framing, or on the Vox approach of registering
text with its owning object through the text API and checking occlusion.
The threshold is a measured value from that film (>150 pixels after the band is scaled to 960x80);
when switching styles, calibrate against one known-good and one known-bad frame first.
"""
import argparse, subprocess, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--band', type=int, default=920, help='top edge y of the subtitle band (1080-high frame)')
ap.add_argument('--fps', type=float, default=10); ap.add_argument('--thresh', type=int, default=150)
a = ap.parse_args()
h = 1080 - a.band; W, H = 960, h // 2
cmd = ['ffmpeg', '-v', 'error', '-i', a.video, '-vf', f'fps={a.fps},scale=1920:1080,crop=1920:{h}:0:{a.band},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
raw = subprocess.run(cmd, capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
bad = []
for i, f in enumerate(fr):
    n = int((f < 95).sum())
    if n > a.thresh: bad.append((i / a.fps, n))
runs = []
for t, n in bad:
    if runs and t - runs[-1][1] <= 1.5 / a.fps: runs[-1][1] = t; runs[-1][2] = max(runs[-1][2], n)
    else: runs.append([t, t, n])
print(f'{len(fr)} frames, {len(bad)} hit')
for t0, t1, n in runs: print(f'  {t0:7.2f}-{t1:7.2f}s  at most {n} pixels')
