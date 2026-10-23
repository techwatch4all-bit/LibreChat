# Implementation Plan — Satchida AI Harness

Derived from `ARCHITECTURE.md`. Phases are ordered so each one leaves the deployment in a
working, demonstrable state. **Nothing in Phase 1 or 2 requires new business logic that
LibreChat does not already support.**

Branch policy per upstream `AGENTS.md`: branch from `dev`, target `dev`. This fork is not yet
a git remote — see Phase 0.

---

## Phase 0 — Workspace preparation

Establish the fork and a runnable baseline before writing product code.

- [ ] **Confirm the direct provider accounts** — our own API keys with OpenAI, Anthropic, and/or
      Google under standard commercial terms, which already permit powering products for our own
      end users (Anthropic §A.1). No reseller agreement is required. Verify each provider's
      retention terms and record them in `INFERENCE.md` §2.
- [ ] **Apply for OpenAI Zero Data Retention** — approval-gated, not self-serve, and it gates
      Privacy (Cloud). Can run in parallel.
- [ ] **Open non-revenue provider accounts** — OpenRouter (keep ≥ $10 in it to hold the
      1,000/day free tier), TokenHarbor, OpenCode Zen. Confine to Demo, recovery, and internal
      use; aggregator terms bar using them for a competing service.
- [ ] **Never stack multiple accounts on one provider** to multiply a free quota. One personal
      key per provider is ordinary use.
- [ ] Install dependencies: `npm install` from the repo root.
- [ ] Copy `.env.example` to `.env`.
- [ ] Start MongoDB, Meilisearch, pgvector (compose provides all three).
- [ ] Add Redis — required for resumable streams, background agents, and the autorouter's
      quota/circuit state.
- [ ] `npm run build:data-provider` from the root, then build the workspace under change.
- [ ] Confirm the stock chat UI loads and a test conversation completes.
- [ ] Create the fork remote and a `satchida/` branch off `dev`.
- [ ] Write `scripts/backup-satchida-librechat.ps1` per `UPSTREAM-UPDATE-PROCEDURE.md` §3.

Exit criteria: a stock LibreChat runs locally with a working chat turn, **and** at least one
direct provider contract is in progress.

---

## Phase 1 — Configuration foundation (no code)

Everything here is configuration, verified against `ARCHITECTURE.md` §2.

