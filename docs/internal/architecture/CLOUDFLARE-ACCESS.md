# Cloudflare Zero Trust & Remote Access Architecture

How a client server behind Jio/Airtel CGNAT becomes reachable by its own end users and by Seller Central HQ with **zero cloud VPS costs ($0/month)**, no router port forwarding, and **zero VPN apps required on end-user phones/laptops**.

Related: `ARCHITECTURE.md` §1, §8, §12; `DEPLOYMENT.md`; `Implementation-plan.md`.

---

## 1. The CGNAT Problem, Stated Exactly

On Indian residential and commercial broadband connections (JioFiber, Jio AirFiber, Airtel Xstream, Jio 5G), customers sit behind **Carrier-Grade NAT (CGNAT)** with symmetric port-restricted behavior.
Consequences:
- **No public IPv4 address:** There is no WAN IP assigned to the client router to route incoming packets.
- **Port forwarding is impossible:** Inbound TCP/UDP connection attempts are rejected at the telecom provider's carrier gateway.
- **Both ends are isolated:** Both your central HQ PC and your client's desktop in another city or state are behind CGNAT.
- **Traditional P2P hole-punching fails:** Symmetric CGNAT randomizes port allocations, breaking standard direct peer-to-peer WireGuard connections.

---

## 2. Why Cloudflare Tunnels (Zero Trust) Beat Headscale/DERP

Earlier proposals suggested spinning up a self-hosted Headscale instance with a DERP relay on a cloud VPS. For our operating requirements, that model is flawed:

| Metric | Cloudflare Named Tunnels (Implemented) | Headscale + Cloud DERP Relay |
| :--- | :--- | :--- |
| **Monthly Cost** | **$0 / month** (Free tier on custom domain) | **₹500–₹1,500/month** (Requires paid public VPS with egress charges) |
| **End-User UX** | **Frictionless:** Users open `https://client.satchida.com` in any browser | **High friction:** Every user must install Tailscale/WireGuard app |
| **Mobile Experience** | Instant Web & Native **PWA** ("Add to Home Screen") | Background VPN app required; causes phone battery drain & disconnection |
| **CGNAT Traversal** | **100% Reliable:** Outbound QUIC/HTTPS to Cloudflare Edge | Relies on DERP relay fallback when P2P hole-punching fails on Jio |
| **TLS / SSL** | Automatic Let's Encrypt / Cloudflare Edge TLS certificates | Manual certbot / reverse proxy config required on VPS |
| **Maintenance** | Single lightweight executable (`cloudflared.exe`) on Windows | Linux VPS OS patching, Docker maintenance, Headscale DB backups |

**Decision:** We use **Cloudflare Zero Trust Named Tunnels (`cloudflared`)**. It satisfies the core business directive: **Zero monthly hosting fees** and zero friction for schools, SME employees, and students.

---

## 3. Distributed Ingress Architecture

Traffic flows across two distinct, isolated planes:

```
+===================================================================================================+
|                                    SELLER CENTRAL MASTER HQ                                       |
|                                (Your Windows 11 PC - Jio CGNAT)                                   |
|                                                                                                   |
|   - Master Fleet Controller (Port 8443)                                                           |
|   - Master Key Vault (OpenAI, Anthropic, Gemini master API keys)                                  |
|   - Master License & Seat Ledger                                                                  |
|   - Office Workers' LibreChat Instance (Port 3080)                                                |
|   - cloudflared.exe (Outbound tunnel exposing control.satchida.com & office.satchida.com)     |
+=================================================▲=================================================+
                                                  │ Outbound HTTPS/QUIC
                                                  ▼
+===================================================================================================+
|                                CLOUDFLARE ZERO TRUST GLOBAL EDGE                                  |
|   - Ingress Routing: *.satchida.com -> Maps dynamically to individual Tunnel IDs                |
|   - Automated TLS 1.3 Termination, Edge DDoS Protection, WAF Rate Limiting                        |
+===================================================================================================+
        ▲                                                ▲
        │ Outbound QUIC Tunnel                           │ Outbound QUIC Tunnel
        │ (Tunnel Token: school-mum-token)               │ (Tunnel Token: sme-blr-token)
+-------┴-------------------------------+        +-------┴-------------------------------+
| CLIENT 1: Mumbai High School          |        | CLIENT 2: Bengaluru Logistics SME     |
| Hostname: school-mum.satchida.com   |        | Hostname: sme-blr.satchida.com      |
|                                       |        |                                       |
| - LibreChat (Port 3080, native)       |        | - LibreChat (Port 3080, native)       |
| - Native RAG Service (LanceDB/FTS5)   |        | - Native RAG Service (LanceDB/FTS5)   |
| - Local MongoDB (Student accounts)    |        | - Local MongoDB (Employee accounts)   |
| - Fleet Sync Daemon (Polls HQ API)    |        | - Fleet Sync Daemon (Polls HQ API)    |
| - cloudflared.exe (Windows Service)   |        | - cloudflared.exe (Windows Service)   |
+---------------------------------------+        +---------------------------------------+
        ▲                                                ▲
        │ Standard HTTPS / PWA Mobile                    │ Standard HTTPS / PWA Mobile
   [Students & Teachers at home/school]             [Employees in field or office]
   (Open browser: school-mum.satchida.com)        (Open browser: sme-blr.satchida.com)
```

---

## 4. End-User Mobile & Desktop Access

End users (teachers, students, SME staff) do not need administrative access or technical knowledge:

