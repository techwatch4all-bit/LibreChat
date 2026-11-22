# Tenant Node Prerequisites & Deployment Guide

This document specifies the exact prerequisites, environmental dependencies, security/AV exclusions, telemetry requirements, and system architecture required to deploy and operate a **Satchida Edge Tenant Node** (LibreChat + AnythingLLM + Local LLM Fleet) on client hardware (School, College, Housing Society RWA, or SME).

> **Automated Installer**: Run [`scripts/install-tenant-prerequisites.ps1`](scripts/install-tenant-prerequisites.ps1) as **Administrator** on any new Windows 11 tenant PC to audit, install, and configure all prerequisites automatically.

---

## 1. Physical Node Architecture & Governance Rules

1. **Bare-Metal Native Windows 11**:
   - Zero Docker containers. All services run as native Windows background processes managed by PM2 or Windows Services.
   - Operating System: **Windows 11 Pro or Enterprise (64-bit)**.
   - Power Management Hardening: `powercfg -change -standby-timeout-ac 0` and `powercfg -change -hibernate-timeout-ac 0` (Sleep/Hibernate must be permanently disabled).
2. **Strict Physical Isolation**:
   - Each client node runs its own standalone, isolated MongoDB database (`127.0.0.1:27017`) and local AnythingLLM SQLite/LanceDB storage.
   - No cross-tenant database sharing or network bridging between different tenants.
3. **Zero-Knowledge Master Credentials**:
   - Upstream API keys (OpenAI, Anthropic, Gemini, DeepSeek) **NEVER exist on tenant machines**.
   - The tenant node routes all cloud-bound model requests through the central Operator Gateway (`https://gateway.satchida.com/v1`), which authenticates via provisioned tenant virtual keys and injects master credentials in-flight.
4. **Zero VPS & Zero VPN Directive**:
   - No Headscale, DERP, WireGuard, or paid cloud VPS.
   - All inbound and outbound traffic operates over **Cloudflare Zero Trust Named Tunnels (`cloudflared`)** on the `satchida.com` domain.

---

## 2. Hardware & Network Requirements

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Processor** | Intel Core i5 / AMD Ryzen 5 (8+ threads) | Intel Core i7/i9 or AMD Ryzen 7/9 |
| **System RAM** | 16 GB DDR4/DDR5 | 32 GB – 64 GB DDR5 |
| **GPU (Local LLM)** | None (Cloud / Remote Inference only) | NVIDIA RTX 3060 / 4060 / 5070 Ti (8GB–16GB+ VRAM) with latest CUDA Driver |
| **Disk Storage** | 256 GB NVMe SSD (minimum 50 GB free) | 1 TB+ NVMe SSD (for `.gguf` models + LanceDB + MongoDB) |
| **Network** | Symmetric Broadband (Jio, Airtel, ACT, etc.) behind CGNAT | 100 Mbps+ fiber connection with UPS / 24/7 power backup |

---

## 3. Software Dependencies & Runtime Prerequisites

Every tenant workstation requires the following runtimes installed natively before deploying LibreChat and AnythingLLM:

### 3.1 Core Runtimes & Databases
1. **Node.js (x64)**:
   - Version: `v20.x`, `v22.x`, or `v24.x LTS` (Reference machine: `v24.14.1`, `npm 11.19.1`).
   - Required by LibreChat, AnythingLLM, and PM2.
2. **Python (64-bit)**:
   - Version: `Python 3.11.x` or `3.12.x` (Reference machine: `Python 3.11.9`).
   - Must be added to system `PATH` (`python.exe`).
   - Required by telemetry (`probe_anythingllm.py`), MCP skill servers, and backup utilities.
   - Required packages: `pip install mcp starlette uvicorn httpx pydantic pymongo`.
3. **Git for Windows**:
   - Version: `2.40+` (Reference machine: `2.53.0`).
4. **MongoDB Community Server**:
   - Version: `MongoDB 7.0+` or `8.x` (Reference machine: `8.3`).
   - Installed as a native Windows Service (`MongoDB` running on `127.0.0.1:27017`).
5. **Process Manager (PM2)**:
   - Installed globally via npm:
     ```powershell
     npm install -g pm2 pm2-windows-startup
     pm2-startup install
     ```
6. **Cloudflare Tunnel Daemon (`cloudflared`)**:
   - Official Windows 64-bit binary (`cloudflared.exe`, Reference: `2026.10.7`).
   - Registered as a Windows Service (`cloudflared service install <TUNNEL_TOKEN>`).
7. **Microsoft Visual C++ Redistributable (2015–2022 x64)**:
   - Required by `llama-server.exe` (prism-llama) and native Node.js modules (`sharp`, `sqlite3`, `lancedb`).

### 3.2 Local LLM Inference Engines
1. **llama.cpp — Prism-Llama (CUDA Build)**:
   - Expected binary path: `D:\LAN-AI-Infra\prism-llama\bin\llama-server.exe` (or `C:\LAN-AI-Infra\prism-llama\bin\llama-server.exe`).
   - Requires NVIDIA Game Ready / Studio Driver with CUDA support (`nvidia-smi` accessible in `PATH`).
   - Model storage directories: `C:\LAN-AI-Infra\LLM-models` and/or `D:\LAN-AI-Infra\LLM-models`.
   - Port `8080` is reserved for the Tauri-managed multi-model llama fleet (`--models-preset ... --no-models-autoload`).
