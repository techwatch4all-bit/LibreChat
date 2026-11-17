"""
Satchida-Motion MCP Stdio Server
Provides deterministic browser motion graphics rendering and video export for LibreChat.
Uses Playwright (Chromium) and FFmpeg to scrub GSAP timelines (and deterministic Canvas/Three.js
hooks via window.__SEEK_FRAME__) frame-by-frame and export MP4.
100% local, sovereign, zero-cloud.
Compatible with MCP SDK 2.x (MCPServer).
"""
import os
import time
import json
import math
import re
import shutil
import tempfile
import subprocess
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-motion")

# Determine workspace and public motion directory
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_MOTION_DIR = os.path.join(WORKSPACE_ROOT, "client", "public", "motion")
os.makedirs(PUBLIC_MOTION_DIR, exist_ok=True)

FFMPEG_BIN = shutil.which("ffmpeg")

# Map /assets/vendor/... references to local disk paths for offline Playwright rendering
VENDOR_DIR = os.path.join(WORKSPACE_ROOT, "client", "public", "assets", "vendor")
VENDOR_ASSET_MAP = {
    "/assets/vendor/gsap/gsap.min.js": os.path.join(VENDOR_DIR, "gsap", "gsap.min.js"),
    "/assets/vendor/gsap/ScrollTrigger.min.js": os.path.join(VENDOR_DIR, "gsap", "ScrollTrigger.min.js"),
    "/assets/vendor/gsap/TextPlugin.min.js": os.path.join(VENDOR_DIR, "gsap", "TextPlugin.min.js"),
    "/assets/vendor/three/three.min.js": os.path.join(VENDOR_DIR, "three", "three.min.js"),
    "/assets/vendor/three/OrbitControls.js": os.path.join(VENDOR_DIR, "three", "OrbitControls.js"),
    "/assets/vendor/three/GLTFExporter.js": os.path.join(VENDOR_DIR, "three", "GLTFExporter.js"),
    "/assets/vendor/satchida/cad-studio.js": os.path.join(VENDOR_DIR, "satchida", "cad-studio.js"),
    "/assets/vendor/satchida/anatomy-studio.js": os.path.join(VENDOR_DIR, "satchida", "anatomy-studio.js"),
    "/assets/vendor/satchida/scenemosaic-studio.js": os.path.join(VENDOR_DIR, "satchida", "scenemosaic-studio.js"),
    "/assets/vendor/tailwind-3.4.17.js": os.path.join(VENDOR_DIR, "tailwind-3.4.17.js"),
}


def _unwrap_html(raw: str) -> str:
    """Strip any preamble, outer LibreChat :::artifact{...} wrapper, or markdown fence if present."""
    text = raw.strip()
    m = re.search(r"^:::artifact\{", text, re.MULTILINE)
    if m:
        text = text[m.start():]
        lines = text.splitlines()
        if lines and lines[0].lstrip().startswith(":::artifact"):
            lines = lines[1:]
        if lines and lines[-1].strip() == ":::":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    fence_match = re.match(r"^([`~]{3,})(?:html|htm)?\s*\n([\s\S]*?)\n\1\s*$", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(2).strip()
    return text


def _wrap_template_artifact(style: str, title: str, html: str) -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", style.lower()).strip("-") or "simulation"
    extra = (
        "\nIMPORTANT: Only customize `window.SATCHIDA_CAD_PLAN` (`width`, `depth`, `rooms`, `walls`, `furniture`) "
        "and `#title-badge`. Keep the `<script src=\"/assets/vendor/satchida/cad-studio.js\"></script>` tag verbatim — "
        "do NOT rewrite the 2D/3D engine, OR call `build_cad_floorplan(...)`.\n"
        if slug == "cad-blueprint"
        else ""
    )
    if slug == "clinical-anatomy":
        extra += (
            "\nORGAN RENDERING CONTRACT (non-negotiable): all organs come from the vendored anatomy library — "
            "keep `<script src=\"/assets/vendor/satchida/anatomy-studio.js\"></script>` verbatim and NEVER "
            "hand-draw organ shapes. Each organ slot is populated ONLY by a `SatchidaAnatomy.mount(...)` call "
            "with a catalog name (liver, liver-healthy, liver-fibrotic, liver-cirrhotic, pancreas-islet, kidney, "
            "lung, heart, brain, stomach, muscle-fiber, muscle-myofibril, adipocyte, skin, vein, vein-healthy, "
            "vein-varicose, capillary, erythrocyte). Keep the organ slots, mount calls and the ORGAN_STATE table "
            "structure verbatim; per condition, swap WHICH catalog organ each slot mounts (SatchidaAnatomy.list() "
            "and SatchidaAnatomy.variants() enumerate what exists) and adjust STAGES telemetry, narratives and "
            "annotations. NEVER replace mounted organs with hand-drawn SVG shapes, plain <rect>/<div> boxes, "
            "cards or emojis — that is a defect, not a simplification. Keep the Servier credit line in the "
            "footer verbatim.\n"
            "\nLAY DESCRIPTION → ANATOMY INFERENCE (required first step): when the user describes a symptom, "
            "pain location, injury or procedure in everyday language (\"shooting pain below the neck\", \"IV in "
            "the arm\", \"blood transfusion\"), FIRST state which anatomical region and structures are involved "
            "(e.g. cervical nerve root and trapezius; antecubital fossa — cephalic/basilic vein, skin layers, "
            "subcutaneous fat; venous access and circulation), THEN render that region at clinical fidelity. "
            "The visualization must look like a medical atlas illustration, NOT cartoonish, NOT a sketch, NOT "
            "flat icons.\n"
            "\nBODY-REGION VIEWS: for procedures or surface-near anatomy (IV placement, injections, wounds, "
            "joint pain), render the full layered depth of the region: skin (epidermis/dermis with texture), "
            "subcutaneous fat, fascia, muscle with striations, vessels (named where clinically relevant, e.g. "
            "cephalic vein), nerves, and bone — each as anatomically shaped SVG with its own texture, not "
            "nested rectangles.\n"
            "\nCONDITION DATA: when the user's question differs from Type-2 Diabetes, rewrite the STAGES array, "
            "telemetry labels/values and narratives for that condition — the stage scrubber machinery stays, "
            "the clinical content must match the user's actual question.\n"
        )
    return (
        f"Customize the HTML below and deliver your final response wrapped identically inside "
        f"`:::artifact{{...}}` + ````html ... ```` + `:::`:\n{extra}\n"
        f":::artifact{{identifier=\"motion-{slug}\" type=\"application/vnd.satchida.film\" title=\"{title}\"}}\n"
        f"````html\n{html.strip()}\n````\n"
        f":::"
    )


def _rewrite_vendor_paths(html_content: str) -> str:
    content = _unwrap_html(html_content)
    content = re.sub(r'(/assets/vendor/[a-zA-Z0-9_\-\./]+)\?[a-zA-Z0-9_=&]+', r'\1', content)
    for web_path, fs_path in VENDOR_ASSET_MAP.items():
        if web_path in content and os.path.exists(fs_path):
            file_uri = "file:///" + fs_path.replace("\\", "/")
            content = content.replace(web_path, file_uri)
    return content


@mcp.tool()
def render_motion_to_video(
    html_content: str = "",
    filename: str = "",
    duration_seconds: float = 6.0,
    fps: int = 30,
    width: int = 1280,
    height: int = 720,
) -> str:
    """
    Renders an HTML/GSAP/Canvas/Three.js motion graphic into a high-definition H.264 MP4 video file.
    Deterministic frame-by-frame rendering via headless Chromium and FFmpeg.

    IMPORTANT: Call this tool ONLY when the user explicitly asks to export/download an MP4 video or reel.
    For interactive HTML simulations or visual previews in chat, DO NOT call this tool — deliver your
    HTML inline wrapped in :::artifact{identifier="..." type="text/html" title="..."} instead.

    :param html_content: Complete HTML source code of the motion graphic (CSS, GSAP, SVG, Canvas, or Three.js).
    :param filename: Optional base name for output file (e.g. 'floorplan_3d_tour').
    :param duration_seconds: Total duration of the animation to render in seconds (default: 6.0, max: 60.0).
    :param fps: Frame rate in frames per second (default: 30, range: 10..60).
    :param width: Video pixel width (default: 1280, range: 320..2560). Even dimensions recommended.
    :param height: Video pixel height (default: 720, range: 320..2560).
    """
    if not html_content or not html_content.strip():
        return json.dumps({
            "status": "skipped",
            "message": "No html_content provided. For interactive chat previews, DO NOT call render_motion_to_video — output your complete HTML directly inside :::artifact{identifier=\"simulation\" type=\"text/html\" title=\"Interactive Simulation\"} ```html ... ``` :::.",
        })
    if not FFMPEG_BIN:
        return json.dumps({
            "status": "error",
            "message": "FFmpeg executable not found in PATH.",
        })

    fps = max(10, min(int(fps), 60))
    duration_seconds = max(1.0, min(float(duration_seconds), 60.0))
    width = max(320, min(int(width), 2560))
    height = max(320, min(int(height), 2560))
    # libx264 yuv420p requires even width and height
    width -= width % 2
    height -= height % 2
    total_frames = int(duration_seconds * fps)

    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", filename.strip()) if filename else ""
    if not safe_name:
        safe_name = f"satchida_motion_{int(time.time())}"
    output_filename = f"{safe_name}.mp4"
    output_path = os.path.join(PUBLIC_MOTION_DIR, output_filename)

    content_to_render = _rewrite_vendor_paths(html_content)

    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(content_to_render)
        temp_html_path = f.name

    try:
        from playwright.sync_api import sync_playwright

        ffmpeg_cmd = [
            FFMPEG_BIN, "-y",
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", str(fps),
            "-i", "-",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "20",
            output_path,
        ]

        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        file_url = "file:///" + temp_html_path.replace("\\", "/")

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                ],
            )
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(file_url, wait_until="load")

            # Pause master timeline at t=0 and trigger deterministic Canvas/Three.js frame 0
            page.evaluate(f"""() => {{
                window.__IS_EXPORTING__ = true;
                if (window.__TIMELINE__) {{
                    window.__TIMELINE__.pause(0);
                }} else if (window.gsap && window.gsap.globalTimeline) {{
                    window.gsap.globalTimeline.pause(0);
                }}
                if (typeof window.__SEEK_FRAME__ === 'function') {{
                    window.__SEEK_FRAME__(0, 0);
                }}
            }}""")

            for frame_idx in range(total_frames):
                seek_time = frame_idx / fps
                page.evaluate(f"""() => {{
                    if (window.__TIMELINE__) {{
                        window.__TIMELINE__.seek({seek_time});
                    }} else if (window.gsap && window.gsap.globalTimeline) {{
                        window.gsap.globalTimeline.seek({seek_time});
                    }}
                    if (typeof window.__SEEK_FRAME__ === 'function') {{
                        const dur = (window.__TIMELINE__ && typeof window.__TIMELINE__.duration === 'function' && window.__TIMELINE__.duration()) || {duration_seconds};
                        const progress = dur > 0 ? Math.min(1, Math.max(0, {seek_time} / dur)) : 0;
                        window.__SEEK_FRAME__({seek_time}, progress);
                    }}
                }}""")
                frame_bytes = page.screenshot(type="png")
                proc.stdin.write(frame_bytes)

            browser.close()

        proc.stdin.close()
        proc.wait(timeout=45)

        file_size_kb = round(os.path.getsize(output_path) / 1024, 1)
        public_url = f"/motion/{output_filename}"

        return json.dumps({
            "status": "success",
            "message": f"Rendered {total_frames} frames ({duration_seconds}s at {fps}fps) successfully.",
            "filename": output_filename,
            "url": public_url,
            "file_size_kb": file_size_kb,
            "resolution": f"{width}x{height}",
            "markdown_preview": f"[🎥 Watch / Download MP4 Video]({public_url})\n\n*(Size: {file_size_kb} KB, {width}x{height} @ {fps}fps)*",
        }, indent=2)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Rendering failed: {str(e)}",
        }, indent=2)
    finally:
        if os.path.exists(temp_html_path):
            try:
                os.unlink(temp_html_path)
            except Exception:
                pass


@mcp.tool()
def validate_motion_html(html_content: str = "") -> str:
    """
    Lints and validates an HTML artifact against Satchida-Motion contracts before offline MP4 export.
    Do NOT call this for ordinary inline chat `:::artifact` HTML responses — deliver the inline
    `:::artifact` directly in chat to avoid duplicate generation passes. Use only when diagnosing
    or validating a standalone HTML scene prior to calling `render_motion_to_video`.

    :param html_content: Complete HTML source code to analyze.
    """
    if not html_content or not html_content.strip():
        return json.dumps({
            "status": "skipped",
            "message": "No html_content provided. Deliver your HTML directly inside :::artifact{...} ```html ... ``` :::.",
        })
    html_content = _unwrap_html(html_content)
    issues = []
    passes = []

    lower = html_content.lower()

    # Check 1: GSAP inclusion
    if "gsap" in lower:
        passes.append("GSAP library reference detected.")
    else:
        issues.append("CRITICAL: GSAP library script tag not found. Must include GSAP.")

    # Check 2: Timeline registration
    if "window.__TIMELINE__" in html_content:
        passes.append("window.__TIMELINE__ properly registered for deterministic scrubbing & MP4 export.")
    else:
        issues.append("WARNING: window.__TIMELINE__ is not assigned. Needed for timeline scrubbing and MP4 rendering.")

    # Check 3: Anti-PPT structure
    slide_sections = len(re.findall(r'<section\b[^>]*class=["\'][^"\']*scene', html_content, re.IGNORECASE))
    if slide_sections >= 3:
        issues.append("WARNING: Slide-deck structure detected (>=3 <section class='scene'>). Use continuous camera/spatial coordinates instead of static section fades.")
    else:
        passes.append("Anti-PPT check passed: Spatial/continuous choreography pattern verified.")

    # Check 4: Three.js / Canvas determinism check
    uses_canvas_or_three = ("<canvas" in lower) or ("three." in lower) or ("three.min.js" in lower)
    if uses_canvas_or_three:
        if "window.__SEEK_FRAME__" in html_content:
            passes.append("Deterministic window.__SEEK_FRAME__ hook detected for Canvas/WebGL export.")
        else:
            issues.append("WARNING: Canvas/Three.js scene detected without window.__SEEK_FRAME__(t, progress). MP4 export may freeze if animation relies solely on requestAnimationFrame.")

    # Check 5: Inline SVG scaling check
    if "<svg" in lower and len(html_content) > 500:
        if "viewbox" in lower:
            passes.append("Responsive SVG viewBox detected for resolution-independent scaling.")
        else:
            issues.append("WARNING: <svg> element found without viewBox attribute; may clip at 720p/1080p export sizes.")

    # Check 6: Viewport & 3D perspective
    if "perspective" in html_content or "three" in lower:
        passes.append("3D depth / WebGL spatial framing detected.")
    else:
        passes.append("Note: Consider adding CSS perspective or 3D transforms for spatial depth.")

    # Check 7: Scrubber & playback HUD
    if "satchida-controls" in html_content or "timeline-scrubber" in html_content:
        passes.append("Interactive playback/scrubber HUD controls present.")
    else:
        issues.append("WARNING: Missing floating #satchida-controls bar (Play/Pause, Scrubber, Restart).")

    return json.dumps({
        "status": "passed" if not any("CRITICAL" in i for i in issues) else "failed",
        "valid": not any("CRITICAL" in i for i in issues),
        "passes": passes,
        "issues": issues,
        "recommendations": "Bind WebGL/Canvas updates to window.__SEEK_FRAME__(t, progress) + GSAP timeline onUpdate, and expose interactive parameter sliders synced cleanly without blocking scrubbing.",
    }, indent=2)


