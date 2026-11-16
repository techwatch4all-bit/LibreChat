# Tenant Node Prerequisites & Deployment Guide

This document specifies the exact prerequisites, environmental dependencies, Cloudflare configuration, and system architecture required to package, deploy, and operate a **Satchida Edge Tenant Node** on client hardware (School, College, Housing Society RWA, or SME).

---

## 1. Physical Node Architecture & Governance Rules

1. **Bare-Metal Native Windows 11**:
   - Zero Docker containers. All services run as native Windows background processes managed by PM2.
   - Operating System: Windows 11 Pro or Enterprise (64-bit).
   - Windows Power Management Hardening: `powercfg -change -standby-timeout-ac 0` (Sleep must be permanently disabled).
2. **Strict Physical Isolation**:
   - Each client node runs its own standalone, isolated MongoDB database.
   - No cross-tenant database sharing or network bridging between different tenants.
3. **Zero-Knowledge Master Credentials**:
   - Upstream API keys (OpenAI, Anthropic, Gemini, DeepSeek) **NEVER exist on tenant machines**.
   - The tenant node routes all cloud-bound model requests through the central Operator Gateway (`control.satchida.com`), which authenticates via provisioned seat tokens and injects master credentials in-flight.
4. **Zero VPS & Zero VPN Directive**:
   - No Headscale, DERP, WireGuard, or paid cloud VPS.
   - All inbound and outbound traffic operates over **Cloudflare Zero Trust Named Tunnels (`cloudflared`)** on the `satchida.com` domain.

---

## 2. Hardware & Network Requirements

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Processor** | Intel Core i5 / AMD Ryzen 5 (8+ threads) | Intel Core i7/i9 or AMD Ryzen 7/9 |
| **System RAM** | 16 GB DDR4/DDR5 | 32 GB – 64 GB DDR5 |
| **GPU (Optional)** | None (Pure Cloud / Remote Inference) | NVIDIA RTX 3060 / 4060 (8GB+ VRAM) for offline local llama fleet |
| **Disk Storage** | 256 GB NVMe SSD (minimum 50 GB free) | 1 TB+ NVMe SSD |
| **Network** | Symmetric Broadband (Jio, Airtel, ACT, etc.) behind CGNAT | 100 Mbps+ fiber connection with 24/7 power backup |

---

## 3. Software Dependencies & Runtime Prerequisites

Every tenant workstation requires the following runtimes installed natively before deployment:

### 3.1 Core Runtimes
1. **Node.js**:
   - Version: `v20.x` or `v22.x LTS` (x64 Windows installer).
   - Bundled with `npm` (v10+).
2. **Python**:
   - Version: `Python 3.11.x` or `3.12.x` (64-bit Windows).
   - Must be added to system `PATH`.
   - Packages: `pip install mcp starlette uvicorn httpx pydantic` (for MCP skill servers).
3. **Git for Windows**:
   - Version: `2.40+` (Used for versioning and automated bundle updates).
4. **MongoDB Community Server**:
   - Version: `MongoDB 7.0+` or `8.0+`.
   - Installed as a native Windows Service (`MongoDB` service running on `localhost:27017`).
5. **Process Manager (PM2)**:
   - Installed globally via npm:
     ```powershell
     npm install -g pm2
     npm install -g pm2-windows-startup
     pm2-startup install
     ```
