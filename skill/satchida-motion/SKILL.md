---
name: satchida-motion
description: "Build cinema-grade browser motion graphics, interactive CAD floor plans, drone/robotics telemetry sims, 'How Things Work' mechanical cutaways, medical & STEM visualizers, and kinetic reports using HTML5 + CSS3 + SVG + GSAP 3 + offline Three.js. Deliverables are self-contained single-file index.html artifacts with parametric controls, deterministic timeline scrubbing, and 60fps MP4 video export."
license: MIT
metadata:
  author: Satchida AI
  version: "2.0.0"
---

# Satchida-Motion — Interactive Simulation, CAD & Motion Graphics Engine

Satchida-Motion transforms complex ideas, architectural plans, engineering systems, medical anatomy, scientific laws, and business data into broadcast-grade, interactive browser simulations and motion graphics.

## Core Invariants (The Anti-PPT Law)

Before generating any animation artifact, verify these non-negotiable engineering rules:

1. **Continuous Camera / Spatial World, Never Static Slides**:
   - ❌ Never create multiple `<section>` slides that simply fade in and out (`autoAlpha: 0 -> 1`).
   - ✅ Elements inhabit a shared 2D orthographic CAD coordinate grid, 3D WebGL scene, or CSS 3D world (`perspective: 1200px`). The viewport pans, zooms, tilts, explodes layers, or tracks moving parts cleanly.

2. **Deterministic Timeline + Simulation Seek Contract**:
   - Every animation MUST register its master timeline onto `window.__TIMELINE__`:
     ```javascript
     const tl = gsap.timeline({ id: "main", defaults: { ease: "power3.out" } });
     window.__TIMELINE__ = tl;
     ```
   - **CRITICAL FOR THREE.JS / CANVAS SCENES**: Whenever using `<canvas>` or `THREE.WebGLRenderer`, NEVER rely on an unlinked free-running `requestAnimationFrame` loop as the sole state updater — headless MP4 export steps time via `window.__TIMELINE__.seek(t)`. Always expose:
     ```javascript
     window.__SEEK_FRAME__ = function(timeSeconds, progress) {
       // Compute deterministic positions/rotations from animated state variables or timeSeconds,
       // then call renderer.render(scene, camera) or ctx.clearRect/draw!
     };
     ```
     and call `window.__SEEK_FRAME__(tl.time(), tl.progress())` inside `tl.vars.onUpdate` as well as when live sliders change.

3. **Self-Contained Air-Gapped Single-File Artifact**:
   - Single complete `index.html` containing markup, `<style>`, and `<script>`.
   - Load vendored offline scripts first with CDN fallback:
     - GSAP: `<script src="/assets/vendor/gsap/gsap.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';"></script>`
     - Three.js (when 3D WebGL is selected): `<script src="/assets/vendor/three/three.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';"></script>`
     - OrbitControls (optional user camera inspection): `<script src="/assets/vendor/three/OrbitControls.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';"></script>`

4. **Interactive Parametric Lab HUD + Floating Playback Bar**:
   - Every engineering, architectural, STEM, medical, or "How Things Work" artifact includes a collapsible/unobtrusive **Parameter Control Panel** (sliders/toggles like `RPM`, `Sun Hour`, `Explode View`, `X-Ray Layers`, `Angle of Attack`, `Joint Target`, or `Step-by-Step`) synced cleanly with the scene.
   - Include the floating `#satchida-controls` bottom bar (`Play/Pause`, `Restart`, `input#timeline-scrubber`, time readout, and `Export Video` helper).

5. **Grounded Physics & Domain Verification**:
   - Before animating engineering formulas, invoke the companion Satchida MCP servers when available:
     - `satchida-maker-engineering` → Drone TWR & flight time, gear ratios, beam stress, hydraulics, 555/Op-Amp/PCB calculations
     - `satchida-stem-study` → SymPy derivations, chemical reaction balancing, physics kinematics/optics
     - `satchida-health-wellness` → BMR/TDEE macros, glycemic metrics, safe yoga/fitness cues
     - `satchida-ai-engineer` → Transformer attention dimensions & KV-cache sizing