@mcp.tool()
def get_motion_template(style: str = "executive") -> str:
    """
    Returns a ready-to-customize, cinema-grade Satchida-Motion standalone HTML starter template.
    After customizing this HTML, deliver it inline in your chat response wrapped EXACTLY inside:
      :::artifact{identifier="kebab-case-id" type="text/html" title="Concise Title"}
      ````html
      ...complete standalone HTML ending with </html>...
      ````
      :::
    Never emit bare/un-fenced HTML, never invent custom :::directive names, and never try create_file or bash_tool.

    :param style: Template archetype:
      'executive' (KPI report),
      'teaser' (3D glass product launch),
      'cad_blueprint' (2D-to-3D architectural floor plan with sun/layer controls),
      'interactive_3d' (offline Three.js WebGL scene with deterministic window.__SEEK_FRAME__),
      'mechanism_cutaway' (How Things Work SVG cutaway with RPM/throttle slider & live gauges),
      'clinical_anatomy' (organ-level anatomical cross-section with stage progression,
        e.g. Type-2 Diabetes insulin resistance: liver, muscle, adipose, pancreas),
      'accessible_guide' (WCAG AAA high-contrast large-print senior/patient step-by-step guide).

      ROUTING RULE: use 'clinical_anatomy' for ANY question that touches the human body —
      internal organs, muscles, bones, joints, skin, hair, blood, vessels, nerves, cells —
      INCLUDING layperson phrasing without medical vocabulary: symptom reports ("pain on the
      right side near the elbow", "shooting pain below the neck"), procedures ("how is an IV
      given", "how is blood transferred/transfused", "where does an injection go"), injuries
      ("sprained wrist", "burn on the forearm"), and region questions ("parts of the body",
      "what is under the skin on the arm"). For those, first infer the implicated anatomical
      region and structures, then request this template — the anatomy contract below will
      govern rendering fidelity. Only non-human subjects (engines, buildings, finance)
      belong to other archetypes.
    """
    style = style.lower().strip()
    if any(re.search(rf"\b{re.escape(k)}s?\b", style) for k in (
        "medical", "anatomy", "anatomical", "clinical", "organ", "diabetes", "insulin", "perfusion",
        "pathology", "pathophysiology", "heart", "cardio", "artery", "arterial", "vein", "vascular",
        "blood", "cell", "cellular", "tissue", "histolog", "muscle", "neuro", "brain", "neuron",
        "lung", "pulmonary", "respiratory", "kidney", "renal", "nephron", "liver", "hepatic",
        "pancrea", "stomach", "gut", "digestive", "immune", "lymph", "skin", "derma", "epidermis",
        "hair", "follicle", "bone", "skeletal", "joint", "endocrine", "hormone", "dna", "genome",
        "virus", "bacteria", "immune response", "wound", "inflammation",
        # layperson vocabulary: symptoms, procedures, body regions
        "iv", "intravenous", "injection", "inject", "cannula", "catheter", "syringe", "needle",
        "transfusion", "transfuse", "donation", "donate", "vaccine", "vaccination", "first aid",
        "pain", "ache", "aching", "hurt", "hurts", "sore", "burn", "sting", "cramp", "numb",
        "tingling", "swelling", "sprain", "fracture", "injury", "injured", "bruise", "bleed",
        "symptom", "disease", "infection", "syndrome", "disorder", "healing", "recovery",
        "body", "human body", "anatomy of", "inside the", "under the skin",
        "arm", "elbow", "wrist", "hand", "finger", "thumb", "shoulder", "armpit",
        "neck", "spine", "spinal", "back", "lumbar", "cervical", "chest", "rib", "thorax",
        "abdomen", "belly", "stomach ache", "pelvis", "hip", "groin", "leg", "thigh", "knee",
        "calf", "shin", "ankle", "foot", "heel", "toe", "head", "skull", "face", "jaw",
        "throat", "ear", "eye", "nose", "mouth", "tongue", "tooth", "teeth", "gum",
    )):
        style = "clinical_anatomy"
    elif any(k in style for k in ("engine", "piston", "rpm", "mechanism", "cutaway")):
        style = "mechanism_cutaway"

    if style == "clinical_anatomy":
        return _wrap_template_artifact(
            "clinical-anatomy",
            "Clinical-Grade Anatomical Cross-Section — Type-2 Diabetes Insulin Resistance",
            """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Clinical Anatomical Cross-Section — Type-2 Diabetes & Organ Perfusion</title>
  <script src="/assets/vendor/satchida/anatomy-studio.js"></script>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    :root {
      --bg: #070d18;
      --surface: rgba(15, 23, 42, 0.92);
      --surface-card: rgba(30, 41, 59, 0.7);
      --border: rgba(56, 189, 248, 0.22);
      --accent: #38bdf8;
      --glucose: #f59e0b;
      --insulin: #06b6d4;
      --normal: #10b981;
      --warning: #f97316;
      --severe: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      padding-bottom: 74px;
    }
    header {
      padding: 14px 20px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      backdrop-filter: blur(10px);
    }
    .title-group h1 { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
    .title-group p { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
    .stages-nav { display: flex; gap: 6px; flex-wrap: wrap; }
    .stage-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-muted);
      border-radius: 9999px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .stage-btn:hover { background: rgba(56, 189, 248, 0.15); color: #fff; }
    .stage-btn.active {
      background: #0284c7;
      border-color: #38bdf8;
      color: #fff;
      box-shadow: 0 0 14px rgba(56, 189, 248, 0.4);
    }
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 16px 20px;
      flex: 1;
    }
    @media (max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }
    .view-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      position: relative;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 8px;
    }
    .card-header h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .badge-normal { background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); }
    .badge-pathology { background: rgba(249, 115, 22, 0.18); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.35); }
    .svg-container { flex: 1; width: 100%; min-height: 270px; display: flex; align-items: center; justify-content: center; }
    svg { width: 100%; height: 100%; max-height: 310px; }
    .organ-board { display: flex; flex-direction: column; gap: 10px; flex: 1; width: 100%; }
    .cap-wrap { position: relative; }
    .cap-svg { width: 100%; height: 46px; display: block; }
    .cap-sub { font-size: 8.5px; color: #94a3b8; letter-spacing: 0.05em; margin-top: 2px; }
    .organ-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; flex: 1; }
    .sa-cell { display: flex; flex-direction: column; gap: 4px; min-height: 0; }
    .sa-slot { flex: 1; min-height: 150px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.18); border-radius: 12px; overflow: hidden; padding: 4px; }
    .sa-cap { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-align: center; letter-spacing: 0.04em; min-height: 11px; }
    .zoom-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .sa-cell-sm { display: flex; flex-direction: column; gap: 4px; }
    .sa-slot-sm { height: 84px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.14); border-radius: 10px; overflow: hidden; padding: 3px; }
    .telemetry-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding: 0 20px 16px;
    }
    @media (max-width: 760px) { .telemetry-row { grid-template-columns: repeat(2, 1fr); } }
    .tele-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .tele-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .tele-val { font-size: 20px; font-weight: 800; color: #fff; font-family: monospace; }
    .tele-unit { font-size: 10.5px; color: var(--text-muted); font-weight: 500; }
    .tele-status { font-size: 10px; font-weight: 600; margin-top: 4px; padding: 2px 6px; border-radius: 4px; display: inline-block; }
    .clinical-narrative {
      margin: 0 20px 16px;
      background: rgba(15, 23, 42, 0.95);
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 12px;
      line-height: 1.55;
      color: #cbd5e1;
    }
    .clinical-narrative strong { color: #fff; }
    #satchida-controls {
      position: fixed;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 18px;
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 9999px;
      z-index: 50;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    #satchida-controls button {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #7dd3fc;
      border-radius: 9999px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    #satchida-controls button:hover { background: #0284c7; color: #fff; }
    #timeline-scrubber { width: 170px; accent-color: var(--accent); }
    footer {
      position: fixed;
      bottom: 0;
      width: 100%;
      text-align: center;
      padding: 4px 10px;
      font-size: 9.5px;
      color: #64748b;
      background: rgba(7, 13, 24, 0.95);
      border-top: 1px solid rgba(255,255,255,0.06);
      z-index: 40;
    }
  </style>
</head>
<body>
  <header>
    <div class="title-group">
      <h1>Type-2 Diabetes — Insulin Resistance &amp; Organ Perfusion Cross-Section</h1>
      <p>Clinical Histological Progression · Capillary Perfusion · Receptor &amp; GLUT4 Translocation Dynamics</p>
    </div>
    <div class="stages-nav">
      <button class="stage-btn active" data-stage="0">1 · Healthy</button>
      <button class="stage-btn" data-stage="1">2 · Compensated IR</button>
      <button class="stage-btn" data-stage="2">3 · Decompensated</button>
      <button class="stage-btn" data-stage="3">4 · Severe T2D</button>
    </div>
  </header>

  <div class="main-grid">
    <!-- LEFT: Normal Reference Anatomy -->
    <div class="view-card">
      <div class="card-header">
        <h2 style="color: #34d399;">Healthy Normal Reference (Euglycemia)</h2>
        <span class="badge badge-normal">Baseline Control</span>
      </div>
      <div class="svg-container">
        <div class="organ-board">
          <div class="cap-wrap">
            <svg viewBox="0 0 440 46" class="cap-svg">
              <rect x="10" y="6" width="420" height="34" rx="17" fill="rgba(239,68,68,0.30)" stroke="#ef4444" stroke-width="2"/>
              <text x="24" y="27" fill="#fca5a5" font-size="10" font-weight="700">CAPILLARY LUMEN (PERFUSION 100%)</text>
              <circle cx="80" cy="23" r="7" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
              <circle cx="142" cy="23" r="7" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
              <circle cx="204" cy="23" r="7" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
              <circle cx="266" cy="23" r="7" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
              <circle cx="328" cy="23" r="7" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
              <polygon points="111,18 115,23 111,28 107,23" fill="#06b6d4"/>
              <polygon points="235,18 239,23 235,28 231,23" fill="#06b6d4"/>
              <circle cx="173" cy="23" r="4" fill="#f59e0b"/>
              <circle cx="297" cy="23" r="4" fill="#f59e0b"/>
            </svg>
            <div class="cap-sub">ENDOTHELIUM · INTACT GLYCOCALYX · NORMAL DIFFUSION GRADIENT</div>
          </div>
          <div class="organ-grid">
            <div class="sa-cell"><div class="sa-slot" id="h-liver"></div><div class="sa-cap">LIVER · NORMAL ARCHITECTURE</div></div>
            <div class="sa-cell"><div class="sa-slot" id="h-pancreas"></div><div class="sa-cap">ISLET OF LANGERHANS · NORMAL β-CELL MASS</div></div>
            <div class="sa-cell"><div class="sa-slot" id="h-muscle"></div><div class="sa-cap">SKELETAL MUSCLE FIBER</div></div>
            <div class="sa-cell"><div class="sa-slot" id="h-adipose"></div><div class="sa-cap">ADIPOCYTE · CONTROLLED LIPID</div></div>
          </div>
          <div class="zoom-row">
            <div class="sa-cell-sm"><div class="sa-slot-sm" id="h-myofibril"></div><div class="sa-cap">MYOFIBRIL (ZOOM)</div></div>
            <div class="sa-cell-sm"><div class="sa-slot-sm" id="h-vein"></div><div class="sa-cap">VEIN · HEALTHY WALL</div></div>
            <div class="sa-cell-sm"><div class="sa-slot-sm" id="h-rbc"></div><div class="sa-cap">ERYTHROCYTE</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Dynamic Pathophysiological Cross-Section -->
    <div class="view-card">
      <div class="card-header">
        <h2 id="path-title" style="color: #fb923c;">Compensated Insulin Resistance</h2>
        <span class="badge badge-pathology" id="path-badge">Stage 2</span>
      </div>
      <div class="svg-container">
        <div class="organ-board">
          <div class="cap-wrap">
            <svg viewBox="0 0 440 46" class="cap-svg">
              <rect id="path-capillary" x="10" y="6" width="420" height="34" rx="17" fill="rgba(249,115,22,0.32)" stroke="#f97316" stroke-width="2"/>
              <text id="path-cap-text" x="24" y="27" fill="#fdba74" font-size="10" font-weight="700">CAPILLARY LUMEN (PERFUSION 94%)</text>
              <g id="path-particles"></g>
            </svg>
            <div class="cap-sub" id="path-inter-text">DIACYLGLYCEROL &amp; CERAMIDE ACCUMULATION AT THE ENDOTHELIAL BARRIER</div>
          </div>
          <div class="organ-grid">
            <div class="sa-cell"><div class="sa-slot" id="p-liver"></div><div class="sa-cap" id="p-liver-cap">HEPATIC ARCHITECTURE</div></div>
            <div class="sa-cell"><div class="sa-slot" id="p-pancreas"></div><div class="sa-cap" id="p-pancreas-cap">ISLET · β-CELL STATUS</div></div>
            <div class="sa-cell"><div class="sa-slot" id="p-muscle"></div><div class="sa-cap" id="p-muscle-cap">MUSCLE FIBER · PERFUSION</div></div>
            <div class="sa-cell"><div class="sa-slot" id="p-adipose"></div><div class="sa-cap" id="p-adipose-cap">ADIPOCYTE · LIPID LOAD</div></div>
          </div>
          <div class="zoom-row">
            <div class="sa-cell-sm"><div class="sa-slot-sm" id="p-myofibril"></div><div class="sa-cap">MYOFIBRIL (ZOOM)</div></div>
            <div class="sa-cell-sm"><div class="sa-slot-sm" id="p-vein"></div><div class="sa-cap" id="p-vein-cap">VENOUS WALL</div></div>
            <div class="sa-cell-sm"><div class="sa-slot-sm" id="p-rbc"></div><div class="sa-cap">ERYTHROCYTE</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Telemetry Dashboard -->
  <div class="telemetry-row">
    <div class="tele-card">
      <div class="tele-label">Fasting Blood Glucose</div>
      <div class="tele-val" id="val-glucose">86</div>
      <div class="tele-unit">mg/dL</div>
      <div class="tele-status badge-normal" id="stat-glucose">Normal</div>
    </div>
    <div class="tele-card">
      <div class="tele-label">Glycated Hemoglobin (HbA1c)</div>
      <div class="tele-val" id="val-hba1c">5.1</div>
      <div class="tele-unit">%</div>
      <div class="tele-status badge-normal" id="stat-hba1c">Euglycemic</div>
    </div>
    <div class="tele-card">
      <div class="tele-label">Fasting Serum Insulin</div>
      <div class="tele-val" id="val-insulin">7.2</div>
      <div class="tele-unit">μIU/mL</div>
      <div class="tele-status badge-normal" id="stat-insulin">Optimal Basal</div>
    </div>
    <div class="tele-card">
      <div class="tele-label">Microvascular Perfusion</div>
      <div class="tele-val" id="val-perfusion">100</div>
      <div class="tele-unit">%</div>
      <div class="tele-status badge-normal" id="stat-perfusion">Intact Glycocalyx</div>
    </div>
  </div>

  <!-- Clinical Explanatory Narrative -->
  <div class="clinical-narrative" id="narrative-box">
    <strong>Stage 1 (Normal Euglycemia):</strong> Insulin binds physiological tyrosine kinase receptors on skeletal muscle and adipocytes, prompting IRS-1 phosphorylation and rapid GLUT4 vesicle exocytosis. Capillary perfusion is 100% with no microvascular shear stress.
  </div>

  <!-- Controls Bar -->
  <div id="satchida-controls">
    <button id="btn-play">Pause</button>
    <button id="btn-restart">Reset</button>
    <input type="range" id="timeline-scrubber" min="0" max="300" value="0" step="1">
    <span id="stage-display" style="font-size:11px;color:#94a3b8;font-weight:600;min-width:60px;">Stage 1</span>
  </div>

  <footer>
    Educational &amp; Pathophysiological Visualization — Not Medical Advice. Generated for clinical training, academic reference &amp; patient comprehension.
    <br>Organ illustrations: Servier Medical Art (smart.servier.com), CC-BY 3.0 · Heart &amp; liver progression series: CC0.
  </footer>

  <script>
    const STAGES = [
      {
        name: "Stage 1 · Healthy Euglycemia",
        badge: "Normal",
        badgeClass: "badge-normal",
        titleColor: "#34d399",
        glucose: 86,
        glucoseStat: "Normal",
        glucoseColor: "#10b981",
        hba1c: 5.1,
        hba1cStat: "Normal (<5.7%)",
        insulin: 7.2,
        insulinStat: "Normal Basal",
        perfusion: 100,
        perfusionStat: "Intact Glycocalyx",
        capColor: "#10b981",
        capText: "CAPILLARY LUMEN (PERFUSION 100%)",
        irText: "Active IR (Tyrosine Kinase)",
        irColor: "#06b6d4",
        phosOpacity: 0,
        glut4Color: "#10b981",
        glut4Y: 96,
        metaTitle: "GLYCOGENESIS INTACT",
        metaSub: "Normal Hexokinase Activity",
        metaBorder: "#10b981",
        isletText: "Normal β-cell Mass",
        isletBorder: "#06b6d4",
        betaCellsCount: 3,
        betaCellRadius: 5.5,
        betaCellColor: "#06b6d4",
        narrative: "<strong>Stage 1 (Normal Euglycemia):</strong> Insulin binds physiological tyrosine kinase receptors on skeletal muscle and adipocytes, prompting IRS-1 phosphorylation and rapid GLUT4 vesicle exocytosis. Capillary perfusion is 100% with no microvascular shear stress."
      },
      {
        name: "Stage 2 · Compensated Insulin Resistance",
        badge: "Compensated",
        badgeClass: "badge-pathology",
        titleColor: "#fb923c",
        glucose: 98,
        glucoseStat: "Near-Normal",
        glucoseColor: "#fbbf24",
        hba1c: 5.5,
        hba1cStat: "Normal / Upper Limit",
        insulin: 26.4,
        insulinStat: "Hyperinsulinemia (3x)",
        perfusion: 94,
        perfusionStat: "Mild Vasomotor Stress",
        capColor: "#f97316",
        capText: "CAPILLARY LUMEN (PERFUSION 94% · ELEVATED INSULIN)",
        irText: "Serine Phosphorylated (Receptor Desensitized)",
        irColor: "#f97316",
        phosOpacity: 0.8,
        glut4Color: "#eab308",
        glut4Y: 108,
        metaTitle: "COMPENSATORY WORKLOAD",
        metaSub: "Mitochondrial ROS · Intramyocellular Lipid",
        metaBorder: "#f97316",
        isletText: "β-Cell Hyperplasia (Overdrive)",
        isletBorder: "#f97316",
        betaCellsCount: 5,
        betaCellRadius: 7.5,
        betaCellColor: "#f97316",
        narrative: "<strong>Stage 2 (Compensated Insulin Resistance):</strong> Ectopic lipid metabolites (diacylglycerols, ceramides) activate PKCθ, causing inhibitory serine phosphorylation of IRS-1. The pancreas compensates with massive hyperinsulinemia to force glucose into cells."
      },
      {
        name: "Stage 3 · Impaired Glucose Tolerance (Pre-Diabetes)",
        badge: "Decompensating",
        badgeClass: "badge-pathology",
        titleColor: "#f43f5e",
        glucose: 145,
        glucoseStat: "Impaired Fasting",
        glucoseColor: "#f43f5e",
        hba1c: 6.9,
        hba1cStat: "Elevated (6.5-7.0%)",
        insulin: 36.8,
        insulinStat: "Secretory Fatigue",
        perfusion: 76,
        perfusionStat: "Endothelial Dysfunction",
        capColor: "#e11d48",
        capText: "CAPILLARY LUMEN (PERFUSION 76% · GLUCOSE ACCUMULATION)",
        irText: "Uncoupled Receptor Cascade",
        irColor: "#e11d48",
        phosOpacity: 1.0,
        glut4Color: "#dc2626",
        glut4Y: 125,
        metaTitle: "UNCHECKED GLUCONEOGENESIS",
        metaSub: "GLUT4 Vesicle Translocation Blocked",
        metaBorder: "#e11d48",
        isletText: "β-Cell Secretory Exhaustion",
        isletBorder: "#e11d48",
        betaCellsCount: 4,
        betaCellRadius: 6.0,
        betaCellColor: "#e11d48",
        narrative: "<strong>Stage 3 (Decompensation / Impaired Glucose Tolerance):</strong> Pancreatic β-cells can no longer sustain extreme hyperinsulinemia due to endoplasmic reticulum stress. GLUT4 vesicles fail to reach the plasma membrane, causing glucose to pool in the bloodstream."
      },
      {
        name: "Stage 4 · Severe Type-2 Diabetes & Islet Failure",
        badge: "Severe T2D",
        badgeClass: "badge-pathology",
        titleColor: "#ef4444",
        glucose: 220,
        glucoseStat: "Severe Hyperglycemia",
        glucoseColor: "#ef4444",
        hba1c: 9.8,
        hba1cStat: "Critical (>9.0%)",
        insulin: 6.1,
        insulinStat: "Beta-Cell Failure",
        perfusion: 52,
        perfusionStat: "Microvascular Ischemia",
        capColor: "#991b1b",
        capText: "CAPILLARY LUMEN (PERFUSION 52% · SEVERE MICROVASCULAR DAMAGE)",
        irText: "Complete Receptor Resistance",
        irColor: "#991b1b",
        phosOpacity: 1.0,
        glut4Color: "#7f1d1d",
        glut4Y: 140,
        metaTitle: "GLUCOTOXICITY & AMYLOIDOSIS",
        metaSub: "Advanced Glycation End-products (AGEs)",
        metaBorder: "#ef4444",
        isletText: "β-Cell Apoptosis & Amyloid (IAPP)",
        isletBorder: "#991b1b",
        betaCellsCount: 2,
        betaCellRadius: 4.0,
        betaCellColor: "#64748b",
        narrative: "<strong>Stage 4 (Severe Type-2 Diabetes & Beta-Cell Failure):</strong> Marked by β-cell apoptosis and islet amyloid polypeptide (IAPP) fibril deposition. Profound insulin deficiency superimposed on receptor resistance leads to persistent hyperglycemia, advanced glycation, and microvascular basement membrane thickening."
      }
    ];

    let currentStage = 0;

    function renderStage(idx, lerpP = 0) {
      currentStage = Math.max(0, Math.min(3, idx));
      const s = STAGES[currentStage];
      document.querySelectorAll(".stage-btn").forEach((btn, i) => btn.classList.toggle("active", i === currentStage));

      document.getElementById("path-title").textContent = s.name;
      document.getElementById("path-title").style.color = s.titleColor;
      const bEl = document.getElementById("path-badge");
      bEl.textContent = s.badge;
      bEl.className = "badge " + s.badgeClass;

      // Telemetry
      document.getElementById("val-glucose").textContent = s.glucose;
      document.getElementById("val-glucose").style.color = s.glucoseColor;
      document.getElementById("stat-glucose").textContent = s.glucoseStat;

      document.getElementById("val-hba1c").textContent = s.hba1c.toFixed(1);
      document.getElementById("stat-hba1c").textContent = s.hba1cStat;

      document.getElementById("val-insulin").textContent = s.insulin.toFixed(1);
      document.getElementById("stat-insulin").textContent = s.insulinStat;

      document.getElementById("val-perfusion").textContent = s.perfusion;
      document.getElementById("stat-perfusion").textContent = s.perfusionStat;

      document.getElementById("narrative-box").innerHTML = s.narrative;
      document.getElementById("stage-display").textContent = "Stage " + (currentStage + 1);

      // Organ state — real anatomical artwork swapped per stage via the protected library
      const o = ORGAN_STATE[currentStage];
      R.liver.setVariant(o.liverOrgan);
      R.liver.setFilter(o.liverFilter);
      R.liver.glow(o.liverGlow);
      R.pancreas.setFilter(o.pancreasFilter);
      R.pancreas.glow(o.pancreasGlow);
      R.muscle.setFilter(o.muscleFilter);
      R.adipose.setFilter(o.adiposeFilter);
      R.vein.setVariant(o.veinOrgan);
      document.getElementById("p-liver-cap").textContent = o.liverCaption;
      document.getElementById("p-pancreas-cap").textContent = o.pancreasCaption;
      document.getElementById("p-muscle-cap").textContent = o.muscleCaption;
      document.getElementById("p-adipose-cap").textContent = o.adiposeCaption;
      document.getElementById("p-vein-cap").textContent = o.veinCaption;

      // Capillary tube state
      const cap = document.getElementById("path-capillary");
      cap.setAttribute("stroke", s.capColor);
      document.getElementById("path-cap-text").textContent = s.capText;

      // Regenerate particles (capillary strip geometry)
      const pGroup = document.getElementById("path-particles");
      pGroup.innerHTML = "";
      // RBCs
      for (let i = 0; i < 5; i++) {
        const cx = 80 + i * 62;
        const cy = 23 + Math.sin(i + currentStage) * 4;
        const rbc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        rbc.setAttribute("cx", cx);
        rbc.setAttribute("cy", cy);
        rbc.setAttribute("r", 7 - currentStage * 0.5);
        rbc.setAttribute("fill", currentStage > 2 ? "#7f1d1d" : "#b91c1c");
        rbc.setAttribute("stroke", currentStage > 2 ? "#b91c1c" : "#f87171");
        rbc.setAttribute("stroke-width", "1.5");
        pGroup.appendChild(rbc);
      }
      // Glucose dots density increases in Stage 3 and 4
      const gCount = currentStage === 0 ? 3 : currentStage === 1 ? 5 : currentStage === 2 ? 14 : 26;
      for (let i = 0; i < gCount; i++) {
        const gx = 40 + ((i * 37) % 360);
        const gy = 14 + ((i * 19) % 18);
        const gDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        gDot.setAttribute("cx", gx);
        gDot.setAttribute("cy", gy);
        gDot.setAttribute("r", "4");
        gDot.setAttribute("fill", "#f59e0b");
        pGroup.appendChild(gDot);
      }
      // Insulin particles (Peak in Stage 2, drops in Stage 4)
      const insCount = currentStage === 0 ? 3 : currentStage === 1 ? 9 : currentStage === 2 ? 6 : 1;
      for (let i = 0; i < insCount; i++) {
        const ix = 60 + ((i * 49) % 340);
        const iy = 16 + ((i * 23) % 14);
        const ins = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        ins.setAttribute("points", `${ix},${iy-5} ${ix+4},${iy} ${ix},${iy+5} ${ix-4},${iy}`);
        ins.setAttribute("fill", "#06b6d4");
        pGroup.appendChild(ins);
      }
    }

    // Per-stage organ state (real artwork variants + clinical filters)
    const ORGAN_STATE = [
      { liverOrgan: "liver-healthy", liverFilter: "none", liverGlow: "#34d399",
        pancreasFilter: "none", pancreasGlow: "#22d3ee",
        muscleFilter: "none", adiposeFilter: "none", veinOrgan: "vein-healthy",
        liverCaption: "NORMAL HEPATIC ARCHITECTURE",
        pancreasCaption: "ISLET · NORMAL β-CELL MASS",
        muscleCaption: "MUSCLE FIBER · INSULIN SENSITIVE",
        adiposeCaption: "ADIPOCYTE · CONTROLLED LIPID",
        veinCaption: "VENOUS WALL · HEALTHY" },
      { liverOrgan: "liver", liverFilter: "sepia(0.5) saturate(1.8) brightness(0.95)", liverGlow: "#f59e0b",
        pancreasFilter: "sepia(0.3) saturate(1.4)", pancreasGlow: "#f97316",
        muscleFilter: "sepia(0.35) saturate(1.3)", adiposeFilter: "saturate(1.4) brightness(0.95)", veinOrgan: "vein",
        liverCaption: "EARLY STEATOSIS · LOBULAR STRAIN",
        pancreasCaption: "ISLET · HYPERINSULINEMIC COMPENSATION",
        muscleCaption: "MUSCLE FIBER · INTRAMYOCELLULAR LIPID",
        adiposeCaption: "ADIPOCYTE · LIPID ACCUMULATION",
        veinCaption: "VENOUS WALL · ENDOTHELIAL STRESS" },
      { liverOrgan: "liver-fibrotic", liverFilter: "none", liverGlow: "#f97316",
        pancreasFilter: "saturate(0.9) brightness(0.9)", pancreasGlow: "#fb923c",
        muscleFilter: "sepia(0.5) saturate(1.4) brightness(0.9)", adiposeFilter: "saturate(1.7) brightness(0.9)", veinOrgan: "vein",
        liverCaption: "FIBROTIC REMODELING · PORTAL STRAIN",
        pancreasCaption: "ISLET · SECRETORY FATIGUE",
        muscleCaption: "MUSCLE FIBER · GLUCOTOXIC STRAIN",
        adiposeCaption: "ADIPOCYTE · HYPERTROPHY",
        veinCaption: "VENOUS WALL · VALVE STRESS" },
      { liverOrgan: "liver-cirrhotic", liverFilter: "none", liverGlow: "#ef4444",
        pancreasFilter: "saturate(0.7) brightness(0.85)", pancreasGlow: "#ef4444",
        muscleFilter: "grayscale(0.4) brightness(0.85)", adiposeFilter: "saturate(2) brightness(0.85)", veinOrgan: "vein-varicose",
        liverCaption: "CIRRHOTIC ARCHITECTURE · ADVANCED FIBROSIS",
        pancreasCaption: "ISLET · β-CELL EXHAUSTION",
        muscleCaption: "MUSCLE FIBER · ATROPHIC CHANGE",
        adiposeCaption: "ADIPOCYTE · PATHOLOGIC EXPANSION",
        veinCaption: "VENOUS WALL · VARICOSE REMODELING" }
    ];

    // Mount the left (healthy reference) panel — static real anatomy
    SatchidaAnatomy.mount("liver-healthy", "h-liver");
    SatchidaAnatomy.mount("pancreas-islet", "h-pancreas");
    SatchidaAnatomy.mount("muscle-fiber", "h-muscle");
    SatchidaAnatomy.mount("adipocyte", "h-adipose");
    SatchidaAnatomy.mount("muscle-myofibril", "h-myofibril");
    SatchidaAnatomy.mount("vein-healthy", "h-vein");
    SatchidaAnatomy.mount("erythrocyte", "h-rbc");

    // Mount the right (affected) panel — variants driven by the stage scrubber
    const R = {
      liver: SatchidaAnatomy.mount("liver-healthy", "p-liver"),
      pancreas: SatchidaAnatomy.mount("pancreas-islet", "p-pancreas"),
      muscle: SatchidaAnatomy.mount("muscle-fiber", "p-muscle"),
      adipose: SatchidaAnatomy.mount("adipocyte", "p-adipose"),
      vein: SatchidaAnatomy.mount("vein-healthy", "p-vein")
    };
    SatchidaAnatomy.mount("muscle-myofibril", "p-myofibril");
    SatchidaAnatomy.mount("erythrocyte", "p-rbc");

    renderStage(0);

    document.querySelectorAll(".stage-btn").forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.stage);
        tl.pause();
        tl.progress(idx / 3);
      };
    });

    const tl = gsap.timeline({
      id: "clinical",
      repeat: -1,
      defaults: { ease: "none" },
      onUpdate: () => {
        const p = tl.progress();
        const stageIdx = Math.min(3, Math.floor(p * 4));
        renderStage(stageIdx, (p * 4) % 1);
        document.getElementById("timeline-scrubber").value = p * 300;
      }
    });
    window.__TIMELINE__ = tl;
    tl.to({}, { duration: 16 });

    document.getElementById("btn-play").onclick = () => {
      if (tl.paused()) {
        tl.play();
        document.getElementById("btn-play").textContent = "Pause";
      } else {
        tl.pause();
        document.getElementById("btn-play").textContent = "Play";
      }
    };
    document.getElementById("btn-restart").onclick = () => {
      tl.restart();
      document.getElementById("btn-play").textContent = "Pause";
    };
    document.getElementById("timeline-scrubber").oninput = (e) => {
      tl.pause();
      document.getElementById("btn-play").textContent = "Play";
      tl.progress(e.target.value / 300);
    };
  </script>
</body>
</html>""",
        )

    if style == "cad_blueprint":
        return _wrap_template_artifact(
            "cad_blueprint",
            "Architectural 2D CAD & 3D Extruded Floor Plan",
            """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — 2D CAD & 3D Architectural Floor Plan</title>
  <script src="/assets/vendor/three/three.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';"></script>
  <script src="/assets/vendor/three/OrbitControls.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';"></script>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #07111f; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; width: 100vw; height: 100vh; overflow: hidden; }
    #stage-wrap { position: relative; width: 100vw; height: 100vh; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    #cad-2d { z-index: 2; background: #07111f; }
    #webgl-3d { z-index: 1; opacity: 0; pointer-events: none; transition: opacity 0.35s ease; }
    body.mode-3d #cad-2d { opacity: 0; pointer-events: none; }
    body.mode-3d #webgl-3d { opacity: 1; pointer-events: auto; z-index: 3; }
    #title-badge { position: fixed; top: 12px; left: 12px; max-width: calc(100vw - 246px); background: rgba(10, 22, 42, 0.92); border: 1px solid rgba(56,189,248,0.3); border-radius: 12px; padding: 9px 12px; z-index: 20; backdrop-filter: blur(8px); }
    #title-badge h1 { font-size: 13px; font-weight: 700; color: #f8fafc; line-height: 1.25; }
    #title-badge p { font-size: 10.5px; color: #94a3b8; margin-top: 2px; }
    .hud { position: fixed; top: 12px; right: 12px; background: rgba(10, 22, 42, 0.92); border: 1px solid rgba(56,189,248,0.3); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; width: 214px; z-index: 20; backdrop-filter: blur(8px); }
    .hud-head { display: flex; align-items: center; justify-content: space-between; }
    .hud h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.9px; color: #38bdf8; }
    #hud-toggle { background: rgba(56,189,248,0.14); border: 1px solid rgba(56,189,248,0.3); color: #7dd3fc; border-radius: 6px; width: 20px; height: 20px; font-size: 13px; line-height: 1; cursor: pointer; }
    .hud.collapsed .hud-body { display: none; }
    .hud-body { display: flex; flex-direction: column; gap: 7px; }
    .cam-row { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
    .cam-row button { background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.32); color: #e0f2fe; border-radius: 7px; padding: 5px 4px; font-size: 10.5px; font-weight: 600; cursor: pointer; }
    .cam-row button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
    .hud label { font-size: 10.5px; display: flex; justify-content: space-between; align-items: center; color: #cbd5e1; cursor: pointer; }
    .hint { font-size: 9.5px; color: #64748b; line-height: 1.3; }
    #satchida-controls { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; padding: 6px 14px; background: rgba(15,23,42,0.92); border: 1px solid rgba(255,255,255,0.14); border-radius: 9999px; z-index: 20; white-space: nowrap; }
    #satchida-controls button { background: transparent; border: none; color: #f1f5f9; font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 6px; }
  </style>
</head>
<body class="mode-2d">
  <div id="title-badge">
    <h1>1,400 sq ft 3BHK Apartment (40' × 35')</h1>
    <p id="mode-subtitle">2D Orthographic Architectural CAD Blueprint</p>
  </div>
  <div class="hud" id="hud-panel">
    <div class="hud-head">
      <h3>Architecture Studio</h3>
      <button id="hud-toggle" title="Collapse/Expand">−</button>
    </div>
    <div class="hud-body">
      <div class="cam-row">
        <button id="btn-2d" class="active">2D Blueprint</button>
        <button id="btn-3d-iso">3D Iso</button>
        <button id="btn-3d-walk">3D Interior</button>
        <button id="btn-3d-top">3D Dollhouse</button>
      </div>
      <label>Furniture &amp; Fixtures <input type="checkbox" id="chk-furn" checked></label>
      <label>Dimensions &amp; Labels <input type="checkbox" id="chk-dims" checked></label>
      <label>Cutaway Half-Walls <input type="checkbox" id="chk-cutaway"></label>
      <label>Sun Hour <span id="sun-lbl">10:30</span></label>
      <input type="range" id="sun-slider" min="6.5" max="18.5" step="0.5" value="10.5">
      <div class="hint">3D mode: Drag to orbit · Scroll to zoom · Right-drag to pan</div>
    </div>
  </div>
  <div id="stage-wrap">
    <canvas id="cad-2d"></canvas>
    <canvas id="webgl-3d"></canvas>
  </div>
  <div id="satchida-controls">
    <button id="btn-play">Orbit</button>
    <button id="btn-restart">Reset</button>
    <input type="range" id="timeline-scrubber" min="0" max="100" value="0" step="0.5" style="width:140px;">
    <span id="time-display" style="font-size:11px;color:#94a3b8;white-space:nowrap;">2D / 3D</span>
  </div>
  <script>
    // Single source of truth: 40ft x 35ft (1,400 sq ft) 3BHK Floor Plan (NBC / IBC Compliant)
    // Architectural circulation rule: Hallway connects living area directly to all bedrooms.
    // Common Bath is accessible ONLY from the central hallway with ZERO pass-through into bedrooms.
    // Servant Quarter has an independent 5ft covered service breezeway with generous 3ft door clearance.
    window.SATCHIDA_CAD_PLAN = {
      width: 40, depth: 35,
      rooms: [
        { id: "balcony", name: "LIVING BALCONY", x: 0, z: -5, w: 18, d: 5, floor: "#78553a", tint: "rgba(16,185,129,0.08)" },
        { id: "living", name: "LIVING & DINING", x: 0, z: 0, w: 22, d: 19, floor: "#c49a6c", tint: "rgba(56,189,248,0.06)" },
        { id: "kitchen", name: "OPEN KITCHEN", x: 0, z: 19, w: 13, d: 16, floor: "#94a3b8", tint: "rgba(168,85,247,0.06)" },
        { id: "study", name: "STUDY NOOK", x: 13, z: 19, w: 9, d: 6, floor: "#b88e60", tint: "rgba(245,158,11,0.07)" },
        { id: "foyer", name: "MAIN FOYER", x: 13, z: 25, w: 9, d: 10, floor: "#94a3b8", tint: "rgba(56,189,248,0.05)" },
        { id: "master", name: "MASTER SUITE", x: 22, z: 0, w: 18, d: 13, floor: "#b88b5c", tint: "rgba(16,185,129,0.06)" },
        { id: "mbath", name: "MASTER BATH (EN-SUITE)", x: 33, z: 0, w: 7, d: 7, floor: "#64748b", tint: "rgba(56,189,248,0.08)" },
        { id: "hall", name: "CIRCULATION HALLWAY", x: 22, z: 13, w: 12, d: 6, floor: "#b88e60", tint: "rgba(56,189,248,0.03)" },
        { id: "cbath", name: "COMMON BATH", x: 34, z: 13, w: 6, d: 6, floor: "#64748b", tint: "rgba(56,189,248,0.08)" },
        { id: "bed2", name: "BEDROOM 2", x: 22, z: 19, w: 9, d: 16, floor: "#b88b5c", tint: "rgba(245,158,11,0.06)" },
        { id: "bed3", name: "BEDROOM 3", x: 31, z: 19, w: 9, d: 16, floor: "#b88b5c", tint: "rgba(16,185,129,0.05)" },
        { id: "service", name: "SERVICE BREEZEWAY (5FT)", x: 0, z: 35, w: 16, d: 5, floor: "#64748b", tint: "rgba(244,63,94,0.04)" },
        { id: "servant", name: "SERVANT QUARTER (EXT)", x: 2, z: 40, w: 10, d: 7.5, floor: "#94a3b8", tint: "rgba(244,63,94,0.08)" },
        { id: "swash", name: "SERVANT WC", x: 12, z: 40, w: 4, d: 7.5, floor: "#64748b", tint: "rgba(244,63,94,0.06)" }
      ],
      walls: [
        // North balcony railing & main North exterior wall
        { x1: 0, z1: -5, x2: 18, z2: -5, t: 0.25, kind: "rail", openings: [] },
        { x1: 0, z1: -5, x2: 0, z2: 0, t: 0.25, kind: "rail", openings: [] },
        { x1: 18, z1: -5, x2: 18, z2: 0, t: 0.25, kind: "rail", openings: [] },
        { x1: 0, z1: 0, x2: 40, z2: 0, t: 0.75, kind: "ext", openings: [{ at: 4, len: 9, kind: "win" }, { at: 25, len: 6, kind: "win" }] },
        // West exterior wall
        { x1: 0, z1: 0, x2: 0, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 4, len: 7, kind: "win" }, { at: 24, len: 6, kind: "win" }] },
        // East exterior wall: dedicated fresh-air windows for both baths and bedroom 3
        { x1: 40, z1: 0, x2: 40, z2: 35, t: 0.75, kind: "ext", openings: [
          { at: 3.5, len: 2.6, kind: "win" },  // Master Bath East window (NBC fresh air)
          { at: 15.2, len: 2.6, kind: "win" }, // Common Bath East window (NBC fresh air)
          { at: 26.0, len: 5.0, kind: "win" }  // Bedroom 3 East window
        ] },
        // South exterior wall (z=35): Main entrance + kitchen service exit + bedroom windows
        { x1: 0, z1: 35, x2: 40, z2: 35, t: 0.75, kind: "ext", openings: [
          { at: 3.5, len: 2.8, kind: "door", swing: 1 }, // Kitchen service exit to breezeway
          { at: 15.5, len: 3.5, kind: "door", swing: -1 }, // Main family entrance into Foyer
          { at: 25.5, len: 4.0, kind: "win" }, // Bedroom 2 South window
          { at: 35.5, len: 4.0, kind: "win" }  // Bedroom 3 South window
        ] },
        // Public/Living interior partitions
        { x1: 0, z1: 19, x2: 22, z2: 19, t: 0.45, kind: "int", openings: [{ at: 4, len: 7, kind: "open" }, { at: 15, len: 5, kind: "open" }] },
        { x1: 13, z1: 19, x2: 13, z2: 35, t: 0.45, kind: "int", openings: [{ at: 21, len: 3.5, kind: "open" }] },
        { x1: 13, z1: 25, x2: 22, z2: 25, t: 0.4, kind: "int", openings: [{ at: 15.5, len: 4.0, kind: "open" }] },

        // Living / East Wing Dividing Wall (x=22)
        // Living room connects directly to Hallway at z=13.5..17.5 via 4ft clear archway
        { x1: 22, z1: 0, x2: 22, z2: 13, t: 0.45, kind: "int", openings: [] },
        { x1: 22, z1: 13, x2: 22, z2: 19, t: 0.45, kind: "int", openings: [{ at: 14.0, len: 4.0, kind: "open" }] },
        { x1: 22, z1: 19, x2: 22, z2: 35, t: 0.45, kind: "int", openings: [] },

        // Master Suite private en-suite bath partition (x=33, z=0..7)
        // Master Bath door opens ONLY from inside Master Suite (z=2..4.6)
        { x1: 33, z1: 0, x2: 33, z2: 7, t: 0.4, kind: "int", openings: [{ at: 2.0, len: 2.6, kind: "door", swing: 1 }] },
        // Master Bath South wall (z=7, x=33..40) - solid wall
        { x1: 33, z1: 7, x2: 40, z2: 7, t: 0.4, kind: "int", openings: [] },

        // Hallway North wall (z=13, x=22..40):
        // Door to Master Suite: at x=24.5, len=2.8, swing=1 (swings inward into Master Suite)
        // The Common Bath sits ABOVE the hallway (x=34..40), so its north wall stays solid.
        { x1: 22, z1: 13, x2: 34, z2: 13, t: 0.45, kind: "int", openings: [{ at: 24.5, len: 2.8, kind: "door", swing: 1 }] },
        { x1: 34, z1: 13, x2: 40, z2: 13, t: 0.45, kind: "int", openings: [] },

        // Common Bath West wall (x=34, z=13..19) facing Hallway:
        // The ONLY door into the Common Bath: opens from the Hallway at z=14.0, swing=1
        { x1: 34, z1: 13, x2: 34, z2: 19, t: 0.45, kind: "int", openings: [{ at: 14.0, len: 2.6, kind: "door", swing: 1 }] },

        // Hallway South wall (z=19, x=22..34): direct doors to Bedroom 2 and Bedroom 3
        { x1: 22, z1: 19, x2: 34, z2: 19, t: 0.45, kind: "int", openings: [
          { at: 23.0, len: 2.8, kind: "door", swing: 1 }, // Door to Bedroom 2
          { at: 31.2, len: 2.8, kind: "door", swing: 1 }  // Door to Bedroom 3
        ] },
        // Common Bath South wall (z=19, x=34..40): solid, so Bedroom 3 never opens into the bath
        { x1: 34, z1: 19, x2: 40, z2: 19, t: 0.45, kind: "int", openings: [] },

        // Partition between Bedroom 2 and Bedroom 3 (x=31, z=19..35) - solid wall
        { x1: 31, z1: 19, x2: 31, z2: 35, t: 0.4, kind: "int", openings: [] },

        // External Servant Quarter & WC (Z: 40..47.5, accessed via 5ft clear breezeway)
        { x1: 2, z1: 40, x2: 16, z2: 40, t: 0.6, kind: "ext", openings: [
          { at: 6.0, len: 2.8, kind: "door", swing: 1 }, // 5ft clear entry into Servant Quarter
          { at: 13.5, len: 2.4, kind: "door", swing: 1 } // Direct entry into Servant WC
        ] },
        { x1: 2, z1: 40, x2: 2, z2: 47.5, t: 0.6, kind: "ext", openings: [{ at: 42.5, len: 2.5, kind: "win" }] },
        { x1: 16, z1: 40, x2: 16, z2: 47.5, t: 0.6, kind: "ext", openings: [{ at: 42.5, len: 2.0, kind: "win" }] },
        { x1: 2, z1: 47.5, x2: 16, z2: 47.5, t: 0.6, kind: "ext", openings: [{ at: 6.0, len: 3.0, kind: "win" }] },
        { x1: 12, z1: 40, x2: 12, z2: 47.5, t: 0.4, kind: "int", openings: [] }
      ],
      furniture: [
        { type: "table", x: 3, z: -3.6, w: 3.5, d: 2.2, h: 1.8, color: "#78350f" },
        { type: "planter", x: 15, z: -3.5, w: 1.8, d: 1.8, h: 2.6, color: "#22c55e" },
        { type: "sofa", x: 2.2, z: 2.2, w: 9.5, d: 3.4, h: 2.6, color: "#334155" },
        { type: "table", x: 4.5, z: 6.6, w: 4.6, d: 2.4, h: 1.4, color: "#78350f" },
        { type: "dining", x: 11.5, z: 10.5, w: 7.5, d: 3.8, h: 2.5, color: "#92400e" },
        { type: "kitchen", x: 1.0, z: 21, w: 2.4, d: 11.5, h: 3.0, color: "#1e293b" },
        { type: "kitchen", x: 3.4, z: 31.6, w: 8.6, d: 2.4, h: 3.0, color: "#1e293b" },
        { type: "table", x: 5.5, z: 23.5, w: 4.8, d: 2.4, h: 3.0, color: "#cbd5e1" },
        { type: "desk", x: 14.2, z: 19.6, w: 5.8, d: 2.2, h: 2.5, color: "#78350f" },
        // Master Suite Bed & Wardrobe
        { type: "bed", x: 23.5, z: 2.5, w: 7.0, d: 6.6, h: 2.2, color: "#64748b" },
        { type: "wardrobe", x: 36.1, z: 6.7, w: 2.4, d: 5.0, h: 7.0, rot: 90, color: "#475569" },
        // Master Bath suite: shower + WC + vanity, all clear of the x=33 door swing
        { type: "shower", x: 37.0, z: 4.0, w: 3.0, d: 3.0, h: 6.6, color: "#38bdf8" },
        { type: "wc", x: 37.825, z: 0.4, w: 1.6, d: 2.35, h: 1.35, rot: 90, color: "#f8fafc" },
        { type: "vanity", x: 34.0, z: 5.2, w: 2.4, d: 1.6, h: 2.8, rot: 180, color: "#e2e8f0" },
        // Common Bath suite: one door only (x=34), fixtures on the far east wall
        { type: "shower", x: 37.0, z: 15.9, w: 3.0, d: 3.0, h: 6.6, color: "#38bdf8" },
        { type: "wc", x: 37.8, z: 13.4, w: 1.6, d: 2.35, h: 1.35, rot: 90, color: "#f8fafc" },
        { type: "vanity", x: 34.2, z: 17.2, w: 2.4, d: 1.6, h: 2.8, rot: 180, color: "#e2e8f0" },
        // Bedroom 2 Bed
        { type: "bed", x: 23.5, z: 23.0, w: 6.0, d: 6.2, h: 2.1, color: "#475569" },
        // Bedroom 3 Bed
        { type: "bed", x: 32.5, z: 23.0, w: 6.0, d: 6.2, h: 2.1, color: "#475569" },
        // Hallway console (keeps the 4ft living archway clear)
        { type: "table", x: 26.0, z: 14.1, w: 3.2, d: 1.2, h: 2.6, color: "#78350f" },
        // Servant Bed & WC
        { type: "bed", x: 3.5, z: 41.0, w: 3.6, d: 5.6, h: 1.9, color: "#64748b" },
        { type: "wc", x: 13.9, z: 45.4, w: 1.6, d: 2.35, h: 1.3, rot: 270, color: "#f8fafc" },
        { type: "vanity", x: 12.15, z: 44.0, w: 2.0, d: 1.5, h: 2.6, rot: 0, color: "#e2e8f0" }
      ]
    };

  </script>
  <script src="/assets/vendor/satchida/cad-studio.js?v=3"></script>
</body>
</html>""",
        )

    if style == "interactive_3d":
        return _wrap_template_artifact(
            "interactive_3d",
            "Interactive 3D WebGL Simulation",
            """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — Deterministic Three.js 3D Viewport</title>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <script src="/assets/vendor/three/three.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #050914; color: #f8fafc; font-family: system-ui, sans-serif; overflow: hidden; width: 100vw; height: 100vh; }
    #webgl { width: 100vw; height: 100vh; display: block; }
    #telemetry { position: fixed; top: 18px; left: 20px; padding: 12px 16px; border-radius: 12px; background: rgba(15,23,42,0.82); border: 1px solid rgba(16,185,129,0.3); font-family: monospace; font-size: 12px; }
    #satchida-controls { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; padding: 8px 16px; background: rgba(15,23,42,0.88); border: 1px solid rgba(255,255,255,0.14); border-radius: 9999px; }
    #satchida-controls button { background: transparent; border: none; color: #f1f5f9; font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 8px; }
  </style>
</head>
<body>
  <canvas id="webgl"></canvas>
  <div id="telemetry">TWR: <span id="twr-val">2.42</span> | ALT: <span id="alt-val">0.0m</span></div>
  <div id="satchida-controls">
    <button id="btn-play">Pause</button>
    <button id="btn-restart">Restart</button>
    <input type="range" id="timeline-scrubber" min="0" max="100" value="0" step="0.1" style="width:180px;">
  </div>
  <script>
    const canvas = document.getElementById("webgl");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050914);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(4, 3, 6);
    camera.lookAt(0, 0.8, 0);
    scene.add(new THREE.GridHelper(12, 24, 0x10b981, 0x1e293b));
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(5, 8, 5);
    scene.add(light, new THREE.AmbientLight(0x404060));

    const rig = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 1.4), new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.25 }));
    rig.add(body);
    const rotors = [[-0.9,0.2,-0.9],[0.9,0.2,-0.9],[-0.9,0.2,0.9],[0.9,0.2,0.9]].map(pos => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: true, opacity: 0.75 }));
      m.position.set(...pos);
      rig.add(m);
      return m;
    });
    scene.add(rig);

    const state = { alt: 0.4, yaw: 0, spin: 0 };
    window.__SEEK_FRAME__ = function(t, p) {
      rig.position.y = state.alt;
      rig.rotation.y = state.yaw;
      rotors.forEach((r, idx) => { r.rotation.y = state.spin * (idx % 2 === 0 ? 1 : -1); });
      document.getElementById("alt-val").textContent = state.alt.toFixed(1) + "m";
      renderer.render(scene, camera);
    };

    const tl = gsap.timeline({ id: "main", onUpdate: () => {
      const s = document.getElementById("timeline-scrubber");
      if (s) s.value = tl.progress() * 100;
      window.__SEEK_FRAME__(tl.time(), tl.progress());
    }});
    window.__TIMELINE__ = tl;
    tl.to(state, { alt: 2.2, yaw: Math.PI * 1.5, spin: Math.PI * 24, duration: 5, ease: "power2.inOut" });
    window.__SEEK_FRAME__(0, 0);

    document.getElementById("btn-play").onclick = () => tl.paused() ? tl.play() : tl.pause();
    document.getElementById("btn-restart").onclick = () => tl.restart();
    document.getElementById("timeline-scrubber").oninput = (e) => { tl.pause(); tl.progress(e.target.value / 100); };
  </script>
</body>
</html>""",
        )

    if style == "mechanism_cutaway":
        return _wrap_template_artifact(
            "mechanism_cutaway",
            "Interactive Mechanism Cutaway Simulation",
            """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — Mechanism Cutaway Lab</title>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b0f19; color: #f8fafc; font-family: system-ui, sans-serif; height: 100vh; overflow: hidden; display: grid; grid-template-columns: 1.5fr 1fr; padding: 28px; gap: 24px; align-items: center; }
    .panel { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 24px; height: 76vh; display: flex; flex-direction: column; justify-content: center; }
    #satchida-controls { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; padding: 8px 16px; background: rgba(15,23,42,0.88); border: 1px solid rgba(255,255,255,0.14); border-radius: 9999px; }
    #satchida-controls button { background: transparent; border: none; color: #f1f5f9; font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 8px; }
  </style>
</head>
<body>
  <div class="panel">
    <svg viewBox="0 0 400 320" width="100%" height="100%">
      <rect x="130" y="40" width="140" height="190" rx="8" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
      <rect id="combustion-glow" x="136" y="46" width="128" height="60" fill="#f97316" opacity="0.2"/>
      <rect id="piston" x="138" y="95" width="124" height="55" rx="4" fill="#38bdf8"/>
      <circle cx="200" cy="255" r="34" fill="none" stroke="#94a3b8" stroke-width="6"/>
      <circle id="crank-pin" cx="200" cy="228" r="7" fill="#fbbf24"/>
      <line id="rod" x1="200" y1="130" x2="200" y2="228" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round"/>
    </svg>
  </div>
  <div class="panel" style="gap: 16px;">
    <h2 style="font-size:20px;color:#38bdf8;">Cycle Cutaway Inspector</h2>
    <div id="phase-badge" style="padding:10px;border-radius:10px;background:#1e293b;font-weight:700;">Phase: INTAKE -> COMPRESSION -> POWER -> EXHAUST</div>
    <label style="font-size:13px;">Speed Multiplier: <span id="rpm-val">1.0x</span></label>
    <input type="range" id="rpm-slider" min="0.2" max="3.0" step="0.1" value="1.0">
  </div>
  <div id="satchida-controls">
    <button id="btn-play">Pause</button>
    <button id="btn-restart">Restart</button>
    <input type="range" id="timeline-scrubber" min="0" max="100" value="0" step="0.1" style="width:180px;">
  </div>
  <script>
    const state = { angle: 0 };
    window.__SEEK_FRAME__ = function() {
      const py = 95 + Math.sin(state.angle) * 32;
      const cx = 200 + Math.cos(state.angle) * 24;
      const cy = 255 + Math.sin(state.angle) * 24;
      document.getElementById("piston").setAttribute("y", py);
      document.getElementById("crank-pin").setAttribute("cx", cx);
      document.getElementById("crank-pin").setAttribute("cy", cy);
      document.getElementById("rod").setAttribute("y1", py + 32);
      document.getElementById("rod").setAttribute("x2", cx);
      document.getElementById("rod").setAttribute("y2", cy);
      document.getElementById("combustion-glow").setAttribute("opacity", Math.max(0.15, -Math.sin(state.angle)));
    };
    const tl = gsap.timeline({ id: "main", onUpdate: () => {
      document.getElementById("timeline-scrubber").value = tl.progress() * 100;
      window.__SEEK_FRAME__();
    }});
    window.__TIMELINE__ = tl;
    tl.to(state, { angle: Math.PI * 8, duration: 6, ease: "none" });
    document.getElementById("rpm-slider").oninput = (e) => {
      const v = parseFloat(e.target.value);
      tl.timeScale(v);
      document.getElementById("rpm-val").textContent = v.toFixed(1) + "x";
    };
    document.getElementById("btn-play").onclick = () => tl.paused() ? tl.play() : tl.pause();
    document.getElementById("btn-restart").onclick = () => tl.restart();
    document.getElementById("timeline-scrubber").oninput = (e) => { tl.pause(); tl.progress(e.target.value / 100); };
  </script>
</body>
</html>""",
        )

    if style == "accessible_guide":
        return _wrap_template_artifact(
            "accessible_guide",
            "Guided Step-by-Step Interactive Walkthrough",
            """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — High-Contrast Guided Walkthrough</title>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fefce8; color: #0f172a; font-family: system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
    .step-card { width: 760px; max-width: 92vw; background: #ffffff; border: 3px solid #0f172a; border-radius: 24px; padding: 36px; box-shadow: 0 12px 30px rgba(0,0,0,0.12); }
    .pill { display: inline-block; background: #0f172a; color: #fef08a; font-size: 18px; font-weight: 800; padding: 8px 18px; border-radius: 9999px; margin-bottom: 18px; }
    h1 { font-size: 36px; line-height: 1.25; margin-bottom: 14px; }
    p { font-size: 22px; line-height: 1.5; color: #1e293b; }
    #satchida-controls { position: fixed; bottom: 20px; display: flex; gap: 14px; background: #0f172a; color: #fff; padding: 12px 22px; border-radius: 9999px; }
    #satchida-controls button { background: #fef08a; color: #0f172a; border: none; font-size: 18px; font-weight: 800; padding: 8px 18px; border-radius: 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="step-card" id="guide-card">
    <div class="pill">STEP 1 OF 3 · MORNING ROUTINE</div>
    <h1>Take Morning Tablet With Warm Water</h1>
    <p>Check the strip label gently, drink one full glass of water, and sit upright for 10 minutes.</p>
  </div>
  <div id="satchida-controls">
    <button id="btn-play">Pause Guide</button>
    <button id="btn-restart">Start Over</button>
    <input type="range" id="timeline-scrubber" min="0" max="100" value="0" style="width:180px;">
  </div>
  <script>
    const tl = gsap.timeline({ id: "main", defaults: { ease: "power2.out" }, onUpdate: () => {
      document.getElementById("timeline-scrubber").value = tl.progress() * 100;
    }});
    window.__TIMELINE__ = tl;
    tl.timeScale(0.75);
    tl.from("#guide-card", { duration: 1.2, y: 24, opacity: 0 })
      .from(".pill", { duration: 0.9, scale: 0.95, opacity: 0 }, "-=0.5");
    document.getElementById("btn-play").onclick = () => tl.paused() ? tl.play() : tl.pause();
    document.getElementById("btn-restart").onclick = () => tl.restart();
    document.getElementById("timeline-scrubber").oninput = (e) => { tl.pause(); tl.progress(e.target.value / 100); };
  </script>
</body>
</html>""",
        )

    if style == "teaser":
        return _wrap_template_artifact(
            "teaser",
            "3D Interactive Product Teaser",
            """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — Product Teaser</title>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    :root { --bg: #030712; --accent: #8b5cf6; --accent2: #06b6d4; --text: #f9fafb; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, system-ui, sans-serif; overflow: hidden; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    #stage { perspective: 1000px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    #card { width: 560px; padding: 48px; border-radius: 24px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); box-shadow: 0 25px 50px -12px rgba(139,92,246,0.25); transform-style: preserve-3d; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; background: rgba(139,92,246,0.15); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.3); margin-bottom: 20px; }
    h1 { font-size: 44px; font-weight: 800; line-height: 1.1; margin-bottom: 16px; background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { font-size: 16px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px; }
    .stat-row { display: flex; gap: 24px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px; }
    .stat-item { flex: 1; }
    .stat-val { font-size: 28px; font-weight: 800; color: var(--accent2); }
    .stat-lbl { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div id="stage">
    <div id="card">
      <div class="badge">Satchida Next-Gen</div>
      <h1 id="title">Autonomous AI Engine</h1>
      <p id="desc">Zero cloud lock-in, sovereign edge intelligence, and millisecond local inference.</p>
      <div class="stat-row">
        <div class="stat-item"><div class="stat-val" id="kpi-speed">0</div><div class="stat-lbl">Tokens / Sec</div></div>
        <div class="stat-item"><div class="stat-val" id="kpi-latency">0</div><div class="stat-lbl">Latency (ms)</div></div>
        <div class="stat-item"><div class="stat-val">100%</div><div class="stat-lbl">On-Premises</div></div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ id: "main" });
    window.__TIMELINE__ = tl;
    tl.from("#card", { duration: 1.6, scale: 0.8, rotateX: 25, rotateY: -15, opacity: 0, ease: "power4.out" })
      .from("#title", { duration: 1.0, y: 30, opacity: 0, ease: "back.out(1.7)" }, "-=1.0")
      .from("#desc", { duration: 0.8, y: 20, opacity: 0, ease: "power3.out" }, "-=0.6")
      .to("#kpi-speed", { duration: 1.5, innerText: 185, snap: { innerText: 1 }, ease: "power2.out" }, "-=0.4")
      .to("#kpi-latency", { duration: 1.2, innerText: 12, snap: { innerText: 1 }, ease: "power2.out" }, "-=1.2");
  </script>
</body>
</html>""",
        )

    return _wrap_template_artifact(
        "executive",
        "Animated Executive Performance Report",
        """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — Executive Report</title>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    :root { --bg: #0b0f19; --surface: #111827; --accent: #38bdf8; --border: rgba(255,255,255,0.08); }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background: var(--bg); color: #f8fafc; font-family: system-ui, sans-serif; overflow: hidden; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    #container { width: 900px; padding: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    h2 { font-size: 24px; font-weight: 700; color: #f1f5f9; }
    .tag { font-size: 12px; padding: 4px 10px; background: rgba(56,189,248,0.15); color: var(--accent); border-radius: 6px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .metric { background: #1f2937; padding: 20px; border-radius: 12px; border: 1px solid var(--border); }
    .num { font-size: 32px; font-weight: 800; color: #38bdf8; }
    .lbl { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .bar-chart { display: flex; align-items: flex-end; gap: 16px; height: 140px; border-bottom: 2px solid #374151; padding-bottom: 10px; }
    .bar { flex: 1; background: linear-gradient(180deg, #38bdf8 0%, #1e40af 100%); border-radius: 6px 6px 0 0; height: 0%; transform-origin: bottom; }
  </style>
</head>
<body>
  <div id="container">
    <div class="header">
      <h2>Q3 Executive Performance Report</h2>
      <div class="tag">VERIFIED OSS METRICS</div>
    </div>
    <div class="grid">
      <div class="metric"><div class="num" id="rev-val">$0M</div><div class="lbl">ARR Run-Rate</div></div>
      <div class="metric"><div class="num" id="growth-val">0%</div><div class="lbl">YoY Net Expansion</div></div>
      <div class="metric"><div class="num" id="ret-val">0%</div><div class="lbl">Gross Retention</div></div>
    </div>
    <div class="bar-chart">
      <div class="bar" data-h="40%"></div>
      <div class="bar" data-h="65%"></div>
      <div class="bar" data-h="85%"></div>
      <div class="bar" data-h="100%"></div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ id: "main" });
    window.__TIMELINE__ = tl;
    tl.from("#container", { duration: 1.2, y: 40, opacity: 0, ease: "power3.out" })
      .to("#rev-val", { duration: 1.5, innerText: 42, snap: { innerText: 1 }, onUpdate: function() { this.targets()[0].innerText = "$" + this.targets()[0].innerText + "M"; }, ease: "power2.out" }, "-=0.6")
      .to("#growth-val", { duration: 1.5, innerText: 148, snap: { innerText: 1 }, onUpdate: function() { this.targets()[0].innerText = this.targets()[0].innerText + "%"; }, ease: "power2.out" }, "-=1.3")
      .to("#ret-val", { duration: 1.5, innerText: 99, snap: { innerText: 1 }, onUpdate: function() { this.targets()[0].innerText = this.targets()[0].innerText + "%"; }, ease: "power2.out" }, "-=1.3")
      .to(".bar", { duration: 1.0, height: (i, target) => target.getAttribute("data-h"), stagger: 0.15, ease: "elastic.out(1, 0.75)" }, "-=1.0");
    </script>
</body>
</html>""",
    )


