# LibreChat contributor and agent guidance

`AGENTS.md` is the repository's contributor guidance. Backend code lives in `packages/api`
(TypeScript) and `packages/data-schemas` (database methods); `api` is legacy Express wiring.
Shared API types and services live in `packages/data-provider`, and the React app lives in
`client` with shared primitives in `packages/client`.

## Branching and pull requests

Normally branch off `dev` and target `dev`; `gh pr create` defaults to `main`, so pass `--base dev`
explicitly. `main` is the released branch, kept as a fast-forward of `dev` and synced as-is — never
open a backport pull request to `main`, because anything merged to `dev` reaches it at the next
sync. Pull requests opened against `main` are retargeted automatically.

**Maintainer-directed canary exception:** Experimental work, or a PR ready to merge after review but
not yet suitable for the next `main` sync, may instead target `canary`. The maintainer may choose
this before work starts or while reviewing a stale PR. For new canary work, branch from the current
`origin/canary` and pass `--base canary` explicitly; do not silently retarget an existing PR or
promote canary code to `dev`. If a stale PR is redirected to canary, first check its base, diff and
reviewed head against current canary; coordinate any rebase or new PR with the maintainer. A PR
explicitly based on `canary` stays there; the main-to-dev retarget workflow does not move it.

Still link related issues in the PR (for example, `Related to #N`) so the work remains
traceable. `Fixes #N` does not close an issue on a `dev` or `canary` merge — GitHub honors closing
keywords only on the default branch. Close resolved issues by hand after merging. Worktrees share
one stash stack, so never use a bare `git stash pop`. Prefer a WIP commit; if a stash is necessary,
apply the specific tagged entry. The `target: main` label and release-bound upstream branches are
exempt from the main-to-dev retarget workflow; do not use either to backport ordinary work.

Write the description for a reader who has not followed the branch: what breaks, what triggers it,
how it behaves after the change, then one or two views of the mechanism — a focused diff, a call
tree, a shallow file tree, or a Mermaid sequence. Keep only what the change carries, and describe
the code as it stands rather than narrating earlier commits or review rounds. Naming the merged
pull request that caused the bug is not the same thing; that is history the reader needs. The
formats and examples live in `.github/pull_request_template.md`.

## Review and completion

Read the inline review threads themselves — a summary comment or notification list omits findings.
Audit each one against the current code, fix what is valid, and reject what is obsolete in a reply
that says why. After each round: focused tests, `npx tsc --noEmit` in every workspace you changed,
push, then request the next review naming the pull request's exact remote head — a clean review of
an earlier head says nothing about what you just pushed, and CI runs on its own clock. Reply on
each resolved thread with the resolving commit and evidence. After two actionable rounds, stop
patching thread by thread and read the subsystem by invariant instead: identity, authorization,
persistence, retry, cancellation, cleanup and mixed-version behavior where relevant. Which reviewer
and what phrase triggers it will change; that the review must cover the exact pushed head will not.

A clean review is one completion signal, not the definition of done. Ship the observable experience
— loading, empty, success, failure, cancellation, retry, restored session — with strings localized,
accessibility intact, defaults and stored data preserved, and no backend capability left without a
frontend entry point. Keep fixes small and test the missed behavior. Report the pushed head, what you
ran locally, CI state, the review result at that head, any finding you rejected with the reasoning,
and checks you could not run.

## Verification

For startup, auth, config, file, or message-loading changes, avoid serial database
reads and reuse loaded request data. Run `npm run lighthouse` before completion:
the CI lane adds 250 ms per Mongo query and checks the visible conversation's LCP.
See [budgets, reproduction and failure diagnosis](e2e/lighthouse/README.md).

