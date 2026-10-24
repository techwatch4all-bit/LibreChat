# TODO (deferred / outstanding work)
Last updated: 2026-10-04

---

## A. Deferred by decision

- [ ] **Cloudflare Worker gateway** — token check, provider-key injection (keys as Worker secrets), per-client monthly spend cap, kill switch, usage counters (KV/D1). See ARCHITECTURE.md §III (III.1, III.3, III.6: 100k req/day free limit).
- [ ] **Mid-turn recovery** (multi-bot) for dropped streams — INFERENCE.md §6.
- [ ] **openai-zdr provider** — enable in `satchida/router/registry.json` only after ZDR data-processing agreement approved. Currently `enabled: false`.

## D. PartXI: Master/Tenant Provisioning, Satchida Gateway Telemetry & Dead-Man Lease (Zero Mocks)

### Phase 1: Unblock Admin User Scoping (`/api/admin/users`)
- [x] In `packages/api/src/admin/users.ts` & `api/server/routes/admin/users.js`: wrap user listing & search in `runAsSystem()` for callers with `OPERATOR_CONTROL` or when `?scope=all` is supplied.
- [x] Verify operator query returns all database accounts (`total: 7+`).
- [x] Verify `admin/index.html` displays all accounts in the Users table.

### Phase 2: Production Provisioning Endpoints
- [x] Implement `POST /api/admin/users` (create individual seat: email, name, role, group, auto-generated secure temp password, `mustChangePassword: true`, balance record).
- [x] Implement `POST /api/admin/users/bulk` (CSV roster import with transactions, seat-cap validation, generated credential slips export).
- [x] Implement `GET /api/admin/users/csv-template` (downloadable sample CSV roster template).
- [x] Add audit log emissions for user and bulk seat provisioning.

### Phase 3: Admin Console UI Enhancements
- [x] Update `admin/index.html` and `admin/app.js` with "Create User" and "Bulk CSV Import" modal flows.
- [x] Add client-side and server-side capability gating: Tenant Admin power user is restricted to Unlock / Reset Password only; Master Operator has full seat provisioning.
- [x] Add instant download trigger for CSV credential slips upon bulk completion.

### Phase 4: First-Login Forced Password Reset & Challenge Modal
- [x] In client web app (`client/src/routes/Root.tsx`), intercept users with `mustChangePassword === true`.
- [x] Built non-dismissible `FirstLoginClaimModal.tsx` requesting new password + security challenge Q&A.
- [x] Implemented `POST /api/auth/first-login-claim` to save updated password hash, challenge credentials, and clear `mustChangePassword`.

### Phase 5: Upstream Satchida Gateway Telemetry Injection & Local Privacy Compute Gating
- [x] In `packages/api/src/endpoints/openai/config.ts`, inject `X-Tenant-Id`, `X-Satchida-Gateway-User-Id`, `X-Satchida-Gateway-Role` on requests to `:8700` / Satchida Gateway.
- [x] In `packages/api/src/middleware/checkBalance.ts`, metered `model === 'Privacy'` routes with configurable `privacyRateMultiplier`.
- [x] Enforced fail-closed `INSUFFICIENT_BALANCE` enforcement across both cloud Satchida Gateway and local Privacy GPU when quota hits 0.

### Phase 6: Cryptographic Dead-Man Lease & Anti-Clock-Tampering Engine
- [x] Implemented `packages/api/src/middleware/leaseGuard.ts` checking `satchida.lic` with Ed25519 signature.
- [x] Implemented monotonic timestamp check against MongoDB / system uptime to prevent Windows clock tampering.
- [x] Enforce fail-closed `HTTP 402` when node lease expires without valid signature.

### Phase 7: Integrated Web IDE (Option A - VS Code Server / Cline via Express Sub-Router)
- [x] Installed `http-proxy-middleware` in `@librechat/backend` (`api/package.json`).
- [x] Implemented reverse proxy route `api/server/routes/ide.js` at `/api/ide/*` pointing to `code-server` on `http://127.0.0.1:8085`.
- [x] Enforced `requireJwtAuth` to protect IDE access and injected `x-forwarded-user` header.
- [x] Mounted WebSocket protocol upgrading in `api/server/index.js` (`server.on('upgrade')`) for persistent PTY terminal and LSP sync.
- [x] Refactored `client/src/components/IDE/IdeView.tsx` to load via unified `/api/ide/` route without exposing separate ports.
- [x] Built client production bundle (`npm run build:client`) and verified live on PM2.