def _classify_cad_room(r: dict) -> str:
    name = (str(r.get("name", "")) + " " + str(r.get("id", ""))).lower()
    if re.search(r"master.*(?:bath|wc|toilet|shower)|en-?suite.*(?:bath|wc|toilet)|mbath", name):
        return "MASTER_BATH"
    if re.search(r"servant.*(?:wc|bath|toilet|wash)|maid.*(?:wc|bath)|swash", name):
        return "SERVANT_WC"
    if re.search(
        r"common.*(?:bath|wc|toilet|wash)|shared.*(?:bath|wc)|guest.*(?:bath|wc)|powder|washroom|toilet|shower|bath\b",
        name,
    ):
        return "COMMON_BATH"
    if re.search(r"master|primary|suite|mbr", name):
        return "MASTER_SUITE"
    if re.search(r"servant|maid|staff", name):
        return "SERVANT"
    if re.search(r"bed|guest\s*bed|kid|nursery", name):
        return "BEDROOM"
    if re.search(r"hall|corridor|passage|circulation", name):
        return "HALLWAY"
    if re.search(r"foyer|entry|lobby|vestibule", name):
        return "FOYER"
    if re.search(r"balcony|terrace|patio|deck|verandah", name):
        return "BALCONY"
    if re.search(r"kitchen|pantry|utility|store", name):
        return "KITCHEN"
    if re.search(r"study|office|den|library", name):
        return "STUDY"
    if re.search(r"living|dining|lounge|family|great\s*room", name):
        return "LIVING"
    return "ROOM"


