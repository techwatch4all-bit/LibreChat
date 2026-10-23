# LibreChat Seat Identity and Mode Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this approved workstream task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Have each tenant LibreChat server bind authenticated local users to operator-provisioned opaque seats and select the correct cloud seat credential or tenant-local Privacy assertion without trusting browser-supplied identity.

**Architecture:** Follow `docs/SATCHIDA-END-TO-END-ROUTING.md`. Cloud Chat/Study/Work calls central One-API with the server-held `tk_` seat bearer. Privacy calls a tenant-local router with a short-lived signed assertion. A signed-in LibreChat user record supplies PII only within the tenant deployment; One-API receives only an opaque alias and server-validated seat policy. UI choices are advisory; backend policy is authoritative.

**Tech Stack:** Existing LibreChat TypeScript workspaces, Mongoose data-schemas, Express route wiring, React/Jotai mode selector, existing Jest tests.

## Gate and file map

- Preserve the large pre-existing worktree (currently dozens of modified/untracked files). Never run broad formatting/build regeneration that overwrites unrelated generated files.
- Existing `seatToken`, `accountType`, `familyRole`, tenant entitlement and mode-selector work must be inspected and reused. Do not duplicate a parallel user entitlement model.
- Expected files: server identity/seat service under `packages/api/src/tenancy/`, One-API client adapter injected into relevant handlers; current `packages/api/src/endpoints/openai/initialize.ts` and `custom/initialize.ts` bridge tests; data-schema user/method tests only if new server-held mapping is required; existing `SatchiModeSelector.tsx`/spec; localized English keys; `Changes.md` and `Customizations.md`.

## Tasks

### 1. Reconcile current auth and entitlement contracts
- [ ] Inventory current family/account fields, tenant entitlements, role capabilities, admin seats APIs, seatToken bridge and any pending local edits.
- [ ] Specify server-only request-context interface: tenant ID, local user ID, opaque seat alias, account type, server-owned family profile, allowed modes/capabilities, policy version, seat-token reference, local assertion reference.
- [ ] Define exactly where seat aliases/tokens are stored and how they are selected without exposing raw tokens in standard user responses, logs, client caches or analytics.
- [ ] Confirm operational secret mechanism for One-API tenant `vk_`, per-seat cloud `tk_`, and local assertion refresh credentials. Never place these in browser config or serialize them to client state.

### 2. Add failing bridge/auth tests (RED)
- [ ] Extend `packages/api/src/endpoints/openai/initialize.spec.ts` and `custom/initialize.spec.ts` for cloud credentials resolved server-side by seat and never caller-supplied.
- [ ] Test forged `X-Tenant-Id`, `X-Bifrost-User-Id`, `X-Profile-Type`, mode, account type and model fields cannot change authenticated server context or endpoint credential selection.
- [ ] Test family child mode selection allows Chat/Study, refuses Work/VibeCoder; adult Family Work is text-only; Pro tool capability requires server entitlement.
- [ ] Test Privacy chooses only local endpoint and assertion, does not initialize central One-API/Bifrost endpoint, and displays unavailable when local health/assertion is missing.
- [ ] Test account/seat reassignment failures leave current seat binding intact and never disclose newly issued bearer before durable binding succeeds.

### 3. Server-side seat resolver and credential lifecycle
- [ ] Implement dependency-injected resolver from authenticated LibreChat user to local tenant, opaque seat and One-API-issued metadata. Never derive identity from request headers or prompt JSON.
- [ ] Bind to One-API seat APIs described in the One-API workstream; keep tenant `vk_` strictly server-side.
- [ ] Handle seat disabled/expired/policy-version changes with stable error codes; invalidate relevant auth/request caches after mutation.
- [ ] For rotation/reassignment, retain previous binding until the new seat allocation succeeds and a single server-side state transition commits; define compensating revoke for partial upstream failure.
- [ ] Ensure account/profile edits require authorized admin capabilities and create audit records; Family child role changes are not self-service.

### 4. Mode and capability orchestration
- [ ] Derive available modes/capabilities server-side from entitlement + profile + local readiness. UI labels display server response only.
- [ ] Keep family child Chat and Study, deny Work and all Work tools; adult Family may select text Work; Pro may see configured work tools.
- [ ] Gate actual agent/MCP/code execution endpoints, not only selector buttons. Recheck on execution because conversation state may be stale or tampered.
- [ ] Ensure mode/model aliases, request body, conversation spec, and extraBody are cross-checked by server before provider initialization.
- [ ] Use `useLocalize()` and existing semantic primitives for mode UI copy; preserve keyboard/focus behavior and loading/disabled/unavailable/error states.

### 5. Bridge wiring and header handling
- [ ] Ensure custom endpoint `apiKey` is resolved per authenticated server-side seat for cloud and never from model/body metadata.
- [ ] Remove or deprecate client-origin `X-Tenant-Id` / `X-Bifrost-User-Id` as authorization claims; One-API must receive opaque attribution derived from its verified `tk_` token.
- [ ] For local Privacy, have server-side edge code retrieve/refresh assertion from operator policy API with metadata only; pass prompt only to local router.
- [ ] Ensure no redirect, endpoint switch or retry can send a Privacy payload to central cloud endpoints.

### 6. Verification
- [ ] Run focused tests in `packages/api`, `packages/data-schemas`, `packages/data-provider`, and `client` as touched; run `npx tsc --noEmit` in each modified workspace.
- [ ] Run `npm run build:data-provider`, relevant package builds, scoped import sorting and lint/static checks per `AGENTS.md`.
- [ ] Run `npm run lighthouse` for startup/auth/config/message-loading changes.
- [ ] Run browser tests on synthetic adult/child/Pro accounts for mode UX, tool affordance and denial paths; no real PII or live secret credentials in screenshots.
- [ ] Append a precise change entry to `Changes.md` and divergence reason to `Customizations.md` for every upstream divergence.
- [ ] Do not restart `:3080`, mutate production Mongo, or edit deployment secrets without separate rollout approval.

## Acceptance criteria

- A user’s authenticated tenant-local LibreChat session resolves to exactly one server-bound opaque seat; client claims cannot switch tenant, seat, profile, plan or credential.
- Cloud calls use only the mapped seat token to central One-API; no provider/VK secret reaches browser.
- Privacy calls only the tenant-local router with assertion; no cloud fallback path exists.
- Child/adult/Pro policies are enforced at server API execution boundaries, including direct MCP/agent/code endpoints.
- Tests prove successful routing, forged claims denied, stale policy denied, local unavailability behavior, and seat reassignment rollback.
