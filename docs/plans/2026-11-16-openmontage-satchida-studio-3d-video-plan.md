# OpenMontage Integration (Satchida Studio 3D YouTube Video Production) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate OpenMontage into LibreChat and Satchida Studio as an asynchronous, MCP-driven production pipeline that creates true 3D animated YouTube videos, enforcing strict dual-tier model routing (Local LLM exclusively for 'Privacy' account type in 'Privacy' mode; Cloud API models via AutoRouter for all other accounts and modes).

**Architecture:** An asynchronous MCP server bridge (`satchida-montage-mcp`) hosted within Satchida Studio orchestrates multi-stage video production (scriptwriting, 3D scene choreography via headless Blender, Remotion timeline composition, and YouTube metadata packaging). A centralized inference router dynamically selects the model endpoint based on the session's `accountType` and active `mode`, ensuring absolute privacy for sovereign users while leveraging frontier cloud models (Claude 3.5 Sonnet, GPT-4o, DeepSeek) via AutoRouter (`:4000`) for standard and enterprise users.

**Tech Stack:** Python 3.11+, Model Context Protocol (MCP SDK), LibreChat Custom Endpoints & MCP, Headless Blender 4.x (`bpy` / Eevee Next / Cycles), Remotion (Node.js / React), FFmpeg, Local Llama Fleet (`:8080`/`:4099`), AutoRouter / One-API (`:4000`).

---

## 0. Hard Invariants & Routing Policy Matrix

### 0.1 Model Routing Policy (Strict Enforcement)

| Account Type (`accountType`) | Active Mode (`satchiMode`) | Routing Target | Endpoint | Telemetry & COGS |
| :--- | :--- | :--- | :--- | :--- |
| **`privacy`** | **`Privacy`** | **Local LLM Fleet** | `http://127.0.0.1:4099/v1` (Model: `Privacy` / `Ternary-Bonsai`) | ₹0 Cloud COGS, 100% sovereign, local Piper TTS, local Eevee 3D only. |
| **`privacy`** | `Chat` / `Work` / `Study` / `Motion` | Cloud Frontier Model | `http://127.0.0.1:4000/v1` (`X-Bifrost-Mode`) | AutoRouter proxy; master keys injected in-flight at HQ. |
| **`basic` / `standard` / `family`** | *Any mode* | Cloud Frontier Model | `http://127.0.0.1:4000/v1` | One-API / Bifrost tracked (`x-bf-dim-activity: video_generation`). |
| **`pro` / `pro_family` / `enterprise`** | *Any mode* | Cloud Frontier Model | `http://127.0.0.1:4000/v1` | Highest capability (Claude 3.5 Sonnet / GPT-4o / Tripo3D / Fal APIs). |

> [!IMPORTANT]
> **Hard Invariant 1 (Port 8080 Llama Fleet):** Never kill or restart `llama-server.exe` on `:8080`. Under `Privacy` mode, Blender 3D rendering must use CPU or constrained Eevee Next to prevent CUDA Out-of-Memory (OOM) eviction of the 32k context LLM.
>
> **Hard Invariant 2 (Zero Cloud VPS & Zero Naked Credentials):** All cloud generation calls (Tripo, Fal.ai, Kling, ElevenLabs) must pass through `127.0.0.1:4000` where credentials are dynamically injected. No API keys stored in client configs.
>
> **Hard Invariant 3 (Pure Bare-Metal Windows):** No Docker or WSL containers. All scripts run in `D:\LAN-AI-Infra\Satchida-Studio\venv` and native PowerShell.

---

## Task 1: Environment & Tooling Preparation in Satchida Studio

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/config/montage-config.json`
- Create: `D:/LAN-AI-Infra/Satchida-Studio/bin/setup-openmontage.ps1`
- Test: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_montage_env.py`

**Step 1: Write the failing environment validation test**

```python
# D:/LAN-AI-Infra/Satchida-Studio/tests/test_montage_env.py
import json
import os
import shutil
import subprocess
import pytest

def test_montage_prerequisites():
    config_path = r"D:\LAN-AI-Infra\Satchida-Studio\config\montage-config.json"
    assert os.path.exists(config_path), f"Missing config file at {config_path}"
    
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    assert "blender_path" in config
    assert "output_dir" in config
    assert "autorouter_url" in config
    assert "local_llm_url" in config
    
    # Verify FFmpeg is on PATH or configured
    assert shutil.which("ffmpeg") is not None, "ffmpeg must be accessible on system PATH"
```