### Phase 8: One-API Gateway & Admin Control Panel Verification (Verified 2026-10-24)
- [x] Verified One-API Binary online on port 4000 (`satchida-gateway.exe`, PID 37312) returning `Chat`, `Study`, `Work`.
- [x] Fixed stale `SATCHIDA_GATEWAY_VK` token in `.env` mapped to active token in SQLite `one-api.db`.
- [x] Verified Satchida Smart Router online on port 4001 (`satchida-router`, PID 37144) returning `Chat`, `Work`, `Study`, `Privacy`.
- [x] Verified standalone vanilla-JS Admin Panel mounting at `http://localhost:3080/admin`.
- [x] Verified Operator authentication via `POST /api/admin/login/local` yielding valid JWT.
- [x] Verified Operator credentials and capability validation via `GET /api/admin/verify` (`isOperator: true`, `tenantId: 'satchida-master'`).
- [x] Verified User Account creation and querying via `POST /api/admin/users` and `GET /api/admin/users`.
- [x] Verified Group creation and querying via `POST /api/admin/groups` and `GET /api/admin/groups`.
- [x] Verified Role and Grant querying via `GET /api/admin/roles` and `GET /api/admin/grants`.

---

## B. Active / next session

### B0 — Central IAM Deployment (Casdoor on Windows Operator PC)
- [ ] Download and install `casdoor.exe` (Apache-2.0 native Windows binary) on Operator PC.
- [ ] Configure `conf/app.conf` to run on native SQLite file storage (`driverName = sqlite3`, `dataSourceName = casdoor.db`).
- [ ] Establish initial Tenant Organizations (`rwa-palm`, `school-delhi`, `corp-fintech`, `satchida-master`).
- [ ] Generate Application Client credentials and Virtual Keys for edge tenant machines.
- [ ] Map Casbin policy sync between Casdoor and local Sovereign RAG (`pycasbin`) / LibreChat.

### B1 — LibreChat install and config
- [ ] Write `D:\LAN-AI-Infra\LibreChat\.env` (see template in DEPLOYMENT.md).
      Key vars: `TRUST_PROXY=1`, `ALLOW_REGISTRATION=false`, `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDS_KEY`, `CREDS_IV`, `SESSION_EXPIRY`.
- [ ] Write `D:\LAN-AI-Infra\LibreChat\librechat.yaml` — custom endpoint pointing to `http://127.0.0.1:4000`. Model list: `Chat`, `Work`, `Study`, `Privacy`. Turnstile block.
- [ ] First-run test: `pnpm install; pnpm start` — confirm LibreChat reaches the router, router reaches a free provider.
- [ ] Per-client provisioning: populate a `.env.template` per client and automate with `provision-client-tunnel.ps1`.

### B2 — Router additions
- [ ] Read `token.modes` from Ed25519 licence JWT; gate Privacy endpoint if `token.plan < pro`.
- [ ] Read `token.isChild`; inject `CHILD_SAFETY_SUFFIX` system prompt, force-block adult-content providers, disable image gen.
- [ ] Read `token.limits.h5` / `token.limits.day` for per-user overrides.
- [ ] Multi-GPU routing: send Privacy requests to `:8091` (Granite), vision requests to `:8080` (Qwen3VL); expose as two local providers.
- [ ] `/v1/models` response should also return allowed features per token (`websearch`, `think`, `image`).
- [ ] Provider-key rotation support (one key per provider; no multi-account stacking).

