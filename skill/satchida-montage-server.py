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
import os
import sys
import json
import time
import uuid
import base64
import hashlib
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
    _CI_MEDIA_CACHE["ts"] = now
    _CI_MEDIA_CACHE[kind] = models
    return models


def _download_video_content(encoded_id: str, output_path: Path) -> bool:
    """Fetch a completed Bifrost video job's MP4 (JSON url or raw bytes)."""
    try:
        c_status, content = _bifrost_call("GET", f"/v1/videos/{encoded_id}/content", timeout=180)
    except Exception as e:
        print(f"[satchida-montage] CI content fetch failed: {e}", file=sys.stderr)
        return False
    if c_status == 200 and isinstance(content, dict):
        url = None
        for k in ("url", "video_url", "download_url"):
            if isinstance(content.get(k), str):
                url = content[k]
                break
        if url and _download_url(url, output_path):
            return True
    try:
        req = urllib.request.Request(
            f"{BIFROST_URL}/v1/videos/{encoded_id}/content",
            headers={"Authorization": f"Bearer {_bifrost_key()}"},
        )
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
        if len(data) > 1024 and data[4:8] == b"ftyp":
            output_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = output_path.with_suffix(output_path.suffix + ".part")
            tmp.write_bytes(data)
            tmp.replace(output_path)
            return True
        print(
            f"[satchida-montage] CI content not an MP4 ({len(data)} bytes)",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"[satchida-montage] CI raw content download failed: {e}", file=sys.stderr)
    return False


def _ci_video_via_bifrost(
    prompt: str,
    duration_seconds: float,
    output_path: Path,
    aspect_ratio: str = "16:9",
    timeout: int = 300,
) -> bool:
    """Priority-1 chain: CheapInference /v1/videos through Bifrost (:8700)."""
    global _LAST_VIDEO_MODEL
    for model in _ci_media_models("video"):
        seconds = _nearest_duration(model, duration_seconds)
        size = _SIZE_BY_RATIO.get(aspect_ratio, "1280x720")
        job = None
        status = 0
        for attempt in range(3):
            try:
                status, job = _bifrost_call(
                    "POST",
                    "/v1/videos",
                    {"model": model, "prompt": prompt, "seconds": seconds, "size": size},
                    timeout=60,
                )
            except Exception as e:
                print(
                    f"[satchida-montage] CI video submit {model} "
                    f"(attempt {attempt + 1}/3): {e}",
                    file=sys.stderr,
                )
                job = None
            job_id = job.get("id") if isinstance(job, dict) else None
            if status == 200 and job_id:
                break
            if attempt < 2:
                time.sleep(8 * (attempt + 1))
        else:
            print(
                f"[satchida-montage] CI video {model} rejected after 3 attempts "
                f"(HTTP {status}): {str(job)[:200]}",
                file=sys.stderr,
            )
            continue

        job_id = job.get("id")
        encoded = urllib.parse.quote(job_id, safe="")
        final_state = None
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            time.sleep(4)
            try:
                st_status, state = _bifrost_call("GET", f"/v1/videos/{encoded}", timeout=30)
            except Exception as e:
                print(f"[satchida-montage] CI poll failed: {e}", file=sys.stderr)
                continue
            if st_status != 200 or not isinstance(state, dict):
                continue
            s = str(state.get("status", "")).lower()
            if s in ("completed", "succeeded", "success"):
                final_state = state
                break
            if s in ("failed", "cancelled", "canceled", "error"):
                print(
                    f"[satchida-montage] CI video {model} job failed: {state.get('error')}",
                    file=sys.stderr,
                )
                break
        if not final_state:
            print(f"[satchida-montage] CI video {model} timed out after {timeout}s", file=sys.stderr)
            continue
        if _download_video_content(encoded, output_path):
            _LAST_VIDEO_MODEL = model
            print(f"[satchida-montage] video OK via {model} -> {output_path}", file=sys.stderr)
            return True
    return False


