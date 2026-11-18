"""
Fix past-chat generated-content links (operator request, 2026-11-17).

Scans LibreChat Mongo `messages` for /generated/... and /motion/... links,
verifies each file is served, repairs what is repairable, and reports:

  1. OK        — file served today at the linked URL
  2. REPAIRED  — file existed only in an unserved location (legacy
                 client/public/generated, exports/videos) → republished into
                 the stable Studio Library and the message content rewritten
                 (--fix to actually rewrite message content)
  3. BROKEN    — file gone (usually an overwrite collision before the
                 unique-filename fix) → unrepairable

Chats whose latest media link is unrepairable go into the deletion-candidate
report (exports/chat-link-audit-<ts>.md) for operator confirmation — nothing
is deleted by this script.

Run:  python satchida/ops/fix_chat_links.py [--fix] [--dry-run]
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
from pathlib import Path

from pymongo import MongoClient

MONGO_URI = "mongodb://127.0.0.1:27017/LibreChat"
SERVED_DIRS = [
    Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated"),
    Path(r"D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated"),
    Path(r"D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated\videos"),
]
UNSERVED_DIRS = [
    Path(r"D:\LAN-AI-Infra\LibreChat\client\public\generated"),
    Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\videos"),
]
GEN_LINK_RE = re.compile(r"/generated/([A-Za-z0-9._\-]+)")
MOTION_LINK_RE = re.compile(r"/motion/([A-Za-z0-9._\-]+)")
MOTION_DIR = Path(r"D:\LAN-AI-Infra\LibreChat\client\public\motion")
# Chats sometimes delivered bare filesystem paths — not downloadable in chat.
PATH_LINK_RE = re.compile(
    r"D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\videos\\([A-Za-z0-9._\-]+\.(?:mp4|webm|png|jpg|jpeg|webp))")

# Sorted newest first
GEN_LINK_RE_MULTILINE = re.compile(r"/generated/([A-Za-z0-9._\-]+)")


def publish_to_library(src: Path) -> str:
    import shutil
    import uuid as _uuid
    STABLE = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated")
    STABLE.mkdir(parents=True, exist_ok=True)
    name = src.name
    dest = STABLE / name
    if dest.exists() and dest.stat().st_size != src.stat().st_size:
        name = f"{Path(name).stem}_{_uuid.uuid4().hex[:8]}{Path(name).suffix}"
        dest = STABLE / name
    shutil.copyfile(src, dest)
    is_video = src.suffix.lower() in {".mp4", ".webm"}
    thumb_url = ""
    if is_video:
        try:
            import subprocess
            thumb = dest.with_name(dest.stem + "_thumb.jpg")
            for ss in ("1", "0"):
                subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                     "-ss", ss, "-i", str(dest), "-frames:v", "1",
                     "-vf", "scale=640:-2", "-q:v", "4", str(thumb)],
                    capture_output=True, timeout=120)
                if thumb.exists() and thumb.stat().st_size > 512:
                    thumb_url = f"/generated/{thumb.name}"
                    break
        except Exception:
            pass
    elif src.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
        thumb_url = f"/generated/{name}"
    manifest_path = STABLE / "manifest.json"
    entries = []
    try:
        entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        pass
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
    entries.sort(key=lambda e: e.get("created", ""), reverse=True)
    manifest_path.write_text(json.dumps(entries, indent=1), encoding="utf-8")
    return f"/generated/{name}"


def resolve_served(name: str) -> str | None:
    for d in SERVED_DIRS:
        if (d / name).exists():
            rel = f"videos/{name}" if d.name == "videos" else name
            return f"/generated/{rel}"
    return None


def resolve_unserved(name: str) -> Path | None:
    for d in UNSERVED_DIRS:
        p = d / name
        if p.exists() and p.is_file() and p.stat().st_size > 1024:
            return p
    return None


def _as_text(content) -> tuple[str, list | None]:
    """Return (flattened_text, parts_or_None). Handles LibreChat string and
    content-parts arrays."""
    if isinstance(content, str):
        return content, None
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict):
                parts.append(p)
        text = " ".join(
            (p.get("text") or "") if isinstance(p, dict) else str(p)
            for p in content)
        return text, content
    return "", None


def _repair_text(text: str, chat, stats, repairs) -> tuple[str, bool]:
    """Verify/repair every /generated/ link, /motion/ link, and bare
    filesystem path in a text blob. Returns (new_text, changed)."""
    new_text = text
    changed = False
    for name in sorted(set(GEN_LINK_RE.findall(text))):
        chat["names"].add(name)
        served = resolve_served(name)
        if served:
            stats["OK"] += 1
            chat["OK"] += 1
            if served != f"/generated/{name}":
                new_text = new_text.replace(f"/generated/{name}", served)
                changed = True
                chat["REPAIRED"] += 1
            continue
        src = resolve_unserved(name)
        if src:
            url = publish_to_library(src)
            new_text = new_text.replace(f"/generated/{name}", url)
            changed = True
            stats["REPAIRED"] += 1
            chat["REPAIRED"] += 1
            repairs.append((chat.get("cid", ""), name, url))
        else:
            stats["BROKEN"] += 1
            chat["BROKEN"] += 1
    for mname in sorted(set(MOTION_LINK_RE.findall(text))):
        if (MOTION_DIR / mname).exists():
            stats["OK"] += 1
            chat["OK"] += 1
        else:
            stats["BROKEN"] += 1
            chat["BROKEN"] += 1
    for fname in sorted(set(PATH_LINK_RE.findall(text))):
        served = resolve_served(fname)
        if not served:
            src = resolve_unserved(fname)
            served = publish_to_library(src) if src else None
        if served:
            new_text = new_text.replace(
                rf"D:\LAN-AI-Infra\Satchida-Studio\exports\videos\{fname}", served)
            changed = True
            stats["REPAIRED"] += 1
            chat["REPAIRED"] += 1
            repairs.append((chat.get("cid", ""), fname, served))
            chat["names"].add(fname)
        else:
            stats["BROKEN"] += 1
            chat["BROKEN"] += 1
    return new_text, changed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true",
                    help="rewrite message content for repairable links")
    args = ap.parse_args()

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client["LibreChat"]
    conv_titles = {str(c["_id"]): c.get("title", "")
                   for c in db["conversations"].find({}, {"title": 1})}

    stats = {"OK": 0, "REPAIRED": 0, "BROKEN": 0}
    motion_stats = {"OK": 0, "BROKEN": 0}
    repairs = []
    per_chat: dict[str, dict] = {}
    for msg in db["messages"].find({}, {"content": 1, "conversationId": 1, "role": 1}):
        text, parts = _as_text(msg.get("content"))
        if not (GEN_LINK_RE.search(text) or MOTION_LINK_RE.search(text)
                or PATH_LINK_RE.search(text)):
            continue
        cid = str(msg.get("conversationId", ""))
        chat = per_chat.setdefault(cid, {"title": conv_titles.get(cid, ""),
                                         "OK": 0, "REPAIRED": 0, "BROKEN": 0,
                                         "names": set(), "cid": cid})
        if parts is None:
            new_text, changed = _repair_text(text, chat, stats, repairs)
            new_content = new_text
        else:
            new_parts = []
            changed = False
            for p in parts:
                if isinstance(p, dict) and isinstance(p.get("text"), str) \
                        and (GEN_LINK_RE.search(p["text"]) or MOTION_LINK_RE.search(p["text"])
                             or PATH_LINK_RE.search(p["text"])):
                    nt, c = _repair_text(p["text"], chat, stats, repairs)
                    if c:
                        changed = True
                        p = {**p, "text": nt}
                new_parts.append(p)
            new_content = new_parts
        if changed and args.fix:
            db["messages"].update_one(
                {"_id": msg["_id"]}, {"$set": {"content": new_content}})

    out_dir = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports")
    ts = datetime.datetime.now().strftime("%Y-%m-%d")
    report = out_dir / f"chat-link-audit-{ts}.md"
    lines = [
        f"# Chat generated-link audit — {ts}",
        "",
        f"- links checked: **{sum(stats.values())}** — OK {stats['OK']}, "
        f"REPAIRED {stats['REPAIRED']}, BROKEN {stats['BROKEN']}",
        f"- motion links: OK {motion_stats['OK']}, BROKEN {motion_stats['BROKEN']}",
        f"- content rewrite applied: **{args.fix}**",
        "",
        "## Deletion candidates (chats whose media links are unrepairable)",
        "",
        "| Conversation | Title | Broken links | Names |",
        "|---|---|---|---|",
    ]
    for cid, chat in sorted(per_chat.items()):
        if chat["BROKEN"] and not chat["OK"] and not chat["REPAIRED"]:
            names = ", ".join(sorted(chat["names"]))
            lines.append(f"| {cid} | {chat['title']} | {chat['BROKEN']} | {names} |")
    lines += ["", "## Repaired links", ""]
    for cid, name, url in repairs:
        lines.append(f"- {cid}: /generated/{name} → {url}")
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(stats)
    print(f"wrote {report}")


if __name__ == "__main__":
    main()
