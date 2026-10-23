# Tenant-Local Privacy Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this approved workstream task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide tenant-local, GPU-backed Privacy inference authorized by short-lived operator-signed policy assertions, with no prompt/response path to operator One-API, Bifrost, or cloud.

**Architecture:** Follow `docs/SATCHIDA-END-TO-END-ROUTING.md`. The operator signs a minimal assertion after a metadata-only seat/entitlement check. A tenant-edge router validates signature, issuer/audience, tenant/seat/profile/mode/policy version/expiry/JTI, then calls only configured local loopback model endpoints. Privacy has no cloud provider configuration or fallback branch. Child requests also require healthy local safety controls.

**Tech Stack:** Existing native Node runtime, TypeScript/JavaScript based on owning package conventions, crypto APIs, HTTP/SSE proxying, current tenant-local llama.cpp/Ollama services.

## Gate and file map

- Do not repurpose the existing `fleet/src/gateway.mjs` or collide with the documented/active dev gateway without an approved ownership migration. Implement as an isolated module until an integration seam is approved.
- Candidate files: `fleet/src/privacy/{assertion,policy,router,health}.mjs`; `fleet/test/privacy-*.test.mjs`; one config schema/parser; a short local deployment runbook. Private signing key material stays external to the repository and tool output.
- Preserve any uncommitted user files under LibreChat; no destructive actions or service restarts.

## Tasks

### 1. Contract and threat tests (RED)
- [ ] Define bounded assertion fields: issuer, audience, tenant, opaque seat, account type, trusted profile, allowed modes, policy version, iat/nbf/exp, JTI, key ID.
- [ ] Add tests for malformed schema, bad signature, wrong issuer/audience/tenant/seat, disallowed mode, expired/not-yet-valid assertion, unknown key ID, replayed JTI, revoked policy version, and clock skew bound.
- [ ] Add tests that prove Privacy has no route to operator endpoints or provider URLs, regardless of request model, headers, query, or body fields.
- [ ] Test health, timeout, cancellation, concurrency limit, SSE pass-through, error normalization, and client disconnect.

### 2. Assertion validation and policy (GREEN)
- [ ] Implement public-key verification with allowlisted algorithm and key ID; reject `none`, algorithm confusion, unknown key, oversized token, and malformed claims.
- [ ] Enforce small maximum assertion TTL, audience, tenant/seat binding to local authenticated session, account/profile/mode, policy version, and JTI replay cache.
- [ ] Define key rotation using overlapping public keys and bounded assertion expiry. Document revocation delay as no greater than max assertion TTL; do not claim immediate offline revocation.
- [ ] Keep logs metadata-only and redact token/JTI where correlation is unnecessary.

### 3. Local-only inference adapter
- [ ] Resolve only operator-configured loopback model endpoints; reject non-loopback hosts/redirects unless a tenant administrator explicitly configures a private LAN target under a documented policy.
- [ ] Pin allowed endpoint/model pairs; reject caller-supplied provider, base URL, API key, or model IDs outside the local alias map.
- [ ] Stream responses with correct OpenAI-compatible SSE framing, cancellation/backpressure, usage handling and safe errors.
- [ ] Verify only local model health/model readiness; stale/unknown health makes Privacy unavailable.
- [ ] No automatic retry target outside the tenant-local allowlist; no cloud fallback code path.

### 4. Child safety integration boundary
- [ ] Define injected safety pre/post moderation interface and local health probe; fail closed for child profile if either is missing/unhealthy.
- [ ] Keep Family child policy Chat+Study; Work, tools, MCP, code, images and audio are rejected before model dispatch.
- [ ] Use visible-supervision metadata/UI contract; do not silently enable transcript inspection.
- [ ] Write safety integration contract tests with deterministic mock classifiers and no harmful payload corpus in logs/fixtures.

### 5. Local verification
- [ ] Run unit tests and a fake local OpenAI-compatible server integration test including non-streaming, streaming, malformed SSE, abort, local GPU down, moderation down, expired assertion and replay.
- [ ] Capture outgoing destination metadata to prove Privacy only contacts local loopback endpoints and performs metadata-only assertion refresh.
- [ ] Document tenant setup, public-key distribution, key rotation, model readiness, GPU-down UX, log retention, and emergency disable.
- [ ] Do not configure actual operator signing secrets or restart tenant services in this source plan.

## Acceptance criteria

- Invalid/expired/mismatched assertion fails before prompt parsing/dispatch.
- Valid assertion serves only the allowed local alias and local model endpoint.
- Local endpoint or child safety outage returns unavailable; no remote fallback occurs.
- Prompts, responses, files, and local usage are not sent to operator APIs or persisted in operator logs.
- Signature/JTI/policy/key rotation boundaries have deterministic regression tests.