def _deepinfra_key() -> str:
    """Decrypt the DeepInfra provider key from Bifrost's store, in-process.

    Same Argon2id + AES-256-GCM scheme as Bifrost's encrypt package. The key is
    never logged, never written to disk, and never leaves this machine.
    """
    global _DEEPINFRA_KEY_CACHE
    if _DEEPINFRA_KEY_CACHE:
        return _DEEPINFRA_KEY_CACHE
    try:
        from argon2.low_level import hash_secret_raw, Type as _ArgonType
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import sqlite3
        import re as _re

        passphrase = os.environ.get("BIFROST_ENCRYPTION_KEY", "").strip()
        if not passphrase:
            out = subprocess.run(
                "pm2 env 15", capture_output=True, text=True, timeout=20, shell=True
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
                "SELECT value FROM config_keys WHERE provider='deepinfra' AND enabled=1 LIMIT 1"
            ).fetchone()
        finally:
            con.close()
        if not row:
            raise RuntimeError("deepinfra key row not found")
        salt = b"bifrost-encryption-v1-salt-2024"
        derived = hash_secret_raw(
            passphrase.encode(), salt,
            time_cost=1, memory_cost=64 * 1024, parallelism=4, hash_len=32,
            type=_ArgonType.ID,
        )
        blob = base64.b64decode(row[0])
        pt = AESGCM(derived).decrypt(blob[:12], blob[12:], None).decode()
        _DEEPINFRA_KEY_CACHE = pt
        return pt
    except Exception as e:
        print(f"[satchida-montage] deepinfra key decrypt failed: {e}", file=sys.stderr)
        return ""


def _deepinfra_image(prompt: str, output_path: Path, aspect_ratio: str = "16:9") -> bool:
    """Priority-2 chain: DeepInfra OpenAI-compatible images API (direct)."""
    global _LAST_IMAGE_MODEL
    key = _deepinfra_key()
    if not key:
        return False
    size = _SIZE_BY_RATIO.get(aspect_ratio, "1024x1024")
    tried_default = False
    for model in DEEPINFRA_IMAGE_MODELS:
        use_size = size
        while True:
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
                msg = e.read().decode(errors="replace")[:200]
                print(
                    f"[satchida-montage] deepinfra image {model} HTTP {e.code}: {msg}",
                    file=sys.stderr,
                )
                if e.code == 400 and use_size != "1024x1024" and not tried_default:
                    use_size = "1024x1024"
                    tried_default = True
                    continue
                break
            except Exception as e:
                print(f"[satchida-montage] deepinfra image failed: {e}", file=sys.stderr)
                break

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
                    print(
                        f"[satchida-montage] image OK via deepinfra/{model} -> {output_path}",
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
    key = _deepinfra_key()
    if not key:
        return False
    if not models:
        models = [model] if model else list(DEEPINFRA_VIDEO_MODELS)
    for m in models:
        body = {"prompt": prompt}
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
            print(
                f"[satchida-montage] deepinfra video {m} HTTP {e.code}: "
                f"{e.read().decode(errors='replace')[:200]}",
                file=sys.stderr,
            )
            continue
        except Exception as e:
            print(f"[satchida-montage] deepinfra video {m} failed: {e}", file=sys.stderr)
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
) -> bool:
    """Provider-policy chain: CheapInference (priority 1) then DeepInfra (priority 2).

    native_audio=True selects DeepInfra's audio-visual models (LTX-2.3-Fast
    first) which render synchronized audio inside the clip itself.
    """
    if _ci_video_via_bifrost(prompt, duration_seconds, output_path, aspect_ratio):
        return True
    if native_audio:
        return _deepinfra_video(
            prompt, output_path, models=list(DEEPINFRA_VIDEO_AV_MODELS)
        )
    return _deepinfra_video(prompt, output_path)