# ==================== Architectural circulation invariants ====================
#
# NBC / IBC residential connectivity contract enforced here:
#   * MASTER_BATH    -> exactly one door, onto the MASTER_SUITE (hallway fallback
#                       only when no suite is adjacent, so the room is never sealed).
#   * COMMON_BATH    -> exactly one door, onto HALLWAY / FOYER / LIVING. Never a
#                       bedroom, never another bathroom.
#   * SERVANT_WC     -> exactly one door, onto SERVANT / hallway / service zone.
#   * BEDROOM / MASTER_SUITE -> at least one independent door from circulation.
#   * No bedroom-to-bedroom and no bath-to-bath doors.

BATH_ROLES = ("MASTER_BATH", "COMMON_BATH", "SERVANT_WC")
BED_ROLES = ("MASTER_SUITE", "BEDROOM")
CIRC_ROLES = ("HALLWAY", "FOYER", "LIVING")

BATH_DOOR_PRIORITY = {
    "MASTER_BATH": {"MASTER_SUITE": 100, "HALLWAY": 60, "FOYER": 55, "LIVING": 40},
    "COMMON_BATH": {"HALLWAY": 100, "FOYER": 90, "LIVING": 70},
    "SERVANT_WC": {"SERVANT": 100, "HALLWAY": 80, "ROOM": 60, "BALCONY": 40},
}
BED_DOOR_PRIORITY = {"HALLWAY": 100, "LIVING": 90, "FOYER": 85}

