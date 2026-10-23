# Deployment — Native Windows 11 Edge Node & HQ Setup

Operator-facing guide for deploying LibreChat natively on Windows 11 Pro / Enterprise across client sites (schools, SMEs) and at Seller Central HQ. **Docker is not used anywhere in this stack.** Every service runs bare-metal.

Related: `ARCHITECTURE.md`, `CLOUDFLARE-ACCESS.md` (Cloudflare Tunnels), `Implementation-plan.md`.

---

## 1. System Requirements & Runtime Prerequisites

| Component | Specification | Deployment Method |
| :--- | :--- | :--- |
| **OS** | Windows 11 Pro / Enterprise (64-bit) | Bare-metal host |
| **Node.js** | Node.js v20+ / v24 LTS | Native installer / winget |
| **Database** | MongoDB Community Server (v7 / v8) | Native Windows MSI (runs as Windows Service) |
| **Process Manager** | PM2 + `pm2-windows-startup` or NSSM | Native Windows Services |
| **Ingress Tunnel** | `cloudflared.exe` | Native Windows Service (`cloudflared service install`) |
| **Local Inference** | `llama.cpp server` / `Ollama` | Native Windows CUDA binary (Port 11434 or 8080) |
| **RAG Service** | TypeScript Native RAG (`rag-service/`) | PM2 managed on Port 8000 |

---

## 2. Power & Reliability Hardening (Windows 11)

Because edge desktop machines will serve remote users 24/7 without a logged-in user, configure Windows power management to disable sleep and hibernation:

```powershell
# Run in Administrator PowerShell
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 10
powercfg /change hibernate-timeout-ac 0

# Set MongoDB and Cloudflared services to auto-restart on failure
sc.exe failure MongoDB reset= 86400 actions= restart/60000/restart/60000/restart/60000
sc.exe failure Cloudflared reset= 86400 actions= restart/60000/restart/60000/restart/60000
```

---

## 3. Client Node Automated 1-Click Provisioning Script

Save as `C:\Deploy-EdgeNode.ps1` for rapid deployment to new client machines:

```powershell
param (
    [Parameter(Mandatory=$true)] [string]$ClientId,
    [Parameter(Mandatory=$true)] [string]$ClientSecret,
    [Parameter(Mandatory=$true)] [string]$CloudflareTunnelToken,
    [Parameter(Mandatory=$true)] [string]$SubdomainPrefix
)

$ErrorActionPreference = "Stop"
Write-Host "=== Provisioning Satchida Edge Node: $ClientId ===" -ForegroundColor Cyan

# 1. Install System Dependencies
Write-Host "[1/5] Installing dependencies via Winget..." -ForegroundColor Yellow
winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
winget install MongoDB.Server --silent --accept-package-agreements --accept-source-agreements
winget install Cloudflare.cloudflared --silent --accept-package-agreements --accept-source-agreements

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 2. Deploy LibreChat
Write-Host "[2/5] Setting up LibreChat..." -ForegroundColor Yellow
$InstallPath = "C:\LibreChat"
if (!(Test-Path $InstallPath)) {
    git clone https://github.com/techwatch4all-bit/LibreChat.git $InstallPath
}
Set-Location $InstallPath

$JwtSecret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
$JwtRefresh = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")

# 3. Configure Local Environment
$EnvContent = @"
HOST=127.0.0.1
PORT=3080
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat
JWT_SECRET=$JwtSecret
JWT_REFRESH_SECRET=$JwtRefresh
ALLOW_REGISTRATION=false
ALLOW_EMAIL_LOGIN=true
CHECK_BALANCE=true
APP_TITLE="$SubdomainPrefix AI Portal"
CUSTOM_FOOTER="Managed AI Infrastructure"
"@
Set-Content -Path "$InstallPath\.env" -Value $EnvContent

# 4. Build LibreChat
Write-Host "[3/5] Building LibreChat packages..." -ForegroundColor Yellow
npm install
npm run build:data-provider
npm run build:data-schemas
npm run build:api
npm run build:client-package
cd client; npm run build; cd ..

# 5. Register Autostart Services
Write-Host "[4/5] Registering PM2 and Cloudflared services..." -ForegroundColor Yellow
npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start npm --name "librechat" -- run backend
pm2 save

# Install Cloudflare Named Tunnel as Windows Service
cloudflared.exe service install $CloudflareTunnelToken

Write-Host "=== Edge Node Successfully Online: https://$SubdomainPrefix.yourdomain.com ===" -ForegroundColor Green
```

---

## 4. Seller Central Master HQ Setup (Your Workstation)

Your workstation in `D:\LAN-AI-Infra\LibreChat` serves both your office team and coordinates the fleet:

1. **Office LibreChat Instance:**
   - Runs natively on `http://127.0.0.1:3080`.
   - Connected via `cloudflared` to `office.yourdomain.com`.
2. **Central Fleet Controller Daemon:**
   - Runs on `http://127.0.0.1:8443`.
   - Connected via `cloudflared` to `control.yourdomain.com`.
   - Verifies incoming client heartbeat signatures, exposes administrative approval controls, and acts as the secure key vault proxy for LLM requests.
---

## 5. High-Concurrency Tuning for 1,000+ Users (Windows 11)

When configuring a client machine expected to register 500 to 1,000+ users:

### 1. PM2 Cluster Mode (Node.js Concurrency)
Instead of running a single Node.js process, use PM2 cluster mode to utilize all CPU cores on the Windows desktop (e.g. 8 cores / 16 threads):
```powershell
# Run in C:\LibreChat
pm2 start "npm run backend" -i max --name "librechat"
pm2 save
```

### 2. MongoDB Indexing & RAM Allocation
MongoDB on Windows 11 defaults to using 50% of available system RAM for WiredTiger cache.
For a 16 GB or 32 GB RAM client machine, add this to `C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg`:
```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4
```
Ensure compound indexes exist on `messages` (`{ conversationId: 1, createdAt: -1 }`) and `users` (`{ email: 1 }`).

### 3. Windows Ephemeral TCP Port Limit
Increase Windows dynamic outbound socket ports for high-concurrency SSE connections:
```powershell
# Run in Administrator PowerShell
netsh int ipv4 set dynamicport tcp start=1025 num=64511
```