---
name: satchida-motion
description: "Build cinema-grade browser motion graphics, animated reports, kinetic typography, visual explainers, product teasers, and dynamic dashboards using HTML5 + CSS3 + GSAP 3 (+ Three.js when needed). Produces continuous, video-like visual choreography instead of static presentation slides. Deliverables are single-file index.html artifacts with built-in timeline scrubbing and video export capabilities."
license: MIT
metadata:
  author: Satchida AI
  version: "1.0.0"
---

# Satchida-Motion — Cinema-Grade Web Motion Graphics

Satchida-Motion transforms standard web pages and static reports into broadcast-grade, browser-rendered motion graphics. It eliminates "slide-deck syndrome" (static bullets, section-by-section fades) and replaces it with continuous camera choreographies, physics-based easing, kinetic typography, and deterministic timelines.

## Core Invariants (The Anti-PPT Law)

Before generating any animation code, verify these non-negotiable rules:

1. **Continuous Camera / Spatial World, Never Static Fades**:
   - ❌ Never create multiple `<section>` slides that simply fade in and out (`autoAlpha: 0 -> 1`).
   - ✅ Elements exist in a shared 2D or 3D world (`perspective: 1200px`). The "camera" moves through space (`transform: translate3d(x, y, z) rotateX(...) rotateY(...)`), zooming into data clusters, whipping to new viewpoints, or pushing through geometric portals.

2. **Deterministic Timeline Ownership**:
   - Every animation MUST register its master timeline onto `window.__TIMELINE__`:
     ```javascript
     const tl = gsap.timeline({ id: "main", defaults: { ease: "power3.out" } });
     window.__TIMELINE__ = tl;
     ```
   - This enables both human scrubbing and automated headless frame-by-frame video rendering via the `satchida-motion` MCP tool.

3. **Self-Contained Single-File Output**:
   - The deliverable is a single, complete `index.html` containing HTML structure, embedded `<style>`, and embedded `<script>`.
   - Scripts load local GSAP (`/assets/vendor/gsap/gsap.min.js`) with an automatic CDN fallback (`https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`).

4. **Integrated Scrubber & Export Controls**:
   - Every generated motion piece includes a floating bottom control bar with:
     - Play / Pause (or Spacebar toggle)
     - Interactive drag scrubber timeline
     - Speed toggles (0.5x, 1x, 2x)
     - An **"Export Video"** button that utilizes `MediaRecorder` to download a `.webm` / `.mp4` video directly from the browser.

---

## Anatomy of a Satchida-Motion Artifact

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Satchida Motion Presentation</title>
  <!-- Local Vendor GSAP with CDN fallback -->
  <script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>
  <style>
    :root {
      --bg: #090a0f;
      --surface: rgba(255, 255, 255, 0.04);
      --border: rgba(255, 255, 255, 0.1);
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.35);
      --text-main: #f8fafc;
      --text-sub: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #viewport {
      position: relative;
      width: 100vw;
      height: 100vh;
      perspective: 1200px;
      overflow: hidden;
    }
    #world {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      will-change: transform;
    }
    /* Floating Control Bar */
    #satchida-controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    #satchida-controls button {
      background: transparent;
      border: none;
      color: #e2e8f0;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      transition: background 0.15s;
    }
    #satchida-controls button:hover { background: rgba(255, 255, 255, 0.1); }
    #satchida-controls input[type="range"] {
      width: 180px;
      cursor: pointer;
      accent-color: var(--accent);
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="world">
      <!-- Motion Scenes & Spatial Objects Here -->
    </div>
  </div>

  <!-- Bottom Floating Controller -->
  <div id="satchida-controls">
    <button id="btn-play">Pause</button>
    <button id="btn-restart">Restart</button>
    <input type="range" id="timeline-scrubber" min="0" max="100" value="0" step="0.1">
    <span id="time-display" style="font-size: 12px; color: var(--text-sub); font-variant-numeric: tabular-nums;">00:00</span>
    <button id="btn-export" style="background: var(--accent); color: white;">Export Video</button>
  </div>

  <script>
    const tl = gsap.timeline({
      id: "main",
      onUpdate: updateScrubber,
      onComplete: () => { /* loop or hold */ }
    });
    window.__TIMELINE__ = tl;

    // --- ANIMATION CHOREOGRAPHY ---
    // Example: Camera moves and kinetic elements
    tl.to("#world", { z: 400, rotateY: -15, duration: 4, ease: "power2.inOut" }, 0);
    // Add more choreography layers here...

    // --- SCRUBBER & PLAYBACK ENGINE ---
    const playBtn = document.getElementById("btn-play");
    const restartBtn = document.getElementById("btn-restart");
    const scrubber = document.getElementById("timeline-scrubber");
    const timeDisplay = document.getElementById("time-display");

    function updateScrubber() {
      const progress = tl.progress() * 100;
      scrubber.value = progress;
      const cur = tl.time().toFixed(1);
      const total = tl.duration().toFixed(1);
      timeDisplay.textContent = `${cur}s / ${total}s`;
    }

    playBtn.onclick = () => {
      if (tl.paused()) {
        tl.play();
        playBtn.textContent = "Pause";
      } else {
        tl.pause();
        playBtn.textContent = "Play";
      }
    };
    restartBtn.onclick = () => { tl.restart(); playBtn.textContent = "Pause"; };
    scrubber.oninput = (e) => {
      tl.pause();
      playBtn.textContent = "Play";
      tl.progress(e.target.value / 100);
    };

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") { playBtn.click(); e.preventDefault(); }
      if (e.key === "r" || e.key === "R") { restartBtn.click(); }
    });
  </script>
</body>
</html>
```

---

## Design Styles for Satchida-Motion

### 1. Executive Intelligence & Data Reports
- **Palette**: Deep navy/slate (`#0a0f1d`), luminous cyan (`#06b6d4`), gold (`#f59e0b`).
- **Typography**: Monospace data callouts (`JetBrains Mono`, `Fira Code`) paired with punchy geometric headers (`Inter`, `Syne`).
- **Motion Patterns**:
  - Live metric count-ups (`gsap.to(counter, { innerText: 4500000, snap: { innerText: 1 } })`).
  - SVG charts that animate in using `strokeDashoffset`.
  - Camera pans smoothly from high-level summary to detailed metric node.

### 2. Product Launch & Tech Teaser
- **Palette**: Pitch black (`#050508`), holographic purple/indigo gradient accents, glassmorphic cards.
- **Motion Patterns**:
  - 3D card tilt & parallax depth.
  - Kinetic headline text: letters staggering in with 3D rotation (`rotateX: 90`, `y: 40`, `stagger: 0.04`).
  - Dynamic ambient particle background or subtle mesh glow.

### 3. Whiteboard & Strategic Explainer
- **Palette**: Warm slate/parchment background (`#f8fafc` or `#18181b`), hand-drawn vector elements.
- **Motion Patterns**:
  - Arrows tracing relationships between architecture nodes.
  - Camera zooms directly into the active topic while blurring out distant context.

---

## Tool Integration

When the user asks to render the animation into a permanent high-resolution video file:
- Call the **`satchida-motion` MCP tool**: `render_motion_to_video({ html_content, duration_seconds, fps: 60 })`.
- The MCP server uses headless Playwright and local FFmpeg to scrub `window.__TIMELINE__` frame-by-frame and output an MP4 video directly into LibreChat.