A green build is not a typecheck: `packages/api`, `packages/client` and `packages/data-schemas` build
with `tsdown`, which emits without checking types. Run `npx tsc --noEmit` in the workspace you
changed. `packages/client` excludes `*.spec.ts(x)` and `*.test.ts(x)` from typechecking entirely.
`npm run sort-imports` with no arguments rewrites every source root — pass the paths you touched.
Run `npm run static-checks -- --against origin/dev` to reproduce the PR's static checks; use
`npm run static-checks:full` for the slower gates. Fix all formatting, lint, and TypeScript
warnings/errors in the code you change.

## Module boundaries and configuration

All new backend behavior belongs in TypeScript under `packages/api`; database-specific shared logic
belongs in `packages/data-schemas`, and frontend/backend shared API logic belongs in
`packages/data-provider`. Build data-provider from the project root with `npm run build:data-provider`.

`/api` holds wiring, not behavior. When a change would add logic to a CJS file there — a branch, a
helper, a validation step, a service call — the logic belongs in `packages/api`, and the JS file
keeps requires, route registration and the call into the TS module (`MCPRequestContext.js` is the
shape, thirteen lines of re-export). "Minimum" means how much behavior `/api` gains, not how small
the diff is, and the rule applies to editing existing CJS, which is the common case.

Database contracts belong to `packages/data-schemas`. Keep Mongoose types (`FilterQuery`,
`Types.ObjectId`, `Document`) out of exported signatures in `packages/api`, `packages/data-provider`
and `client`, because they make the storage engine part of that module's public API. Take and return
plain typed objects and express the query behind a data-schemas method. The boundary already leaks
across `packages/api`, so stop widening it rather than rewriting what exists; the client carries none
of it and must stay that way.

New levers ship configurable: a limit, timeout, toggle or capability introduced in code earns a field
on `configSchema` (`packages/data-provider/src/config.ts`) so it can be set in `librechat.yaml`, with
a default that reproduces today's behavior. Hard-coded constants and env-only switches need a reason.
Modules take their dependencies rather than reaching for them: code in `packages/api` receives its
config, database methods and clients from the caller, the way `createModels(mongoose)` receives the
app's connection, instead of importing app singletons or reading global state. Integrations (provider
SDKs, storage backends, vector stores, OAuth servers) arrive through an interface the caller
supplies, so a second implementation is a new argument instead of a new branch. The static singletons
under `packages/api/src/mcp` are the shape to stop extending, not a pattern to copy. This is the
backend half of client state ownership: pass it in, do not reach for it.

## Service failures and user-facing errors

This section applies to backend services (`packages/api`) and database methods/repositories
(`packages/data-schemas`), not to React components. For new or substantially changed code in
those layers, choose failure behavior at the contract boundary instead of treating every
unsuccessful outcome as an exception:

- Return a plain value on success. Use `null` only for a documented absence (for example, a
  successful lookup with no record), never to hide a query failure.
- For an expected failure the caller can handle without aborting the operation, prefer a typed
  discriminated result such as `{ ok: true; value: T } | { ok: false; error: { code: string;
  message?: string } }`. Keep an existing domain-specific result shape when changing it would
  break callers; do not introduce interchangeable `ok`, `valid`, and bare `{ message }` contracts
  in the same service. Codes should be stable, machine-readable identifiers when the caller
  needs to distinguish failures. Internal validation helpers may use the existing local pattern.
- Throw for unexpected operational failures (database, provider, network) and violated invariants.
  Use a typed/coded error when a boundary must recognize a particular failure. Catch where you can
  recover or translate it; otherwise let it reach the owning request or job boundary. Do not catch
  an exception and return a truthy record, `null`, or `{ message }` in its place: callers can then
  mistake an outage for data or send it as an HTTP 200. Keep separate migrations for existing
  contracts, with their callers and tests, rather than changing wire shapes incidentally.
