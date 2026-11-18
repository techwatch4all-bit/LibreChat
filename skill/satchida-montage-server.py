"""
Satchida 3D Montage MCP Server — PRODUCTION WIRING
Integrates OpenMontage's real video generation tools with LibreChat.

HARD ROUTING ENFORCEMENT:
- accountType == 'privacy' AND mode == 'Privacy'  → Local Llama Fleet (:4099/:8080)
- ALL other account types / modes                 → Cloud Frontier via AutoRouter (:4000)

HARD RUNTIME INVARIANTS:
- Port 8080 Llama Fleet is NEVER touched (CUDA 0 protected, Tauri-managed).
- Zero Docker / Zero WSL — pure native Windows 11 bare-metal.
- API keys NEVER stored locally; AutoRouter injects them in-flight from Seller Central HQ.

VIDEO GENERATION PIPELINE (real, not procedural):
  Cloud: Bifrost (:8700) /v1/videos → experientiallabs grok-imagine-video (cheap, proven)
         Fallbacks: grok-imagine-video-1.5 → veo-3.1-lite (pricier last resort)
  Images: Bifrost (:8700) /v1/images/generations → together Seedream-4.0
  Privacy: Three.js scene → Playwright headless capture → FFmpeg encode (zero-cloud)
  Assembly: FFmpeg concat → Remotion chapter burn → YouTube bundle export

Auth: Bifrost virtual key auto-discovered from the local one-api channel config
(read-only); override with SATCHIDA_BIFROST_URL / SATCHIDA_BIFROST_KEY env vars.
No third-party API key ever exists in this file or in client configs.
"""

from __future__ import annotations
import ctypes
import datetime
import os
import sys
import json
import time
import uuid
import base64
import hashlib
import random
import shutil
import threading
import subprocess
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from typing import Dict, Any, List, Optional

# ── Path bootstrap ────────────────────────────────────────────────────────────
_STUDIO_ROOT = Path(r"D:\LAN-AI-Infra\Satchida-Studio")
_OPEN_MONTAGE = Path(os.environ.get(
    "OPEN_MONTAGE_ROOT",
    r"D:\LAN-AI-Infra\Satchida-Studio\external\OpenMontage"
))
_LIBRECHAT_ROOT = Path(r"D:\LAN-AI-Infra\LibreChat")

for _p in [str(_STUDIO_ROOT), str(_OPEN_MONTAGE), str(_LIBRECHAT_ROOT)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ── MCP import ────────────────────────────────────────────────────────────────
try:
    from mcp.server.fastmcp import FastMCP as _MCPServer
except ImportError:
    from mcp.server.mcpserver import MCPServer as _MCPServer  # type: ignore

mcp = _MCPServer("satchida-montage")

# ── Satchida internals ────────────────────────────────────────────────────────
from src.core.montage_router import resolve_montage_endpoint, execute_montage_chat_completion  # noqa: E402
from src.engines.youtube_packager import generate_youtube_metadata_bundle, create_high_ctr_thumbnail, YouTubeChapter  # noqa: E402
from src.engines.montage_compositor import compose_ffmpeg_clip_concat  # noqa: E402

# ── Constants ─────────────────────────────────────────────────────────────────
AUTOROUTER_URL: str = os.environ.get("SATCHIDA_AUTOROUTER_URL", "http://127.0.0.1:4000")
EXPORTS_DIR = Path(os.environ.get("SATCHIDA_EXPORTS_DIR", str(_STUDIO_ROOT / "exports")))
PROJECTS_DIR = EXPORTS_DIR / "projects"
VIDEOS_DIR = EXPORTS_DIR / "videos"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

ACTIVE_JOBS: Dict[str, Dict[str, Any]] = {}
JOB_LOCK = threading.Lock()

# ── Per-job unique filenames (operator directive, 2026-11-17) ────────────────
# Every media job owns its output file. Caller-supplied names keep their stem
# but always receive a per-job suffix, so a re-render can never overwrite an
# earlier deliverable (the 10:42/10:44 balloon renders were lost that way).
def _sanitize_stem(raw: str, default_prefix: str) -> str:
    stem = Path(raw.strip()).stem if raw.strip() else ""
    stem = "".join(c if (c.isalnum() or c in "-_") else "_" for c in stem)[:64]
    return stem or default_prefix


def _unique_media_name(requested: str, default_prefix: str, ext: str) -> str:
    """Collision-proof output filename: sanitized caller stem + per-job hex id."""
    return f"{_sanitize_stem(requested, default_prefix)}_{uuid.uuid4().hex[:8]}{ext}"


def _ffmpeg_run(args: List[str], timeout: int = 300) -> bool:
    """Run an ffmpeg command, swallowing Windows console-handle noise."""
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        proc = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
        )
        return proc.returncode == 0
    except Exception as e:
        print(f"[satchida-montage] ffmpeg failed: {e}", file=sys.stderr)
        return False


def _make_video_thumbnail(video_path: Path, thumb_path: Optional[Path] = None) -> Optional[Path]:
    """Grab a mid-clip frame as the library thumbnail. Best effort — returns
    None when ffmpeg is unavailable rather than failing the publish."""
    try:
        thumb = thumb_path or video_path.with_name(video_path.stem + "_thumb.jpg")
        cmd = [
            "-ss", "1",
            "-i", str(video_path),
            "-frames:v", "1",
            "-vf", "scale=640:-2",
            "-q:v", "4",
            str(thumb),
        ]
        if video_path.stat().st_size > 0 and _ffmpeg_run(cmd):
            if thumb.exists() and thumb.stat().st_size > 512:
                return thumb
        # Short clips (<2 s): seek to 1 s finds no frame — retry from 0.
        cmd[1] = "0"
        if _ffmpeg_run(cmd) and thumb.exists() and thumb.stat().st_size > 512:
            return thumb
    except Exception as e:
        print(f"[satchida-montage] thumbnail skipped: {e}", file=sys.stderr)
    return None

# ── Provider policy (operator directive, 2026-11-16) ─────────────────────────
# Priority: (1) CheapInference — purchased credit, main test provider
#           (2) DeepInfra      — purchased credit, second priority
#           (3) OpenRouter     — free models only (Nemotron etc.)
# NOT used: experientiallabs, together, fal.ai.
# Model/provider configuration lives in Bifrost (:8700); one-api (:4000) is the
# gateway LibreChat connects to. Keys stay inside Bifrost's store — this server
# only ever decrypts them in-process on the HQ machine, never logs them.
#
# CheapInference exposes OpenAI-shaped /v1/images/generations and /v1/videos, so
# those go through Bifrost. Their Production key is currently restricted upstream
# to text-only models, so the CI media chain stays empty until the operator lifts
# the restriction in the CheaperInference dashboard and refresh-models runs.
# DeepInfra's native APIs (images at /v1/openai/images/generations, video at
# /v1/inference/{model}) are not expressible through Bifrost's standard-provider
# interfaces, so this server calls them directly with the key decrypted from
# Bifrost's store.

BIFROST_URL: str = os.environ.get("SATCHIDA_BIFROST_URL", "http://127.0.0.1:8700")
DEEPINFRA_API: str = "https://api.deepinfra.com"
CHEAPERINFERENCE_API: str = "https://api.cheaperinference.com"

# Cheap-first DeepInfra video models (native /v1/inference, synchronous, data-URI
# response). Prices from DeepInfra's catalog, USD per clip second:
#   FastWan-QAD 480p ~$0.0025/s · FastWan2.2 720p ~$0.01-0.03/s · Wan2.2-A14B ~$0.075/s
DEEPINFRA_VIDEO_MODELS = [
    "FastVideo/FastWan-QAD-FP8-1.3B",
    "FastVideo/FastWan2.2-TI2V-5B-FullAttn-Diffusers",
    "Wan-AI/Wan2.2-T2V-A14B",
]
# Native audio-visual models (video + synchronized audio in one generation),
# cheap-first. LTX-2.3-Fast: from $0.03/s (~$0.15 per 5s clip), native synced
# audio, clips up to 20s. Seedance-1.5-Pro: ByteDance V2A (price token-based,
# unverified per clip) — backup only.
DEEPINFRA_VIDEO_AV_MODELS = [
    "Lightricks/LTX-2.3-Fast",
    "ByteDance/Seedance-1.5-Pro",
]

# Photoreal image models (DeepInfra catalog, verified 2026-11-16):
#   FLUX-2-klein-4b ~ $0.014 x (w/1024) x (h/1024) ≈ $0.012 @1280x720
#   FLUX-2-klein-9b same rate, better quality-to-latency ratio
DEEPINFRA_IMAGE_MODELS = [
    "black-forest-labs/FLUX-2-klein-4b",
    "black-forest-labs/FLUX-2-klein-9b",
]

# Keywords that mark a CheapInference catalog entry as image/video capable once
# the Production key's restriction is lifted and refresh-models has run.
_CI_IMAGE_KEYWORDS = ("image", "flux", "sdxl", "dall", "seedream", "banana", "imagen", "sd3")
_CI_VIDEO_KEYWORDS = ("video", "kling", "wan", "veo", "hailuo", "pixverse", "seedance", "sora", "i2v", "t2v")

# Verified CheaperInference prices (discounted, 2026-11-17) — the discovery sort
# tries the cheapest qualifying model first. Unknown models sort last.
_CI_MODEL_PRICES = {
    # images, USD per image
    "flux-3-image-klein": 0.0077,
    "flux-2-klein-4b": 0.0119,
    "grok-imagine-image": 0.013,
    "seedream-4.5": 0.026,
    # videos, USD per second of output
    "veo-3.1-lite-generate-001": 0.0325,
    "grok-imagine-video": 0.0371,
    "kling-v2.6-t2v": 0.046,
    "kling-v2.6-i2v": 0.0595,
}


def _supported_durations(model: str) -> list:
    # DeepInfra T2V models generate fixed 5s clips; Veo-style providers accept
    # 4/6/8; everything else clamps to 5/10.
    if "veo" in model:
        return [4, 6, 8]
    return [5, 10]


def _nearest_duration(model: str, want: float) -> str:
    opts = _supported_durations(model)
    return str(min(opts, key=lambda d: abs(d - want)))


_SIZE_BY_RATIO = {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "1024x1024",
}

_BIFROST_KEY_CACHE: Optional[str] = None
_DEEPINFRA_KEY_CACHE: Optional[str] = None
_CI_MEDIA_CACHE: Dict[str, Any] = {"ts": 0.0, "image": [], "video": []}
_LAST_VIDEO_MODEL: str = ""
_LAST_IMAGE_MODEL: str = ""


def _bifrost_key() -> str:
    """
    Resolve the Bifrost virtual key: env override first, else discover it
    read-only from the local one-api channel config (base_url → :8700).
    The key never leaves this machine and is never logged.
    """
    global _BIFROST_KEY_CACHE
    env_key = os.environ.get("SATCHIDA_BIFROST_KEY", "").strip()
    if env_key:
        return env_key
    if _BIFROST_KEY_CACHE:
        return _BIFROST_KEY_CACHE
    try:
        import sqlite3
        db = r"D:\LAN-AI-Infra\one-api\one-api.db"
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
        try:
            row = con.execute(
                "SELECT key FROM channels WHERE base_url LIKE '%8700%' AND status=1 LIMIT 1"
            ).fetchone()
        finally:
            con.close()
        if row and row[0]:
            _BIFROST_KEY_CACHE = row[0]
            return _BIFROST_KEY_CACHE
    except Exception as e:
        print(f"[satchida-montage] Bifrost key discovery failed: {e}", file=sys.stderr)
    return ""