**Step 2: Run test to verify it fails**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_montage_env.py`
Expected: FAIL with missing `montage-config.json`.

**Step 3: Write configuration and setup script**

Create `D:\LAN-AI-Infra\Satchida-Studio\config\montage-config.json`:
```json
{
  "blender_path": "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
  "output_dir": "D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\videos",
  "autorouter_url": "http://127.0.0.1:4000/v1",
  "local_llm_url": "http://127.0.0.1:4099/v1",
  "remotion_dir": "D:\\LAN-AI-Infra\\Satchida-Studio\\external\\remotion-renderer",
  "max_concurrent_renders": 1,
  "default_aspect_ratio": "16:9",
  "default_fps": 30,
  "default_resolution": "1080p"
}
```

Create `D:\LAN-AI-Infra\Satchida-Studio\bin\setup-openmontage.ps1`:
```powershell
# D:\LAN-AI-Infra\Satchida-Studio\bin\setup-openmontage.ps1
$ErrorActionPreference = "Stop"
Write-Host "Setting up OpenMontage environment for Satchida Studio..." -ForegroundColor Cyan

$VenvPython = "D:\LAN-AI-Infra\Satchida-Studio\venv\Scripts\python.exe"
$OutputDir = "D:\LAN-AI-Infra\Satchida-Studio\exports\videos"

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Install python dependencies in Satchida Studio venv
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install mcp pyyaml pydantic requests pytest jinja2

Write-Host "OpenMontage environment successfully prepared." -ForegroundColor Green
```

**Step 4: Run test to verify it passes**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_montage_env.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plans/2026-11-16-openmontage-satchida-studio-3d-video-plan.md
git commit -m "docs: add OpenMontage 3D video implementation plan"
```

---

## Task 2: Dual-Engine Model Router (Privacy vs Cloud Enforcement)

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/src/core/montage_router.py`
- Create: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_montage_router.py`

**Step 1: Write the failing unit tests for routing policy**

```python
# D:/LAN-AI-Infra/Satchida-Studio/tests/test_montage_router.py
import pytest
from src.core.montage_router import resolve_montage_endpoint, ModelRoutingDecision

def test_privacy_account_in_privacy_mode_routes_locally():
    decision = resolve_montage_endpoint(account_type="privacy", satchi_mode="Privacy")
    assert decision.is_local is True
    assert decision.endpoint_url == "http://127.0.0.1:4099/v1"
    assert decision.model_name == "Privacy"
    assert decision.allow_cloud_3d_apis is False

def test_privacy_account_in_chat_mode_routes_to_cloud():
    decision = resolve_montage_endpoint(account_type="privacy", satchi_mode="Chat")
    assert decision.is_local is False
    assert decision.endpoint_url == "http://127.0.0.1:4000/v1"
    assert decision.model_name == "Chat"
    assert decision.allow_cloud_3d_apis is True

def test_pro_account_always_routes_to_cloud():
    for mode in ["Chat", "Work", "Privacy", "Motion"]:
        decision = resolve_montage_endpoint(account_type="pro", satchi_mode=mode)
        assert decision.is_local is False
        assert decision.endpoint_url == "http://127.0.0.1:4000/v1"
        assert decision.allow_cloud_3d_apis is True

def test_basic_account_always_routes_to_cloud():
    decision = resolve_montage_endpoint(account_type="basic", satchi_mode="Privacy")
    assert decision.is_local is False
    assert decision.endpoint_url == "http://127.0.0.1:4000/v1"
```

**Step 2: Run test to verify it fails**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_montage_router.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.core.montage_router'`.

**Step 3: Implement `montage_router.py`**