- At the HTTP, stream, or job boundary, map failures to the existing status and response contract.
  Only expose intentionally approved codes and helpful user-safe information. Error disclosure is
  a security boundary: never forward raw exceptions, stacks, query text, credentials, request
  bodies, headers, provider payloads, or arbitrary `error.message` to a client or persisted
  user-visible status. Sanitize diagnostics and log only what the path can safely retain. For
  errors that may echo submitted content, prefer `getSafeErrorMetadata` over error text;
  `packages/api/src/utils/errors.ts` documents when redacted error text is appropriate.
- Localization is a UI responsibility, not a database-method return shape. When a failure reaches
  a user-facing surface, expose a safe, stable code the UI can map to localized, actionable copy
  and a fallback. See `client/src/components/Messages/Content/Error/registry.ts` and
  `client/src/components/Chat/Trace/Viewer.tsx`. Keep any intentionally disclosed provider detail
  behind its existing protection policy rather than treating arbitrary upstream text as safe.

Examples of local contracts, not a mandate to copy their shapes: `packages/api/src/admin/auditLog.ts`
uses a parsing result, `packages/api/src/agents/openai/service.ts` validates before mapping to an
OpenAI-compatible response, and `packages/api/src/skills/sync/errors.ts` names a sync failure by
stable code. `packages/data-schemas/src/methods/prompt.ts` currently returns `{ message }` on query
failure; do not extend that pattern. Test absence versus failure, the boundary's non-success response,
and that sensitive diagnostics cannot reach a user-visible surface.

## Frontend theming and styling

For frontend work, compose existing `@librechat/client` primitives and variants before adding
feature-local styles. Use semantic theme/Tailwind roles for color and shared appearance; do not
introduce raw palette utilities, hard-coded colors, or arbitrary theme CSS. If the system cannot
express a reusable design need, deepen the shared primitive or versioned theme-token registry
instead of copying classes into a feature. Theme definitions select semantic colors and appearance,
not selectors, app behavior, or alternate layouts. Keep genuine layout and behavior local, and
explain why any new custom CSS cannot use shared primitives. Support light/dark and reduced motion;
preserve defaults and test a deliberately different reference theme for reusable new variants.

## Backend auth cache

When adding or changing code that mutates user documents, invalidate the auth user document cache
for affected users, including bulk role and user mutations. Otherwise burst-cached JWT requests can
serve a stale `req.user` until the cache expires.

## Client state ownership

The client is migrating from Recoil to Jotai. New state is always Jotai, even in a file that already
imports Recoil; many files import both, so mixed imports say nothing about which to use. For existing
state the unit of conversion is one atom plus every file that reads or writes it, because an atom
cannot be half converted — convert the areas you touch, not the whole store.
Split by ownership: state a feature both writes and reads is feature-owned, so convert it to Jotai
and keep it inside the feature; app-global preferences and shell state a feature merely consumes
(`maximizeChatSpace`, `showScrollButton`, `enterToSend`, artifact visibility) must be passed in
through props or a small host-supplied context rather than reached for through `~/store`; when a
consumer sits outside the feature you are changing, leave that atom on Recoil and pass it in. Passing
them in is what lets a feature move to its own workspace later without a rewrite, and it keeps the
Jotai conversion scoped to the state a feature owns. For persisted atoms, use the helpers in
`client/src/store/jotai-utils.ts`.

## Code style and performance

Use short, single-word file names when possible; group related modules in a single-word directory.
Prefer flat early returns, pure functions, and explicit types. Avoid `any`, broad `unknown`/casts,
duplicated types, and dynamic imports. Extract genuinely repeated logic instead of copying it;
write comments only for non-obvious behavior or public API contracts.

Imports have three sections: package values (shortest line first, with `react` first), `import type`
(longest line first, package types before local types), and local/project values (longest line first).
Use standalone `import type { ... }`, not inline `type` within a value import. Run the scoped
import sorter on files you change.

Avoid extra passes over shared message arrays and unnecessary allocations. For startup and
request paths, reuse already-loaded user/config data, avoid serial database reads, and start
independent reads in parallel. Do not weaken authorization or tenant checks or write a response
before those checks succeed.