2. **Ollama**:
   - Version: `0.40+` (Reference machine: `0.40.17`).
   - Installed natively for Windows (`winget install Ollama.Ollama`), running on `http://127.0.0.1:11434`.
   - Used for local embeddings / fallback inference alongside `prism-llama`.

---

## 4. Telemetry, Directory Layout, & Security Hardening

### 4.1 Standard Directory Layout
To ensure zero-configuration compatibility with LibreChat, AnythingLLM, and telemetry probes, install under a consistent root (default `D:\LAN-AI-Infra` or `C:\LAN-AI-Infra`):
- `<ROOT>\LibreChat` — LibreChat server & client (Port `3080`)
- `<ROOT>\AnythingLLM` — AnythingLLM server & LanceDB (Port `3012`)
- `<ROOT>\prism-llama\bin\llama-server.exe` — Prism-Llama CUDA server (Port `8080`)
- `<ROOT>\LLM-models` — Local `.gguf` model files

### 4.2 Telemetry Environment Variables (LibreChat `.env`)
```ini
# Central Operator Gateway (Cloudflare Tunnel HTTPS endpoint)
SATCHIDA_GATEWAY_URL=https://gateway.satchida.com
SATCHIDA_TENANT_VIRTUAL_KEY=<PROVISIONED_TENANT_KEY>

# Optional overrides if installed on C:\ or custom port
ANYTHINGLLM_DB_PATH=D:\LAN-AI-Infra\AnythingLLM\server\storage\anythingllm.db
ANYTHINGLLM_PORT=3012
```

### 4.3 Antivirus, EDR & Windows Firewall Rules
1. **Windows Defender Exclusions**:
   - Add exclusions for `<ROOT>` (e.g., `D:\LAN-AI-Infra`) so Defender/EDR does not throttle or quarantine Node.js spawning `powershell.exe` (`probe_edge_live.ps1`) or `python.exe` (`probe_anythingllm.py`) during telemetry collection.
2. **PowerShell Execution Policy**:
   - Set `RemoteSigned` (or `Bypass` for LocalMachine/CurrentUser) so `probe_edge_live.ps1` runs cleanly without GPO/execution-policy blocks.
3. **Windows Firewall**:
   - **Outbound**: Allow TCP `443` (HTTPS) and UDP `7844` (QUIC) to `*.satchida.com` and Cloudflare edge IPs.
   - **Inbound (LAN only, if local LAN clients connect directly)**: Allow TCP `3080` (LibreChat) on Private network profile; keep `27017` (MongoDB) and `3012` (AnythingLLM) bound to `127.0.0.1`.

---

## 5. Cloudflare Zero Trust Architecture & Platform Limits

### 5.1 Cloudflare Free Tier Limits Applicable to Satchida
- **Named Tunnels**: Up to **1,000 active Named Tunnels** per account free.
- **Bandwidth & Throughput**: Unlimited standard HTTP/HTTPS and WebSocket/SSE streaming.
- **DNS Records**: Up to 3,500 DNS records per zone on the Free plan.
- **Request Body Size**: 100 MB max upload per request (exceeds our 25 MB upload ceiling).
- **Cloudflare Access**: Do **not** place Cloudflare Access user auth on public user ingresses (`<tenant>.satchida.com`) to avoid the 50-user Free tier cap.

### 5.2 Cloudflare Ingress Configuration (`config.yml` on Tenant PC)
Path: `C:\Users\<TenantUser>\.cloudflared\config.yml`
```yaml
tunnel: <TENANT_TUNNEL_UUID>
credentials-file: C:\Users\<TenantUser>\.cloudflared\<TENANT_TUNNEL_UUID>.json

ingress:
  - hostname: <tenant-subdomain>.satchida.com
    service: http://localhost:3080
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
      tcpKeepAlive: 30s
      keepAliveTimeout: 600s
      keepAliveConnections: 100
      httpHostHeader: <tenant-subdomain>.satchida.com

  - service: http_status:404
```

---

## 6. Security, Bot Defense, & Email Verification

### 6.1 Cloudflare Turnstile
Configure Turnstile keys in `librechat.yaml`:
```yaml
turnstile:
  siteKey: "<TURNSTILE_SITE_KEY>"
  secretKey: "<TURNSTILE_SECRET_KEY>"
```

### 6.2 SMTP Email Verification
```ini
ALLOW_REGISTRATION=true
ALLOW_UNVERIFIED_EMAIL_LOGIN=false
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_ENCRYPTION=starttls
EMAIL_USERNAME=alerts@satchida.com
EMAIL_PASSWORD=xxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@satchida.com
EMAIL_FROM_NAME="Satchida AI"
```

---

## 7. Tenant Admin Scope & Separation of Duties

1. **Operator Responsibility**:
   - Runs `scripts/install-tenant-prerequisites.ps1` to provision runtimes, MongoDB, Ollama, Prism-Llama, PM2, Defender exclusions, and Cloudflare Tunnel.
   - Generates the Cloudflare tunnel token, DNS hostname (`<tenant>.satchida.com`), and `SATCHIDA_TENANT_VIRTUAL_KEY`.
   - Seeds the tenant database with initial `TENANT_ADMIN` credentials.
2. **Tenant Admin Responsibility (Inside LibreChat `/admin` Console Only)**:
   - Reviews self-registered users who completed email verification.
   - Assigns users to sanctioned groups (`default`, `basic`, `family`, `privacy`).
   - Resets passwords or unlocks user accounts.
   - Zero access to Cloudflare, One-API, or raw master API keys.