- [ ] **Google OAuth.** Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`; register
      the callback URL for the deployment host. Confirm `googleId` is written on first login
      and that `packages/api/src/auth/googleRefresh.ts` refreshes the token.
- [ ] **Enable the credit engine.** In `librechat.yaml` set `balance.enabled: true`. Note that
      this forces `transactions.enabled: true` (`packages/api/src/app/config.ts` warns).
- [ ] **Verify quota enforcement** with `packages/api/src/middleware/checkBalance.ts`: a user
      at zero credits must be refused a turn.
- [ ] **Define the base roles** for Demo / Standard / Pro / Family / Enterprise using
      `PermissionTypes` from `packages/data-provider/src/permissions.ts`.
- [ ] **Remove `admin-panel`** from `docker-compose.yml` and `deploy-compose.yml` per the AGPL
      decision (`ARCHITECTURE.md` §3), including the `ADMIN_PANEL_*` variables.
- [ ] **Remove the stale lockfile references** to `static-browser-server`.

Exit criteria: Google sign-in works; a demo-tier user is capped at a small daily quota;
no AGPL component is deployed.

---

## Phase 2 — Plans, subscriptions, and payments (core build)

The only phase that is genuinely new backend work.

### 2a. Schemas — `packages/data-schemas`

- [ ] `schema/plan.ts` — tier key, display name, price, currency, seat limit, token
      allowance, refill interval, active flag.
- [ ] `schema/subscription.ts` — user, tenant, plan ref, status
      (`pending_payment | active | expired | revoked`), started/expires, seat count.
- [ ] `schema/payment.ts` — plan selection, amount, UPI reference, submitted timestamp,
      status, approving operator, approval timestamp.
- [ ] Type exports and query methods. Per `AGENTS.md`, keep Mongoose types out of exported
      signatures in `packages/api`, `packages/data-provider`, and `client`.
- [ ] Indexes on `user`, `tenantId`, `status`, and `expires`.

### 2b. Assignment service — `packages/api/src/billing`

- [ ] Idempotent subscription→(role, balance) application. Re-running must not double-apply.
- [ ] Demo tier: `refillAmount` of a few hundred credits, `refillIntervalValue: 1`,
      `refillIntervalUnit: days`.
- [ ] Seat enforcement for Family at invite time.
- [ ] Expiry sweep that downgrades on lapse rather than leaving an active role behind.

### 2c. Payment provider interface

- [ ] `PaymentProvider` interface: create intent, record attempt, confirm, reject, reconcile.
- [ ] `ManualUpiProvider` — intent returns the owner's static UPI QR; user submits a UPI
      reference; status stays `pending_payment` until an operator approves.
- [ ] `RazorpayUpiProvider` — implemented but inactive behind a `configSchema` toggle, since
      no Razorpay account exists yet (`ARCHITECTURE.md` §5.2).
- [ ] Typed discriminated results per `AGENTS.md`; stable machine-readable codes for
      `no_such_plan`, `subscription_exists`, `payment_not_found`, `seat_limit_reached`.
- [ ] No raw exception text, stack, or provider payload may reach a user-visible status.

### 2d. Operator reconciliation console

- [ ] `packages/api/src/admin/reconciliation.ts` — list accounts with registration date, last
      authentication, selected plan, payment status, UPI reference, amount, submitted
      timestamp, approving operator, approval timestamp.
- [ ] Filter by status and plan; CSV export for bank-statement reconciliation.
- [ ] Approve / reject actions, each recorded with the acting operator.
- [ ] Client UI under `client/src/components/Admin/console/`.
- [ ] This page is required **regardless** of gateway — it survives the Razorpay switch.

### 2e. Purchase and account-activation UX

- [ ] Authenticated user sees plans, picks one, scans the QR, submits the reference.
- [ ] Unpaid account lands on a clearly-labelled pending state, not a broken chat screen.
- [ ] Approval flips the subscription to `active` and the user's role and quota change on
      next request without a re-login.
- [ ] All new copy via `useLocalize()`, English keys only in
      `client/src/locales/en/translation.json`.

### 2f. Tests

- [ ] Absence vs. failure for every repository method — a missing record and a database
      failure must be distinguishable.
- [ ] The boundary's non-success response shape.
- [ ] Sensitive diagnostics cannot reach a user-visible surface.
- [ ] Assignment idempotency; demo-tier refill boundary.

Exit criteria: a new user registers with Google, buys Standard via UPI, an operator approves,
and their quota and features update correctly.

---

## Phase 3 — Tier-gated integrations

- [ ] **Code interpreter.** Add a `code-interpreter` service to compose (Apache-2.0), wire
      `CODE_API_KEY`, and gate it behind the `RUN_CODE` permission so it is Pro and above.
      Confirm the `DELETE /files/:session_id/:fileId` route the client depends on
      (`api/server/services/Files/Code/crud.js`).
- [ ] **rag-api.** Already in compose. Enable only where a RAG provider is configured; gate
      file search behind Pro and above.
- [ ] **QuickBooks MCP.** Register `quickbooks-online-mcp` as an admin-level MCP server,
      gated to Enterprise. Disclose to customers that it executes on Cloudflare, outside the
      Cloudflare Tunnel boundary.

Exit criteria: Pro can run code; Standard cannot; Enterprise sees QuickBooks.

---

## Phase 4 — Android delivery

### 4a. PWA (first)

- [ ] Web app manifest with Satchida name, theme colour, and an Android icon set.
- [ ] Service worker with an update strategy that never strands a client on a stale shell.
- [ ] Verify installability on Android phone and tablet over HTTPS via the tunnel.

### 4b. Capacitor wrapper (same phase)

- [ ] Wrap the existing React client — one codebase, no parallel native implementation.
- [ ] Configure app id, name, icons, and the <client>.satchida.com URL as the server URL.
- [ ] Produce a distributable APK/AAB; enable push notifications and native file access.
- [ ] Confirm Google OAuth works inside the native shell (custom tab / intent filter).

Exit criteria: installable and installable-as-APK from the same client, authenticating and
streaming correctly on a real device.

---

## Phase 5 — Satchida rebrand

**Blocked on assets.** The Satchida logo and brand image were not available at authoring time.

- [ ] Obtain logo.svg, favicon set, app icons, and brand colour tokens.
- [ ] Replace `client/public/assets/` assets.
- [ ] Update the PWA manifest and Capacitor icons.
- [ ] Update `package.json` name and description; compose `container_name` values.
- [ ] Swap theme tokens rather than hard-coded colors, per `AGENTS.md`.
- [ ] Update seed copy in `client/src/locales/en/translation.json`.
- [ ] Verify light and dark themes, and reduced-motion behavior.

Exit criteria: no LibreChat branding remains visible in any user-facing surface.

---

## Phase 6 — Gateway activation (deferred, credential-gated)

- [ ] Obtain the Razorpay account and credentials.
- [ ] Supply `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and the webhook secret.
- [ ] Flip the `configSchema` toggle; verify webhook signature validation and idempotent
      replay handling.
