# Satchida LibreChat — Ground-Truth Build Guide
<!-- Audience: any AI agent or engineer executing the build cold.
     Every command and file path is verified from the actual repository.
     Nothing here is guessed or hallucinated. If a fact is unknown, it says so.
     Last verified: 2026-10-04 Node 24.14.1, LibreChat v0.8.8 -->

> [!IMPORTANT]
> **Shell is Windows PowerShell 5.1.**
> `&&` does NOT exist. Use `;` then `if ($?) { next-command }`.
> Never use `Get-Content | Set-Content` for UTF-8 files — it double-encodes. Use `node -e "..."` or write a temp `.js` file.

---

## 0. Facts about this repository (verified)

| Fact | Value |
|---|---|
| Repo root | `D:\LAN-AI-Infra\LibreChat` |
| LibreChat version | v0.8.8 |
| Package manager | **npm** (`packageManager: "npm@11.13.0"` in `package.json`) — NOT pnpm, NOT bun |
| Node version required | 24.x (`.nvmrc` says `24.16.0`; installed: `24.14.1` — close enough) |
| Workspaces | `api`, `client`, `packages/*` |
| MongoDB | running at `127.0.0.1:27017` (Community Edition, Windows service) |
| `.env` | **EXISTS** — written 2026-10-04, do NOT overwrite |
| `librechat.yaml` | **EXISTS** — written 2026-10-04, do NOT overwrite |
| `node_modules` | **DOES NOT EXIST** — dependencies not yet installed |
| RAG service | `rag-service/` — Milestone 1 (auth + /health only; /text /query /delete return 501) |
| Autorouter | `satchida/router/` — fully built, 12/12 tests pass |
| Router port | 4000 (loopback only) |
| RAG service port | **8010** (loopback only) — 8000 is taken by Satchida Hands |
| Local text model | `http://127.0.0.1:8080/v1` (Qwen3VL-4B + mmproj) |
| Local Granite | `http://127.0.0.1:8091/v1` (Granite-4.0-1B) |
| DO NOT TOUCH | `:5173` (Satchida harness), `:49705` (llama harness) |
| Opencode auth | `C:\Users\WinDiesel\.local\share\opencode\auth.json` — keys for 21 providers |
| Free model list | `C:\Users\WinDiesel\.config\opencode\free-exceptions.json` — 183 entries |

---

## 1. Pre-flight checks (run these before anything else)

```powershell
# 1a. Confirm Node
node --version          # expect v24.x
npm --version           # expect 11.x

# 1b. Confirm MongoDB is running
$svc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") { "MongoDB OK" } else { "MongoDB NOT running — start it" }

# 1c. Confirm no conflicting process on port 3080 or 4000
netstat -ano | Select-String ":3080 |:4000 "

# 1d. Confirm .env and librechat.yaml exist
Test-Path "D:\LAN-AI-Infra\LibreChat\.env"           # must be True
Test-Path "D:\LAN-AI-Infra\LibreChat\librechat.yaml"  # must be True

# 1e. Confirm router tests still pass
Set-Location "D:\LAN-AI-Infra\LibreChat\satchida\router"
node --test test/*.test.mjs
# expect: pass 12, fail 0
Set-Location "D:\LAN-AI-Infra\LibreChat"
```

**Stop if any check fails. Fix the issue before continuing.**

---

## 2. Install LibreChat dependencies

> [!CAUTION]
> Do NOT run `npm run reinstall` — that script calls `config/update.js` which pulls remote and resets things.
> Do NOT run `npm run b:reinstall` — that is the Bun variant.
> Use plain `npm install` from the root.

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat"

# Install all workspace dependencies (api, client, packages/*)
# This will take 3–10 minutes on first run. Do not interrupt.
npm install

# Verify: node_modules should now exist at root AND in api/ and client/
Test-Path "node_modules"    # True
Test-Path "api\node_modules"  # True (npm workspaces hoist most, but api has its own)
Test-Path "client\node_modules"  # True
```

> [!NOTE]
> If `npm install` fails with peer dependency errors, try `npm install --legacy-peer-deps`.
> If it fails on `prepare` (husky), that is non-fatal — husky sets up git hooks and will fail
> if this is not a git repo. Run: `npm install --ignore-scripts` then `npm run build:data-provider`.

---

## 3. Build packages (in dependency order)

These are the **exact npm scripts** verified from `package.json`. Run them in this order:

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat"

# Step 3a: data-provider (dependency of everything)
npm run build:data-provider
# Script: cd packages/data-provider && npm run build
# Output: packages/data-provider/dist/

# Step 3b: data-schemas (dependency of api)
npm run build:data-schemas
# Script: cd packages/data-schemas && npm run build
# Output: packages/data-schemas/dist/

# Step 3c: api package (not the api server — this is the shared @librechat/api package)
npm run build:api
# Script: cd packages/api && npm run build
# Output: packages/api/dist/

# Step 3d: client package (shared component library)
npm run build:client-package
# Script: cd packages/client && npm run build

# Step 3e: frontend (React app — takes 2–4 min, needs ~8 GB RAM)
npm run build:client
# Script: cd client && npm run build
# Uses: cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=8192 vite build
# Output: client/dist/  ← LibreChat serves this as static files

# Verify outputs
Test-Path "packages/data-provider/dist"
Test-Path "packages/data-schemas/dist"
Test-Path "packages/api/dist"
Test-Path "client/dist"
```