## Frontend rules

Use `useLocalize()` for all visible copy and update only English keys in
`client/src/locales/en/translation.json`. Use semantic HTML, keyboard behavior, and ARIA labels.
Use React Query for API interactions and invalidate related queries after mutations; define query
and mutation keys in `packages/data-provider/src/keys.ts`. Put shared endpoint definitions, types,
and data services in `packages/data-provider`, and encode dynamic URL parameters. Cover loading,
success, and failure states in focused component tests.

## Testing

Run focused Jest tests from the owning workspace, not the entire monorepo. Prefer real logic and
spies over mocked internals; use `mongodb-memory-server` for database queries and the real MCP SDK
for MCP behavior. Mock only external HTTP APIs or uncontrollable services. For frontend tests use
the component's colocated `__tests__` and `test/layout-test-utils` where applicable.

---

# Satchida AI Harness (this fork)

Everything above is upstream LibreChat contributor guidance and still applies unchanged. This
section describes the product layer added on top. Read `ARCHITECTURE.md` for the full design,
`Implementation-plan.md` for sequencing, `Customizations.md` for divergence from upstream,
`Changes.md` for history, and `Bugs.md` for known issues.

## What this fork is

A community and SMB AI harness served over VPN, with web and Android clients, Google-based
registration, subscription tiers, and UPI payments.

## Reuse upstream rather than rebuilding it

Before writing any plan, quota, gating, or auth code, check whether it already exists:

- **Feature gating by tier** — `packages/data-schemas/src/schema/role.ts` plus
  `PermissionTypes` in `packages/data-provider/src/permissions.ts`. A plan is a named bundle
  of a role, a balance configuration, and an interface feature set — not a new entitlement
  system.
- **Daily / weekly / monthly token quotas** — `packages/data-schemas/src/schema/balance.ts`.
  `tokenCredits`, `autoRefillEnabled`, `refillIntervalValue`, `refillIntervalUnit`;
  `REFILL_INTERVAL_UNITS` already covers `days`, `weeks`, `months`. Enforced by
  `packages/api/src/middleware/checkBalance.ts`. Off by default (`balance.enabled`).