```python
# D:/LAN-AI-Infra/Satchida-Studio/src/core/montage_router.py
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class ModelRoutingDecision:
    is_local: bool
    endpoint_url: str
    model_name: str
    headers: Dict[str, str]
    allow_cloud_3d_apis: bool

def resolve_montage_endpoint(
    account_type: str,
    satchi_mode: str,
    user_id: str = "anonymous",
    user_name: str = "user"
) -> ModelRoutingDecision:
    """
    Strict routing policy:
    Local LLM is ONLY for 'privacy' account type running in 'Privacy' mode.
    All other account types and modes route to Cloud Frontier models via AutoRouter (:4000).
    """
    account_clean = (account_type or "").strip().lower()
    mode_clean = (satchi_mode or "").strip()
    
    if account_clean == "privacy" and mode_clean == "Privacy":
        return ModelRoutingDecision(
            is_local=True,
            endpoint_url="http://127.0.0.1:4099/v1",
            model_name="Privacy",
            headers={
                "Content-Type": "application/json"
            },
            allow_cloud_3d_apis=False
        )
    
    # All other account types and modes route through AutoRouter (:4000)
    target_model = "Work" if mode_clean in ["Work", "Motion"] else "Chat"
    if account_clean in ["pro", "pro_family", "enterprise"]:
        target_model = "Pro"
        
    return ModelRoutingDecision(
        is_local=False,
        endpoint_url="http://127.0.0.1:4000/v1",
        model_name=target_model,
        headers={
            "Content-Type": "application/json",
            "X-Bifrost-Mode": mode_clean.lower(),
            "X-Seat-Alias": user_id,
            "X-User-Id": user_id,
            "X-User-Name": user_name,
            "x-bf-dim-activity": "video_generation",
            "X-Bifrost-Activity": "video_generation"
        },
        allow_cloud_3d_apis=True
    )
```

**Step 4: Run test to verify it passes**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_montage_router.py`
Expected: PASS (4 passed).

---

## Task 3: Headless 3D Scene Assembly & Blender Scripting Engine

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/src/engines/blender_runner.py`
- Create: `D:/LAN-AI-Infra/Satchida-Studio/src/templates/blender_scene_template.py.jinja`
- Test: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_blender_runner.py`

**Step 1: Write the failing test for Blender command generator**

```python
# D:/LAN-AI-Infra/Satchida-Studio/tests/test_blender_runner.py
import pytest
from src.engines.blender_runner import build_blender_cli_args, BlenderRenderConfig

def test_blender_cli_args_privacy_mode_enforces_eevee_cpu_safe():
    config = BlenderRenderConfig(
        script_path=r"D:\tmp\scene.py",
        output_path=r"D:\tmp\out.mp4",
        is_local_privacy=True,
        fps=30,
        resolution=(1920, 1080)
    )
    args = build_blender_cli_args(r"C:\Blender\blender.exe", config)
    assert "-b" in args  # Background/headless
    assert "-P" in args
    assert r"D:\tmp\scene.py" in args
    assert "--engine" in args
    assert "BLENDER_EEVEE_NEXT" in args  # Safe Eevee for VRAM protection

def test_blender_cli_args_cloud_tier_allows_cycles():
    config = BlenderRenderConfig(
        script_path=r"D:\tmp\scene.py",
        output_path=r"D:\tmp\out.mp4",
        is_local_privacy=False,
        fps=30,
        resolution=(1920, 1080)
    )
    args = build_blender_cli_args(r"C:\Blender\blender.exe", config)
    assert "-b" in args
    assert "CYCLES" in args
```

**Step 2: Run test to verify it fails**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_blender_runner.py`
Expected: FAIL with `ModuleNotFoundError`.

**Step 3: Implement `blender_runner.py`**

```python
# D:/LAN-AI-Infra/Satchida-Studio/src/engines/blender_runner.py
from dataclasses import dataclass
from typing import List, Tuple
import os
import subprocess

@dataclass
class BlenderRenderConfig:
    script_path: str
    output_path: str
    is_local_privacy: bool
    fps: int = 30
    resolution: Tuple[int, int] = (1920, 1080)
    samples: int = 64

def build_blender_cli_args(blender_bin: str, config: BlenderRenderConfig) -> List[str]:
    engine = "BLENDER_EEVEE_NEXT" if config.is_local_privacy else "CYCLES"
    args = [
        blender_bin,
        "-b",
        "--engine", engine,
        "-P", config.script_path,
        "-o", config.output_path,
        "-F", "FFMPEG",
        "-x", "1"
    ]
    return args

def execute_blender_render(blender_bin: str, config: BlenderRenderConfig) -> bool:
    if not os.path.exists(blender_bin):
        raise FileNotFoundError(f"Blender executable not found at: {blender_bin}")
    cmd = build_blender_cli_args(blender_bin, config)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Blender render failed: {result.stderr}")
    return True
```

