# Tenant Provisioning and End-to-End Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this approved workstream task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision a synthetic tenant across LibreChat, One-API and Bifrost, bind adult/child/Pro opaque seats, validate key/assertion revocation, and prove cloud and tenant-local Privacy routes with rollbackable operational procedures.

**Architecture:** Follow `D:\LAN-AI-Infra\LibreChat\docs\SATCHIDA-END-TO-END-ROUTING.md`. Tenant user identity/PII remains in that tenant's LibreChat. One-API has tenant/opaque seat/account/profile records and cloud budget policy. Bifrost holds one VK per tenant and all cloud provider secrets. A tenant-local Privacy assertion permits only a tenant-local GPU path.

**Tech Stack:** Existing One-API provisioner/DB API, LibreChat tenant admin APIs, Bifrost governance API/config, native Windows service scripts, synthetic test fixtures.

## Gates and file ownership

- One-API's strict queue and Bifrost Gates A–C are authoritative dependencies. Do not bypass them.
- Live provider/VK changes, migrations, real tenant policy changes, Bifrost/One-API/LibreChat restarts, tunnel changes, paid requests and credentials rotation need separate explicit rollout approval.
- Never print credentials or place them in docs/test fixtures. Use isolated DB/config copies and synthetic tenant identifiers. Treat all current uncommitted changes as user-owned until reviewed.

## Tasks

### 1. Provisioning contract
- [ ] Specify idempotent lifecycle operations: create tenant, configure account allocations, create group/opaque seat/profile, issue cloud tk, bind tenant Bifrost VK reference, issue local Privacy assertion, disable/revoke, rotate, and retire.
- [ ] Ensure creating or updating an account/profile cannot alter another tenant, raise limits, or view another tenant's seat assignments.
- [ ] Define tenant/group/plan cap source of truth and enforce aggregate caps transactionally; do not maintain conflicting independently editable limits.
- [ ] Define Family shared pool/member profile semantics and seat alias identity so one person cannot accidentally get duplicate independent allowances.
- [ ] Define atomic seat reassign behavior or defer it; preserve old binding until new assignment succeeds and define source/destination budget treatment.

### 2. Secret and audit operations
- [ ] Add one-time secret delivery contracts for One-API tk and Bifrost VK reference; list/read APIs return redacted metadata only.
- [ ] Keep tenant `vk_` service credential, per-seat `tk_`, Bifrost VK, assertion signing key, and provider keys in distinct stores/roles.
- [ ] Audit create/update/disable/rotate/revoke with actor type, tenant ID, opaque seat ID, timestamp, policy version and outcome; never log secret values or person PII centrally.
- [ ] Add dry-run reconciliation output and backup/restore documentation before any live migration; no destructive tenant deletion.

### 3. Synthetic E2E harness
- [ ] Create isolated fixture: one tenant, Family adult, Family child, Pro adult, test Bifrost VK fixture, mock cloud provider, local mock GPU endpoint, generated ephemeral signing keys.
- [ ] Start LibreChat API/test client against mocked central One-API and local Privacy router; ensure no requests target live `:4000`, `:8700`, or a public provider.
- [ ] Prove Family adult Chat/Study/Work cloud path; Family child Chat/Study cloud path; deny child Work, tools/MCP/code/image/audio; deny adult Family tools; allow only configured Pro tools.
- [ ] Prove each cloud request hits Bifrost under the correct tenant VK and returns usage/cost metadata to One-API for idempotent settlement.
- [ ] Prove Privacy assertion refresh is metadata-only, local inference works, and packet/mock capture shows no prompt-bearing operator/cloud request.
- [ ] Prove all key/policy failure and revocation cases, including simultaneous reservations, DB failure, Bifrost outage, local GPU down, stale assertion, wrong tenant/seat, and replay.

### 4. Operational readiness, staged only
- [ ] Add read-only readiness checks distinguishing process health, database readiness, provider configured, VK active, model loaded, local safety ready, and end-to-end inference verified. A single `/health` 200 never means ready.
- [ ] Define redacted release evidence bundle: source revisions, test results, binary/config identifiers (no secrets), migration dry run, mock E2E results, rollback binary/config/DB backup locations.
- [ ] Provide operator-run commands for real provider and tenant-device probes; never launch paid/live-provider harness from implementation tests.
- [ ] Keep Cloudflare Access/tunnel management separate; validate public path isolation only in an approved external-test window.
- [ ] Require explicit approval for actual tenant migration or service cutover and document rollback trigger/steps.

## Acceptance criteria

- Synthetic tenant lifecycle is idempotent, audited and cross-tenant isolated.
- Seat/account/profile and Bifrost VK mappings cannot be forged or widened by a tenant client.
- Cloud and Privacy E2E routes both pass, while Privacy prompt data is provably absent from central/cloud paths.
- Revocation and policy-change propagation bounds are measured and documented.
- Backup/restore and rollback can be exercised against isolated state.
- No production database, live provider credential, live VK, service process or public tunnel is modified by this implementation plan.