6. **Cloudflare Tunnel Daemon (`cloudflared`)**:
   - Download official Windows 64-bit binary `cloudflared.exe`.
   - Placed in standard directory (e.g., `C:\Program Files\cloudflared\` or `C:\Users\<user>\.cloudflared\`).

---

## 4. Cloudflare Zero Trust Architecture & Official Platform Limits

### 4.1 Cloudflare Free Tier Limits Applicable to Satchida
- **Named Tunnels**: Cloudflare Zero Trust permits **up to 1,000 active Named Tunnels per account completely free**.
- **Bandwidth & Throughput**: Free and unlimited bandwidth for standard HTTP/HTTPS and WebSocket streaming (crucial for SSE LLM token streaming).
- **DNS Records**: Up to 3,500 DNS records per zone on the Free plan (ample for 1,000 `<tenant>.satchida.com` subdomains).
- **Request Body Size**: 100 MB maximum upload size per request on Free/Pro tiers (exceeds our 25 MB file upload ceiling).
- **Edge Timeout**: 100 seconds standard HTTP response timeout (mitigated by SSE streaming chunks which keep the TCP connection alive).
- **Cloudflare Access (Zero Trust Seats)**: Up to 50 active users on the Free plan. **Important**: Because of this 50-user cap, we explicitly **do not** place Cloudflare Access user authentication on public user ingresses (`<tenant>.satchida.com`). Cloudflare Access is only used for service tokens between servers (`gateway.satchida.com`), keeping our user-facing app open to thousands of users without hitting seat limits.
- **Turnstile Captcha**: Free tier includes unlimited widgets and up to 1,000,000 challenge evaluations per month without charge.

### 4.2 Cloudflare Ingress Configuration (`config.yml` on Tenant PC)
Path: `C:\Users\<TenantUser>\.cloudflared\config.yml`
```yaml
tunnel: <TENANT_TUNNEL_UUID>
credentials-file: C:\Users\<TenantUser>\.cloudflared\<TENANT_TUNNEL_UUID>.json

ingress:
  # Public user-facing URL for the tenant
  - hostname: <tenant-subdomain>.satchida.com
    service: http://localhost:3080
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
      tcpKeepAlive: 30s
      keepAliveTimeout: 600s
      keepAliveConnections: 100
      httpHostHeader: <tenant-subdomain>.satchida.com

  # 404 Catch-all security barrier
  - service: http_status:404
```

### 4.3 Outbound Upstream Routing to Operator Gateway
- The tenant node requires **NO inbound port openings** and **NO incoming tunnel for One-API**.
- The tenant node communicates outbound over standard HTTPS to the Operator Gateway at:
  `https://gateway.satchida.com/v1`
- Cloudflare routes this outbound traffic into the Operator Central PC's `satchida-infra` tunnel.

---

## 5. Security, Bot Defense, & Email Verification

### 5.1 Cloudflare Turnstile (Managed Challenge)
- Prevents bots, automated credential scrapers, and malicious registration bursts at the edge.
- Set up a Turnstile widget on the Cloudflare Dashboard for `*.satchida.com`.
- Keys configured in `librechat.yaml`:
  ```yaml
  turnstile:
    siteKey: "<TURNSTILE_SITE_KEY>"
    secretKey: "<TURNSTILE_SECRET_KEY>"
  ```

### 5.2 SMTP Email Verification
- To guarantee that only authentic residents or students can create an account, email verification is strictly enforced before an account can even be reviewed.
- Configure SMTP credentials in `.env`:
  ```bash
  ALLOW_REGISTRATION=true
  ALLOW_UNVERIFIED_EMAIL_LOGIN=false
  EMAIL_SERVICE=
  EMAIL_HOST=smtp.gmail.com   # Or AWS SES / Brevo / Resend / Mailgun
  EMAIL_PORT=587
  EMAIL_ENCRYPTION=starttls
  EMAIL_USERNAME=alerts@satchida.com
  EMAIL_PASSWORD=xxxxxxxxxxxxxxxx
  EMAIL_FROM=noreply@satchida.com
  EMAIL_FROM_NAME="Satchida AI"
  ```

---

## 6. Tenant Admin Scope & Separation of Duties

To protect system integrity, **Tenant Admins never touch infrastructure or Cloudflare**:
1. **Operator Responsibility**:
   - Installs the software bundle (Node, Python, MongoDB, PM2, Cloudflare Tunnel).
   - Generates the Cloudflare tunnel token and DNS hostname (`<tenant>.satchida.com`).
   - Seeds the tenant database with the initial `TENANT_ADMIN` credentials.
2. **Tenant Admin Responsibility (Inside LibreChat `/admin` Console Only)**:
   - Reviews self-registered users who completed email verification.
   - Inspects the `Unique Identifier` (e.g., verifying that "Tower B, Flat 402" actually lives there).
   - Assigns the user to the appropriate group (`Basic`, `Standard`, `Pro`, or `Family`).
   - Resets passwords or unlocks user accounts if requested.
   - Zero access to Cloudflare, Zero Trust dashboard, One-API, or raw database keys.