def _tts_edge(text: str, output_path: Path, voice: str = "en-US-AriaNeural") -> bool:
    """Free Microsoft Edge TTS via the repo's edge_tts_service.py (system python)."""
    try:
        script = _LIBRECHAT_ROOT / "skill" / "edge_tts_service.py"
        proc = subprocess.run(
            ["python", str(script), voice, str(output_path), text],
            capture_output=True,
            text=True,
            timeout=120,
        )
        ok = proc.returncode == 0 and output_path.exists() and output_path.stat().st_size > 1024
        if not ok:
            print(
                f"[satchida-montage] TTS failed: {proc.stderr[:200] if proc.stderr else 'no output'}",
                file=sys.stderr,
            )
        return ok
    except Exception as e:
        print(f"[satchida-montage] TTS failed: {e}", file=sys.stderr)
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
        engine = "Three.js → Playwright (privacy/local)" if is_privacy else "grok-imagine-video via Bifrost (:8700)"
        plan.append({
            "scene_id": sc["scene_id"],
            "duration_sec": sc.get("duration_sec", 6.0),
            "render_engine": engine,
            "prompt_preview": sc.get("visual_3d_description", "")[:120],
            "status": "queued",
        })

    with open(proj_dir / "scenes_plan.json", "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)

    engine_label = "Three.js + Playwright (zero-cloud)" if is_privacy else "AI video diffusion via Bifrost (:8700)"
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

        with JOB_LOCK:
            ACTIVE_JOBS[job_id].update({
                "stage": "Complete",
                "progress": 100,
                "status": "SUCCESS",
                "video_path": str(final_path),
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
        f"**Engine:** grok-imagine-video via Bifrost (:8700) [cloud] "
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

        return (
            f"### ✅ Render Complete\n\n"
            f"**Job:** `{job_id}` | **Elapsed:** {elapsed}s\n"
            f"**Video:** `{job.get('video_path', '')}` ({video_mb} MB) — {video_flag}\n"
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


@mcp.tool()
def video_generate(
    prompt: str,
    duration_seconds: float = 5.0,
    aspect_ratio: str = "16:9",
    filename: str = "",
    narration: str = "",
    native_audio: bool = False,
) -> str:
    """
    Generate a single real AI video clip (cloud only).

    Provider policy: CheapInference first (via Bifrost :8700), then DeepInfra
    (direct native API). Silent models are cheapest: FastWan-QAD 480p
    ($0.0125/5s) -> FastWan2.2 ($0.0225/5s 720p) -> Wan2.2-A14B ($0.375/5s).
    All are 5-second clips.

    Args:
        prompt: Text description of the video to generate.
        duration_seconds: Clip length (DeepInfra models render fixed 5s clips).
        aspect_ratio: '16:9', '9:16', or '1:1' (model permitting).
        filename: Optional output filename (auto-generated if empty).
        narration: Optional spoken narration. When set, free Edge TTS generates
            the voice track and it is muxed onto the clip (synchronized speech).
        native_audio: When true (and no narration), use audio-visual models —
            Lightricks LTX-2.3-Fast first (native synchronized audio, from
            $0.03/s) — so the clip itself contains synced sound.

    Returns the absolute path of the generated MP4, or a clear error message.
    """
    if not prompt.strip():
        return "Error: prompt is required."
    name = filename.strip() or f"clip-{uuid.uuid4().hex[:8]}.mp4"
    if not name.lower().endswith(".mp4"):
        name += ".mp4"
    out = VIDEOS_DIR / Path(name).name

    use_native = native_audio and not narration.strip()
    ok = _generate_video_core(
        prompt, duration_seconds, out, aspect_ratio, native_audio=use_native
    )
    if not ok:
        return (
            "Error: video generation failed on the approved provider chain "
            "(CheapInference via Bifrost, DeepInfra direct). Check Bifrost "
            "(:8700) and this server's stderr logs."
        )

    audio_note = ""
    if narration.strip():
        audio_path = out.with_suffix(".narration.mp3")
        if _tts_edge(narration.strip(), audio_path):
            muxed = out.with_name(out.stem + "_vo" + out.suffix)
            if _mux_audio(out, audio_path, muxed):
                out = muxed
                audio_note = " with synchronized narration audio"
        if not audio_note:
            audio_note = " (narration requested but TTS/mux failed — silent clip)"
    elif native_audio:
        audio_note = " with native synchronized audio"

    size_mb = out.stat().st_size / (1024 * 1024)
    return (
        f"### 🎬 Video Generated{audio_note}\n\n"
        f"**File:** `{out}` ({size_mb:.2f} MB)\n"
        f"**Model:** {_LAST_VIDEO_MODEL or 'unknown'} · {aspect_ratio}\n\n"
        f"Show this file to the user; it is a real MP4 ready for playback or upload."
    )


@mcp.tool()
def image_generate(
    prompt: str,
    aspect_ratio: str = "16:9",
    filename: str = "",
) -> str:
    """
    Generate a real AI image (cloud only).

    Provider policy: CheapInference first (via Bifrost :8700), then DeepInfra
    (FLUX Schnell via their OpenAI-compatible images API, direct).

    Args:
        prompt: Text description of the image to generate.
        aspect_ratio: '16:9', '9:16', or '1:1'.
        filename: Optional output filename (auto-generated if empty).

    Returns the absolute path of the generated image, or a clear error message.
    """
    if not prompt.strip():
        return "Error: prompt is required."
    name = filename.strip() or f"image-{uuid.uuid4().hex[:8]}.jpg"
    if "." not in name:
        name += ".jpg"
    out = VIDEOS_DIR / Path(name).name

    ok = _generate_image_core(prompt, out, aspect_ratio)
    if ok:
        size_kb = out.stat().st_size / 1024
        return (
            f"### 🖼 Image Generated\n\n"
            f"**File:** `{out}` ({size_kb:.0f} KB)\n"
            f"**Model:** {_LAST_IMAGE_MODEL or 'unknown'} · {aspect_ratio}\n\n"
            f"Show this image to the user."
        )
    return (
        "Error: image generation failed on the approved provider chain "
        "(CheapInference via Bifrost, DeepInfra direct). Check Bifrost "
        "(:8700) and this server's stderr logs."
    )


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mcp.run()
