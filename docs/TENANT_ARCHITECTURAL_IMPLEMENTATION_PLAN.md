# Satchida LibreChat Implementation Plan: Architectural AI Suite & Tenant Self-Containment

**Target Repository:** `D:\LAN-AI-Infra\LibreChat`  
**Deployment Model:** Single self-contained directory copied to Tenant PC (Edge Node behind CGNAT).  
**Upstream Connectivity:** Central `one-api` host via Cloudflare Zero Trust Named Tunnel (`gateway.satchida.com/v1`) using Machine-to-Machine Service Tokens.

---

## 1. Architectural Principles & Invariants

1. **Self-Contained Edge Directory:**
   - ONLY `LibreChat` is copied to tenant machines.
   - Zero external repo dependencies (`one-api` and `bifrost` remain strictly on Central HQ).
   - All static assets (Axonometra, Three.js, GSAP, Sandpack, fonts) are pre-vendored under `client/public/assets/vendor/`.
   - Node-based MCP engines (`@pascal-app/mcp`) are pinned in root `package.json` and executed from local `node_modules/`.

2. **Zero Cloud VPS / Zero VPN Directive:**
   - Outbound-only HTTPS over Cloudflare Zero Trust Named Tunnels to bypass symmetric CGNAT (Jio/Airtel).
   - No paid cloud relays (Headscale, DERP, WireGuard VPS).

3. **Multi-Typology Architectural Standards Engine:**
   - Supports arbitrary structures: Luxury Villas, Duplexes, High-Rise Towers, Underground Bunkers, and Deep Multi-Level Silos.
   - Enforces global building codes (IBC, NBC, ADA, Neufert, NFPA 101 Life Safety).
   - Forbids dual-door bathroom passthroughs between bedrooms; mandates dedicated private corridors.
   - Enforces 3-fixture wet/dry bathroom ergonomics (min 36–42 sq ft with min 5.0 ft clear width).

4. **Dual Presentation Modes:**
   - **Axonometra 3D:** Interactive browser-based first-person walkthrough with GLB export.
   - **Motion Studio 2.5D:** Orthographic CAD floor plan with deterministic timeline scrubbing and layer toggles.

---

## 2. Directory Layout & Relocation Checklist

Move all operational scripts that currently sit outside `LibreChat` into the repository:

```
D:\LAN-AI-Infra\LibreChat\
├── package.json                          <-- Add "@pascal-app/mcp": "^1.1.4"
├── ecosystem.config.cjs                  <-- Portable PM2 definition (LibreChat + Watchdog)
├── librechat.yaml                        <-- Central CF Tunnel endpoint + MCP servers
├── scripts\
│   └── ops\
│       ├── llama-watchdog.mjs            <-- Moved from ..\ops-scripts\ (uses relative paths)
│       ├── promote-model.py              <-- Moved from ..\ops-scripts\
│       └── watchdog-llama.ps1            <-- Moved from ..\ops-scripts\
├── skill\
│   ├── satchida-architect-server.py      <-- Multi-typology generator + Axonometra mount
│   ├── satchida-motion-server.py         <-- 2.5D Motion Studio engine (uses dynamic plan schema)
│   └── architectural_code_verifier.py    <-- IBC / NBC / Neufert code compliance engine
└── client\public\assets\vendor\
    ├── axonometra\                       <-- Pre-vendored Axonometra 3D viewer & editor
    ├── satchida\                         <-- Pre-vendored CAD studio & Motion engines
    ├── three\                            <-- Offline Three.js, OrbitControls, GLTFExporter
    └── gsap\                             <-- Offline GSAP 3.12.5 runtime
```

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Freeze Dependencies & Create Portable PM2 Profile
1. Edit `package.json` in the LibreChat root to add:
   ```json
   "dependencies": {
     "@pascal-app/mcp": "^1.1.4"
   }
   ```
2. Run `npm install` once in `D:\LAN-AI-Infra\LibreChat` to install into `node_modules/@pascal-app/mcp` and update `package-lock.json`.
3. Create `ecosystem.config.cjs` in `D:\LAN-AI-Infra\LibreChat`:
   ```javascript
   module.exports = {
     apps: [
       {
         name: 'librechat',
         script: './api/server.js',
         cwd: __dirname,
         env: {
           NODE_ENV: 'production',
           PORT: 3080,
           HOST: '0.0.0.0'
         }
       },
       {
         name: 'llama-watchdog',
         script: './scripts/ops/llama-watchdog.mjs',
         cwd: __dirname,
         autorestart: true
       }
     ]
   };
   ```