- [ ] Confirm the reconciliation console consumes gateway confirmations unchanged.

Exit criteria: payment auto-activates a subscription with no operator action.

---

## Phase 7 — Multi-tenant isolation (shared deployment)

- [ ] Confirm `tenantId` is set on every request path and cannot be client-supplied.
- [ ] Scope all new queries by tenant; test cross-tenant reads return nothing.
- [ ] Per-tenant rate limits and quota isolation.
- [ ] Redis key namespacing per tenant.
- [ ] Audit log retention and export per tenant.

Exit criteria: a tenant cannot observe another tenant's users, conversations, or usage.

---

## Phase 8 — Attached code environments (evaluation)

- [ ] Evaluate the `librechat-code` worker model described in `CONTEXT.md` against the
      standalone Code API from Phase 3.
- [ ] Decide whether Enterprise customers run their own workers.
- [ ] No code unless the evaluation justifies it.

---

## Verification discipline

From upstream `AGENTS.md`, applied to every phase:

- Focused Jest tests from the owning workspace — not the whole monorepo.
- `npx tsc --noEmit` in every workspace changed. A green build is not a typecheck:
  `packages/api`, `packages/client`, and `packages/data-schemas` build with `tsdown`, which
  emits without checking types.
- `npm run sort-imports` scoped to the paths touched.
- `npm run static-checks -- --against origin/dev` to reproduce PR static checks.
- `npm run lighthouse` before completion for startup, auth, config, file, or
  message-loading changes.
- Frontend work uses colocated `__tests__` and `test/layout-test-utils`.

## Open items requiring a decision

1. **Satchida brand assets** — needed to start Phase 5.
2. **Tier prices and quotas** — the numbers behind Standard / Pro / Family / Enterprise.
3. **Family seat count** — how many seats the pooled tier includes.
4. **Razorpay account** — timeline for Phase 6.
5. **LLM provider and key strategy** — which providers the harness fronts, and whether keys are
   operator-held (the model implied by the balance/quota design) or user-supplied BYOK.

---

<!-- SATCHIDA-DISTRIBUTED-PLAN-V2 — 2026-10-04 -->
## Part II — Satchida Distributed Platform — Phased Delivery Plan

> Read `LIBRECHAT-BUILD.md` before executing any phase.
> Every command in that file is verified from the actual repository.
> Nothing in this plan should be built as mock/fake/hardcoded.
> If a feature is not ready, it returns an honest error (4xx/5xx), not a simulated response.

---

### Strategic decisions required before first client signs

#### Decision 1 — Phone-only user access (largest adoption risk)

Most users in target markets (schools, SMBs, housing societies) are **phone-only**.
A thick client install is real friction. Choose one:

| Option | Friction | Verdict |
|---|---|---|
| **A. Browser-only PWA (recommended first)** | Zero. User opens `<client>.satchida.com` in Chrome → "Add to Home Screen" | **Ship this. It works today.** |
| **B. Capacitor APK** | Low. Distribute APK link via WhatsApp. Installs in 30 seconds. | Ship after browser path verified. Phase 4b. |
| **C. VPN bundled app** | High. User manages VPN credentials, troubleshoots CGNAT, calls you when it breaks. | Rejected permanently. |

The Cloudflare Tunnel already provides browser access. **No VPN, no thick client, no friction.**

#### Decision 2 — RAG Milestone 3 vs Control Service — what ships next

