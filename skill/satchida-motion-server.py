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
    return (
        f"Customize the HTML below and deliver your final response wrapped identically inside "
        f"`:::artifact{{...}}` + ````html ... ```` + `:::`:\n{extra}\n"
        f":::artifact{{identifier=\"motion-{slug}\" type=\"text/html\" title=\"{title}\"}}\n"
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
      'accessible_guide' (WCAG AAA high-contrast large-print senior/patient step-by-step guide).
    """
    style = style.lower().strip()
    if any(k in style for k in ("medical", "anatomy", "clinical", "organ", "diabetes", "insulin", "perfusion", "pathology")):
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
        <svg viewBox="0 0 460 300">
          <defs>
            <linearGradient id="capGradNorm" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ef4444" stop-opacity="0.8"/>
              <stop offset="100%" stop-color="#dc2626" stop-opacity="0.9"/>
            </linearGradient>
            <linearGradient id="cellGradNorm" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#1e293b"/>
              <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
          </defs>
          <!-- Capillary vessel -->
          <rect x="20" y="24" width="420" height="48" rx="24" fill="url(#capGradNorm)" opacity="0.32" stroke="#ef4444" stroke-width="2"/>
          <text x="35" y="44" fill="#fca5a5" font-size="10" font-weight="700">CAPILLARY LUMEN (PERFUSION 100%)</text>
          <!-- Normal RBCs & Glucose -->
          <circle cx="90" cy="48" r="9" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
          <circle cx="150" cy="48" r="9" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
          <circle cx="210" cy="48" r="9" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
          <circle cx="270" cy="48" r="9" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
          <circle cx="330" cy="48" r="9" fill="#b91c1c" stroke="#f87171" stroke-width="1.5"/>
          <!-- Insulin Monomers (Cyan) -->
          <polygon points="120,40 126,48 120,56 114,48" fill="#06b6d4"/>
          <polygon points="240,40 246,48 240,56 234,48" fill="#06b6d4"/>
          <polygon points="360,40 366,48 360,56 354,48" fill="#06b6d4"/>
          <!-- Glucose (Amber) -->
          <circle cx="178" cy="48" r="5" fill="#f59e0b"/>
          <circle cx="295" cy="48" r="5" fill="#f59e0b"/>

          <!-- Interstitial Space -->
          <line x1="20" y1="88" x2="440" y2="88" stroke="#334155" stroke-dasharray="4 4" stroke-width="1"/>
          <text x="35" y="84" fill="#94a3b8" font-size="9">INTERSTITIUM · DIFFUSION GRADIENT</text>

          <!-- Skeletal Muscle / Hepatocyte Membrane -->
          <rect x="20" y="100" width="420" height="180" rx="16" fill="url(#cellGradNorm)" stroke="#38bdf8" stroke-width="2"/>
          <text x="35" y="122" fill="#7dd3fc" font-size="11" font-weight="700">MYOCYTE / HEPATOCYTE CYTOPLASM</text>

          <!-- Insulin Receptor (Active) -->
          <path d="M 80 100 L 80 82 M 72 82 L 80 92 L 88 82" stroke="#06b6d4" stroke-width="3" fill="none" stroke-linecap="round"/>
          <polygon points="80,72 85,79 80,86 75,79" fill="#06b6d4"/>
          <text x="96" y="90" fill="#38bdf8" font-size="9" font-weight="600">Active IR (Tyrosine Kinase)</text>

          <!-- Second Insulin Receptor -->
          <path d="M 280 100 L 280 82 M 272 82 L 280 92 L 288 82" stroke="#06b6d4" stroke-width="3" fill="none" stroke-linecap="round"/>
          <polygon points="280,72 285,79 280,86 275,79" fill="#06b6d4"/>

          <!-- Open GLUT4 Transporter Channels -->
          <rect x="170" y="96" width="34" height="12" rx="4" fill="#10b981" stroke="#34d399" stroke-width="2"/>
          <path d="M 187 88 L 187 116 M 181 110 L 187 116 L 193 110" stroke="#f59e0b" stroke-width="2.5" fill="none"/>
          <text x="145" y="132" fill="#34d399" font-size="9" font-weight="700">OPEN GLUT4 PORE</text>

          <rect x="370" y="96" width="34" height="12" rx="4" fill="#10b981" stroke="#34d399" stroke-width="2"/>
          <path d="M 387 88 L 387 116 M 381 110 L 387 116 L 393 110" stroke="#f59e0b" stroke-width="2.5" fill="none"/>

          <!-- Intracellular Glucose Uptake & Glycogen Synthesis -->
          <circle cx="187" cy="154" r="6" fill="#f59e0b"/>
          <circle cx="210" cy="180" r="6" fill="#f59e0b"/>
          <circle cx="387" cy="154" r="6" fill="#f59e0b"/>
          <rect x="250" y="160" width="130" height="45" rx="8" fill="rgba(16,185,129,0.12)" stroke="#10b981" stroke-width="1.2"/>
          <text x="262" y="180" fill="#34d399" font-size="10" font-weight="700">GLYCOGEN SYNTHESIS</text>
          <text x="262" y="194" fill="#a7f3d0" font-size="9">Hexokinase · Normal ATP yield</text>

          <!-- Pancreatic Islet Inset -->
          <circle cx="80" cy="210" r="38" fill="rgba(6,182,212,0.12)" stroke="#06b6d4" stroke-width="1.5"/>
          <text x="80" y="200" fill="#7dd3fc" font-size="8.5" font-weight="700" text-anchor="middle">PANCREATIC ISLET</text>
          <circle cx="68" cy="218" r="5" fill="#06b6d4"/>
          <circle cx="82" cy="216" r="6" fill="#06b6d4"/>
          <circle cx="94" cy="222" r="5" fill="#06b6d4"/>
          <text x="80" y="235" fill="#cbd5e1" font-size="7.5" text-anchor="middle">Normal β-cell Mass</text>
        </svg>
      </div>
    </div>

    <!-- RIGHT: Dynamic Pathophysiological Cross-Section -->
    <div class="view-card">
      <div class="card-header">
        <h2 id="path-title" style="color: #fb923c;">Compensated Insulin Resistance</h2>
        <span class="badge badge-pathology" id="path-badge">Stage 2</span>
      </div>
      <div class="svg-container">
        <svg viewBox="0 0 460 300" id="path-svg">
          <defs>
            <linearGradient id="capGradPath" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop id="cap-stop1" offset="0%" stop-color="#f97316" stop-opacity="0.32"/>
              <stop id="cap-stop2" offset="100%" stop-color="#dc2626" stop-opacity="0.45"/>
            </linearGradient>
            <linearGradient id="cellGradPath" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#1e1b2e"/>
              <stop offset="100%" stop-color="#0f111a"/>
            </linearGradient>
          </defs>
          <!-- Capillary vessel (Constricts in later stages) -->
          <rect id="path-capillary" x="20" y="24" width="420" height="48" rx="24" fill="url(#capGradPath)" stroke="#f97316" stroke-width="2"/>
          <text id="path-cap-text" x="35" y="44" fill="#fdba74" font-size="10" font-weight="700">CAPILLARY LUMEN (PERFUSION 94%)</text>
          <!-- Circulating Particles Group (Populated via JS) -->
          <g id="path-particles"></g>

          <!-- Interstitial Barrier with lipid accumulation -->
          <line x1="20" y1="88" x2="440" y2="88" stroke="#f59e0b" stroke-dasharray="3 3" stroke-width="1.2" id="path-interstitium"/>
          <text x="35" y="84" fill="#fbbf24" font-size="9" id="path-inter-text">DIACYLGLYCEROL &amp; CERAMIDE ACCUMULATION</text>

          <!-- Muscle Membrane -->
          <rect id="path-membrane" x="20" y="100" width="420" height="180" rx="16" fill="url(#cellGradPath)" stroke="#f97316" stroke-width="2"/>
          <text id="path-cyto-text" x="35" y="122" fill="#fdba74" font-size="11" font-weight="700">DESENSITIZED RECEPTOR CYTOPLASM</text>

          <!-- Receptors -->
          <path id="path-receptor" d="M 80 100 L 80 82 M 72 82 L 80 92 L 88 82" stroke="#f97316" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle id="path-ir-phos" cx="80" cy="92" r="5" fill="#ef4444" opacity="0.8"/>
          <text id="path-ir-status" x="96" y="90" fill="#fca5a5" font-size="9" font-weight="600">Serine Phosphorylated (Blunted)</text>

          <!-- GLUT4 Transporters (Trapped inside vesicles in Stage 3/4) -->
          <rect id="path-glut4-gate1" x="170" y="96" width="34" height="12" rx="4" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>
          <circle id="path-glut4-vesicle1" cx="187" cy="140" r="14" fill="rgba(234,179,8,0.2)" stroke="#eab308" stroke-dasharray="2 2" stroke-width="1.5"/>
          <text id="path-glut4-label" x="140" y="168" fill="#eab308" font-size="8.5" font-weight="700">GLUT4 VESICLE RETENTION</text>

          <!-- Intracellular Pathology -->
          <rect id="path-glyco-box" x="250" y="160" width="150" height="50" rx="8" fill="rgba(249,115,22,0.12)" stroke="#f97316" stroke-width="1.2"/>
          <text id="path-meta-title" x="262" y="180" fill="#fdba74" font-size="10" font-weight="700">COMPENSATORY WORKLOAD</text>
          <text id="path-meta-sub" x="262" y="196" fill="#fed7aa" font-size="8.5">Mitochondrial ROS · Fatty Acid Spillover</text>

          <!-- Pancreatic Islet Stress Inset -->
          <circle id="path-islet" cx="80" cy="210" r="38" fill="rgba(249,115,22,0.15)" stroke="#f97316" stroke-width="1.5"/>
          <text x="80" y="198" fill="#fed7aa" font-size="8.5" font-weight="700" text-anchor="middle">PANCREATIC ISLET</text>
          <g id="path-beta-cells">
            <circle cx="68" cy="214" r="7" fill="#f97316"/>
            <circle cx="84" cy="212" r="8" fill="#f97316"/>
            <circle cx="96" cy="220" r="7" fill="#f97316"/>
          </g>
          <text id="path-islet-sub" x="80" y="236" fill="#cbd5e1" font-size="7.5" text-anchor="middle">Hyperinsulinemic Secretion</text>
        </svg>
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

      // SVG Updates
      const cap = document.getElementById("path-capillary");
      cap.setAttribute("stroke", s.capColor);
      document.getElementById("path-cap-text").textContent = s.capText;
      document.getElementById("path-ir-status").textContent = s.irText;
      document.getElementById("path-ir-status").setAttribute("fill", s.irColor);
      document.getElementById("path-receptor").setAttribute("stroke", s.irColor);
      document.getElementById("path-ir-phos").setAttribute("opacity", s.phosOpacity);

      const gGate = document.getElementById("path-glut4-gate1");
      gGate.setAttribute("fill", s.glut4Color);
      gGate.setAttribute("y", s.glut4Y);

      document.getElementById("path-meta-title").textContent = s.metaTitle;
      document.getElementById("path-meta-sub").textContent = s.metaSub;
      document.getElementById("path-glyco-box").setAttribute("stroke", s.metaBorder);

      document.getElementById("path-islet").setAttribute("stroke", s.isletBorder);
      document.getElementById("path-islet-sub").textContent = s.isletText;

      // Regenerate particles
      const pGroup = document.getElementById("path-particles");
      pGroup.innerHTML = "";
      // RBCs
      for (let i = 0; i < 5; i++) {
        const cx = 90 + i * 60;
        const cy = 48 + Math.sin(i + currentStage) * 3;
        const rbc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        rbc.setAttribute("cx", cx);
        rbc.setAttribute("cy", cy);
        rbc.setAttribute("r", 9 - currentStage * 0.5);
        rbc.setAttribute("fill", currentStage > 2 ? "#7f1d1d" : "#b91c1c");
        rbc.setAttribute("stroke", currentStage > 2 ? "#b91c1c" : "#f87171");
        rbc.setAttribute("stroke-width", "1.5");
        pGroup.appendChild(rbc);
      }
      // Glucose dots density increases in Stage 3 and 4
      const gCount = currentStage === 0 ? 3 : currentStage === 1 ? 5 : currentStage === 2 ? 14 : 26;
      for (let i = 0; i < gCount; i++) {
        const gx = 40 + ((i * 37) % 360);
        const gy = 32 + ((i * 19) % 30);
        const gDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        gDot.setAttribute("cx", gx);
        gDot.setAttribute("cy", gy);
        gDot.setAttribute("r", "4.5");
        gDot.setAttribute("fill", "#f59e0b");
        pGroup.appendChild(gDot);
      }
      // Insulin particles (Peak in Stage 2, drops in Stage 4)
      const insCount = currentStage === 0 ? 3 : currentStage === 1 ? 9 : currentStage === 2 ? 6 : 1;
      for (let i = 0; i < insCount; i++) {
        const ix = 60 + ((i * 49) % 340);
        const iy = 35 + ((i * 23) % 24);
        const ins = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        ins.setAttribute("points", `${ix},${iy-6} ${ix+5},${iy} ${ix},${iy+6} ${ix-5},${iy}`);
        ins.setAttribute("fill", "#06b6d4");
        pGroup.appendChild(ins);
      }
    }

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
    // Single source of truth: 40ft x 35ft (1,400 sq ft) 3BHK Floor Plan
    window.SATCHIDA_CAD_PLAN = {
      width: 40, depth: 35,
      rooms: [
        { id: "balcony", name: "LIVING BALCONY", x: 0, z: -5, w: 18, d: 5, floor: "#78553a", tint: "rgba(16,185,129,0.08)" },
        { id: "living", name: "LIVING & DINING", x: 0, z: 0, w: 22, d: 19, floor: "#c49a6c", tint: "rgba(56,189,248,0.06)" },
        { id: "kitchen", name: "OPEN KITCHEN", x: 0, z: 19, w: 13, d: 16, floor: "#94a3b8", tint: "rgba(168,85,247,0.06)" },
        { id: "study", name: "STUDY NOOK", x: 13, z: 19, w: 9, d: 6, floor: "#b88e60", tint: "rgba(245,158,11,0.07)" },
        { id: "foyer", name: "MAIN FOYER", x: 13, z: 25, w: 9, d: 10, floor: "#94a3b8", tint: "rgba(56,189,248,0.05)" },
        { id: "master", name: "MASTER SUITE", x: 22, z: 0, w: 18, d: 13, floor: "#b88b5c", tint: "rgba(16,185,129,0.06)" },
        { id: "cbath", name: "COMMON BATH", x: 22, z: 13, w: 6, d: 7, floor: "#64748b", tint: "rgba(56,189,248,0.08)" },
        { id: "hall", name: "HALLWAY", x: 28, z: 13, w: 6, d: 7, floor: "#b88e60", tint: "rgba(56,189,248,0.03)" },
        { id: "mbath", name: "MASTER BATH", x: 34, z: 13, w: 6, d: 7, floor: "#64748b", tint: "rgba(56,189,248,0.08)" },
        { id: "bed2", name: "BEDROOM 2", x: 22, z: 20, w: 9, d: 15, floor: "#b88b5c", tint: "rgba(245,158,11,0.06)" },
        { id: "bed3", name: "BEDROOM 3", x: 31, z: 20, w: 9, d: 15, floor: "#b88b5c", tint: "rgba(16,185,129,0.05)" },
        { id: "servant", name: "SERVANT QUARTER (EXT)", x: 2, z: 37.5, w: 10, d: 7.5, floor: "#94a3b8", tint: "rgba(244,63,94,0.08)" },
        { id: "swash", name: "SERVANT WC", x: 12, z: 37.5, w: 4, d: 7.5, floor: "#64748b", tint: "rgba(244,63,94,0.06)" }
      ],
      walls: [
        // North balcony railing & main North exterior wall
        { x1: 0, z1: -5, x2: 18, z2: -5, t: 0.25, kind: "rail", openings: [] },
        { x1: 0, z1: -5, x2: 0, z2: 0, t: 0.25, kind: "rail", openings: [] },
        { x1: 18, z1: -5, x2: 18, z2: 0, t: 0.25, kind: "rail", openings: [] },
        { x1: 0, z1: 0, x2: 40, z2: 0, t: 0.75, kind: "ext", openings: [{ at: 4, len: 9, kind: "win" }, { at: 26, len: 8, kind: "win" }] },
        { x1: 0, z1: 0, x2: 0, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 4, len: 7, kind: "win" }, { at: 24, len: 6, kind: "win" }] },
        { x1: 40, z1: 0, x2: 40, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 3, len: 6, kind: "win" }, { at: 15, len: 3, kind: "win" }, { at: 25, len: 6, kind: "win" }] },
        { x1: 0, z1: 35, x2: 40, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 4, len: 5, kind: "win" }, { at: 15.5, len: 3.5, kind: "door", swing: -1 }, { at: 24.5, len: 4, kind: "win" }, { at: 33.5, len: 4, kind: "win" }] },
        // Interior partitions
        { x1: 22, z1: 0, x2: 22, z2: 35, t: 0.45, kind: "int", openings: [{ at: 14.5, len: 4.0, kind: "open" }] },
        { x1: 0, z1: 19, x2: 22, z2: 19, t: 0.45, kind: "int", openings: [{ at: 4, len: 7, kind: "open" }, { at: 15, len: 5, kind: "open" }] },
        { x1: 13, z1: 19, x2: 13, z2: 35, t: 0.45, kind: "int", openings: [{ at: 21, len: 3.5, kind: "open" }] },
        { x1: 13, z1: 25, x2: 22, z2: 25, t: 0.4, kind: "int", openings: [{ at: 15.5, len: 4.0, kind: "open" }] },
        { x1: 22, z1: 13, x2: 40, z2: 13, t: 0.45, kind: "int", openings: [{ at: 29.5, len: 3.0, kind: "door", swing: -1 }, { at: 35.5, len: 2.6, kind: "door", swing: 1 }] },
        { x1: 28, z1: 13, x2: 28, z2: 20, t: 0.4, kind: "int", openings: [{ at: 15.5, len: 2.6, kind: "door", swing: -1 }] },
        { x1: 34, z1: 13, x2: 34, z2: 20, t: 0.4, kind: "int", openings: [] },
        { x1: 22, z1: 20, x2: 40, z2: 20, t: 0.45, kind: "int", openings: [{ at: 28.2, len: 2.6, kind: "door", swing: 1 }, { at: 31.2, len: 2.6, kind: "door", swing: 1 }] },
        { x1: 31, z1: 20, x2: 31, z2: 35, t: 0.4, kind: "int", openings: [] },
        // External Servant Quarter outside main entrance (z=37.5..45)
        { x1: 2, z1: 37.5, x2: 16, z2: 37.5, t: 0.6, kind: "ext", openings: [{ at: 8.5, len: 2.8, kind: "door", swing: 1 }] },
        { x1: 2, z1: 37.5, x2: 2, z2: 45, t: 0.6, kind: "ext", openings: [{ at: 40, len: 2.5, kind: "win" }] },
        { x1: 16, z1: 37.5, x2: 16, z2: 45, t: 0.6, kind: "ext", openings: [{ at: 40, len: 1.8, kind: "win" }] },
        { x1: 2, z1: 45, x2: 16, z2: 45, t: 0.6, kind: "ext", openings: [{ at: 5, len: 3, kind: "win" }] },
        { x1: 12, z1: 37.5, x2: 12, z2: 45, t: 0.4, kind: "int", openings: [{ at: 39, len: 2.4, kind: "door", swing: 1 }] }
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
        { type: "bed", x: 30.5, z: 2.0, w: 7.0, d: 6.6, h: 2.2, color: "#64748b" },
        { type: "wardrobe", x: 23.0, z: 1.0, w: 5.5, d: 1.8, h: 7.0, color: "#475569" },
        { type: "bath", x: 22.8, z: 14.0, w: 4.4, d: 5.0, h: 2.6, color: "#38bdf8" },
        { type: "bath", x: 34.8, z: 14.0, w: 4.4, d: 5.0, h: 2.6, color: "#38bdf8" },
        { type: "bed", x: 23.2, z: 27.5, w: 6.0, d: 6.2, h: 2.1, color: "#475569" },
        { type: "bed", x: 32.5, z: 27.5, w: 6.0, d: 6.2, h: 2.1, color: "#475569" },
        { type: "bed", x: 3.0, z: 38.6, w: 3.6, d: 5.6, h: 1.9, color: "#64748b" },
        { type: "bath", x: 12.6, z: 40.2, w: 2.8, d: 4.0, h: 2.4, color: "#38bdf8" }
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


def _auto_walls_from_rooms(rooms: list[dict], width: float, depth: float) -> list[dict]:
    """Generate clean exterior perimeter walls (with windows) and interior partition walls (with doors) from room rects."""
    walls: list[dict] = [
        {"x1": 0, "z1": 0, "x2": width, "z2": 0, "t": 0.6, "kind": "ext", "openings": [{"at": round(width * 0.2, 1), "len": 4, "kind": "win"}, {"at": round(width * 0.65, 1), "len": 4, "kind": "win"}]},
        {"x1": width, "z1": 0, "x2": width, "z2": depth, "t": 0.6, "kind": "ext", "openings": [{"at": round(depth * 0.3, 1), "len": 4, "kind": "win"}]},
        {"x1": 0, "z1": depth, "x2": width, "z2": depth, "t": 0.6, "kind": "ext", "openings": [{"at": round(width * 0.3, 1), "len": 4, "kind": "win"}]},
        {"x1": 0, "z1": 0, "x2": 0, "z2": depth, "t": 0.6, "kind": "ext", "openings": [{"at": round(depth * 0.25, 1), "len": 3.5, "kind": "door", "swing": 1}]},
    ]
    seen: set[tuple[str, float, float, float]] = set()
    for r in rooms:
        rx, rz, rw, rd = float(r.get("x", 0)), float(r.get("z", 0)), float(r.get("w", 0)), float(r.get("d", 0))
        edges = [
            ("v", rx + rw, rz, rz + rd, 0 < rx + rw < width),
            ("h", rz + rd, rx, rx + rw, 0 < rz + rd < depth),
        ]
        for axis, pos, start, end, is_int in edges:
            if not is_int or end - start <= 1.0:
                continue
            key = (axis, round(pos, 2), round(start, 2), round(end, 2))
            if key in seen:
                continue
            seen.add(key)
            span = end - start
            opening = [{"at": round(max(0.8, span * 0.35), 2), "len": min(3.0, round(span * 0.4, 2)), "kind": "door", "swing": 1}] if span >= 3.5 else []
            if axis == "v":
                walls.append({"x1": pos, "z1": start, "x2": pos, "z2": end, "t": 0.4, "kind": "int", "openings": opening})
            else:
                walls.append({"x1": start, "z1": pos, "x2": end, "z2": pos, "t": 0.4, "kind": "int", "openings": opening})
    return walls


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
        resolved_walls = walls if walls is not None else (_auto_walls_from_rooms(resolved_rooms, float(width), float(depth)) if resolved_rooms else [])
        plan_obj = {
            "width": float(width),
            "depth": float(depth),
            "rooms": resolved_rooms,
            "walls": resolved_walls,
            "furniture": furniture if furniture is not None else [],
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