1. **Desktop Browsers (Chrome, Edge, Firefox, Safari):**  
   User navigates to `https://client-subdomain.satchida.com`. They register or log in using their individual credentials stored in the client's local MongoDB.
2. **Mobile (Android & iOS PWA):**  
   Users open the URL on mobile, tap **"Add to Home Screen"**, and LibreChat runs as a standalone app with native viewport scaling, offline icon presence, and full responsive layout.
3. **Bandwidth Efficiency:**  
   Because LibreChat streams tokens over SSE/WebSocket, chat traffic consumes minimal bandwidth (under 50 KB per typical conversation turn).

---

## 5. Control Plane: Polling & Licensing Over Jio CGNAT

Because both your PC (HQ) and the client machines are behind Jio CGNAT in different locations:

1. **Client Sync Daemon:** Runs on each client machine as a background Windows service.
2. **Outbound Heartbeat:** Every 15–30 seconds, it sends an outbound HTTPS `POST` to `https://control.satchida.com/api/v1/fleet/heartbeat`.
3. **Payload Authentication:** Requests are cryptographically signed with an HMAC-SHA256 signature using the client's provisioned `clientSecret`.
4. **Policy Synchronization:**
   - The client reports current active seat count, remaining token balance, and any pending admin requests (e.g. "Principal requested +25 seats").
   - Your central controller checks your master database, updates your dashboard, and responds with approved seat caps, updated token allowances, or configuration updates.
5. **Local Enforcement:** The client sync daemon applies authorized seat caps to local MongoDB registration rules automatically.

---

## 6. Client Provisioning Steps (cloudflared)

Installing the edge ingress daemon on a client machine requires only two commands:

```powershell
# 1. Install cloudflared via winget
winget install Cloudflare.cloudflared --silent --accept-package-agreements --accept-source-agreements

# 2. Register and start as a Windows Service with the client's tunnel token
cloudflared.exe service install <TENANT_TUNNEL_TOKEN>
```

Once installed, `cloudflared` starts automatically on boot, connects outbound to Cloudflare's edge, and exposes `http://127.0.0.1:3080` to the client's assigned subdomain with valid HTTPS.
---

## 7. Edge Attack Prevention & Tunnel Hardening ($0 / Free Tier)

Publicly exposed Cloudflare Named Tunnels (`https://*.satchida.com`) do not open incoming router ports on the Windows machine, but malicious actors can still attempt HTTP-level brute-force attacks against the web login interface.

All of the following defenses are available on Cloudflare's **100% Free Plan** and **Free Zero Trust (up to 50 users)**:

| Attack Vector | Free Protection Mechanism | Implementation Layer |
| :--- | :--- | :--- |
| **Global automated bot scanning** | **Geo-Blocking Rule:** Block all traffic outside India (`ip.geoip.country ne "IN"`) | Cloudflare Edge WAF (Free) |
| **Credential stuffing / password brute-force** | **WAF Rate Limiting:** 5 requests / 10s on `/api/auth/login` | Cloudflare Edge WAF (Free) |
| **Automated fake account registration** | **Cloudflare Turnstile:** Free invisible CAPTCHA built into LibreChat (`turnstile:` block in `librechat.yaml`) plus `TRUST_PROXY=1` | Cloudflare Edge + LibreChat |
| **Unauthorized probing of `control.satchida.com`** | **Zero Trust Service Token:** Unauthenticated traffic rejected with 403 at Cloudflare Edge before reaching your PC | Cloudflare Zero Trust Access (Free) |
| **Office worker access (`office.satchida.com`)** | **Zero Trust Email OTP / SSO:** Only authenticated office emails can reach the LibreChat login screen | Cloudflare Zero Trust Access (Free) |
| **Origin exhaustion & local host scanning** | **Strict Loopback Binding:** LibreChat binds to `127.0.0.1:3080` (never `0.0.0.0`) + internal `LOGIN_MAX=7` | Windows 11 host level |

---

## 8. Decisions recorded

**D1 — Transport: Cloudflare Zero Trust Named Tunnels. Headscale/DERP is rejected.**
Decided 2026-10-03. Rationale in §2. `HEADSCALE.md` was removed.

**D2 — Domain: `satchida.com`.** All tunnels bind to `*.satchida.com`. The placeholder
`yourdomain.com` that appeared throughout earlier drafts is retired.

**D3 — Tunnel ownership: Satchida operates all client tunnels** on the `satchida.com` account.

> **Risk accepted, recorded deliberately.** The self-serve Cloudflare plan includes no Data
> Processing Addendum — Cloudflare states one requires Enterprise. A school, as Data Fiduciary,
> would therefore be processing student personal data through a processor without a DPA in place.
> The exposure falls on the school, not on Satchida, but it can still stop a B2B sale.

**Mitigations, in the order we will use them:**
1. Disclose it in `CLIENT-PROPOSAL.md` §4 and §9 — the client may run the tunnel from their own
   Cloudflare account; we supply the same two commands at no charge
2. `control.satchida.com` stays on a **Zero Trust Service Token**. It carries **no customer
   content** — only licence, seat and heartbeat metadata — so it is not part of this exposure
3. Move to a Cloudflare Enterprise DPA when revenue justifies it

**Never promise a DPA we do not hold.** A school asking for one is answered with the customer's
own-account option, not with reassurance.

**D4 — Control plane is outbound-only.** Client sync daemons poll us; nothing pushes inbound. This
is what makes CGNAT irrelevant to licensing.