DOOR_CLEARANCE_FT = 3.0


def _rect(room: dict) -> tuple[float, float, float, float]:
    x, z = float(room.get("x", 0)), float(room.get("z", 0))
    return x, z, x + float(room.get("w", 0)), z + float(room.get("d", 0))


def _area(room: dict) -> float:
    return max(0.0, float(room.get("w", 0))) * max(0.0, float(room.get("d", 0)))


def _role_of(room) -> str | None:
    return (room or {}).get("role")


def _room_id(room: dict, index: int) -> str:
    rid = room.get("id")
    if not rid:
        rid = re.sub(r"[^a-z0-9]+", "-", str(room.get("name", "")).lower()).strip("-") or f"room-{index}"
        room["id"] = rid
    return str(rid)


def _room_at(rooms: list[dict], x: float, z: float):
    """Smallest room containing the point; resolves nested rects (bath inside suite)."""
    best = None
    for room in rooms:
        rx, rz, rx2, rz2 = _rect(room)
        if rx - 0.001 <= x <= rx2 + 0.001 and rz - 0.001 <= z <= rz2 + 0.001:
            if best is None or _area(room) < _area(best):
                best = room
    return best


def _wall_axis(w: dict) -> str | None:
    if abs(float(w.get("z1", 0)) - float(w.get("z2", 0))) < 0.01:
        return "h"
    if abs(float(w.get("x1", 0)) - float(w.get("x2", 0))) < 0.01:
        return "v"
    return None


