# Changes — Satchida AI Harness

Chronological log of changes to this fork, newest first. Newest first so the current state is
readable without scrolling. `Customizations.md` explains _what_ diverges from upstream and
why; this file records _when_ and _what exactly_.

Format: date, phase, change, evidence. Every entry should be verifiable.

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