- **Google registration** — configuration only. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`,
  the `googleId` field on the user schema, and `packages/api/src/auth/googleRefresh.ts`.
- **Operator API surface** — `packages/api/src/admin/*` already serves users, roles, groups,
  config, grants, and audit logs.

## Components: never clone these

- `LibreChat-AI/agents` is the npm package `@librechat/agents`, already a dependency at
  `^4.0.1`. It is not a service. Do not add it to compose.
- `LibreChat-AI/rag-api` is already wired in compose (`rag_api` service, `RAG_API_URL`,
  `rag.yml`). Configuration only.
- `LibreChat-AI/code-interpreter` is reached over HTTP via `CODE_API_KEY` and has **no** compose
  service upstream. Deploying it is our work.
- `LibreChat-AI/quickbooks-online-mcp` is an MCP server registration, not a code change.
- `LibreChat-AI/static-browser-server` is obsolete (last pushed April 2025, zero references).
  Do not integrate.
- `LibreChat-AI/admin-panel` is **AGPL-3.0** and is deliberately not shipped. See
  `ARCHITECTURE.md` §3.

## Product-layer conventions

- Plan, subscription, and payment records belong in `packages/data-schemas`. Business logic
  belongs in `packages/api`. The service-failure and error-disclosure rules above apply in
  full: typed discriminated results for expected failures, throws for operational failures, and
  no raw exception text, provider payload, or stack reaching a user-visible status.
- Payment provider choice is a `configSchema` lever (`payments.provider`, default `'manual'`),
  not a branch in a handler. `ManualUpiProvider` is live; `RazorpayUpiProvider` is implemented
  but inactive until an account exists.
- Plan changes against `balance.lastRefill` need explicitly defined semantics (prorate, reset,
  or preserve) before the assignment service is written. See `Bugs.md` §B2.
- New user-facing copy goes through `useLocalize()` with English keys in
  `client/src/locales/en/translation.json`, per the frontend rules above.
- Rebranding swaps theme tokens and assets, never raw colors.

## Workflow for this fork

- `origin` currently points at upstream LibreChat, not a fork. Create the fork remote and a
  `satchida/` branch off `dev` before writing code.
- Record every divergence from upstream in `Customizations.md` and every state change in
  `Changes.md`. The point is that an upstream-difference review stays auditable.
- Run `git fetch --unshallow` if history is needed; the clone was made with `--depth=1`.

---

## Satchida Distributed Multi-Tenant Architecture Rules

Applies to any AI agent or contributor modifying this tree for the Satchida distributed deployment:

### 1. Zero Cloud VPS & Zero VPN Directive
- Never suggest or configure paid cloud relays (Headscale, DERP, or WireGuard VPS).
- All external connectivity runs over **Cloudflare Zero Trust Named Tunnels (`cloudflared`)** using domain `satchida.com`.
- Traffic is outbound-only over HTTPS/QUIC, bypassing symmetric Jio/Airtel CGNAT.

### 2. Physical Tenant Isolation
- Each client (school, SME) runs a standalone edge node with its own native MongoDB database.
- Never write multi-tenant sharing code that commingles different client organizations into one database.

### 3. Master Credential Protection (Zero-Knowledge)
- Real OpenAI, Anthropic, Gemini, and DeepSeek API keys **must NEVER exist on client machines**.
- Client configurations point to the local AutoRouter (`127.0.0.1:4000`), which proxies through Seller Central HQ (`control.satchida.com`) where master keys are injected in-flight.

### 4. Native Bare-Metal Windows Runtime
- Docker is not used on Windows client machines.
- All services (LibreChat, MongoDB, `cloudflared`, `rag-service`, PM2) execute natively on Windows 11 Pro/Enterprise.
- Windows power management must be hardened (`standby-timeout-ac 0`) on every deployed node.

### 5. Remote Policy & Heartbeat Protocol
- Client nodes poll `https://control.satchida.com/api/v1/fleet/heartbeat` every 15–30s.
- All requests must include an HMAC-SHA256 signature calculated from the client's provisioned secret.

### 6. Local llama fleet (:8080) — HARD INVARIANTS

These are non-negotiable. Violating any of them has already destroyed the user's dynamic
model-selection dropdown once (2026-11-10); it must never happen again.

- Port **8080 is the Tauri-managed llama fleet**, never a single-model server. The only
  sanctioned launch profile mirrors `satchida-tauri/src-tauri/src/lib.rs` exactly:
  `llama-server.exe --models-preset D:\LAN-AI-Infra\satchida-ai-unified-suite\models-preset.ini
  --models-max 1 --no-models-autoload --ctx-size 32768 --jinja --parallel 1 --flash-attn auto
  --n-gpu-layers 999 --device CUDA0 --split-mode none --main-gpu 0 --ui-mcp-proxy
  --host 0.0.0.0 --port 8080`.
- **NEVER** start :8080 with a bare `--model <file>`. That collapses `/v1/models` to one
  entry and wipes the model-selection dropdown. `start-local-backend.ps1` under
  `D:\LAN-AI-Infra\LLM harness fix for llama server` is the **executor decoding profile**
  for the guardrail/executor use case — it is **NOT** the chat-fleet launcher and must
  never be pointed at :8080 by agents or watchdogs.
- **NEVER** `taskkill /IM llama-server.exe` (or kill the llama process by image name) as a
  first move: the running process may be Tauri-spawned with a user-loaded model. A
  watchdog may act **only** when the `/health` probe fails, and must never restart, stop,
  or re-configure a live instance.
- `--no-models-autoload` is a deliberate design decision (a fresh boot loads nothing until
  the user or the system selects a model) — never "fix" or remove it. A programmatic
  default-model load is allowed **only** immediately after a watchdog cold start, via
  `POST http://127.0.0.1:8080/models/load {"model":"Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0"}`,
  and only when no model reports a loaded status (`/v1/models`, OpenAI-style `data` array).
  The watchdog reference implementation is `D:\LAN-AI-Infra\ops-scripts\llama-watchdog.mjs`
  (PM2 `llama-watchdog`); any change to fleet launch flags must keep it byte-consistent
  with the Tauri source.
- `models-preset.ini` is **generated by Tauri** by scanning `C:\LAN-AI-Infra\LLM-models` and
  `D:\LAN-AI-Infra\LLM-models`. To add a model, drop its `.gguf` into one of those
  directories — never hand-edit the INI as a fix for a missing model.
- llama.cpp build flags (the deployed `Satchida-AI-Interface/llama-cpp-cuda` build):
  `--stop` and `--no-penalize-nl` do not exist (use `--reverse-prompt`); `--reasoning-budget`
  is ignored by the Ternary-Bonsai template — use `--reasoning off`; multi-line stop strings
  cannot survive PowerShell `Start-Process` argument joining.
- Node child-process gotcha on this machine: spawning with `detached: true` and
  `windowsHide: true` together silently kills the spawned process — use `windowsHide`
  alone. Reference: `skill/llama-fleet-troubleshoot/SKILL.md` (triage order: server →
  model → autostart → resources; stop at the first red layer; never restart or switch
  models without user confirmation).

### 7. In-Repo Self-Containment & UI Confinement Law (NON-NEGOTIABLE)

1. **Zero External Dependency / Tool / Binary Leaks**:
   - Every tool, browser binary, runtime script, submodule, skill, and configuration required by LibreChat or Satchida must live **inside** the `LibreChat` repository directory:
     - Dependent repositories and submodules belong under `d:\LAN-AI-Infra\LibreChat\repos\<repo-name>`.
     - Headless browsers (Playwright Chromium, FFmpeg, shell binaries) belong under `d:\LAN-AI-Infra\LibreChat\browsers\` — **NEVER** depend on `%LOCALAPPDATA%\ms-playwright` or user-profile directories.
     - Project runtime profiles, sessions, and screen recordings belong under `d:\LAN-AI-Infra\LibreChat\vibe-apps\<projectId>\`.
     - Deployment skills belong under `d:\LAN-AI-Infra\LibreChat\skill\<skill-name>\SKILL.md`.
     - Agent personas, XDG configs, and tool exception definitions belong under `d:\LAN-AI-Infra\LibreChat\repos\opencode\xdg-config\`.
   - **Absolute Path Prohibition**: Never hardcode developer or host user paths (e.g., `C:\Users\WinDiesel\...`, `~/.gemini/config/skills`, `/Users/...`, `~/.config/...`). Always resolve paths dynamically relative to repository root (`path.resolve(__dirname, '...')`), workspace root, or sovereign environment variables. This ensures cloning or copying the repository to any client tenant edge node runs out-of-the-box with zero host path repair.

2. **Installation Directive for New Features & Packages**:
   - When installing new tools, CLI utilities, headless browsers, or dependencies:
     - Binary packages must be installed into local repo roots (`./browsers/`, `./repos/`, or `./node_modules/`).
     - Configuration files must be saved under repo-managed directories (`./repos/`, `./config/`, or `./skill/`).
     - Any auto-install script must specify destination flags (e.g. `PLAYWRIGHT_BROWSERS_PATH=browsers` for Playwright) to guarantee containment.

3. **Never Jump Out of the LibreChat UI**:
   - The user must **never** be directed to external raw URLs, new browser windows, or localhost server ports (e.g. `http://localhost:3080/assets/...`).
   - All visual, motion, art, CAD, audio, and studio deliverables **MUST** render natively within the LibreChat interface:
     - Render through **Artifacts** (`:::artifact{identifier="..." type="application/vnd.librechat.film" ...}`) or the **Satchida Studio Side Panel** (`OpenFilmStudio.tsx` / `ArtifactTabs.tsx`).
     - Procedural artwork, images, and documents must display as in-chat media previews or within the embedded **Studio Library** panel.
   - Any animation, motion graphics, or video preview must run with its timeline scrubber, foley audio controls, and MP4 export buttons contained entirely within LibreChat's embedded side-panel sandbox.

### 8. Strict Credential & Password Immutability Directive (NON-NEGOTIABLE)
- **Zero Automated Password Overwrites**: No script, subagent, automated test, or AI assistant is ever authorized to change, reset, or overwrite passwords or credentials (especially for `admin@satchida.com`, `root`, or local accounts) without explicit, real-time user confirmation.
- **Strict 2FA Immutability & Anti-Purge Law**: AI agents and automated testing scripts are **STRICTLY PROHIBITED** from disabling, resetting, or tampering with `twoFactorEnabled`, `totpSecret`, or `backupCodes` in MongoDB (e.g., via `updateOne({ $set: { twoFactorEnabled: false } })`). Any automated verification test must use mock session contexts or test-specific ephemeral users; it must **NEVER** turn off 2FA on `admin@satchida.com`.
- **Zero In-Repo Break-Glass Scripts**: Ad-hoc scripts (e.g. `restore_admin_credentials.js`, `disable_2fa_admin.js`, `set_admin_pwd.js`, `reset-admin-pwd.js`) in `scripts/`, `scratch/`, or `satchida/ops/` are forbidden and must be purged. Emergency procedures must be gated by the out-of-band Sovereign Operator Passphrase Seal.
- **Mandatory Root Passphrase Authorization**: Modification of the root/superadmin password requires explicit verification of the designated cryptographic root authorization passphrase. Any request, script, or automated tool lacking this passphrase must be strictly rejected at both the API and database levels.
- **Tenant Node Protection & Multi-Tier DB RBAC**: On client/tenant edge installations, local database access must be guarded against unauthorized administrative escalation. MongoDB must enforce `security.authorization: enabled` with three discrete tiers: Sovereign Operator (`satchida_operator` on `admin`), LibreChat Engine (`librechat_app` on `LibreChat`), and Tenant Admin (`tenant_admin_ro` read-only).

### 9. End-User Login, Per-User Seat Token (`seatToken`), Mode Policy & Bifrost Virtual Key (`x-bf-vk`) Invariants (NON-NEGOTIABLE)

Every AI agent and contributor must strictly distinguish the three authentication and routing layers in the Satchida stack and **never conflate or bypass them**:

1. **Mandatory Satchida Gateway Routing (One-API :4000) — HARD LINE DIRECTIVE**:
   - **All traffic from LibreChat MUST flow through Satchida Gateway (`http://127.0.0.1:4000`, One-API)** before reaching Bifrost or any external upstream provider.
   - Never configure LibreChat services, proxies, or voice backends to connect directly or exclusively to Bifrost or external endpoints, bypassing One-API.
   - For Live Voice / Realtime on Pro, Privacy, and Pro_Family seats, the request must be authenticated with the user's `seatToken`, sent to Satchida Gateway (`:4000`), and the gateway channels/abilities must route the `Motion` model directly to Bifrost under the designated channel virtual key so that Bifrost triggers `rule-motion-realtime`.

2. **Three Distinct Credentials — Never Conflate Them**:
   - **End-User JWT (`req.user` / `?token=<jwt>` / `refreshToken` cookie)**: Authenticates the logged-in LibreChat user (`JWT_SECRET` / `JWT_REFRESH_SECRET`).
   - **Per-User Satchida Seat Token (`user.seatToken`, `tk_<tenant>_...`)**: Stored on the MongoDB `User` document (`select: false` — must be hydrated explicitly via `+seatToken +satchidaSeatAlias`). This is the user's personal bearer credential for **Satchida Gateway One-API (`http://127.0.0.1:4000`)**, which enforces per-seat quotas, tier entitlements, and seat billing attribution.
   - **Mode-Scoped Bifrost Virtual Key (`x-bf-vk`, 96-character key in `one-api.db` `channels`)**: The gateway-to-Bifrost (`http://127.0.0.1:8700`) channel key:
     - Channel 1 (`Cloud Retaining`) -> `Chat`, `Pro`, `Motion`
     - Channel 2 (`llamacpp-privacy-primary`) -> Local `Privacy` (`:8080`)
     - Channel 4 (`Cloud ZDR`) -> Cloud Zero-Data-Retention (`ZDR`)
     - Channel 5 (`Cloud WorkStudy`) -> `Work`, `Study`
     - **CRITICAL**: `SATCHIDA_GATEWAY_VK` in `.env` (`SPYfLW6...`, 48 chars) is a One-API (`:4000`) token, **NOT** a Bifrost (`:8700`) `x-bf-vk`. Sending `SATCHIDA_GATEWAY_VK` as `x-bf-vk` directly to Bifrost (`:8700`) will always fail with `HTTP 401 Unauthorized`. Always use `selectBifrostVkForMode()` (`packages/api/src/voice/realtimeProxy.ts`) to resolve the 96-char channel virtual key from `BIFROST_VIRTUAL_KEY` or `one-api.db`.

2. **Zero End-User Login or Seat Token Bypass (Fail-Closed)**:
   - Every HTTP route and WebSocket upgrade handler (`/api/voice/realtime`, `/api/opencode`, `/api/ide`, `/api/agents/chat`) **MUST** require a valid end-user JWT before upgrading or executing. Anonymous connections must be rejected immediately with `HTTP 401 Unauthorized`.
   - Once the JWT is verified, the handler **MUST** hydrate the user record from MongoDB (`+seatToken +satchidaSeatAlias accountType tenantId role familyRole suspended`) and verify:
     1. The user exists and `suspended !== true` (`account_unauthorized`).
     2. The user's `accountType` is entitled to the feature (e.g., `ENTITLED_LIVE_VOICE_TIERS = {'pro', 'pro_family', 'enterprise', 'privacy'}` for Live Voice) — never rely solely on a frontend UI gate.
     3. The user has a non-empty `user.seatToken` (`seat_not_provisioned`). **Never** silently fall back to an operator or system key (`SATCHIDA_GATEWAY_VK`) when `user.seatToken` is missing or when a request is unauthenticated.
     4. The requested Satchida mode (`Chat`, `Study`, `Work`, `Pro`, `Privacy`, `Vibecoding`) and tool usage (`hasTools`) are permitted by the user's `accountType` and `familyRole` (`minor`/`child` seats are strictly barred from `Work`, `Pro`, `Vibecoding`, and tool execution).

3. **Mandatory Attribution & Mode Headers**:
   - Every upstream request to One-API (`:4000`), Bifrost (`:8700`), or local Privacy llama (`:8080`) must include `X-Tenant-Id`, `X-User-Id`, `X-User-Name`, `X-Seat-Alias` (`satchidaSeatAlias`), `X-Satchida-Mode`, `X-Bifrost-Mode`, and `x-bf-dim-*` (`buildSatchidaAttributionHeaders` in `packages/api/src/voice/realtimeProxy.ts` and `packages/api/src/endpoints/openai/config.ts`).
   - Run `npx --prefix packages/api jest src/voice/realtimeProxy.spec.ts` whenever touching voice, seat-token, or gateway routing code to verify all 9 fail-closed login/seat/mode security gates pass.