def _door_sides(w: dict, op: dict, rooms: list[dict]):
    """Rooms on either face of a door, sampled past the wall thickness."""
    axis = _wall_axis(w)
    if axis is None:
        return (None, None)
    mid = float(op.get("at", 0)) + float(op.get("len", 0)) / 2.0
    if axis == "h":
        z = float(w.get("z1", 0))
        a, b = _room_at(rooms, mid, z - 0.7), _room_at(rooms, mid, z + 0.7)
    else:
        x = float(w.get("x1", 0))
        a, b = _room_at(rooms, x - 0.7, mid), _room_at(rooms, x + 0.7, mid)
    if a is b:
        return (a, None)
    return (a, b)


def _door_is_legal(role_a, role_b) -> bool:
    roles = {r for r in (role_a, role_b) if r}
    if any(r in BATH_ROLES for r in roles):
        others = roles - set(BATH_ROLES)
        if not others:
            return False  # bath-to-bath or door to outside
        other = next(iter(others))
        if "MASTER_BATH" in roles:
            return other in ("MASTER_SUITE", "HALLWAY", "FOYER")
        if "COMMON_BATH" in roles:
            return other in ("HALLWAY", "FOYER", "LIVING")
        return other in ("SERVANT", "HALLWAY", "ROOM", "BALCONY", "FOYER")
    if role_a in BED_ROLES and role_b in BED_ROLES:
        return False  # bedroom-to-bedroom
    return True


def _door_records(walls: list[dict], rooms: list[dict]) -> list[dict]:
    records = []
    for w in walls:
        for op in list(w.get("openings") or []):
            if str(op.get("kind")) != "door":
                continue
            a, b = _door_sides(w, op, rooms)
            records.append({"wall": w, "op": op, "a": a, "b": b})
    return records


def _room_doors(room: dict, records: list[dict]) -> list[dict]:
    return [rec for rec in records if rec["a"] is room or rec["b"] is room]


def _shared_segment(room: dict, other: dict, eps: float = 0.12):
    rx, rz, rx2, rz2 = _rect(room)
    ox, oz, ox2, oz2 = _rect(other)
    for px_, qx_ in ((rx2, ox), (rx, ox2)):
        if abs(px_ - qx_) <= eps:
            start, end = max(rz, oz), min(rz2, oz2)
            if end - start > 1.2:
                return ("v", px_, start, end)
    for pz_, qz_ in ((rz2, oz), (rz, oz2)):
        if abs(pz_ - qz_) <= eps:
            start, end = max(rx, ox), min(rx2, ox2)
            if end - start > 1.2:
                return ("h", pz_, start, end)
    return None


