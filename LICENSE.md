# Satchida AI Harness & LibreChat Enterprise Licensing & Architecture Policy

This document captures the enterprise software licensing boundaries, compliance obligations, and operational policies governing the Satchida AI Harness deployment on native Windows 11 bare-metal infrastructure.

---

## 1. Product & Service Context

Satchida AI Harness is a private, community- and enterprise-ready AI service operating on client edge nodes over outbound Cloudflare Zero Trust Tunnels (`cloudflared`) and VPNs. It provides web and mobile user interfaces, authentication, subscription tiering, and specialized multi-agent studios.

> **Crucial Commercial & Legal Premise:**
> Satchida AI Harness is **operated as a service**, not packaged and sold as a standalone boxed software product. All architectural designs strictly preserve license boundaries across host and tool subprocesses.

---

## 2. Core Software Licenses & Isolation Contracts

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LibreChat Web Harness (MIT)                          │
│   Frontend React SPA (client/)  ·  Backend API (packages/api, Node.js) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ stdio JSON-RPC (MCP)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Satchida Python MCP Microservices                       │
│    skill/satchida-montage-server.py  ·  satchida-tools hub             │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │ Subprocess CLI            │ Subprocess CLI             │ HTTP REST
        ▼                           ▼                            ▼
┌──────────────────┐        ┌──────────────────┐        ┌────────────────┐
│   Blender 4.x    │        │   OpenMontage    │        │  Satchida      │
│   (GPL-3.0)      │        │   (AGPL-3.0)     │        │  AutoRouter    │
│  Headless Eevee  │        │  External tools  │        │  (:4000)       │
└──────────────────┘        └──────────────────┘        └────────────────┘
```

### 2.1 LibreChat Core — MIT License
* **License**: MIT
* **Scope**: `client/`, `packages/api/`, `packages/data-schemas/`, `packages/data-provider/`.
* **Terms**: Complete permission to run, modify, distribute, and serve privately or commercially.
* **Compliance**: Copyright notices and permission notice retained in repository root `LICENSE`.

### 2.2 OpenMontage — AGPL-3.0 Boundary Architecture
* **License**: GNU Affero General Public License v3.0 (AGPL-3.0)
* **Location**: `D:\LAN-AI-Infra\Satchida-Studio\external\OpenMontage` (External Submodule/Clone).
* **The AGPL §13 Consideration**:
  AGPL §13 mandates that if you modify an AGPL program and run it over a network providing services to users, you must offer complete corresponding source code to those users.
* **Our Enterprise Compliance Guarantee**:
  1. **Strict Process Isolation**: LibreChat code **never imports, bundles, links, or wraps** OpenMontage code directly.
  2. **Subprocess / Stdio Protocol Boundary**: OpenMontage tools are called via standalone Python subprocesses or external JSON-RPC stdio microservices. Under FSF doctrine and copyright law, independent processes communicating over standardized pipe protocols (like MCP JSON-RPC or CLI args) do not form a single combined derivative work.
  3. **No Direct User Network Exposure**: Users never interact directly with the OpenMontage internals; they interact with LibreChat's MIT-licensed chat interface.

### 2.3 Blender 4.x & Eevee Next — GPL-3.0 Subprocess Model
* **License**: GNU General Public License v3.0 (GPL-3.0)
* **Execution Model**: Pure headless CLI command execution:
  ```powershell
  blender.exe -b -P scene_choreography.py -o frame_#####.png -F PNG -a
  ```
* **Compliance**: The Free Software Foundation (FSF) and Blender Foundation explicitly state that invoking Blender as an external executable from scripts, services, or web backends via CLI arguments and Python scripts run inside Blender's own interpreter does **not** infect the calling application with GPL.

### 2.4 Remotion — Commercial & Community Use Terms
* **License**: Remotion License / SSR
* **Usage**: Server-Side Rendering (SSR) video assembly, timeline choreography, and title burning inside `external/OpenMontage/remotion-composer`.
* **Compliance**: Free for internal company and personal use; eligible under Remotion terms for non-competing automated workflows.

### 2.5 AutoRouter & Third-Party Frontier APIs
* **Zero-Knowledge Master Credential Architecture**:
  Client nodes running LibreChat **never** hold master API keys for DeepInfra, Fal.ai, Google Cloud, Tripo, or Kling. All calls egress through `http://127.0.0.1:4000` (AutoRouter), which proxies to `control.satchida.com` where credentials are injected in-flight with Bifrost telemetry.

---

## 3. Studio Library Multi-Tenant Privacy & Scoping

1. **User Data Isolation**:
   * Assets generated by user `X` are tagged with `user: "X"` in `D:\LAN-AI-Infra\Satchida-Studio\exports\generated\manifest.json`.
   * The API endpoint `/api/studio/library` resolves the authenticated session user and returns:
     $$\text{Assets} = \{ a \in \text{Manifest} \mid a.\text{user} == \text{current\_user} \lor a.\text{user} == \text{'template'} \}$$
   * User `A` never sees videos or images rendered by User `B`.
2. **Inspirational Sample Templates**:
   * Curated starter showcase animations (e.g. `balloon_tea_plantation_sunrise.mp4`, `neon_skyscraper_orbit.mp4`, `steam_locomotive_arch_bridge_dusk_narrated.mp4`) are tagged as `user: "template"`.
   * These provide immediate inspiration for new users upon first opening the Studio Library.
3. **Session Navigation Integration**:
   * The Studio Library is integrated directly into the user's authenticated session profile menu (**Avatar / Profile Menu $\to$ Studio Library**), keeping the experience seamless and secure within the LibreChat workspace.
