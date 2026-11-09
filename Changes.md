# Changes — Satchida AI Harness

Chronological log of changes to this fork, newest first. Newest first so the current state is
readable without scrolling. `Customizations.md` explains _what_ diverges from upstream and
why; this file records _when_ and _what exactly_.

Format: date, phase, change, evidence. Every entry should be verifiable.

---

## 2026-11-09 — Persona & MCP asset consolidation for client shipping

### 1. Persona library copied into the repo (`satchida/personas/`)
1. **`personas.ts`** — verbatim copy of the 34-persona master library
   (`personas.constants.ts`) from `D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\constants\`,
   plus a provenance header and `export` on the three previously private rule blocks
   (`MANDATORY_CITATION_RULES`, `FINANCIAL_OUTPUT_FORMAT`, `NEWS_OUTPUT_FORMAT`).
   Evidence: `diff --strip-trailing-cr` against origin shows exactly those four
   planned deltas and nothing else; `grep -c "		id: '"` = 34 personas; LF endings
   (repo working-tree convention; origin file is CRLF).
2. **`specification.md`** — copy of the operator specification
   `SATCHIDA-AI-PERSONAS-SPECIFICATION.md` (codebase map, staging protocol,
   11 categories / 44 starters, ModelSpec starter overrides).
3. **`README.md`** — wiring map (the four rule blocks are **not yet** in any mode
   `promptPrefix` — first P0 action of the persona improvement plan), stale-data
   audit (PPF/SCSS rates, model-era names, BCD/GST figures), origin-sync rule,
   shipping checklist.

### 2. MCP shipping manifest (`satchida/mcp/`)
1. **`recommended-mcp.ts`** — curated external MCP catalog copied from the
   unified-suite constant (delta: `RecommendedMCPServer` type inlined; body verbatim).
2. **`README.md`** — all 21 `librechat.yaml` servers inventoried. Custom servers
   confirmed already git-tracked under `skill/` (292 files). Records packaged-server
   deps (`uvx`/`npx` + pre-warm step), external sidecars (AnythingLLM :3012,
   DeepTutor :8001), the per-client rewrite table for hardcoded `D:/LAN-AI-Infra`
   paths, and audit findings: `deeptutor-mcp/dist/` not tracked (build required on
   target), hardcoded AnythingLLM API key in `librechat.yaml` (rotate → `${ENV}`),
   `legal-research` serves US law while governance personas are India-focused,
   `clinical-research` unbound by any starter, `stem-math-server.py` unreferenced.

### 3. Scope
No runtime behavior changed — `ConversationStarters.tsx`, `librechat.yaml`, and
MCP server configs are untouched. The P0–P2 persona improvement plan (rule-block
wiring, dangling-placeholder fixes, safety rewrites, matrix fixes) is tracked as
the session todo list; its first execution items follow this entry.

## 2026-11-08 — AnythingLLM Knowledge Vault, Dual-Screen Web Productivity & Sales Decks Update

### 1. Architectural & Product Documentation Updates
1. **AnythingLLM MCP Integration (Satchida Knowledge Vault — Section 25 in `ARCHITECTURE.md`)**:
   - Documented the bare-metal runtime at `D:\LAN-AI-Infra\AnythingLLM` exposing port 3012 REST API.
   - Documented stdio MCP bridge `skill/anythingllm_mcp_server.py` registered in `librechat.yaml` under `satchida-knowledge-vault`.
   - Documented deterministic multi-tenant isolation (`_resolve_user_workspace_slug`) dynamically mapping users to isolated workspaces (`vault-<user_id>`).
   - Documented programmatic document creation (PPTX via `python-pptx`, PDF via `ReportLab`, DOCX via `docx`, XLSX via `openpyxl`).
   - Documented on-premise LanceDB semantic vector search with verified page and paragraph citations.
2. **Dual-Screen Web Productivity Architecture (Section 26 in `ARCHITECTURE.md`)**:
   - Explicitly clarified the architectural boundary: LibreChat is an conversational AI agent interaction platform, not a standalone IDE or code editor.
   - Documented **Mechanism A (Pop-Out Undocked Artifacts Portal)**: Upstream feature allowing users to pop out the live Artifacts pane via `window.open` React Portals to a second monitor with streaming state sync.
   - Documented **Mechanism B (Satchida Native Web IDE)**: Dedicated browser window on Monitor 2 running VS Code Server Web (`http://127.0.0.1:8085` / `:5173`) with Monaco editor, terminal, Git, and localhost app preview, while Monitor 1 runs LibreChat in `Work` or `Chat` mode orchestrating file operations via MCP tools.
3. **Privacy Mode & Study Mode Architectural Deep-Dive (Section 27 in `ARCHITECTURE.md`)**:
   - Sovereign Privacy Mode: Dual-Engine architecture (100% on-premises local GPU at ₹0 cloud COGS + 15M frontier cloud tokens for non-sensitive work), forced ephemeral memory retention (zero disk/database prompt logging), on-premise LanceDB RAG, and DPDP Act (2023) compliance.
   - Study Mode: Socratic pedagogy (leading hints rather than solving homework directly), POCSO Act (2012) child safety filters, speech synthesis reasoning token stripping, and curriculum-grounded textbook RAG with exact page references.
4. **Flagship Sales Proposal (`SALES-PROPOSAL-FLAGSHIP.md`)**:
   - Showcased AnythingLLM Knowledge Vault, Dual-Screen Engineering flow (VS Code Web + Undocked Artifacts), and Sovereign Privacy Tier.
   - Updated comparative capability matrix and aligned pricing to ₹3,499 / dedicated workstation seat / mo.
5. **Value Sales Proposal (`SALES-PROPOSAL-VALUE.md`)**:
   - Incorporated Knowledge Vault document intelligence into `Standard` (₹299/mo) and `Family` (₹999/mo) tiers.
   - Emphasized Socratic Study Mode, POCSO compliance, and clean audio read-aloud.
   - Highlighted Dual-Screen Web IDE workflow for `Pro Developer` (₹1,499/mo).

---

## 2026-11-08 — Zero-Conflict Selective Upstream Feature Sync & Stream Hardening

### 1. Functional Scope & Upstream Enhancements Ported
1. **Model Reasoning Effort Parameter Settings & Deployment Knobs**:
   - Ported `getReasoningParamDefinitions` in `packages/data-provider/src/parameterSettings.ts` to resolve model-specific reasoning effort parameters, default reset logic, and deployment declarations.
   - Added `reasoningEfforts` to `modelConfigSchema` in `packages/data-provider/src/config.ts` and `modelReasoningEfforts` to `TConfig` in `packages/data-provider/src/types.ts`.
   - Integrated `getAzureModelReasoningEfforts` in `packages/api/src/endpoints/config/endpoints.ts` to surface Azure model reasoning capabilities directly to the client composer.
2. **Decoupled MCP Host Tool Execution & Code Workspace Discovery**:
   - Ported `requiresCodeWorkspaceCapabilities` from upstream commit `99fb03cb9` to decouple host tool loads from active container/code workspace checks when executing pure host tools.
   - Wired selective workspace check into `api/server/services/ToolService.js` (`loadToolsForExecution`).
3. **Stream Pipeline Guards & Client Disconnect Protection (Upstream Commits `698ee25fe` & `ded1e734e`)**:
   - Implemented `pipeToResponse` in `packages/api/src/utils/streams.ts` using `node:stream.pipeline` to prevent unhandled stream errors on client disconnect during file downloads.
   - Implemented `pipeSegment` to tear down both upstream and response buffers when TTS streaming clients disconnect, preventing hanging socket loops.
   - Implemented `ClientDisconnectedError` and `abortOnClose` signal helper to quietly abort upstream requests without generating false-alarm error logs.
   - Wrapped `/code/download/:session_id/:fileId` and `TTSService.js` in stream guards.
4. **Text-To-Speech Safety Cap & Reasoning Exclusion in Read Aloud**:
   - Added `maxInputChars` to `ttsSchema` in `packages/data-provider/src/config.ts` (default 20,000 characters) bounding unbounded paid TTS API fanout.
   - Ported `createSpeechChunkProcessor` and `capSpeechInput` in `packages/api/src/files/speech.ts`.
   - Added `getSpeechText` and `parseThinkingContent` in `packages/data-provider/src/parsers.ts` ensuring model reasoning (`think` parts and `:::thinking` blocks) is excluded from spoken audio.
5. **Type Hierarchy Harmonization**:
   - Synchronized `TenantSeatCapability` in `librechat-data-provider` to include `'vscode_server'`, perfectly aligning with `data-schemas` and `api/src/admin/groups.ts`.
   - Resolved `Partial<IUser>` and `TUser.tenantSeatCapabilities` type compatibility across `mcp.spec.ts`.

### 2. Verification & Live Evidence
- Built and validated all packages:
  - `packages/data-provider`: `npm run build` completed with code 0 (`tsdown` + `tsc` clean).
  - `packages/data-schemas`: `npm run build` completed with code 0.
  - `packages/api`: `npm run build` and `npx tsc --noEmit` completed with code 0.
- Executed targeted unit test suites:
  - `server/services/__tests__/ToolService.spec.js`: 143 passed, 143 total (100% pass).
  - `server/services/Files/Audio/TTSService.spec.js`: 9 passed, 9 total (100% pass).
  - `packages/api/src/files/speech.spec.ts` & `packages/api/src/utils/streams.spec.ts`: 33 passed, 33 total (100% pass).
- Live service verification on Windows host:
  - LibreChat backend restarted cleanly on port 3080 (PID 74012, HTTP 200 OK via `/api/config`).
  - Satchida Gateway verified online on port 4000 (PID 75432, HTTP 200 OK via `/api/status`).
  - Zero conflicts achieved: Mandala canvas, Vibe Coding Studio IDE (`/api/ide`), and Satchida 7-tier entitlement bridges preserved intact.

---

## 2026-11-08 — Commercial Tier Hierarchy Harmonization & Metrics Auto-Backup Engine

### 1. Functional Scope & Business Architecture
1. **Commercial Tier Hierarchy Harmonization (`basic`, `standard`, `family`, `pro`, `pro_family`, `privacy`, `enterprise`)**:
   - Differentiated `basic` (free trial, 1 seat, Chat only, 500k tokens) from `standard` (individual professional, 1 seat, Chat + Work, 2M tokens/mo at ₹299/mo).
   - Structured `family` as a 4-seat pooled household account (2 adults, 2 children) with Chat + Study + Work modes, POCSO child safety guardrails, and 6M tokens/mo pooled budget at ₹999/mo.
   - Enhanced `pro` with the full developer toolchain (`vscode_server`, `mcp`, `agents`, `code_execution`), 1 seat, Chat + Study + Work, 15M tokens/mo at ₹1,499/mo.
   - Introduced `pro_family` combining the 4-seat pooled household structure of `family` with the complete developer toolchain of `pro` at ₹2,499/mo (25M tokens/mo pooled).
   - Added `vscode_server` capability token check to LibreChat entitlement schema (`packages/data-schemas/src/types/entitlement.ts`) and One-API group policies (`model/group.go`).
   - Populated complete default specifications into SQLite `license_tiers` table in `model/license_tier.go`.
2. **Tenant Metrics Auto-Backup & Archive Management Lifecycle**:
   - Upgraded `ResetTenantMetrics` in `model/analytics_tenant.go` to automatically capture an immutable backup snapshot before purging any data.
   - Captured metrics: Total tokens, requests, landed INR, upstream USD, by-mode breakdown, by-seat breakdown, and serialized raw consumption logs.
   - Saved snapshots to both the database (`tenant_metrics_archives` table) and physical disk (`data/archives/tenant_{tenant_id}_archive_{timestamp}.json`).
   - Built archive management REST endpoints: `GET /archives`, `GET /archive/:id/download`, and `DELETE /archive/:id`.
   - Created `TenantArchivesDialog.js` in Berry frontend providing an "Archives & Backups" modal with instant JSON downloads and a permanent delete confirmation modal.

### 2. Verification & Live Evidence
- Verified all 7 license tiers in SQLite `license_tiers` table via `scratch/check_tiers.py`:
  - `basic`: Chat only, 1 seat, ₹0/mo.
  - `standard`: Chat + Work, 1 seat, ₹299/mo.
  - `family`: Chat + Study + Work, 4 seats, ₹999/mo.
  - `pro`: Chat + Study + Work + VS Code Server Web + MCP + Code Execution, 1 seat, ₹1,499/mo.
  - `pro_family`: Chat + Study + Work + Full Developer Suite, 4 pooled seats, ₹2,499/mo.
  - `privacy`: Local bare-metal inference, 3 seats, ₹3,499/mo.
  - `enterprise`: 500 seats, ₹15,000/mo.
- Rebuilt Berry React frontend (`npm run build` and `publish-build` completed with exit code 0).
- Recompiled Go binary `satchida-gateway.exe` and restarted PM2 process `satchida-gateway` (PID 23108, online).
- System status verified healthy at `http://127.0.0.1:4000/api/status`.


---

## 2026-11-08 — Tenant Commercial Contract Display & Metrics Reset Infrastructure

### 1. Functional Scope & Requirements Addressed
1. **Tenant Contract Fee & Max Seats Serialization**:
   - Resolved contract fee rendering discrepancy where `TenantCommercialCard` displayed ₹0/mo. Populated and serialized `MonthlyFeeINR` and `MaxSeats` directly from the `tenants` database table into `/api/analytics/tenants` and `/api/analytics/tenant/:id/overview`.
2. **Tenant Metrics Reset Endpoint (`POST /api/analytics/tenant/:id/reset`)**:
   - Implemented an atomic backend method `ResetTenantMetrics` in `model/analytics_tenant.go` and controller route in `controller/analytics_tenant.go` (`POST /api/analytics/tenant/:id/reset`).
   - Atomically clears consumption logs (`LogTypeConsume`), resets rolling window quota buckets (`QuotaWindowBucket`), clears seat token usages (`SeatTokenUsage` / `SeatTokenReservation`), invalidates memory caches (`InvalidateTenantCache`), and records an immutable management audit entry (`LogTypeManage`).
3. **Interactive UI Reset Button & Safety Confirmation Dialog (`TenantCommercialCard.js`)**:
   - Added an operator-facing "Reset Metrics" action button with a modal confirmation dialog: *"Reset Tenant Metrics for [Tenant Name]?"*
   - Safely provisions the reset capability for the operator without automated execution, allowing clean verification of end-to-end telemetry across LibreChat modes.
   - Wires reactive `refreshKey` triggers in `Dashboard/index.js` to immediately update all rolling window gauges, bar charts, and summary cards.
