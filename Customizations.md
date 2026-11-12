# Customizations — Satchida AI Harness

Every deviation from upstream LibreChat, with its reason and its upstream counterpart. This
is the running inventory; `Changes.md` is the chronological log.

**Status as of the initial audit (commit `f10b1d91`, 2026-09-30): nothing is customized
yet.** The sections below are planned work, recorded so the divergence from upstream stays
auditable as it accumulates.

---

## D. Divergences introduced by the tenant-scoped admin panel (2026-10-16)

These are deliberate, each with its upstream counterpart and reason. See `Changes.md`
(Part XIV) for the chronological detail and evidence.

| #   | Divergence                                                                                                   | Upstream behaviour                                                                                     | Reason                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Admin routers `users`/`groups`/`roles`/`grants` gate on **`access:admin`** (tenant-scoped)                    | `requireCapability(OPERATOR_CONTROL, { platformOnly: true })` — platform operator only                  | The deployment has tenant administrators who must manage their own tenant's accounts. `OPERATOR_CONTROL` implies every capability, so operators still pass unchanged.                                  |
| D2  | `GET /api/admin/users` listing scope is derived from **caller authority**; `?scope`/`?tenantId` are ignored   | Scope came from the request (`!req.query.tenantId` → `runAsSystem`), i.e. any caller could be served all tenants | The upstream form was a cross-tenant read once a non-operator could reach the route. Fail-closed: a caller with neither platform authority nor a tenant is refused.                                     |
| D3  | New `seedTenantAdmin(tenantId, roleName?)` and operator-only `POST /api/admin/grants/tenant-admin`            | No tenant-administrator provisioning path; `bootstrapOperatorCapability` only covers the platform operator | Needed to grant the tenant-scoped capability set. Refuses `OPERATOR_CONTROL`, so it cannot escalate.                                                                                                   |
| D4  | `GrantPrincipalType` is `ROLE \| GROUP \| USER`; grant body accepts an operator-only `tenantId`                | ROLE-only (`Record`/`Set` structure was left as a placeholder for expansion)                            | A group must be able to carry an entitlement so members inherit it, and an operator must be able to write a grant *for another tenant* — the handler previously stamped only the caller's own tenant.   |
| D5  | `accountType` added to the User schema and `IUser` (`basic\|standard\|family\|pro\|pro_family\|enterprise\|privacy`, lowercase)                  | Absent                                                                                                  | This is the value the one-api seat linkage keys on (one-api resolves a seat's group by exact name). Lowercase is load-bearing: a mis-cased name silently bypasses one-api's `MaxSeats` cap.             |
| D6  | Admin user list/search/create/update live in `packages/api/src/admin/users.ts`; `/api` keeps wiring only       | User create (and bulk, and reset-password) were inline in `api/server/routes/admin/users.js` using `mongoose.models.*` | The repo's own rule is "`/api` holds wiring, not behaviour". Bulk and reset-password remain inline — recorded as outstanding.                                                                           |
| D7  | `GET /api/admin/verify` returns `isOperator` and `tenantId`                                                    | Returned `{ user }` only                                                                                | The panel inferred authority from `role === 'ADMIN' && tenantId in (undefined,'satchida-master')` — which mis-classifies every tenant admin (their role is also `ADMIN`).                                |
| D8  | `admin/` vanilla-JS panel is served at `/admin` by the API process                                             | Upstream expects the **AGPL-3.0** `LibreChat-AI/admin-panel` via `ADMIN_PANEL_URL`                       | Licensing: the AGPL panel cannot ship in a paid service (see C1). `admin/` is the clean replacement; upstream's `AdminPanel.tsx` link is retained.                                                      |
| D9  | `TENANT_SEAT_CAPABILITIES` includes `'vscode_server'` for developer suite gating                               | Absent (capabilities were unformalized or absent)                                                       | Gates access to the bare-metal VS Code Server Web workspace for Pro and Pro Family developer tiers.                                                                                                       |
| D10 | ModelSelector groups curated Satchida modes at top, hides internal gateway duplicates, and segregates My Agents & Cloud BYOK | Uncurated flat list with raw custom endpoints mixed with model specs | Enhances executive UX, eliminates duplicate submenus, preserves direct access to Agents and personal API keys. |

**Not changed:** `audit.js` remains operator-only — `AuditLog` is deliberately outside tenant
isolation (`chainKey`-scoped), so exposing it per-tenant needs that read path verified first.

---

## C1. Third-party components removed

| Component     | Upstream location                                                                                                        | Reason                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `admin-panel` | `docker-compose.yml:42`, `deploy-compose.yml:46` (image `registry.librechat.ai/clickhouse/librechat-admin-panel:latest`) | **AGPL-3.0.** Network use in a paid service triggers source-disclosure obligations. Full analysis in `ARCHITECTURE.md` §3. |

Consequences: remove the `ADMIN_PANEL_PORT`, `ADMIN_PANEL_SESSION_SECRET`,
`ADMIN_PANEL_SESSION_COOKIE_SECURE`, and `VITE_API_BASE_URL` variables; the
`admin-panel` service block and its `depends_on: api`.

Note: `docker-compose.override.yml.example`, `api/server/routes/admin/auth.js`, and
`client/nginx.conf` also reference admin-panel and must be reviewed.

### C2. Stale references removed

`static-browser-server` appears in `bun.lock` and `package-lock.json` with no corresponding
source usage — the Static Browser feature was removed from LibreChat in favour of the Code
API. Both lockfiles should be regenerated rather than hand-edited.

---

## C2. Products: no new module yet

Upstream LibreChat has **no** subscription, plan, or payment code. The following are new and
will appear in the fork:

| Path                                               | Purpose                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/data-schemas/src/schema/plan.ts`         | Tier definitions — price, quota, refill interval, seat limit                                |
| `packages/data-schemas/src/schema/subscription.ts` | User/tenant subscription with lifecycle status                                              |
| `packages/data-schemas/src/schema/payment.ts`      | Payment attempt and reconciliation record                                                   |
| `packages/api/src/billing/`                        | `PaymentProvider` interface, `ManualUpiProvider`, `RazorpayUpiProvider`, assignment service |
| `packages/api/src/admin/reconciliation.ts`         | Operator reporting for manual reconciliation                                                |
| `client/src/components/Admin/console/`             | Operator console: plans, subscriptions, payments, users                                     |

Per upstream `AGENTS.md`, database contracts live in `packages/data-schemas` and business
logic in `packages/api`. Mongoose types stay out of exported signatures in `packages/api`,
`packages/data-provider`, and `client`.

---

## C3. Configuration diverging from upstream defaults

These change shipped behavior and belong in `librechat.example.yaml`:

| Key                       | Upstream default                                    | Satchida        | Note                                                                         |
| ------------------------- | --------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `balance.enabled`         | `false` (commented at `librechat.example.yaml:363`) | `true`          | Forces `transactions.enabled = true`; `packages/api/src/app/config.ts` warns |
| `interface.agents.create` | `true` (`:212`)                                     | tier-dependent  | Read from RBAC, not config, once gating is in place                          |
| `interface.agents.share`  | `false` (`:213`)                                    | Enterprise only |                                                                              |
| `interface.customWelcome` | LibreChat copy (`:145`)                             | Satchida copy   | Rebrand, Phase 5                                                             |

New `configSchema` keys (`packages/data-provider/src/config.ts`), each defaulting to today's
behavior:

- `payments.provider` — `'manual'` \| `'razorpay'`
- `payments.upiQrAsset` — path to the owner's static UPI QR
- `payments.razorpayKeyId` / `payments.razorpayWebhookSecret` — sourced from env, never config
- `billing.demoTier` — the demo role key and its token allowance

---

## C4. Branding

**Master logo (confirmed 2026-10-03):** `D:\LAN-AI-Infra\Satchida\Satchida-logo.png`

> ⚠️ **Treat as the opaque-plate master.** The SCode fork's `docs/BRAND-ASSETS.md` §1–2 documents
> that the supplied master is 2048×2048 with a **fully opaque white plate**, and that the obvious
> knockout `coverage = 255 - min(R,G,B)` is **not idempotent** — PNG transparency stores RGB as
> zero, so re-running it paints the background opaque **black**. The correct formula is
> `coverage = (255 - min(R,G,B)) * alpha / 255`.
>
> **Reuse the existing generator and its safety guard — do not write a new one:**
> `D:\LAN-AI-Infra\Zcode\SCode\scripts\generate-brand-assets.ps1`. It refuses to run on an
> already-transparent input and emits `flat` and `sketch` flavours. The boot splash is a
> **separate** pipeline (`scripts/build-splash-mandala.mjs`) that deliberately does not use the
> coverage formula. Post-generation alpha verification is mandatory (`BRAND-ASSETS.md` §5):
> expected `cornerA=0`, `midA>100` on every asset.
>
> Pre-existing Satchida outputs, for reference: `D:\LAN-AI-Infra\Satchida\brand-assets\`

| Upstream asset                                   | Replacement                                   |
| ------------------------------------------------ | --------------------------------------------- |
| `client/public/assets/logo.svg`                  | Satchida logo                                 |
| `client/public/assets/favicon-16x16.png`         | Satchida favicon                              |
| `client/public/assets/favicon-32x32.png`         | Satchida favicon                              |
| _(absent)_                                       | Web app manifest + Android icon set (Phase 4) |
| `package.json` `name: "LibreChat"`               | Satchida product name                         |
| `docker-compose.yml` `container_name: LibreChat` | Satchida container name                       |

Theming swaps semantic theme tokens, not raw colors.

## C5. No-provider-marketing policy (binding)

**No model provider or model name may appear in any user-facing surface.** Not the interface,
not responses, not plan copy, not feature lists, not comparison tables, not the agent or preset
names, not `librechat.example.yaml` values a user can observe.

This is a compliance requirement, not only branding. Anthropic Commercial Terms §A.1 permits
"products and services Customer makes available to its own customers and end users"; §D.4
restricts building a **competing product or service**. Never presenting ourselves as provider
access is what keeps us inside §A.1.

**Do not add a "powered by \<provider\>" tier or mode later.** That single feature would be the
thing that makes Satchida a competing product of that provider.

Full detail, claims ledger and marketing copy: `PRIVACY.md` §2.1.

---

## C5. Upstream primitives reused without modification

Recorded so no one "fixes" working upstream behavior:

- `packages/data-schemas/src/schema/role.ts` — RBAC backing the plan tiers
- `packages/data-provider/src/permissions.ts` — `PermissionTypes` as the feature matrix
- `packages/data-schemas/src/schema/balance.ts` — token credits, `autoRefillEnabled`,
  `refillIntervalValue` / `refillIntervalUnit`, and the `reservations` / `reservedCredits`
  concurrency-safe in-flight debiting
- `packages/api/src/middleware/checkBalance.ts` — quota enforcement
- `packages/api/src/auth/googleRefresh.ts` + `googleId` — Google registration
- `packages/api/src/admin/*` — operator API surface we build the console on
- `REFILL_INTERVAL_UNITS` (`packages/data-provider/src/balance.ts`) — already covers
  `days`, `weeks`, `months`, which is exactly the requested quota periods
- `@librechat/agents` `^4.0.1` — the agent runtime; **never clone the repo**

---

## C7. Family profile data contract (2026-10-05 — substrate only)

Added optional family/guardian linkage, family limits, and distinct guardian-processing, transcript-view, and image-generation consent timestamps/versions to the shared User schema/types. Legacy defaults leave profiles unlinked, limits null, image generation disabled when configured, and all consent records null. The public user type exposes only `familyRole`; normal user/auth response allowlists exclude owner/guardian IDs, limits, and consent metadata.

This is **not** a family product implementation: no family creation/service API, parent transcript endpoint, child/parent UI, image enforcement, account cascade, or consent workflow is wired. Those remain gated on the ownership, same-tenant, auth-cache, transcript-visibility, and atomic quota invariants in `satchida-overnight-plan.md`.

---

## C6. Third-party components added

| Component                     | License             | Purpose                                 | Phase |
| ----------------------------- | ------------------- | --------------------------------------- | ----- |
| `code-interpreter` (Code API) | Apache-2.0          | Sandboxed code execution, Pro and above | 3     |
| `quickbooks-online-mcp`       | Apache-2.0          | QuickBooks MCP server, Enterprise only  | 3     |
| `rag-api`                     | MIT                 | Optional RAG retrieval                  | 3     |
| Razorpay                      | Proprietary service | UPI gateway — **not yet, no account**   | 6     |

`rag-api` and the admin-panel wiring are upstream compose entries; only the code-interpreter
and QuickBooks services are new deployment units.

---

## C7. Operator console build root and theme layer

`fleet/src/dashboard/` is a divergence from upstream in two ways worth keeping auditable.

**It is not a workspace.** The root `package.json` declares `api`, `client`, and `packages/*`
only, so the console installs its own `node_modules` and never participates in the LibreChat
dependency graph. It also deliberately does **not** use `@librechat/client` primitives, the
client router, or the client's localization runtime — the handover places this SPA on the
control service at `:8443`, and coupling it to the LibreChat bundle would break that.

**Its own design system, upstream theme rules not in force.** `packages/client/src/theme/*`
governs LibreChat's appearance. The console instead resolves every colour, depth and motion
value through `src/styles/tokens.css`, because it is a separate app with a separate build.
Two places where this would otherwise have produced a bug, both caught and fixed:

| Issue                                          | Cause                                                                            | Resolution                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Masthead title invisible in light mode         | Title gradient built from near-white stops, reused over a light field            | Light appearance re-points the gradient at the dark end of the ramp |
| Light appearance read as an unstyled grey wash | Aurora alpha dropped to 0.5 for light, where it needed _more_ presence, not less | Raised to 0.82 alpha with 1.5 saturation                            |

No 3D library is used. The particle field is a ~200-line Canvas2D renderer (camera yaw/pitch,
perspective divide, depth sort, distance fog) with no dependency beyond React. `@vitejs/plugin-react`
was removed rather than pinned: v4's peer range stops at Vite 7 and this root resolves Vite 8, and
JSX transforms fine from `tsconfig.json` without it.

---

## C8. Landing atmosphere layer (LibreChat client)

Satchida paints its own background inside LibreChat rather than relying on theme tokens alone.
This is a deliberate divergence from the upstream rule that appearance is expressed as semantic
tokens, and it is bounded:

- **Colour still comes from tokens only.** The atmosphere reads `--series-1..8`, `--surface-*` and
  `--border-light`, which `satchida.ts` resolves. `style/satchida.css` contains no literal colour
  for the field; the categorical scale was given brand values in the theme definition precisely so
  the background has a token source to read.
- **Layering is `body::before` (field) -> `#root` (content).** The earlier `#root::before` at
  `z-index: -1` could never work: any opaque full-screen child covers it, and the auth shell is one.
  A background painted on `body` cannot be occluded by app content, because content is what sits
  above it.
- **The depth field is JS; the colour field is not.** Only the canvas needs React and rAF. The
  colour, fade and drift are pure CSS on `body::before` so they cost nothing per frame and survive
  on routes that mount no component.

---

## C11. Tenant entitlements and seat-reservation foundation (2026-10-06)

Added `TenantEntitlement` as a tenant-isolated record for operator-provisioned plan type, explicit
account-type allocations, semantic modes, seat usage/limits, credit/rate defaults, status, and dates.
Pure validation lives in `packages/data-provider/src/tenant-entitlement.ts`; `packages/data-schemas`
contains only persistence and conditional atomic seat reserve/release methods. A plan name does not
imply a mode: each allocation lists allowed modes. Privacy is filtered unless the account type is Pro,
Pro Family, or Enterprise and the local model is healthy. Child requests are denied unless the caller
explicitly supplies a child-safety-ready assertion. Family starts with an editable four-seat technical
default while source documents conflict. Prices, Basic-vs-Standard semantics, Study mode, and a
Satchida-Master customer-plan exception are not inferred.

`TenantPolicy` also now applies the tenant-isolation plugin; it had a `tenantId` field but previously
lacked that middleware. There is not yet an operator entitlement API, tenant user provisioning/deletion
API, audit-integrated seat assignment, or customer UI. This data contract is not a complete subscription
system.

## C10. Operator-only administration and tenant ADMIN boundary (2026-10-06)

The fork adds `operator:control` as a direct-user platform capability. It is not included in the generic
role seed and cannot be assigned through the generic grants API. Startup reconciles the configured
`SATCHIDA_OPERATOR_USER_ID` (must resolve to an existing user in `satchida-master`) and gives that user
the platform capability set directly; the broad ADMIN role no longer receives platform-scoped grants.
Tenant-scoped grants are preserved.

Operator checks now guard broad admin APIs, role-permission writes, code-environment registration, and
token-config catalog metadata. Authenticated users continue to see semantic modes only. Role-name
shortcuts that previously gave any `ADMIN` access to agent permission mutation, unrestricted people
picker searches, tenant-wide Insights listings, and multi-conversation agent ACL checks were removed;
these surfaces now require explicit role permissions and applicable resource ACLs.

**Verification:** targeted route tests 88/88 and API auth/ACL/Insights tests 145/145 pass; `tsc
--noEmit` passes in `packages/api` and `packages/data-schemas`. Mongo-backed grant tests remain blocked
by the local MongoMemoryServer MD5 mismatch. No Satchida Gateway files or Cloudflare tunnel configuration changed.

## C9. Marketing surface on the auth route

The LibreChat client carries a Satchida marketing page at `/login`, which is the unauthenticated
entry point. This is a divergence from upstream in two respects worth recording:

- **Visible copy lives in `translation.json` under `com_marketing_*`.** Roughly 56 new English keys
  were added. Per the frontend rules the copy goes through `useLocalize()` like any other string,
  even though the page is brand content.
- **The page states what can be defended and stops there.** No anonymity claim, per SOLUTIONS.md §B1.
  The billing relationship is described as Satchida↔organisation, never Satchida↔end user.

Artwork is CSS and the brand PNGs only: no image-generation dependency, no new runtime asset. The
"photoreal" treatment is gradient mesh, glass and 3D transform rather than rendered photography —
which is also the only version that recolours correctly between the light and dark themes instead of
shipping two sets of bitmaps.

## C11. Satchida Chat Toolbar & Execution Selectors (2026-10-06 / 2026-10-07)

Upstream LibreChat lacks specialized execution styles (Plan/Build) and unified quick-action toggles for web search, reasoning effort, prompt enhancement, deep research, and image generation.

1. **Jotai State Store (`client/src/store/satchiStore.ts`):**
   - Implemented with `createStorageAtom` to adhere strictly to the Jotai migration directive in `AGENTS.md`.
   - `satchiStyleAtom` (`direct | plan | build`, default `direct`).
   - `satchiModeAtom` (`Chat | Work | Study | Privacy`, default `Chat`).
   - `satchiWebSearchAtom` (boolean, default `false`).
   - `satchiThinkAtom` (`off | medium | high`, default `off`).
   - `satchiResearchAtom` (boolean, default `false`).
   - `satchiImageGenAtom` (boolean, default `false`).
   - Embedded multi-vector `heuristicEnhance` prompt expander supporting 8 domain archetypes: SHTF/Disaster dossiers, RBI banking compliance, Supreme Court/Gazette legal analysis, Frontier AI & local SLM hardware sizing, precious metals & crypto volatility, retail fuel & LPG, earth/geosciences, and structured multi-point prompts.

2. **Style Segmented Control (`client/src/components/Chat/Input/SatchiStyleSelector.tsx`):**
   - Mounted in the composer footer: `Direct`, `Plan`, `Build`.
   - `Plan` mode automatically injects step-by-step thinking and approval pause directive (`STYLE_PROMPTS.plan`).
   - `Build` mode automatically injects immediate production-ready deliverable directive (`STYLE_PROMPTS.build`).

3. **Mode Selector (`client/src/components/Chat/Input/SatchiModeSelector.tsx`):**
   - Exposes `Chat`, `Work`, `Study`, and `Privacy` (with emerald shield badge representing 100% on-device sovereign inference).
   - Syncs directly with conversation spec and model.

4. **Action Icon Toolbar (`client/src/components/Chat/Input/SatchiToolbar.tsx`):**
   - Icon row: 🌐 Globe (web search), 🧠 Think (reasoning pulse), ✨ Wand (prompt expander + toast), 🔬 Research (deep research), 🖼️ Image (image generation).
   - Tooltips powered by `@librechat/client`'s `TooltipAnchor`.

5. **Composer Integration (`client/src/components/Chat/Input/ChatForm.tsx`):**
   - Mounts selectors and toolbar into the composer action bar.
   - Prepends `stylePromptPrefix` inside `submitComposerText` without cluttering the user's draft in the textarea.
   - Refocuses textarea upon `Wand` prompt enhancement.
   - Localized via English keys in `client/src/locales/en/translation.json`.

**Verification:**
- Unit tests: `client/src/components/Chat/Input/__tests__/SatchiToolbar.spec.tsx` (11/11 tests pass).
- TypeScript: `npx tsc --noEmit` in `client` passes with 0 errors.
- Production build: `npm run build:client` passes with exit code 0.
- Live inference: Verified with local llama-server on `:8080` (`Qwen2.5-Omni-7B-Q4_K_M`) for Direct (916ms), Plan (2956ms), Build (3017ms), and Wand Enhanced (3194ms) completions.

## C12. Hook executor console suppression (2026-10-07)

Upstream LibreChat's hook executor (`@librechat/api/dist/index.cjs`, function `runCommand`) spawns the guardrail hook process with `node_child_process.spawn` but **omits `windowsHide`**. On Windows, Node defaults the new console process to create a visible window (via `CreateProcess` default `CREATE_NEW_CONSOLE`), so **every** incoming chat message that runs a guardrail/pre-hook (the `child-safety-gate`, `redact-secrets`, and `use_classifier` hooks) flashes a PowerShell console window for a fraction of a second.

**Customization:** the spawn options block now passes `windowsHide: process.platform === "win32"` so the hook process is created as an invisible window. Hidden consoles do not block execution or capture — `stdio: ["pipe","pipe","pipe"]` is preserved, so hook stdout/stderr/CDP capture still works.

**Persistence:** delivered as a manual `patches/@librechat+api+1.7.52.patch` (upstream offline, so `npx patch-package` cannot fetch the registry). The patch is applied by the existing `postinstall` → `patch-package` hook on any future `npm install`. **Caveat:** because the patch targets the compiled `dist/index.cjs` and is version-pinned to `1.7.52`, an upstream minor bump of `@librechat/api` will conflict until the patch is regenerated. It must be re-patched inside `node_modules` too — editing only `src/agents/hooks/executor.ts` does **not** affect the runtime (`main` = `dist/index.cjs`).

**References:** LibreChat `Bugs.md` entry **B25**; Bifrost `bifrost/Bugs.md` entry **BIF-026** (relates the `--update-env` PORT-pollution recurrence, **B26** in LibreChat `Bugs.md`).

## C13. Native Web IDE Sub-Router (Option A - VS Code Server / Cline) (2026-10-08)

Upstream LibreChat has no embedded developer environment or web IDE capability. A native, zero-container integration was built into the Express application server to embed code-server and the Cline AI extension directly inside LibreChat:

1. **Express Sub-Router (`api/server/routes/ide.js`):**
   - Mounted at `/api/ide/*`.
   - Utilizes `http-proxy-middleware` installed in `@librechat/backend`.
   - Protected with `requireJwtAuth` to prevent unauthenticated access.
   - Forwards authenticated identity via `x-forwarded-user`.
2. **WebSocket Upgrading (`api/server/index.js`):**
   - Intercepts HTTP `upgrade` events on `/api/ide/*` and routes them to `vscoderProxy.upgrade()`.
   - Ensures terminal sessions, file sync, and language servers maintain live duplex communication.
3. **Client IDE Panel (`client/src/components/IDE/IdeView.tsx`):**
   - Seamlessly loads `/api/ide/` in an iframe and provides pop-out / reload controls.
   - Eliminates CORS and multi-port exposure by channeling all IDE traffic through LibreChat's primary port `3080`.

## C14. Skill Soft-Delete & Administrative Restore Engine (2026-10-08)

Upstream LibreChat performs immediate hard deletion when a user deletes a skill (`Skill.deleteOne`, `SkillFile.deleteMany`, and blob removal). If a critical skill is mistakenly removed, it is lost permanently.

**Customization:**
1. **Schema & Model (`packages/data-schemas/src/schema/skill.ts` & `src/methods/skill.ts`):**
   - Added `deletedAt: { type: Date, default: null, index: true }` field to `skillSchema`.
   - Soft delete in `deleteSkill(id)`: updates `deletedAt: new Date()` and prunes agent allowlists, preserving the Skill row and storage blobs.
   - Added `restoreSkill(id)`: sets `deletedAt: null`, returning the skill to the active state.
   - `buildSkillFilter` automatically excludes `{ deletedAt: { $ne: null } }` unless admin passes `{ onlyDeleted: true }`.
2. **API Handlers & Routing (`packages/api/src/skills/handlers.ts` & `api/server/routes/skills.js`):**
   - Added `POST /api/skills/:id/restore` restricted to users with `ADMIN` role.
   - Updated `GET /api/skills?deleted=true` to query soft-deleted skills for administrators.
3. **Admin UI Trash & 1-Click Restore (`client/src/components/Skills/sidebar/SkillsSidePanel.tsx`):**
   - Integrated a "Deleted Skills" section in the Skills Side Panel visible only to administrators.
   - Provides a 1-click "Restore" button with toast notification and real-time query invalidation.


## C15. Satchida Multi-Tenant Identity Forwarding & Bifrost Telemetry Pipeline (2026-11-07)

Upstream LibreChat defaults outbound OpenAI client requests without tenant or user context, and upstream One-API assigns unauthenticated or generic requests to `"root"` or raw 24-character hexadecimal MongoDB ObjectIds. Furthermore, Bifrost OSS requires `customer_id` and `user_id` headers to attribute telemetry in its governance dashboards.

**Customization:**
1. **LibreChat Telemetry Forwarder (`packages/api/src/endpoints/openai/config.ts` & `initialize.ts`):**
   - Automatically detects endpoints matching `:4000`, `:4099`, `:8700`, or `satchida.com`.
   - Injects `X-Tenant-Id`, `X-User-Name`, `X-Seat-Alias`, `X-Bifrost-User-Id`, `X-Bifrost-Role`, `x-bf-dim-user_id`, `x-bf-dim-user_name`, and `x-bf-dim-customer_id`.
   - Extracts human display names (`user.name` / `user.username`) rather than raw hex ObjectIDs.
2. **One-API Ingress Identity Guard (`middleware/tenant_identity.go` & `model/log.go`):**
   - Enforces human username resolution: binds `X-User-Name` to Gin context key `ctxkey.Username`.
   - Added `isHexObjectId` validation in `model/log.go`: prevents 24-character hex strings or "root" from overwriting valid seat identities in consumption and relay error logs.
3. **Outbound Bifrost Dimension Injection (`relay/adaptor/common.go`):**
   - Injects `X-Bifrost-Tenant`, `x-bf-dim-customer_id`, `x-bf-dim-customer_name`, `x-bf-dim-user_id`, and `x-bf-dim-user_name` on all upstream calls to Bifrost (`:8700`).

## C16. Cache-Aware Billable Token Accounting & Rolling Quota Windows (2026-11-07)

In agentic loops (e.g. multi-step web search), conversation history expands across turns, creating large prompt token counts. Under upstream One-API, all prompt tokens were added directly into `quota_window_buckets`, penalizing users for repeated context and triggering premature burst quota exhaustion.

**Customization:**
1. **Cache Discounting in Window Buckets (`relay/controller/helper.go`):**
   - Implemented KV prompt cache discounting in `postConsumeQuota`:
     `effectiveTokens = uncachedPrompt + int(float64(cachedTokens) * 0.1) + completionTokens`
   - Gives users a 90% credit on cached prompt tokens, aligning rolling window consumption with real upstream compute costs.
2. **Bifrost Prompt Cache Auto-Injection (`relay/adaptor/common.go`):**
   - Injects `x-bf-prompt-cache-auto-inject: true` on outbound calls to Bifrost (:8700), triggering automatic cache breakpoint placement on Claude, OpenAI, and DeepSeek.
3. **Calibrated Window Rules (`model/tenant.go`):**
   - Re-seeded Pro tier rolling window rules to 500,000 tokens (3-hour burst) and 2,500,000 tokens (24-hour daily quota).

## C17. Automated Multi-Tenant Provisioning Hook for Bifrost (`model/bifrost_sync.go`) (2026-11-07)

Previously, creating a tenant in One-API only registered rows in `one-api.db`. Bifrost's `governance_customers` table remained unpopulated, resulting in missing tenant rankings on Bifrost's dashboard.

**Customization:**
1. **Automated Lifecycle Hooks (`controller/tenant.go` & `model/bifrost_sync.go`):**
   - `CreateTenant`: Executes `SyncTenantToBifrost`, upserting the tenant into Bifrost's `governance_customers` table in `Bifrost/data/config.db`.
   - `UpdateTenant`: Updates customer name/attributes in Bifrost.
   - `DeleteTenant`: Cascades deletion via `DeleteTenantFromBifrost`.
2. **Startup Self-Healing Reconciliation (`main.go`):**
   - `ReconcileAllTenantsToBifrost` executes on One-API boot, scanning `one-api.db` and ensuring 100% of active tenants exist in Bifrost.

## C18. Tenant Telemetry Export & Offline Billing Statement Generator (2026-11-07)

Operators require tenant-level billing statements and data exports for offline enterprise reconciliation without third-party payment gateway fees.

**Customization:**
1. **Tenant Invoice Dialog (`web/berry/src/views/Dashboard/component/TenantInvoiceDialog.js`):**
   - Formal invoice generator with unique invoice numbering (`INV-<TENANT>-<YYYYMM>`), telemetry summary, product mode distribution, seat utilization, and offline UPI remittance details.
   - Integrated with `@media print` styling and `window.print()` for instant PDF generation.
2. **CSV Telemetry Export (`web/berry/src/views/Dashboard/component/TenantUsageDrawer.js`):**
   - One-click CSV export generating a complete audit of seat, mode, token, and cost metrics for that tenant.
3. **Per-Tenant Scoped Navigation (`web/berry/src/views/Tenant/index.js`):**
   - Corrected navigation parameter binding (`tenant.id || tenant.tenant_id`) ensuring 1-click transition from the Tenants table directly into the filtered Tenant Analytics Dashboard.

## C19. SQLite Write-Ahead Logging (WAL) & Concurrency Hardening (`model/main.go`) (2026-11-07)

Under concurrent multi-tenant seat traffic and high-volume background telemetry queries, default SQLite rollback journaling led to `database is locked` lockouts.

**Customization:**
1. **WAL Mode DSN:** `openSQLite` explicitly configures `_journal_mode=WAL&_busy_timeout=5000&_sync=NORMAL&_cache_size=-64000`.
2. **Concurrent Readers & Writers:** Allows simultaneous read operations across all analytics and relay workers while single-writer transactions commit non-blockingly via WAL frames.
3. **Verified Invariants:** `PRAGMA journal_mode = wal` and `PRAGMA busy_timeout = 5000` enforced at database connection initialization.

## C20. Completion Ceiling Clamping & Upstream Credit Reservation Guard (`relay/controller/text.go`) (2026-11-07)

When client requests omitted `max_tokens`, upstream aggregators such as OpenRouter reserved credit for the model's full context window (e.g. 131,072 tokens), resulting in HTTP 402 payment required failures even on well-funded accounts.

**Customization:**
1. **Dynamic Max Token Assignment:** When `MaxTokens == 0` and `MaxCompletionTokens == nil`, One-API automatically clamps `MaxTokens` to 4,096 tokens for Chat mode and 8,192 tokens for Work/Study modes.
2. **Enforced Serialization:** Sets `meta.MaxTokensClamped = true`, bypassing the raw-body pass-through and ensuring the request body is converted and serialized with explicit `max_tokens` and `stream_options.include_usage: true`.
3. **Usage Certainty:** Ensures upstream streaming chunks reliably deliver `usage` statistics across all models.

## C21. NPCI-Standard 12-Digit UTR Verification, Idempotent Top-Up & Automated Log Pruning (2026-11-07)

Ensures financial transactions submitted via offline UPI meet regulatory Indian banking standards and converts currency accurately against dynamic landed forex rates.

**Customization:**
1. **NPCI 12-Digit UTR Regex:** `controller/upi_billing.go` enforces strict validation (`^\d{12}$`), rejecting synthetic test patterns (`000000000000`, `123456789012`).
2. **Realtime Landed FX Quota Conversion:** Dynamically calculates quota units as `(AmountINR / LandedRate) * 500,000` using `common.GetLandedRate()` (+5% upper ceil buffer), preventing arbitrage.
3. **Audit Trail & Idempotency:** Tags top-ups with `[AUDIT_STATUS:PENDING_OPERATOR_REVIEW]` and prevents duplicate crediting on identical UTRs.
4. **Automated Log Retention Daemon (`model/log.go`):** Prunes ephemeral consume and test logs older than 30 days while preserving financial topup and administrative audit trails indefinitely, followed by SQLite incremental vacuuming.

## C22. Timezone Harmonization & Local Midnight Quota Reset (2026-11-08)

Previous quota window calculations used `now % 86400`, which anchored 24-hour daily quotas to UTC epoch midnight (05:30:00 AM IST). At 00:30 AM IST, users were blocked by yesterday's token consumption while the gauge displayed "Resets in 5h 29m". Furthermore, JavaScript `toISOString().slice(0, 10)` in `chart.js` misattributed daily statistics.

**Customization:**
1. **Local Calendar Day Anchoring (`model/tenant.go` & `controller/analytics.go`):**
   - Anchors 1-day periodic windows to `time.Date(y, m, d, 0, 0, 0, 0, now.Location())`.
   - `CheckWindowLimit` and `AnalyticsWindowStatus` dynamically calculate live token usage from the indexed `logs` table directly, eliminating stale discrete bucket artifacts.
2. **Dashboard Calendar Harmonization (`controller/user.go` & `web/berry/src/utils/chart.js`):**
   - Replaced epoch truncation in `GetUserDashboard` with true local calendar day calculation.
   - Fixed `getTodayDay()` to format local calendar date components.
   - Added a 3-way time range selector (`24h Rolling` | `Today` | `7 Days`) to `Dashboard/index.js` with cross-referencing subtexts.

## C23. Guaranteed ≥ 80% Gross Margin Telemetry & Official List Pricing (2026-11-08)

Operators required transparent verification of actual upstream landed COGS against retail billed usage to enforce and guarantee a gross margin of ≥ 80%.

**Customization:**
1. **Gross Margin % Computation (`web/berry/src/views/Dashboard/component/CostReconciliationTable.js`):**
   - Dynamically calculates `((quotaUSD - costUSD) / quotaUSD) * 100` across Upstream Provider Totals and Model Breakdown.
   - Color-coded visual chips: Green (`≥80% Target Met`), Amber (`50% - 79% Low`), Red (`<50% Deficit Risk`).
   - Summary margin chips displayed in both table footers.
2. **Commercial List Price Policy Header:**
   - Standard retail pricing policy alert ($0.30/M input, $1.20/M output, with 80%+ discount on cached tokens).
3. **Prefix Caching Discount (`relay/billing/ratio/cache.go`):**
   - Enhanced `GetCacheRatio` with automated 90% cache discount (`0.1` ratio) for DeepSeek and Claude models, passing substantial token savings to tenants while maintaining a 99.1% gross margin on OpenRouter.

## C24. High-Performance Blob CSV Export, Fleet-Wide Telemetry & Complete Tenant Metadata (2026-11-08)

Previous implementations used `encodeURI` data URIs that truncated large CSV exports, serialized tenants without `monthly_fee_inr` or `max_seats` (causing the dashboard to display ₹0 /mo MRR), and formatted zero cost as `.00`.

**Customization:**
1. **Complete Tenant Contract Schema (`model/analytics_tenant.go`):**
   - Added `MaxSeats` and `MonthlyFeeINR` fields to `TenantUsageSummary` and `TenantUsageOverview`, populating them directly from the `tenants` table.
   - Eliminates ₹0/mo contract fee fallbacks and accurately reflects genuine fleet MRR (₹15,399/mo) and seat limits.
2. **Direct Action Buttons & Blob CSV Exports (`TenantCommercialCard.js` & `TenantUsageDrawer.js`):**
   - Added "Statement / PDF", "Export CSV", and "Export Fleet Summary CSV" buttons directly onto `TenantCommercialCard.js`.
   - Replaced legacy data URIs with standard `Blob` and `URL.createObjectURL(blob)` in all export paths.
3. **Display Polish & Row Focus (`TenantPortfolio.js` & `utils/common.js`):**
   - Corrected `renderCost` in `common.js` to return `'$0.00'` rather than `'.00'`.
   - Enabled interactive row highlighting in `TenantPortfolio.js` when a tenant is selected in the global dropdown.

## C25. Commercial Tier Harmonization, Auto-Backup Engine & Hybrid Privacy Architecture (2026-11-08)

**Customization:**
1. **Commercial Tier Harmonization (packages/data-schemas/src/types/entitlement.ts & model/group.go):**
   - Harmonized 7 standardized commercial tiers across LibreChat, One-API, and Bifrost: asic, standard, amily, pro, pro_family, privacy, and enterprise.
   - Added 'vscode_server' to TENANT_SEAT_CAPABILITIES and gated the native VS Code Server Web IDE to pro, pro_family, privacy, and enterprise.
2. **Tenant Metrics Auto-Backup & Archive Management Engine (model/analytics_tenant.go & TenantArchivesDialog.js):**
   - Implemented zero-loss auto-snapshotting of tenant metrics prior to reset, persisting structured snapshots both in SQLite (	enant_metrics_archives) and on disk (data/archives/).
   - Built a comprehensive frontend backup manager in Berry dashboard allowing operators to inspect, download, and delete archived metric runs.
3. **Hybrid Dual-Engine Architecture & Real COGS on Privacy Tier:**
   - Standardized definition of COGS (Cost of Goods Sold) as direct variable upstream API provider charges and network delivery costs.
   - Clarified that Privacy accounts feature a hybrid dual-engine: local GPU inference with ₹0 cloud COGS when in Privacy mode, and frontier cloud models (Claude 3.5 Sonnet, GPT-4o, DeepSeek) when in Chat, Study, Work, or Vibe Coding (VS Code Server Web, MCP, Code Execution).
   - Accurately recalibrated Privacy gross margin to **~85.8% to 88.0%** based on real cloud usage (~.50 / ₹445.50 COGS) against the ₹3,499 monthly fee.

## C26. Persona & MCP shipping assets under `satchida/` (2026-11-09)

Upstream LibreChat contains neither the persona master library nor an MCP shipping
manifest; the fork adds two product-layer directories so a client edge node can be
provisioned from this repo alone. No upstream file is modified.

**Customization:**
1. **`satchida/personas/`** — `personas.ts`: verbatim copy of the 34-persona master
   library from `satchida-ai-unified-suite/src/lib/constants/personas.constants.ts`
   (deltas only: provenance header + `export` on the three private rule blocks;
   verified with `diff --strip-trailing-cr`). Plus `specification.md` (operator spec:
   11 categories / 44 starters, staging protocol, ModelSpec overrides) and `README.md`
   (wiring map, stale-data audit, origin-sync rule, shipping checklist).
2. **`satchida/mcp/`** — `recommended-mcp.ts`: curated external MCP catalog copied
   from the unified-suite constant (type inlined). Plus `README.md`: manifest of all
   21 `librechat.yaml` servers (custom servers confirmed git-tracked under `skill/`),
   packaged-server dependencies and pre-warm steps, external sidecar requirements
   (AnythingLLM :3012, DeepTutor :8001), the per-client rewrite table for hardcoded
   `D:/LAN-AI-Infra` paths, and audit findings (deeptutor `dist/` untracked, hardcoded
   AnythingLLM API key, US-law `legal-research` pairing, unbound `clinical-research`,
   unreferenced `stem-math-server.py`).
3. **Runtime untouched** — `ConversationStarters.tsx`, `librechat.yaml`, and MCP
   configs are unchanged; the P0–P2 persona improvement plan (rule-block wiring,
   dangling-placeholder fixes, safety rewrites, matrix fixes) is tracked in the
   session todo list and logged in `Changes.md` (2026-11-09 entry).

## C27. P0–P2 persona accuracy contract, MCP credential/path portability & staging starters (2026-11-09)

Supersedes C26's "Runtime untouched" note: the P0–P2 plan now lands runtime changes. Upstream
LibreChat contains none of the following.

**Customization:**
1. **Accuracy contract in `librechat.yaml` ModelSpecs** — four anti-fabrication rule blocks
   (citation obligation, no fabricated numerics, stale-data refusal, Satchida-SI identity)
   appended to the `promptPrefix` of all 7 mode specs (Chat, Work, Pro, Vibecoding, Study,
   Study-Local, Privacy), plus zero-old-data rewrites in `librechat.yaml` and
   `satchida/personas/personas.ts` (8/8, 0 residuals).
2. **Privacy honesty** — the Privacy spec carries `webSearch: false` and a local-only
   no-live-context refusal line; `family_health` routes to Chat rather than Privacy. Diverges
   from upstream's web-enabled defaults; jest mode-filter tests pin the routing.
3. **MCP credentials via env template** — `${ANYTHINGLLM_API_KEY}` in `librechat.yaml`,
   expanded per connection by `extractEnvVariable` in `packages/api/src/mcp/connection.ts`
   (upstream does not resolve env templates in MCP command args); the secret lives only in
   `.env`. Paired with portable MCP args: 14 relative `skill/...` paths and
   `git --repository .` instead of `D:/LAN-AI-Infra` absolutes.
4. **MCP mode×allowlist matrix** — per-spec `mcpServers` allowlists across all 7 modes
   (upstream: one global set).
5. **Client starters refactor** — `client/src/common/starters.ts` extracted from
   `ConversationStarters.tsx` (deictic gate, label-bracket skip, Tab-cycle helpers), all copy
   through `useLocalize()` with `starters_*` English keys; new colocated jest spec 7/7.
6. **E2E harness adaptations** (divergence from upstream test infra, forced by this fork's own
   UI/environment): `e2e/setup/authenticate.ts` opens the auth forms via the AuthLayout
   `?signin=1` affordance; `e2e/lighthouse/audit.ts` tolerates chrome-launcher's Windows
   teardown-EPERM against a clean saved report; `e2e/lighthouse/load.spec.ts` allows the
   permanent `satchida-chat-watermark` as an LCP element (Chrome counts background-image divs
   as LCP candidates; canvas/border-image variants are ineligible). Both former env overrides
   are now baked into the harness (2026-11-10): `e2e/setup/env.ts` defaults the harness base
   URL to `http://localhost:3098` (off the live pm2 port), and `e2e/setup/start-server.js`
   drops a `SATCHIDA_OPERATOR_USER_ID` that leaked in from the production `.env` (unless the
   caller sets it explicitly), so plain `npm run lighthouse` runs the lane on this box.
7. **Self-hosted deck fonts** — the sales decks load Source Serif 4 / Inter / IBM Plex Mono from
   `client/public/decks/fonts/` (23 local woff2 + `fonts.css`; css2 `@font-face` set mirrored
   verbatim, unicode-ranges preserved) instead of fonts.googleapis.com / fonts.gstatic.com. Upstream
   LibreChat carries no Google Fonts references of its own; this divergence covers the fork's deck
   layer (Changes.md 2026-11-10 "Self-hosted deck fonts"). Standing directive: every repo we build
   self-hosts its fonts.


## C28. Product recommendations, universal legal disclaimers & click-and-go suggested questions (2026-11-10)

1. **Product Recommendations & Commercial Disclaimer**: In librechat.yaml and satchida/personas/personas.ts (LIVE_DATA_ENGAGEMENT_RULES), whenever queries touch active formulations, skincare, supplements, or commercial items, the assistant provides 3–4 concrete market products with search links (e.g. Amazon.in) accompanied by an explicit commercial disclaimer clarifying independence and non-endorsement.
2. **Universal Legal Protection Disclaimers**: Added domain-specific mandatory legal disclaimers across all 7 personas (health/skincare, finance/tax/bullion, statutory/legal, general/technical) before suggested questions for liability protection.
3. **Click-and-Go Suggested Questions**: Enhanced client/src/components/Chat/Messages/Content/Markdown.tsx and introduced SuggestedQuestions.tsx to parse suggested next questions and render interactive click-and-go cards with one-click submitMessage execution instead of plain static markdown text.
8. **Self-hosted Tailwind runtime for artifact previews** — sandpack previews and the React-template
   sandbox load Tailwind 3.4.17 from `client/public/assets/vendor/tailwind-3.4.17.js` (vendored Play
   CDN build, auto-copied to dist by the publicDir-copy plugin) via `TAILWIND_RUNTIME_URL` in
   `client/src/utils/artifacts.ts`, instead of cdn.tailwindcss.com (Changes.md 2026-11-10
   "Self-hosted Tailwind runtime"). Same zero-third-party principle as item 7; the sandpack bundler
   itself (codesandbox.io, env-overridable) and the marked jsdelivr script remain external.
9. **Self-hosted sandpack runtimes** — artifact previews load their toolchain from the repo:
   marked (SRI-verified byte-exact copy) at `assets/vendor/marked-15.0.12.min.js`, the React/node
   compile bundler mirrored (and patched: font links stripped, publicPath re-prefixed) at
   `assets/vendor/sandpack-runtime/`, and the static-template relay served by
   `createStaticPreviewRelayMiddleware` for `<sessionId>-<base>` wildcard hosts
   (`assets/vendor/sandpack-static-preview/`). Upstream ships these from jsdelivr and
   codesandbox.io. Static-preview self-hosting is gated on a `*.satchida.com` DNS record +
   `SANDPACK_STATIC_BUNDLER_URL` (Changes.md 2026-11-10 "Self-hosted sandpack runtimes").

## C30. Motion Studio Artifact Preview, Ephemeral Tool Isolation & Cross-Origin Sandpack (2026-11-12)

Upstream LibreChat lacked automated artifact syntax healing for LLMs that emit unclosed or malformed directives, lacked honor for `executeCode: false` on ephemeral model specifications (forcing the code-runner tool on specs that forbid it), and injected `X-Frame-Options: SAMEORIGIN` on self-hosted Sandpack static preview relays preventing cross-origin wildcard frame loading.

**Customization:**
1. **Model Specification Tool Isolation & Token Limit Retention (`packages/api/src/agents/load.ts`, `packages/api/src/endpoints/openai/llm.ts`)**:
   - Enforced `modelSpec.executeCode !== false` in `loadAgent` before registering `Tools.execute_code` on the ephemeral agent, hiding the `Run Code` UI toggle and preventing execution unauthorized errors.
   - Preserved `modelSpec.artifacts` propagation onto ephemeral agents.
   - Fixed `defaultParams` handling in `llm.ts` so spec-level `max_tokens` (e.g. 16,384 for Motion Studio) is not overwritten by gateway-level defaults (4,096).
2. **Artifact Syntax Heuristics & Stream State Management (`client/src/utils/artifactDirective.ts`, `client/src/hooks/Artifacts/useArtifacts.ts`, `client/src/components/Chat/Messages/Content/Markdown.tsx`)**:
   - Introduced `normalizeArtifactDirectives` to normalize custom container tags (e.g., `:::apartment-blueprint` -> `:::artifact`), auto-wrap uncontained `<!DOCTYPE html>` code blocks in `:::artifact{...}`, and seal open blocks during streaming.
   - Added stream completion latch in `useArtifacts.ts` so the viewer remains on `preview` upon submission finish without flicking back to code.
3. **Cross-Origin Wildcard Sandpack Static Preview & Vendor Script Delivery (`packages/api/src/artifacts/staticPreview.ts`, `api/server/index.js`, `client/public/assets/vendor/sandpack-static-preview/__csb_sw.rpfsli6sirrzs1630o3lgzuxwlr2uqc.js`, `client/src/utils/artifacts.ts`)**:
   - Stripped `X-Frame-Options` and set `Cross-Origin-Resource-Policy: cross-origin` and `Cross-Origin-Opener-Policy: unsafe-none` on `createStaticPreviewRelayMiddleware` responses so wildcard session hosts (`<hex>-ai.satchida.com`) can be embedded without frameguard violations.
   - Allowed cross-origin access to `/assets/vendor` and bypassed `__csb_sw` interception on vendor and cross-origin assets.
   - Configured `buildSandpackOptions` to route `externalResources` through `staticBundlerURL` (`https://ai.satchida.com`) to prevent private-network loopback blocks.

## C29. Satchida Motion Studio Engine, Offline Three.js Vendor & 70-Persona Navigator (2026-11-12)

Upstream LibreChat includes no motion-graphics studio mode, grouped persona navigator, or headless Playwright MP4/WebGL renderer.

**Customization:**
1. **Motion Studio Two-Tier Navigator & 70-Persona Catalog (`client/src/common/starters.ts`, `client/src/components/Chat/Input/ConversationStarters.tsx`, `client/src/locales/en/translation.json`)**:
   - Exported `MOTION_GROUPS` (5 Discipline Groups: `arch_engineering`, `robotics_how`, `stem_tech`, `business_creative`, `care_living`) and 20 `motion_*` categories containing 70 multi-slot simulation, CAD/floorplan, drone/UAV, robotics, cutaway, STEM/cyber, art/cartoon, medical, fitness/nutrition, home/interior, and WCAG AAA senior personas.
   - Added `hasGroupedNavigation` in `ConversationStarters.tsx` (1-row Discipline Groups + 8-card `4×2` `✨ Spotlight` grid + contextual sub-category filter pills + inline `role="searchbox"` search + dismissible `role="status"` staged coach banner) while keeping standard non-Motion modes unchanged.
   - Enforced `activeMode === 'Motion'` always-stage behavior into `#prompt-textarea` with `Tab`/`Shift+Tab` parameter cycling and automatic MCP server selection (`satchida-motion` plus domain companion MCP servers).
2. **Self-Hosted Three.js Vendor (`client/public/assets/vendor/three/`)**:
   - Vendored offline `three@0.128.0` UMD (`three.min.js` + `OrbitControls.js`) for air-gapped 3D WebGL artifacts without relying on external CDNs.
3. **Sovereign Motion MCP Renderer & Skill (`skill/satchida-motion-server.py`, `skill/satchida-motion/SKILL.md`, `.gitignore`'d `librechat.yaml`)**:
   - Added `window.__SEEK_FRAME__` deterministic frame-seeking, SwiftShader WebGL Chromium flags (`--use-gl=angle --use-angle=swiftshader --enable-webgl --ignore-gpu-blocklist`) fixing headless `CONTEXT_LOST_WEBGL`, local `/assets/vendor/three/` & `/assets/vendor/gsap/` `file:///` URI rewriting, 4 interactive reference archetypes (`cad_blueprint`, `interactive_3d`, `mechanism_cutaway`, `accessible_guide`), and expanded `validate_motion_html()`.
   - Updated the `Motion` model spec allowlist in `librechat.yaml` to bind 8 MCP servers (`satchida-motion`, `satchida-maker-engineering`, `satchida-stem-study`, `satchida-health-wellness`, `satchida-ai-engineer`, `satchida-work-suite`, `satchida-web-search`, `time-server`).

## C31. Always-stage starters + student STEM categories (2026-11-12)

Divergence from upstream LibreChat conversation-starters behavior:

1. **Upstream auto-submits plain starters; Satchida always stages.** `ConversationStarters.tsx`
   no longer calls `submitMessage` on card click — every persona card stages its prompt into the
   textarea for editing/customization first. This is a product decision for student personas: a
   click must never execute without the user's further input. Upstream merge will conflict here
   by design; keep the always-stage side.
2. **Three Satchida-only starter categories** in `client/src/common/starters.ts` (not upstream):
   `school_boards` (CBSE/IGCSE STEM), `textbook_navigator` (subject/book/chapter/page/paragraph
   navigation with anti-hallucination edition rules), `python_from_zero` (turn-locked lesson
   contract: one concept per turn, exercise, stop-and-wait, resume by lesson number). All copy
   localized via `starters_*` English keys; mirrored 3 suggestions into the Study mode
   `conversation_starters` in `librechat.yaml`.