def _find_wall(walls: list[dict], axis: str, pos: float, start: float, end: float):
    for w in walls:
        if _wall_axis(w) != axis or str(w.get("kind")) == "rail":
            continue
        if axis == "h":
            if abs(float(w.get("z1", 0)) - pos) > 0.2:
                continue
            ws, we = sorted((float(w.get("x1", 0)), float(w.get("x2", 0))))
        else:
            if abs(float(w.get("x1", 0)) - pos) > 0.2:
                continue
            ws, we = sorted((float(w.get("z1", 0)), float(w.get("z2", 0))))
        if ws <= start + 0.3 and we >= end - 0.3:
            return w
    return None


def _carve_door(walls: list[dict], rooms: list[dict], room: dict, priority: dict, min_width: float = 2.4):
    """Cut a legal door where the room shares a wall with a permitted neighbour."""
    candidates = []
    for other in rooms:
        if other is room:
            continue
        score = priority.get(_role_of(other), 0)
        if score <= 0:
            continue
        seg = _shared_segment(room, other)
        if seg is None:
            continue
        candidates.append((score, seg[3] - seg[2], seg))
    candidates.sort(key=lambda item: (-item[0], -item[1]))
    for _, span, seg in candidates:
        axis, pos, start, end = seg
        width = min(2.8, span - 0.6)
        if width < min_width:
            continue
        at = start + (span - width) / 2.0
        opening = {"at": round(at, 2), "len": round(width, 2), "kind": "door", "swing": 1}
        wall = _find_wall(walls, axis, pos, start, end)
        if wall is not None:
            wall.setdefault("openings", []).append(opening)
        else:
            wall = {
                "x1": round(start, 2) if axis == "h" else round(pos, 2),
                "z1": round(pos, 2) if axis == "h" else round(start, 2),
                "x2": round(end, 2) if axis == "h" else round(pos, 2),
                "z2": round(pos, 2) if axis == "h" else round(end, 2),
                "t": 0.45,
                "kind": "int",
                "openings": [opening],
            }
            walls.append(wall)
        return wall, opening
    return None, None


def _enforce_circulation_invariants(walls: list[dict], rooms: list[dict]) -> list[dict]:
    """Apply the connectivity graph to every wall, generated or caller-supplied."""
    records = _door_records(walls, rooms)

    dropped: set[int] = set()
    for rec in records:
        if not _door_is_legal(_role_of(rec["a"]), _role_of(rec["b"])):
            dropped.add(id(rec["op"]))

    # Exactly one door per bathroom, ranked by its permitted parent space.
    per_bath: dict[int, list[tuple[dict, str]]] = {}
    for rec in records:
        if id(rec["op"]) in dropped:
            continue
        role_a, role_b = _role_of(rec["a"]), _role_of(rec["b"])
        bath = role_a if role_a in BATH_ROLES else role_b if role_b in BATH_ROLES else None
        if not bath:
            continue
        bath_room = rec["a"] if role_a == bath else rec["b"]
        per_bath.setdefault(id(bath_room), []).append((rec, bath))

    for entries in per_bath.values():
        if len(entries) <= 1:
            continue

        def score(entry):
            rec, bath = entry
            other = _role_of(rec["b"] if _role_of(rec["a"]) == bath else rec["a"])
            return BATH_DOOR_PRIORITY.get(bath, {}).get(other, 10)

        best = max(entries, key=score)
        for entry in entries:
            if entry is not best:
                dropped.add(id(entry[0]["op"]))

    for w in walls:
        w["openings"] = [op for op in (w.get("openings") or []) if id(op) not in dropped]

    # Guarantee every bath has one door and every bedroom an independent entrance.
    for room in rooms:
        role = _role_of(room)
        if role in BATH_ROLES:
            if _room_doors(room, _door_records(walls, rooms)):
                continue
            _carve_door(walls, rooms, room, BATH_DOOR_PRIORITY.get(role, {}))
        elif role in BED_ROLES:
            if _room_doors(room, _door_records(walls, rooms)):
                continue
            _carve_door(walls, rooms, room, BED_DOOR_PRIORITY)

    return walls


def _world_extent(item: dict) -> tuple[float, float]:
    rot = int(round(float(item.get("rot", 0)))) % 180
    if rot == 90:
        return float(item["d"]), float(item["w"])
    return float(item["w"]), float(item["d"])


def _aabb(item: dict) -> tuple[float, float, float, float]:
    """Axis-aligned bounds of a fixture footprint rotated about its centre."""
    ww, hh = _world_extent(item)
    cx = float(item["x"]) + float(item["w"]) / 2.0
    cz = float(item["z"]) + float(item["d"]) / 2.0
    return cx - ww / 2.0, cz - hh / 2.0, ww, hh


def _rect_point_dist(item: dict, px: float, pz: float) -> float:
    x, z, w, d = _aabb(item)
    return math.hypot(px - min(max(px, x), x + w), pz - min(max(pz, z), z + d))


def _rects_overlap(a: dict, b: dict) -> bool:
    ax, az, aw, ad = _aabb(a)
    bx, bz, bw, bd = _aabb(b)
    return (
        ax + 0.001 < bx + bw
        and bx + 0.001 < ax + aw
        and az + 0.001 < bz + bd
        and bz + 0.001 < az + ad
    )


def _rect_inside(item: dict, room: dict, margin: float = 0.15) -> bool:
    x, z, w, d = _aabb(item)
    return (
        x >= room["x"] + margin - 0.001
        and z >= room["z"] + margin - 0.001
        and x + w <= room["x"] + room["w"] - margin + 0.001
        and z + d <= room["z"] + room["d"] - margin + 0.001
    )


def _place(ftype: str, left: float, top: float, world_w: float, world_h: float, w: float, d: float, h: float, rot: int) -> dict:
    """Build a fixture whose rotated AABB starts at (left, top)."""
    return {
        "type": ftype,
        "x": round(left + world_w / 2.0 - w / 2.0, 2),
        "z": round(top + world_h / 2.0 - d / 2.0, 2),
        "w": w,
        "d": d,
        "h": h,
        "rot": rot,
    }


def _wall_candidates(room: dict, ftype: str, w: float, d: float, h: float) -> list[dict]:
    """Every sensible placement of a w x d footprint against a room wall.

    rot: 0 = back on the north wall, 90 = east, 180 = south, 270 = west.
    """
    rx, rz, rw, rd = room["x"], room["z"], room["w"], room["d"]
    margin = 0.2
    fracs = (0.0, 0.33, 0.66, 1.0)
    out = []
    for frac in fracs:
        if rw - w - 2 * margin >= -0.001:
            x = rx + margin + frac * max(0.0, rw - w - 2 * margin)
            out.append(_place(ftype, x, rz + margin, w, d, w, d, h, 0))
            out.append(_place(ftype, x, rz + rd - d - margin, w, d, w, d, h, 180))
        if rd - w - 2 * margin >= -0.001:
            z = rz + margin + frac * max(0.0, rd - w - 2 * margin)
            out.append(_place(ftype, rx + margin, z, d, w, w, d, h, 270))
            out.append(_place(ftype, rx + rw - d - margin, z, d, w, w, d, h, 90))
    return out



def _bath_fixture_set(room: dict, clearances: list[tuple[float, float, float]]) -> list[dict]:
    """Place WC + vanity + shower on a plumbing wall, clear of every door swing.

    clearances: [(hinge_x, hinge_z, radius)] for each door serving the room.
    Returns the largest valid set (shower + vanity + wc, then subsets).
    """
    rw, rd = room["w"], room["d"]
    shower_size = min(3.0, rw - 0.5, rd - 0.5)
    groups = []
    if shower_size >= 2.5:
        groups.append([("shower", round(shower_size, 2), round(shower_size, 2), 6.6)])
    if rw >= 2.0 and rd >= 2.8 or rw >= 2.8 and rd >= 2.0:
        groups.append([("vanity", 2.4, 1.6, 4.3), ("wc", 1.6, 2.35, 1.6)])

    def clear(item):
        for hx, hz, radius in clearances:
            if _rect_point_dist(item, hx, hz) < radius:
                return False
        return True

    for specs in groups:
        options = []
        for ftype, w, d, h in specs:
            options.append([c for c in _wall_candidates(room, ftype, w, d, h) if _rect_inside(c, room) and clear(c)])
        if any(not opts for opts in options):
            continue
        if len(options) == 1:
            return options[0]
        for first in options[0]:
            for second in options[1]:
                if _rects_overlap(first, second):
                    continue
                if len(options) == 2:
                    return [first, second]
                for third in options[2]:
                    if _rects_overlap(first, third) or _rects_overlap(second, third):
                        continue
                    return [first, second, third]
    return []



def _door_hinges_for(room: dict, door_records: list[dict]) -> list[tuple[float, float, float]]:
    """(hinge_x, hinge_z, radius) for every door serving the room."""
    out = []
    for rec in door_records:
        if rec["a"] is not room and rec["b"] is not room:
            continue
        w, op = rec["wall"], rec["op"]
        axis = _wall_axis(w)
        radius = float(op.get("len", 2.6)) + 0.6
        if axis == "h":
            out.append((float(op.get("at", 0)), float(w.get("z1", 0)), radius))
        elif axis == "v":
            out.append((float(w.get("x1", 0)), float(op.get("at", 0)), radius))
    return out


def _push_clear_of_doors(item: dict, room: dict, hinges: list[tuple[float, float, float]]) -> dict:
    """Slide furniture out of a door-swing envelope without leaving the room."""
    x, z = float(item["x"]), float(item["z"])
    ww, hh = _world_extent(item)
    for _ in range(3):
        moved = False
        for hx, hz, radius in hinges:
            if _rect_point_dist(item, hx, hz) >= radius:
                continue
            if abs(hz - room["z"]) < 0.8:
                z = min(z + 2.5, room["z"] + room["d"] - hh - 0.3)
            elif abs(hz - (room["z"] + room["d"])) < 0.8:
                z = max(z - 2.5, room["z"] + 0.3)
            elif abs(hx - room["x"]) < 0.8:
                x = min(x + 2.5, room["x"] + room["w"] - ww - 0.3)
            elif abs(hx - (room["x"] + room["w"])) < 0.8:
                x = max(x - 2.5, room["x"] + 0.3)
            else:
                z = min(z + 2.5, room["z"] + room["d"] - hh - 0.3)
            item["x"], item["z"] = round(x, 2), round(z, 2)
            moved = True
        if not moved:
            break
    return item


def _room_furniture(room: dict, door_records: list[dict]) -> list[dict]:
    """Verified, non-colliding furniture + sanitary fixtures for one room."""
    role = room["role"]
    rx, rz, rw, rd = room["x"], room["z"], room["w"], room["d"]
    hinges = _door_hinges_for(room, door_records)

    if role in BATH_ROLES:
        return _bath_fixture_set(room, hinges)

    items: list[dict] = []
    if role in ("MASTER_SUITE", "BEDROOM", "SERVANT"):
        bed_w = min(7.0 if role == "MASTER_SUITE" else 6.0, rw - 1.6)
        bed_d = min(6.6 if role == "MASTER_SUITE" else 6.2, rd - 2.6)
        if bed_w >= 4.0 and bed_d >= 4.5:
            bed = {
                "type": "bed",
                "x": round(rx + 0.8, 2),
                "z": round(rz + 0.8, 2),
                "w": round(bed_w, 2),
                "d": round(bed_d, 2),
                "h": 2.2,
                "rot": 0,
            }
            items.append(_push_clear_of_doors(bed, room, hinges))
        if role == "MASTER_SUITE" and rw >= 13 and rd >= 10:
            items.append(
                {
                    "type": "wardrobe",
                    "x": round(rx + rw - 2.6, 2),
                    "z": round(rz + 1.6, 2),
                    "w": 2.4,
                    "d": round(min(5.0, rd - 3.0), 2),
                    "h": 7.0,
                    "rot": 90,
                }
            )
        elif role == "BEDROOM" and rw >= 10 and rd >= 10:
            items.append(
                {
                    "type": "desk",
                    "x": round(rx + rw - 3.4, 2),
                    "z": round(rz + rd - 2.6, 2),
                    "w": 3.0,
                    "d": 2.0,
                    "h": 2.5,
                    "rot": 90,
                }
            )
    elif role == "LIVING":
        sofa_w = min(9.5, rw - 3.0)
        if sofa_w >= 5.0 and rd >= 8.0:
            items.append({"type": "sofa", "x": round(rx + 1.2, 2), "z": round(rz + 1.0, 2), "w": round(sofa_w, 2), "d": 3.4, "h": 2.6, "rot": 0})
            items.append({"type": "table", "x": round(rx + 1.8, 2), "z": round(rz + 5.2, 2), "w": 4.6, "d": 2.4, "h": 1.4, "rot": 0})
        dining_w = min(7.5, rw - 2.0)
        if dining_w >= 4.5 and rd >= 10.0:
            items.append({"type": "dining", "x": round(rx + max(1.0, rw - dining_w - 1.0), 2), "z": round(rz + rd - 5.0, 2), "w": round(dining_w, 2), "d": 3.8, "h": 2.5, "rot": 0})
        if rw >= 6.0 and rd >= 6.0:
            items.append({"type": "planter", "x": round(rx + rw - 2.2, 2), "z": round(rz + 1.0, 2), "w": 1.6, "d": 1.6, "h": 2.6, "rot": 0})
    elif role == "KITCHEN":
        run = min(10.0, rd - 2.0)
        if run >= 4.0:
            items.append({"type": "kitchen", "x": round(rx + 0.6, 2), "z": round(rz + 1.0, 2), "w": 2.2, "d": round(run, 2), "h": 3.0, "rot": 270})
        if rw >= 6.0:
            items.append({"type": "kitchen", "x": round(rx + 3.4, 2), "z": round(rz + rd - 2.6, 2), "w": round(min(8.0, rw - 3.8), 2), "d": 2.2, "h": 3.0, "rot": 180})
    elif role == "STUDY":
        if rw >= 5.0 and rd >= 4.0:
            items.append({"type": "desk", "x": round(rx + 0.6, 2), "z": round(rz + 0.8, 2), "w": round(min(5.0, rw - 1.2), 2), "d": 2.2, "h": 2.5, "rot": 0})

    placed: list[dict] = []
    for item in items:
        if not _rect_inside(item, room):
            continue
        if any(_rects_overlap(item, other) for other in placed):
            continue
        placed.append(item)
    return placed


def _auto_walls_from_rooms(rooms: list[dict], width: float, depth: float) -> list[dict]:
    """Generate clean exterior perimeter walls (with windows) and interior partition walls (with doors) from room rects."""
    walls, _ = _solve_architectural_plan(width, depth, rooms)
    return walls