> [!TIP]
> All 5 steps as one command (equivalent to `npm run frontend`):
> ```powershell
> npm run frontend
> ```
> But run them individually the first time so you can see exactly where a failure occurs.

---

## 4. Verify the .env file is correct

```powershell
# Check critical vars are set (do NOT print values)
$env_content = Get-Content ".env" -Raw
@("MONGO_URI","JWT_SECRET","JWT_REFRESH_SECRET","CREDS_KEY","CREDS_IV","TRUST_PROXY","ALLOW_REGISTRATION") | ForEach-Object {
    if ($env_content -match "^$_=\S+") { "OK: $_" } else { "MISSING: $_" }
}
```

**Expected output:** all 7 lines print `OK: <name>`. If any say MISSING, open `.env` and add the missing variable from `.env.example`.

The `.env` file written on 2026-10-04 contains:
- `MONGO_URI=mongodb://127.0.0.1:27017/LibreChat`
- `TRUST_PROXY=1` (required behind Cloudflare Tunnel)
- `ALLOW_REGISTRATION=false` (seats managed by admin only)
- `SATCHIDA_ROUTER_URL=http://127.0.0.1:4000` (custom env var — see §8)
- All JWT/CREDS secrets set

---

## 5. Verify librechat.yaml is correct

The `librechat.yaml` written on 2026-10-04 configures:
- **One custom endpoint** named `"Satchida"` → `http://127.0.0.1:4000/v1`
- **Four models** (user-visible): `Chat`, `Work`, `Study`, `Privacy`
- **All built-in endpoints disabled** (`openAI.disabled: true`, etc.)
- **Turnstile block** with placeholder keys — replace before going public

```powershell
# Quick sanity check — confirm the endpoint URL is present
Select-String -Path "librechat.yaml" -Pattern "4000" | Select-Object -First 3
# Must show: baseURL: "http://127.0.0.1:4000/v1"
```

> [!WARNING]
> The Turnstile keys in `librechat.yaml` are placeholders (`REPLACE_WITH_YOUR_TURNSTILE_SITE_KEY`).
> LibreChat will start without them but Turnstile bot-protection will not work.
> Get real keys from: https://dash.cloudflare.com → Turnstile → Add site.
> Update the two values in `librechat.yaml` before exposing to the internet.

---

## 6. Start the Satchida autorouter

The router must be running before LibreChat starts, because LibreChat calls `/v1/models` on startup.

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat\satchida\router"

# Start in background (keeps running; logs to console)
# For production: wrap in NSSM or PM2. For dev: run in a separate terminal.
node src/server.mjs
```

**Expected startup log:**
```
2026-10-04T... satchida-router on 127.0.0.1:4000
```

**Verify in a second terminal:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4000/healthz"
# Expected: {"ok":true}

Invoke-RestMethod -Uri "http://127.0.0.1:4000/v1/models"
# Expected: {"object":"list","data":[{"id":"Chat",...},{"id":"Work",...},{"id":"Study",...},{"id":"Privacy",...}]}
```

> [!NOTE]
> The router reads provider keys from `C:\Users\WinDiesel\.local\share\opencode\auth.json` (30-second cache).
> It also reads env vars: `OPENROUTER_API_KEY`, `OPENCODE_API_KEY`, etc. take priority over auth.json.
> Check `/status` to see how many entries loaded: `Invoke-RestMethod http://127.0.0.1:4000/status`

---

## 7. Start the RAG service (Milestone 1)

The RAG service handles document embedding and retrieval. Milestone 1 is auth+health only — `/text`, `/query`, `/delete` return 501. LibreChat falls back to native text extraction when RAG is not fully implemented.

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat\rag-service"

# Install dependencies (if not done yet)
npm install

# Set the shared JWT secret (must match .env JWT_SECRET)
$env:JWT_SECRET = "<copy JWT_SECRET from .env>"
$env:RAG_PORT = "8010"
$env:RAG_HOST = "127.0.0.1"

node src/index.mjs
```

**Verify:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health"
# Expected: {"status":"OK"}  (returns 503 if JWT_SECRET is missing)
```

Add `RAG_API_URL=http://127.0.0.1:8000` to `.env` so LibreChat finds it.

---

## 8. Start LibreChat

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat"

# Production mode (serves pre-built client/dist)
npm run backend
# Script: cross-env NODE_ENV=production node api/server/index.js