---

## Adaptive Renderer Selection Matrix

Pick the exact visual technology that makes the requested persona feel museum-grade:

| Domain | Primary Engine | Signature Techniques |
|---|---|---|
| **Architecture & Floor Plans** | Precision `<svg viewBox>` + CSS 3D | Architectural blueprint grid background, dimension lines with arrowheads, room zone fills, door swing arcs, toggleable MEP layers, raycast sun-shadow polygon linked to Time-of-Day slider, smooth 2D → Isometric extrusion. |
| **Drones, Robotics & Orbitals** | Vendored `THREE.WebGLRenderer` (or layered 3D SVG HUD) | 3D coordinate grid, articulated hierarchy (`THREE.Group`), animated thrust/LiDAR rays, telemetry overlay HUD (`JetBrains Mono`), deterministic `window.__SEEK_FRAME__`. |
| **How Things Work Cutaways** | Synchronized Multi-Layer `<svg viewBox>` + GSAP | Crank/piston trigonometry, involute meshing gears, fluid/airflow dashed particle paths (`strokeDashoffset`), thermal gradient overlays, live RPM speed scaler (`tl.timeScale()`). |
| **Circuits, Networks & Algorithms** | Schematic `<svg>` + Split Scope `<canvas>` | Glowing signal pulses along copper traces/network hops, dual-channel oscilloscope waveform, packet header inspector, call-stack & swap pointers. |
| **Executive KPIs, Pitch & SaaS** | Spatial CSS 3D + SVG Charts | 3D perspective camera tracking, glassmorphic metric cards, rolling integer counters (`snap: { innerText: 1 }`), kinetic staggered headline entrances. |
| **Medical & Anatomical Clinical** | Clean Anatomical Cross-Section SVG | Oxygenated crimson (`#ef4444`) vs venous blue (`#3b82f6`), inflammation/plaque timeline morphs, zoomed receptor binding, patient-safe educational disclaimer footer. |
| **Golden Years & Accessible Guides** | AAA Large-Print Card Track | Cream (`#fefce8`) / deep navy (`#0f172a`) or slate (`>= 7:1` contrast), `>= 20px` body font, `0.65x` default calm pacing, oversized Pause / Restart / Next Step buttons. |

---

## LibreChat Inline Artifact Delivery Format (Mandatory)

- Deliver every HTML simulation inline directly in chat using LibreChat's exact directive wrapper (do **not** attempt filesystem/shell tools like `create_file` or `bash_tool`, do **not** invent custom `:::directive` names, and do **not** emit raw unwrapped `<!DOCTYPE html>`):

  ```markdown
  :::artifact{identifier="kebab-case-id" type="text/html" title="Concise Descriptive Title"}
  ````html
  <!DOCTYPE html>
  <html lang="en">...</html>
  ````
  :::
  ```

- Keep each single-file HTML artifact crisp and complete (~160–280 lines with no placeholders) so the interactive preview renders in one pass without truncation.

---

## Validation & 60fps MP4 Export Workflow

1. Build the complete standalone HTML artifact and emit it directly inline in `:::artifact{identifier="..." type="text/html" title="..."}` in a single pass.
2. **NEVER** call `validate_motion_html` prior to emitting an inline chat `:::artifact` — self-verify the Anti-PPT and `window.__TIMELINE__` checklist mentally so you do not serialize the HTML twice. Reserve `validate_motion_html` only for debugging a failed MP4 export.
3. Call `render_motion_to_video({ html_content, filename, duration_seconds, fps: 60, width: 1280, height: 720 })` **only** when the user explicitly requests an MP4 download or social reel (`1080x1920` for 9:16 reels).
