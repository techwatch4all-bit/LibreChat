# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""deliver.py -- deliver in one command: run the gate; red means no deliverable. On green/yellow, copy the film and write delivery-notes.md; the facts section is written by the script.

    uv run deliver.py <film.mp4> --out output/ [--spec clip.json | --project <engine-project>] [--qa <qa output dir>] [--root <project dir>]
                      [--sub-band 0.15] [--vertical auto|yes|no] [--allow-blue-purple "reason"]
    uv run deliver.py --verify output/delivery-notes.md       # check the facts section has not been edited

Does three things:
  1. Runs film_gate.py from the same directory. Red: no copy, no notes; prints the reason and how
     to fix it; exit code 2.
  2. Green or yellow: copies the film to --out and writes --out/delivery-notes.md. Every fact is
     written by the script: duration, resolution, frame rate, audio track, file fingerprint; each
     gate metric and its light; the worst 30 s window;
     whether qa ran and what it found (reads qa.json from the qa output dir; writes "not run" when
     absent);
     whether independent review records exist (whether <project dir>/review/*.md exists, listing
     the file names; writes "no review assigned" when there are none).
  3. The facts section ends with a fingerprint. The maker only adds subjective notes in the
     "Production notes" section (which grammar/style was used, why each yellow is acceptable,
     the six-ways-to-make-it-bad self-check); the facts section must not be edited -- --verify
     reports any change.

Conventions:
  - qa output dir: --qa wins; otherwise the same default as qa.py -- --spec -> <spec dir>/qa,
    --project -> the parent of the engine-project dir /qa.
  - Project dir: --root wins; otherwise the parent of --project; otherwise the spec dir; otherwise
    the film's directory.
  - The reviewer (an agent or person not involved in production) writes conclusions as
    <project dir>/review/<any name>.md. The script only checks that files exist; it does not read
    them and never draws conclusions for the reviewer.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import film_gate  # noqa: E402

DOC = "delivery-notes.md"
START = "<!-- deliver.py facts section: start. Written by the script; do not edit; deliver.py --verify reports changes -->"
END_RE = re.compile(r"<!-- deliver\.py facts section: end sha256=([0-9a-f]{64}) -->")
LIGHT = {"red": "Red", "yellow": "Yellow", "green": "Green", "--": ""}


def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                   "stream=codec_type,codec_name,width,height,avg_frame_rate:format=duration",
                                   "-of", "json", str(path)])
    j = json.loads(out)
    v = next(s for s in j["streams"] if s.get("codec_type") == "video")
    a = [s for s in j["streams"] if s.get("codec_type") == "audio"]
    num, _, den = (v.get("avg_frame_rate") or "0/1").partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    return {"duration": float(j["format"].get("duration") or 0), "width": v["width"], "height": v["height"],
            "fps": round(fps, 3), "vcodec": v.get("codec_name"), "audio": a[0].get("codec_name") if a else None}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def stamp(p):
    return datetime.datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")


def qa_facts(qa_dir, spec):
    """Reads qa.py's output. Returns the fact lines (a list)."""
    if qa_dir is None:
        return ["- Not run (no --spec / --project / --qa given, so there is nowhere to look for qa output)"]
    f = qa_dir / "qa.json"
    if not f.is_file():
        return [f"- Not run ({f} does not exist)"]
    try:
        r = json.loads(f.read_text())
    except (ValueError, OSError) as e:
        return [f"- qa.json unreadable: {f} ({type(e).__name__}); counted as not run"]
    segs = r.get("segments", [])
    det = sum(1 for s in segs if s.get("deterministic"))
    spikes = sum(len(s.get("spikes_at_lt", [])) for s in segs)
    cams = sum(len(s.get("camera_events_lt", [])) for s in segs)
    framing = sum(len(s.get("framing", [])) for s in segs)
    errs = r.get("page_errors", [])
    L = [f"- Ran: `{f}` (written {stamp(f)})",
         f"- Page errors: {len(errs)}" + (" (qa judged it failed)" if errs else ""),
         f"- Determinism: {det}/{len(segs)} segments pixel-identical",
         f"- Jumps: {spikes}" + (f"; plus {cams} camera events (monotonic, smooth push/pull or pan within 2 s; not jumps)" if "camera_events_lt" in (segs[0] if segs else {}) else ""),
         f"- Framing clues: {framing} (half-cut text, overlapping text, subtitle band, near blank; these mean 'go look at this frame', not errors)"]
    for s in segs:
        L.append(f"  - {s.get('id')}: motion {s.get('motion_pct')}%, still pairs {s.get('still_pairs_pct')}%, "
                 f"jumps {len(s.get('spikes_at_lt', []))}, {s.get('ms_mean')}/{s.get('ms_max')} ms/frame")
    if spec is not None and r.get("spec") and Path(r["spec"]).resolve() != spec.resolve():
        L.append(f"- Note: this qa.json measured a different spec ({r['spec']}), not {spec}")
    if spec is not None and spec.is_file() and spec.stat().st_mtime > f.stat().st_mtime:
        L.append(f"- Note: the spec changed after qa ran (spec written {stamp(spec)}); this qa result may be stale")
    return L


def review_facts(root):
    d = root / "review"
    files = sorted(p.name for p in d.glob("*.md")) if d.is_dir() else []
    if not files:
        return [f"- No review assigned (no .md files under `{d}`)"]
    return [f"- {len(files)} review record(s) (`{d}`): " + ", ".join(files),
            "- The script only confirms the files exist and did not read them; the review's conclusions live in the files themselves"]


def facts_block(src, dst, info, res, rows, qa_lines, rv_lines):
    ex = res["explain"]
    gl = res["gate_light"]
    L = ["## Facts (written by deliver.py)", "",
         f"- Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
         f"- Film: `{dst.name}` (sha256 {sha256(dst)[:16]}; source `{src}`)",
         f"- Duration {info['duration']:.2f}s | {info['width']}x{info['height']} | {info['fps']:g}fps | video {info['vcodec']} | "
         f"audio: {info['audio'] or 'none'}",
         "", "### Gate (film_gate)", "",
         f"- Verdict: {LIGHT[gl]}. Fast-motion frame share {res['fast_ratio']} (< 0.035 red, < 0.06 yellow)",
         f"- One line: {ex['summary']}." + ("; ".join(ex["why"]) + "." if ex["why"] else "")]
    if res.get("allow_blue_purple"):
        L.append(f"- Maker declares the subject needs blue-purple (blue-purple gate downgraded to yellow): {res['allow_blue_purple']}; blue-purple share {res['blue_purple_share']:.0%}")
    if ex["worst_window"]:
        w = ex["worst_window"]
        L.append(f"- Worst {w['end_s'] - w['start_s']:.0f} s window: {w['start_s']:.0f}-{w['end_s']:.0f}s, fast-motion share {w['fast_ratio']}")
    if ex["fix"]:
        L.append(f"- How to fix: {ex['fix']}")
    L += ["", "| Light | Type | Metric | Value |", "|---|---|---|---|"]
    for k, name, v, lv, gate, unit in rows:
        vs = "-" if v is None else (f"{v:.3f}" if isinstance(v, float) else str(v))
        L.append(f"| {LIGHT[lv] or 'data only'} | {'gate' if gate else 'report'} | {name} | {vs}{unit} |")
    L += ["", "### qa", ""] + qa_lines + ["", "### Independent review", ""] + rv_lines
    return "\n".join(L) + "\n"


def write_doc(out, dst, facts, res):
    h = hashlib.sha256(facts.encode()).hexdigest()
    look = [t for _, t in res["explain"]["look"]]
    if res["lights"]["fast_ratio"] == "yellow":
        look.insert(0, f"Gate yellow: fast-motion frame share {res['fast_ratio']} (yellow line 0.06)")
    tail = ["## Production notes (filled in by the maker; write only in this section, do not touch the facts section)", "",
            "- Grammar / style used:",
            "- 'Six ways to make it bad' self-check, item by item:",
            "- Yellow items explained one by one (timecode + why it is acceptable):" + ("" if look else " no yellow items")]
    tail += [f"  - {t}:" for t in look]
    doc = f"# Delivery notes: {dst.name}\n\n{START}\n{facts}<!-- deliver.py facts section: end sha256={h} -->\n\n" + "\n".join(tail) + "\n"
    (out / DOC).write_text(doc)
    return out / DOC


def verify(path):
    t = Path(path).read_text()
    i = t.find(START)
    m = END_RE.search(t)
    if i < 0 or not m or m.start() < i:
        print(f"FAIL {path}: cannot find the facts section start/end markers (deleted, or not written by deliver.py)"); return 3
    facts = t[i + len(START) + 1: m.start()]
    if hashlib.sha256(facts.encode()).hexdigest() != m.group(1):
        print(f"FAIL {path}: the facts section was edited and no longer matches what deliver.py wrote. Rerun deliver.py to regenerate."); return 3
    print(f"OK {path}: facts section matches what deliver.py wrote"); return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("mp4", nargs="?")
    ap.add_argument("--out", help="delivery directory (e.g. output/)")
    ap.add_argument("--spec", help="parameterized clip spec (used to find qa output: <spec dir>/qa)")
    ap.add_argument("--project", help="engine-project directory (used to find qa output: <parent of engine-project>/qa)")
    ap.add_argument("--qa", help="qa output directory (when qa.py --out wrote somewhere else)")
    ap.add_argument("--root", help="project directory (review/*.md is looked for under it)")
    ap.add_argument("--sub-band", type=float, default=None, help="same as film_gate.py: fraction of the bottom subtitle band to mask")
    ap.add_argument("--vertical", default="auto", choices=["auto", "yes", "no"])
    ap.add_argument("--verify", metavar="delivery-notes.md", help="only check whether the facts section was edited")
    ap.add_argument("--allow-blue-purple", metavar="reason", default=None,
                    help="same as film_gate.py: when the subject itself needs blue-purple, write the reason; it goes into the delivery-notes facts section")
    a = ap.parse_args()
    if a.verify:
        sys.exit(verify(a.verify))
    if not a.mp4 or not a.out:
        ap.error("the film path and --out are required")
    src = Path(a.mp4).resolve()
    if not src.is_file():
        print(f"Film not found: {src}", file=sys.stderr); sys.exit(1)
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("ffmpeg/ffprobe required", file=sys.stderr); sys.exit(1)
    spec = Path(a.spec).resolve() if a.spec else None
    proj = Path(a.project).resolve() if a.project else None
    qa_dir = Path(a.qa).resolve() if a.qa else spec.parent / "qa" if spec else proj.parent / "qa" if proj else None
    root = Path(a.root).resolve() if a.root else proj.parent if proj else spec.parent if spec else src.parent

    try:
        info = probe(src)
        res, rows = film_gate.measure(str(src), sub_band=a.sub_band, vertical=a.vertical, allow_blue_purple=a.allow_blue_purple)
    except (subprocess.CalledProcessError, StopIteration, KeyError, RuntimeError, ValueError) as e:
        print(f"Cannot read this film: {src} ({e})", file=sys.stderr); sys.exit(1)
    print("\n".join(film_gate.report_lines(res, rows)))
    ex = res["explain"]
    if res["verdict"] == "red":
        print(f"\nRED, not delivered: {ex['summary']}." + ("; ".join(ex["why"]) + "." if ex["why"] else ""))
        print("How to fix: " + ex["fix"])
        print(f"No film copied and no {DOC} written. Re-render after fixing, then run deliver.py again.")
        sys.exit(2)

    out = Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    dst = out / src.name
    if dst != src:
        shutil.copy2(src, dst)
    qa_lines, rv_lines = qa_facts(qa_dir, spec), review_facts(root)
    facts = facts_block(src, dst, info, res, rows, qa_lines, rv_lines)
    doc = write_doc(out, dst, facts, res)
    gl = res["gate_light"]
    print(f"\n{'OK green' if gl == 'green' else 'YELLOW'}, delivered: {dst}")
    print(f"Delivery notes: {doc} (the facts section is written by the script; subjective notes go only in the 'Production notes' section)")
    print("qa: " + qa_lines[0][2:])
    print("review: " + rv_lines[0][2:])
    if ex["look"]:
        print("Yellow items need timecode + reason in the delivery notes, one by one: " + "; ".join(t for _, t in ex["look"]))
    sys.exit(0)


if __name__ == "__main__":
    main()