RAG Milestone 3 fixes PDF-deletion orphan vectors (LanceDB).
The Control Service enables remote management of all nodes.

**Ship control service first.** Without it, every node problem requires manual operator
access. With it, revoke licences, push config, and see all nodes from one URL.
RAG only benefits users who upload documents. Control service benefits operations every day.

Priority order:
1. Phase 0 (working LibreChat — **RIGHT NOW**)
2. Phase 1 (control service)
3. Phase 2 (subscriptions + licence enforcement)
4. Phase 3 (RAG Milestone 2+3)
5. Phase 4 (UI toolbar + PWA/Capacitor)
6. Phase 5 (fleet provisioning automation)

---

## Phase 0 — Verified baseline: real working LibreChat on HQ
**Time estimate:** 2–4 hours. **Status: IN PROGRESS.**

Exact steps are in `LIBRECHAT-BUILD.md` §1–§10. Follow them in order.

Exit criteria (all must be true — no exceptions):
- [ ] `npm install` completes (may take 5–10 min on first run)
- [ ] `npm run frontend` completes; `client/dist/index.html` exists
- [ ] Router `/healthz` → `{"ok":true}`
- [ ] Router `/v1/models` → 4 entries: Chat, Work, Study, Privacy
- [ ] RAG `/health` → `{"status":"OK"}`
- [ ] `http://localhost:3080` → login page loads (no 500 errors)
- [ ] Admin user created via `npm run create-user`
- [ ] Sending "hello" in Chat mode → real streamed AI response (not fake, not hardcoded)
- [ ] Privacy mode → routes to `http://127.0.0.1:8080/v1` (local llama.cpp)
- [ ] Model names invisible in UI (router rewrites them to mode labels)
- [ ] All NSSM services start on boot in correct order: MongoDB → SatchiRouter → SatchiRag → SatchiChat

---

## Phase 1 — Fleet Control Service (HQ, port 8443)
**Goal:** one operator URL to manage all nodes. Issues licences. Revokes access remotely.

### 1a. Storage (Node 24 built-in SQLite — no extra dependency)
```sql
-- tenants
CREATE TABLE tenants (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT NOT NULL,   -- SHA-256 of the shared secret
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic', -- basic|pro|family|enterprise
  allowed_seats INT NOT NULL DEFAULT 5,
  active_seats INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active|suspended|revoked
  last_heartbeat INT                  -- Unix ms
);

-- heartbeat log (rolling 7-day window)
CREATE TABLE heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  ts INT NOT NULL,
  active_seats INT,
  token_usage_delta INT,
  router_version TEXT
);

-- licence events (audit trail)
CREATE TABLE licence_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  user_id TEXT,
  event TEXT NOT NULL,   -- issued|revoked|upgraded|downgraded
  payload TEXT,          -- JSON
  operator TEXT,
  ts INT NOT NULL
);
```