### B3 — LibreChat UI toolbar (chat input)
Reference: `D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\components\app\chat\ChatForm\ChatFormActions\`

The suite already has working Svelte components for every button. Port logic + styling to LibreChat React.

**Left side (style):** Segmented control / tabs:
- Direct | Plan | Build
- Sends `satchida_style: "direct"|"plan"|"build"` in extraBody.

**Right side (mode):** Dropdown (model selector hidden; mode label only):
- Chat | Work | Study | Privacy (gated by subscription).
- Maps to LibreChat `model` field → `Chat` / `Work` / `Study` / `Privacy`.
- Router receives these as model ids and routes accordingly.

**Icon bar buttons (port from suite):**

| Button | Suite component | LibreChat extraBody field |
|---|---|---|
| 🌐 Globe | `ChatFormActionWebSearch.svelte` | `satchida_websearch: true/false` |
| 🧠 Think | `ChatFormActionThinkingToggle.svelte` | `satchida_think: "off"|"medium"|"high"` |
| ✨ Wand | `ChatFormActionPromptEnhancer.svelte` | Client-side enhance first; then send |
| 📷 Camera | `ChatFormActionVisionCamera.svelte` | Attach image; router auto-detects vision |
| 🔬 Research | `ChatFormActionDeepResearch.svelte` | `satchida_research: true` |
| 🎙️ Mic | `ChatFormActionMic.svelte` | STT → text; then send normally |
| 🖼️ Image | `ChatFormActionImageGen.svelte` | `satchida_imagegen: true` |

Implementation order (COMPLETED & VERIFIED):
1. [x] Mode dropdown + Style segmented control (`SatchiModeSelector.tsx`, `SatchiStyleSelector.tsx`).
2. [x] Globe (web search toggle) (`SatchiToolbar.tsx` with `satchiWebSearchAtom`).
3. [x] Think toggle (`SatchiToolbar.tsx` with `satchiThinkAtom`).
4. [x] Prompt enhancer with heuristic multi-domain expansion (`heuristicEnhance` in `satchiStore.ts`).
5. [x] Deep research & image gen toggles (`satchiResearchAtom`, `satchiImageGenAtom`).
6. [x] Unit test suite (`SatchiToolbar.spec.tsx` - 11/11 passing).
7. [x] Full client production build (`npm run build:client` - clean build).

Files created/edited in LibreChat:
- [x] `client/src/components/Chat/Input/SatchiModeSelector.tsx` — mode segmented control (Chat / Work / Study / Privacy)
- [x] `client/src/components/Chat/Input/SatchiStyleSelector.tsx` — Direct / Plan / Build segmented control
- [x] `client/src/components/Chat/Input/SatchiToolbar.tsx` — Globe, Think, Wand, Research, Image buttons with tooltips & toasts
- [x] `client/src/store/satchiStore.ts` — Jotai storage atoms + domain prompt enhancer
- [x] `client/src/hooks/useSatchiExtraBody.ts` — hook providing extraBody & style directives
- [x] `client/src/components/Chat/Input/ChatForm.tsx` — mounted controls & wired style prompt prefixes
- [x] `client/src/components/Chat/Input/__tests__/SatchiToolbar.spec.tsx` — unit tests

### B4 — Subscription tiers and licensing
- [ ] Licence JWT shape defined in `docs/SATCHIDA-UI-SUBSCRIPTIONS-HARDWARE.md` §2.2.
- [ ] Add licence signing to `satchida/shared/crypto.mjs` — `signLicence(payload, privateKey)`, `verifyLicence(jwt, publicKey)`.
- [ ] Fleet controller issues licence JWTs on client provisioning.
- [ ] Router verifies licence on every request (Ed25519 via Web Crypto; no external call).
- [ ] Child account system prompt suffix constant in `satchida/router/src/select.mjs`.
- [ ] DPDP children consent flow (India). Need a consent timestamp + parent account id stored in MongoDB.

### B5 — Fleet controller + sync agent
- [ ] `satchida/fleet-controller/` — provisions clients, signs licences, tracks spend.
- [ ] `satchida/sync-agent/` — pushes registry updates to edge nodes, monitors node health.

### B6 — Registry cleanup
- [ ] Fill base URLs: experiential-labs (explabs), tokenharbor, opencode-go (need subscription docs).
- [ ] Confirm Space Bunny Alpha provider ids once a `/models` listing is available. Regex `space.?bunny` already set.
- [ ] Add `novita`, `deep-infra`, `nous-portal`, `modal-glm`, `hetzner` explicitly if not already in registry.
- [ ] Study routing: confirm which free providers allow education/tutor use (re: TOS).

### B7 — Docs cleanup
- [ ] INFERENCE.md lines 265–272: still says "VPN deployment" — change to "Cloudflare Tunnel".
- [ ] PRIVACY.md: audit for remaining VPN wording.
- [ ] SERVICES.md: audit for remaining VPN wording.
- [ ] Add `docs/SATCHIDA-PRICING.md` with per-tier INR prices, per-seat enterprise formula.
- [ ] DPDP-CHILDREN.md — legal compliance document for Family tier child accounts.

### B8 — Hardware (when ready to expand)
- [ ] If adding second GPU: configure two llama-server instances with `CUDA_VISIBLE_DEVICES=0` and `=1`.
- [ ] Update registry `local-text` → `:8080` (Qwen3VL, GPU 1) and `local-privacy` → `:8091` (Granite, GPU 0 or GPU 1 depending on card assignment).
- [ ] Add `local-imagegen` entry in registry once image gen server is running.
- [ ] Update `localGate` in registry for each GPU independently (e.g. max 8 text slots, max 1 image gen, max 12 granite slots).

---

## C. Monitoring / operational
- [ ] Router `/status` endpoint — wire to a simple status page on `control.satchida.com`.
- [ ] Spend tracking: router logs per-provider token counts to a rolling JSON file. Fleet controller reads these for billing.
- [ ] Alert when a provider has been in circuit-breaker state for > 30 min.
- [ ] Daily summary report: free quota used, paid fallback count, top users by volume.

---

## C. Open work as of 2026-10-05 (verified this session)

Verified with a real browser session, not inferred.

### C0 — BLOCKING: chat is broken (RESOLVED & VERIFIED)
- [x] **`:4000` does not understand Satchida mode labels.**
      Implemented in `fleet/src/gateway.mjs` via `translateModel` calling `resolveModel()` from `fleet/src/models.mjs`.
      Mode labels `Chat`, `Work`, `Study`, `Privacy` are mapped against the catalogue read from `:8080`.
      Verified live: chat completion with `{ model: 'Chat' }` correctly translates to `Qwen2.5-Omni-7B-Q4_K_M` and returns HTTP 200 with model response.
- [x] **Port conflict.** Resolved: `satchida/router/src/server.mjs` explicitly sets `PORT = Number(process.env.ROUTER_PORT || 4001)` and points `:4000` exclusively to `fleet/src/gateway.mjs` (the enforcement point).


### C1 — LibreChat file upload returns 500 (RESOLVED & VERIFIED)
- [x] Fixed validation errors (missing `file_id`, `agent_id`, empty file) returning 400 with user-facing messages.
- [x] Added `USER_FACING_UPLOAD_ERRORS` patterns in `packages/api/src/utils/files.ts`.
- [x] Updated `api/server/routes/files/files.js` and `api/server/services/Files/process.js` to log sanitized errors and return 400.
- [x] Tested with `packages/api/src/utils/files.spec.ts` (78/78 passing).

### C2 — Tenant extension policy (per-tenant enable/disable)
- [x] Policy module `packages/data-provider/src/tenant-policy.ts` + 18/18 tests pass.
- [x] **WIRED in read paths:**
      - Skills read/list: wired in `packages/api/src/skills/handlers.ts` and `api/server/services/Skills/handlers.js` using `loadTenantPolicy` & `applyTenantPolicy`.
      - Agents read/list: wired in `packages/api/src/agents/reads.ts` using `getTenantPolicy` projection.
      - MCP servers read/list: wired in `api/server/controllers/mcp.js` (`getMCPServersList` & `getMCPTools`) using `filterExtensions(policy, 'mcp', ...)`.


### C3 — Operator admin API + UI
- [ ] Per-tenant extension enable/disable endpoints + screen.
- [ ] `:8443` control plane + multi-tenant dashboard (still not built; the SPA at
      `fleet/src/dashboard/` is a fragment — `index.html` loads a `main.tsx` that does
      not exist, so it cannot build).

### C4 — RAG lifecycle and management
- [ ] Per-user and per-tenant quotas; disk ceiling with oldest-first eviction.
      163 Acts ≈ 11k chunks ≈ 100–150 MB — small, but an RWA node needs a bound.
- [ ] Operator-only bulk ingest path (see C5).
- [ ] Hybrid keyword+vector fallback. Measured: every local embedding model scores only
      1/4–2/4 on paraphrased queries. Pure vector search will miss reworded questions.

### C5 — Acts corpus as a product
- [ ] Bulk-ingest all 163 Bare Acts under the operator admin identity.
- [ ] Tenant scoping so an RWA sees the public Acts corpus but cannot delete/re-ingest it.
      Every chunk row already carries `user_id`; `tenantId` scoping is still required.

### C6 — Bundling and offline hardening
- [ ] Bundle `all-minilm:l6-v2` (23 MB) with auto-pull for client nodes that lack it.
- [ ] Optional webfetch/websearch ingest toggle — OFF by default (sovereign default).
- [ ] Vision/audio over documents: Omni `:8080` reads the diagram, MiniLM embeds the
      reading. No text embedding model can analyse pixels; this is the only local route.

### C7 — School ingestion pipeline (ARCHITECTURE.md Part VII)
- [ ] **S1** Docling + granite-docling-258M — layout, reading order, figure regions
- [ ] **S2** PaddleOCR — OCR, layout, tables (Windows-native, CPU-capable)
- [ ] **S3** PP-FormulaNet_plus-S — math to LaTeX, inline with surrounding text
- [ ] **S4** Pix2Text (`yggdrasil`) — formula fallback; VERIFY weight licence in writing first
- [ ] **S5** DePlot — chart figure to data table
- [ ] **S6** Select a CLIP/SigLIP-class model for the figure image index (not yet chosen)
- [ ] **S7** Qwen2.5-Omni on :8080 — VL fallback for pages OCR cannot read
- [ ] Async resumable ingest: per-page checkpoints, progress UI, cancellation
- [ ] BLOCKED/licence: do NOT adopt marker or surya (weights capped at $5M revenue),
      nougat (CC-BY-NC weights), MinerU (auto-termination above $20M/month), olmOCR (WSL-only)

### C8 — Educational corpus (age/grade x subject, board-agnostic)
- [ ] Licence-filtered harvest: OpenStax (CC-BY), Wikibooks/Wikipedia (CC-BY-SA),
      Project Gutenberg (public domain), Pressbooks (CC-BY), OER Commons (filter PER ITEM)
- [ ] EXCLUDE MIT OpenCourseWare and LibreTexts — CC BY-NC-SA, non-commercial
- [ ] Verify India sources individually (NCERT, state boards, e-Pathshala, NIOS) — assume NOT open
- [ ] Grade-band taxonomy: pre-primary to undergraduate across maths, physics, chemistry,
      biology, zoology, CS/IT, statistics, accounting (CA), medicine, mechanical, farming,
      english, hindi, geography, history, economics
- [ ] Formulas indexed as first-class objects, separate from prose
- [ ] Provenance + licence stored on every chunk so a withdrawn source stays identifiable

### C9 — Web search / fetch toggle (off / local / global)
- [ ] Three states. GLOBAL discloses the USER'S QUERY to a third party — surface that in the UI
- [ ] GLOBAL: Tavily or Exa (MIT, remote MCP); keyword search: Brave (MIT)
- [ ] LOCAL: node-local fetch/search service. SearXNG is AGPL-3.0 — separate unmodified
      service only, never linked. MIT metadata-only fetcher for the common case
- [ ] Firecrawl: SaaS API ONLY — self-hosted backend is AGPL-3.0
- [ ] Gate via tenant-policy.ts: operator sets the tenant ceiling (school tenants default
      OFF or LOCAL); a user may narrow but never exceed it

### C8a — Educational corpus harvester (BUILT and VERIFIED)
- [x] `scripts/ingest-educational-corpus.mjs` — MediaWiki API, grade/subject taxonomy,
      licence guard that rejects NC sources by design, provenance in every document body
- [x] Verified: 6/6 Wikipedia calculus articles ingested, 533 chunks, retrieval correct
- [ ] OpenStax via `--from-file` operator-supplied URLs (no public bulk API exists — verified)
- [ ] Gutenberg and Pressbooks connectors (both commercially clean; Gutenberg PD is
      territorial, so filter per work for India life+60)
- [ ] Grade-band filtering at RETRIEVAL time, not just harvest order
- [ ] Formula-as-first-class-object index (needs S3)