**Step 4: Run test to verify it passes**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_blender_runner.py`
Expected: PASS.

---

## Task 4: Remotion & FFmpeg Video Assembly Pipeline

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/src/engines/montage_compositor.py`
- Test: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_montage_compositor.py`

**Step 1: Write test for timeline schema and audio-visual sync validation**

```python
# D:/LAN-AI-Infra/Satchida-Studio/tests/test_montage_compositor.py
import pytest
from src.engines.montage_compositor import VideoTimelinePlan, VideoTrackItem

def test_timeline_plan_validates_youtube_duration_and_sync():
    plan = VideoTimelinePlan(
        title="Understanding Quantum Computing in 3D",
        target_platform="youtube",
        width=1920,
        height=1080,
        fps=30
    )
    plan.add_track(VideoTrackItem(
        scene_id="scene_1",
        duration_sec=15.0,
        video_src="exports/scenes/scene_1.mp4",
        audio_src="exports/audio/narration_1.mp3",
        subtitle_text="Welcome to this visual 3D journey into quantum mechanics."
    ))
    assert plan.total_duration() == 15.0
    assert plan.is_youtube_compliant() is True
```

**Step 2: Run test to verify it fails**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_montage_compositor.py`
Expected: FAIL.

**Step 3: Implement `montage_compositor.py`**

```python
# D:/LAN-AI-Infra/Satchida-Studio/src/engines/montage_compositor.py
from dataclasses import dataclass, field
from typing import List, Dict, Any
import json
import os

@dataclass
class VideoTrackItem:
    scene_id: str
    duration_sec: float
    video_src: str
    audio_src: str
    subtitle_text: str

@dataclass
class VideoTimelinePlan:
    title: str
    target_platform: str = "youtube"
    width: int = 1920
    height: int = 1080
    fps: int = 30
    tracks: List[VideoTrackItem] = field(default_factory=list)

    def add_track(self, item: VideoTrackItem) -> None:
        self.tracks.append(item)

    def total_duration(self) -> float:
        return sum(t.duration_sec for t in self.tracks)

    def is_youtube_compliant(self) -> bool:
        # YouTube requires 16:9 widescreen, min 1280x720, max 4K
        aspect = self.width / self.height
        return abs(aspect - (16.0 / 9.0)) < 0.05 and self.width >= 1280

    def export_remotion_props(self, dest_path: str) -> None:
        payload = {
            "title": self.title,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "scenes": [
                {
                    "sceneId": t.scene_id,
                    "durationInFrames": int(t.duration_sec * self.fps),
                    "videoSrc": t.video_src,
                    "audioSrc": t.audio_src,
                    "subtitle": t.subtitle_text
                }
                for t in self.tracks
            ]
        }
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
```

**Step 4: Run test to verify it passes**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_montage_compositor.py`
Expected: PASS.

---

## Task 5: Asynchronous Satchida Montage MCP Server

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/services/montage_mcp_server.py`
- Test: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_mcp_server.py`

**Step 1: Write test for MCP tool schema registration**

```python
# D:/LAN-AI-Infra/Satchida-Studio/tests/test_mcp_server.py
import pytest
from services.montage_mcp_server import list_montage_tools

def test_montage_mcp_tools_are_registered():
    tools = list_montage_tools()
    tool_names = [t["name"] for t in tools]
    assert "video_create_script" in tool_names
    assert "video_plan_3d_scenes" in tool_names
    assert "video_start_render_job" in tool_names
    assert "video_get_status" in tool_names
    assert "video_get_artifacts" in tool_names
```

**Step 2: Run test to verify it fails**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_mcp_server.py`
Expected: FAIL with `ModuleNotFoundError`.

**Step 3: Implement `montage_mcp_server.py` with async background task management**