### 1b. HTTP API routes
| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/fleet/heartbeat` | HMAC-SHA256 of `{client_id, ts, body}` | Node checks in; gets back plan + seat limit + any pending commands |
| POST | `/fleet/issue-licence` | Operator JWT | Signs Ed25519 licence JWT for a user |
| POST | `/fleet/revoke` | Operator JWT | Sets tenant status = revoked; next heartbeat returns 403 |
| GET | `/fleet/status` | Operator JWT | Lists all tenants with last_heartbeat, plan, seats |
| POST | `/admin/login` | Username + bcrypt password | Returns 4h operator JWT |

### 1c. Heartbeat response shape
```json
{
  "ok": true,
  "plan": "pro",
  "allowed_seats": 50,
  "commands": []
}
```
On revoked: HTTP 403 `{"ok":false,"reason":"revoked"}` — sync-agent sets node to locked mode.

### 1d. Sync agent (runs on each client node, `satchida/sync-agent/agent.mjs`)
- Polls `/fleet/heartbeat` every 30s
- Signs request: `HMAC-SHA256(client_secret, JSON.stringify({client_id, ts, active_seats, token_usage_delta}))`
- On success: writes `node_state.json` → router reads this for seat enforcement
- On 403: writes `locked: true` to `node_state.json` → router returns 402 to all users

### 1e. Cloudflare tunnel
```powershell
# Bind control.satchida.com → http://127.0.0.1:8443
# Use scripts/provision-client-tunnel.ps1 with -Subdomain control -LocalPort 8443
```
Protect with Cloudflare Access: email allowlist of operators only.

Exit criteria:
- [ ] `POST /fleet/heartbeat` from test node returns correct plan and seat limit
- [ ] Revoking a tenant → its next heartbeat returns 403
- [ ] `GET /fleet/status` lists all tenants with timestamps
- [ ] Sync-agent NSSM service survives 30 minutes without crash
- [ ] Locked node: LibreChat returns "Account suspended" to users, not a generic error

---

## Phase 2 — Subscription tiers and licence enforcement
**Goal:** router enforces plan gates. Privacy requires Pro+. Child accounts filter content.

### 2a. Licence JWT (Ed25519, signed by fleet-controller)
```json
{
  "clientId": "acme-school",
  "userId": "u-abc123",
  "plan": "pro",
  "isChild": false,
  "modes": ["chat","work","study","privacy"],
  "features": ["websearch","think"],
  "limits": { "h5": 80, "day": 300 },
  "iat": 1780000000,
  "exp": 1780028800
}
```

Plan → modes mapping:
| Plan | Modes | Notes |
|---|---|---|
| `basic` | `["chat"]` | Free tier |
| `pro` | `["chat","work","study","privacy"]` | ₹499/mo |
| `family` | `["chat","work","study","privacy"]` | ₹799/mo, 4 seats, 2 may be child |
| `enterprise` | all | Seat-based pricing |

### 2b. Router licence enforcement (add to `satchida/router/src/server.mjs`)
- Parse `X-Satchida-Licence` header (Ed25519 JWT)
- Verify with HQ public key (hardcoded bytes — NOT fetched at runtime)
- Gate: `if mode === 'privacy' && !token.modes.includes('privacy')` → 403 + upgrade message
- Child accounts: inject `CHILD_SAFETY_SUFFIX` system prompt; skip adult-content providers
- Use `token.limits` to override `SlidingLimiter` per-user rules

### 2c. Manual UPI payment flow (no Razorpay until Phase 6)
- User selects plan → sees static UPI QR (owner's bank account)
- Submits UPI transaction reference via form in LibreChat settings
- Fleet-controller sets subscription to `pending_payment`
- Operator approves via admin UI → fleet-controller signs new licence JWT
- **Never auto-approve in production.** Human approval is required.

### 2d. Child account DPDP compliance
- Verifiable parental consent before account activation (DPDP Act 2023, §9)
- Store: `{ parent_user_id, consent_ts, method: "in-app-checkbox" }` in MongoDB
- System prompt suffix for child: hardcoded constant in `satchida/router/src/select.mjs`
- See `DPDP-CHILDREN.md` for legal detail

Exit criteria:
- [ ] Basic plan user: Privacy mode → 403 with "Upgrade to Pro to unlock Privacy mode"
- [ ] Pro user: all 4 modes work end-to-end
- [ ] Child account: "Write me adult fiction" → refusal, no content leaked
- [ ] Child account: image gen icon hidden or returns 403
- [ ] Payment → pending → operator approves → user's next request uses new plan (no re-login needed)

---

## Phase 3 — RAG Milestone 2 + 3 (real document retrieval)
**Goal:** uploaded documents are actually indexed and retrieved. No 501s.
**Prerequisite:** Phase 0 complete (LibreChat running). Phases 1 and 2 can run in parallel with this.

### 3a. Milestone 2 — Text extraction wired to routes (rag-service/)
Current state: `src/extract.mjs` has `extractPdf()` (pdfjs-dist); `extractDocx()` pending.

- Wire `POST /text` route to:
  1. Parse multipart form (busboy already in dependencies)
  2. Detect MIME: `application/pdf` → `extractPdf()`, `application/vnd.openxmlformats...` → `extractDocx()`
  3. Store `{ file_id, user_id, text, pages, page_count, kind, ts }` in MongoDB `rag_documents`
  4. Return `{ text: <full extracted text string> }`
- Wire `DELETE /documents` route to:
  1. Delete MongoDB docs where `file_id` in list
  2. Return 200 (or 404 if none found)
- This unblocks LibreChat native text search (LibreChat stores the returned text itself)

### 3b. Milestone 3 — LanceDB hybrid retrieval (fixes PDF-deletion flaw)
**The deletion flaw:** Python rag-api stores vectors in Chroma/pgvector. When `/documents` is called, the file metadata is deleted but vectors may be orphaned. LanceDB stores vectors in flat files in `rag-service/lancedb/` — delete is atomic.

Pipeline:
1. `/text`: after extraction, chunk into 512-token windows (64-token overlap)
2. Embed with `@xenova/transformers` BGE-M3 (`BAAI/bge-m3`) — runs in-process, no Python
   - First run downloads model (~600 MB) to `rag-service/.cache/`; subsequent runs use cache
3. Store in LanceDB: table `chunks`, columns: `file_id TEXT, chunk_index INT, page INT, text TEXT, embedding FLOAT[1024]`
4. Also insert into SQLite FTS5 (`rag-service/fts.db`) for BM25 sparse retrieval
5. `/query`: BM25 search + LanceDB ANN search → Reciprocal Rank Fusion → return top-5
6. `DELETE /documents`: remove from LanceDB + SQLite FTS5 + MongoDB — all in one operation

Response shape for `/query` (must match LibreChat exactly):
```json
[
  [{"page_content": "...", "metadata": {"source": "file_id", "page": 3}}, 0.92],
  ...
]
```

Exit criteria:
- [ ] Upload a 10-page PDF → `/text` returns extracted text within 300s timeout
- [ ] `/query` with a relevant question → returns ≥1 chunk with page number
- [ ] Delete the file → `/query` returns empty array (no orphan vectors)
- [ ] LibreChat conversation cites page numbers in RAG-enabled responses
- [ ] BGE-M3 model is cached; second restart does NOT re-download

---

## Phase 4 — Chat UI toolbar and PWA mobile delivery
**Goal:** functional mode selector, think toggle, web search toggle. Phone-friendly PWA.

### 4a. Toolbar (LibreChat React — `client/src/components/Chat/Input/`)
Build in this order. Each must be functionally real before the next:

**1. Mode selector** (`SatchiModeSelector.tsx`)
- Replaces LibreChat's model dropdown
- Shows: Chat | Work | Study | Privacy (Privacy disabled with tooltip if plan < pro)
- Sets LibreChat `model` field to the selected mode label
- Reads plan from session (licence JWT `token.modes`)

**2. Style tabs** (`SatchiStyleSelector.tsx`)
- Segmented tabs: Direct | Plan | Build (left of text input)
- Adds `satchida_style` field to LibreChat `extraBody`
- Router reads `satchida_style` and prepends the matching system prompt

**3. Think toggle** (`SatchiThinkToggle.tsx`)
- Brain icon; cycles: off → medium → high
- Adds `satchida_think: "medium"|"high"` to `extraBody`
- Router injects thinking params for capable providers; silently ignores for others

**4. Web search toggle** (`SatchiWebSearchToggle.tsx`)
- Globe icon; on/off
- Adds `satchida_websearch: true` to `extraBody`
- Router adds web-search system prompt when true
- Show "(Beta)" label until search fanout is fully wired

**5. Prompt enhancer** (`SatchiPromptEnhancer.tsx`)
- Wand icon; sends draft to Granite (`:8091`) for enhancement
- Shows enhanced text in a preview modal; user confirms or cancels
- Graceful fallback: if Granite is down, shows "Enhancer unavailable" toast

Each button:
- Has a real accessible tooltip (`title` attribute)
- Saves its state to `localStorage` so it persists across page reloads
- Is disabled (not hidden) when the plan does not include the feature

**Reference implementations** (port the logic, not the Svelte syntax):
- `D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\components\app\chat\ChatForm\ChatFormActions\ChatFormActionWebSearch.svelte`
- `D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\components\app\chat\ChatForm\ChatFormActions\ChatFormActionThinkingToggle.svelte`
- `D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\components\app\chat\ChatForm\ChatFormActions\ChatFormActionPromptEnhancer.svelte`

### 4b. Browser PWA (ship first — zero friction)
- `client/public/manifest.json`: name=Satchida, short_name=Satchida, theme_color=#<brand>, icons array
- Verify: Android Chrome shows "Add to Home Screen" on `<client>.satchida.com`
- Test on an actual Android device over Cloudflare Tunnel (not localhost)

### 4c. Capacitor APK (ship after browser path works)
- `capacitor.config.ts`: `webDir: 'dist'`, `server.url: 'https://<client>.satchida.com'`
- Build: `npx cap add android; npx cap sync android`
- Output: unsigned APK. Distribute link via WhatsApp/email. No Play Store.
- **Does NOT bundle a VPN.** HTTPS via Cloudflare Tunnel is the transport — no VPN needed.

Exit criteria:
- [ ] Mode dropdown selects mode; correct model field reaches router
- [ ] Privacy mode disabled with tooltip for Basic plan users
- [ ] Think toggle changes provider params in the actual HTTP request (verify in router log)
- [ ] `<client>.satchida.com` on Android phone shows "Add to Home Screen" prompt
- [ ] Installed PWA: opens full-screen, chat works, responses stream correctly
- [ ] Capacitor APK installs from link and works identically to browser version

---

## Phase 5 — Fleet provisioning automation
**Goal:** new client live in 15 minutes.

- Finalize and test `scripts/provision-client-tunnel.ps1` with a throwaway subdomain
- Write `scripts/Deploy-EdgeNode.ps1`:
  - Idempotent: skip already-installed components
  - Installs: Node 24, MongoDB, cloudflared (via winget); skips if version already correct
  - Clones and builds LibreChat, router, rag-service, sync-agent
  - Registers NSSM services in correct boot order
  - Writes `.env` from the provisioning token
  - Runs the Phase 0 verification checklist; prints PASS/FAIL for each item
  - If any item FAILS: prints actionable error, does NOT exit silently
- Test: run `Deploy-EdgeNode.ps1` on a fresh Windows 11 VM; verify Phase 0 checklist passes

Exit criteria:
- [ ] Script completes on a fresh Windows 11 machine in < 15 minutes
- [ ] Node appears in fleet-controller `/fleet/status` within 60s of script completion
- [ ] All 10 Phase 0 verification checks pass automatically

---

## Phase 6 — Satchida rebrand
**Blocked on:** brand assets (`Baseline_v2.0.png` and derivatives).
**Do not start this phase until brand assets exist.**

Logo generation rule (from `AGENTS.md` §5):
```
coverage = (255 - min(R, G, B)) × alpha / 255
```
Alpha term is mandatory. Always regenerate from `C:\Users\WinDiesel\Pictures\Satchida logo\Baseline_v2.0.png`.

---

## Fleet build status (2026-10-04)
- [x] `scripts/provision-client-tunnel.ps1` written (untested — test with throwaway subdomain)
- [x] Router: 12/12 tests pass; all 4 modes work; rate limiting live
- [x] RAG service: Milestone 1 (auth + /health). /text /query /delete return 501 honestly.
- [x] `.env` written with real secrets
- [x] `librechat.yaml` written with Satchida custom endpoint
- [ ] `npm install` + `npm run frontend` (Phase 0 — next step)
- [ ] NSSM service wrappers for router, rag-service, LibreChat
- [ ] Fleet controller (Phase 1)
- [ ] Sync agent (Phase 1)
- [ ] Licence JWT enforcement in router (Phase 2)
- [ ] RAG /text /query wired (Phase 3)
- [ ] LanceDB + BM25 hybrid retrieval (Phase 3)
- [ ] Chat toolbar — mode selector, think toggle (Phase 4)
- [ ] PWA manifest + Android test (Phase 4b)

---

## Open decisions (must answer before scoping work)

| # | Decision | Affects |
|---|---|---|
| 1 | Browser-only PWA vs Capacitor APK for first client | Phase 4 scope |
| 2 | Turnstile real keys from Cloudflare dashboard | Before going public |
| 3 | Google OAuth credentials | Phase 4 PWA |
| 4 | Razorpay credentials | Phase 6 payment automation |
| 5 | Brand assets availability | Phase 6 rebrand |
| 6 | ZDR approval (cloud provider) | Privacy-Cloud mode |
| 7 | 2×12 GB GPU vs 1×16 GB (see SATCHIDA-UI-SUBSCRIPTIONS-HARDWARE.md §3) | Local model capacity |
| 8 | Indic TTS quality — must test per language before selling speech feature | RAG speech-to-speech |