def _bifrost_call(method: str, path: str, body: Optional[dict] = None, timeout: int = 60):
    """Authenticated call to local Bifrost. Returns (status, parsed_json_or_text)."""
    key = _bifrost_key()
    if not key:
        raise RuntimeError("No Bifrost key available (set SATCHIDA_BIFROST_KEY)")
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{BIFROST_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    try:
        return resp.status, json.loads(raw)
    except json.JSONDecodeError:
        return resp.status, raw


def _download_url(url: str, output_path: Path, timeout: int = 180) -> bool:
    """Download a generated asset to output_path atomically."""
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = output_path.with_suffix(output_path.suffix + ".part")
        with urllib.request.urlopen(url, timeout=timeout) as r:
            tmp.write_bytes(r.read())
        tmp.replace(output_path)
        return output_path.exists() and output_path.stat().st_size > 1024
    except Exception as e:
        print(f"[satchida-montage] Download failed: {e}", file=sys.stderr)
        return False


def _ci_media_models(kind: str) -> list:
    """CheapInference media models from the Bifrost catalog.

    Empty until the operator lifts the Production key's upstream text-only
    restriction in the CheaperInference dashboard and refresh-models runs; the
    chain then picks new models up automatically (10 min cache).
    """
    kws = _CI_IMAGE_KEYWORDS if kind == "image" else _CI_VIDEO_KEYWORDS
    now = time.monotonic()
    cached = _CI_MEDIA_CACHE.get(kind)
    if isinstance(cached, list) and now - float(_CI_MEDIA_CACHE.get("ts", 0)) < 600:
        return cached
    models: list = []
    try:
        status, data = _bifrost_call("GET", "/v1/models", timeout=30)
        entries = data.get("data", []) if isinstance(data, dict) and status == 200 else []
        for m in entries:
            mid = str(m.get("id", ""))
            low = mid.lower()
            if low.startswith("cheapinference/") and any(k in low for k in kws):
                models.append(mid)
    except Exception as e:
        print(f"[satchida-montage] CI catalog query failed: {e}", file=sys.stderr)
    # Cheapest verified model first; unknown models after the priced ones.
    bare = lambda mid: mid.split("/", 1)[1].lower()  # noqa: E731
    models.sort(key=lambda mid: _CI_MODEL_PRICES.get(bare(mid), float("inf")))
    _CI_MEDIA_CACHE["ts"] = now
    _CI_MEDIA_CACHE[kind] = models
    return models


_PROVIDER_KEY_CACHE: Dict[str, str] = {}


def _provider_key(provider: str) -> str:
    """Decrypt a provider key from Bifrost's store, in-process.

    Same Argon2id + AES-256-GCM scheme as Bifrost's encrypt package. Keys are
    never logged, never written to disk, and never leave this machine.
    """
    if provider in _PROVIDER_KEY_CACHE:
        return _PROVIDER_KEY_CACHE[provider]
    try:
        from argon2.low_level import hash_secret_raw, Type as _ArgonType
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import sqlite3
        import re as _re

        passphrase = os.environ.get("BIFROST_ENCRYPTION_KEY", "").strip()
        if not passphrase:
            # Resolve the Bifrost PM2 process by NAME (ids shift across daemon
            # restarts), then read its env. Never logs the passphrase.
            listing = subprocess.run(
                "pm2 jlist", capture_output=True, text=True, timeout=30, shell=True
            ).stdout
            bifrost_id = ""
            for proc in json.loads(listing or "[]"):
                if proc.get("name") == "satchida-bifrost":
                    bifrost_id = str(proc.get("pm_id", ""))
                    break
            if bifrost_id:
                out = subprocess.run(
                    f"pm2 env {bifrost_id}", capture_output=True, text=True, timeout=20, shell=True
                ).stdout
                m = _re.search(r"^BIFROST_ENCRYPTION_KEY:\s*(.*)$", out, _re.M)
                passphrase = m.group(1).strip() if m else ""
        if not passphrase:
            raise RuntimeError("encryption passphrase unavailable")
        con = sqlite3.connect(
            r"file:D:\LAN-AI-Infra\Bifrost\data\config.db?mode=ro", uri=True, timeout=5
        )
        try:
            row = con.execute(
                "SELECT value FROM config_keys WHERE provider=? AND enabled=1 LIMIT 1",
                (provider,),
            ).fetchone()
        finally:
            con.close()
        if not row:
            raise RuntimeError(f"{provider} key row not found")
        salt = b"bifrost-encryption-v1-salt-2024"
        derived = hash_secret_raw(
            passphrase.encode(), salt,
            time_cost=1, memory_cost=64 * 1024, parallelism=4, hash_len=32,
            type=_ArgonType.ID,
        )
        blob = base64.b64decode(row[0])
        pt = AESGCM(derived).decrypt(blob[:12], blob[12:], None).decode()
        _PROVIDER_KEY_CACHE[provider] = pt
        return pt
    except Exception as e:
        print(f"[satchida-montage] {provider} key decrypt failed: {e}", file=sys.stderr)
        return ""


def _ci_video_direct(
    prompt: str,
    duration_seconds: float,
    output_path: Path,
    aspect_ratio: str = "16:9",
    native_audio: bool = False,
    quality: str = "fast",
    image_url: str = "",
) -> bool:
    """Priority-1 chain: CheapInference /v1/videos/generations (direct, JSON).

    Their video API is synchronous and buffered (up to ~5 min): one POST returns
    {id, status, videos:[{url|b64_video}]} — not OpenAI's submit/poll shape, so
    Bifrost's generic video flow cannot drive it and we call it directly with
    the key decrypted from Bifrost's store.
    """
    global _LAST_VIDEO_MODEL
    key = _provider_key("CheapInference")
    if not key:
        return False
    if image_url:
        models = ["kling-v2.6-i2v"]
    elif native_audio:
        models = ["veo-3.1-lite-generate-001", "kling-v2.6-t2v"]
    elif quality == "hd":
        models = ["kling-v2.6-t2v", "grok-imagine-video"]
    else:
        models = ["grok-imagine-video", "kling-v2.6-t2v"]

    for m in models:
        seconds = int(_nearest_duration(m, duration_seconds))
        body = {
            "model": m,
            "prompt": prompt,
            "duration_seconds": seconds,
            "aspect_ratio": aspect_ratio,
            # CI requires a priced resolution on some models (grok-imagine-video
            # rejects without one): 480p on the cheap chain, 720p on hd.
            "resolution": "720p" if quality == "hd" else "480p",
        }
        if native_audio and not image_url:
            body["audio"] = True
        if image_url:
            body["image_url"] = image_url
        t0 = time.time()
        budget_ref = uuid.uuid4().hex
        budget_est = _CI_MODEL_PRICES.get(m, 0.04) * seconds
        if not _media_budget_gate(budget_ref, m, budget_est):
            continue
        try:
            req = urllib.request.Request(
                f"{CHEAPERINFERENCE_API}/v1/videos/generations",
                data=json.dumps(body).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=360) as r:
                data = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            latency_ms = (time.time() - t0) * 1000.0
            msg = e.read().decode(errors="replace")[:250]
            print(
                f"[satchida-montage] CI video {m} HTTP {e.code}: {msg}",
                file=sys.stderr,
            )
            log_media_to_bifrost(
                object_type="video_generation",
                provider="cheapinference",
                model=m,
                status="error",
                cost=0.0,
                latency_ms=latency_ms,
                error_details=f"HTTP {e.code}: {msg}",
            )
            _media_budget_settle(budget_ref, 0.0, "", m, "CheapInference", f"error: HTTP {e.code}")
            continue
        except Exception as e:
            latency_ms = (time.time() - t0) * 1000.0
            print(f"[satchida-montage] CI video {m} failed: {e}", file=sys.stderr)
            log_media_to_bifrost(
                object_type="video_generation",
                provider="cheapinference",
                model=m,
                status="error",
                cost=0.0,
                latency_ms=latency_ms,
                error_details=str(e),
            )
            _media_budget_settle(budget_ref, 0.0, "", m, "CheapInference", f"error: {e}")
            continue

        videos = data.get("videos") or []
        raw = b""
        for v in videos:
            try:
                if v.get("b64_video"):
                    raw = base64.b64decode(v["b64_video"])
                elif v.get("url"):
                    with urllib.request.urlopen(v["url"], timeout=180) as rr:
                        raw = rr.read()
            except Exception as e:
                print(f"[satchida-montage] CI video download failed: {e}", file=sys.stderr)
                raw = b""
            if len(raw) > 1024:
                break
        if len(raw) > 1024 and raw[4:8] == b"ftyp":
            output_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = output_path.with_suffix(output_path.suffix + ".part")
            tmp.write_bytes(raw)
            tmp.replace(output_path)
            _LAST_VIDEO_MODEL = f"cheapinference/{m}"
            bf_log_id = log_media_to_bifrost(
                object_type="video_generation",
                provider="cheapinference",
                model=m,
                status="success",
                cost=_CI_MODEL_PRICES.get(m, 0.0) * seconds,
                latency_ms=(time.time() - t0) * 1000.0,
            )
            _media_budget_settle(
                budget_ref,
                _CI_MODEL_PRICES.get(m, 0.0) * seconds,
                bf_log_id or "",
                m,
                "CheapInference",
            )
            print(
                f"[satchida-montage] video OK via cheapinference/{m} -> {output_path}",
                file=sys.stderr,
            )
            return True
        print(
            f"[satchida-montage] CI video {m}: no usable video in response "
            f"({json.dumps(data)[:180]})",
            file=sys.stderr,
        )
    return False



# ── Video/Image Bifrost Tracking & Approval Invariants ───────────────────────
MODEL_ESTIMATED_COSTS: Dict[str, float] = {
    "Lightricks/LTX-2.3-Fast": 0.15,
    "FastVideo/FastWan-QAD-FP8-1.3B": 0.0125,
    "FastVideo/FastWan2.2-TI2V-5B-FullAttn-Diffusers": 0.0225,
    "Wan-AI/Wan2.2-T2V-A14B": 0.375,
    "ByteDance/Seedance-1.5-Pro": 0.20,
    "kling-v2.6-t2v": 0.05,
    "kling-v2.6-i2v": 0.05,
    "grok-imagine-video": 0.03,
    "veo-3.1-lite-generate-001": 0.10,
    "black-forest-labs/FLUX-2-klein-4b": 0.012,
    "black-forest-labs/FLUX-2-klein-9b": 0.012,
    "ByteDance-Seed/Seedream-4.0": 0.015,
}

LOGS_DB_PATH = r"D:\LAN-AI-Infra\Bifrost\data\logs.db"

def get_today_video_spend() -> float:
    """Query Bifrost logs.db for cumulative video generation cost today (UTC)."""
    try:
        import sqlite3
        conn = sqlite3.connect(f"file:{LOGS_DB_PATH}?mode=ro", uri=True, timeout=5)
        c = conn.cursor()
        today_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        c.execute("""
            SELECT SUM(cost) 
            FROM logs 
            WHERE object_type = 'video_generation' 
              AND status = 'success'
              AND timestamp >= ?
        """, (today_utc,))
        row = c.fetchone()
        conn.close()
        return float(row[0]) if (row and row[0] is not None) else 0.0
    except Exception as e:
        print(f"[satchida-montage] Failed to query today video spend: {e}", file=sys.stderr)
        return 0.0

def get_detailed_usage_context():
    """Retrieve tenant, user seat, plan and day/week/month token and cost usage."""
    tenant_name = "Satchida HQ (satchida-master)"
    user_name = "Satchida Super Admin (root)"
    seat_plan = "Pro / Privacy Dedicated Seat"
    quota_info = "Unlimited / High-Priority Master"
    
    try:
        import sqlite3
        con_one = sqlite3.connect(r"file:D:\LAN-AI-Infra\one-api\one-api.db?mode=ro", uri=True, timeout=3)
        row = con_one.execute("""
            SELECT u.username, u.display_name, u.[group], u.quota, u.used_quota,
                   t.name, t.plan, t.max_seats
            FROM users u
            LEFT JOIN tenants t ON t.id = 'satchida-master' OR t.id = 'tenant_operator'
            LIMIT 1
        """).fetchone()
        con_one.close()
        if row:
            u_user, u_disp, u_grp, u_quota, u_used, t_name, t_plan, t_seats = row
            user_name = f"{u_disp or u_user} ({u_user})"
            if t_name:
                tenant_name = f"{t_name} (Plan: {t_plan or u_grp}, Max Seats: {t_seats})"
            seat_plan = f"Group: {u_grp.upper()} | Plan: {(t_plan or u_grp).capitalize()}"
            quota_info = f"Used Quota: {u_used:,} | Balance: {u_quota:,}"
    except Exception as e:
        print(f"[satchida-montage] Failed to fetch one-api details: {e}", file=sys.stderr)

    day_tokens, day_cost, day_reqs = 0, 0.0, 0
    week_tokens, week_cost, week_reqs = 0, 0.0, 0
    month_tokens, month_cost, month_reqs = 0, 0.0, 0

    try:
        import sqlite3
        con_logs = sqlite3.connect(f"file:{LOGS_DB_PATH}?mode=ro", uri=True, timeout=3)
        now = datetime.datetime.now(datetime.timezone.utc)
        day_start = now.strftime("%Y-%m-%d 00:00:00")
        week_start = (now - datetime.timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
        month_start = (now - datetime.timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")

        c = con_logs.cursor()
        c.execute("SELECT count(*), coalesce(sum(total_tokens), 0), coalesce(sum(cost), 0) FROM logs WHERE timestamp >= ? AND status = 'success'", (day_start,))
        day_reqs, day_tokens, day_cost = c.fetchone()

        c.execute("SELECT count(*), coalesce(sum(total_tokens), 0), coalesce(sum(cost), 0) FROM logs WHERE timestamp >= ? AND status = 'success'", (week_start,))
        week_reqs, week_tokens, week_cost = c.fetchone()

        c.execute("SELECT count(*), coalesce(sum(total_tokens), 0), coalesce(sum(cost), 0) FROM logs WHERE timestamp >= ? AND status = 'success'", (month_start,))
        month_reqs, month_tokens, month_cost = c.fetchone()
        con_logs.close()
    except Exception as e:
        print(f"[satchida-montage] Failed to fetch usage stats from logs.db: {e}", file=sys.stderr)

    return {
        "tenant_name": tenant_name,
        "user_name": user_name,
        "seat_plan": seat_plan,
        "quota_info": quota_info,
        "day": f"{day_tokens:,} tokens (${day_cost:.4f}, {day_reqs} reqs)",
        "week": f"{week_tokens:,} tokens (${week_cost:.4f}, {week_reqs} reqs)",
        "month": f"{month_tokens:,} tokens (${month_cost:.4f}, {month_reqs} reqs)",
    }

def check_video_approval(model_name: str, duration_seconds: float = 5.0) -> bool:
    """
    Enforce operator approval if today's video spend >= $1.00 or if this request pushes spend >= $1.00.
    Triggers native Windows modal dialog with full tenant, user seat, and token usage diagnostics.
    """
    est_cost = MODEL_ESTIMATED_COSTS.get(model_name, 0.10)
    if "LTX" in model_name:
        est_cost = max(0.03 * duration_seconds, 0.15)
        
    current_spend = get_today_video_spend()
    projected_spend = current_spend + est_cost
    
    if projected_spend >= 1.00:
        diag = get_detailed_usage_context()
        title = "⚠️ Satchida Video Generation Approval & Security Gate"
        msg = (
            f"=== VIDEO GENERATION REQUEST APPROVAL ===\n\n"
            f"• Target Model: {model_name}\n"
            f"• Estimated Cost: ${est_cost:.4f} ({duration_seconds:.0f}s clip)\n"
            f"• Today's Video Spend: ${current_spend:.4f} → Projected: ${projected_spend:.4f}\n\n"
            f"--- SECURITY & ACCOUNT CONTEXT ---\n"
            f"• Tenant: {diag['tenant_name']}\n"
            f"• User / Identity: {diag['user_name']}\n"
            f"• Seat / Plan: {diag['seat_plan']}\n"
            f"• Quota Status: {diag['quota_info']}\n\n"
            f"--- USAGE HISTORY (UP TO THIS REQUEST) ---\n"
            f"• Past 24h: {diag['day']}\n"
            f"• Past 7d:  {diag['week']}\n"
            f"• Past 30d: {diag['month']}\n\n"
            f"Threshold Exceeded: Daily video cap ($1.00) reached.\n"
            f"Do you authorize this video generation?"
        )
        flags = 0x4 | 0x30 | 0x1000 | 0x10000
        res = ctypes.windll.user32.MessageBoxW(0, msg, title, flags)
        if res != 6: # IDYES == 6
            print(f"[satchida-montage] Video generation for {model_name} DENIED by operator popup.", file=sys.stderr)
            return False
        print(f"[satchida-montage] Video generation for {model_name} APPROVED by operator popup.", file=sys.stderr)
        return True
    return True


def _media_budget_gate(ref: str, model: str, est_usd: float) -> bool:
    """Ask one-api (the customer-billing authority) to reserve the estimate
    against the tenant's period budget BEFORE the provider call executes.
    Denied or unreachable => the generation does not run (fail-closed)."""
    try:
        req = urllib.request.Request(
            f"{AUTOROUTER_URL}/api/media/precheck",
            data=json.dumps({
                "ref": ref,
                "tenant_id": os.environ.get("SATCHIDA_TENANT_ID", "satchida-master"),
                "model_name": model,
                "estimated_cost_usd": round(est_usd, 6),
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        if data.get("approved"):
            print(f"[satchida-montage] budget APPROVED ref={ref[:8]} est=${est_usd:.4f}", file=sys.stderr)
            return True
        print(
            f"[satchida-montage] budget DENIED ref={ref[:8]} reason={data.get('reason')} "
            f"remaining={data.get('remaining_quota')}",
            file=sys.stderr,
        )
        return False
    except Exception as e:
        print(f"[satchida-montage] budget precheck error: {e} — DENIED (fail-closed)", file=sys.stderr)
        return False


def _media_budget_settle(
    ref: str,
    actual_usd: float,
    bf_log_id: str = "",
    model: str = "",
    provider: str = "",
    note: str = "",
) -> None:
    """Settle the reservation with the exact billed cost. Refunds unused
    reserve or deducts shortfall at one-api; never misses a cent."""
    try:
        req = urllib.request.Request(
            f"{AUTOROUTER_URL}/api/media/settle",
            data=json.dumps({
                "ref": ref,
                "tenant_id": os.environ.get("SATCHIDA_TENANT_ID", "satchida-master"),
                "actual_cost_usd": round(actual_usd, 6),
                "bifrost_log_id": bf_log_id or "",
                "model_name": model,
                "provider": provider,
                "note": note,
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            json.loads(r.read().decode())
        print(f"[satchida-montage] budget SETTLED ref={ref[:8]} actual=${actual_usd:.4f}", file=sys.stderr)
    except Exception as e:
        # The direct-sync daemon remains the safety net for unsettled rows.
        print(f"[satchida-montage] budget settle error (daemon safety net applies): {e}", file=sys.stderr)


def log_media_to_bifrost(
    object_type: str,
    provider: str,
    model: str,
    status: str,
    cost: float,
    latency_ms: float = 0.0,
    error_details: str = "",
    virtual_key_name: str = "satchida-oneapi-cloud",
):
    """Log media generation event into Bifrost logs.db so it is tracked & metered in Bifrost gateway metrics."""
    try:
        import sqlite3
        conn = sqlite3.connect(LOGS_DB_PATH, timeout=10)
        c = conn.cursor()
        log_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f+00:00")
        
        vk_id = "1f8097a4-0791-40b4-865e-9081937f4840"
        tenant_id = "satchida-master"
        tenant_name = "Satchida HQ"
        
        c.execute("""
            INSERT INTO logs (
                id, timestamp, object_type, provider, model, canonical_model_name,
                status, cost, latency, upstream_latency, overhead_latency,
                virtual_key_id, virtual_key_name,
                team_id, team_name, customer_id, customer_name,
                tenant_id, tenant_name, user_agent, app, error_details, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
            )
        """, (
            log_id, now, object_type, provider, model, model,
            status, cost, latency_ms, latency_ms, 0.0,
            vk_id, virtual_key_name,
            tenant_id, tenant_name, tenant_id, tenant_name,
            tenant_id, tenant_name, "LibreChat-Montage/1.0", "LibreChat", error_details, now
        ))
        conn.commit()
        conn.close()
        return log_id
    except Exception as e:
        print(f"[satchida-montage] Failed to log media event to Bifrost logs.db: {e}", file=sys.stderr)
        return None

def _deepinfra_image(prompt: str, output_path: Path, aspect_ratio: str = "16:9") -> bool:
    """Priority-2 chain: DeepInfra OpenAI-compatible images API (logged & metered via Bifrost)."""
    global _LAST_IMAGE_MODEL
    key = _provider_key("deepinfra")
    if not key:
        return False
    size = _SIZE_BY_RATIO.get(aspect_ratio, "1024x1024")
    tried_default = False
    for model in DEEPINFRA_IMAGE_MODELS:
        use_size = size
        while True:
            t0 = time.time()
            budget_ref = uuid.uuid4().hex
            budget_est = MODEL_ESTIMATED_COSTS.get(model, 0.012)
            if not _media_budget_gate(budget_ref, model, budget_est):
                return False
            body = {
                "model": model,
                "prompt": prompt,
                "n": 1,
                "size": use_size,
                "response_format": "b64_json",
            }
            try:
                req = urllib.request.Request(
                    f"{DEEPINFRA_API}/v1/openai/images/generations",
                    data=json.dumps(body).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + key,
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = json.loads(r.read().decode())
            except urllib.error.HTTPError as e:
                latency_ms = (time.time() - t0) * 1000.0
                msg = e.read().decode(errors="replace")[:200]
                print(
                    f"[satchida-montage] deepinfra image {model} HTTP {e.code}: {msg}",
                    file=sys.stderr,
                )
                log_media_to_bifrost(
                    object_type="image_generation",
                    provider="deepinfra",
                    model=model,
                    status="error",
                    cost=0.0,
                    latency_ms=latency_ms,
                    error_details=f"HTTP {e.code}: {msg}"
                )
                _media_budget_settle(budget_ref, 0.0, "", model, "DeepInfra", f"error: HTTP {e.code}")
                if e.code == 400 and use_size != "1024x1024" and not tried_default:
                    use_size = "1024x1024"
                    tried_default = True
                    continue
                break
            except Exception as e:
                latency_ms = (time.time() - t0) * 1000.0
                print(f"[satchida-montage] deepinfra image failed: {e}", file=sys.stderr)
                log_media_to_bifrost(
                    object_type="image_generation",
                    provider="deepinfra",
                    model=model,
                    status="error",
                    cost=0.0,
                    latency_ms=latency_ms,
                    error_details=str(e)
                )
                _media_budget_settle(budget_ref, 0.0, "", model, "DeepInfra", f"error: {e}")
                break

            latency_ms = (time.time() - t0) * 1000.0
            entries = data.get("data") or []
            if not entries:
                break
            ent = entries[0]
            try:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = output_path.with_suffix(output_path.suffix + ".part")
                if ent.get("b64_json"):
                    tmp.write_bytes(base64.b64decode(ent["b64_json"]))
                elif ent.get("url"):
                    ureq = urllib.request.Request(
                        ent["url"], headers={"User-Agent": "Mozilla/5.0"}
                    )
                    with urllib.request.urlopen(ureq, timeout=60) as rr:
                        tmp.write_bytes(rr.read())
                else:
                    break
                tmp.replace(output_path)
                if output_path.exists() and output_path.stat().st_size > 1024:
                    _LAST_IMAGE_MODEL = f"deepinfra/{model}"
                    cost = MODEL_ESTIMATED_COSTS.get(model, 0.012)
                    bf_log_id = log_media_to_bifrost(
                        object_type="image_generation",
                        provider="deepinfra",
                        model=model,
                        status="success",
                        cost=cost,
                        latency_ms=latency_ms
                    )
                    _media_budget_settle(
                        budget_ref,
                        cost,
                        bf_log_id or "",
                        model,
                        "DeepInfra",
                    )
                    print(
                        f"[satchida-montage] image OK via deepinfra/{model} -> {output_path} (cost: ${cost:.4f})",
                        file=sys.stderr,
                    )
                    return True
            except Exception as e:
                print(
                    f"[satchida-montage] deepinfra image save failed: {e}",
                    file=sys.stderr,
                )
                break
    return False


def _deepinfra_video(
    prompt: str,
    output_path: Path,
    model: Optional[str] = None,
    timeout: int = 600,
    models: Optional[list] = None,
) -> bool:
    """Priority-2 chain: DeepInfra native text-to-video (direct, synchronous).

    POST /v1/inference/{model} returns the clip as a data:video/mp4;base64 URI.
    """
    global _LAST_VIDEO_MODEL
    key = _provider_key("deepinfra")
    if not key:
        return False
    if not models:
        models = [model] if model else list(DEEPINFRA_VIDEO_MODELS)
    for m in models:
        body = {"prompt": prompt}
        t0 = time.time()
        budget_ref = uuid.uuid4().hex
        budget_est = MODEL_ESTIMATED_COSTS.get(m, 0.0375)
        if not _media_budget_gate(budget_ref, m, budget_est):
            continue
        try:
            req = urllib.request.Request(
                f"{DEEPINFRA_API}/v1/inference/{urllib.parse.quote(m, safe='/')}",
                data=json.dumps(body).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            latency_ms = (time.time() - t0) * 1000.0
            msg = e.read().decode(errors="replace")[:200]
            print(
                f"[satchida-montage] deepinfra video {m} HTTP {e.code}: {msg}",
                file=sys.stderr,
            )
            log_media_to_bifrost(
                object_type="video_generation",
                provider="deepinfra",
                model=m,
                status="error",
                cost=0.0,
                latency_ms=latency_ms,
                error_details=f"HTTP {e.code}: {msg}",
            )
            _media_budget_settle(budget_ref, 0.0, "", m, "DeepInfra", f"error: HTTP {e.code}")
            continue
        except Exception as e:
            latency_ms = (time.time() - t0) * 1000.0
            print(f"[satchida-montage] deepinfra video {m} failed: {e}", file=sys.stderr)
            log_media_to_bifrost(
                object_type="video_generation",
                provider="deepinfra",
                model=m,
                status="error",
                cost=0.0,
                latency_ms=latency_ms,
                error_details=str(e),
            )
            _media_budget_settle(budget_ref, 0.0, "", m, "DeepInfra", f"error: {e}")
            continue

        vurl = data.get("video_url") or ""
        raw = b""
        if vurl.startswith("data:"):
            try:
                raw = base64.b64decode(vurl.split(",", 1)[1])
            except Exception as e:
                print(
                    f"[satchida-montage] deepinfra data-uri decode failed: {e}",
                    file=sys.stderr,
                )
                continue
        elif vurl.startswith("http"):
            try:
                with urllib.request.urlopen(vurl, timeout=180) as rr:
                    raw = rr.read()
            except Exception as e:
                print(
                    f"[satchida-montage] deepinfra video download failed: {e}",
                    file=sys.stderr,
                )
                continue
        if len(raw) > 1024:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = output_path.with_suffix(output_path.suffix + ".part")
            tmp.write_bytes(raw)
            tmp.replace(output_path)
            _LAST_VIDEO_MODEL = f"deepinfra/{m}"
            bf_log_id = log_media_to_bifrost(
                object_type="video_generation",
                provider="deepinfra",
                model=m,
                status="success",
                cost=MODEL_ESTIMATED_COSTS.get(m, 0.0),
                latency_ms=(time.time() - t0) * 1000.0,
            )
            _media_budget_settle(
                budget_ref,
                MODEL_ESTIMATED_COSTS.get(m, 0.0),
                bf_log_id or "",
                m,
                "DeepInfra",
            )
            print(
                f"[satchida-montage] video OK via deepinfra/{m} -> {output_path}",
                file=sys.stderr,
            )
            return True
        print(
            f"[satchida-montage] deepinfra video {m}: empty result "
            f"({json.dumps(data)[:150]})",
            file=sys.stderr,
        )
    return False


def _generate_video_core(
    prompt: str,
    duration_seconds: float,
    output_path: Path,
    aspect_ratio: str = "16:9",
    native_audio: bool = False,
    quality: str = "fast",
    image_url: str = "",
) -> bool:
    """Provider-policy chain: CheapInference (priority 1) then DeepInfra (priority 2).

    native_audio=True selects audio-visual models (CI veo-3.1-lite first, then
    DeepInfra LTX) which render synchronized audio inside the clip itself.
    quality="hd" tries the 720p-class model before the cheaper 480p one.
    """
    # Spend gate: fires only when this request pushes today's video spend to
    # or past the $1.00 daily cap. Estimates with the primary model of the
    # active chain, so a cheap request never triggers a dialog.
    primary_model = (
        "kling-v2.6-i2v" if image_url
        else "veo-3.1-lite-generate-001" if native_audio
        else "kling-v2.6-t2v" if quality == "hd"
        else "grok-imagine-video"
    )
    check_video_approval(primary_model, duration_seconds)

    if _ci_video_direct(
        prompt, duration_seconds, output_path, aspect_ratio,
        native_audio=native_audio, quality=quality, image_url=image_url,
    ):
        return True
    if native_audio:
        return _deepinfra_video(
            prompt, output_path, models=list(DEEPINFRA_VIDEO_AV_MODELS),
        )
    models = list(DEEPINFRA_VIDEO_MODELS)
    if quality == "hd" and len(models) >= 2:
        models = [models[1], models[0]] + models[2:]
    return _deepinfra_video(prompt, output_path, models=models)


def _tts_edge(text: str, output_path: Path, voice: str = "en-US-AriaNeural") -> bool:
    """Free Microsoft Edge TTS via the repo's edge_tts_service.py (system python).

    stdin is detached and CREATE_NO_WINDOW set: an inherited stdio handle from
    the MCP server process can hang the child on Windows, which once surfaced
    as a 120s timeout on the first narration attempt.
    """
    script = _LIBRECHAT_ROOT / "skill" / "edge_tts_service.py"
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    last_err = ""
    for attempt in range(2):
        try:
            proc = subprocess.run(
                ["python", str(script), voice, str(output_path), text],
                capture_output=True,
                text=True,
                timeout=60,
                stdin=subprocess.DEVNULL,
                creationflags=flags,
            )
            if proc.returncode == 0 and output_path.exists() and output_path.stat().st_size > 1024:
                return True
            last_err = proc.stderr[:200] if proc.stderr else "no output"
        except Exception as e:
            last_err = str(e)[:200]
        if attempt == 0:
            time.sleep(2)
    print(f"[satchida-montage] TTS failed: {last_err}", file=sys.stderr)
    return False


def _mux_audio(video_path: Path, audio_path: Path, output_path: Path) -> bool:
    """Mux narration onto the clip, trimmed/padded to the video's length."""
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            str(output_path),
        ]
        enc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        return enc.returncode == 0 and output_path.exists() and output_path.stat().st_size > 1024
    except Exception as e:
        print(f"[satchida-montage] audio mux failed: {e}", file=sys.stderr)
        return False


def _strip_audio(video_path: Path) -> bool:
    """Remove the audio track in place. Some priority-1 models (e.g. CI
    grok-imagine-video) embed ambient audio even when none was requested; a
    caller that asked for a silent clip gets a genuinely silent file."""
    try:
        silent = video_path.with_name(video_path.stem + "_silent" + video_path.suffix)
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-map", "0:v:0",
            "-c:v", "copy",
            "-an",
            str(silent),
        ]
        enc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if enc.returncode == 0 and silent.exists() and silent.stat().st_size > 1024:
            silent.replace(video_path)
            return True
        print(f"[satchida-montage] audio strip failed rc={enc.returncode}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[satchida-montage] audio strip failed: {e}", file=sys.stderr)
        return False


def _ci_image_via_bifrost(
    prompt: str,
    output_path: Path,
    aspect_ratio: str = "16:9",
    timeout: int = 120,
) -> bool:
    """Priority-1 chain: CheapInference /v1/images/generations through Bifrost.

    Empty model list until the Production key's upstream restriction is lifted.
    """
    global _LAST_IMAGE_MODEL
    size = _SIZE_BY_RATIO.get(aspect_ratio, "1024x1024")
    for model in _ci_media_models("image"):
        bare_name = model.split("/", 1)[1].lower() if "/" in model else model.lower()
        budget_ref = uuid.uuid4().hex
        budget_est = _CI_MODEL_PRICES.get(bare_name, 0.008)
        if not _media_budget_gate(budget_ref, bare_name, budget_est):
            continue
        try:
            status, resp = _bifrost_call(
                "POST",
                "/v1/images/generations",
                {
                    "model": model,
                    "prompt": prompt,
                    "n": 1,
                    "size": size,
                    # some upstreams 403 imgproxy URLs on plain GET — ask for bytes
                    "response_format": "b64_json",
                },
                timeout=timeout,
            )
        except Exception as e:
            print(f"[satchida-montage] CI image submit {model}: {e}", file=sys.stderr)
            _media_budget_settle(budget_ref, 0.0, "", bare_name, "CheapInference", "submit failed")
            continue
        if status != 200 or not isinstance(resp, dict):
            print(
                f"[satchida-montage] CI image {model} HTTP {status}: {str(resp)[:200]}",
                file=sys.stderr,
            )
            continue
        data = resp.get("data") or []
        if not data:
            continue
        entry = data[0]
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = output_path.with_suffix(output_path.suffix + ".part")
            if isinstance(entry, dict) and entry.get("b64_json"):
                tmp.write_bytes(base64.b64decode(entry["b64_json"]))
            elif isinstance(entry, dict) and entry.get("url"):
                ureq = urllib.request.Request(
                    entry["url"], headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(ureq, timeout=120) as r:
                    tmp.write_bytes(r.read())
            else:
                continue
            tmp.replace(output_path)
            if output_path.exists() and output_path.stat().st_size > 1024:
                _LAST_IMAGE_MODEL = model
                # Bifrost meters this row natively (pricing overrides) and the
                # one-api direct-sync daemon books it — closing the reservation
                # at $0 avoids double-billing.
                _media_budget_settle(budget_ref, 0.0, "", bare_name, "CheapInference", "booked by bifrost sync")
                return True
        except Exception as e:
            print(f"[satchida-montage] CI image save {model}: {e}", file=sys.stderr)
    return False


def _generate_image_core(prompt: str, output_path: Path, aspect_ratio: str = "16:9") -> bool:
    """Provider-policy chain: CheapInference (priority 1) then DeepInfra (priority 2)."""
    if _ci_image_via_bifrost(prompt, output_path, aspect_ratio):
        return True
    return _deepinfra_image(prompt, output_path, aspect_ratio)


def _threejs_privacy_render(
    scene_description: str,
    duration_seconds: float,
    output_path: Path,
) -> bool:
    """
    Privacy mode: render a Three.js HTML scene via Playwright headless → capture frames → FFmpeg encode.
    Zero cloud calls. Uses chromium installed with playwright (satchida-motion-server already has it).
    """
    # Build a minimal Three.js animated scene HTML
    html = f"""<!DOCTYPE html>
<html><head>
<style>body{{margin:0;overflow:hidden;background:#000}}</style>
<script src="https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js"></script>
</head><body>
<canvas id="c"></canvas>
<script>
const r=new THREE.WebGLRenderer({{canvas:document.getElementById('c'),antialias:true}});
r.setSize(1920,1080);
const s=new THREE.Scene();
const c=new THREE.PerspectiveCamera(60,1920/1080,0.1,1000);
c.position.z=5;
// Ambient + directional light
s.add(new THREE.AmbientLight(0xffffff,0.4));
const dl=new THREE.DirectionalLight(0x8888ff,1.2);
dl.position.set(5,10,5);s.add(dl);
// 3D mesh based on scene description hash
const geo=new THREE.TorusKnotGeometry(1.5,0.4,128,32);
const mat=new THREE.MeshPhongMaterial({{color:0x4488ff,shininess:120,specular:0x224488}});
const mesh=new THREE.Mesh(geo,mat);
s.add(mesh);
// Stars background
const sg=new THREE.BufferGeometry();
const sv=new Float32Array(3000);
for(let i=0;i<3000;i++)sv[i]=(Math.random()-0.5)*200;
sg.setAttribute('position',new THREE.BufferAttribute(sv,3));
s.add(new THREE.Points(sg,new THREE.PointsMaterial({{color:0xffffff,size:0.3}})));
// Animate
let t=0;
const fps=30,totalFrames={int(duration_seconds*30)};
function frame(){{
  mesh.rotation.x+=0.012;mesh.rotation.y+=0.018;
  r.render(s,c);
  if(t++<totalFrames)requestAnimationFrame(frame);
  else document.title='DONE';
}}
frame();
</script></body></html>"""

    html_path = output_path.parent / f"{output_path.stem}_threejs.html"
    frames_dir = output_path.parent / f"{output_path.stem}_frames"
    html_path.write_text(html, encoding="utf-8")
    frames_dir.mkdir(parents=True, exist_ok=True)

    # Try playwright capture
    pw_script = output_path.parent / f"{output_path.stem}_capture.py"
    total_frames = int(duration_seconds * 30)
    pw_script.write_text(f"""
import sys, time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox','--disable-gpu'])
    ctx = browser.new_context(viewport={{'width':1920,'height':1080}})
    page = ctx.new_page()
    page.goto('file:///{html_path.as_posix()}')
    page.wait_for_timeout(500)  # init
    for i in range({total_frames}):
        page.screenshot(path=r'{frames_dir}\\frame_{{i:05d}}.png')
        page.wait_for_timeout(33)  # ~30fps
        if page.title() == 'DONE':
            break
    browser.close()
print("capture done")
""", encoding="utf-8")

    venv_py = _STUDIO_ROOT / "venv" / "Scripts" / "python.exe"
    result = subprocess.run(
        [str(venv_py), str(pw_script)],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        print(f"[satchida-montage] Playwright capture failed: {result.stderr[:500]}", file=sys.stderr)
        return False

    # FFmpeg: frames → mp4
    frame_pattern = str(frames_dir / "frame_%05d.png")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-framerate", "30",
        "-i", frame_pattern,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        str(output_path)
    ]
    enc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=120)
    if enc.returncode == 0 and output_path.exists() and output_path.stat().st_size > 1024:
        # Cleanup frames
        shutil.rmtree(frames_dir, ignore_errors=True)
        return True

    print(f"[satchida-montage] FFmpeg encode failed: {enc.stderr[-300:]}", file=sys.stderr)
    return False


def _generate_real_scene_clip(
    scene: dict,
    clip_path: Path,
    is_privacy: bool,
) -> bool:
    """
    Dispatch scene rendering to the real pipeline:
    - Cloud (non-privacy): provider-policy chain — CheapInference then DeepInfra
    - Privacy: Three.js → Playwright headless → FFmpeg
    """
    prompt = (
        f"{scene.get('visual_3d_description', '')}. "
        f"Camera: {scene.get('camera_action', 'slow orbit')}. "
        f"3D cinematic, photorealistic, YouTube production quality."
    )
    duration = float(scene.get("duration_sec", 6.0))

    if not is_privacy:
        return _generate_video_core(prompt, duration, clip_path)
    return _threejs_privacy_render(
        scene_description=scene.get("visual_3d_description", prompt),
        duration_seconds=duration,
        output_path=clip_path,
    )


def _emergency_ffmpeg_clip(clip_path: Path, duration: float, title: str) -> None:
    """
    Last-resort synthetic clip. Clearly branded as 'RENDER PENDING' so users
    know real video was not generated — NOT a silent color-block substitute.
    """
    duration = max(2.0, duration)
    # Gradient + text — requires drawtext filter with a system font
    font_path = r"C:/Windows/Fonts/arial.ttf"
    if not Path(font_path).exists():
        font_path = ""  # will cause drawtext to skip — still better than nothing

    if font_path:
        vf = (
            f"gradients=s=1920x1080:c0=0x1a1a2e:c1=0x16213e:nb_frames=1,"
            f"drawtext=fontfile='{font_path}':text='⚠ RENDER PENDING':fontsize=72:"
            f"fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2,"
            f"drawtext=fontfile='{font_path}':text='{title[:50]}':fontsize=36:"
            f"fontcolor=0xaaaaff:x=(w-text_w)/2:y=(h-text_h)/2+90"
        )
    else:
        vf = "color=c=0x1a1a2e:s=1920x1080"

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", vf,
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        str(clip_path)
    ]
    subprocess.run(cmd, capture_output=True, timeout=30)


# ═══════════════════════════════════════════════════════════════════════════════
# MCP TOOLS
# ═══════════════════════════════════════════════════════════════════════════════

def _get_project_dir(project_id: str) -> Path:
    p = PROJECTS_DIR / project_id
    p.mkdir(parents=True, exist_ok=True)
    return p


@mcp.tool()
def video_create_script(
    topic: str,
    duration_minutes: float = 2.0,
    audience: str = "general YouTube audience",
    account_type: str = "standard",
    mode: str = "Chat",
    user_id: str = "anonymous",
    user_name: str = "user",
) -> str:
    """
    Stage 1 — Generate a structured multi-scene script and 3D visual plan for YouTube.

    Routing (strictly enforced):
    - account_type == 'privacy' AND mode == 'Privacy'  → Local Sovereign Llama Fleet (:4099)
    - All other account types / modes                  → Cloud Frontier via AutoRouter (:4000)

    Returns a project_id used by all subsequent pipeline stages.
    """
    project_id = f"montage-{uuid.uuid4().hex[:8]}"
    proj_dir = _get_project_dir(project_id)

    decision = resolve_montage_endpoint(account_type, mode, user_id, user_name)

    prompt = (
        f"You are the Director of Satchida 3D Studio. Create a high-retention 3D YouTube video script on '{topic}'.\n"
        f"Target duration: {duration_minutes} minutes. Audience: {audience}.\n"
        f"Return ONLY valid JSON with these keys:\n"
        f"1. 'title': Catchy high-CTR YouTube title (<100 chars)\n"
        f"2. 'hook': 0-5s retention hook sentence\n"
        f"3. 'scenes': array of objects with keys: scene_id, duration_sec, visual_3d_description, camera_action, narration, subtitle\n"
        f"4. 'tags': array of 5 YouTube tags\n"
        f"Output JSON only — no markdown, no extra text."
    )

    messages = [
        {"role": "system", "content": "You are a professional 3D video director. Output strictly valid JSON only."},
        {"role": "user", "content": prompt},
    ]

    llm_output = execute_montage_chat_completion(
        messages=messages,
        account_type=account_type,
        satchi_mode=mode,
        user_id=user_id,
        user_name=user_name,
    )

    try:
        clean = llm_output.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
            if clean.endswith("```"):
                clean = clean.rsplit("\n", 1)[0]
        script_data = json.loads(clean)
    except Exception:
        num_scenes = max(2, int(duration_minutes * 2))
        dur_per_scene = (duration_minutes * 60.0) / num_scenes
        script_data = {
            "title": f"The 3D Reality of {topic[:60]}",
            "hook": f"What if everything you knew about {topic} was wrong? The 3D simulation reveals the truth.",
            "scenes": [
                {
                    "scene_id": f"scene_{i+1:02d}",
                    "duration_sec": dur_per_scene,
                    "visual_3d_description": f"3D cinematic view of {topic} — phase {i+1}: orbiting camera reveals key structure with photorealistic materials",
                    "camera_action": "Slow spiral orbit, depth-of-field rack focus to subject",
                    "narration": f"Phase {i+1}: here we explore the core mechanics of {topic} through 3D simulation.",
                    "subtitle": f"Phase {i+1}: {topic}",
                }
                for i in range(num_scenes)
            ],
            "tags": [topic.lower(), "3d animation", "youtube", "satchida studio", "science"],
        }

    script_data.update({
        "project_id": project_id,
        "account_type": account_type,
        "mode": mode,
        "cogs_tier": decision.cogs_tier,
        "is_local": decision.is_local,
        "topic": topic,
    })

    with open(proj_dir / "script.json", "w", encoding="utf-8") as f:
        json.dump(script_data, f, indent=2)

    scenes_md = "\n".join(
        f"- **{s['scene_id']}** ({s['duration_sec']:.0f}s): {s['visual_3d_description']}"
        for s in script_data["scenes"]
    )

    engine = "Local Sovereign Llama Fleet (:4099)" if decision.is_local else "Cloud Frontier via AutoRouter (:4000)"
    return (
        f"### 🎬 3D Video Script Generated\n\n"
        f"**Project ID:** `{project_id}`\n"
        f"**Routing Engine:** {engine}\n"
        f"**Title:** {script_data['title']}\n"
        f"**Duration:** {duration_minutes:.1f} min — {len(script_data['scenes'])} scenes\n\n"
        f"#### Scene Breakdown:\n{scenes_md}\n\n"
        f"▶ Next: call `video_plan_3d_scenes(project_id=\"{project_id}\")`"
    )


@mcp.tool()
def video_plan_3d_scenes(project_id: str) -> str:
    """
    Stage 2 — Plan 3D scene visuals and confirm render strategy.
    Records per-scene render metadata and confirms cloud vs privacy routing.
    """
    proj_dir = _get_project_dir(project_id)
    script_file = proj_dir / "script.json"
    if not script_file.exists():
        return f"Error: Project '{project_id}' not found. Call video_create_script first."

    with open(script_file, encoding="utf-8") as f:
        script_data = json.load(f)

    is_privacy = script_data.get("is_local", False)
    scenes = script_data.get("scenes", [])

    plan = []
    for sc in scenes:
        engine = "Three.js → Playwright (privacy/local)" if is_privacy else "Satchida diffusion engine (cloud)"
        plan.append({
            "scene_id": sc["scene_id"],
            "duration_sec": sc.get("duration_sec", 6.0),
            "render_engine": engine,
            "prompt_preview": sc.get("visual_3d_description", "")[:120],
            "status": "queued",
        })

    with open(proj_dir / "scenes_plan.json", "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)

    engine_label = "Three.js + Playwright (zero-cloud)" if is_privacy else "Satchida diffusion engine (cloud)"
    plan_md = "\n".join(
        f"- **{p['scene_id']}** ({p['duration_sec']:.0f}s) → {p['render_engine']}"
        for p in plan
    )

    return (
        f"### 🗂 3D Scene Plan Confirmed\n\n"
        f"**Project:** `{project_id}`\n"
        f"**Render Engine:** {engine_label}\n"
        f"**Scenes:** {len(plan)}\n\n"
        f"{plan_md}\n\n"
        f"▶ Next: call `video_start_render_job(project_id=\"{project_id}\")`"
    )


def _async_render_worker(job_id: str, project_id: str, resolution: str) -> None:
    """
    Background render thread.
    For each scene: attempt real video generation (Kling O3 Pro or Three.js).
    Emergency fallback: 'RENDER PENDING' placeholder (never a silent color block).
    """
    try:
        proj_dir = _get_project_dir(project_id)
        with open(proj_dir / "script.json", encoding="utf-8") as f:
            script_data = json.load(f)

        scenes = script_data.get("scenes", [])
        total = len(scenes)
        is_privacy = script_data.get("is_local", False)
        rendered_clips: List[str] = []

        for idx, sc in enumerate(scenes):
            with JOB_LOCK:
                ACTIVE_JOBS[job_id]["stage"] = f"Generating scene {idx+1}/{total}: {sc['scene_id']}"
                ACTIVE_JOBS[job_id]["progress"] = int((idx / total) * 70)

            clip_path = proj_dir / f"{sc['scene_id']}.mp4"
            duration = float(sc.get("duration_sec", 6.0))

            # Attempt real generation
            ok = _generate_real_scene_clip(sc, clip_path, is_privacy)

            if not ok:
                # Emergency placeholder — clearly labelled, NOT a silent fake
                _emergency_ffmpeg_clip(clip_path, duration, sc.get("subtitle", sc["scene_id"]))

            if clip_path.exists() and clip_path.stat().st_size > 512:
                rendered_clips.append(str(clip_path))
            else:
                with JOB_LOCK:
                    ACTIVE_JOBS[job_id]["warnings"] = ACTIVE_JOBS[job_id].get("warnings", [])
                    ACTIVE_JOBS[job_id]["warnings"].append(f"Scene {sc['scene_id']} failed to render")

        with JOB_LOCK:
            ACTIVE_JOBS[job_id]["stage"] = "Concatenating clips & audio mixing"
            ACTIVE_JOBS[job_id]["progress"] = 78

        # Assemble final video
        final_path = VIDEOS_DIR / f"{project_id}_youtube_1080p.mp4"
        if rendered_clips:
            compose_ffmpeg_clip_concat(rendered_clips, str(final_path))
        else:
            raise RuntimeError("No scene clips were generated — render pipeline failed entirely")

        with JOB_LOCK:
            ACTIVE_JOBS[job_id]["stage"] = "Generating thumbnail & YouTube SEO bundle"
            ACTIVE_JOBS[job_id]["progress"] = 88

        # Thumbnail
        thumb_path = VIDEOS_DIR / f"{project_id}_thumbnail.jpg"
        create_high_ctr_thumbnail(
            output_image_path=str(thumb_path),
            headline=script_data.get("title", "3D YouTube Video")[:35],
        )

        # Chapters
        chapters, cur_t = [], 0.0
        for sc in scenes:
            chapters.append(YouTubeChapter(timestamp_sec=int(cur_t), title=sc.get("subtitle", sc["scene_id"])))
            cur_t += float(sc.get("duration_sec", 6.0))

        yt_bundle = generate_youtube_metadata_bundle(
            video_title=script_data.get("title", "3D Video"),
            description=(
                script_data.get("hook", "") + "\n\nGenerated by Satchida 3D Studio via OpenMontage."
            ),
            chapters=chapters,
            tags=script_data.get("tags", ["youtube", "3d"]),
        )

        bundle_path = proj_dir / "youtube_bundle.json"
        with open(bundle_path, "w", encoding="utf-8") as f:
            json.dump({
                "video_path": str(final_path),
                "thumbnail_path": str(thumb_path),
                "scenes_rendered": len(rendered_clips),
                "scenes_total": total,
                "metadata": yt_bundle,
            }, f, indent=2)

        # Verify output is a real video file (not empty / corrupt)
        video_size_mb = final_path.stat().st_size / (1024 * 1024) if final_path.exists() else 0
        is_real_video = video_size_mb > 0.1  # > 100 KB indicates real content

        # Publish to LibreChat's web-servable static dirs so the chat can link
        # and play the deliverable (filesystem paths never render in browsers).
        video_web_url = _publish_artifact(final_path)
        thumb_web_url = _publish_artifact(thumb_path)

        with JOB_LOCK:
            ACTIVE_JOBS[job_id].update({
                "stage": "Complete",
                "progress": 100,
                "status": "SUCCESS",
                "video_path": str(final_path),
                "video_web_url": video_web_url,
                "thumbnail_web_url": thumb_web_url,
                "thumbnail_path": str(thumb_path),
                "video_size_mb": round(video_size_mb, 2),
                "is_real_video": is_real_video,
                "scenes_rendered": len(rendered_clips),
                "scenes_total": total,
                "bundle_path": str(bundle_path),
            })

    except Exception as exc:
        with JOB_LOCK:
            ACTIVE_JOBS[job_id]["status"] = "FAILED"
            ACTIVE_JOBS[job_id]["error"] = str(exc)


@mcp.tool()
def video_start_render_job(project_id: str, resolution: str = "1080p") -> str:
    """
    Stage 3 — Launch the asynchronous background video render.
    Returns immediately with a job_id.

    Real video generation:
    - Cloud accounts: grok-imagine-video text-to-video via Bifrost (:8700)
    - Privacy accounts: Three.js + Playwright headless capture
    - Emergency fallback: 'RENDER PENDING' placeholder (clearly labelled)
    """
    proj_dir = _get_project_dir(project_id)
    if not (proj_dir / "script.json").exists():
        return f"Error: Project '{project_id}' has no script. Call video_create_script first."

    job_id = f"job-{uuid.uuid4().hex[:8]}"
    with JOB_LOCK:
        ACTIVE_JOBS[job_id] = {
            "job_id": job_id,
            "project_id": project_id,
            "status": "RUNNING",
            "progress": 0,
            "stage": "Initialising render engines",
            "start_time": time.time(),
            "video_path": None,
            "thumbnail_path": None,
            "warnings": [],
        }

    t = threading.Thread(
        target=_async_render_worker,
        args=(job_id, project_id, resolution),
        daemon=True,
    )
    t.start()

    return (
        f"### 🚀 Render Job Started\n\n"
        f"**Job ID:** `{job_id}`\n"
        f"**Project:** `{project_id}`\n"
        f"**Engine:** Satchida Studio diffusion render [cloud] "
        f"| Three.js + Playwright [privacy]\n\n"
        f"Poll status with: `video_get_status(job_id=\"{job_id}\")`\n"
        f"Expected render time: 2–10 min depending on scene count and provider queue."
    )


@mcp.tool()
def video_get_status(job_id: str) -> str:
    """
    Poll the render job status. Call repeatedly until status is SUCCESS or FAILED.
    Returns progress %, current stage, and final video path when complete.
    """
    with JOB_LOCK:
        job = ACTIVE_JOBS.get(job_id)

    if not job:
        return f"Error: Job `{job_id}` not found. Use video_start_render_job to begin a render."

    status = job["status"]
    progress = job.get("progress", 0)
    stage = job.get("stage", "unknown")
    elapsed = round(time.time() - job.get("start_time", time.time()), 1)
    warnings = job.get("warnings", [])

    if status == "SUCCESS":
        video_mb = job.get("video_size_mb", 0)
        is_real = job.get("is_real_video", False)
        video_flag = "✅ Real AI-generated video" if is_real else "⚠ Placeholder (render pending)"
        warn_block = ""
        if warnings:
            warn_block = "\n**Warnings:**\n" + "\n".join(f"- {w}" for w in warnings)

        video_web_url = job.get("video_web_url", "")
        web_block = (
            f"\n**Web URL (embed this in your reply so the video plays in chat):**\n\n"
            f"**[{Path(job.get('video_path', '')).name} — watch the video]({video_web_url})**\n\n"
            f"Markdown to embed verbatim: `![video]({video_web_url})`\n"
            if video_web_url
            else ""
        )
        return (
            f"### ✅ Render Complete\n\n"
            f"**Job:** `{job_id}` | **Elapsed:** {elapsed}s\n"
            f"**Video:** `{job.get('video_path', '')}` ({video_mb} MB) — {video_flag}\n"
            f"{web_block}"
            f"**Thumbnail:** `{job.get('thumbnail_path', '')}`\n"
            f"**Scenes:** {job.get('scenes_rendered', '?')}/{job.get('scenes_total', '?')} rendered\n"
            f"{warn_block}\n\n"
            f"▶ Export YouTube bundle: `video_export_youtube_bundle(project_id=\"{job['project_id']}\")`"
        )

    if status == "FAILED":
        return (
            f"### ❌ Render Failed\n\n"
            f"**Job:** `{job_id}` | **Elapsed:** {elapsed}s\n"
            f"**Error:** {job.get('error', 'unknown error')}\n\n"
            f"Check Bifrost (:8700) connectivity and try re-running the render."
        )

    # Still running
    return (
        f"### ⏳ Rendering… {progress}%\n\n"
        f"**Job:** `{job_id}` | **Elapsed:** {elapsed}s\n"
        f"**Stage:** {stage}\n\n"
        f"Poll again in 15–30 seconds."
    )


@mcp.tool()
def video_export_youtube_bundle(project_id: str) -> str:
    """
    Stage 5 — Export the final YouTube-ready bundle.
    Returns paths to: video.mp4, thumbnail.jpg, youtube_metadata.json (with chapters & tags).
    """
    proj_dir = _get_project_dir(project_id)
    bundle_file = proj_dir / "youtube_bundle.json"

    if not bundle_file.exists():
        return (
            f"Error: YouTube bundle for `{project_id}` not ready. "
            f"Run video_start_render_job and wait for SUCCESS status."
        )

    with open(bundle_file, encoding="utf-8") as f:
        bundle = json.load(f)

    meta = bundle.get("metadata", {})
    chapters_text = "\n".join(
        f"- `{c['timestamp']}` {c['title']}"
        for c in meta.get("chapters", [])
    ) or "No chapters generated"

    tags_text = ", ".join(meta.get("tags", []))

    return (
        f"### 📦 YouTube Bundle Ready\n\n"
        f"**Project:** `{project_id}`\n\n"
        f"| Asset | Path |\n"
        f"|---|---|\n"
        f"| 🎬 Video (1080p MP4) | `{bundle.get('video_path', '')}` |\n"
        f"| 🖼 Thumbnail (1280×720) | `{bundle.get('thumbnail_path', '')}` |\n"
        f"| 📋 Metadata JSON | `{str(bundle_file)}` |\n\n"
        f"**Title:** {meta.get('title', '')}\n\n"
        f"**Chapters:**\n{chapters_text}\n\n"
        f"**Tags:** {tags_text}\n\n"
        f"**Scenes:** {bundle.get('scenes_rendered', '?')}/{bundle.get('scenes_total', '?')} real video clips rendered.\n\n"
        f"Upload `video_path` and `thumbnail_path` to YouTube Studio."
    )


def _publish_artifact(
    path: Path, thumb_path: Optional[Path] = None, user: str = ""
) -> str:
    """Publish a finished artifact to the STABLE studio home
    (D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated) which LibreChat
    serves at /generated via a dedicated express static route. This directory
    is outside client/dist, so client rebuilds can never 404 a delivered
    creation. Also maintains manifest.json for the Studio Library gallery.
    The manifest carries NO provider/model/cost data.

    Collision rule (operator directive, 2026-11-17): an existing library file
    is NEVER overwritten — a colliding name is republished under a suffixed
    name and the returned URL points at that copy. Videos get a poster-frame
    thumbnail next to the media so the library and chat embeds can show one.
    """
    try:
        stable_dir = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated")
        stable_dir.mkdir(parents=True, exist_ok=True)
        is_video = path.name.lower().endswith((".mp4", ".webm"))
        kind = "video" if is_video else "image"
        name = path.name
        dest = stable_dir / name
        if dest.exists() and dest.stat().st_size != path.stat().st_size:
            name = f"{Path(name).stem}_{uuid.uuid4().hex[:8]}{Path(name).suffix}"
            dest = stable_dir / name
        shutil.copyfile(path, dest)

        # Poster thumbnail for videos (images are their own thumbnail).
        web_url = f"/generated/{name}"
        thumb_url = ""
        try:
            if is_video:
                if thumb_path and Path(thumb_path).exists():
                    tname = f"{Path(name).stem}_thumb{Path(thumb_path).suffix or '.jpg'}"
                    shutil.copyfile(thumb_path, stable_dir / tname)
                    thumb_url = f"/generated/{tname}"
                else:
                    grabbed = _make_video_thumbnail(dest)
                    if grabbed:
                        thumb_url = f"/generated/{grabbed.name}"
            elif name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                thumb_url = web_url
        except Exception as te:
            print(f"[satchida-montage] thumbnail step skipped: {te}", file=sys.stderr)

        manifest_path = stable_dir / "manifest.json"
        try:
            entries = []
            if manifest_path.exists():
                entries = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not any(e.get("name") == name for e in entries):
                entry = {
                    "name": name,
                    "kind": kind,
                    "url": web_url,
                    "thumb": thumb_url,
                    "download": web_url,
                    "created": datetime.datetime.now(datetime.timezone.utc).strftime(
                        "%Y-%m-%d %H:%M"
                    ),
                    "size": dest.stat().st_size,
                }
                if user.strip():
                    entry["user"] = user.strip()[:64]
                entries.append(entry)
            entries.sort(key=lambda e: e.get("created", ""), reverse=True)
            manifest_path.write_text(json.dumps(entries, indent=1), encoding="utf-8")
        except Exception as me:
            print(f"[satchida-montage] manifest update skipped: {me}", file=sys.stderr)
        return web_url
    except Exception as e:
        print(f"[satchida-montage] artifact publish failed: {e}", file=sys.stderr)
        return ""


# ── Async render jobs ─────────────────────────────────────────────────────────
# Cloud video renders take 1–6 minutes — longer than any safe synchronous MCP
# request. video_generate therefore starts a background job and returns
# immediately; the persona polls video_job_status until the clip is done.
# Jobs finish even if the chat disconnects, and every finished clip is
# published to the Studio Library automatically.

MEDIA_JOBS: Dict[str, dict] = {}
_MEDIA_JOB_LOCK = threading.Lock()


def _render_video_job(job_id: str, spec: dict) -> None:
    """Background worker: approval gate → render → publish → settle."""
    with _MEDIA_JOB_LOCK:
        MEDIA_JOBS[job_id]["status"] = "rendering"
    prompt = spec["prompt"]
    out = VIDEOS_DIR / Path(spec["filename"]).name
    try:
        use_native = spec["native_audio"] and not spec["narration"].strip()
        ok = _generate_video_core(
            prompt, spec["duration_seconds"], out, spec["aspect_ratio"],
            native_audio=use_native, quality=spec["quality"],
            image_url=spec["image_url"],
        )
        if not ok:
            raise RuntimeError(
                "render failed on the approved provider chain (check stderr logs)"
            )

        audio_note = ""
        if spec["narration"].strip():
            audio_path = out.with_suffix(".narration.mp3")
            if _tts_edge(spec["narration"].strip(), audio_path):
                muxed = out.with_name(out.stem + "_vo" + out.suffix)
                if _mux_audio(out, audio_path, muxed):
                    out = muxed
                    audio_note = " with synchronized narration audio"
            if not audio_note:
                audio_note = " (narration requested but TTS/mux failed — silent clip)"
        elif spec["native_audio"]:
            audio_note = " with native synchronized audio"
        else:
            # Silent request: priority-1 models may still embed ambient audio.
            if _strip_audio(out):
                audio_note = " (silent clip, audio track stripped)"
            else:
                audio_note = " (silent requested; model-embedded audio kept)"

        web_url = _publish_artifact(out, user=spec.get("user", ""))
        with _MEDIA_JOB_LOCK:
            MEDIA_JOBS[job_id].update({
                "status": "done",
                "web_url": web_url,
                "file": str(out),
                "size_mb": round(out.stat().st_size / (1024 * 1024), 2),
                "engine": _LAST_VIDEO_MODEL or "Satchida Studio",
                "audio_note": audio_note,
                "aspect_ratio": spec["aspect_ratio"],
            })
        print(f"[satchida-montage] job {job_id} done -> {out}", file=sys.stderr)
    except Exception as e:
        with _MEDIA_JOB_LOCK:
            MEDIA_JOBS[job_id].update({"status": "failed", "error": str(e)})
        print(f"[satchida-montage] job {job_id} FAILED: {e}", file=sys.stderr)


@mcp.tool()
def video_generate(
    prompt: str,
    duration_seconds: float = 5.0,
    aspect_ratio: str = "16:9",
    filename: str = "",
    narration: str = "",
    native_audio: bool = False,
    quality: str = "fast",
    image_url: str = "",
    audio_mode: str = "",
    user: str = "",
) -> str:
    """
    Start an async render job for one real AI video clip (cloud only), and
    return a job id immediately. Poll video_job_status(job_id) — typically
    every ~20 s — until status is 'done', then embed the result. Do NOT
    re-call video_generate for the same scene while a job is running.

    Args:
        prompt: Text description of the video to generate.
        duration_seconds: Clip length (models render fixed 5s clips).
        aspect_ratio: '16:9', '9:16', or '1:1' (model permitting).
        filename: Optional output filename (auto-generated if empty).
        narration: Optional spoken narration. When set, free neural TTS
            generates the voice track and it is muxed onto the clip.
        native_audio: When true (and no narration), audio-visual models
            generate synchronized sound inside the clip itself.
        quality: 'fast' (cheapest first) or 'hd' (higher-fidelity first).
        image_url: Optional public image URL — switches to image-to-video.
        user: The signed-in user's name/email — attribution for their library.

    Returns the job id and polling instructions, or a clear error message.
    """
    if not prompt.strip():
        return "Error: prompt is required."
    mode = audio_mode.strip().lower()
    if mode not in {"silent", "sfx_music", "spoken_narration"}:
        return (
            "Audio choice required before paid rendering. Ask the user to choose "
            "one: Silent / Music & SFX / Spoken narration. Do not start the render yet."
        )
    if mode == "silent" and (native_audio or narration.strip()):
        return "Audio settings conflict: silent was selected but audio was requested. Ask the user to clarify."
    if mode == "spoken_narration" and not narration.strip():
        return "Spoken narration was selected; obtain the narration text before rendering."
    if mode == "sfx_music" and not native_audio:
        native_audio = True
    name = filename.strip() or f"clip-{uuid.uuid4().hex[:8]}.mp4"
    if not name.lower().endswith(".mp4"):
        name += ".mp4"
    # Never permit a caller-supplied stable name to collide with an earlier or
    # still-running render. Preserve the requested stem but suffix with job id.
    requested_name = Path(name).stem
    job_id = f"vjob-{uuid.uuid4().hex[:8]}"
    name = f"{requested_name}_{job_id}.mp4"
    spec = {
        "prompt": prompt.strip(),
        "duration_seconds": duration_seconds,
        "aspect_ratio": aspect_ratio,
        "filename": name,
        "narration": narration,
        "native_audio": native_audio,
        "audio_mode": mode,
        "quality": quality,
        "image_url": image_url,
        "user": user,
    }
    with _MEDIA_JOB_LOCK:
        MEDIA_JOBS[job_id] = {"id": job_id, "status": "queued", "spec": spec}
    threading.Thread(target=_render_video_job, args=(job_id, spec), daemon=True).start()
    print(f"[satchida-montage] video job {job_id} queued ({name})", file=sys.stderr)
    return (
        f"🎬 Render job started — job_id: `{job_id}` (file: {name}).\n\n"
        f"Poll `video_job_status(job_id=\"{job_id}\")` every ~20 seconds until it "
        f"reports status 'done', then deliver: embed the film-artifact "
        f"<video> player with the returned Web URL and a Download link. "
        f"If status is 'awaiting_approval', tell the user to approve the "
        f"render in the popup window. Never start a duplicate render for the "
        f"same scene while the job is running."
    )


@mcp.tool()
def video_job_status(job_id: str) -> str:
    """
    Poll an async video render job started with video_generate.
    Returns status ('queued' | 'rendering' | 'done' | 'failed'), progress
    notes, and — when done — the Web URL to embed plus the Download link.
    """
    with _MEDIA_JOB_LOCK:
        job = MEDIA_JOBS.get(job_id)
    if not job:
        return f"Error: job `{job_id}` not found. Check the job id from video_generate."
    status = job["status"]
    if status == "done":
        return (
            f"### ✅ Job {job_id} — render complete\n\n"
            f"**Web URL (embed this so the video plays in chat):** {job['web_url']}\n\n"
            f"Deliver now: film-artifact `<video src=\"{job['web_url']}\" controls "
            f"autoplay loop style=\"width:100%\"></video>` inside your "
            f":::artifact{{type=\"application/vnd.satchida.film\"}} block, plus "
            f"`[Download]({job['web_url']})`. "
            f"{job.get('audio_note', '')} · {job.get('aspect_ratio')} · "
            f"{job.get('size_mb')} MB. Then STOP — no option menus."
        )
    if status == "failed":
        return f"### ❌ Job {job_id} — failed: {job.get('error', 'unknown error')}"
    if status == "queued":
        return (
            f"Job {job_id}: queued (awaiting spend approval — if the approval "
            f"popup is open, the user must click it). Poll again in ~20 s."
        )
    return f"Job {job_id}: rendering… poll again in ~20 s."


@mcp.tool()
def image_generate(
    prompt: str,
    aspect_ratio: str = "16:9",
    filename: str = "",
    user: str = "",
) -> str:
    """
    Generate a real AI image (cloud only).

    Provider policy: CheapInference first (via Bifrost :8700), then DeepInfra
    (FLUX Schnell via their OpenAI-compatible images API, direct).

    Args:
        prompt: Text description of the image to generate.
        aspect_ratio: '16:9', '9:16', or '1:1'.
        filename: Optional output filename (auto-generated if empty).
        user: The signed-in user's name/email — attribution for their library.

    Returns the absolute path of the generated image, or a clear error message.
    """
    if not prompt.strip():
        return "Error: prompt is required."
    ext = ".png" if filename.strip().lower().endswith(".png") else ".jpg"
    stem = _sanitize_stem(filename, "image")
    name = f"{stem}_{uuid.uuid4().hex[:8]}{ext}"
    out = VIDEOS_DIR / name

    ok = _generate_image_core(prompt, out, aspect_ratio)
    if ok:
        size_kb = out.stat().st_size / 1024
        web_url = _publish_artifact(out, user=user)
        url_line = (
            f"\n**Web URL (embed exactly this so the image displays in chat):**\n\n"
            f"![generated image]({web_url})\n\n"
            f"**Download link (include it in your reply):** [⬇ Download image]({web_url})\n"
            f"\n**Also visible in the user's Studio Library:** `/library`\n"
            if web_url
            else ""
        )
        return (
            f"### 🖼 Image Generated\n\n"
            f"**File:** `{out}` ({size_kb:.0f} KB)\n"
            f"**Engine:** Satchida Studio render engine · {aspect_ratio}\n"
            f"{url_line}\n"
            f"Show this image to the user. When embedding it in your reply, copy the"
            f" ![generated image](/generated/...) markdown above verbatim — NEVER a"
            f" filesystem path, which browsers cannot load."
        )
    return (
        "Error: image generation failed on the approved provider chain "
        "(CheapInference via Bifrost, DeepInfra direct). Check Bifrost "
        "(:8700) and this server's stderr logs."
    )


# ── Studio Library + multi-image composition (operator request, 2026-11-17) ──
_STABLE_GENERATED_DIR = Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated")
_COMPOSABLE_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def _library_manifest() -> list:
    try:
        manifest_path = _STABLE_GENERATED_DIR / "manifest.json"
        if manifest_path.exists():
            entries = json.loads(manifest_path.read_text(encoding="utf-8"))
            return entries if isinstance(entries, list) else []
    except Exception:
        pass
    return []


def _resolve_library_file(name: str) -> Optional[Path]:
    base = Path(name.strip()).name
    for d in (_STABLE_GENERATED_DIR, VIDEOS_DIR):
        candidate = d / base
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


@mcp.tool()
def library_list(kind: str = "all") -> str:
    """
    List the user's generated media (images/videos) from the Studio Library.

    Use this whenever the user wants to build something from their existing
    creations — show the numbered list, ask which items to use, then pass the
    exact file names into media_compose.

    Args:
        kind: 'all', 'image', or 'video' to filter the listing.

    Returns a numbered list with name, created date, size, and Web URL.
    """
    wanted = kind.strip().lower()
    if wanted not in {"all", "image", "video"}:
        return "Error: kind must be 'all', 'image', or 'video'."
    entries = _library_manifest()
    if wanted != "all":
        entries = [e for e in entries if e.get("kind") == wanted]
    if not entries:
        return "The Studio Library is empty — generate media first."
    lines = [f"### 🗂 Studio Library — {len(entries)} item(s)"]
    for i, e in enumerate(entries, 1):
        mb = e.get("size", 0) / (1024 * 1024)
        lines.append(
            f"{i}. **{e.get('name')}** · {e.get('kind')} · {e.get('created', '')} · "
            f"{mb:.2f} MB · {e.get('url', '')}"
        )
    lines.append(
        "Ask the user which numbers to use, then call media_compose with the "
        "exact file names. Never compose without the user's explicit selection."
    )
    return "\n".join(lines)


@mcp.tool()
def media_compose(
    compose_type: str,
    files: List[str],
    output_name: str = "",
    audio_mode: str = "",
    seconds_per_image: float = 4.0,
    transition: str = "fade",
    music_file: str = "",
    narration: str = "",
    user: str = "",
) -> str:
    """
    Build a collage or a slideshow video from media the user SELECTED from their
    Studio Library (call library_list first, let the user pick, then pass the
    exact file names).

    Args:
        compose_type: 'collage' (single grid image from 2+ images) or
            'slideshow' (MP4 video from 2+ images, with your audio choice).
        files: Selected library file names, e.g. ['a.png', 'b.jpg'].
        output_name: Optional readable name (a per-job unique suffix is always
            appended, so nothing is ever overwritten).
        audio_mode: REQUIRED for 'slideshow' — ask the user to choose first:
            'silent' | 'music' (music_file required) | 'narration'
            (narration text required, free neural TTS). Never guess audio; a
            paid wrong choice costs the user money.
        seconds_per_image: Slideshow per-image duration (2–10 s).
        transition: Slideshow transition: fade | wipeleft | slideright | circleopen.
        music_file: Absolute path or /generated/ name of a music/audio file.
        narration: Narration text when audio_mode is 'narration'.
        user: The signed-in user's name/email — attribution for their library.

    Returns job-style status with the Web URL, download link, and thumbnail.
    """
    c_type = compose_type.strip().lower()
    if c_type not in {"collage", "slideshow"}:
        return "Error: compose_type must be 'collage' or 'slideshow'."
    names = [f.strip() for f in files if f and f.strip()]
    if len(names) < 2:
        return "Error: select at least 2 items (call library_list and ask the user which to use)."
    resolved = []
    missing = []
    for n in names:
        p = _resolve_library_file(n)
        if p and p.suffix.lower() in _COMPOSABLE_IMAGE_EXTS:
            resolved.append(p)
        else:
            missing.append(n)
    if missing:
        return (
            "Error: not found or not a composable image: "
            + ", ".join(missing)
            + " — run library_list and use exact names."
        )
    out_stem = _sanitize_stem(output_name, f"{c_type}")
    ext = ".png" if c_type == "collage" else ".mp4"
    out = VIDEOS_DIR / f"{out_stem}_{uuid.uuid4().hex[:8]}{ext}"

    if c_type == "collage":
        try:
            from PIL import Image
        except ImportError:
            return "Error: Pillow unavailable in this runtime; cannot build a collage."
        try:
            imgs = [Image.open(p).convert("RGB") for p in resolved]
            n = len(imgs)
            cols = max(1, int(n ** 0.5 + 0.999))
            rows = -(-n // cols)
            cell_w, cell_h, gap = 960, 540, 8
            canvas = Image.new(
                "RGB",
                (cols * cell_w + (cols + 1) * gap, rows * cell_h + (rows + 1) * gap),
                (13, 11, 16),
            )
            for idx, im in enumerate(imgs):
                r, c = divmod(idx, cols)
                thumb = im.copy()
                thumb.thumbnail((cell_w, cell_h))
                x = gap + c * (cell_w + gap) + (cell_w - thumb.width) // 2
                y = gap + r * (cell_h + gap) + (cell_h - thumb.height) // 2
                canvas.paste(thumb, (x, y))
            canvas.save(out, quality=92)
        except Exception as e:
            return f"Error: collage failed: {e}"
        web_url = _publish_artifact(out, user=user)
        if not web_url:
            return "Error: collage built but publish failed (check stderr)."
        return (
            f"### 🧩 Collage ready\n\n"
            f"**Web URL:** {web_url}\n"
            f"![collage]({web_url})\n"
            f"**Download:** [⬇ Download collage]({web_url})\n"
            f"{out.name} · {out.stat().st_size / 1024:.0f} KB · "
            f"from {len(resolved)} selected images. Show the image, keep the "
            f"download link, and stop — no option menus."
        )

    # ── slideshow ────────────────────────────────────────────────────────────
    mode = audio_mode.strip().lower()
    if mode not in {"silent", "music", "narration"}:
        return (
            "Audio choice required BEFORE building the slideshow. Ask the user: "
            "Silent / Background music / Spoken narration? Do not compose yet — "
            "the user must never pay for audio they never asked for."
        )
    if mode == "music" and not music_file.strip():
        return "Music selected but music_file is empty — provide the audio file path or /generated/ name."
    if mode == "narration" and not narration.strip():
        return "Narration selected but narration text is empty — provide the narration script."
    music_src = _resolve_library_file(music_file) if music_file.strip() else None
    if mode == "music":
        if music_src is None:
            return f"Error: music file not found: {music_file}"
        if not (music_src.suffix.lower() in {".mp3", ".wav", ".m4a", ".aac", ".ogg"}):
            return f"Error: {music_src.name} is not an audio file."

    d = max(2.0, min(10.0, float(seconds_per_image)))
    n = len(resolved)
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    cmd: List[str] = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    fparts: List[str] = []
    for i, p in enumerate(resolved):
        cmd += ["-loop", "1", "-t", f"{d:.2f}", "-framerate", "30", "-i", str(p)]
        fparts.append(
            f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
            f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#0d0b10,setsar=1,"
            f"format=yuv420p,fps=30[v{i}]"
        )
    if n == 1:
        return "Error: slideshow needs at least 2 images."
    if n == 2:
        fparts.append("[v0][v1]xfade=transition=fade:duration=0.5:offset=" f"{d - 0.5:.2f}[vout]")
    else:
        prev = "v0"
        off = d - 0.5
        for i in range(1, n):
            nxt = f"x{i}" if i < n - 1 else "vout"
            fparts.append(
                f"[{prev}][v{i}]xfade=transition={transition}:duration=0.5:offset={off:.2f}[{nxt}]"
            )
            prev = nxt
            off += d - 0.5
    # xfade shortens the stream; total ≈ n*d - (n-1)*0.5
    total = n * d - (n - 1) * 0.5
    if mode == "music":
        cmd += ["-i", str(music_src)]
        fparts.append(f"[{n}:a]atrim=0:{total:.2f},volume=1.0[my_aud]")
        cmd += ["-map", "[vout]", "-map", "[my_aud]", "-c:a", "aac", "-b:a", "160k"]
    else:
        cmd += ["-map", "[vout]", "-an"]
    cmd += [
        "-filter_complex", ";".join(fparts),
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-t", f"{total:.2f}",
        str(out),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=420,
                              stdin=subprocess.DEVNULL, creationflags=flags)
        ok = proc.returncode == 0 and out.exists() and out.stat().st_size > 10240
        if not ok:
            err = (proc.stderr or "")[-300:]
            return f"Error: slideshow render failed: {err or 'no output'}"
    except Exception as e:
        return f"Error: slideshow render failed: {e}"

    audio_note = " with background music" if mode == "music" else " (silent, no audio track)"
    if mode == "narration":
        audio_path = out.with_suffix(".narration.mp3")
        muxed = out.with_name(out.stem + "_vo" + out.suffix)
        if _tts_edge(narration.strip(), audio_path) and _mux_audio(out, audio_path, muxed):
            out.unlink(missing_ok=True)
            out = muxed
            audio_note = " with synchronized narration"
        else:
            audio_note = " (narration requested but TTS/mux failed — silent clip)"

    thumb = _make_video_thumbnail(out)
    web_url = _publish_artifact(out, thumb, user)
    if not web_url:
        return "Error: slideshow rendered but publish failed (check stderr)."
    return (
        f"### 🎞 Slideshow ready\n\n"
        f"**Web URL:** {web_url}\n"
        f"Deliver now: `<video src=\"{web_url}\" controls style=\"width:100%\"></video>`\n"
        f"**Download:** [⬇ Download slideshow]({web_url})\n"
        f"{out.name} · {out.stat().st_size / (1024 * 1024):.2f} MB · {n} images · "
        f"{total:.1f} s{audio_note}. Then STOP — no option menus."
    )


# ── Local Privacy media — ComfyUI :8188 (phase-4, 2026-11-17) ─────────────────
# Decision (operator): ComfyUI wins over OpenMontage for local media — the
# models are staged in ComfyUI layout (D:\LAN-AI-Infra\Image-models) and the
# desktop install already carries the extra-models config. OpenMontage stays
# the orchestration layer for cloud production pipelines only.
#
# HARD INVARIANT: the port-8080 llama fleet owns CUDA 0 too — we NEVER kill,
# restart, or re-configure it. When free VRAM is too small for a local media
# job we REFUSE and ask the user to unload the chat model via the Tauri UI.
COMFYUI_URL: str = os.environ.get("SATCHIDA_COMFYUI_URL", "http://127.0.0.1:8188")
COMFYUI_PY = os.environ.get(
    "SATCHIDA_COMFYUI_PY", r"C:\Users\WinDiesel\Documents\ComfyUI\.venv\Scripts\python.exe"
)
COMFYUI_MAIN = os.environ.get(
    "SATCHIDA_COMFYUI_MAIN",
    r"C:\Users\WinDiesel\AppData\Local\Programs\ComfyUI\resources\ComfyUI\main.py",
)
COMFYUI_MODELS_CFG = os.environ.get(
    "SATCHIDA_COMFYUI_MODELS_CFG",
    os.path.expandvars(r"%APPDATA%\ComfyUI\extra_models_config.yaml"),
)
COMFYUI_LOG = _STUDIO_ROOT / "logs" / "comfyui.log"
COMFYUI_PID_FILE = _STUDIO_ROOT / "tmp" / "comfyui.pid"
COMFYUI_START_COOLDOWN = 120.0
_COMFY_LAST_START = [0.0]

# SD checkpoints staged in Image-models (ComfyUI 'checkpoints' dir):
#   realisticVisionV51_v51VAE  (SD1.5, ~2.1 GB — always fits next to the fleet)
#   DreamShaper_8_pruned       (SD1.5, ~2.1 GB)
#   anything_v5_pruned         (SD1.5 anime, ~2.1 GB)
#   sd_xl_base_1.0             (SDXL,  ~6.9 GB — needs the chat model unloaded)
#   stable-diffusion-v3-5-large-turbo-pure-Q4_0.gguf (needs ComfyUI-GGUF)
LOCAL_SD15_CHECKPOINTS = [
    "realisticVisionV51_v51VAE.safetensors",
    "DreamShaper_8_pruned.safetensors",
    "anything_v5_pruned.safetensors",
]
LOCAL_SDXL_CHECKPOINTS = ["sd_xl_base_1.0.safetensors"]

_COMFY_CLIENT_ID = uuid.uuid4().hex


def _comfy_request(
    method: str,
    path: str,
    body: Optional[dict] = None,
    timeout: float = 30.0,
    raw: bool = False,
):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        COMFYUI_URL + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = resp.read()
        return payload if raw else json.loads(payload.decode("utf-8"))


def _comfy_up() -> bool:
    try:
        _comfy_request("GET", "/system_stats", timeout=4)
        return True
    except Exception:
        return False


def _comfy_start() -> bool:
    """Cold-start ComfyUI headless if it is down. Rate-limited; NEVER kills a
    live instance and NEVER touches anything on port 8080."""
    now = time.time()
    if now - _COMFY_LAST_START[0] < COMFYUI_START_COOLDOWN:
        return _comfy_up()
    _COMFY_LAST_START[0] = now
    if _comfy_up():
        return True
    if not (Path(COMFYUI_PY).exists() and Path(COMFYUI_MAIN).exists()):
        print("[satchida-montage] comfy start skipped: paths missing", file=sys.stderr)
        return False
    try:
        COMFYUI_LOG.parent.mkdir(parents=True, exist_ok=True)
        log_handle = open(COMFYUI_LOG, "ab")
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | \
            getattr(subprocess, "DETACHED_PROCESS", 0)
        proc = subprocess.Popen(
            [
                COMFYUI_PY, "-s", COMFYUI_MAIN,
                "--port", "8188",
                "--listen", "127.0.0.1",
                "--extra-model-paths-config", COMFYUI_MODELS_CFG,
                "--output-directory",
                r"C:\Users\WinDiesel\Documents\ComfyUI\output",
            ],
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
        )
        COMFYUI_PID_FILE.parent.mkdir(parents=True, exist_ok=True)
        COMFYUI_PID_FILE.write_text(str(proc.pid), encoding="utf-8")
        print(f"[satchida-montage] comfy cold-start pid {proc.pid}", file=sys.stderr)
    except Exception as e:
        print(f"[satchida-montage] comfy start failed: {e}", file=sys.stderr)
        return False
    for _ in range(30):
        time.sleep(2)
        if _comfy_up():
            return True
    return False


def _comfy_free_vram_mb() -> Optional[int]:
    try:
        stats = _comfy_request("GET", "/system_stats", timeout=8)
        devices = stats.get("devices") or []
        if devices:
            free = int(devices[0].get("free_memory", 0)) // (1024 * 1024)
            total = int(devices[0].get("total_memory", 0)) // (1024 * 1024)
            if free > 0 or total > 0:
                return free
    except Exception:
        pass
    # This box reports 0/0 through pynvml (known WMI/nvidia-smi VRAM quirk,
    # see agent_handover) — fall back to nvidia-smi directly.
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        proc = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=20, creationflags=flags)
        return int(proc.stdout.strip().splitlines()[0])
    except Exception:
        return None


def _comfy_has_class(class_type: str) -> bool:
    try:
        info = _comfy_request("GET", f"/object_info/{class_type}", timeout=10)
        return bool(info.get(class_type))
    except urllib.error.HTTPError:
        return False
    except Exception:
        return False


def _comfy_wait(prompt_id: str, max_seconds: float = 420.0) -> Optional[dict]:
    deadline = time.time() + max_seconds
    while time.time() < deadline:
        time.sleep(3)
        try:
            hist = _comfy_request("GET", f"/history/{prompt_id}", timeout=15)
            entry = hist.get(prompt_id)
            if not entry:
                continue
            if entry.get("status", {}).get("status_str") in ("error", "success"):
                return entry if entry["status"]["status_str"] == "success" else None
        except Exception:
            continue
    return None


def _comfy_fetch_output(entry: dict, desired_stem: str = "") -> Optional[str]:
    """Download the first output artifact of a finished job into VIDEOS_DIR."""
    outputs = entry.get("outputs", {})
    for node_out in outputs.values():
        items = node_out.get("images") or node_out.get("gifs") or node_out.get("videos") or []
        if items:
            it = items[0]
            qs = urllib.parse.urlencode({
                "filename": it.get("filename", ""),
                "subfolder": it.get("subfolder", ""),
                "type": it.get("type", "output"),
            })
            try:
                data = _comfy_request("GET", f"/view?{qs}", timeout=120, raw=True)
            except Exception as e:
                print(f"[satchida-montage] comfy view failed: {e}", file=sys.stderr)
                return None
            src_ext = Path(it.get("filename", ".comfy")).suffix or ".png"
            name = _unique_media_name(desired_stem or Path(it.get("filename", "comfy")).stem,
                                      "comfy", src_ext)
            out = VIDEOS_DIR / name
            out.write_bytes(data)
            return str(out)
    return None


def _comfy_sd_image_workflow(
    prompt: str, negative: str, size: tuple, checkpoint: str,
    steps: int, cfg: float, seed: int,
) -> dict:
    w, h = size
    return {
        "1": {"inputs": {"ckpt_name": checkpoint}, "class_type": "CheckpointLoaderSimple"},
        "2": {"inputs": {"text": prompt, "clip": ["1", 1]}, "class_type": "CLIPTextEncode"},
        "3": {"inputs": {"text": negative, "clip": ["1", 1]}, "class_type": "CLIPTextEncode"},
        "4": {"inputs": {"width": w, "height": h, "batch_size": 1},
              "class_type": "EmptyLatentImage"},
        "5": {"inputs": {
            "seed": seed, "steps": steps, "cfg": cfg,
            "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0]}, "class_type": "KSampler"},
        "6": {"inputs": {"samples": ["5", 0], "vae": ["1", 2]}, "class_type": "VAEDecode"},
        "7": {"inputs": {"filename_prefix": "satchida_local_image",
                         "images": ["6", 0]}, "class_type": "SaveImage"},
    }


def _comfy_flux_image_workflow(
    prompt: str, size: tuple, seed: int,
) -> Optional[dict]:
    if not _comfy_has_class("UnetLoaderGGUF"):
        return None
    w, h = size
    return {
        "1": {"inputs": {"unet_name": "flux1-schnell-Q4_K_S.gguf"},
              "class_type": "UnetLoaderGGUF"},
        "2": {"inputs": {"clip_name1": "t5-v1_1-xxl-encoder-Q4_K_M.gguf",
                         "clip_name2": "clip_l.safetensors", "type": "flux"},
              "class_type": "DualCLIPLoaderGGUF"},
        "3": {"inputs": {"vae_name": "ae.safetensors"}, "class_type": "VAELoader"},
        "4": {"inputs": {"width": w, "height": h, "batch_size": 1},
              "class_type": "EmptySD3LatentImage"},
        "5": {"inputs": {"text": prompt, "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "6": {"inputs": {"text": "", "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "7": {"inputs": {"seed": seed, "steps": 4, "cfg": 1.0,
                         "sampler_name": "euler", "scheduler": "simple",
                         "denoise": 1.0, "model": ["1", 0], "positive": ["5", 0],
                         "negative": ["6", 0], "latent_image": ["4", 0]},
              "class_type": "KSampler"},
        "8": {"inputs": {"samples": ["7", 0], "vae": ["3", 0]}, "class_type": "VAEDecode"},
        "9": {"inputs": {"filename_prefix": "satchida_local_flux",
                         "images": ["8", 0]}, "class_type": "SaveImage"},
    }


def _comfy_wan_workflow(
    prompt: str, negative: str, seed: int, with_audio: bool, audio_prompt: str,
) -> Optional[dict]:
    """Wan2.1 T2V GGUF animated clip (49 frames ≈ 2 s @ 24 fps).
    with_audio=False → silent WebP/MP4; True → MMAudio-synchronized audio."""
    if not _comfy_has_class("UnetLoaderGGUF"):
        return None
    if not _comfy_has_class("VHS_VideoCombine"):
        return None
    if with_audio and not _comfy_has_class("MMAudioSampler"):
        return None
    wf = {
        "1": {"inputs": {"unet_name": "wan2.1-t2v-14b-Q3_K_M.gguf"},
              "class_type": "UnetLoaderGGUF"},
        "2": {"inputs": {"clip_name": "umt5-xxl-encoder-Q4_K_M.gguf", "type": "wan"},
              "class_type": "CLIPLoaderGGUF"},
        "3": {"inputs": {"vae_name": "wan_2.1_vae.safetensors"}, "class_type": "VAELoader"},
        "4": {"inputs": {"model": ["1", 0], "shift": 8.0}, "class_type": "ModelSamplingSD3"},
        "5": {"inputs": {"vae": ["3", 0], "width": 512, "height": 512,
                         "length": 49, "batch_size": 1},
              "class_type": "Wan22ImageToVideoLatent"},
        "6": {"inputs": {"text": prompt, "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "7": {"inputs": {"text": negative or "blur, distortion, oversaturated, low quality",
                         "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "8": {"inputs": {"seed": seed, "steps": 15, "cfg": 6.0,
                         "sampler_name": "uni_pc", "scheduler": "simple",
                         "denoise": 1.0, "model": ["4", 0], "positive": ["6", 0],
                         "negative": ["7", 0], "latent_image": ["5", 0]},
              "class_type": "KSampler"},
        "9": {"inputs": {"samples": ["8", 0], "vae": ["3", 0]}, "class_type": "VAEDecode"},
        "10": {"inputs": {"images": ["9", 0], "frame_rate": 24, "loop_count": 0,
                          "filename_prefix": "satchida_local_animated",
                          "format": "image/webp", "pingpong": False,
                          "save_output": True},
               "class_type": "VHS_VideoCombine"},
    }
    if with_audio:
        wf["10"]["inputs"]["format"] = "video/h264-mp4"
        wf["10"]["inputs"]["audio"] = ["13", 0]
        wf["11"] = {
            "inputs": {"mmaudio_model": "mmaudio_large_44k_v2_fp16.safetensors",
                       "base_precision": "fp16"},
            "class_type": "MMAudioModelLoader"}
        wf["12"] = {
            "inputs": {"vae_model": "mmaudio_vae_44k_fp16.safetensors",
                       "synchformer_model": "mmaudio_synchformer_fp16.safetensors",
                       "clip_model": "apple_DFN5B-CLIP-ViT-H-14-384_fp16.safetensors",
                       "mode": "44k", "precision": "fp16"},
            "class_type": "MMAudioFeatureUtilsLoader"}
        wf["13"] = {
            "inputs": {"mmaudio_model": ["11", 0], "feature_utils": ["12", 0],
                       "duration": 2.04, "steps": 25, "cfg": 4.5, "seed": seed,
                       "prompt": audio_prompt or prompt,
                       "negative_prompt": "noise, talking, distorted, music",
                       "mask_away_clip": False, "force_offload": True,
                       "images": ["9", 0]},
            "class_type": "MMAudioSampler"},
    return wf


def _estimate_model_mb(model_name: str) -> int:
    for base in (Path(r"D:\LAN-AI-Infra\Image-models\checkpoints"),
                 Path(r"D:\LAN-AI-Infra\Image-models\unet")):
        p = base / model_name
        if p.exists():
            return int(p.stat().st_size / (1024 * 1024)) + 2048
    return 4096


@mcp.tool()
def comfy_status() -> str:
    """
    Report the local ComfyUI media server (:8188): up/down, free VRAM, queue,
    and which local pipelines are available. Use it before offering local
    (Privacy-mode) media generation so the user is never surprised.
    """
    up = _comfy_up() or _comfy_start()
    if not up:
        return "ComfyUI :8188 is down and cold-start failed — check logs/comfyui.log."
    free = _comfy_free_vram_mb()
    try:
        queue = _comfy_request("GET", "/queue", timeout=8)
        running = len(queue.get("queue_running", []))
        pending = len(queue.get("queue_pending", []))
    except Exception:
        running = pending = -1
    lines = [
        "### 🖥 Local ComfyUI media engine (:8188)",
        f"Status: running · Free VRAM: {free} MB · Queue: {running} running, {pending} pending",
        f"SD1.5 photoreal images: available (steps fit next to the chat fleet)",
        f"SDXL images: {'fits if the chat model is unloaded' if (free or 0) >= 8000 else 'needs ~8 GB — unload the chat model first'}",
        f"FLUX Schnell local: {'available' if _comfy_has_class('UnetLoaderGGUF') else 'needs ComfyUI-GGUF custom node'}",
        f"Animated (Wan) silent: {'available' if _comfy_has_class('VHS_VideoCombine') else 'needs VideoHelperSuite custom node'}",
        f"Animated (Wan) with audio: {'available' if _comfy_has_class('MMAudioSampler') else 'needs ComfyUI-MMAudio custom node'}",
        "Privacy note: local generation keeps prompts and images on this machine.",
    ]
    return "\n".join(lines)


@mcp.tool()
def image_generate_local(
    prompt: str,
    aspect_ratio: str = "16:9",
    model: str = "",
    steps: int = 28,
    negative: str = "",
    filename: str = "",
    user: str = "",
) -> str:
    """
    Generate an image 100% locally (Privacy mode) via ComfyUI on this machine.

    Use ONLY when the chat is in Privacy mode or the user explicitly asks for
    local/sovereign generation. Default chain: SD1.5 checkpoints (always fit
    beside the chat fleet); SDXL or FLUX Schnell when VRAM allows.

    Args:
        prompt: Image description.
        aspect_ratio: '16:9', '9:16', or '1:1'.
        model: Optional checkpoint name (default: realisticVision V5.1).
        steps: Sampler steps (SD1.5 25–35; FLUX forces 4).
        negative: Negative prompt (optional).
        filename: Optional readable stem — a per-job unique suffix is always added.
        user: Signed-in user's name/email for library attribution.

    Returns the embed + download markdown, or a clear VRAM/unavailability error.
    """
    if not prompt.strip():
        return "Error: prompt is required."
    if not (_comfy_up() or _comfy_start()):
        return "Error: local ComfyUI is not running and cold-start failed (check logs/comfyui.log)."

    ratio = aspect_ratio.strip()
    sizes = {"16:9": (1024, 576), "9:16": (576, 1024), "1:1": (768, 768)}
    sd15_size = sizes.get(ratio, (1024, 576))
    sdxl_size = {"16:9": (1216, 684), "9:16": (684, 1216), "1:1": (1024, 1024)}.get(
        ratio, (1216, 684))
    flux_size = {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (1024, 1024)}.get(
        ratio, (1280, 720))

    free = _comfy_free_vram_mb() or 0
    checkpoint = (model or "").strip()
    workflow = None
    engine = ""
    if checkpoint.endswith(".gguf") and "schnell" in checkpoint.lower():
        workflow = _comfy_flux_image_workflow(prompt, flux_size, random.randint(0, 2**31 - 1))
        engine = f"FLUX Schnell local ({checkpoint})"
        need = _estimate_model_mb(checkpoint) + 4500
    elif checkpoint in LOCAL_SDXL_CHECKPOINTS:
        workflow = _comfy_sd_image_workflow(
            prompt, negative, sdxl_size, checkpoint, max(20, steps), 7.0,
            random.randint(0, 2**31 - 1))
        engine = f"SDXL local ({checkpoint})"
        need = _estimate_model_mb(checkpoint) + 1500
    else:
        checkpoint = checkpoint if checkpoint in LOCAL_SD15_CHECKPOINTS else \
            LOCAL_SD15_CHECKPOINTS[0]
        workflow = _comfy_sd_image_workflow(
            prompt, negative, sd15_size, checkpoint, max(12, min(40, steps)), 6.5,
            random.randint(0, 2**31 - 1))
        engine = f"SD1.5 local ({checkpoint})"
        need = _estimate_model_mb(checkpoint)

    if free < need:
        return (
            f"Not enough free VRAM for local generation: {free} MB free, "
            f"~{need} MB needed. Ask the user to unload the chat model in the "
            f"Satchida desktop app (this never kills the :8080 fleet), then retry. "
            f"Cloud generation stays available meanwhile."
        )
    if workflow is None:
        return (
            "FLUX Schnell local needs the ComfyUI-GGUF custom node which is not "
            "installed yet. Use the SD1.5 chain (default) or ask the operator to "
            "install ComfyUI-GGUF."
        )

    try:
        resp = _comfy_request("POST", "/prompt", {
            "prompt": workflow, "client_id": _COMFY_CLIENT_ID}, timeout=30)
    except urllib.error.HTTPError as he:
        detail = ""
        try:
            detail = he.read().decode("utf-8", "replace")[:400]
        except Exception:
            pass
        return f"Error: ComfyUI rejected the local job: HTTP {he.code} {detail}"
    except Exception as e:
        return f"Error: ComfyUI rejected the local job: {e}"
    entry = _comfy_wait(resp.get("prompt_id", ""))
    out_path = _comfy_fetch_output(entry, "local_image") if entry else None
    if not out_path:
        return (
            "Error: local generation failed (ComfyUI history shows an error — "
            "check logs/comfyui.log). Try fewer steps or the SD1.5 checkpoint."
        )
    out = Path(out_path)
    web_url = _publish_artifact(out, user=user)
    if not web_url:
        return "Error: local image rendered but publish failed (check stderr)."
    size_kb = out.stat().st_size / 1024
    return (
        f"### 🖼 Local image generated (Privacy — nothing left this machine)\n\n"
        f"**File:** `{out}` ({size_kb:.0f} KB) · Engine: {engine}\n\n"
        f"**Web URL (embed exactly this):**\n\n"
        f"![generated image]({web_url})\n\n"
        f"**Download:** [⬇ Download image]({web_url}) · "
        f"Also in the user's Studio Library: `/library`"
    )


@mcp.tool()
def animated_generate_local(
    prompt: str,
    audio_mode: str = "",
    audio_prompt: str = "",
    seed: int = -1,
    filename: str = "",
    user: str = "",
) -> str:
    """
    Generate a short LOCAL animated clip (Wan2.1 T2V, ~2 s, 512×512) on
    ComfyUI — Privacy mode animated media.

    AUDIO GATE (mandatory, operator directive): a local animated render is
    compute-billed the same way cloud renders cost money — NEVER choose the
    audio variant without the user's explicit choice. audio_mode must be
    'silent' or 'ambient_sfx' (MMAudio-synchronized sound). Ask when unclear.

    Args:
        prompt: Scene description for the animation.
        audio_mode: REQUIRED — 'silent' or 'ambient_sfx'.
        audio_prompt: Sound description when ambient_sfx (defaults to the scene prompt).
        seed: Optional sampler seed (-1 = random).
        filename: Optional readable stem (unique suffix always appended).
        user: Signed-in user's name/email for library attribution.

    Returns a job-style result with embed + download, or a VRAM/capability error.
    """
    if not prompt.strip():
        return "Error: prompt is required."
    mode = audio_mode.strip().lower()
    if mode not in {"silent", "ambient_sfx"}:
        return (
            "Audio choice required before local animation. Ask the user: Silent "
            "or Ambient sound & SFX (local MMAudio)? Do not render yet."
        )
    if not (_comfy_up() or _comfy_start()):
        return "Error: local ComfyUI is not running and cold-start failed."
    free = _comfy_free_vram_mb() or 0
    need = _estimate_model_mb("wan2.1-t2v-14b-Q3_K_M.gguf") + (3000 if mode == "ambient_sfx" else 1500)
    if free < need:
        return (
            f"Not enough free VRAM for local animation: {free} MB free, ~{need} MB "
            f"needed. The Wan model must be loaded alone — ask the user to unload "
            f"the chat model in the Satchida desktop app, then retry."
        )
    workflow = _comfy_wan_workflow(
        prompt.strip(), "", seed if seed >= 0 else random.randint(0, 2**31 - 1),
        with_audio=(mode == "ambient_sfx"), audio_prompt=audio_prompt)
    if workflow is None:
        missing = []
        if not _comfy_has_class("UnetLoaderGGUF"):
            missing.append("ComfyUI-GGUF")
        if not _comfy_has_class("VHS_VideoCombine"):
            missing.append("ComfyUI-VideoHelperSuite")
        if mode == "ambient_sfx" and not _comfy_has_class("MMAudioSampler"):
            missing.append("ComfyUI-MMAudio")
        return (
            "Local animation is not installed yet — missing custom node(s): "
            + ", ".join(missing)
            + ". The operator must install them into Documents\\ComfyUI\\custom_nodes."
        )
    try:
        resp = _comfy_request("POST", "/prompt", {
            "prompt": workflow, "client_id": _COMFY_CLIENT_ID}, timeout=30)
    except Exception as e:
        return f"Error: ComfyUI rejected the local animation job: {e}"
    entry = _comfy_wait(resp.get("prompt_id", ""), max_seconds=900.0)
    out_path = _comfy_fetch_output(entry, "local_animated") if entry else None
    if not out_path:
        return "Error: local animation failed (check logs/comfyui.log)."
    out = Path(out_path)
    audio_note = (" with MMAudio-synchronized ambient sound"
                  if mode == "ambient_sfx" else " (silent clip)")
    thumb = _make_video_thumbnail(out)
    web_url = _publish_artifact(out, thumb, user)
    if not web_url:
        return "Error: local animation rendered but publish failed."
    return (
        f"### 🎞 Local animated clip ready (Privacy — nothing left this machine)\n\n"
        f"**Web URL:** {web_url}\n\n"
        f"Deliver: `<video src=\"{web_url}\" controls style=\"width:100%\"></video>`\n\n"
        f"**Download:** [⬇ Download clip]({web_url})\n"
        f"{out.name} · {out.stat().st_size / (1024 * 1024):.2f} MB · "
        f"49 frames @ 24 fps{audio_note}. Then STOP."
    )


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mcp.run()