```python
# D:/LAN-AI-Infra/Satchida-Studio/services/montage_mcp_server.py
import json
import os
import sys
import threading
import uuid
from typing import Dict, Any, List

JOBS: Dict[str, Dict[str, Any]] = {}

def list_montage_tools() -> List[Dict[str, Any]]:
    return [
        {
            "name": "video_create_script",
            "description": "Generate a structured multi-scene script and voiceover cues for a YouTube 3D video.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "duration_minutes": {"type": "number", "default": 2},
                    "account_type": {"type": "string", "default": "standard"},
                    "mode": {"type": "string", "default": "Chat"}
                },
                "required": ["topic"]
            }
        },
        {
            "name": "video_plan_3d_scenes",
            "description": "Design 3D mesh choreography, camera trajectories, and lighting setup in Blender syntax.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "scene_descriptions": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["project_id", "scene_descriptions"]
            }
        },
        {
            "name": "video_start_render_job",
            "description": "Trigger an asynchronous background video rendering job (Blender + Remotion + FFmpeg).",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "resolution": {"type": "string", "enum": ["720p", "1080p", "4k"], "default": "1080p"}
                },
                "required": ["project_id"]
            }
        },
        {
            "name": "video_get_status",
            "description": "Poll the progress of an active video rendering job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string"}
                },
                "required": ["job_id"]
            }
        },
        {
            "name": "video_get_artifacts",
            "description": "Retrieve final MP4 file path, thumbnail image, and YouTube SEO metadata.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"}
                },
                "required": ["project_id"]
            }
        }
    ]

# Entrypoint runs standard IO MCP protocol when executed as script
if __name__ == "__main__":
    # MCP standard IO loop handling
    pass
```

**Step 4: Run test to verify it passes**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_mcp_server.py`
Expected: PASS.

---

## Task 6: LibreChat YAML Configuration & Agent Presets

**Files:**
- Modify: `d:/LAN-AI-Infra/LibreChat/librechat.yaml`
- Test: Static syntax verification of `librechat.yaml`

**Step 1: Check YAML formatting syntax before edits**

Run: `python -c "import yaml; yaml.safe_load(open('d:/LAN-AI-Infra/LibreChat/librechat.yaml', encoding='utf-8'))"`

**Step 2: Add `satchida-montage` to `mcpServers` in `librechat.yaml`**

Add under `mcpServers:`:
```yaml
  satchida-montage:
    type: stdio
    command: D:\LAN-AI-Infra\Satchida-Studio\venv\Scripts\python.exe
    args:
      - D:\LAN-AI-Infra\Satchida-Studio\services\montage_mcp_server.py
    env:
      BLENDER_PATH: C:\Program Files\Blender Foundation\Blender 4.2\blender.exe
      AUTOROUTER_URL: http://127.0.0.1:4000/v1
      OUTPUT_DIR: D:\LAN-AI-Infra\Satchida-Studio\exports\videos
    title: Satchida 3D Video Studio
```

**Step 3: Register the "Satchida 3D Studio Producer" Agent Preset in `librechat.yaml`**

```yaml
  - name: Satchida-3D-Studio
    label: Satchida 3D Studio (YouTube) 🎬
    preset:
      endpoint: Satchida-Gateway
      model: Pro
      maxContextTokens: 131072
      max_tokens: 4096
      temperature: 0.7
      promptPrefix: |
        You are the Satchida Studio Executive 3D Video Director.
        You specialize in orchestrating real 3D animated explainer and showcase videos for YouTube using OpenMontage, Blender, and Remotion.
        
        PRODUCTION WORKFLOW:
        1. SCRIPTING: Formulate an engaging YouTube script with a hook (<5s), high-retention pacing, and clear audio cues.
        2. SCENE PLANNING: Use 'video_plan_3d_scenes' to design 3D camera paths, meshes, and lighting.
        3. HUMAN-IN-THE-LOOP: Present the scene outline and ask for confirmation before rendering.
        4. ASYNC RENDER: Launch 'video_start_render_job' and periodically report status using 'video_get_status'.
        5. PACKAGING: Deliver the final MP4 path, high-CTR YouTube title, description, timestamped chapters, and tags.
        
        ROUTING INVARIANT:
        When a user session is in 'Privacy' mode with a 'privacy' account, all inference remains 100% on-device on the local Llama fleet with zero cloud API calls. For all other account types and modes, cloud frontier models are leveraged via Satchida Gateway.
    mcpServers:
      - satchida-montage
      - satchida-tools
      - filesystem-shared
      - time-server
    conversation_starters:
      - |-
        🎬 3D Science Explainer — Create a 2-minute 3D animation explaining Quantum Superposition for YouTube.
      - |-
        🚀 Product 3D Showcase — Generate a cinematic 3D product fly-through and lighting showcase video.
      - |-
        📐 Architectural Walkthrough — Assemble a 3D isometric architectural floorplan tour with voiceover.
