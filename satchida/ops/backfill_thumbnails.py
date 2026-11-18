"""Backfill library manifest thumbnails for entries published before the
publish-time thumbnail feature (2026-11-17).

Images: thumb = the image itself (serves as its own poster).
Videos: thumb = <stem>_thumb.jpg next to the file (same convention and ffmpeg
args as skill/satchida-montage-server.py::_make_video_thumbnail).

Usage:
    python satchida/ops/backfill_thumbnails.py [--manifest PATH]
"""

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MANIFEST = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated\manifest.json")
GENERATED = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated")

# Legacy directories searched when a manifest artifact is missing from the
# stable studio home. Missing files are PUBLISHED (copied) into GENERATED and
# the manifest URL is rewritten to /generated/<name>.
LEGACY_DIRS = (
    Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\videos"),
    Path(r"D:\LAN-AI-Infra\LibreChat\client\public\generated"),
    Path(r"D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated\videos"),
    Path(r"D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated"),
)


def find_ffmpeg() -> str:
    for cand in ("ffmpeg", r"D:\LAN-AI-Infra\ffmpeg\bin\ffmpeg.exe"):
        try:
            subprocess.run([cand, "-version"], capture_output=True, timeout=10)
            return cand
        except Exception:
            continue
    raise SystemExit("ffmpeg not found — cannot generate video thumbnails")


def make_video_thumb(video: Path, ffmpeg: str) -> str:
    thumb = video.with_name(video.stem + "_thumb.jpg")
    if thumb.exists() and thumb.stat().st_size > 512:
        return thumb
    for seek in ("1", "0"):
        cmd = [
            ffmpeg, "-y", "-ss", seek, "-i", str(video),
            "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", str(thumb),
        ]
        subprocess.run(cmd, capture_output=True, timeout=120)
        if thumb.exists() and thumb.stat().st_size > 512:
            return thumb
    raise RuntimeError(f"no frame extracted from {video.name}")


def publish_missing(entries, report):
    """Copy missing artifacts from legacy dirs into GENERATED and rewrite URLs."""
    for e in entries:
        if e.get("thumb") or e.get("_published"):
            continue
        url = e.get("url", "")
        rel = url.removeprefix("/generated").lstrip("/")
        f = (GENERATED / rel).resolve()
        if f.exists():
            continue
        name = e.get("name", "")
        src = next((d / name for d in LEGACY_DIRS if (d / name).exists()), None)
        if src is None:
            report.append((name, "artifact not found in any known directory"))
            continue
        dest = GENERATED / name
        shutil.copy2(src, dest)
        e["url"] = "/generated/" + name
        e["_published"] = True
        report.append((name, f"published from {src.parent} -> url fixed"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, default=MANIFEST)
    args = ap.parse_args()

    entries = json.loads(args.manifest.read_text(encoding="utf-8"))
    missing = [e for e in entries if not e.get("thumb")]
    if not missing:
        print("All manifest entries already carry thumbnails. Nothing to do.")
        return

    ffmpeg = find_ffmpeg()
    backup = args.manifest.with_name(
        args.manifest.stem + ".bak-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + ".json")
    shutil.copy2(args.manifest, backup)
    print(f"Backup: {backup}")

    report = []
    publish_missing(entries, report)
    for name, note in report:
        print(f"  publish: {name}: {note}")

    done, failed = 0, []
    for e in missing:
        e.pop("_published", None)
        url = e.get("url", "")
        rel = url.removeprefix("/generated").lstrip("/")
        f = (GENERATED / rel).resolve()
        if not f.exists():
            failed.append((e.get("name"), "artifact file missing"))
            continue
        try:
            if e.get("kind") == "video" and f.suffix.lower() in (".mp4", ".webm", ".mov"):
                thumb = make_video_thumb(f, ffmpeg)
                e["thumb"] = "/generated/" + thumb.relative_to(GENERATED).as_posix()
            else:
                e["thumb"] = url
            done += 1
        except Exception as exc:
            failed.append((e.get("name"), str(exc)))

    args.manifest.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Thumbnails added: {done} / {len(missing)}")
    if failed:
        print("Failed:")
        for name, why in failed:
            print(f"  - {name}: {why}")
        sys.exit(1)


if __name__ == "__main__":
    main()
