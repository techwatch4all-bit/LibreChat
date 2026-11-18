"""
Satchida media-cost & artifact reconciliation (billed vs delivered, per render).

Operator directive (2026-11-17): one place to see billed-vs-delivered per render.

Sources (read-only):
  - Bifrost logs.db `logs` (provider cost of truth): rows with object_type
    image_generation / video_generation.
  - one-api one-api.db `logs` (settlement): matched by request_id =
    'bifrost:<bifrost log id>' — deterministic, never timestamp-guessed.
  - Artifact match: file mtime within WINDOW seconds of the provider timestamp
    (UTC -> IST, matching prior manual reports) across every directory media
    lands in: Satchida-Studio exports/videos + exports/generated,
    AnythingLLM generated (+ videos/), LibreChat client/public/generated.

Output:
  - exports/media-reconciliation-<date>.csv + .md
  - Flag `--publish-missing` (default ON) publishes artifacts found only in
    unserved directories into the stable Studio Library (exports/generated),
    adds manifest entries, and rewrites the report URL column so every
    delivered render has a stable downloadable /generated/ link.

Run:  python satchida/ops/media_reconciliation.py [--date YYYY-MM-DD] [--no-publish]
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import sqlite3
import uuid
from pathlib import Path

BIFROST_DB = r"D:\LAN-AI-Infra\Bifrost\data\logs.db"
ONEAPI_DB = r"D:\LAN-AI-Infra\one-api\one-api.db"
STABLE_DIR = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated")
ARTIFACT_DIRS = [
    Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\videos"),
    Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated"),
    Path(r"D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated\videos"),
    Path(r"D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated"),
    Path(r"D:\LAN-AI-Infra\LibreChat\client\public\generated"),
]
VIDEO_EXTS = {".mp4", ".webm"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
WINDOW_SECONDS = 8
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def parse_ts(ts: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(ts)


def manifest_entries() -> list:
    p = STABLE_DIR / "manifest.json"
    try:
        entries = json.loads(p.read_text(encoding="utf-8"))
        return entries if isinstance(entries, list) else []
    except Exception:
        return []


def write_manifest(entries: list) -> None:
    entries.sort(key=lambda e: e.get("created", ""), reverse=True)
    (STABLE_DIR / "manifest.json").write_text(
        json.dumps(entries, indent=1), encoding="utf-8")


def publish_to_library(src: Path) -> str:
    """Copy into the stable library, register in manifest, return web URL."""
    STABLE_DIR.mkdir(parents=True, exist_ok=True)
    name = src.name
    dest = STABLE_DIR / name
    if dest.exists() and dest.stat().st_size != src.stat().st_size:
        name = f"{Path(name).stem}_{uuid.uuid4().hex[:8]}{Path(name).suffix}"
        dest = STABLE_DIR / name
    import shutil
    shutil.copyfile(src, dest)
    is_video = src.suffix.lower() in VIDEO_EXTS
    thumb_url = ""
    if is_video:
        try:
            import subprocess
            thumb = dest.with_name(dest.stem + "_thumb.jpg")
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-ss", "1", "-i", str(dest), "-frames:v", "1",
                 "-vf", "scale=640:-2", "-q:v", "4", str(thumb)],
                capture_output=True, timeout=120)
            if not (thumb.exists() and thumb.stat().st_size > 512):
                subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                     "-ss", "0", "-i", str(dest), "-frames:v", "1",
                     "-vf", "scale=640:-2", "-q:v", "4", str(thumb)],
                    capture_output=True, timeout=120)
            if thumb.exists() and thumb.stat().st_size > 512:
                thumb_url = f"/generated/{thumb.name}"
        except Exception:
            pass
    elif src.suffix.lower() in IMAGE_EXTS:
        thumb_url = f"/generated/{name}"
    entries = manifest_entries()
    if not any(e.get("name") == name for e in entries):
        entries.append({
            "name": name,
            "kind": "video" if is_video else "image",
            "url": f"/generated/{name}",
            "thumb": thumb_url,
            "download": f"/generated/{name}",
            "created": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "size": dest.stat().st_size,
        })
    write_manifest(entries)
    return f"/generated/{name}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.datetime.now(IST).strftime("%Y-%m-%d"))
    ap.add_argument("--no-publish", action="store_true",
                    help="skip publishing unserved artifacts into the library")
    args = ap.parse_args()
    date = args.date
    out_dir = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports")

    bf = sqlite3.connect(f"file:{BIFROST_DB}?mode=ro", uri=True)
    rows = bf.execute(
        "SELECT id, timestamp, object_type, provider, model, status, cost "
        "FROM logs WHERE timestamp >= ? AND timestamp < ? AND object_type IN "
        "('image_generation','video_generation') ORDER BY timestamp",
        (date, date + "T23:59:59.999999+99:99"),
    ).fetchall()
    bf.close()

    oa = sqlite3.connect(f"file:{ONEAPI_DB}?mode=ro", uri=True)
    settlements: dict[str, tuple] = {}
    for rid, created, quota, usd, content in oa.execute(
        "SELECT request_id, created_at, quota, upstream_cost_usd, content FROM logs "
        "WHERE type = 2 AND request_id LIKE 'bifrost:%' AND created_at >= ?",
        (int(datetime.datetime.fromisoformat(date + "T00:00:00+05:30").timestamp()),),
    ):
        settlements.setdefault(rid.split(":", 1)[1], []).append(
            (created, quota, usd, content or ""))
    oa.close()

    artifact_files = []
    for d in ARTIFACT_DIRS:
        if d.exists():
            for f in d.iterdir():
                if f.is_file() and f.suffix.lower() in (VIDEO_EXTS | IMAGE_EXTS) \
                        and "_thumb" not in f.stem:
                    try:
                        artifact_files.append(
                            (f, f.stat().st_mtime, f.suffix.lower()))
                    except OSError:
                        pass

    results = []
    claimed: set[Path] = set()
    for log_id, ts, obj, provider, model, status, cost in rows:
        local_ts = parse_ts(ts).astimezone(IST)
        matches = settlements.get(log_id, [])
        oa_usd = matches[0][2] if matches else None
        oa_quota = matches[0][1] if matches else None
        settle_status = "settled" if matches else "MISSING settlement"
        want_exts = VIDEO_EXTS if obj == "video_generation" else IMAGE_EXTS
        target = local_ts.timestamp()
        best = None
        for f, mtime, ext in artifact_files:
            if ext not in want_exts:
                continue
            delta = abs(mtime - target)
            if delta <= WINDOW_SECONDS and (best is None or delta < best[0]):
                best = (delta, f)
        artifact = best[1] if best else None
        if artifact and artifact in claimed:
            results.append({
                "local_time": local_ts.strftime("%Y-%m-%d %H:%M:%S"),
                "model": model,
                "object_type": obj.replace("_generation", ""),
                "provider": provider,
                "bifrost_status": status,
                "bifrost_usd": round(cost, 4) if cost is not None else "",
                "oneapi_usd": round(oa_usd, 4) if oa_usd is not None else "",
                "oneapi_quota": oa_quota if oa_quota is not None else "",
                "settlement": settle_status,
                "artifact": artifact.name,
                "artifact_status":
                    "OVERWRITTEN — billed render lost to a same-name later "
                    "render (pre-fix collision; output unrecoverable)",
                "url": "",
            })
            continue
        if artifact:
            claimed.add(artifact)
        served = None
        # Served bases: exports/generated → /generated/<name>,
        # AnythingLLM generated → /generated/<name>,
        # AnythingLLM generated/videos → /generated/videos/<name>.
        # client/public/generated is legacy (NOT served) → publish to stable.
        served_bases = {
            ARTIFACT_DIRS[1]: "/generated/",
            ARTIFACT_DIRS[3]: "/generated/",
            ARTIFACT_DIRS[2]: "/generated/videos/",
        }
        if artifact:
            if artifact.parent in served_bases:
                served = served_bases[artifact.parent] + artifact.name
            if not served and not args.no_publish:
                served = publish_to_library(artifact)
        tiny = (artifact.suffix.lower() in VIDEO_EXTS
                and artifact.stat().st_size < 100_000) if artifact else False
        if artifact and tiny:
            artifact_note = (
                "DELIVERED but SUSPECT truncated/stub (<100 KB) — served"
                if served else
                "DELIVERED on disk but SUSPECT truncated/stub (<100 KB)")
        elif artifact:
            artifact_note = ("DELIVERED — served" if served else
                             "DELIVERED on disk — not served")
        else:
            artifact_note = ("no artifact within ±8 s" if status == "success"
                             else "failed render")
        results.append({
            "local_time": local_ts.strftime("%Y-%m-%d %H:%M:%S"),
            "model": model,
            "object_type": obj.replace("_generation", ""),
            "provider": provider,
            "bifrost_status": status,
            "bifrost_usd": round(cost, 4) if cost is not None else "",
            "oneapi_usd": round(oa_usd, 4) if oa_usd is not None else "",
            "oneapi_quota": oa_quota if oa_quota is not None else "",
            "settlement": settle_status,
            "artifact": artifact.name if artifact else "",
            "artifact_status": artifact_note,
            "url": served or "",
        })

    ok = [r for r in results if r["bifrost_status"] == "success"]
    delivered = [r for r in results if r["artifact"]]
    csv_path = out_dir / f"media-reconciliation-{date}.csv"
    md_path = out_dir / f"media-reconciliation-{date}.md"
    cols = list(results[0].keys()) if results else [
        "local_time", "model", "object_type", "provider", "bifrost_status",
        "bifrost_usd", "oneapi_usd", "oneapi_quota", "settlement", "artifact",
        "artifact_status", "url"]
    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(results)

    lines = [
        f"# Media cost and artifact reconciliation — {date}",
        "",
        f"- Successful media cost in Bifrost: **${sum(r['bifrost_usd'] or 0 for r in ok):.6f}**",
        f"- Corresponding one-api wholesale cost: "
        f"**${sum(r['oneapi_usd'] or 0 for r in ok):.6f}**",
        f"- Successful Bifrost rows missing one-api settlement rows: "
        f"**{sum(1 for r in ok if r['settlement'] == 'MISSING settlement')}**",
        f"- Successful provider rows without a provable artifact: "
        f"**{sum(1 for r in ok if not r['artifact'])}**",
        f"- Successful rows with a served /generated URL: "
        f"**{sum(1 for r in ok if r['url'])} / {len(ok)}**",
        "",
        "Per render (billed vs delivered):",
        "",
        "| Local time | Model | Status | Bifrost $ | one-api $ | Artifact | URL |",
        "|---|---|---|---:|---:|---|---|",
    ]
    for r in results:
        lines.append(
            f"| {r['local_time']} | {r['model']} | {r['bifrost_status']} | "
            f"{r['bifrost_usd']} | {r['oneapi_usd']} | {r['artifact_status']} | "
            f"{r['url']} |")
    lines += [
        "",
        "Match method: one-api rows join Bifrost by request_id "
        "(`bifrost:<log id>`); artifacts join by file mtime within ±8 s of the "
        "provider timestamp (IST). URLs are served from the stable Studio "
        "Library; media found only in unserved directories is published there "
        "automatically (disable with --no-publish).",
    ]
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"renders: {len(results)} (success {len(ok)}, delivered {len(delivered)}, "
          f"served {sum(1 for r in results if r['url'])})")
    print(f"wrote {csv_path}")
    print(f"wrote {md_path}")


if __name__ == "__main__":
    main()