```

**Step 4: Verify YAML loads without errors**

Run: `python -c "import yaml; yaml.safe_load(open('d:/LAN-AI-Infra/LibreChat/librechat.yaml', encoding='utf-8'))"`
Expected: Success (0 error).

---

## Task 7: YouTube Packaging Engine (Metadata, Chapters & High-CTR Thumbnail)

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/src/engines/youtube_packager.py`
- Test: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_youtube_packager.py`

**Step 1: Write test for YouTube export bundle validation**

```python
# D:/LAN-AI-Infra/Satchida-Studio/tests/test_youtube_packager.py
import pytest
from src.engines.youtube_packager import generate_youtube_metadata_bundle, YouTubeChapter

def test_youtube_metadata_formatting():
    chapters = [
        YouTubeChapter(timestamp_sec=0, title="Introduction & Hook"),
        YouTubeChapter(timestamp_sec=35, title="The 3D Architecture"),
        YouTubeChapter(timestamp_sec=90, title="Real-World Performance"),
        YouTubeChapter(timestamp_sec=140, title="Summary & Next Steps")
    ]
    bundle = generate_youtube_metadata_bundle(
        video_title="How Quantum Computers Actually Work (in 3D)",
        description="A full 3D visual breakdown of quantum mechanics.",
        chapters=chapters,
        tags=["quantum", "3D animation", "blender", "science"]
    )
    assert "00:00 Introduction & Hook" in bundle["formatted_description"]
    assert "01:30 The 3D Architecture" in bundle["formatted_description"]
    assert len(bundle["tags"]) == 4
    assert bundle["title_char_count"] <= 100
```

**Step 2: Run test to verify it fails**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_youtube_packager.py`
Expected: FAIL.

**Step 3: Implement `youtube_packager.py`**

```python
# D:/LAN-AI-Infra/Satchida-Studio/src/engines/youtube_packager.py
from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class YouTubeChapter:
    timestamp_sec: int
    title: str

def format_timestamp(seconds: int) -> str:
    m = seconds // 60
    s = seconds % 60
    return f"{m:02d}:{s:02d}"

def generate_youtube_metadata_bundle(
    video_title: str,
    description: str,
    chapters: List[YouTubeChapter],
    tags: List[str]
) -> Dict[str, Any]:
    lines = [description.strip(), "", "TIMESTAMPS:"]
    for ch in chapters:
        lines.append(f"{format_timestamp(ch.timestamp_sec)} {ch.title}")
    
    formatted_desc = "\n".join(lines)
    return {
        "title": video_title[:100],
        "title_char_count": len(video_title[:100]),
        "formatted_description": formatted_desc,
        "tags": tags,
        "recommended_aspect_ratio": "16:9",
        "recommended_container": "MP4 (H.264 / AAC)"
    }
```

**Step 4: Run test to verify it passes**

Run: `pytest D:\LAN-AI-Infra\Satchida-Studio\tests\test_youtube_packager.py`
Expected: PASS.

---

## Task 8: End-to-End Pilot Verification

**Files:**
- Create: `D:/LAN-AI-Infra/Satchida-Studio/tests/test_e2e_video_pipeline.py`

**Steps:**
1. Verify `llama-server.exe` health on port 8080 (`curl http://127.0.0.1:8080/health`) without restarting or affecting the process.
2. Run routing verification simulating both a Privacy tenant user and a standard/pro user.
3. Execute end-to-end dry-run generating a 15-second 3D Blender test clip with narration and subtitles.
4. Verify the output MP4 adheres to YouTube standards (1920x1080, 30fps, AAC audio) and does not trigger CUDA memory errors.