4. **Tenant & Policy Group Seat Management**:
   - Verified and documented administrative workflows for updating monthly contract fees, tenant max seats, and per-group seat caps via `EditModal.js` and `GroupEditModal.js`.

### 2. Verification
- Built Berry React frontend (`publish-build` completed with exit code 0).
- Recompiled Go binary `satchida-gateway.exe` and restarted PM2 process `satchida-gateway` (PID 47392, online).
- System status verified healthy at `http://127.0.0.1:4000/api/status`.


---

## 2026-11-08 — Part 3 Commercialization: List Pricing Table, UPI Verification, Blob Invoicing & Prompt Caching

### 1. Functional Scope & Business Context
- Implemented Part 3 commercialization deliverables to ensure commercial readiness:
  1. Dedicated Official Provider List Price table with gross margin % tracking (guaranteeing $\ge 80\%$ margin).
  2. One-click Tenant Export (CSV & Printable PDF statement) directly accessible from `TenantCommercialCard`.
  3. High-performance Blob CSV export replacing truncated data URI downloads in `TenantUsageDrawer`.
  4. Real-time NPCI UPI QR Top-Up verification with strict 12-digit numeric UTR validation, synthetic pattern rejection, idempotency checks, and `[AUDIT_STATUS:PENDING_OPERATOR_REVIEW]` logging.
  5. Prefix caching rules and automated 90% cache discount for DeepSeek and Claude models to minimize token burn without degrading output quality.

### 2. Implementation Details
- **Official Provider List Price Table & Gross Margin Telemetry (`CostReconciliationTable.js`)**:
  - Added live gross margin computation `((quotaUSD - costUSD) / quotaUSD) * 100` across Upstream Provider Totals and Model Breakdown.
  - Implemented color-coded status chips: Green (`≥80% Target Met`), Amber (`50% - 79%`), Red (`<50% Deficit Risk`).
  - Added commercial policy header specifying standard retail list pricing ($0.30/M input, $1.20/M output, with 80%+ discount on cached tokens).
- **Direct Export & Invoicing (`TenantCommercialCard.js`)**:
  - Embedded one-click "Statement / PDF" button launching `TenantInvoiceDialog` for printable statements.
  - Added "Export CSV" for the selected tenant and "Export Fleet Summary CSV" for global fleet telemetry, using `Blob` URLs.
- **High-Performance CSV Export (`TenantUsageDrawer.js`)**:
  - Replaced legacy `encodeURI` data URI with `new Blob([csv], { type: 'text/csv' })` and `URL.createObjectURL(blob)`.
- **NPCI UPI QR Top-Up & Audit Workflow (`TopupCard.js`, `upi_billing.go`, `router/api.go`)**:
  - Updated `/api/billing/upi/verify` to allow authenticated user submissions via `middleware.UserAuth()`.
  - Added strict 12-digit numeric regex validation (`^\d{12}$`) and rejection of repeating (`111111111111`) or sequential (`123456789012`, `987654321098`) synthetic dummy patterns.
  - Enforced idempotency via `LOG_DB` lookup to block duplicate credit attempts (returns HTTP 409 Conflict).
  - Dynamically calculates quota credit based on the live landed forex rate (₹99.00/USD) and flags topup records with `[AUDIT_STATUS:PENDING_OPERATOR_REVIEW]`.
  - Added real-time exchange peg display, estimated quota calculation, and UTR submission form to `TopupCard.js`.
- **Token Optimization & Prompt Caching Rules (`cache.go`)**:
  - Enhanced `GetCacheRatio` in `relay/billing/ratio/cache.go` to provide an automated 90% cache discount (`0.1` ratio) for prefix-cached models (`deepseek`, `claude`), reducing token burn on repeated context while maintaining $\ge 80\%$ gross margin.

### 3. Verification & Live Evidence
- Built Berry React frontend (`npm run build`) and compiled native `satchida-gateway.exe`.
- Tested UPI verification endpoint:
  - Short UTR -> HTTP 400 (`Invalid UPI UTR format`).
  - Synthetic UTR (`111111111111`) -> HTTP 400 (`Rejected synthetic/dummy UTR number`).
  - Sequential UTR (`123456789012`) -> HTTP 400 (`Rejected synthetic/dummy UTR number`).
  - Genuine 12-digit UTR -> HTTP 200 (credited 2,525,252 quota units at landed rate ₹99.00/USD).
  - Duplicate UTR -> HTTP 409 (`Transaction has already been processed`).
- Verified latest log entry in `one-api.db` logged with `[AUDIT_STATUS:PENDING_OPERATOR_REVIEW]`.
- Verified live chat completion: DeepSeek model routed through OpenRouter returned 200 OK with prompt caching telemetry.
- All PM2 services online and healthy.

---

## 2026-11-08 — Commercial Gateway Alignment, Multi-Tenant Attribution & Timezone Harmonization

### 1. Root Cause & Invariant Analysis
- **Discrepancy Reported**: Dashboard displayed "0 Today's Tokens" in top cards while the 24-hour summary table showed "175.8k tokens in 24 hours". Rolling window policy gauges displayed "Burst Exceeded" with "Resets in 5h 29m" (anchored to 05:30 AM rather than midnight).
- **Go Truncation Pitfall**: `now.Truncate(24*time.Hour)` in `controller/user.go` truncated to epoch UTC midnight (05:30 AM IST), skewing daily bar chart aggregations.
- **Quota Window UTC Modulo Drift**: In `model/tenant.go`, `bucketStart := now - (now % int64(rule.WindowSeconds))` anchored 86,400s (1-day) windows to UTC 00:00:00, forcing daily quotas to reset at 05:30 AM IST.
- **JavaScript UTC Date Mismatch**: In `web/berry/src/utils/chart.js`, `getTodayDay()` used `today.toISOString().slice(0, 10)` which produced UTC date rather than local browser date, misaligning the frontend calendar item lookup.
- **Bifrost Dimension Extraction**: In `bifrost/plugins/logging/main.go`, Bifrost's logging plugin only read `customer_id` from virtual keys and omitted reading `x-bf-dim-customer_id` and `x-bf-dim-user_id` headers passed by One-API, preventing Bifrost's "Customer Rankings" and "User Rankings" from displaying per-tenant metrics.
- **Zero Retries**: `common/config/config.go` defaulted `RetryTimes = 0`, causing transient upstream 429/5xx errors to immediately fail without channel fallback.

### 2. Resolutions Applied
- **One-API Timezone Harmonization**:
  - `controller/user.go`: Replaced epoch truncation with true local calendar day calculation (`time.Date(y, m, d, 0, 0, 0, 0, now.Location())`).
  - `model/tenant.go`: Aligned 1-day daily quota windows to local calendar midnight (`00:00:00`). Rewrote `CheckWindowLimit` to query live tokens from the indexed `logs` table directly.
  - `controller/analytics.go`: Updated `AnalyticsWindowStatus` to dynamically calculate live usage for all active tenant rules directly from `logs`, ensuring real-time alignment with zero stale buckets.
  - `common/config/config.go`: Set default `RetryTimes = 2` and populated `options` table with `RetryTimes = 2`.
- **Frontend Dashboard Alignment**:
  - `web/berry/src/utils/chart.js`: Updated `getTodayDay()` to use local calendar date components.
  - `web/berry/src/views/Dashboard/index.js`: Added a 3-way time range toggle (`24h Rolling` | `Today` | `7 Days`), updated card titles and values to clearly distinguish rolling vs calendar periods, and added rich cross-referencing subtext.
  - `web/berry/src/views/Dashboard/component/WindowQuotaCard.js`: Updated countdown chips to differentiate rolling sliding windows (`Live Trailing 3h`) from periodic quotas (`Resets in Xh Ym` until local midnight).
  - Built production bundle via `npm run build` and embedded into `satchida-gateway.exe`.
- **Bifrost Dynamic Multi-Tenant Dimension Resolution**:
  - `bifrost/plugins/logging/main.go`: Patched logging plugin to extract `x-bf-dim-customer_id`, `x-bf-dim-user_id`, `x-bf-dim-team_id` from request context dimensions.
  - Compiled native binary `bifrost-http-satchida-ccgo-20261023-zdr.exe`.
  - Backfilled 806 historical logs in `D:/LAN-AI-Infra/Bifrost/data/logs.db`.
  - Configured native environment injection in `pm2-bifrost.json` with DPAPI-backed credentials.

### 3. Verification & Live Evidence
- Sent live completion request via One-API (:4000) to Bifrost (:8700).
- Confirmed One-API recorded log #949 with `tenant_id: satchida-master` and seat alias.
- Confirmed Bifrost recorded log with `customer_id: satchida-master` and `user_id: 672cf39818b28cf9698d249f`.
- Confirmed Bifrost `/api/logs/rankings/by-dimension?dimension=customer` and `dimension=user` return HTTP 200 with populated tenant and seat rankings.
- Confirmed One-API `/api/analytics/window-status?tenant_id=satchida-master` returns 31 tokens used today against 2.5M daily quota and 500k 3-hour window with 0% consumption and status `Within Limits`.
- Restarted `satchida-gateway` and `satchida-bifrost` in PM2; all processes online and healthy.

---

## 2026-11-07 — Upstream Token Reservation Fix (Eliminated 402 Error)

### 1. Root Cause Analysis
- Investigated 402 This request requires more credits, or fewer max_tokens. You requested up to 131072 tokens, but can only afford 15418.
- In librechat.yaml, the Satchida local endpoint specified max_tokens: 2000 in ddParams, but Satchida-Gateway had omitted max_tokens.
- Without an explicit completion cap, OpenRouter calculated the required upfront credit reservation by assuming the maximum possible generation length equal to the full context window (131072 tokens). This caused upstream to reject the request with HTTP 402 whenever the key's balance was lower than the full 128k reservation cost, even for a 1-sentence prompt.