4. Copy `D:\LAN-AI-Infra\ops-scripts\*` into `D:\LAN-AI-Infra\LibreChat\scripts\ops\`, adjusting path references to use `__dirname` or relative paths.

---

### Task 2: Configure `librechat.yaml` for Central Tunnel & MCP Servers

1. Configure the central AI model endpoint using Cloudflare Access Service Token headers:
   ```yaml
   endpoints:
     custom:
       - name: "Satchida Central Gateway"
         apiKey: "${SATCHIDA_GATEWAY_KEY}"
         baseURL: "https://gateway.satchida.com/v1"
         models:
           default: ["deepseek-chat", "claude-3-5-sonnet", "gpt-4o"]
         headers:
           CF-Access-Client-Id: "${CF_ACCESS_CLIENT_ID}"
           CF-Access-Client-Secret: "${CF_ACCESS_CLIENT_SECRET}"
   ```

2. Register the architectural MCP servers under `mcpServers:`:
   ```yaml
   mcpServers:
     pascal-architect:
       type: stdio
       command: node
       args:
         - node_modules/@pascal-app/mcp/dist/cli.js
         - --stdio
       title: Pascal Whole-Building BIM & Scene Graph
       description: "89 parametric tools for building shells, levels, roofs, stairs, and structural inspections."
       chatMenu: true
       startup: true

     satchida-architect:
       type: stdio
       command: python
       args:
         - skill/satchida-architect-server.py
       title: Satchida Architectural Standards & 3D Viewer
       description: "Global building code verifier, daylight analysis, and interactive 3D Axonometra viewer."
       chatMenu: true
       startup: true
   ```

---

### Task 3: Universal Typology Engine (`skill/satchida-architect-server.py`)

1. Enhance `satchida-architect-server.py` to accept structural typology prompts:
   - **Villa / Bungalow:** Living, Dining, Courtyards, En-suite Master, Walk-in Dressing, Powder Room, Car Porch.
   - **Multi-Level High-Rise:** Symmetrical floor plates, central scissor stair core, lift lobby with 2.4m clearance, dual fire exits meeting IBC Chapter 10.
   - **Underground Bunker / Deep Silo:** Central vertical spiral stair and equipment shaft, NBC airlock vestibules, hydroponics/life-support sectors, reinforced blast walls (thickness 0.80m–1.5m).

2. Enforce the `ArchitecturalVerifier` rules on every generated plan:
   - Reject or warn on dual-door bathroom passthroughs.
   - Ensure full bathrooms have minimum 36–42 sq ft with 5.0 ft clear width.
   - Verify minimum corridor egress widths (1.05m / 3.5 ft residential, 1.2m commercial/tower).
   - Verify daylight glazing ratios ($\ge 10\%$ floor area for habitable rooms) or mandate artificial lightwells for underground rooms.

3. Return the Axonometra HTML artifact embedding the verified building schema:
   - Uses `/assets/vendor/axonometra/axonometra.js`
   - Zero external CDN links.

---

### Task 4: Connect Motion Studio 2.5D Generator to Dynamic Plan Schema

1. In `skill/satchida-motion-server.py`, replace the hardcoded 3BHK fallback plan with a dynamic parser that accepts the room and wall geometry produced by `satchida-architect-server.py`.
2. Generate the 2.5D orthographic SVG with:
   - Seamless marble / tile / paver SVG patterns.
   - Ambient wall drop shadow (`filter="url(#wallShadow)"`).
   - 2.5D orthographic furniture top-down vectors.
   - Dimension strings, room tags, and entrance arrows.
   - Deterministic GSAP timeline with `window.__TIMELINE__` and `window.__SEEK_FRAME__`.

---

## 4. Verification and Tenant Smoke Test

1. **Verify Offline Isolation:**
   - Disconnect network / disable DNS locally.
   - Load `http://localhost:3080/assets/architect-verified-plan.html` and `http://localhost:3080/assets/floorplan-motion-studio.html`.
   - Confirm all 3D meshes, textures, fonts, and controls load with zero failed network requests in Chrome DevTools.
2. **Verify Process Startup:**
   - Run `pm2 start ecosystem.config.cjs` from the `LibreChat` directory.
   - Confirm `librechat` and `llama-watchdog` report `online`.
3. **Verify Central Tunnel Auth:**
   - Execute a test prompt targeting `https://gateway.satchida.com/v1/chat/completions` with the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers.
   - Confirm status `200 OK` from central `one-api`.