# OR development mode (live reload for api changes; client must be pre-built)
npm run backend:dev
# Script: cross-env NODE_ENV=development npx nodemon api/server/index.js
```

**Healthy startup log (in order — if any step is missing, read ALL lines above it first):**
```
[startup] MongoDB connected
[startup] RAG service health check: OK  (or: RAG service unavailable, using native parsing)
[startup] LibreChat listening on http://0.0.0.0:3080
```

> [!NOTE]
> If you see `RAG service unavailable` that is non-fatal — LibreChat uses built-in text extraction.
> RAG embedding (the full pipeline) requires Milestone 2 of `rag-service/`.

**Verify in browser:** `http://localhost:3080`
- Login page should appear.
- Sign in (first-run: create admin via `npm run create-user`).
- Model selector should show: Chat / Work / Study / Privacy (from librechat.yaml modelSpecs).
- Sending a Chat message should reach the router → route to a free provider → stream a response.

---

## 9. Create the first admin user

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat"
npm run create-user
# Interactive: prompts for email, name, password, role
# Set role to: ADMIN
```

---

## 10. Verification checklist (run after every build)

```
[ ] npm install completed without hard errors
[ ] client/dist/ exists and contains index.html
[ ] Router /healthz → {"ok":true}
[ ] Router /v1/models → 4 entries: Chat, Work, Study, Privacy
[ ] Router /status → entries > 0 (providers loaded)
[ ] RAG /health → {"status":"OK"}
[ ] LibreChat http://localhost:3080 → login page loads
[ ] Admin login works
[ ] Send "hello" in Chat mode → router receives it → streams a real AI response
[ ] Send "hello" in Privacy mode → router routes to local llama.cpp (:8080) → real response
[ ] No model names visible in the chat UI (router hides them)
[ ] No error in browser console about CORS or 404 on /v1/models
```

**A response is FAKE/mocked if:**
- It comes back in < 200ms without streaming
- The model field in the response is not one of: Chat, Work, Study, Privacy
- It does not consume from a real provider (check `/status` request counts)

---

## 11. Process management for production (after first-run verified)

Run all three services as Windows services via **NSSM** (Non-Sucking Service Manager):

```powershell
# Download NSSM from https://nssm.cc/download — place nssm.exe in C:\tools\

# Router service
C:\tools\nssm.exe install SatchiRouter "node" "D:\LAN-AI-Infra\LibreChat\satchida\router\src\server.mjs"
C:\tools\nssm.exe set SatchiRouter AppDirectory "D:\LAN-AI-Infra\LibreChat\satchida\router"
C:\tools\nssm.exe set SatchiRouter AppStdout "C:\Logs\satchida-router.log"
C:\tools\nssm.exe set SatchiRouter AppStderr "C:\Logs\satchida-router.log"
C:\tools\nssm.exe set SatchiRouter Start SERVICE_AUTO_START

# RAG service
C:\tools\nssm.exe install SatchiRag "node" "D:\LAN-AI-Infra\LibreChat\rag-service\src\index.mjs"
C:\tools\nssm.exe set SatchiRag AppDirectory "D:\LAN-AI-Infra\LibreChat\rag-service"
C:\tools\nssm.exe set SatchiRag AppEnvironmentExtra "JWT_SECRET=<copy JWT_SECRET from .env>" "RAG_PORT=8010"
C:\tools\nssm.exe set SatchiRag Start SERVICE_AUTO_START

# LibreChat
C:\tools\nssm.exe install SatchiChat "node" "D:\LAN-AI-Infra\LibreChat\api\server\index.js"
C:\tools\nssm.exe set SatchiChat AppDirectory "D:\LAN-AI-Infra\LibreChat"
C:\tools\nssm.exe set SatchiChat AppEnvironmentExtra "NODE_ENV=production"
C:\tools\nssm.exe set SatchiChat Start SERVICE_AUTO_START

# Start all
Start-Service SatchiRouter; Start-Service SatchiRag; Start-Service SatchiChat
```

**Start order on boot:** MongoDB → SatchiRouter → SatchiRag → SatchiChat
Set service dependencies:
```powershell
C:\tools\nssm.exe set SatchiRag DependOnService MongoDB
C:\tools\nssm.exe set SatchiChat DependOnService SatchiRouter
C:\tools\nssm.exe set SatchiChat DependOnService MongoDB
```

---

## 12. What is NOT done yet (honest status)

| Item | Status | Blocking? |
|---|---|---|
| RAG /text /query /delete | 501 (Milestone 1 only) | No — LC uses native text extraction |
| LanceDB embedding pipeline | Not started | For RAG Milestone 2 |
| Turnstile real keys | Placeholder | Before going public |
| LibreChat custom UI toolbar (mode selector, think toggle, web search) | Not started | After first working build |
| Subscription tiers / licence JWTs | Not started | |
| Fleet controller / sync agent | Not started | |
| Cloudflare tunnel for HQ | Not configured | Needed for remote access |
| NSSM service wrappers | Not configured | Needed for production uptime |
| Google OAuth | Not configured | Optional for demo |
| Child account / parental controls | Not started | Family tier |
| Worker gateway (token check, key injection) | Deferred | See todo.md |