### 2. Resolution Applied
- Added max_tokens: 4096 to endpoints.custom.Satchida-Gateway.addParams in librechat.yaml.
- Verified live via local gateway test (http://127.0.0.1:4000/v1/chat/completions) that requests now pass with HTTP 200 OK.
- Restarted LibreChat in PM2 and saved process state (pm2 save).
- Documented incident in Bugs.md (§B3).

---

## 2026-11-01 — Enterprise Admin Panel & Phase 2 Completion

### 1. Enterprise Admin UI Overhaul
- Upgraded the admin console shell to an enterprise layout (client/src/components/Admin/AdminDashboard.tsx) with persistent left sidebar, real-time counters, mobile drawer, and zero-trust connection indicators.
- Created AdminOverview.tsx executive dashboard with system health invariants, KPI metric cards, and rapid-action workflows.
- Implemented multi-criteria faceted search and filtering (roles, tiers, status) and bulk row selection operations in UsersList.tsx.
- Integrated commercial policy groups grid (GroupsPanel.tsx) with in-place group member management and One-API entitlement mapping.
- Enhanced RBAC and role inspection (RolesList.tsx) and cryptographic audit chain verification (AuditLogPanel.tsx).

### 2. Verified Phase 2 Backend Implementation (Zero Mocks)
- **Data Schemas**: plan.ts, subscription.ts, payment.ts schemas registered with strictly-typed Mongoose models. illing.ts methods provide end-to-end CRUD, status transitions, and paginated ledger queries.
- **Billing Service & Providers**: packages/api/src/billing/service.ts provides idempotent subscription-to-(role, balance) application, and manualUpi.ts / 
azorpayUpi.ts implement the typed IPaymentProvider abstraction.
- **Admin Reconciliation Route**: packages/api/src/admin/reconciliation.ts and pi/server/routes/admin/reconciliation.js provide live endpoints for ledger pagination, approve/reject operations, and CSV streaming.

### 3. Tests & Verification
- packages/data-schemas/src/methods/billing.spec.ts: 15/15 tests passing across memory MongoDB instance.
- packages/api/src/admin/reconciliation.spec.ts: 12/12 tests passing across handlers and CSV exports.
- 
pm run build:client: 0 errors, build succeeds in under 10s.

---

## 2026-10-31 — Tenant Administrator Role & Seat Caps (P2)

### 1. Added `seedTenantUserAdmin`: a limited tenant-admin grant seed

`packages/data-schemas/src/methods/systemGrant.ts`: added `seedTenantUserAdmin(tenantId, roleName='TENANT_ADMIN')`,
which grants only `access:admin`, `manage:users`, `read:users` and `read:groups` — **omitting**
`manage:groups`, `manage:roles`, `manage:configs` and `operator:control`. It mirrors the existing
`seedTenantAdmin` (full set) as an explicit, narrower companion, and is idempotent (re-runs are
upsert no-ops), tenant-scoped, and `grantCapability` refuses `operator:control` outright so it cannot
mint a platform operator.

### 2. Added operator-only provisioning API for the limited role

`packages/api/src/admin/grants.ts`: added `seedTenantUserAdmin` to `AdminGrantsDeps`, a
`provisionTenantUserAdmin` handler (mirrors `provisionTenantAdminHandler`), and the
`provisionTenantUserAdmin` entry in the returned handler map. `api/server/routes/admin/grants.js`:
registered `POST /admin/grants/tenant-user-admin` behind `requireOperator`
(`OPERATOR_CONTROL`, `platformOnly: true`) so a tenant admin cannot mint peers, and wired
`seedTenantUserAdmin: db.seedTenantUserAdmin` into the handler deps (`db` already spreads all
`createSystemGrantMethods` in `api/models/index.js`, so no index.js change was needed).

### 3. Confirmed route-layer gates are already fine-grained

Re-examined `api/server/routes/admin/users.js`, `groups.js`, `roles.js`, `config.js`. The legacy
`users.js` create/patch paths are **already** gated on `requireManageUsers` (not a coarse
`ACCESS_ADMIN`-only gate) — the route wiring was ahead of the docs. `groups.js` gates writes on
`MANAGE_GROUPS`, `roles.js` on `MANAGE_ROLES`, `config.js` on `OPERATOR_CONTROL`; a `TENANT_ADMIN`
without those caps is denied group/role/config mutation before any handler runs. No code change
required here; documented the over-grant defect in `seedTenantAdmin` (Bugs.md A5) instead.

### 4. Seat caps are enforced upstream by one-api

No new seat-cap code lives in LibreChat. Account types map 1:1 to one-api `Group` rows
(`groupPolicyByAccountType`, `model/group.go`, `ValidAccountTypes`); `CreateTenantToken`
(`model/tenant_token.go:101-140`) enforces `Group.MaxSeats` and rejects HTTP 409. LibreChat
`createUser` resolves the account type to its group via `findGroupByName` + `addUserToGroup`, so a
tenant admin provisions users into operator-seeded groups and cannot exceed `Group.MaxSeats`.

### Tests & typecheck
- `packages/data-schemas/src/methods/systemGrant.spec.ts`: +6 `seedTenantUserAdmin` tests (capability
  set, no OPERATOR_CONTROL, no manage:groups denies group writes while manage:users is granted,
  idempotency, empty-tenantId rejection, custom role name).
- `packages/api/src/admin/grants.spec.ts`: +5 `provisionTenantUserAdmin` tests (401 caller, 501
  unconfigured, missing tenantId, success trim, 500 on throw).
- `jest` both suites: `systemGrant.spec.ts` 193/193, `grants.spec.ts` 93/93.
- `npx tsc --noEmit`: `data-schemas` and `data-provider` clean; `api` clean for
  `admin/grants.ts` / `systemGrant` (26 pre-existing `tenantSeatCapabilities` errors in
  `src/mcp/__tests__/mcp.spec.ts` are unrelated and untouched).
- `prettier --check` clean on all touched files.

## 2026-10-28 — DeepTutor MCP Server Integration

### 1. Added `deeptutor-mcp` MCP server

Created a new stdio MCP server at `skill/deeptutor-mcp/` that wraps DeepTutor's FastAPI backend as 19 MCP tools, enabling LibreChat to invoke DeepTutor's tutoring capabilities (books, deep-dives, quizzes, mastery paths, question generation, notebooks, knowledge bases, subagents, co-writer documents) for both Study and Work modes.

**`skill/deeptutor-mcp/src/index.ts`** (477 lines):
- 19 tools across Study mode (books, deep_dive, quiz_attempt, page_chat, mastery paths, question generation, knowledge bases), Work mode (notebooks, subagents, co-writer documents), and Dashboard (learning library, recent activity).
- `callDeepTutor()` helper handles auth via `DEEPTUTOR_API_TOKEN` Bearer header and JSON request/response round-tripping.
- Return type aligned with MCP SDK `CallToolResult` from `@modelcontextprotocol/sdk/types.js`.

**`skill/deeptutor-mcp/package.json`**: depends on `@modelcontextprotocol/sdk` ^1.0.0 and `zod` ^3.24.0.

**`skill/deeptutor-mcp/tsconfig.json`**: ES2022 target, ESM module, strict mode.

### 2. Registered MCP server in `librechat.yaml`

Added `deeptutor-integration` stdio server entry under `mcpServers`:
```yaml
deeptutor-integration:
  type: stdio
  command: "node"
  args: ["D:\\LAN-AI-Infra\\LibreChat\\skill\\deeptutor-mcp\\dist\\index.js"]
  env:
    DEEPTUTOR_API_URL: "http://127.0.0.1:8000"
  title: "DeepTutor Academic Tutor"
  chatMenu: true
  startup: true
```

### Verification
- `npx tsc --noEmit` → zero TypeScript errors (after fixing `HeadersInit` → `Record<string, string>` and replacing custom `ToolResponse` interface with SDK's `CallToolResult`).
- `npx tsc --build` → `dist/index.js` emitted (18,887 bytes).
- MCP client `listTools()` → 19 tools discovered.
- DeepTutor API URL defaults to `http://127.0.0.1:8000` (local FastAPI backend per Satchida bare-metal convention).

### Note on DeepTutor architecture
DeepTutor is a full-stack AI tutor with Python FastAPI backend and Next.js frontend. It is a **consumer** of MCP servers (has its own MCP connection manager). For LibreChat integration, a new MCP server was built that wraps DeepTutor's HTTP API as stdio MCP tools.

---

## 2026-10-27 — Long-chat transport timeout tuning & title generation suppression

### 1. LibreChat transport timeout overrides for long-chat resilience

Added `endpoints.agents` block in `librechat.yaml` to extend upstream request limits:

```yaml
endpoints:
  agents:
    modelResponseBodyTimeoutMs: 1800000
    modelResponseHeadersTimeoutMs: 600000
```

- `modelResponseBodyTimeoutMs: 1800000` (30 min) — prevents EOF/connection-reset errors on extended reasoning or long token generations via Satchida Gateway and local llm-server.
- `modelResponseHeadersTimeoutMs: 600000` (10 min) — allows backend to send headers after queuing.
- Source: `packages/data-provider/src/config.ts:1335-1336` default 900_000 / 300_000; schema at `:1356-1363`.

### 2. Disabled title generation globally

Set `titleConvo: false` for both custom endpoints:

- `Satchida` endpoint: `titleConvo: true` → `false`
- `Satchida-Gateway` endpoint: already `false` (unchanged)

Rationale: title generation consumes extra tokens and adds latency to every new conversation. Disabled for local Privacy mode and cloud routes alike.

Evidence: schema validates `titleConvo` as boolean at `packages/data-provider/src/config.ts:699`.

---

## 2026-10-24 — Satchida One-API Gateway & Admin Control Panel Verification

### 1. One-API Gateway & Satchida Router Verification
- **One-API Binary (port 4000)**: Verified online (`satchida-gateway.exe`, PID 37312).
  - Queried `GET /v1/models` successfully (HTTP 200). Returns mode models: `Chat`, `Study`, `Work`.
  - Identified and fixed stale `SATCHIDA_GATEWAY_VK` token in `.env`. Replaced unmapped key with active master gateway token (`SPYfLW63OU6l04br13668aD230414eF2B2Ca38Ae8d35E9A7`) directly from SQLite `tokens` table.
- **Satchida Router (port 4001)**: Verified online (`satchida-router`, PID 37144).
  - Queried `GET /v1/models` using `Bearer sk-bifrost-master-key` (`ROUTER_TOKEN`) successfully (HTTP 200). Models: `Chat`, `Work`, `Study`, `Privacy`.
  - Cleaned up obsolete comment in `fleet/ecosystem.config.cjs` referencing historical zombie port 4002 conflicts.
- **LibreChat Upstream Proxying**: Restarted LibreChat PM2 instance (`pm2 restart librechat`) to load corrected `.env` gateway token without downtime.

### 2. Admin Control Panel Audit & API Verification
- **Admin Surface Mounted**: Standalone SPA properly served at `http://localhost:3080/admin` from `/admin`.
- **Local Admin Authentication**: Authenticated successfully against `POST /api/admin/login/local` using `admin@satchida.local` / updated password. JWT token successfully acquired.
- **Access & Operator Verification (`GET /api/admin/verify`)**: Confirmed operator status: `isOperator: true`, `tenantId: "satchida-master"`, and role `ADMIN`.
- **User Account Management (`/api/admin/users`)**:
  - `GET /api/admin/users`: Verified listing of registered users (17 USER, 2 ADMIN).
  - `POST /api/admin/users`: Created new test account via API (HTTP 201 Created).
- **Group Management (`/api/admin/groups`)**:
  - `GET /api/admin/groups`: Verified existing tenant group (`Demo`).
  - `POST /api/admin/groups`: Created test group via API (HTTP 201 Created).
- **Role & Capability Grants (`/api/admin/roles`, `/api/admin/grants`)**: Verified ADMIN/USER roles and 25 capability grants including `access:admin`.

## 2026-10-23 - Restore the model list for authenticated tenant users

`GET /api/models` had been put behind `OPERATOR_CONTROL`, which returned `403 Forbidden` for every
ordinary tenant account and left the chat composer without a model or mode selector. The route now
requires JWT authentication only, matching upstream; the response is already scoped to the calling
user and contains model names, not token configuration. The unused capability imports in the route
and controller were removed.

Operational credentials were also removed from committed files: `LIBRECHAT-BUILD.md` no longer
contains the shared JWT secret, `scripts/reset-admin-pwd.js` reads `ADMIN_PASSWORD`, and
`scripts/set-demo-passwords.js` reads `DEMO_PASSWORD`. Debug capture scripts that embedded the admin
password were left out of the repository.

Evidence: `npx jest server/controllers/ModelController.spec.js` passes; `npx eslint` is clean on both
changed backend files; a live login on `:3080` renders `AI Mode` and `Select a model` again.

---

## 2026-10-16 — Part XIV: Tenant-scoped account-management admin panel

### Part XIV(a) — made usable at 4,000+ users, and four bugs found doing it

Building the panel for a real tenant size surfaced defects that only appear at scale. All are logged
with evidence in `Bugs.md` §D; the code changes are:

- **Panel pagination (B27).** Every list loader fetched the server default of 50 rows and discarded
  `total`, so a 4,000-user tenant showed "50 record(s)" with no way to reach the rest. `loadUsers`
  and `loadGroups` now carry `limit`/`offset` cursors, read the server's `total`, and render
  "Showing X–Y of N" with Prev/Next and a page-size control. Deleting the last row of the last page
  steps back a page rather than showing a dead end.
- **Batched roster import (B28).** The bulk path awaited a duplicate check, a user insert, a balance
  insert and a group update *per row*, and hashed each password with the blocking `bcrypt.hashSync` —
  ~16,000 sequential round-trips plus ten minutes of frozen event loop for a 4,000-row roster.
  Rewritten as `bulkCreateUsers` in `packages/api/src/admin/users.ts`: one duplicate query, async
  hashing with bounded concurrency, one `insertMany` per collection, one group update per distinct
  group. `MAX_BULK_ROWS = 500`, and the panel chunks at 200 with a progress line, reporting a partial
  import instead of failing silently. The CSV template now carries an `account_type` column distinct
  from `group`.
- **Search cap made visible (B29).** `capped` is now surfaced ("first N match(es) — narrow the
  search") instead of an unqualified count on a 4,000-row tenant.
- **`disableStreaming` no longer forces non-streaming (B34).** The fork had added code coupling the
  two flags in `llm.ts` and `transform.ts`, contradicting an unmodified upstream spec and reproducing
  the blank-reply-box failure this project already hit twice (B15, B18). Restores upstream's
  independent-flag contract.
- **`X-Tenant-Id` header injection flagged (B35, open).** `config.ts` sends a client-side tenant
  claim that one-api/Bifrost explicitly refuses to trust. Not exploitable, but misleading; recorded
  rather than changed.

Verified: `packages/api` 1983/1992 (47 suites, real MongoDB; the single failure needs Redis, absent
here), `src/admin` + `src/endpoints/openai` 1287/1287, `tsc --noEmit` clean in `packages/api` and
`packages/data-schemas`, `npm run build:packages` exit 0, eslint 0 errors, and a check that every
`getElementById` in `admin/app.js` exists in `index.html`.

**Scope:** make the existing `/admin` panel usable by a **tenant admin** scoped to their own
tenant, and complete account management on the API it drives. No new capability was needed:
tenant-scoped grants already existed and were already tested.

### Phase 0 — closed a cross-tenant read leak (`packages/api/src/admin/users.ts`)

- `listUsersHandler` / `searchUsersHandler` derived scope from the request:
  `req.query.scope === 'all' || 'system' || !req.query.tenantId` → `runAsSystem()`. Any caller
  who omitted `?tenantId=` was served **every tenant's users**. Replaced with `resolveListingScope`,
  which derives `'system' | 'tenant' | 'forbidden'` from the caller's authority via a new
  `isPlatformOperator` dep; `?scope` and `?tenantId` are now ignored, and a caller who is neither
  a platform operator nor attached to a tenant is refused (403) rather than falling through to an
  unscoped query.
- Route wiring: `isPlatformOperator` supplied in `api/server/routes/admin/users.js` from
  `hasCapability(user, OPERATOR_CONTROL, { platformOnly: true })`.
- Evidence: `packages/api/src/admin/users.spec.ts` — 6 new scope tests, including two asserting
  `runAsSystem` is **not** called for a tenant admin passing `scope=all` / `tenantId=other`.
  Suite 42/42 → 56/56 pass; `npx tsc --noEmit` exit 0.

### Phase 1 — tenant-scoped admin surface gate

- `api/server/routes/admin/{users,groups,roles,grants}.js`: the router-level gate changed from
  `requireCapability(OPERATOR_CONTROL, { platformOnly: true })` to
  `requireCapability(ACCESS_ADMIN)`. Operators still pass because `OPERATOR_CONTROL` implies every
  capability; tenant admins now pass via a tenant-scoped `access:admin` grant. `config`,
  `langfuse`, `skills` and `code` remain operator-only.
- `api/server/routes/admin/auth.js`: `POST /login/local` and `GET /verify` moved to the new gate
  (a tenant admin could not previously even sign in to the panel). `GET /verify` now returns
  `{ user, isOperator, tenantId }`.
- **`audit.js` deliberately left operator-only**: `AuditLog` is excluded from tenant isolation by
  design (`packages/data-schemas/src/models/auditLog.ts` documents `chainKey` scoping), so opening
  it to tenants needs that read path verified first.

### Phase 2 — provisioning a tenant administrator

- `packages/data-schemas/src/methods/systemGrant.ts`: added `seedTenantAdmin(tenantId, roleName?)`
  — idempotent, grants `access:admin` plus user/group/role read+manage **with `tenantId` set**.
  `grantCapability` refuses `OPERATOR_CONTROL`, so this cannot mint a platform operator.
- `packages/api/src/admin/grants.ts`: `GrantPrincipalType` widened from `ROLE` to
  `ROLE | GROUP | USER` (compile-forced `MANAGE_/READ_CAPABILITY_BY_TYPE` entries:
  group→manage:groups, user→manage:users); `checkRoleExists` replaced by a type-aware
  `checkPrincipalExists`; audit targets resolve a display name for non-ROLE principals; the grant
  body accepts a `tenantId` **honoured only for a platform operator** (else 403); added
  `provisionTenantAdmin` handler.
- `api/server/routes/admin/grants.js`: new operator-only `POST /api/admin/grants/tenant-admin`.
  Existence checks run under `runAsSystem` so an operator can validate another tenant's principals.
- Evidence: `grants.spec.ts` 76 → 88 tests.

### Phase 3 — user management completed on the backend

- `packages/data-schemas`: added `accountType` to the User schema and `IUser`
  (`enum: basic|pro|family|privacy`), an `ACCOUNT_TYPES` runtime list (explicitly re-exported in
  `index.ts` because that barrel is `export type *`), and widened `AdminUserListItem` with
  `tenantId`/`accountType`/`familyAccountId`/`familyRole`/`mustChangePassword`/`seatAssigned`/
  `seatTokenHint`.
- `packages/api/src/admin/users.ts`: added `createUser`, `updateUser`, `getUserGroups` handlers;
  `USER_LIST_FIELDS` widened; a `toListItem` projection; `maskSeatToken` (last 4 chars only — the
  raw bearer token is never returned).
- `api/server/routes/admin/users.js`: the inline `POST /` body (which used `mongoose.models.*`
  directly, against this repo's "`/api` holds wiring, not behaviour" rule) is replaced by
  `handlers.createUser`; added `PATCH /:id` and `GET /:id/groups`; the new deps wired.
- Evidence: `users.spec.ts` 42 → 56 tests; `api` + `data-schemas` `tsc --noEmit` both exit 0.

### Fixed along the way (pre-existing, unrelated to the above)

- **`packages/api/src/endpoints/openai/initialize.ts:91`** — the seatToken bearer bridge had an
  **unbalanced parenthesis** and did not compile. The bridge claimed in
  `docs/admin-creation-technical.md` as "already applied" had never built.
- **Stale `dist`**: `seatToken` existed in `data-schemas/src/types/user.ts` but not in the built
  declarations, so the bridge also failed typechecking in `custom/initialize.ts`. Fixed by
  rebuilding `packages/data-schemas`, not by re-declaring the type.
- `api/server/routes/admin/users.js` and `auth.js` carried prettier violations from earlier
  uncommitted work; both are now lint-clean.

### Phase 4 — panel UI (`admin/`)

- Users table: Account type / Tenant / Family / Seat columns plus **Edit** and **Groups** actions
  (`PATCH /users/:id`, `GET /users/:id/groups`).
- Create + Edit modals: account-type and family-role selects limited to the lowercase
  one-api group names.
- Grants tab: principal-type selector (role/group/user), group picker, user-id input, and an
  operator-only target-tenant field + **Provision tenant admin** button.
- UI authority now comes from `GET /admin/verify`'s `isOperator`/`tenantId` instead of inferring
  scope from `role === 'ADMIN'`, which mis-classified every tenant admin.
- `access:admin` was already present in the panel's capability list.

### Verification

| Check                                                                   | Result                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `npx tsc --noEmit` (packages/api)                                       | exit 0                                             |
| `npx tsc --noEmit` (packages/data-schemas)                              | exit 0                                             |
| `npx tsc --noEmit` (packages/data-provider)                             | exit 0                                             |
| `jest src/admin` (packages/api, excl. DB-integration)                   | **637/637 pass**, 11 suites                        |
| `jest src/endpoints/{openai,custom}/initialize.spec.ts src/middleware/capabilities.spec.ts` | 55/55 pass (covers the seatToken bridge)  |
| `jest server/routes/__tests__/{roles,config}.spec.js` (api)              | 76/76 pass                                         |
| `npm run build:packages` (data-provider → data-schemas → api → client-pkg) | exit 0                                          |
| `npm run build` (client, `vite build` + PWA)                            | exit 0, 379 files in `client/dist`                 |
| eslint over every touched file                                          | exit 0                                             |
| `node --check` on `admin/app.js` and the touched routers                | exit 0                                             |
| Panel element ids referenced in JS vs defined in HTML                   | all 5 new ids matched                              |

**DB-backed suites — now running against real MongoDB.** `mongodb-memory-server` was previously
believed unrunnable here. It is runnable; the fix is to point it at the mongod it actually wants:

```
MONGOMS_SYSTEM_BINARY=<repo>\node_modules\.cache\mongodb-memory-server\mongod-x64-win32-8.2.1.exe
```

mms 11.0.1 pins **8.2.1** and that exact binary is already cached in the repo — only the 865 MB
download *zip* is corrupt (`md5 89a5…` on disk vs the checkfile's `8963…`), which is why the
default path fails with `Md5CheckFailedError`. Do **not** point `MONGOMS_SYSTEM_BINARY` at the
natively installed `MongoDB\Server\8.3\bin\mongod.exe`: mms 11 cannot spawn 8.3 and the run hangs.

| DB-backed suite (real MongoDB)                                | Result    |
| ------------------------------------------------------------- | --------- |
| `packages/data-schemas` `models/plugins/tenantIsolation.spec.ts` | 61/61  |
| `packages/data-schemas` `models/plugins/tenantIsolation.coverage.spec.ts` | 3/3 |
| `packages/data-schemas` tenant conformance, probe, tenantBulkWrite, tenantEntitlement, accessRole.tenant | 148/148 (6 suites) |
| `packages/data-schemas` `methods/user.methods.spec.ts` + `role.methods.spec.ts` | 157/157 |
| `packages/data-schemas` `methods/systemGrant.spec.ts` → `seedTenantAdmin` (6 new tests) | 6/6 |
| `packages/api` `middleware/capabilities.integration.spec.ts`  | 35/35     |
| `api` `server/routes/__tests__/grants.spec.js`                | 8/8       |

The new `seedTenantAdmin` tests assert the property this whole change rests on — a tenant grant is
invisible to a platform-level check *and* to a different tenant's check, while satisfying its own.
Verified against real MongoDB.

**Known pre-existing instability:** running `systemGrant.spec.ts` (186 tests) as a whole file, or
as a filtered subset, fails and then hangs past 10 minutes — yet individual tests, and the new
`seedTenantAdmin` describe, pass in isolation. That suite has cross-test state coupling (module
level env vars / shared collections) that makes subset runs unreliable. It predates this work and
is worth fixing separately; do not read a full-file failure of that suite as a regression without
running the affected test alone.

### Specs corrected (they were asserting upstream semantics)

Two specs still encoded upstream's "seedSystemGrants grants ADMIN every capability" contract.
That is **not** this fork's design — `seedSystemGrants` deliberately only *deletes* platform
ROLE/ADMIN grants ("ADMIN is tenant-local in this deployment"), a change that predates this work
and is fully covered by `systemGrant.spec.ts` ("removes platform-scoped grants from the ADMIN
role", "never grants OPERATOR_CONTROL to the ADMIN role"). So the specs were stale, not the code:

- `api/server/routes/__tests__/grants.spec.js` — rewrote the fixtures to grant the caller's
  authority directly (mirroring `bootstrapOperatorCapability`), updated the renamed dep
  (`checkRoleExists` → `checkPrincipalExists`, error now `Target principal not found`), and added
  coverage for the new behaviour: GROUP-principal refusal, operator-only tenant targeting, and
  `POST /tenant-admin` — asserting the seeded capabilities are tenant-scoped, never include
  `operator:control`, and **do not satisfy a platform-level check**.
- `packages/api/src/middleware/capabilities.integration.spec.ts` — the fixture now grants its
  admin directly, so the resolution pipeline, ALS caching and `platformOnly` semantics are
  exercised unchanged. 9 → 0 failures.

Both were pre-existing failures in files already modified before this session; my Phase 2 dep
rename (`checkRoleExists` → `checkPrincipalExists`) was an additional, separate breakage in the
route spec that this fixes.

### Not done

- `POST /users/bulk` and `POST /users/:id/reset-password` remain inline in
  `api/server/routes/admin/users.js` (same "logic in wiring" violation; bulk now at least
  lint-clean). Moving them into `packages/api/src/admin/users.ts` is the next refactor.
- Phase 5 of the plan (porting this surface into the React `client/`) is untouched.


## 2026-10-08 — Part XIII: Skill Soft-Delete & Restore Engine + VibeStudio IDE Iframe Auth Fix

- **VibeStudio IDE Authentication & Iframe Fix (`api/server/routes/ide.js` & `client/src/components/IDE/IdeView.tsx`):**
  - **Root Cause of `{"message":"No auth token"}`:** Browser `<iframe>` navigations do not send custom HTTP `Authorization: Bearer <token>` headers, causing Passport JWT strategy in `requireJwtAuth` to reject the iframe with 401 Unauthorized.
  - Added query token extraction middleware in `api/server/routes/ide.js`: intercepts `req.query.token` (or cookie) and attaches it to `req.headers.authorization = 'Bearer ' + token` prior to Passport JWT validation.
  - Updated `client/src/components/IDE/IdeView.tsx` to retrieve active user `token` from `useAuthContext()` and append it to `iframeSrc` as `?token=...&_r=...`, while injecting Bearer headers into the `/api/ide/` proxy health-check fetch.
  - Verified live: `/api/ide/?token=<jwt>` returns `HTTP 200` with the complete VS Code Server web interface HTML bundle.
- **Skill Soft-Delete & Admin Restore Engine (`packages/data-schemas`, `packages/api`, `packages/data-provider`, `client`):**
  - **Schema (`packages/data-schemas/src/schema/skill.ts`):** Added `deletedAt: { type: Date, default: null, index: true }` and index `{ deletedAt: 1, updatedAt: -1 }`.
  - **Filtering (`packages/data-schemas/src/methods/skill.ts`):** Updated `buildSkillFilter` to automatically exclude soft-deleted skills (`deletedAt: null`) for standard queries, while supporting `{ onlyDeleted: true }` for administrators.
  - **Soft-Deletion Method (`packages/data-schemas/src/methods/skill.ts`):** `deleteSkill(id)` now performs soft deletion by updating `deletedAt = new Date()` and pruning active agent allowlists, while preserving skill records and `SkillFile` documents on disk and database.
  - **Restore API & Method (`packages/data-schemas`, `packages/api`):** Implemented `restoreSkill(id)` which clears `deletedAt: null`. Added endpoint `POST /api/skills/:id/restore` restricted to `ADMIN` users.
  - **Client UI & Admin Trash Bin (`client/src/components/Skills/sidebar/SkillsSidePanel.tsx`):**
    - Added a collapsible "Deleted Skills" trash panel in the Skills sidebar for administrators displaying all deleted skills with their authors.
    - Integrated a 1-click "Restore" button backed by `useRestoreSkillMutation`, immediately restoring skills back into the active catalog and invalidating query caches.
  - **Automated Verification:** Verified full lifecycle (Create -> Soft Delete -> Exclusion from user list -> Visibility in Admin Trash -> Admin Restore -> Reappearance in active list) with 100% success.

## 2026-10-08 — Part XII: Native Web IDE Sub-Router (Option A - VS Code Server / Cline)

- **Express Reverse Proxy Route (`api/server/routes/ide.js`):**
  - Added `http-proxy-middleware` to `@librechat/backend` (`api/package.json`).
  - Mounted proxy route at `/api/ide/*` pointing directly to local `code-server` at `http://127.0.0.1:8085` (`VSCODER_PORT`).
  - Enforced `requireJwtAuth` on all requests to ensure unauthenticated users are rejected with `HTTP 401`.
  - Injected `x-forwarded-user` header containing the user's email/id for upstream authentication.
- **WebSocket Protocol Upgrading (`api/server/index.js`):**
  - Hooked HTTP server `upgrade` handler to intercept `/api/ide` WebSocket requests and delegate to `vscoderProxy.upgrade()`.
  - Powers interactive terminal sessions, language servers, and file synchronization.
- **Client IDE Panel Integration (`client/src/components/IDE/IdeView.tsx`):**
  - Refactored IDE iframe source and health check from absolute port `:8085` to unified relative path `/api/ide/`.
  - Updated Pop-Out and Copy URL handlers to reference `/api/ide/`.
  - Built frontend client bundle (`npm run build:client`) and verified live.

## 2026-10-08 — Part XI: Master/Tenant Provisioning, Satchida Gateway Telemetry & Dead-Man Lease (Zero Mocks)

- **Admin User Scoping Fix (`packages/api/src/admin/users.ts`):**
  - Wrapped `findUsers`, `countUsers`, and `searchUsers` under `runAsSystem()` when called with system/operator scope.
  - Verified: live API `/api/admin/users` immediately unblocked and returns all 7+ database accounts (`total: 7+`) instead of 1.
- **Production Provisioning Endpoints (`api/server/routes/admin/users.js`):**
  - Implemented `POST /api/admin/users` for single seat provisioning with cryptographically random temp password, `mustChangePassword: true`, and automatic balance credit record.
  - Implemented `POST /api/admin/users/bulk` supporting CSV/JSON rosters (up to 5,000 seats per upload) with duplicate protection and downloadable credential slips.
  - Implemented `GET /api/admin/users/csv-template` for standard roster format downloads.
- **Admin Console UI Enhancements (`admin/index.html` & `admin/app.js`):**
  - Added "Create User", "Bulk CSV Import", and "Download Template" action buttons and interactive modals.
  - Added dynamic credential slip CSV export upon bulk completion.
  - Added role-based capability partitioning: Tenant Admins are restricted to Unlock & Reset password only, while Master Operators have full provisioning control.
- **Mandatory First-Login Password & Challenge Claim (`client` & `api`):**
  - Added `mustChangePassword`, `challengeQuestion`, `challengeAnswerHash`, and `passwordChangedAt` to `packages/data-schemas/src/schema/user.ts` and `PUBLIC_USER_RESPONSE_FIELDS`.
  - Built `client/src/components/Auth/FirstLoginClaimModal.tsx` and mounted in `client/src/routes/Root.tsx` to lock down access until permanent password and security recovery question are set.
  - Implemented `POST /api/auth/first-login-claim` in `api/server/routes/auth.js`.
- **Upstream Satchida Gateway Telemetry Injection (`packages/api/src/endpoints/openai/config.ts`):**
  - Injected `X-Tenant-Id`, `X-Satchida-Gateway-User-Id`, and `X-Satchida-Gateway-Role` headers when routing upstream to Satchida Gateway (`:8700` or `control.satchida.com`).
- **Local GPU Privacy Compute Gating (`packages/api/src/middleware/checkBalance.ts`):**
  - Applied `privacyRateMultiplier` to ensure local GPU Privacy turn tokens debit user credits and fail-closed when quota hits 0.
- **Cryptographic Dead-Man Lease Guard (`packages/api/src/middleware/leaseGuard.ts`):**
  - Added offline lease validation with Ed25519 signature and anti-clock-tampering protection against system clock rollbacks.

## 2026-10-07 — Hook executor console suppression (guardrail flash fix)

- **Root cause:** the LibreChat hook executor (`@librechat/api/dist/index.cjs`, function `runCommand`) spawned the guardrail hook process (`child-safety-gate`, `redact-secrets`, `use_classifier`) with `node_child_process.spawn` and no `windowsHide`, so on Windows every chat message flashed a PowerShell console window.
- **Change:** added `windowsHide: process.platform === "win32"` to the spawn options block (invisible window; stdio pipes preserved, so hook output capture is unaffected).
- **Durability:** manual `patches/@librechat+api+1.7.52.patch`, re-applied by the existing `postinstall` → `patch-package` hook on future `npm install`. Version-pinned to `@librechat/api` 1.7.52; patch edits the compiled `dist/index.cjs`, not `src/` (runtime `main` = `dist/index.cjs`).
- **Evidence:** `grep windowsHide node_modules/@librechat/api/dist/index.cjs` — one hit (`:110185`); patch file present and matches. Live on `:3080`.
- **Reference:** LibreChat `Bugs.md` B25, B26; `Customizations.md` C12; Satchida Gateway `bifrost/Bugs.md` BIF-026.

## 2026-10-07 — Satchida Upstream Proxy (Satchida Gateway) Routing Alignment

- **Satchida Gateway Proxy Routing (`librechat.yaml`):**
  - Configured modelSpecs (`Chat`, `Work`, `Study`) to route upstream to the Satchida Gateway (Satchida Gateway gateway at `http://127.0.0.1:8700/v1`) using model IDs `deepseek-ai/DeepSeek-V4-Flash-0731` and `zai-org/GLM-5.3-Flash`.
  - Configured `Privacy` mode to strictly point to local sovereign inference (`endpoint: "Satchida"` on `127.0.0.1:4000` / `:8080`) with zero cloud egress.
  - Added `Satchida-Gateway` endpoint to `fileConfig.endpoints` with file limits and MIME types matching `Satchida` to support image and file attachments on proxy-routed chats.
- **Client Execution Selector Sync (`client/src/components/Chat/Input/SatchiModeSelector.tsx`):**
  - Updated `handleSelectMode` to synchronize `endpoint` on the active conversation (`(mode === 'Privacy' ? 'Satchida' : 'Satchida-Gateway') as EModelEndpoint`), ensuring immediate submission switches to the Satchida Gateway gateway or local model accordingly.
- **Verification:**
  - TypeScript typecheck: `npx tsc --noEmit` in `client` passed cleanly (**0 errors**).
  - Unit tests: `SatchiToolbar.spec.tsx` passed (**11/11 passed**).
  - Live Satchida Gateway gateway connectivity verified against `http://127.0.0.1:8700/v1/chat/completions` with tenant virtual key.

## 2026-10-07 — Satchida Chat Toolbar, Execution Selectors & Upload Fix Verification

- **Satchida Chat Toolbar & Selectors (`todo.md` §B3):**
  - Created Jotai storage atoms (`satchiStyleAtom`, `satchiModeAtom`, `satchiWebSearchAtom`, `satchiThinkAtom`, `satchiResearchAtom`, `satchiImageGenAtom`) in `client/src/store/satchiStore.ts` per `AGENTS.md` Jotai migration rules.
  - Ported 8-archetype multi-vector prompt expander `heuristicEnhance` in `satchiStore.ts` (SHTF/disaster, RBI banking, legal/Supreme Court, frontier AI VRAM sizing, precious metals/crypto, fuel/LPG, geoscience, and multi-point structured prompts).
  - Created `useSatchiExtraBody` hook in `client/src/hooks/useSatchiExtraBody.ts` exporting `extraBody` parameters and active style prompt directives.
  - Built `SatchiStyleSelector.tsx` (Direct | Plan | Build segmented control) and `SatchiModeSelector.tsx` (Chat | Work | Study | Privacy pills with emerald privacy shield).
  - Built `SatchiToolbar.tsx` with Globe, Think, Wand, Research, and Image quick-actions, styled with semantic tokens, active glow states, and TooltipAnchor hints.
  - Mounted controls in `client/src/components/Chat/Input/ChatForm.tsx` and wired `stylePromptPrefix` into `submitComposerText` so `Plan` and `Build` directives are automatically injected upon submission.
  - Added localized strings in `client/src/locales/en/translation.json`.
- **File Upload 500 Bug Resolution (`todo.md` §C1):**
  - Fixed unhandled validation errors (missing `file_id`, `agent_id`, empty file) throwing 500 without logs in `api/server/routes/files/files.js` and `api/server/services/Files/process.js`.
  - Added `USER_FACING_UPLOAD_ERRORS` patterns in `packages/api/src/utils/files.ts` and sanitized stack logging with `getSafeErrorText(error)`.
- **Testing & Verification:**
  - Client unit tests: `client/src/components/Chat/Input/__tests__/SatchiToolbar.spec.tsx` (**11/11 passed**).
  - Backend files unit tests: `packages/api/src/utils/files.spec.ts` (**78/78 passed**).
  - Client submission unit tests: `client/src/components/Chat/Input/__tests__/submit.spec.ts` (**4/4 passed**).
  - TypeScript typechecks: `npx tsc --noEmit` in `packages/api` (**0 errors**) and `client` (**0 errors**).
  - Production build: `npm run build:client` completed successfully (**exit 0**).
  - Live llama-server inference: Verified against `http://127.0.0.1:8080` loaded with `Qwen2.5-Omni-7B-Q4_K_M` across Direct (916ms), Plan (2956ms), Build (3017ms), and Wand Enhanced (3194ms) completions.

## 2026-10-06 — Tenant entitlement and seat-reservation foundation

- Added a tenant entitlement schema/model/type/method foundation with tenant isolation and a unique `tenantId` index. The internal tenant record maps tenant-local opaque subject keys to account types; operator-facing methods return only seat counts and account allocations, never those subject keys. Seat reserve/release operations are subject-keyed and idempotent, and use conditional updates against capacity.
- Added pure data-provider validation/decisions: account allocations and seat limits are explicit; Privacy is eligible only for Pro, Pro Family, and Enterprise and is removed if the local model is unhealthy (never cloud-fallback); child requests block unless a caller supplies a safety-ready assertion. Family starts at an editable 4-seat value. Prices, mode defaults, and the Satchida-Master tenant's plan access are not inferred.
- Fixed the existing `TenantPolicy` model missing `applyTenantIsolation`, found by the tenant-isolation coverage test.
- Verification: provider `tsc --noEmit` and tests pass (17/17); data-schemas `tsc --noEmit` and entitlement/model/isolation/seat tests pass (11/11); builds for data-provider and data-schemas pass; touched persistence sources pass ESLint and Prettier. The MongoMemoryServer checksum warning appears during the schemas Jest prewarm but these DB-free tests pass; Mongo-backed integration tests remain blocked by that checksum issue.
- This slice is only the entitlement data/policy foundation. No tenant entitlement records were created; operator entitlement routes, tenant user provisioning/deletion, audit-integrated account assignment, usage API/UI, and live browser verification remain pending. Satchida Gateway/tunnel configuration and PM2 restart were not touched.

## 2026-10-03 — Architecture decisions (pre-build)

### Decisions taken

| #   | Decision                                                                                    | Rationale                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Do not ship `admin-panel`**                                                               | AGPL-3.0 network-use source disclosure. LibreChat's own `packages/api/src/admin/*` already serves the same APIs.                                                               |
| 2   | **Hybrid tenancy** — shared multi-tenant, dedicated instance for Enterprise                 | Matches the plan ladder; strongest isolation where it matters commercially                                                                                                     |
| 3   | **Manual UPI now, Razorpay last**                                                           | No Razorpay account; code is untestable without keys. Provider interface built now, gateway activated after all build and test                                                 |
| 4   | **PWA + Capacitor now, full native Android later**                                          | Same codebase, instant updates, no store review                                                                                                                                |
| 5   | **Brand via the existing SCode pipeline**                                                   | `generate-brand-assets.ps1` already solved the opaque-white-plate → black-plate alpha trap; reuse it rather than reinvent                                                      |
| 6   | **Single 16 GB GPU; local Qwen3-VL-4B**                                                     | ~8 concurrent streams; 1,000 subscribers at a 2–4% peak                                                                                                                        |
| 7   | **Free-first, paid-overflow cloud policy**                                                  | Free tiers are rate-limited; paid overflow must be metered or margin is unbounded                                                                                              |
| 8   | **BYOK as a priced entitlement** (Pro/Family/Enterprise)                                    | BYOK removes compute load rather than adding it. Charged as part of the bundle, not per token                                                                                  |
| 9   | **"I am Satchida, an AI assistant built by Satchida"**                                      | No fine-tune exists; "finetuned" would be untrue to paying customers. Held as a config value                                                                                   |
| 10  | **Fork + long-lived `satchida` branch**                                                     | Upstream updates rebased deliberately; a bad merge is never live until a release is cut                                                                                        |
| 11  | **Privacy tier at ₹990/month, capacity-limited not token-limited**                          | Highest-margin tier (COGS ≈ 0); scarce resource is GPU slots                                                                                                                   |
| 12  | **Privacy mode = local only at launch**                                                     | A cloud variant cannot honestly be called Privacy while ZDR is approval-gated and abuse logs run 30 days. Split into a separate gated mode later, with its own name and notice |
| 13  | **Multi-bot free-route recovery**                                                           | Re-executes the turn from its beginning, so no side effect carries over from the failed attempt                                                                                |
| 14  | **Mode named `Privacy`, described as "Processed only on infrastructure Satchida operates"** | "Anonymous" over-claims — we hold the credentials and are always an identifiable party                                                                                         |
| 15  | **No-provider-marketing rule made binding**                                                 | Compliance, not branding. Keeps us inside the provider terms that permit wrapping (§A.1) rather than restricting a competing product (§D.4)                                    |
| 16  | **Master logo: `D:\LAN-AI-Infra\Satchida\Satchida-logo.png`**                               | Confirmed. Treated as the opaque-white-plate master; reuse the SCode generator and its alpha-term guard rather than writing a new one                                          |

### Research findings that changed the plan

- **OpenRouter's ToS prohibits both resale and multi-account quota circumvention** by name,
  with §5.7 making circumvention a terminable material breach. This removed the
  aggregator-as-backbone design. See `INFERENCE.md` §2.2 and `Bugs.md` §B7.
  - **Corrected on second review:** the scope was wrong, not the business model. Anthropic
    Commercial Terms §A.1 explicitly permits powering products for our own end users, and **no
    direct provider carries a reseller restriction**. The real constraint is aggregator-specific
    ("developing a competing service"), plus Anthropic §D.4's competing-product clause. No
    reseller agreement is needed. The model-hiding design is what keeps us clear of §D.4.
  - **Also corrected:** the multi-account clause does not apply to a single personal key per
    provider. An earlier draft left it attached to the current plan; it was flagged because
    multiple accounts had been proposed earlier, not because they describe what we do.
- **OpenAI ZDR is approval-gated**, not self-serve; default abuse-monitoring logs run up to
  30 days and may contain prompts. Privacy (Cloud) therefore cannot ship at launch with a
  non-retention claim. `Bugs.md` §B8.
- **OpenRouter's FAQ and Privacy Policy contradict each other** on prompt logging — "zero
  logging" versus "will also be collected". Not usable as a contractual guarantee. `Bugs.md` §B9.
- **Free models allow 50 RPD without credits, 1,000 RPD with ≥ $10** — the entire free budget
  is ~1 request per subscriber per day, shared with recovery traffic. `Bugs.md` §B10.
- **SearXNG is unusable** — upstream engines return CAPTCHA (operator-reported). Abandoned as
  the Privacy-mode search path. `Bugs.md` §B6.
- **LibreChat has no provider failover**, confirmed at
  `packages/api/src/endpoints/config/providers.ts:40`.
- **LibreChat does support local OpenAI-compatible endpoints** — Ollama is an explicit,
  tested case (`app/config.test.ts:384`), so vLLM takes the same path.
- **Per-user provider keys are native** — `userProvide` on endpoint config plus the
  `user_provided` sentinel, resolved per request via `db.getUserKey()`
  (`endpoints/anthropic/initialize.ts:53`).

### Git

`origin` renamed to **`upstream`** so `origin` is free for our fork. Not yet created — needs
your fork URL.

### Documentation created

- `ARCHITECTURE.md`, `PRICING.md`, `INFERENCE.md`, `Implementation-plan.md`,
  `Customizations.md`, `Changes.md`, `Bugs.md`, `UPSTREAM-UPDATE-PROCEDURE.md`
- Satchida sections appended to the existing `AGENTS.md` and `CONTEXT.md`

---

## 2026-10-03 — Phase 0 (audit)

**Repository cloned** into `D:\LAN-AI-Infra\LibreChat`.

- Source: `https://github.com/LibreChat-AI/LibreChat.git`
- Checked out `main` at `f10b1d91` — "📦 ci: Remove Legacy GHCR Mirror (#16585)", 2026-09-30
- 5,617 tracked files
- Clone is **shallow** (`--depth=1`); pre-existing untracked `.v2c/` was preserved

A plain `git clone .` was rejected because `.v2c/` made the target non-empty. Worked around by
`git init` + `git remote add origin` + `git fetch --depth=1` + `git checkout main`, which
leaves the untracked folder untouched.

> Not yet a fork: `origin` points at upstream. Phase 0 must create the fork remote and a
> `satchida/` branch off `dev` before any code is written.

### Integration audit completed

Findings recorded in `ARCHITECTURE.md` §1.

| Repository              | Finding                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `rag-api`               | Already integrated — `rag_api` service in both compose files, `RAG_API_URL`, `rag.yml` |
| `admin-panel`           | Wired in compose but **AGPL-3.0**; decided against shipping                            |
| `code-interpreter`      | Reached over HTTP via `CODE_API_KEY`; **no compose service exists**                    |
| `agents`                | Not a service — npm package `@librechat/agents@^4.0.1`, already a dependency           |
| `quickbooks-online-mcp` | Zero references; is an MCP registration, not a code change                             |
| `static-browser-server` | Obsolete — last pushed 2025-04-10, zero source references                              |

Key discoveries that shaped the plan:

- `packages/data-schemas/src/schema/balance.ts` already implements `tokenCredits`,
  `autoRefillEnabled`, `refillIntervalValue`, `refillIntervalUnit`; `REFILL_INTERVAL_UNITS`
  already covers `days` / `weeks` / `months`. The requested quota model exists.
- `packages/data-provider/src/permissions.ts` `PermissionTypes` already covers agents, code,
  web search, MCP, memories, file search, marketplace. The requested feature matrix exists.
- Google OAuth is config-only (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `googleId`,
  `packages/api/src/auth/googleRefresh.ts`).
- Neither LibreChat's native admin nor admin-panel has any awareness of balance, credits,
  plan, subscription, payment, invoice, usage, or quota — the reconciliation console must be
  built regardless of the admin-panel decision.
- No payment gateway of any kind exists in the tree.
- No `manifest.json` and no native Android project; only `logo.svg` and two favicons.

### Documentation created

- `ARCHITECTURE.md`
- `Implementation-plan.md`
- `Customizations.md`
- `Changes.md` (this file)
- `Bugs.md`
- Satchida sections appended to the existing `AGENTS.md` and `CONTEXT.md`

Upstream `AGENTS.md` and `CONTEXT.md` were **appended to, not overwritten** — they carry
LibreChat's own contributor and domain-language contracts, and destroying them would break
the contribution workflow.

<!-- 20261004 -->

## 2026-10-04

- Docs moved to Cloudflare Tunnel architecture (satchida.com); originals merged back, new content as Part II/III. Backup: docs-backup-20261004-003325.
- Fixed Turnstile config, added TRUST_PROXY, registration off by default, softened capacity claims.

## 2026-10-05 — Overnight implementation continuation

- Added Satchida semantic dark/light theme tokens, animation-safe splash assets, PWA icons/manifest branding, and rebuilt the local client. Live `/` and branded asset URLs were verified after restarting only the build-stage LibreChat process. Theme setting is persisted as `satchida-dark`.
- Added licensed `/v1/audio/transcriptions` forwarding in the fleet gateway with mocked regression coverage. A real synthesized phrase was transcribed twice: first through the existing gateway (after switching from an unsupported `whisper-1` alias to the advertised `Qwen2.5-Omni-7B-Q4_K_M` ID), and then through a temporary ephemeral loopback server instantiated from the edited `fleet/src/gateway.mjs`. Both returned HTTP 200 and "The quick brown fox jumps over the lazy dog." No long-running gateway or llama-server process was restarted or modified.
- Updated the overnight plan with missing dashboard/model-admin scope, safe family privacy gates, live build/install gates, and service safety requirements.
- Began the family persistence contract: optional guardian/family metadata, daily limits, separate guardian-processing, transcript-view and image-generation consent version records; all nullable/default-off for pre-existing users. Public `TUser` exposes only `familyRole`; generic user and auth/refresh responses strip family linkage, limits, and consent internals. Schema tests pass 6/6; auth/user-response tests pass 84/84; data-schemas/data-provider/API builds and TS checks were run successfully.
- Family routes/UI, control service/dashboard, paid-account pool integration, and heartbeat sync remain unimplemented; see `satchida-overnight-plan.md` D11–D14 and OVERNIGHT-LOG.

## 2026-10-05 — Operator console landing page and theme

- Built `fleet/src/dashboard/` as the standalone Tier-1 operator console SPA listed as pending in `satchida-dashboard-design.md`. It is its own Vite/React/TypeScript build root with its own `package.json`, isolated from the LibreChat monorepo workspaces, per the handover rule that the dashboard is served from the control service and never from LibreChat `:3080`.
- Delivered the §1A Fleet Dashboard landing page: global health bar, tenant table with all specified columns, status/plan/expiry/search filters, and per-row actions. Loading, empty, no-matches and error states are all real, not placeholders.
- Rebuilt the visual layer the previous pass left flat. The old theme was a static CSS gradient stack with one conic sweep, which is why no motion or depth was visible. It is now a three-layer 3D scene: a perspective-projected particle field rendered directly on Canvas2D (yaw/pitch camera, focal-length projection, depth sort, distance fog), four CSS-3D aurora masses at differing Z that hue-rotate continuously for sustained colour fading, and a masked perspective grid floor that gives the parallax a fixed reference.
- Every colour, depth and motion value resolves through `styles/tokens.css`. No literal colour below the token layer.
- `prefers-reduced-motion` renders one composed still frame with fixed hue offsets rather than collapsing the theme to a flat fill.
- Light appearance initially rendered the masthead title near-white on a near-white field. Caught by visual review, fixed by re-pointing the title gradient at the dark end of the ramp; the light aurora was also raised from 0.5 to 0.82 alpha because it read as an unstyled wash.
- Tests: `npm test` 10/10 on filter rules and formatters. Writing them exposed that the formatters read `Date.now()` internally, so heartbeat ages and licence countdowns froze at first render and a node going stale would keep reporting healthy. The clock is now injected through a `useNow` hook ticking every 30s.
- Verified in a real browser via Playwright at 1600x1000 in both appearances: 8 rows, 4 tiles, 8 badges, 8 seat meters, 4 filters, 16 row actions rendered; zero console errors; aurora colour-fade confirmed running by sampling computed opacity/filter across time; particle field confirmed repainting by sampling its canvas signature across time; reduced-motion confirmed static.
- Demo data is opt-in via `VITE_CONSOLE_DEMO=1` and is labelled "Demo data" in the UI. No fleet number on screen is real. The typed client targets `GET /api/v1/fleet/overview`, which the not-yet-built control service will serve.
- No operator service was touched: `:3080`/`:4000`/`:8010`/`:8080`/`:8091` re-checked unchanged after the work, `:8443` still closed. Nothing committed or staged.

## 2026-10-05 — Landing page theme: the field was never actually visible

The operator reported the Satchida landing page looked unchanged — stock black login with a green
button. It was. Three separate defects, all confirmed against the live server rather than read off
the source.

**1. The brand field was painted underneath an opaque surface.** The previous treatment put the
gradient on `#root::before` at `z-index: -1` and pinned every `#root` child to `z-index: 0`. The
first child is the auth shell's own `bg-surface-primary` with `min-h-screen` — opaque, full
viewport — so it covered the field completely. The gradient was live in the DOM the whole time and
never once rendered. Proven by forcing the pseudo-element to solid red: it filled the screen, so
the layer worked and was simply buried. The field now lives on `body::before` at `z-index: 0`,
`#root` sits at `z-index: 1`, and the auth shell drops its opaque fill.

**2. The primary button stayed LibreChat green.** `satchida.ts` spread `...darkTheme` and overrode
~40 tokens but never named `rgb-surface-submit`, which the bundled palette sets to green-700. The
login CTA uses `bg-surface-submit`, so it rendered `rgb(4,120,87)` no matter what else the theme
repainted. Measured `4 120 87` before, `37 99 235` after.

**3. Light mode had no wordmark.** `AuthLayout` requested `satchida-splash-wordmark-light.png`;
the asset is the unsuffixed `satchida-splash-wordmark.png`, so light mode 404'd and the logo
vanished. Now `-dark` only in dark.

**Added:** a genuine depth field (`client/src/components/Satchida/Atmosphere.tsx`) — points held in
3D, camera yaw/pitch on pointer, focal-length projection, depth sort, distance fog, colours read
from the resolved `--series-*` scale so it follows the theme with no second palette. Plus colour
fading via bounded hue rotation and background drift on `body::before`, and a glass auth card.

Hue rotation is deliberately bounded to ±16°. A full 360° rotation produces constant colour change
but walks the whole wheel, turning the field green and amber for part of every cycle — colours that
are not in the brand ramp at all.

Verified live on `:3080` in both appearances at 1600x1000: `data-theme=satchida`, submit token
`37 99 235`, auth shell and `#root` transparent, field animations running, hue-rotate advancing
-12.8deg to -9.8deg between samples, depth field painting and repainting, zero console errors.
`prefers-reduced-motion` renders one composed static frame with the canvas confirmed still.

Frontend rebuilt and the LibreChat process on `:3080` restarted twice so the cached `index.html`
picked up each build — the backend holds it in memory, so a restart is required after any client
build. Other services (`:4000`, `:8010`, `:8080`, `:8091`) untouched. Nothing committed or staged.

## 2026-10-05 — Marketing landing page replaces the sign-in-first layout

`/login` is where every unauthenticated visitor lands (`buildLoginRedirectUrl` sends `/` there), so
that route now doubles as the marketing page. The sign-in form is one click away behind a corner
button, and `?signin=1` opens it directly for bookmarked links — no routing change, so no way to
break auth.

**Landing content**, built from the architecture rather than from adjectives:

- _The problem_ — what a hosted provider accumulates about a person, including the credential
  exposure path where API keys and secrets surface in prompts and get echoed into chat and logs.
- _The architecture_ — an animated diagram of the request path with a drawn boundary between the
  tenant node and the operator router, labelled "Identity does not cross". This is the page's one
  load-bearing claim, so it gets the diagram.
- _Three independent properties_ — non-retention, unlinkability, locality.
- _Guardrails for the youngest users_ — input moderation / model / output moderation on client
  hardware, ShieldGemma 2B and Llama Guard, Guardrails AI rulesets, DNS backstop, visible
  parental supervision. Framed against POCSO 2012 and DPDP Act 2023 s.9.

**Copy constraint, deliberate.** `SOLUTIONS.md §B1` records a hard "never claim you are anonymous":
Satchida is always an identifiable party to its own client. The page claims **unlinkability** — the
end user's identity is never disclosed to any model provider — which is both true and stronger in a
due-diligence conversation. Billing is stated as running between Satchida and the _organisation_,
covering the school, RWA and SMB cases: end users never transact with us and we hold no payment
instrument, identity document or contact detail for them.

**Three bugs found by full-page visual review, not by the DOM probe:**

1. Section headings and list items rendered near-black on a near-black field — the page inherits
   colour from `#root`, not `body`, so nothing inherited a usable colour. Every text element now
   names its token explicitly.
2. The architecture diagram put its fourth stage on a second row. Cause was an unstyled
   `arch__rail` element sitting in the flow as an eighth grid item; `minmax(0, 1fr)` was also
   needed because plain `1fr` is `minmax(auto, 1fr)` and refuses to shrink below the stage's text.
3. The background field stopped at the fold. The aurora is `position: fixed` and only covers the
   viewport, so a 4000px page fell to a flat fill. `body` now carries a document-height gradient
   underneath it.

Also removed: a Canvas2D particle field added earlier this session. Against a near-black field it
read as dust rather than depth, and an unstyled `<canvas>` is a large in-flow block — when its
stylesheet had not applied it blew the layout apart.

Verified live on `:3080` in both appearances at 1600x1000: mandala 488px with the 3D tilt running,
4 architecture stages with the boundary label, 5 exposure items, 6 facts, 3 property cards, 6
guardrail checks, no horizontal overflow, sign-in still reveals a working form with a password
field, zero console errors.

## 2026-10-05 — Landing cut to one screen, mandala centred

The four-section scroll page (4000px) was replaced by a single screen: pitch rail, mandala, pitch
rail, with the headline strap beneath and sign-in in the corner. The argument now reads as
problem-left against solution-right with the brand holding the middle, instead of six sections the
visitor had to scroll through.

**Mandala.** 422px, verified 2px off the viewport centre line. The 3D is two discs at different
depth counter-rotating against each other (`translateZ(-70px)` conic halo behind, 18s tilt in front,
34s counter-spin on the halo) rather than one plane wobbling. Two opposed planes is what makes the
tilt read as volume. The earlier build drifted off-axis because its `rotateY` range was asymmetric
(-8deg to +9deg); the range is symmetric now so the disc never walks off the centre line.

**Graphics beside the pitch.** Six hand-drawn stroke marks (`client/src/components/Landing/Icons.tsx`)
— a struck profile, a retention log, an escaping key on the exposure side; a tenant boundary, a
many-to-one aggregation, a struck receipt on the protection side. Each carries one idea; the text
carries the argument.

**Four defects caught on visual review:**

1. Icons were invisible — the theme's `destructive` and `status-success-strong` stops are dark
   enough to vanish against a card. The marks now carry a tuned pair per appearance
   (`--landing-risk` / `--landing-safe`) rather than borrowing destructive/semantic colours.
2. Page was 52px over one screen: `min-height: 100vh` on the main plus the footer below it. The
   shell now owns the height and the main flexes into it.
3. The sweep was a rounded square around a circular mark and read as a stray bracket. It is now
   circular and dimmer.
4. The headline wrapped to two lines; hero measure widened and size reduced.

Superseded and removed: `MarketingSections.tsx` and `ArchitectureDiagram.tsx` from the previous
pass, along with the exposure/architecture/properties/guardrails section CSS.

Verified live on `:3080` in both appearances at 1600x1000: pageHeight 1000 against viewport 1000,
mandala centred, 2 rails / 6 items / 6 icons, both mandala animations running, no horizontal
overflow, sign-in still reveals a working password field, zero console errors.

## 2026-10-06 — Operator-only administration and tenant privilege boundaries

- Added direct-user `operator:control`, excluded it from role grants, and reconciled the configured
  operator to a platform capability set. Startup also removes legacy platform-scoped grants from the
  blanket `ADMIN` role, preserving tenant-scoped grants. Verified the configured master user has a
  direct operator grant; no role/group operator grant exists.
- Gated admin API surfaces, role permission mutation routes, code-environment registration, and
  token-config metadata behind operator access. Tenant users retain semantic mode config only.
- Removed role-name-only ADMIN bypasses from agent ACL mutation, people-picker, Insights agent
  visibility, and multi-conversation agent ACL checks. These paths now rely on explicit role grants
  and per-resource ACLs.
- Verification: `packages/api` and `packages/data-schemas` `npx tsc --noEmit` pass; focused API
  tests pass 145/145; route tests pass 88/88; ESLint passes aside from one stale test helper warning
  being removed. Mongo-backed tests are blocked by the cached MongoMemoryServer MD5 mismatch; cache
  was not altered. Live app remains on `:3080`; no restart was performed.
- Child safety audit: automatic memory extraction remains disabled; no PII filter patterns or
  local moderation are configured, and no universal child moderation or image path enforcement
  exists. `CHILDREN-SAFETY.md` now labels these accurately as not implemented/verified. No Satchida Gateway,
  tunnel, RAG corpus, or Acts files were changed.

## 2026-10-05 — Mandala callouts fly out of the petals

Replaced the left/right text boxes with eight tags arranged around the mandala. Each tag is matched
to the petal that **already carries the same words** — the artwork is a fixed raster and was not
redrawn or overdrawn, so nothing sits on top of it. Anchors were read off the 800x690 artwork by
cropping and upscaling it, then expressed as a percentage of the mandala box so they track it at any
size.

**No connector lines.** An earlier pass drew dotted leaders from petal to tag; that read as a
diagram, not as graphics, and was removed. The flight is the connection: a tag starts on its petal,
travels out, and settles into the ring — the same idea as the light running the rim, without a
leader drawn over the brand.

**Three real bugs, all found by measuring rather than by looking:**

1. **Tags rendered raw translation keys** (`com_callout_local_first`). The component printed
   `petal.label` instead of `localize(petal.label)`.
2. **Chips were placed half off-target.** `left`/`top` carried the chip's _centre_ but no
   `translate(-50%, -50%)` was applied, so every chip sat offset by half its size — which is what
   made them look like they were lying on the artwork.
3. **The page was 1000px wide inside a 1600px viewport.** `.landing-main` is a column flex item with
   `margin-inline: auto`, which makes it shrink-to-fit rather than stretch. The mark was starved of
   the room its callouts need and 300px sat empty on each side. `width: 100%` fixes it; that one
   line is why the ring engages at all.

Also fixed: the tag ring was oscillating between laid-out and wrapped mode, because wrapped tags
are in flow and widened the stage, which made room for the ring, which took them out of flow again.
Placement is now anchored to the **disc's** measured edges with a fixed clearance, so a tag can never
overlap the artwork at any window size.

Copy: each tag restates its petal. "Identity never leaves" replaces the operator's "users stay
anonymous" — anonymity is not claimable per SOLUTIONS.md §B1; this says the same thing as
unlinkability, which is.

Verified live on `:3080` at 1600x1000, 1100x900 and 414x896: 8 tags, 0 connector paths, 0 tags
overlapping the artwork, no raw keys, ring mode on desktop and narrow, wrapped on mobile, no
horizontal overflow, zero console errors.

---

## 2026-10-05 — Extensions populated, RAG completed, chat defect found

### Added

- `skill/` — 10 new Satchida skills (6 authored, 4 from the local download) plus 10 from
  `zai-org/ZCode` (`agent-browser`, `ai-elements`, `architecture-governance`, `dep-refs`,
  `dogfood`, `electron`, `feature-boundary-planner`, `vercel-react-best-practices`,
  `control-browser`, `web-gui-tester`). **20 total.** ZCode is Apache-2.0.
- `plugin/satchida-guardrails/` — 3 command hooks + `hooks.json`. 63/63 tests.
- `plugin/satchida-mcp/` — 5 MCP servers: filesystem, memory, sequential-thinking,
  playwright, context7.
- `packages/data-provider/src/tenant-policy.ts` — per-tenant enable/disable for skills,
  MCP and agents. 18/18 tests. **Not yet wired to any read path.**
- `rag-service/` — completed from stub: `chunk.mjs`, `embed.mjs` (Ollama +
  OpenAI-compatible), `vectorstore.mjs` (node:sqlite), `routes.mjs`, `start.mjs`,
  `test/retrieval.test.mjs` (19 tests).

### Scripts (all idempotent)

`scripts/seed-satchida-agents.mjs`, `scripts/convert-local-agent-pack.mjs`,
`scripts/convert-opencode-agents.mjs`, `scripts/provision-master-tenant.mjs`.

### Changed

- `librechat.yaml` — `interface.marketplace.use: true`; `agents`/`skills` create+share;
  `memories: true`; added a `memory:` block with `agent.enabled: true` so extraction runs.
- `.env` — deployment plugin/skill dirs, `DEPLOYMENT_PLUGIN_HOOKS=true`, and a full
  `RAG_*` block pointing at local Ollama with `all-minilm:l6-v2`.
- Data: 45 agents, 10 skills documents, new `satchida-master` tenant.

### Fixed during the session

- Two RAG wire-contract violations that made LibreChat silently fall back to native file
  parsing: `/text` now returns `text`, `/query` returns `[[hit, score], ...]`.
- RAG sentence splitter broke on `e.g.` / `3.14`; long unpunctuated runs never split;
  re-ingest used `indexOf` and could drop chunks. All covered by tests.

### Deliberately not done

- `sovereign-rag-platform` **not merged** — 14.3% (Phase 0), `:3020` down, proprietary.
- No second llama-server. `:8080` (21 models) and `:8091` untouched throughout.
- `anthropics/skills` `docx`/`pdf`/`pptx`/`xlsx` **not shipped** — proprietary,
  no-redistribution terms.

### Open defect

Chat returns `400 model 'Chat' not found`. See `Bugs.md` B8.

## 2026-10-05 — Tag ring follows the mandala curve; slim white lines restored

Tags are now placed at each petal's own **angle** on a circle concentric with the mark, so the ring
follows the curve of the mandala instead of reading as two flat columns. Each is joined to its petal
by a slim white line carrying a travelling highlight — the same visual language as the light that
circles the rim — and the line and the chip share one cycle, so the line runs out from the petal as
the chip is born.

**Bugs fixed, each found by measuring rather than by eye:**

- Chips were placed from `getBoundingClientRect` on a disc that is **mid-rotation** under the 3D
  tilt, so its rect is inflated and moves every frame. Placement now uses the stable layout box
  (`offsetWidth`/`offsetHeight`), which is what the tilt should never have influenced.
- Chips measured clearance from the frame, but the **halo** sits outside it at `inset: -9%`, so a
  chip clear of the frame was still inside the glow. Clearance now includes the halo's extent.
- The artwork is a petal rosette whose top and bottom **tips reach past the square frame**, so chips
  placed straight up or down clipped it. Those now take an extra vertical allowance, and the stage
  height accounts for it — omitting that term is what clipped the top tags off-canvas.
- The stage now derives its own height from the ring's geometry instead of relying on an eyeballed
  `min-height`, which had been silently dropping the whole layout into the stacked fallback.
- A correction pass pushes any still-overlapping chip straight out along its own ray, so the
  artwork is protected even if the geometry is re-tuned later.

Verified live on `:3080`: 8 tags, 8 lines, **0 chips overlapping the artwork**, zero console
errors.

**Known remaining:** the ring needs roughly 700px of height, so the mark was scaled to ~250px to
keep the page near one screen. That leaves a large gap between the ring and the wordmark, and the
mandala reads smaller than it should. A full 360° ring with legible labels and a large mark does not
fit a 1000px viewport; resolving that properly means either a taller page or fewer, larger tags.

## 2026-10-25 — Extended Ecosystem Evaluation (Work & Study Modes)

Documented Section 20 in `ARCHITECTURE.md` evaluating candidate open-source repositories for integration with LibreChat as MCP servers, composer actions, or left navigation sub-applications:
- Evaluated repos: `techwatch4all-bit/ppt-master`, `kuafuai/andee`, `immich-app/immich`, `nextcloud/server`, `techwatch4all-bit/designcraft`.
- Added supplemental OSS recommendations for Study Mode (`anki` / `fsrs4anki`, `onemnemo/mnemo`, `zotero`, `excalidraw`) and Work Mode (`paperless-ngx`, `nocodb` / `grist-core`, `penpot`, `marktext` / `hedgedoc`).
- Established evaluation criteria under the Satchida Distributed Multi-Tenant Architecture Rules (bare-metal Windows runtime, Cloudflare Named Tunnels, physical tenant data isolation, JWT authentication reverse-proxying).

## 2026-11-07 — Architecture Note: Same-Tenant Collaboration & OSS License Governance

Added Section 20.4 to `ARCHITECTURE.md`:
- **Collaboration Audit Requirement**: Precludes premature integration of multi-user sub-apps (`excalidraw`, `penpot`, `nextcloud`, `onemnemo`, `anki`/`fsrs4anki`) until LibreChat's same-tenant inter-user communication and sharing capabilities are verified.
- **License Policy Restriction**: Strict mandate restricting prospective OSS tools to permissive licenses (MIT / Apache-2.0 / BSD) to avoid copyleft (AGPLv3/GPLv3) compliance liabilities.
- Action deferred to focus exclusively on upstream safe merge in a dedicated release folder.

## 2026-11-07 — Selective Upstream Sync: Database Indices & Model Pricing

Adopted verified upstream improvements tested in `D:\LAN-AI-Infra\release\LibreChat-upstream-sync`:
- **Database Query Indices (`4c710a38f` / Upstream `#17464`)**:
  - `messageSchema`: Added `{ conversationId: 1, user: 1, updatedAt: 1, _id: 1 }` to optimize cursor-paginated reads by `updatedAt`.
  - `sessionSchema`: Added `{ refreshTokenHash: 1 }` index to eliminate collection scans on user-less session deletions.
  - `toolCallSchema`: Added `{ user: 1 }` index to optimize account cleanup and bulk tool-call deletions.
  - `queuedTurnSchema`: Added partial indexes for `deliveryKey` and `reconciliationClaimId` to accelerate worker claim reconciliations.
  - `agentSchema`: Added partial indexes for `code_environment_id` and `code_environment_ids` to speed up reference integrity checks.
- **Model Valuation Pricing (`da50260ed` / Upstream `#17028`)**:
  - Updated `packages/data-schemas/src/methods/tx.ts` to include official rates for `mistral-large-4` ($1.36 prompt / $4.18 completion), `mistral-large-3`, `mistral-large-2411`, and `mistral-large-2512`.
- **Build Verification**:
  - Full end-to-end multi-workspace compilation clean (`packages/data-provider`, `packages/data-schemas`, `packages/api`, and `client`).


## 2026-11-07 — Commercial Audit: Multi-Tenant Telemetry, Cache-Aware Billing, and Bifrost Synchronization

Executed a comprehensive commercial readiness audit across LibreChat, One-API, and Bifrost OSS Gateway:
- **Human Identity Resolution**: Fixed issue where relay logs displayed `"root"` or raw 24-character hexadecimal MongoDB ObjectIds (`6ac20760b98d248028c7371d`). LibreChat now forwards `X-User-Name`, `X-Seat-Alias`, and `X-Tenant-Id` across all `:4000`, `:4099`, and `:8700` routes; One-API validates and formats usernames reliably.
- **Cache-Aware Billable Token Accounting**: Resolved issue where 175k tokens from an 8-turn agentic search loop triggered false burst limit exhaustion. Implemented 90% discount on KV cached prompt tokens in One-API rolling window buckets and re-calibrated Pro tier limits to 500k (3h) and 2.5M (24h).
- **Automated Bifrost Multi-Tenant Lifecycle**: Added `model/bifrost_sync.go` with real-time hooks on `CreateTenant`, `UpdateTenant`, and `DeleteTenant`, plus a boot reconciliation loop on startup. Reconciled 100% of active tenants into Bifrost's `governance_customers` and mapped 806 historical log rows in `logs.db`.
- **Per-Tenant Analytics & Navigation**: Resolved `undefined` tenant ID binding in `Tenant/index.js` and `TenantUsageDrawer.js`. Scoped donut provider charts, model matrices, and cost reconciliation tables dynamically to individual tenants.
- **Offline Billing Statement & CSV Export**: Created `TenantInvoiceDialog.js` with formal invoice layout, telemetry audits, gross margin tracking against landed FX rates, and print-to-PDF support (`window.print()`). Added instant CSV download in `TenantUsageDrawer`.
- **Build & Verification**: Compiled Berry React frontend (`web/build/berry`) and native Go binary (`satchida-gateway.exe`). All services online under PM2 with zero mock/fake data.

## 2026-11-07 ? Production Engine Hardening: SQLite WAL Mode, Credit Reservation Clamping, NPCI UTR Validation & Log Pruning

Completed deep production hardening across the Satchida multi-tenant gateway ecosystem (`one-api` :4000, `bifrost` :8700):
- **SQLite Concurrency & WAL Activation**: Configured `_journal_mode=WAL&_busy_timeout=5000&_sync=NORMAL&_cache_size=-64000` in `model/main.go`. Eliminated SQLite lock contention under concurrent seat queries; verified `PRAGMA journal_mode` returns `wal`.
- **Credit Reservation Clamping (`max_tokens` Guard)**: Implemented server-side guard in `relay/controller/text.go` setting `max_tokens` to 4,096 for Chat mode and 8,192 for Work/Study modes when omitted by clients. Clamped flag triggers `adaptor.ConvertRequest` to ensure upstream providers (OpenRouter) do not reserve credit against 131k token context windows, preventing false HTTP 402 outages.
- **NPCI 12-Digit UTR Validation & Realtime FX Quota**: Hardened `controller/upi_billing.go` with strict regex validation (`^\d{12}$`), duplicate UTR idempotency checks, and dynamic quota conversion using `common.GetLandedRate()` (+5% buffer). Successfully tested invalid formats (HTTP 400), duplicates (HTTP 409), and valid instant crediting with `[AUDIT_STATUS:PENDING_OPERATOR_REVIEW]` tag.
- **Automated Log Retention & Pruning Daemon**: Added `StartLogRetentionDaemon` in `model/log.go` scheduled to prune consume logs older than 30 days while permanently preserving financial top-ups and operator audit logs, accompanied by SQLite incremental vacuuming.
- **Historical Seat Identity Backfill**: Mapped 24 historical log rows previously attributed to MongoDB hex ObjectID `6ac20760b98d248028c7371d` to human username `satchida-admin` and registered seat alias entries in `tenant_seat_aliases`.
- **Compilation & Verification**: Successfully recompiled native `satchida-gateway.exe`, deployed under PM2 process ID 7, and verified end-to-end streaming chat completions without errors.

## 2026-11-08 ? Dashboard Timescale Alignment: 24h Rolling Horizon & Local Timezone Grouping

Resolved operational confusion where top KPI cards reported "0 Today's Tokens" directly above "175.8k in 24 hours" and the 1-Day rolling quota gauge:
- **Root Cause**:
  1. Top metric cards previously queried calendar day `Today` strictly from `00:00:00` midnight. Immediately following midnight (e.g. 00:01 AM), "Today" reset to 0 while the 24-hour rolling window and the tenant portfolio table reflected active traffic (175.8k tokens from the trailing 24 hours).
  2. SQLite date grouping in `model/log.go` previously formatted timestamps using `datetime(created_at, 'unixepoch')` (UTC), causing morning hours in IST (+05:30) to bucket into the prior UTC date.
- **Remediation**:
  1. **SQLite Localtime Grouping**: Updated `model/log.go` to use `datetime(created_at, 'unixepoch', 'localtime')`, synchronizing SQLite daily buckets with the deployment host's timezone.
  2. **Harmonized 24h Rolling Default**: Updated `StatisticalLineChartCard.js` and `Dashboard/index.js` to calculate and display **24h Rolling Metrics** by default (e.g. `175.8k Tokens (Rolling)`, `26 Requests`, `$0.004 Consumption`), perfectly matching the `WindowQuotaCard` daily gauge and the `TenantPortfolio` 24h table.
  3. **Multi-Horizon Time Window Switcher**: Added an interactive `[24h Rolling] [Today] [7 Days]` segmented button selector to the dashboard header, empowering operators to toggle between the 24h rolling view, calendar day, and 7-day cumulative views with contextual secondary subtext (e.g. `Today: 0 ? 7d: 175.8k`).

## 2026-11-08 – Commercial Tier Harmonization, Auto-Backup Engine & Hybrid Privacy Architecture

1. **Commercial Tier Harmonization Across LibreChat, One-API & Bifrost**:
   - Unified 7 distinct commercial tiers: asic (free trial, 1 seat, Chat only, 500k tokens), standard (individual professional, 1 seat, Chat + Work, 2M tokens, ₹299/mo), amily (4 pooled seats [2 adults, 2 kids], Chat + Study + Work, POCSO child safety guardrails, 6M tokens pooled, ₹999/mo), pro (1 seat, Chat + Study + Work, full developer suite [VS Code Server Web, MCP, Agents, Code Execution], 15M tokens, ₹1,499/mo), pro_family (4 pooled seats, full Pro developer suite on adult seats, 25M tokens pooled, ₹2,499/mo), privacy (3 workstation seats, hybrid dual-engine, ₹3,499/mo), and enterprise (custom fleet, from ₹15,000/mo).
   - Added 'vscode_server' to TENANT_SEAT_CAPABILITIES in packages/data-schemas/src/types/entitlement.ts.
   - Seeded and synchronized all 7 tiers in one-api.db SQLite table license_tiers.

2. **Tenant Metrics Auto-Backup & Archive Management Engine**:
   - Added TenantMetricsArchive struct in model/analytics_tenant.go and schema auto-migration.
   - Captured full pre-reset snapshots (requests, tokens, landed INR COGS, mode breakdown, seat breakdown, raw log snapshot) before resetting metrics.
   - Dual-persistence to 	enant_metrics_archives table and physical disk at data/archives/tenant_{id}_archive_{timestamp}.json.
   - Exposed REST management endpoints for archive listing, download, and deletion, wired to TenantArchivesDialog.js in the Berry dashboard.

3. **Hybrid Architecture & COGS Realism for Sovereign Privacy Tier**:
   - **COGS (Cost of Goods Sold)** defined as direct variable upstream API provider charges (OpenAI, Anthropic, Google, DeepSeek) plus compute/network delivery costs.
   - Clarified dual-engine routing: In Privacy mode, queries run 100% locally on the customer's on-premises GPU (≥24GB VRAM), incurring ₹0.00 cloud COGS. In Chat, Study, Work, and Vibe Coding (VS Code Server Web, MCP tools, sandboxed execution), queries route through the Satchida Zero-Knowledge Relay to frontier cloud models, incurring standard cloud COGS (~.50–.00 / ₹445–₹495 landed/mo).
   - Real Gross Margin on Privacy tier: **~85.8% to 88.0%** (from ₹3,499 revenue vs ₹445.50 landed cloud COGS), rather than a fictional 99.9%.

4. **Executive Sales Decks**:
   - Authored SALES-PROPOSAL-FLAGSHIP.md: Anchoring on Pro (₹1,499/mo), Pro Family (₹2,499/mo), and Privacy Hybrid (₹3,499/mo).
   - Authored SALES-PROPOSAL-VALUE.md: Downsell negotiation deck featuring Standard (₹299/mo) and Family (₹999/mo for 4 pooled seats).

## 2026-11-08 – Surgical Architecture Verification & Runtime Entitlement Enforcement

Conducted full surgical verification of commercial tier alignment across LibreChat, One-API, and SQLite DB, identifying and resolving runtime entitlement and pooling gaps:
1. **Seat Pack Scope Pooling Fix (`seat_pack.go`)**:
   - `SeatPackScopeForAccountType()` previously only checked `"family"`, causing `pro_family` seats to each receive an isolated individual pack (`SeatSubscriptionScopeSeat`) rather than drawing from the unified household quota (`SeatSubscriptionScopeAccount`).
   - Extended condition to `if at == "family" || at == "pro_family"`, enabling full 4-seat pooled token draws for Pro Family tech households.
2. **Quota Window Rule Seeding (`tenant.go`)**:
   - `SeedDefaultWindowRules()` was missing explicit cases for `standard` and `pro_family`, and `privacy` was under-provisioned (200k/1M).
   - Added `standard` (80k 3h / 350k 24h) and `pro_family` (750k 3h / 4M 24h), and harmonized `privacy` to 500k 3h / 2.5M 24h to support cloud developer usage.
3. **SQLite `one-api.db` Schema & Row Corrections**:
   - Updated `pro_family` rows across all tenants in `groups` table to `shared = 1, max_adults = 2, max_children = 2`.
   - Updated `license_tiers` row for `privacy` to `max_seats = 1, quota_units = 15,000,000, display_name = 'Sovereign Privacy Hybrid Tier'`.
4. **VS Code Server Web IDE Capability Gate (`api/server/routes/ide.js`)**:
   - Hardened `/api/ide` proxy route with a post-JWT entitlement middleware checking `user.allowedCapabilities.includes('vscode_server')` or `IDE_ENTITLED_ACCOUNT_TYPES` (`pro`, `pro_family`, `privacy`, `enterprise`).
   - Denies `basic`, `standard`, and `family` with HTTP 403 and machine-readable `IDE_ENTITLEMENT_REQUIRED` error code.
5. **Fleet Console UI Alignment**:
   - Extended `PlanTier` and `PLAN_LABEL` in `fleet/src/dashboard/src/api/types.ts` to include all 7 tiers.
   - Updated `TenantFilters.tsx` select dropdown options and added themed CSS badges in `console.css` for `pro`, `pro_family`, `privacy`, and `standard`.
6. **Recompilation & Process Verification**:
   - Recompiled native Go binary `satchida-gateway.exe` with zero vet/compiler warnings.
   - Verified active listening ports: 3080 (LibreChat HTTP 200), 4000 (Satchida Gateway /api/status HTTP 200), 8700 (Bifrost), and 5173/8085 (VScode-server).

## 2026-11-08 – Executive Sales Deck Rebuild (Use-Case-Driven)

Rebuilt both customer-facing sales decks from scratch after review found them feature-dump style without client use cases, with low-contrast dark styling and residual third-party vendor names in the value deck:

1. **SATCHIDA-FLAGSHIP-SALES-DECK.html/.pdf — 12 pages** (Executive Briefing): cover with anchor stats; one-page executive summary; three structural failures of commercial cloud AI; platform architecture with four modes and the Zero-Knowledge Relay flow; **three illustrative use cases** (product engineering studio dual-screen shipping under NDA, law firm air-gapped discovery with page citations, accountancy vault deliverables with traceable figures); dual-screen deep dive; Knowledge Vault pipeline (ingest → per-seat isolated index → cited answers → PPTX/PDF/DOCX/XLSX); tier cards (Pro ₹1,499 / Pro Family ₹2,499 / Privacy ₹3,499 + hardware spec line); 10-row capability matrix; onboarding tracks and guarantees; CTA.
2. **SATCHIDA-VALUE-SALES-DECK.html/.pdf — 12 pages** (Team & Productivity Briefing): per-seat AI tax math; platform overview with pooled seats; **three illustrative use cases** (two-partner CA office, coaching institute Study Mode with POCSO + NCERT grounding, four-person boutique agency pooled budget); tier cards (Standard ₹299 / Family ₹999 / Pro ₹1,499 + enterprise from ₹15,000); Knowledge Vault; responsible tutoring deep dive; 4-person ROI ledger with comparison bars (₹81,600 → ₹9,990, 88%); value matrix; 3-step onboarding; CTA.
3. **Design system**: print-exact 16:9 pages (`@page 13.333in × 7.5in`, zero margin), light consulting-grade theme (paper `#FAFAF7`, navy `#122A47`, cyan/indigo/emerald accents), Source Serif 4 display + Inter body + IBM Plex Mono kickers, situation → workflow → outcome use-case format, proportional CSS bars, highlighted matrix columns, per-slide `#pN` anchor ids. Third-party vendor names fully removed from the value deck (flagship was already clean); comparisons use "leading commercial AI" with observed retail rates.
4. **Generation & sync**: PDFs rendered via headless Chrome (`--print-to-pdf`, `--virtual-time-budget=20000`), verified `/Count 12` in both page trees; slide-level visual QA via single-slide Chrome screenshots caught and fixed a collapsed `.bfill` span (missing `display:block`) in the value ROI bars. All copies synced: repo root, `client/public/decks/` (lowercase HTML), and `client/dist/decks/` (live serving) — live URLs re-verified over HTTP with new-content grep.
5. **A4 Print Briefs (one/two-pager format, replaces slide-deck ask for email/print)**: Added `SATCHIDA-FLAGSHIP-A4.html/.pdf` and `SATCHIDA-VALUE-A4.html/.pdf` — 2-page A4 portrait documents (`@page A4`, zero margin, exact page breaks). Page 1 is a standalone sales pitch: serif headline, hand-built isometric SVG hero scene (user team → Zero-Knowledge Relay shield with blocked identity badge and threat arrows → frontier cloud; GPU tower with ₹0-egress chip; value hero shows office building, 4 pooled seats (2 adults + 2 kids), vault with per-seat locks, UPI/GST coin flow, and the student + parent-monitoring vignette with dashboard, POCSO shield blocking an 18+ threat). Page 2 carries three use-case vignette cards (situation → outcome), pricing table, guarantees chips, onboarding timeline (value: 3-step UPI onboarding + 4-person ROI ledger with proportional bars) and CTA band. SVG scenes are generated by `D:\tmp\deckqa\gen_a4.py` (isometric box/human/shield/cloud primitives) and injected into template `<!--SVG:NAME-->` markers — keep the generator authoritative for artwork edits. Visual QA caught and fixed two canvas-clipped labels (centered mono text wider than viewBox) and a vignette label/shield collision. All copies synced to `client/public/decks/` (lowercase HTML + PDFs) and `client/dist/decks/` (live); live URL grep verified. The 12-page 16:9 decks remain available for on-screen presenting.
6. **Commercial-accuracy corrections to both A4 briefs (operator review)**: removed all explicit token volumes from customer-facing copy (stat "15M tokens/mo", pricing "Monthly volume" column re-titled "Included" with qualitative entries — priority routing / pooled team budget / unlimited on-premise; agency pool vignette now shows ₹999 · 4 seats instead of 25M). Scoped every ₹0 claim explicitly to Privacy-mode egress on the Sovereign Privacy tier so nothing reads as "Chat is free" — stat now "₹0 egress — on Privacy-mode work — Sovereign Privacy tier only", hero chip "PRIVACY TIER · ₹0 EGRESS". Stated exclusivity in five places: Privacy mode (100% on-premise inference on the customer's own ≥24GB GPU server) exists only on the privacy account type; Chat, Study and Work run on frontier cloud providers through the relay in every account type (modes-strip footnote, tier card, hero caption, sub-headline, pricing note). Remaining "tokens" mentions are the generic pooling behavior with no volumes.
7. **Same commercial-accuracy rules applied to the 12-page 16:9 decks** (operator flagged they still showed the old claims): flagship cover stat "₹0 / 15M tokens/mo" → "₹0 egress — Sovereign Privacy tier, own GPU server" + "Priority routing — no per-3-hour throttling"; exec-summary commercials card, tier cards, use-case outcome, matrix "Monthly token volume" row → "Usage model: Priority routing / Pooled team budget / Unlimited on-prem + cloud"; Privacy-mode exclusivity added at the modes strip, Track B card ("Exclusive to this tier… Chat, Study and Work stay on cloud via the relay"), legal use-case step 1, and cover sub-headline ("on the Sovereign Privacy tier, confidential work never leaves your building"). Value deck: 2M/6M/15M tier bullets → qualitative USPs, uc3 "25M-token pool" → "pooled Pro Family budget", uc-note volumes removed, matrix row → "Usage model", "shared token budget" → "shared usage budget". Both PDFs re-rendered (/Count 12 verified) and synced to root, public and dist; live grep confirms corrected copy.
8. **A4 briefs rebuilt as formal business proposals (REV 03)** — both A4 documents restructured from pitch-style to a real proposal: letterhead + "BUSINESS PROPOSAL" masthead, meta block (Prepared-for blank, proposal reference SAC/PROP/2026-11/F-001 | T-001, date of issue, 30-day validity), numbered sections — 1 Executive summary · 2 Scope of the offer · 3 Commercial proposal (Option A/B/C licence-fee table) with payment terms folded into the terms note · 4 (flagship) Deployment & activation plan as a milestone/owner/timeline table · capability-evidence vignettes · Service & support · Data protection & compliance (Privacy-mode exclusivity, zero-knowledge relay, per-seat vault isolation, DPDP/POCSO) · Acceptance section with dual signature blocks and option-selection line. Payment-terms and hero-caption sections were folded/removed and scope consolidated 8→6 items to fit the fixed A4 height; all three commercial-accuracy rules (no token volumes, ₹0 only as Privacy-tier egress, Privacy mode exclusive to the privacy account type with customer's own ≥24GB GPU server) carry through. Visible **REV 03 · 08 NOV 2026** tag in every footer for version verification. Both PDFs re-rendered at exactly 2 pages; three overflow passes were caught and fixed via full-document screenshots. All copies synced (root, client/public/decks, client/dist/decks) and live-verified by HTTP grep (REV 03 present, zero token-volume phrases).
9. **Round-3 operator corrections across all four collateral files (REV 04 · 09 NOV 2026)**:
   - **Dates removed** from both A4 proposals (Date of issue, Valid until meta fields and the "prices valid 30 days" sentence) so proposals never need re-dating.
   - **Hero redesigned real-life** (flagship): the abstract relay diagram is replaced by a plain-language scene a principal or RWA president can read — your office with a locked filing cabinet and dual-monitor desk, a Satchida checkpoint shield where the red name-tag is stripped off the outgoing question envelope, snoopers blocked, and a cloud answering an anonymous question ("NO NAME · NO COMPANY · NO LOGS").
   - **Track A/B eliminated** from customer copy — scope and deployment now use the same Option A/B/C language as the commercials (P1–P4 phases replace A1/B3 milestones).
   - **Deployment honesty**: all "15 minutes / 24–48 hours" claims removed everywhere (A4s and both 16:9 decks); the deployment plan now shows P1 Planning (days 1–2) → P2 Installation of dependencies + LibreChat & platform services (days 3–5) → P3 Testing (days 6–7) → P4 Go-live (days 8–10), i.e. **1–2 weeks from acceptance**.
   - **Commercial structure**: both A4 commercial tables add "All options · One-time setup" and "All options · Managed service" line items with fill-in blank amounts (₹ ______) — amounts intentionally not invented; operator fills per client.
   - **No unverifiable curriculum claims**: every NCERT / CBSE / ICSE textbook-grounding claim removed from both A4s and both decks; tutoring is described only as Socratic (hints/step-checks) with POCSO-aligned filtering, and citations are tied to study material actually loaded into the tenant's vault ("where study material is loaded… answers cite it page by page"). Page-1 CTA band removed from the flagship proposal (Acceptance §9 is the action point); zero residual claim strings verified by grep and live HTTP grep.