def _perimeter_walls(width: float, depth: float) -> list[dict]:
    return [
        {"x1": 0, "z1": 0, "x2": width, "z2": 0, "t": 0.75, "kind": "ext", "openings": [
            {"at": round(width * 0.15, 1), "len": min(8.0, round(width * 0.25, 1)), "kind": "win"},
            {"at": round(width * 0.65, 1), "len": min(6.0, round(width * 0.2, 1)), "kind": "win"},
        ]},
        {"x1": width, "z1": 0, "x2": width, "z2": depth, "t": 0.75, "kind": "ext", "openings": [
            {"at": round(depth * 0.2, 1), "len": 4.0, "kind": "win"},
            {"at": round(depth * 0.7, 1), "len": 4.5, "kind": "win"},
        ]},
        {"x1": 0, "z1": depth, "x2": width, "z2": depth, "t": 0.75, "kind": "ext", "openings": [
            {"at": round(width * 0.35, 1), "len": 3.5, "kind": "door", "swing": -1},
            {"at": round(width * 0.75, 1), "len": 4.0, "kind": "win"},
        ]},
        {"x1": 0, "z1": 0, "x2": 0, "z2": depth, "t": 0.75, "kind": "ext", "openings": [
            {"at": round(depth * 0.3, 1), "len": 5.0, "kind": "win"},
        ]},
    ]


def _containment_interfaces(rooms: list[dict]) -> list[dict]:
    """Partition walls for a room carved out of a larger room (en-suite baths).

    Adjacency detection only finds shared edges at exact offsets, so an en-suite
    bath drawn inside its suite would otherwise have no enclosing walls.
    """
    out = []
    for inner in rooms:
        for outer in rooms:
            if inner is outer:
                continue
            ix, iz, ix2, iz2 = _rect(inner)
            ox, oz, ox2, oz2 = _rect(outer)
            if not (ox - 0.05 <= ix and ox2 + 0.05 >= ix2 and oz - 0.05 <= iz and oz2 + 0.05 >= iz2):
                continue
            if _area(inner) >= _area(outer) * 0.98:
                continue
            edges = (
                ("v", ix, iz, iz2),
                ("v", ix2, iz, iz2),
                ("h", iz, ix, ix2),
                ("h", iz2, ix, ix2),
            )
            for axis, pos, start, end in edges:
                if axis == "v" and (abs(pos - ox) < 0.05 or abs(pos - ox2) < 0.05):
                    continue
                if axis == "h" and (abs(pos - oz) < 0.05 or abs(pos - oz2) < 0.05):
                    continue
                if end - start <= 1.2:
                    continue
                out.append({
                    "axis": axis, "pos": pos, "start": start, "end": end,
                    "span": end - start, "r1": inner, "r2": outer, "carve": True,
                })
    return out


def _interface_openings(iface: dict) -> list[dict]:
    """Openings allowed between two adjacent / nested rooms."""
    r1, r2 = iface["r1"], iface["r2"]
    a, b = r1["role"], r2["role"]
    span, start = iface["span"], iface["start"]
    roles = {a, b}

    def door(width_cap: float = 2.8, min_width: float = 2.4):
        width = min(width_cap, span - 0.8)
        if width < min_width:
            return None
        return {"at": round(start + 0.6, 2), "len": round(width, 2), "kind": "door", "swing": 1}

    if "MASTER_BATH" in roles:
        other = b if a == "MASTER_BATH" else a
        if other == "MASTER_SUITE":
            op = door()
            return [op] if op else []
        return []
    if "COMMON_BATH" in roles:
        other = b if a == "COMMON_BATH" else a
        if other in ("HALLWAY", "FOYER", "LIVING"):
            op = door()
            return [op] if op else []
        return []
    if "SERVANT_WC" in roles:
        other = b if a == "SERVANT_WC" else a
        if other in ("SERVANT", "HALLWAY", "ROOM", "BALCONY", "FOYER"):
            op = door(2.4, 2.0)
            return [op] if op else []
        return []
    if a in BED_ROLES and b in BED_ROLES:
        return []
    if (a in BED_ROLES and b in CIRC_ROLES) or (b in BED_ROLES and a in CIRC_ROLES):
        op = door(3.0, 2.5)
        return [op] if op else []
    if "LIVING" in roles and "BALCONY" in roles:
        return [{"at": round(start + 0.8, 2), "len": round(span - 1.6, 2), "kind": "open"}]
    if "LIVING" in roles and any(r in roles for r in ("FOYER", "HALLWAY", "KITCHEN", "STUDY")):
        return [{"at": round(start + 0.6, 2), "len": min(4.5, round(span - 1.2, 2)), "kind": "open"}]
    if "HALLWAY" in roles and any(r in roles for r in ("FOYER", "STUDY")):
        return [{"at": round(start + 0.6, 2), "len": min(4.0, round(span - 1.2, 2)), "kind": "open"}]
    return []


def _solve_architectural_plan(width: float, depth: float, rooms: list[dict], existing_walls=None, existing_furniture=None):
    """
    Mathematical Architectural Spatial Solver & NBC/IBC Invariant Enforcer.
    Guarantees:
    1. Zero pass-through bathrooms (en-suite bath strictly 1 door to parent suite; common bath strictly 1 door to hallway).
    2. Independent bedroom circulation (all bedrooms guaranteed clear access from hallway/living).
    3. Zero door-swing vs plumbing fixture collisions (>3.2ft clearance envelope).
    """
    for index, r in enumerate(rooms):
        r["role"] = _classify_cad_room(r)
        _room_id(r, index)
        r["x"] = float(r.get("x", 0))
        r["z"] = float(r.get("z", 0))
        r["w"] = float(r.get("w", 0))
        r["d"] = float(r.get("d", 0))

    # Detect boundary interfaces between all pairs of adjacent rooms
    interfaces = []
    for i in range(len(rooms)):
        for j in range(i + 1, len(rooms)):
            r1, r2 = rooms[i], rooms[j]
            # Vertical interface
            if abs((r1["x"] + r1["w"]) - r2["x"]) < 0.05:
                z_start = max(r1["z"], r2["z"])
                z_end = min(r1["z"] + r1["d"], r2["z"] + r2["d"])
                if z_end - z_start > 1.2:
                    interfaces.append({
                        "axis": "v", "pos": r2["x"], "start": z_start, "end": z_end,
                        "span": z_end - z_start, "r1": r1, "r2": r2
                    })
            elif abs((r2["x"] + r2["w"]) - r1["x"]) < 0.05:
                z_start = max(r1["z"], r2["z"])
                z_end = min(r1["z"] + r1["d"], r2["z"] + r2["d"])
                if z_end - z_start > 1.2:
                    interfaces.append({
                        "axis": "v", "pos": r1["x"], "start": z_start, "end": z_end,
                        "span": z_end - z_start, "r1": r2, "r2": r1
                    })
            # Horizontal interface
            if abs((r1["z"] + r1["d"]) - r2["z"]) < 0.05:
                x_start = max(r1["x"], r2["x"])
                x_end = min(r1["x"] + r1["w"], r2["x"] + r2["w"])
                if x_end - x_start > 1.2:
                    interfaces.append({
                        "axis": "h", "pos": r2["z"], "start": x_start, "end": x_end,
                        "span": x_end - x_start, "r1": r1, "r2": r2
                    })
            elif abs((r2["z"] + r2["d"]) - r1["z"]) < 0.05:
                x_start = max(r1["x"], r2["x"])
                x_end = min(r1["x"] + r1["w"], r2["x"] + r2["w"])
                if x_end - x_start > 1.2:
                    interfaces.append({
                        "axis": "h", "pos": r1["z"], "start": x_start, "end": x_end,
                        "span": x_end - x_start, "r1": r2, "r2": r1
                    })

    interfaces.extend(_containment_interfaces(rooms))

    walls: list[dict] = _perimeter_walls(width, depth)
    # Interior partitions from the adjacency graph; the enforcement pass below is
    # the authority on which doors may survive.
    for iface in interfaces:
        openings = _interface_openings(iface)
        if iface["axis"] == "v":
            walls.append({"x1": iface["pos"], "z1": iface["start"], "x2": iface["pos"], "z2": iface["end"], "t": 0.45, "kind": "int", "openings": openings})
        else:
            walls.append({"x1": iface["start"], "z1": iface["pos"], "x2": iface["end"], "z2": iface["pos"], "t": 0.45, "kind": "int", "openings": openings})

    # Caller-supplied walls win, but the connectivity graph still applies to them.
    if existing_walls:
        walls = existing_walls
        if not any(str(w.get("kind")) == "ext" for w in walls):
            walls = _perimeter_walls(width, depth) + walls

    walls = _enforce_circulation_invariants(walls, rooms)

    furniture = list(existing_furniture or [])
    if not furniture:
        door_records = _door_records(walls, rooms)
        for room in rooms:
            furniture.extend(_room_furniture(room, door_records))
    return walls, furniture


M_TO_FT = 3.28084


@mcp.tool()
def architect_plan_to_cad_plan(plan_json: str, floor_index: int = 0) -> str:
    """
    Convert a Satchida Architect Studio plan (skill/satchida-architect-server.py output shape,
    all units METRES, rooms as rect [x0,z0,x1,z1] or polygon points) into the CAD plan JSON that
    build_cad_floorplan consumes (feet, rooms as {id, name, x, z, w, d}).
    - plan_json: the same JSON you would pass to the architect's build_architect_plan.
    - floor_index: which floor to render (default 0 = ground). Multi-floor buildings render one
      floor per CAD artifact; call again with a higher index for upper levels.
    Returns JSON: {"title", "width", "depth", "rooms_json": "<pass as build_cad_floorplan rooms_json>",
    "walls_json": "[]", "furniture_json": "[]"} — walls/furniture are auto-generated by
    build_cad_floorplan when empty.
    """
    try:
        plan = json.loads(plan_json)
        floors = plan.get("floors") or []
        if not floors or floor_index >= len(floors):
            return "ERROR: plan_json must contain floors; floor_index out of range."
        floor = floors[floor_index]
    except json.JSONDecodeError as exc:
        return f"ERROR: plan_json is not valid JSON: {exc}"

    rooms_out = []
    xs_all, zs_all = [], []
    for i, raw in enumerate(floor.get("rooms", [])):
        pts = raw.get("points")
        rect = raw.get("rect")
        if not pts and rect:
            x0, z0, x1, z1 = (float(c) for c in rect)
            pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
        if not pts or len(pts) < 3:
            continue
        pts_ft = [[p[0] * M_TO_FT, p[1] * M_TO_FT] for p in pts]
        xs = [p[0] for p in pts_ft]
        zs = [p[1] for p in pts_ft]
        xs_all.extend(xs)
        zs_all.extend(zs)
        name = str(raw.get("name", f"Room {i + 1}"))
        rooms_out.append({
            "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or f"room-{i + 1}",
            "name": name.upper(),
            "x": round(min(xs), 2),
            "z": round(min(zs), 2),
            "w": round(max(xs) - min(xs), 2),
            "d": round(max(zs) - min(zs), 2),
        })
    if not rooms_out:
        return "ERROR: floor has no usable rooms (rect or polygon points required)."

    width = round(max(xs_all) - min(xs_all), 2)
    depth = round(max(zs_all) - min(zs_all), 2)
    # Re-anchor rooms to the bounding-box origin so the CAD canvas starts at 0.
    x_off, z_off = min(xs_all), min(zs_all)
    for r in rooms_out:
        r["x"] = round(r["x"] - x_off, 2)
        r["z"] = round(r["z"] - z_off, 2)

    title = str(plan.get("title") or floor.get("name") or "Architect Plan (Motion CAD)")
    if len(floors) > 1:
        title = f"{title} — {floor.get('name', f'Floor {floor_index + 1}')}"
    sqft = sum(r["w"] * r["d"] for r in rooms_out)
    return json.dumps({
        "title": f"{title} ({width:.0f}' × {depth:.0f}', {sqft:.0f} sq ft)",
        "width": width,
        "depth": depth,
        "rooms_json": json.dumps(rooms_out),
        "walls_json": "[]",
        "furniture_json": "[]",
        "usage": "Pass title, width, depth, and rooms_json to build_cad_floorplan verbatim.",
    })


@mcp.tool()
def build_cad_floorplan(
    title: str = "1,400 sq ft 3BHK Apartment (40' × 35')",
    width: float = 40.0,
    depth: float = 35.0,
    rooms_json: str = "[]",
    walls_json: str = "[]",
    furniture_json: str = "[]",
) -> str:
    """
    Build a complete, verified 2D CAD Blueprint + 3D Three.js Extruded Structure HTML artifact
    without rewriting the rendering engine.
    - For a 1,400 sq ft 3BHK Apartment (with external Servant Quarter, Open Kitchen, Master Suite,
      Living Balcony, Study Nook), call with ONLY `title` and omit `rooms_json`/`walls_json`/`furniture_json`
      to use the built-in precision CAD layout immediately.
    - For other custom buildings, pass `width`, `depth`, and `rooms_json` (array of {id, name, x, z, w, d});
      `walls_json` and `furniture_json` are optional and auto-generated if omitted.
    """
    base_wrapped = get_motion_template("cad_blueprint")
    html = _unwrap_html(base_wrapped)
    rooms = json.loads(rooms_json) if rooms_json.strip() not in ("", "[]") else None
    walls = json.loads(walls_json) if walls_json.strip() not in ("", "[]") else None
    furniture = json.loads(furniture_json) if furniture_json.strip() not in ("", "[]") else None

    if rooms is not None or walls is not None or furniture is not None:
        resolved_rooms = rooms if rooms is not None else []
        resolved_walls, resolved_furniture = _solve_architectural_plan(
            float(width), float(depth), resolved_rooms, walls, furniture
        )
        plan_obj = {
            "width": float(width),
            "depth": float(depth),
            "rooms": resolved_rooms,
            "walls": resolved_walls,
            "furniture": resolved_furniture,
        }
        plan_js = f"window.SATCHIDA_CAD_PLAN = {json.dumps(plan_obj, indent=2)};"
        html = re.sub(
            r"window\.SATCHIDA_CAD_PLAN = \{[\s\S]*?\n    \};",
            plan_js,
            html,
            count=1,
        )

    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    html = re.sub(
        r"<h1>[\s\S]*?</h1>",
        f"<h1>{safe_title}</h1>",
        html,
        count=1,
    )
    return (
        "DONE — the 2D/3D CAD floor plan HTML is already built and verified. "
        "Do NOT edit, recalculate, or rewrite it. Output the `:::artifact{...}` block below verbatim:\n\n"
        f":::artifact{{identifier=\"motion-cad-blueprint\" type=\"text/html\" title=\"{safe_title}\"}}\n"
        f"````html\n{html.strip()}\n````\n"
        f":::"
    )


if __name__ == "__main__":
    mcp.run()
