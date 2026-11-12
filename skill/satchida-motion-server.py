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
        "\nIMPORTANT: Keep ALL `<style>` and ALL `<script>` functions (`draw2D`, `init3D`, `setViewMode`, `handleResize`) "
        "100% VERBATIM — only edit the `PLAN` object and `#title-badge`, OR call `build_cad_floorplan` with your custom JSON.\n"
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
    for web_path, fs_path in VENDOR_ASSET_MAP.items():
        if web_path in content and os.path.exists(fs_path):
            file_uri = "file:///" + fs_path.replace("\\", "/")
            content = content.replace(web_path, file_uri)
    return content


@mcp.tool()
def render_motion_to_video(
    html_content: str,
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

    :param html_content: Required complete HTML source code of the motion graphic (CSS, GSAP, SVG, Canvas, or Three.js).
    :param filename: Optional base name for output file (e.g. 'floorplan_3d_tour').
    :param duration_seconds: Total duration of the animation to render in seconds (default: 6.0, max: 60.0).
    :param fps: Frame rate in frames per second (default: 30, range: 10..60).
    :param width: Video pixel width (default: 1280, range: 320..2560). Even dimensions recommended.
    :param height: Video pixel height (default: 720, range: 320..2560).
    """
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
def validate_motion_html(html_content: str) -> str:
    """
    Lints and validates an HTML artifact against Satchida-Motion contracts before offline MP4 export.
    Do NOT call this for ordinary inline chat `:::artifact` HTML responses — deliver the inline
    `:::artifact` directly in chat to avoid duplicate generation passes. Use only when diagnosing
    or validating a standalone HTML scene prior to calling `render_motion_to_video`.

    :param html_content: Complete HTML source code to analyze.
    """
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
    const PLAN = {
      width: 40, depth: 35,
      rooms: [
        { id: "living", name: "LIVING & DINING", x: 0, z: 0, w: 22, d: 22, floor: "#c49a6c", tint: "rgba(56,189,248,0.06)" },
        { id: "kitchen", name: "OPEN KITCHEN", x: 0, z: 22, w: 14, d: 13, floor: "#94a3b8", tint: "rgba(168,85,247,0.06)" },
        { id: "hall", name: "FOYER / HALL", x: 14, z: 22, w: 12, d: 5, floor: "#b88e60", tint: "rgba(56,189,248,0.04)" },
        { id: "balcony", name: "BALCONY DECK", x: 14, z: 27, w: 12, d: 8, floor: "#785a3c", tint: "rgba(16,185,129,0.08)" },
        { id: "master", name: "MASTER SUITE", x: 22, z: 0, w: 18, d: 16, floor: "#b88b5c", tint: "rgba(16,185,129,0.06)" },
        { id: "mbath", name: "M. BATH", x: 22, z: 16, w: 9, d: 6, floor: "#64748b", tint: "rgba(56,189,248,0.08)" },
        { id: "cbath", name: "BATH 2", x: 31, z: 16, w: 9, d: 6, floor: "#64748b", tint: "rgba(56,189,248,0.08)" },
        { id: "bed2", name: "BEDROOM 2 / STUDY", x: 26, z: 22, w: 14, d: 13, floor: "#b88b5c", tint: "rgba(245,158,11,0.06)" }
      ],
      // Walls: [x1, z1, x2, z2, thickness, type('ext'|'int'|'rail'), openings:[{at, len, kind:'win'|'door'|'open', swing?:1|-1}]]
      walls: [
        { x1: 0, z1: 0, x2: 40, z2: 0, t: 0.75, kind: "ext", openings: [{ at: 4, len: 8, kind: "win" }, { at: 27, len: 7, kind: "win" }] },
        { x1: 0, z1: 0, x2: 0, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 4, len: 7, kind: "win" }, { at: 25, len: 5, kind: "win" }] },
        { x1: 40, z1: 0, x2: 40, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 4, len: 6, kind: "win" }, { at: 25, len: 6, kind: "win" }] },
        { x1: 0, z1: 35, x2: 14, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 4, len: 5, kind: "win" }] },
        { x1: 26, z1: 35, x2: 40, z2: 35, t: 0.75, kind: "ext", openings: [{ at: 30, len: 6, kind: "win" }] },
        { x1: 14, z1: 35, x2: 26, z2: 35, t: 0.3, kind: "rail", openings: [] },
        { x1: 22, z1: 0, x2: 22, z2: 22, t: 0.45, kind: "int", openings: [{ at: 11, len: 3.2, kind: "door", swing: 1 }] },
        { x1: 0, z1: 22, x2: 22, z2: 22, t: 0.45, kind: "int", openings: [{ at: 5, len: 7, kind: "open" }, { at: 15.5, len: 4.5, kind: "open" }] },
        { x1: 22, z1: 16, x2: 40, z2: 16, t: 0.45, kind: "int", openings: [{ at: 24, len: 2.8, kind: "door", swing: 1 }] },
        { x1: 31, z1: 16, x2: 31, z2: 22, t: 0.4, kind: "int", openings: [] },
        { x1: 22, z1: 22, x2: 40, z2: 22, t: 0.45, kind: "int", openings: [{ at: 33, len: 2.8, kind: "door", swing: -1 }] },
        { x1: 14, z1: 22, x2: 14, z2: 35, t: 0.45, kind: "int", openings: [{ at: 23, len: 3.0, kind: "open" }] },
        { x1: 26, z1: 22, x2: 26, z2: 35, t: 0.45, kind: "int", openings: [{ at: 23.2, len: 3.0, kind: "door", swing: 1 }] },
        { x1: 14, z1: 27, x2: 26, z2: 27, t: 0.4, kind: "ext", openings: [{ at: 16, len: 8, kind: "win" }] }
      ],
      furniture: [
        { type: "sofa", x: 3, z: 2.2, w: 9, d: 3.2, h: 2.6, color: "#334155" },
        { type: "sofa", x: 3, z: 5.4, w: 3.2, d: 5.5, h: 2.6, color: "#334155" },
        { type: "table", x: 7.2, z: 6.2, w: 4.5, d: 2.6, h: 1.4, color: "#78350f" },
        { type: "dining", x: 11, z: 13.5, w: 7, d: 3.8, h: 2.5, color: "#92400e" },
        { type: "counter", x: 1.0, z: 23, w: 2.4, d: 11, h: 3.0, color: "#1e293b" },
        { type: "counter", x: 3.4, z: 31.6, w: 9.6, d: 2.4, h: 3.0, color: "#1e293b" },
        { type: "island", x: 5.8, z: 25.5, w: 5.2, d: 2.6, h: 3.0, color: "#cbd5e1" },
        { type: "bed", x: 30.5, z: 2.2, w: 7.2, d: 6.6, h: 2.2, color: "#e2e8f0" },
        { type: "wardrobe", x: 28, z: 13.8, w: 10, d: 1.8, h: 7.0, color: "#475569" },
        { type: "bath", x: 23, z: 17, w: 7, d: 4, h: 2.6, color: "#e0f2fe" },
        { type: "bath", x: 32, z: 17, w: 7, d: 4, h: 2.6, color: "#e0f2fe" },
        { type: "bed", x: 32, z: 26, w: 6.4, d: 5.4, h: 2.0, color: "#cbd5e1" },
        { type: "desk", x: 27, z: 31.8, w: 5.2, d: 2.2, h: 2.5, color: "#78350f" }
      ]
    };

    let state = { mode: "2d", showFurn: true, showDims: true, cutaway: false, sunHour: 10.5, autoOrbit: false };

    // ==================== 1. 2D ARCHITECTURAL CAD RENDERER ====================
    const cadCanvas = document.getElementById("cad-2d");
    const ctx = cadCanvas.getContext("2d");

    function splitWallSegments(w) {
      const horiz = Math.abs(w.z1 - w.z2) < 0.01;
      const start = horiz ? Math.min(w.x1, w.x2) : Math.min(w.z1, w.z2);
      const end = horiz ? Math.max(w.x1, w.x2) : Math.max(w.z1, w.z2);
      const ops = [...(w.openings || [])].sort((a, b) => a.at - b.at);
      const segs = [];
      let cur = start;
      for (const op of ops) {
        if (op.at > cur) segs.push({ a: cur, b: op.at });
        cur = Math.max(cur, op.at + op.len);
      }
      if (cur < end) segs.push({ a: cur, b: end });
      return { horiz, fixed: horiz ? w.z1 : w.x1, segs };
    }

    function getViewportSize() {
      const wrap = document.getElementById("stage-wrap");
      const w = (wrap && wrap.clientWidth) || window.innerWidth || 960;
      const h = (wrap && wrap.clientHeight) || window.innerHeight || 640;
      return { w: Math.max(w, 320), h: Math.max(h, 240) };
    }

    function draw2D() {
      const dpr = window.devicePixelRatio || 1;
      const { w: W, h: H } = getViewportSize();
      cadCanvas.width = W * dpr; cadCanvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#07111f";
      ctx.fillRect(0, 0, W, H);

      // Drafting grid
      ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      const narrow = W < 760;
      const padLeft = narrow ? 56 : 100;
      const padRight = narrow ? 32 : 100;
      const padTop = narrow ? 245 : 100;
      const padBottom = 72;
      const scale = Math.min((W - padLeft - padRight) / PLAN.width, (H - padTop - padBottom) / PLAN.depth);
      const ox = padLeft + ((W - padLeft - padRight) - PLAN.width * scale) / 2;
      const oy = padTop + ((H - padTop - padBottom) - PLAN.depth * scale) / 2;
      const px = (x) => ox + x * scale;
      const py = (z) => oy + z * scale;

      // Room floor fills
      for (const r of PLAN.rooms) {
        ctx.fillStyle = r.tint;
        ctx.fillRect(px(r.x), py(r.z), r.w * scale, r.d * scale);
        ctx.strokeStyle = "rgba(56,189,248,0.16)";
        ctx.strokeRect(px(r.x), py(r.z), r.w * scale, r.d * scale);
      }

      // Furniture 2D CAD blocks
      if (state.showFurn) {
        for (const f of PLAN.furniture) {
          const fx = px(f.x), fy = py(f.z), fw = f.w * scale, fd = f.d * scale;
          ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
          ctx.strokeStyle = "#7dd3fc";
          ctx.lineWidth = 1.3;
          ctx.fillRect(fx, fy, fw, fd);
          ctx.strokeRect(fx, fy, fw, fd);
          if (f.type === "bed") {
            ctx.strokeRect(fx + 4, fy + 4, fw * 0.42, fd * 0.25);
            ctx.strokeRect(fx + fw * 0.52, fy + 4, fw * 0.42, fd * 0.25);
          } else if (f.type === "dining") {
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(fx + (i + 0.5) * (fw / 3), fy - 5, 4, 0, Math.PI * 2);
              ctx.arc(fx + (i + 0.5) * (fw / 3), fy + fd + 5, 4, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }

      // Solid walls, windows & door swing arcs
      for (const w of PLAN.walls) {
        const { horiz, fixed, segs } = splitWallSegments(w);
        const thick = w.t * scale;
        ctx.fillStyle = w.kind === "rail" ? "#38bdf8" : "#e2e8f0";
        for (const s of segs) {
          if (horiz) ctx.fillRect(px(s.a), py(fixed) - thick / 2, (s.b - s.a) * scale, thick);
          else ctx.fillRect(px(fixed) - thick / 2, py(s.a), thick, (s.b - s.a) * scale);
        }
        for (const op of w.openings || []) {
          if (op.kind === "win") {
            ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.6;
            if (horiz) {
              ctx.fillRect(px(op.at), py(fixed) - thick / 2, op.len * scale, thick);
              ctx.strokeRect(px(op.at), py(fixed) - thick / 2, op.len * scale, thick);
            } else {
              ctx.fillRect(px(fixed) - thick / 2, py(op.at), thick, op.len * scale);
              ctx.strokeRect(px(fixed) - thick / 2, py(op.at), thick, op.len * scale);
            }
          } else if (op.kind === "door") {
            const r = op.len * scale;
            const dir = op.swing || 1;
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 1.4;
            if (horiz) {
              const hx = px(op.at), hy = py(fixed);
              ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + dir * r); ctx.stroke();
              ctx.setLineDash([4, 3]);
              ctx.beginPath();
              ctx.arc(hx, hy, r, dir > 0 ? 0 : -Math.PI / 2, dir > 0 ? Math.PI / 2 : 0);
              ctx.stroke();
              ctx.setLineDash([]);
            } else {
              const hx = px(fixed), hy = py(op.at);
              ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dir * r, hy); ctx.stroke();
              ctx.setLineDash([4, 3]);
              ctx.beginPath();
              ctx.arc(hx, hy, r, dir > 0 ? 0 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      }

      // Dimensions & room labels
      if (state.showDims) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const r of PLAN.rooms) {
          const rcx = px(r.x + r.w / 2);
          const rcy = py(r.z + r.d / 2);
          const maxW = Math.max(40, r.w * scale - 10);
          const fTitle = Math.max(8, Math.min(11, Math.floor((r.w * scale) / 11)));
          const fSub = Math.max(7.5, Math.min(9.5, fTitle - 1.5));
          const subText = `${r.w}'×${r.d}' · ${r.w * r.d} sf`;
          ctx.font = `700 ${fTitle}px Inter, system-ui, sans-serif`;
          const tw = Math.min(maxW, Math.max(ctx.measureText(r.name).width, ctx.measureText(subText).width));
          ctx.fillStyle = "rgba(7, 17, 31, 0.78)";
          ctx.fillRect(rcx - tw / 2 - 5, rcy - fTitle - 4, tw + 10, fTitle + fSub + 12);
          ctx.fillStyle = "#f8fafc";
          ctx.fillText(r.name, rcx, rcy - 5, maxW);
          ctx.font = `500 ${fSub}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = "#7dd3fc";
          ctx.fillText(subText, rcx, rcy + fTitle * 0.65, maxW);
        }
        ctx.textBaseline = "alphabetic";
        // Exterior dimension chains
        ctx.strokeStyle = "#38bdf8";
        ctx.fillStyle = "#7dd3fc";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px(0), py(0) - 22); ctx.lineTo(px(PLAN.width), py(0) - 22);
        ctx.moveTo(px(0), py(0) - 27); ctx.lineTo(px(0), py(0) - 17);
        ctx.moveTo(px(PLAN.width), py(0) - 27); ctx.lineTo(px(PLAN.width), py(0) - 17);
        ctx.moveTo(px(0) - 22, py(0)); ctx.lineTo(px(0) - 22, py(PLAN.depth));
        ctx.moveTo(px(0) - 27, py(0)); ctx.lineTo(px(0) - 17, py(0));
        ctx.moveTo(px(0) - 27, py(PLAN.depth)); ctx.lineTo(px(0) - 17, py(PLAN.depth));
        ctx.stroke();
        ctx.font = "600 11px Inter, system-ui, sans-serif";
        ctx.fillText(`${PLAN.width} ft (${(PLAN.width * 0.3048).toFixed(1)} m)`, px(PLAN.width / 2), py(0) - 29);
        ctx.save();
        ctx.translate(px(0) - 32, py(PLAN.depth / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${PLAN.depth} ft (${(PLAN.depth * 0.3048).toFixed(1)} m)`, 0, 0);
        ctx.restore();
      }
    }

    // ==================== 2. TRUE 3D THREE.JS ARCHITECTURAL RENDERER ====================
    const webglCanvas = document.getElementById("webgl-3d");
    let renderer, scene, camera, controls, sunLight;
    const wallMeshes = [], furnMeshes = [];

    function init3D() {
      if (!window.THREE) return;
      const { w: W, h: H } = getViewportSize();
      renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      scene = new THREE.Scene();
      scene.background = new THREE.Color("#07111f");
      scene.fog = new THREE.Fog("#07111f", 60, 140);

      camera = new THREE.PerspectiveCamera(45, W / H, 0.5, 200);
      camera.position.set(22, 34, 48);

      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, webglCanvas);
        controls.enableDamping = true;
        controls.target.set(0, 2, 0);
        controls.addEventListener("change", () => { if (state.mode === "3d") renderer.render(scene, camera); });
      }

      scene.add(new THREE.AmbientLight(0xdbeafe, 0.55));
      scene.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.45));
      sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.left = -30; sunLight.shadow.camera.right = 30;
      sunLight.shadow.camera.top = 30; sunLight.shadow.camera.bottom = -30;
      scene.add(sunLight);
      updateSun(state.sunHour);

      const cx = PLAN.width / 2, cz = PLAN.depth / 2;
      const grid = new THREE.GridHelper(90, 45, 0x1e3a5f, 0x0f223a);
      grid.position.y = -0.35;
      scene.add(grid);

      // Base architectural concrete plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(PLAN.width + 1.2, 0.6, PLAN.depth + 1.2),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
      );
      plinth.position.set(0, -0.3, 0);
      plinth.receiveShadow = true;
      scene.add(plinth);

      // Room floors
      for (const r of PLAN.rooms) {
        const floor = new THREE.Mesh(
          new THREE.BoxGeometry(r.w - 0.1, 0.12, r.d - 0.1),
          new THREE.MeshStandardMaterial({ color: r.floor, roughness: 0.72 })
        );
        floor.position.set(r.x + r.w / 2 - cx, 0.06, r.z + r.d / 2 - cz);
        floor.receiveShadow = true;
        scene.add(floor);
      }

      // 3D Extruded Walls with real window sills/headers and door headers
      const wallH = 9.0;
      const extMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 });
      const intMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.2 });

      function addWallBox(x, y, z, w, h, d, mat, isGlass = false) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x - cx, y, z - cz);
        m.castShadow = !isGlass;
        m.receiveShadow = true;
        scene.add(m);
        if (!isGlass) wallMeshes.push({ mesh: m, fullY: y, fullH: h });
      }

      for (const w of PLAN.walls) {
        const mat = w.kind === "ext" ? extMat : intMat;
        const { horiz, fixed, segs } = splitWallSegments(w);
        if (w.kind === "rail") {
          addWallBox(20, 1.8, 35, 12, 3.4, 0.2, glassMat, true);
          continue;
        }
        for (const s of segs) {
          const len = s.b - s.a;
          const mid = (s.a + s.b) / 2;
          addWallBox(horiz ? mid : fixed, wallH / 2, horiz ? fixed : mid, horiz ? len : w.t, wallH, horiz ? w.t : len, mat);
        }
        for (const op of w.openings || []) {
          const mid = op.at + op.len / 2;
          if (op.kind === "win") {
            addWallBox(horiz ? mid : fixed, 1.5, horiz ? fixed : mid, horiz ? op.len : w.t, 3.0, horiz ? w.t : op.len, mat);
            addWallBox(horiz ? mid : fixed, 8.25, horiz ? fixed : mid, horiz ? op.len : w.t, 1.5, horiz ? w.t : op.len, mat);
            addWallBox(horiz ? mid : fixed, 5.25, horiz ? fixed : mid, horiz ? op.len : 0.15, 4.5, horiz ? 0.15 : op.len, glassMat, true);
          } else if (op.kind === "door") {
            addWallBox(horiz ? mid : fixed, 8.0, horiz ? fixed : mid, horiz ? op.len : w.t, 2.0, horiz ? w.t : op.len, mat);
          }
        }
      }

      // 3D Furniture
      for (const f of PLAN.furniture) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(f.w, f.h, f.d),
          new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.65 })
        );
        mesh.position.set(f.x + f.w / 2 - cx, f.h / 2 + 0.12, f.z + f.d / 2 - cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        furnMeshes.push(mesh);
      }

      function animate() {
        requestAnimationFrame(animate);
        if (state.mode !== "3d") return;
        let dirty = false;
        if (state.autoOrbit) { scene.rotation.y += 0.004; dirty = true; }
        if (controls && controls.update()) dirty = true;
        if (dirty) renderer.render(scene, camera);
      }
      renderer.render(scene, camera);
      animate();
    }

    function updateSun(hour) {
      if (!sunLight) return;
      const angle = ((hour - 6) / 13) * Math.PI;
      sunLight.position.set(-Math.cos(angle) * 38, Math.max(8, Math.sin(angle) * 42), 22);
    }

    function setViewMode(mode, camType) {
      state.mode = mode;
      document.body.className = mode === "3d" ? "mode-3d" : "mode-2d";
      document.querySelectorAll(".cam-row button").forEach((b) => b.classList.remove("active"));
      if (mode === "2d") {
        document.getElementById("btn-2d").classList.add("active");
        document.getElementById("mode-subtitle").textContent = "2D Orthographic Architectural CAD Blueprint";
        draw2D();
      } else {
        document.getElementById("mode-subtitle").textContent = "3D WebGL Extruded Structure (Orbit / Zoom / Shadows)";
        if (camera && controls) {
          const { w: W, h: H } = getViewportSize();
          const aspect = W / H;
          const distMult = aspect < 1 ? Math.min(1.65, (1 / Math.max(aspect, 0.52)) * 0.85) : 1;
          if (camType === "iso") {
            document.getElementById("btn-3d-iso").classList.add("active");
            camera.fov = 45;
            camera.updateProjectionMatrix();
            camera.position.set(22 * distMult, 36 * distMult, 46 * distMult);
            controls.target.set(0, 1.5, 0);
          } else if (camType === "walk") {
            document.getElementById("btn-3d-walk").classList.add("active");
            camera.fov = 58;
            camera.updateProjectionMatrix();
            camera.position.set(-15, 5.4, -14);
            controls.target.set(8, 3.8, 12);
          } else {
            document.getElementById("btn-3d-top").classList.add("active");
            camera.fov = 45;
            camera.updateProjectionMatrix();
            camera.position.set(0, 58 * distMult, 8 * distMult);
            controls.target.set(0, 0, 0);
          }
          controls.update();
          if (renderer) renderer.render(scene, camera);
        }
      }
    }

    document.getElementById("hud-toggle").onclick = () => {
      const panel = document.getElementById("hud-panel");
      const btn = document.getElementById("hud-toggle");
      panel.classList.toggle("collapsed");
      btn.textContent = panel.classList.contains("collapsed") ? "+" : "−";
    };
    document.getElementById("btn-2d").onclick = () => setViewMode("2d");
    document.getElementById("btn-3d-iso").onclick = () => setViewMode("3d", "iso");
    document.getElementById("btn-3d-walk").onclick = () => setViewMode("3d", "walk");
    document.getElementById("btn-3d-top").onclick = () => setViewMode("3d", "top");
    document.getElementById("chk-furn").onchange = (e) => {
      state.showFurn = e.target.checked;
      furnMeshes.forEach((m) => (m.visible = state.showFurn));
      draw2D();
    };
    document.getElementById("chk-dims").onchange = (e) => { state.showDims = e.target.checked; draw2D(); };
    document.getElementById("chk-cutaway").onchange = (e) => {
      state.cutaway = e.target.checked;
      wallMeshes.forEach((w) => {
        if (w.fullH > 4.5) {
          w.mesh.scale.y = state.cutaway ? 0.5 : 1.0;
          w.mesh.position.y = state.cutaway ? w.fullY * 0.5 : w.fullY;
        }
      });
    };
    document.getElementById("sun-slider").oninput = (e) => {
      state.sunHour = parseFloat(e.target.value);
      document.getElementById("sun-lbl").textContent = Math.floor(state.sunHour) + ":" + (state.sunHour % 1 ? "30" : "00");
      updateSun(state.sunHour);
    };
    document.getElementById("btn-play").onclick = () => {
      state.autoOrbit = !state.autoOrbit;
      if (state.autoOrbit && state.mode !== "3d") setViewMode("3d", "iso");
    };
    document.getElementById("btn-restart").onclick = () => {
      if (scene) scene.rotation.y = 0;
      setViewMode(state.mode, "iso");
    };
    document.getElementById("timeline-scrubber").oninput = (e) => {
      if (scene) {
        if (state.mode !== "3d") setViewMode("3d", "iso");
        scene.rotation.y = (parseFloat(e.target.value) / 100) * Math.PI * 2;
      }
    };
    function handleResize() {
      draw2D();
      if (renderer && camera) {
        const { w: W, h: H } = getViewportSize();
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H, false);
        if (state.mode === "3d") renderer.render(scene, camera);
      }
    }
    window.addEventListener("resize", handleResize);
    if (window.ResizeObserver) {
      new ResizeObserver(handleResize).observe(document.getElementById("stage-wrap"));
    }
    window.__SEEK_FRAME__ = (_t, progress) => {
      if (scene) {
        if (progress > 0.15 && state.mode !== "3d") setViewMode("3d", "iso");
        scene.rotation.y = progress * Math.PI * 1.5;
        renderer.render(scene, camera);
      }
    };

    draw2D();
    init3D();
  </script>
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
    from custom floor-plan JSON without rewriting the rendering engine.
    - rooms_json: JSON array of {id, name, x, z, w, d, floor?, tint?}
    - walls_json: JSON array of {x1, z1, x2, z2, t, kind: 'ext'|'int'|'rail', openings: [{at, len, kind: 'win'|'door'|'open', swing?: 1|-1}]}
    - furniture_json: JSON array of {type, x, z, w, d, h, color?}
    """
    base_wrapped = get_motion_template("cad_blueprint")
    html = _unwrap_html(base_wrapped)
    rooms = json.loads(rooms_json) if rooms_json.strip() not in ("", "[]") else None
    walls = json.loads(walls_json) if walls_json.strip() not in ("", "[]") else None
    furniture = json.loads(furniture_json) if furniture_json.strip() not in ("", "[]") else None

    if rooms is not None or walls is not None or furniture is not None:
        plan_obj = {
            "width": float(width),
            "depth": float(depth),
            "rooms": rooms if rooms is not None else [],
            "walls": walls if walls is not None else [],
            "furniture": furniture if furniture is not None else [],
        }
        plan_js = f"const PLAN = {json.dumps(plan_obj, indent=2)};"
        html = re.sub(
            r"const PLAN = \{[\s\S]*?\n    \};",
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
    return _wrap_template_artifact("cad_blueprint", safe_title, html)


if __name__ == "__main__":
    mcp.run()
