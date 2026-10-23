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
| D5  | `accountType` added to the User schema and `IUser` (`basic\|pro\|family\|privacy`, lowercase)                  | Absent                                                                                                  | This is the value the one-api seat linkage keys on (one-api resolves a seat's group by exact name). Lowercase is load-bearing: a mis-cased name silently bypasses one-api's `MaxSeats` cap.             |
| D6  | Admin user list/search/create/update live in `packages/api/src/admin/users.ts`; `/api` keeps wiring only       | User create (and bulk, and reset-password) were inline in `api/server/routes/admin/users.js` using `mongoose.models.*` | The repo's own rule is "`/api` holds wiring, not behaviour". Bulk and reset-password remain inline — recorded as outstanding.                                                                           |
| D7  | `GET /api/admin/verify` returns `isOperator` and `tenantId`                                                    | Returned `{ user }` only                                                                                | The panel inferred authority from `role === 'ADMIN' && tenantId in (undefined,'satchida-master')` — which mis-classifies every tenant admin (their role is also `ADMIN`).                                |
| D8  | `admin/` vanilla-JS panel is served at `/admin` by the API process                                             | Upstream expects the **AGPL-3.0** `LibreChat-AI/admin-panel` via `ADMIN_PANEL_URL`                       | Licensing: the AGPL panel cannot ship in a paid service (see C1). `admin/` is the clean replacement; upstream's `AdminPanel.tsx` link is retained.                                                      |

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

