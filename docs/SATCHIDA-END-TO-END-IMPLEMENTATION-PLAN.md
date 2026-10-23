# Satchida End-to-End Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement approved workstream plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This coordinator plan does not authorize runtime deployment, live provider/VK changes, production data migration, or service restart.

**Goal:** Deliver and verify the tenant LibreChat → operator One-API → operator Bifrost → approved cloud provider path, while keeping Privacy inference exclusively on each tenant's local GPU.

**Architecture:** See `D:\LAN-AI-Infra\LibreChat\docs\SATCHIDA-END-TO-END-ROUTING.md`. One-API is the central tenant/seat policy and billing authority. Bifrost is the central provider-key custody and cloud provider gateway, with one VK per tenant. LibreChat is separately deployed for each tenant and maps its authenticated local user to an opaque seat. Privacy bypasses operator One-API and Bifrost after a metadata-only policy assertion refresh; prompt and response stay tenant-local. Family children get Chat+Study, not Work. Family adult Work is text-only; Work tools/MCP/code/VibeCoder are Pro-only.

**Tech Stack:** Go/Gin/GORM/SQLite (One-API); Go, multi-module workspace, FastHTTP and config-managed plugins (Bifrost); TypeScript/React/Mongoose/LibreChat config (LibreChat); native Node/TypeScript tenant-edge Privacy router and existing llama.cpp/Ollama endpoints.

## Scope and gates

- This is a cross-repository coordinator. The first implementation stage is blocked on the One-API repository's strict ordered queue: an item may start only when all earlier queue entries are complete. The active queue is currently headed by `[NEW-API-PARITY]`; do not silently skip it. The operator must choose either to execute the queue serially or explicitly reorder it in One-API's authoritative tracker.
- LibreChat, One-API, and Bifrost each have extensive pre-existing changes. Every implementation plan must scope edits to named files and avoid formatting, regenerating, staging, or reverting unrelated content.
- Bifrost requires its own readiness Gates A–C. Provider credential/VK setup and paid inference probes need separate operator approval. Bifrost harness commands run only on an isolated Bifrost instance; never use the live shared profile for tests.
- Production DB mutation, applied schema migration, service restart/hot swap, public tunnel changes, provider/VK changes, paid requests, child-seat policy migration, and credential rotation remain separately approval-gated rollout operations.
- No identity header, account UI, model name, or LibreChat client state is an authorization source. Entitlements and seat profile are resolved server-side.
- No user PII, prompt or response body is sent to operator services for Privacy mode. Cloud prompt data crosses One-API/Bifrost only for modes explicitly marked cloud.

## Workstream map and owned files

### A. One-API cloud authorization and accounting

**Plan:** `D:\LAN-AI-Infra\one-api\docs\superpowers\plans\2026-10-19-e2e-cloud-authorization-accounting.md`  
**Owners:** `model/tenant_token.go`, `model/group.go`, `model/tenant.go`, `middleware/tenant_token_auth.go`, `middleware/satchida_enforcer.go`, `middleware/quota_window.go`, `middleware/distributor.go`, `middleware/utils.go`, `relay/meta/relay_meta.go`, `relay/adaptor/common.go`, `relay/controller/helper.go`, `relay/controller/text.go`, `router/relay.go`, corresponding existing tests, provisioning script, active tracker updates after ordered-queue approval.

Deliver trusted Family adult/child profile binding; exact policy intersection for plan/seat/group/token/channel abilities; fail-closed reservations; tenant-specific Bifrost VK reference/use; idempotent actual/estimated cost settlement; safe opaque attribution; cloud-mode routing only. No One-API Privacy route may dispatch central local channels for tenant traffic.

### B. Tenant-local Privacy router and assertion contract

