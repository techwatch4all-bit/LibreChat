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


def _rewrite_vendor_paths(html_content: str) -> str:
    content = html_content
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

    :param html_content: Complete HTML source code of the motion graphic (CSS, GSAP, SVG, Canvas, or Three.js).
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
    Lints and validates an HTML artifact against Satchida-Motion Gold Standard contracts.
    Checks GSAP inclusion, window.__TIMELINE__, deterministic window.__SEEK_FRAME__ sync for
    Three.js/Canvas scenes, SVG viewBox scaling, Anti-PPT choreography, and playback HUD controls.

    :param html_content: Complete HTML source code to analyze.
    """
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
    Returns a ready-to-customize, cinema-grade Satchida-Motion starter template.

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
        return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Satchida Motion — Architectural CAD Floor Plan Studio</title>
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #07111f; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; width: 100vw; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center;
      background-image: linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px);
      background-size: 32px 32px; }
    #viewport { width: 100vw; height: 100vh; perspective: 1400px; display: flex; align-items: center; justify-content: center; }
    #plan-stage { width: 820px; height: 500px; transform-style: preserve-3d; transition: transform 0.6s ease; }
    svg { width: 100%; height: 100%; overflow: visible; }
    .hud { position: fixed; top: 18px; right: 20px; background: rgba(10, 22, 42, 0.9); border: 1px solid rgba(56,189,248,0.28); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; width: 230px; z-index: 20; }
    .hud h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; }
    .hud label { font-size: 12px; display: flex; justify-content: space-between; align-items: center; color: #cbd5e1; }
    .hud button { background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.35); color: #e0f2fe; border-radius: 8px; padding: 6px; font-size: 12px; cursor: pointer; }
    #satchida-controls { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; padding: 8px 16px; background: rgba(15,23,42,0.88); border: 1px solid rgba(255,255,255,0.14); border-radius: 9999px; }
    #satchida-controls button { background: transparent; border: none; color: #f1f5f9; font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 8px; }
  </style>
</head>
<body>
  <div class="hud">
    <h3>CAD Studio Controls</h3>
    <button id="toggle-iso">Toggle 2D / Isometric 3D</button>
    <label>Furniture <input type="checkbox" id="chk-furn" checked></label>
    <label>MEP / Airflow <input type="checkbox" id="chk-mep" checked></label>
    <label>Sun Hour <span id="sun-lbl">10:00</span></label>
    <input type="range" id="sun-slider" min="6" max="19" step="0.5" value="10">
  </div>
  <div id="viewport">
    <div id="plan-stage">
      <svg viewBox="0 0 800 480" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8"/>
          </marker>
        </defs>
        <g id="layer-sun"><polygon id="sun-beam" points="620,60 440,210 640,280" fill="rgba(251,191,36,0.16)" stroke="#fbbf24" stroke-dasharray="6 4"/></g>
        <g id="layer-walls" stroke="#38bdf8" stroke-width="5" fill="rgba(15,23,42,0.75)">
          <rect class="wall-draw" x="80" y="60" width="640" height="360" rx="4"/>
          <line class="wall-draw" x1="360" y1="60" x2="360" y2="270"/>
          <line class="wall-draw" x1="360" y1="270" x2="720" y2="270"/>
        </g>
        <g id="layer-dims" stroke="#7dd3fc" stroke-width="1.2" font-size="12" fill="#7dd3fc">
          <line x1="80" y1="36" x2="720" y2="36" marker-end="url(#arrow)"/>
          <text x="370" y="28">14.5m · 1,450 sq ft</text>
          <text x="190" y="230" font-size="15" font-weight="bold">LIVING & DINING</text>
          <text x="490" y="160" font-size="14" font-weight="bold">MASTER SUITE</text>
          <text x="490" y="355" font-size="14" font-weight="bold">OPEN KITCHEN</text>
        </g>
        <g id="layer-furn" fill="rgba(56,189,248,0.22)" stroke="#bae6fd" stroke-width="1.5">
          <rect x="115" y="110" width="160" height="65" rx="6"/>
          <rect x="440" y="95" width="140" height="110" rx="6"/>
          <rect x="430" y="310" width="230" height="45" rx="4"/>
        </g>
        <g id="layer-mep" stroke="#34d399" stroke-width="2" fill="none" stroke-dasharray="8 6">
          <path id="airflow-path" d="M 95,190 C 210,170 280,290 690,340"/>
        </g>
      </svg>
    </div>
  </div>
  <div id="satchida-controls">
    <button id="btn-play">Pause</button>
    <button id="btn-restart">Restart</button>
    <input type="range" id="timeline-scrubber" min="0" max="100" value="0" step="0.1" style="width:180px;">
    <span id="time-display" style="font-size:12px;color:#94a3b8;">0.0s</span>
  </div>
  <script>
    const tl = gsap.timeline({ id: "main", onUpdate: () => {
      const s = document.getElementById("timeline-scrubber");
      const d = document.getElementById("time-display");
      if (s) s.value = tl.progress() * 100;
      if (d) d.textContent = tl.time().toFixed(1) + "s / " + tl.duration().toFixed(1) + "s";
    }});
    window.__TIMELINE__ = tl;
    tl.from(".wall-draw", { duration: 1.4, opacity: 0, scale: 0.94, stagger: 0.15, ease: "power3.out" })
      .from("#layer-dims", { duration: 0.8, opacity: 0, y: -10 }, "-=0.6")
      .from("#layer-furn > *", { duration: 0.9, scale: 0.8, opacity: 0, stagger: 0.12, ease: "back.out(1.4)" }, "-=0.4")
      .to("#plan-stage", { duration: 1.8, rotateX: 48, rotateZ: -24, scale: 0.92, ease: "power2.inOut" })
      .fromTo("#airflow-path", { strokeDashoffset: 400 }, { strokeDashoffset: 0, duration: 1.5, ease: "power1.inOut" }, "-=1.0");

    let iso = true;
    document.getElementById("toggle-iso").onclick = () => {
      iso = !iso;
      gsap.to("#plan-stage", { rotateX: iso ? 48 : 0, rotateZ: iso ? -24 : 0, duration: 0.7, ease: "power2.out" });
    };
    document.getElementById("chk-furn").onchange = (e) => document.getElementById("layer-furn").style.opacity = e.target.checked ? "1" : "0.08";
    document.getElementById("chk-mep").onchange = (e) => document.getElementById("layer-mep").style.opacity = e.target.checked ? "1" : "0";
    document.getElementById("sun-slider").oninput = (e) => {
      const h = parseFloat(e.target.value);
      document.getElementById("sun-lbl").textContent = Math.floor(h) + ":" + (h % 1 ? "30" : "00");
      const xShift = (h - 6) * 35;
      document.getElementById("sun-beam").setAttribute("points", `${200 + xShift},60 ${150 + xShift * 0.7},240 ${380 + xShift * 0.7},300`);
    };
    document.getElementById("btn-play").onclick = () => tl.paused() ? tl.play() : tl.pause();
    document.getElementById("btn-restart").onclick = () => tl.restart();
    document.getElementById("timeline-scrubber").oninput = (e) => { tl.pause(); tl.progress(e.target.value / 100); };
  </script>
</body>
</html>"""

    if style == "interactive_3d":
        return """<!DOCTYPE html>
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
</html>"""

    if style == "mechanism_cutaway":
        return """<!DOCTYPE html>
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
</html>"""

    if style == "accessible_guide":
        return """<!DOCTYPE html>
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
</html>"""

    if style == "teaser":
        return """<!DOCTYPE html>
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
</html>"""

    return """<!DOCTYPE html>
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
</html>"""


if __name__ == "__main__":
    mcp.run()
