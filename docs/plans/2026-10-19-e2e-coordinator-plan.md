# Satchida End-to-End Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute approved workstream plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinate independently testable repository plans into the approved tenant LibreChat → operator One-API → Bifrost → cloud workflow and tenant-local-only Privacy workflow.

**Architecture:** `docs/SATCHIDA-END-TO-END-ROUTING.md`. Plans are split by implementation owner and reviewed together at the contract seams. The coordinator does not merge the live One-API local Privacy channels into the tenant-local Privacy route.

**Tech Stack:** LibreChat TypeScript/React/Mongoose; One-API Go/Gin/GORM; Bifrost Go multi-module; tenant-local native Node/TypeScript router; Windows-native operator/tenant runtime.

## Workstream sequence

1. One-API active backlog prerequisite and cloud auth/accounting plan (`D:\LAN-AI-Infra\one-api\docs\superpowers\plans\2026-10-19-e2e-cloud-authorization-accounting.md`).
2. Signed local Privacy assertion and tenant-local router (`docs/plans/2026-10-19-tenant-local-privacy-router.md`); can develop against contract fixtures while One-API queue work proceeds, but production integration waits for approved key contract.
3. LibreChat server-side seat mapping and endpoint orchestration (`docs/plans/2026-10-19-librechat-seat-routing.md`), once One-API seat API and Privacy assertion wire contracts stabilize.
4. Bifrost tenant VK and streaming readiness (`D:\LAN-AI-Infra\Bifrost\bifrost\docs\plans\2026-10-19-cloud-vk-and-streaming-readiness.md`), in parallel with isolated One-API mocks, but no provider/VK runtime mutation.
5. Synthetic provisioning and E2E (`docs/plans/2026-10-19-tenant-provisioning-and-e2e-operations.md`) after all component contracts and local tests pass.

## Coordinator tasks

### 1. Contract freeze
- [ ] Record versioned identity fields and policy outcomes in the architecture doc: tenant ID, opaque seat alias, account type, server-owned profile, allowed modes/capabilities, policy version, request ID, cloud VK reference, Privacy assertion claims.
- [ ] Define stable denial/error codes, request/stream cancellation contract, known-zero vs unknown cost, usage finalization/idempotency contract.
- [ ] Define exact cloud route ownership and eliminate overlapping Node `:4001` dispatch only after migration tests demonstrate no missing routing behavior.
- [ ] Define local Privacy locality claim precisely, local assertion max TTL/revocation bound, public-key rotation, and no-cloud-egress acceptance probe.

### 2. Ordered execution and review gates
- [ ] Confirm One-API queue status and obtain operator decision about completing/reordering `[NEW-API-PARITY]` before later changes.
- [ ] Review each sub-plan against that repository's AGENTS/context/tracker and uncommitted worktree before implementation.
- [ ] Obtain approval of each sub-plan. Architecture approval does not approve implementation plans or runtime rollout.
- [ ] Keep a cross-repo compatibility matrix: LibreChat version/endpoint config, One-API API/schema version, Bifrost source/binary/config version, local router assertion version.

### 3. Integration and release evidence
- [ ] Run synthetic mock E2E for allowed/denied Family adult/child/Pro cases and cloud/local routing.
- [ ] Verify no child capability depends only on UI hiding; direct tool endpoint calls are rejected.
- [ ] Capture request destination metadata and logs showing Privacy prompt/body does not transit operator services; do not capture real content.
- [ ] Exercise budget/seat limits, duplicate settlement, cancellation, upstream failure, DB failure, VK revocation, local assertion expiry and GPU/moderation failure.
- [ ] Produce a redacted readiness report and explicit deployment/rollback checklist.

### 4. Deployment remains its own approval stage
- [ ] Before production use, obtain explicit approval for migrations, provider/VK config, live provider probe/payment, service restart/hot swap, child seat policy changes, and any tunnel exposure.
- [ ] Take and verify backups; build separate candidate binaries; verify exact process path/version before restart; retain rollback artifacts.
- [ ] Stage first on one synthetic/test tenant and one approved cloud model; then one tenant-device Privacy test. No broad rollout until both end-to-end workflows and revocation/rollback pass.

## Release acceptance

- All component and E2E criteria in `docs/SATCHIDA-END-TO-END-ROUTING.md` are met with observed evidence.
- All tests/typechecks/build gates pass in each changed repository, and known unrelated failures are classified rather than hidden.
- Source revision and running binary/config revision are proven equal at cutover.
- No prompt/response crosses the Privacy boundary, no child policy is header-controlled, and no cloud request is sent without a successful reservation.
- All rollout gates have explicit approval and a tested rollback path.