**Plan:** `D:\LAN-AI-Infra\LibreChat\docs\plans\2026-10-19-tenant-local-privacy-router.md`  
**Owners:** new isolated module under `D:\LAN-AI-Infra\LibreChat\fleet\src\privacy\` (or a separately located edge runtime if the product owner moves it), focused tests under `fleet/test/`, minimal config contract and runbook in `fleet/README.md` or a dedicated docs file.

Deliver short-lived signed assertion validation, versioned/revocable policy bounded by assertion expiry, tenant-loopback-only model dispatch, local health/readiness and child safety hook interfaces, structured safe errors, no cloud fallback, bounded local rate/concurrency protection, redacted metadata logs. Signing occurs only on the operator host using configured key custody; do not add or commit private keys. The existing development gateway is not silently replaced or repurposed.

### C. LibreChat identity and request orchestration

**Plan:** `D:\LAN-AI-Infra\LibreChat\docs\plans\2026-10-19-librechat-seat-routing.md`  
**Owners:** `packages/api/src/endpoints/openai/initialize.ts`, `packages/api/src/endpoints/custom/initialize.ts`, server-side seat resolver in `packages/api/src/tenancy/`, `packages/data-schemas/src/schema/user.ts` and tenant entitlement/policy methods, `api/server/routes/admin/users.js` wiring only, relevant existing handler/bridge tests, `client/src/components/Chat/Input/SatchiModeSelector.tsx`, mode selector tests, `librechat.yaml` only after config review, `Changes.md`, `Customizations.md`.

Deliver authenticated local-user→opaque-seat lookup, distinct cloud `tk_` vs local Privacy assertion credentials, account/profile mode UX consistent with server authority, Family/Pro capability display, and server-side request credential selection. Remove/stop using untrusted gateway telemetry as auth. No raw seat or VK secrets in API responses/UI beyond one-time issuance where applicable. Do not widen admin API scope.

### D. Bifrost cloud readiness, attribution and streaming

**Plan:** `D:\LAN-AI-Infra\Bifrost\bifrost\docs\plans\2026-10-19-cloud-vk-and-streaming-readiness.md`  
**Owners:** focused files in `core/providers/openai/`, existing `transports/bifrost-http/handlers/` and `lib/` tests, `plugins/paramspolicy/` only if an uncommitted change is reviewed and verified, config schema, provider harness collection via surgical fixture insertion, Bifrost `todo.md`/`Bugs.md` status.

Deliver source-build regressions for auth, tenant VK provider/model constraints, trusted attribution semantics, valid streaming contract (including empty/truncated provider streams), content logging, explicit mode mapping, health/catalog semantics. Reconcile finding IDs before editing (empty-stream repair is BIF-024, not the Windows console BIF-026). Do not edit the already modified OpenAI or inference handler files until their full diffs and owning intent are reviewed. Do not configure live provider keys/VKs or restart `:8700` in source work.

### E. Cross-system provisioning, revocation, audit and operational E2E

**Plan:** `D:\LAN-AI-Infra\LibreChat\docs\plans\2026-10-19-tenant-provisioning-and-e2e-operations.md`  
**Owners:** One-API tenant/token APIs and existing provisioning scripts, LibreChat admin seat assignment/tenant config, Bifrost VK references and redacted readiness probes, controlled test-only fixtures, runbooks and evidence outputs.

Deliver synthetic-tenant provisioning/revocation lifecycle, Family seat assignment, cloud VK binding, local Privacy assertion issuance, auditable metadata, safe readiness/error reporting, rollback instructions, and a tested staged E2E harness without production PII or credentials. Live tenant data and external routing remain outside this source plan.

## Dependency order

1. Resolve One-API queue ordering and approve the workstream plans. Verify exact dirty-file ownership before edits.
2. Define versioned identity and policy contracts first: tenant ID, opaque seat alias, account type, server-owned profile, allowed modes/capabilities, policy version, stable request ID, cloud VK reference, local assertion audience/expiry. No component may invent a competing identity format.
3. Implement One-API cloud enforcement and fail-closed accounting in isolated DB/tests. It provides the authoritative seat and policy APIs needed by LibreChat.
4. Implement the tenant-local Privacy router against the signed assertion contract and fake/local upstream. Prove no cloud route exists for Privacy.
5. Wire LibreChat server-side seat binding and endpoint credential selection. Keep UI changes small, localized, accessible, tested and secondary to backend enforcement.
6. Complete Bifrost VK/provider/streaming test gates against isolated config; configure a test tenant VK only after operator approval.
7. Integrate provisioning and run staged synthetic E2E from LibreChat user to mock cloud and local fake model. Test negative policy, ledger outage, service outage, revocation, streaming, and rollback.
8. Update cross-repo status/docs with exact tested commit/build/config versions. Request a separately approved deployment window before live DB migration, paid provider probe, tunnel exposure, or process restart.

## Coordinator acceptance criteria

- Chat and Study cloud requests: tenant LibreChat server resolves the authenticated local account to a server-held seat token; central One-API verifies active tenant/seat and intersection of plan/profile/group/token/model/channel policy; atomically reserves applicable tenant/seat limits; calls Bifrost using only the tenant-specific VK; Bifrost verifies VK and provider/model allowlists; response/stream and usage return; One-API settles exactly once with actual/estimated cost provenance.
- Family adult Work: text-only cloud route allowed; MCP/agent/tool/code/VibeCoder paths are denied at execution boundary.
- Family child: Chat+Study only; Work/VibeCoder/MCP/code/image/audio denied; cloud/local child safety is fail-closed; request-supplied profile is ignored.
- Pro tools: only explicitly allowlisted Pro tenant tools may execute; denial also holds on direct API/tool-call attempts, not only hidden UI controls.
- Privacy: local assertion is validated by tenant router; prompt/response only touch tenant processes/GPU; no operator One-API, Bifrost, provider, cloud fallback or prompt-bearing telemetry is observed. Local GPU/safety/assertion failure yields a safe unavailable response.
- Forged tenant, seat, profile, account type, model, channel, VK, and mode requests cannot elevate access or charge another tenant.
- Missing/failed One-API DB, spend/seat reservation, Bifrost VK, or local policy validation does not bypass billing or privacy boundaries.
- Tests cover normal, denial, error, retry, concurrency, cancellation, streaming, revocation and stale policy behavior at each owned boundary; cross-component mock E2E passes.
- No secrets, provider keys, VK values, local signing private keys, PII, prompts or responses are printed or committed.

## Not in this coordinator

No public production cutover, tunnel policy change, real tenant migration, provider key provisioning, VK replacement, paid cloud request, child seat live-data correction, Bifrost restart, One-API PM2 restart, or credential rotation is authorized here. These require explicit rollout approval after source and isolated E2E gates pass.
