# Satchida End-to-End Inference and Seat Policy

**Status:** Architecture proposal for operator review; no runtime changes authorized by this document.  
**Scope:** Tenant LibreChat → central One-API → central Bifrost → approved cloud providers, plus a tenant-local Privacy path.  
**Decision recorded:** One-API and Bifrost run on the operator PC. LibreChat is independently deployed at each tenant. Privacy inference runs only on a tenant-local GPU and never traverses operator One-API, Bifrost, or a cloud provider.

## 1. Product policy

### Modes and capabilities

| Account / profile | Chat | Study | Work conversation | Vibe coding / IDE | MCP, agents, code execution | Privacy |
|---|---:|---:|---:|---:|---:|---:|
| Basic | Yes | No | No | No | No | No |
| Family adult | Yes | Yes | Yes, text-only | No | No | Only if Family Privacy add-on is operator-enabled and local readiness passes |
| Family child | Yes, with child controls | Yes, with child controls | No | No | No | Only if explicitly enabled and local child-safety readiness passes |
| Pro adult | Yes | Yes | Yes | Yes | Allowlisted, Pro-only | Only with local GPU/readiness and entitlement |
| Privacy account | Yes | Yes | According to its explicit plan allocation | No unless Pro is also assigned | No unless Pro is also assigned | Yes, local-only and readiness-gated |
| Enterprise | Operator-defined | Operator-defined | Operator-defined | Operator-defined | Operator-defined allowlist | Local-only unless separately named cloud mode is added |

**Family rule:** a Family subscription permits Chat and Study for child profiles; Work is adult-only. Family adults can use text-only Work, but Work-related MCP, agents, code execution, and Vibe Coding remain Pro-only. The child/adult profile and entitlements are server-controlled; `X-Profile-Type`, model labels, request body fields, LibreChat UI state, and client-supplied identity headers never grant access.

**Child safety:** Child Chat and Study are conditional on enforced input and output moderation, a mandatory safety system instruction, visible parental-supervision disclosure, and supported-path restrictions. If the required child safety pipeline is not healthy, child inference fails closed. Until image/audio moderation and consent are implemented and verified, those modalities and host-executing tools are disabled for child seats.

**Privacy:** Local GPU health is necessary, not sufficient. Privacy requires (1) an account/tenant entitlement, (2) tenant-local GPU/model readiness, (3) a healthy tenant-local safety stack for child seats, and (4) a valid local policy assertion. If any condition fails, Privacy is unavailable; it never falls back to One-API, Bifrost, or cloud. Chat/Study/Work cloud use does not imply Privacy entitlement.

## 2. Trust boundaries and credential roles

1. **Tenant LibreChat** authenticates tenant users and stores PII, family membership, and the mapping from local user to opaque seat alias. It is the tenant data custodian.
2. **Central One-API** owns tenant/seat entitlements, opaque seat aliases, account/profile policy, cloud spend reservations, per-seat usage limits, and tenant-to-Bifrost-VK references. It receives no end-user email, name, conversation, prompt, or response.
3. **Central Bifrost** stores provider credentials and executes allowlisted cloud inference under a distinct VK per tenant. A VK is a tenant-level upstream ceiling, not end-user identity. No provider key or Bifrost management credential is sent to LibreChat.
4. **Tenant-local Privacy router** verifies a short-lived operator-signed Privacy assertion and routes only to that tenant's loopback/local GPU. The signing private key remains on the operator host; the tenant receives only a public verification key and a short-lived assertion. The local router has no cloud route for Privacy.

Credential types remain separate:

- LibreChat user session: identifies the local person to the tenant deployment.
- Tenant `vk_`: authorizes tenant-scoped management calls to One-API.
- One-API seat `tk_`: authorizes that opaque seat's cloud request to central One-API.
- Tenant-specific Bifrost VK: selected by One-API server-side and presented only to Bifrost.
- Signed local Privacy assertion: short-lived, audience-bound authorization for the tenant-local router; it is not a provider credential.

Never treat a harness user ID, role, `X-Tenant-Id`, `X-Seat-Alias`, `X-Profile-Type`, `X-Bifrost-User-Id`, or mode/model string as proof of identity. One-API authenticates `tk_`, resolves seat policy from its own records, strips identity headers from ingress, and writes trusted attribution on the Bifrost hop. Bifrost treats that attribution as metadata only; tenant authorization comes from the tenant-specific VK.

## 3. Cloud request: LibreChat → One-API → Bifrost → provider

```mermaid
sequenceDiagram
  participant U as Tenant user/browser
  participant L as Tenant LibreChat server
  participant O as Operator One-API (:4000)
  participant B as Operator Bifrost (:8700)
  participant P as Approved cloud provider
  U->>L: Authenticated turn (local user/session)
  L->>L: Resolve server-side seat, account, profile and requested mode
  L->>O: POST /v1/chat/completions, Bearer tk_<seat>, alias Chat/Study/Work
  O->>O: Authenticate tk_; resolve tenant/seat/profile/group; validate mode/model/tool policy
  O->>O: Atomically reserve tenant + seat budget and token ceilings
  O->>B: Inference + server-selected tenant VK + trusted opaque attribution
  B->>B: Authenticate tenant VK; enforce provider/model/rate/spend allowlists
  B->>P: Provider call with operator-held provider credential
  P-->>B: Response or SSE + usage/cost metadata
  B-->>O: Response stream + normalized usage/cost metadata
  O->>O: Settle idempotently; persist usage/cost provenance; release remaining holds
  O-->>L: Compatible response/SSE, safe error codes, request ID
  L-->>U: Rendered response
```

### Cloud-path requirements

- One-API maps an authenticated tenant seat to the correct Bifrost VK using server-side tenant configuration. It must not use a universal VK or caller-supplied Bifrost credential.
- Exactly one component owns provider selection. Recommended: Bifrost chooses among its configured provider routes for a tenant VK; One-API chooses the tenant VK and enforces customer entitlements/budgets. Disable the competing Node `:4001` dispatch path for this production cloud flow after an isolated migration verifies route ownership.
- The client-visible model is a canonical mode alias. Model names, provider names, Bifrost VK IDs, and provider credentials are not returned in normal responses or user-visible errors.
- Reservations occur before upstream dispatch. A ledger failure, missing tenant VK, unavailable policy, or failed hard-cap check returns a stable non-success response before contacting Bifrost.
- Settlement is idempotent per request ID. A known actual cost of `$0` is a known zero, not a signal to fall back to a ratio. If actual cost is absent, use an approved versioned official/list-price calculation and mark it estimated; never silently mix actual, estimated, and legacy billing sources.
- Streaming keeps the response open while metering; on disconnect or upstream error, finalize known usage if available and release unused reservations. Retry/fallback is bounded and must not settle the same request twice.
- One-API sends Bifrost only opaque tenant/seat IDs derived from its verified seat token. PII and prompt content are not written to identity/audit metadata.

## 4. Privacy request: LibreChat → tenant-local router → local GPU

```mermaid
sequenceDiagram
  participant U as Tenant user/browser
  participant L as Tenant LibreChat server
  participant O as Operator One-API control plane
  participant R as Tenant-local Privacy router
  participant G as Tenant-local GPU/model
  U->>L: Privacy turn
  L->>L: Resolve authenticated local user to opaque seat; check local health/readiness
  L->>O: Metadata-only policy assertion refresh (tenant service credential + seat reference)
  O->>O: Validate tenant and seat; issue short-lived signed Privacy assertion
  O-->>L: Assertion only (no prompt/body)
  L->>R: Prompt + assertion over tenant loopback/LAN
  R->>R: Verify signature, issuer, audience, tenant, seat, expiry, policy version and Privacy grant
  R->>G: Local inference only (and local moderation for child profile)
  G-->>R: Local response/usage
  R-->>L: Response/SSE + local request ID
  L-->>U: Rendered response
```

One-API sees only an assertion refresh containing tenant/seat/mode metadata. The prompt, response, files, and local model output remain inside the tenant environment. Assertion refresh failure or expiry makes Privacy unavailable; it does not redirect to the operator endpoint. No local content or usage payload is reported centrally by default. Any future metadata-only usage reconciliation requires an explicit, separately reviewed protocol.

The local assertion contract must include issuer, audience, tenant ID, opaque seat alias, account type, server-controlled profile, allowed mode(s), policy version, issued-at/not-before/expiry, unique token ID, and key ID. Bound expiry to a short operator-selected window and reject replay where the local runtime can maintain a bounded nonce cache. Signing key rotation uses overlapping public keys. A policy/seat revocation takes effect at the assertion expiry at latest; document that bound. Do not claim immediate offline revocation.

**Account type catalog.** The operator mints account-type names and the tenant's LibreChat consumes them, so the catalog is a wire contract and both sides must hold the same list:

```
basic | standard | family | pro | pro_family | enterprise | privacy
```

`privacy` is a first-class account type: the local-GPU product sold on its own, with its own contract term and its own allocation, and able to sit alongside a `pro` seat in the same tenant on different terms. The account type is the **product, not a capability** — a `privacy` seat is a local product by default and does not hold cloud tooling by virtue of its type. Whether it may also reach the cloud is decided by the operator's allocation for that account type, so the request path reads the seat's allowed modes from the allocation rather than from a type-keyed table. `family` remains Privacy-eligible through the separately purchased `localPrivacyEnabled` add-on.

**Per-seat fair use on the local path.** Privacy is flat-rate, so there is no theft vector — there is a *fairness* vector, where one seat monopolises the tenant's single GPU. A per-seat fairness ladder (Soft / Hard / Serious) is derived from the tenant's own measured hardware rather than from fixed constants, and it pauses and deprioritises rather than cutting a user off mid-task. The capacity model, the measured basis, the tier arithmetic and the enforcement invariants are specified in `SATCHIDA-IP-PRIVACY-CAPACITY-GRANTS-TELEMETRY.md`.

**Metadata-only usage reconciliation.** The gap reserved by this document is now filled by the reviewed protocol in `SATCHIDA-IP-PRIVACY-CAPACITY-GRANTS-TELEMETRY.md` §7: counters only (no prompt, response, filename, or email), signed, strictly sequenced per tenant, bound to a grant, reconciled by seven operator rules including replay rejection and sequence-gap detection. It makes under-reporting detectable, not impossible; that limitation is stated rather than papered over.

### 4.1 Live deployment topology (measured, 2026-10-20)

The operator host currently runs:

| Port | Process | Role |
|---|---|---|
| 4000 | `one-api/satchida-gateway.exe` | **One-API** — the tenant relay, policy and accounting point |
| 4001 | `satchida-router` (Node) | Provider router: model selection, key custody, rate limiting, local gate, injection shield, identity prompt |
| 4099 | Privacy router (Node) | Tenant-local Privacy front door: assertion verification, fair-use ladder, child safety, model alias resolution |
| 8080 | `llama-server` (router mode) | Local model catalogue; `--no-models-autoload`, so a model must be loaded before it serves |
| 8091 / 61075 | `llama-server` | Bonsai 27B and 9B instances |
| 8700 | `bifrost-http` | Bifrost, holding provider keys behind a virtual key |

Two consequences follow, and both are load-bearing:

- **One-API already owns the local Privacy channel.** Channel 2 (`llamacpp-privacy-primary`) points at the local runtime with `models = Chat,Study,Work,Privacy` and a `model_mapping` that turns each mode alias into a concrete GGUF id. Channel 3 is the same against the 27B instance. So the mode-to-model translation exists once, operator-side, and the tenant-local Privacy router performs the same translation locally.
- **The Node router, not the old `:4000` gateway, is the live cloud hop.** One-API channel 1 (`Bifrost Router Upstream`) has `base_url = http://127.0.0.1:4001`, so a cloud request is LibreChat → One-API → router → provider. The prompt-injection shield and the identity prompt therefore belong in the router, and have been relocated there.

### 4.2 The operator's multi-tenant console

The berry theme is the operator's console and the one that carries the multi-tenant management surface. Two views, both backed by the per-tenant analytics in §4.2.

**`/panel/dashboard` — the tenant portfolio.** A single table of every tenant: plan, status, seats in use against seats provisioned, requests, tokens, cost, and a **mode-mix bar** on each row. The mode mix is the point. A tenant that is eighty percent Privacy and one that is eighty percent Chat have the same shape in a total and nothing alike in kind: Privacy is flat-rate and served on the tenant's own hardware, while Chat is metered and sent to a provider. The bar makes that difference visible without opening anything. The section is admin-gated.

**`/panel/tenant` — the per-tenant drill-down.** A drawer with five tabs: Overview (the mode breakdown as proportional bars), By mode, By seat, By model, and History. History is the tenant's management log — who changed what, and when — which is the question a support or dispute call actually asks.

**`/panel/tenant-portal` — the tenant's own console.** A tenant admin sees their own organisation's usage and renews by UPI, without asking the operator. There is no tenant selector in this view and nothing to mis-set: the server resolves the tenant from the session, so a tenant admin cannot read another tenant's numbers by guessing an identifier. The payment section opens a session, shows the vector code, and reports the session's state.

The older per-tenant view at `/panel/tenant` remains the operator's form for editing one tenant — its account plan, its groups, its seats. The portfolio and the drawer are additive to it, not a replacement.

### 4.3 What was live-wrong and is now fixed

The old `fleet/src/gateway.mjs` held the injection shield and the identity prompt. When `:4000` was replaced by One-API, **both protections left the request path**: the router had a rate limiter, a local concurrency gate and an identity prompt, but no shield. The shield is now in `satchida/router/src/shield.mjs` and is applied in the router's chat handler, after the licence and rate checks so an unauthenticated caller cannot learn that a filter exists. It answers locally, in the same SSE shape the client renders, and it was verified to block identity probing, role injection, secret extraction, exfiltration and guardrail bypass while leaving ordinary requests untouched.

The gateway also owned `POST /v1/audio/transcriptions`, which the router did not have. That route was relocated too, with a dedicated local-only audio selection, because chat's mode order is free/paid and would leave transcription with no candidate at all. A cloud transcription endpoint would put the audio on someone else's infrastructure, so local is a requirement rather than a preference.

The identity prompt was also **merged** into the caller's system message rather than prepended, contradicting its own documented intent and failing its own test. Both the gateway and the router now prepend the identity as its own system message and leave the caller's messages in place, so an agent's authored instructions survive as a separate message.

## 5. Family and Pro capability enforcement

- One-API stores an operator-managed `profile_type` for each Family seat (`adult` or `child`). The tenant's LibreChat account mapping selects an already-provisioned opaque seat; it cannot change profile type by header or request body.
- Family child: Chat + Study only; mandatory local-to-operator child-safety policy for cloud Chat/Study; no Work/VibeCoder/MCP/agents/code execution; image/audio disabled until their full safeguards and explicit consent are implemented.
- Family adult: Chat + Study + text-only Work. No Work MCP servers, agents with tools, host code execution, or VibeCoder/IDE.
- Pro: Work/MCP/tool capability is granted by an explicit server-side entitlement and per-tenant allowlist, not the selected model name. Every MCP server and tool call is checked at the execution boundary. UI hiding is only presentation.
- Revoke/disable the seat in One-API and revoke/replace the local assertion on its next refresh. LibreChat updates its local seat-token mapping only after a successful One-API assignment transaction; stale or partial assignments fail closed.

### 5.1 Groups are the tenant's product lines

A **group** is one commercial product line inside a tenant, and maps one-to-one onto a One-API group of the same name. The tenant's admin panel manages the groups; the operator's One-API group policy is what is enforced.

| Account type | Modes | Capabilities | Shared |
|---|---|---|---|
| `basic` | Chat | — | no |
| `standard` | Chat | — | no |
| `family` | Chat, Study, Work (text-only) | — | **yes** |
| `pro` | Chat, Study, Work | work_tools, mcp, agents, code_execution | no |
| `pro_family` | Chat, Study, Work | work_tools, mcp, agents, code_execution | no |
| `enterprise` | Chat, Study, Work | work_tools, mcp, agents, code_execution | no |
| `privacy` | Chat, Privacy | — | no |

Two rules are load-bearing and enforced in **both** systems:

- **A Family seat holds no Work tooling.** Its Work mode is text-only.
- **A dedicated `privacy` seat holds no cloud tooling by virtue of its type.** Whether it may also reach the cloud is decided by the operator's allocation.

`local_privacy_enabled` is recorded separately from the account type, because Privacy is a local entitlement that can be granted to any product line.

### 5.2 The Family seat model

A Family group is **two adults and at most two children** — four seats.

The children are conceptualised so a parent can monitor the prompts and responses a minor sends and receives, and to share Study assistance with the child. The counts are part of the product rather than an accident of enrolment, so they are recorded on the group in both LibreChat and One-API, and a shape outside the product is **refused on write** in both.

A Family group is also a **shared** group: the parents and the children draw on one seat allowance, so a child's usage is visible against the family's budget.

## 6. Identity, entitlement and persistence contracts

### One-API seat record

At minimum, the server-side seat record needs: tenant ID; unique opaque seat alias within tenant; account type; profile type; policy/group ID; enabled/revoked status; expiry; explicit mode set; capability set; current policy version; optional Bifrost VK reference; per-seat input/output/cache counters or a linked shared-family pool; and audit timestamps/actor type. Store no LibreChat email, real name, date of birth, or prompt content.

Enforce uniqueness on the identity used by usage accounting. Existing usage keys are `(tenant_id, alias_id, period_start)` and Family shared usage pools additionally use a group key; do not add a token-only uniqueness index that contradicts those semantics. Seat moves must atomically evaluate source/destination caps and define usage transfer before implementation. Disabled seats are not reusable until token revocation and allocation state commit together.

### Policy intersection

Effective access is the intersection of:

1. Active tenant entitlement and subscription state.
2. Account-type plan modes/capabilities.
3. Server-side seat profile (`adult`/`child`).
4. One-API policy group model/channel allowlists.
5. Seat token exact model/channel restrictions, if retained.
6. Bifrost tenant VK provider/model allowlists for cloud routes.
7. Local GPU/model and safety readiness for Privacy/local child routes.

An empty allowlist must have one explicit semantic and must not silently widen access. Recommended for security policy: absent policy is deny/unconfigured; `*` is a separate explicit operator decision. Group and token allowlists are currently stored but not enforced by One-API relay code, so enforcement and tests are required before trusting their DB contents.

## 7. Failure behavior and operational promises

| Failure | Required behavior |
|---|---|
| Unknown/revoked/expired cloud seat token | One-API returns 401/403 before Bifrost; no fallback to user-supplied key |
| Missing/malformed/inactive seat, group, or tenant policy | Cloud request denied before dispatch |
| One-API DB, budget reservation, or seat reservation failure | Fail closed; no unbudgeted cloud request |
| Missing/expired tenant Bifrost VK or Bifrost auth failure | Safe 503/401-class response; never substitute a shared admin/master key |
| Provider unavailable | Bifrost tries only configured eligible providers; bounded fallback, otherwise safe 502/503 |
| Bifrost stream has empty/invalid chunks | Return a normalized error or valid completion; never emit malformed `{}` SSE frames to LibreChat |
| Local GPU/model missing, unloaded, saturated, or health probe stale | Privacy unavailable; do not call One-API cloud route or Bifrost |
| Local assertion expired or cannot refresh | Privacy unavailable; retry metadata refresh only, no prompt egress |
| Child safety/moderation unavailable | Child request denied across Chat, Study, local Privacy, and tool paths |
| Policy/seat change | Versioned audit; invalidate or expire cached policy within documented bound |
| Client disconnect | Cancel upstream where supported; settle known usage once and release unspent holds |

Never expose arbitrary provider exception text, raw upstream payloads, prompts, response bodies, credentials, or secrets in user-facing errors or ordinary logs. Use stable error codes and request IDs.

## 8. Current evidence and gaps to close

### 8.1 What the work closed

- **One-API now binds the seat profile and the seat policy from the operator's own records.** `tk_` authentication resolves the seat, the group and the token allowlists and intersects them, and a seat with no policy is refused rather than served.
- **The Privacy path is enforced end to end.** The tenant-local router verifies a short-lived seat assertion, applies the child-safety rules, enforces the measured per-seat fairness ladder, and resolves the mode alias to a model the local runtime actually has. The Privacy hooks in the LibreChat endpoint are mandatory and fail closed.
- **The prompt-injection shield and the identity prompt are in the live path.** They left it when `:4000` became One-API and are now in the Node router, together with the speech-to-text route the gateway used to own.
- **The fleet gateway is retired.** The launcher starts only the Privacy router; the gateway source is kept with a deprecation banner and is not started.
- **Multi-tenant management is visible.** Per-tenant analytics, a per-mode split, a tenant dashboard, a tenant self-service console, a tenant management log, and a tenant UPI payment path are all built and tested.
- **SSRF protection exists.** A channel's base URL is checked at the one point every relay path passes through, with a three-tier address policy, scheme and port restriction, and resolution checking.
- **The client address cannot be forged.** The proxy chain is declared rather than assumed, so the address One-API accounts against is the caller's real one.

### 8.2 What is still open

**Security and correctness, not features.**

- **A second factor.** one-api has none. A tenant admin can mint seat tokens and move budget, and the operator console is password-only. TOTP is the cheapest material improvement; passkeys are the better one.
- **Cache-aware ratio billing.** A long coding session is mostly cache reads. The telemetry now records `cached_tokens` and One-API splits cache-read from fresh input, but the *price* of a cache read is not modelled separately, so the two are billed identically. This is the largest remaining billing-accuracy gap and the most common case. **Now partly closed** — see §8.3.

### 8.3 Closed since the last review

- **Trusted proxy resolution.** Gin's engine trusts every proxy by default, so `c.ClientIP()` returned the first value of `X-Forwarded-For` — a value the caller chose. That address decided a token's **subnet restriction**, the **rate limit bucket**, the **Turnstile remoteip** and the request log, so a caller could pick the identity it was accounted against. One-API now declares its proxy chain in `TRUSTED_PROXIES`, resolves the client address by walking the chain from the right, and **ignores the header entirely when no proxy is declared**. The resolver backs both Gin's own `ClientIP()` and the four call sites, so they cannot disagree.
- **Cache-aware ratio billing in the ratio path.** The retail-rate path already charged a cache read at the cache rate; the legacy model/group-ratio path did not, so a tenant without a configured retail rate was billed the input price for every cached token. Cached tokens are now charged at a configurable cache ratio, defaulting to the same 0.2 discount the retail path uses, so the two paths do not disagree. The table is per model and per channel, and is exposed as the `CacheRatio` option.

**Product work, deliberately deferred.**

- **The YouPI-PG adapter.** The session model it will drive is built, including the `provider_session_id` column, so the adapter is an addition rather than a rewrite. It is integrated over HTTP with no code copied, because the upstream repository declares `license: "Commercial"` and carries no `LICENSE` file.
- **The mode-to-model translation exists in three places** — the operator's One-API channel mapping, the Node router's preferences, and the tenant-local Privacy router's resolution. They are the same translation and will drift. One canonical table would be better.

**Operational gaps that need a decision, not code.**

- The Node router on `:4001` is down, so cloud traffic through One-API channel 1 fails with a connection error.
- LibreChat on `:3080` is not running.
- The local runtime on `:8080` is in router mode with `--no-models-autoload`, so it answers `model not found` until a model is loaded.
- The `.env` licence is signed by a stale key and is refused with 401.
- `tenant_seat_aliases` is empty, so the seat-binding rules are dark code until seats are provisioned.
- The One-API build that is running predates the source, so its `groups` table has no `allowed_modes` or `capabilities` columns and its binary does not carry the new tenant analytics.

**Out of scope, and recorded as such.** Payment providers other than YouPI-PG, Midjourney, Suno, video proxy, the task and plugin protocols, Telegram, check-in, leaderboard rankings, uptime-kuma, and the WeChat, Discord, LinuxDO and Lark OAuth providers.

## 9. Verification gates

### Unit/contract tests

- LibreChat bridge: correct endpoint and server credential selected for Chat/Study/Work vs Privacy; caller-provided tenant/profile/model headers cannot widen access; user account/profile state is present only in server-side request context.
- One-API: tenant/seat token validation; correct profile; Family child Work and VibeCoder denied while Chat/Study accepted only with child guard; adult Family Work accepted without tools; group/token model and channel intersection; tenant-specific Bifrost VK selection; reservation failure denies before dispatch; zero/unknown/estimated cost semantics; duplicate settlement/retry idempotency.
- Bifrost: missing/revoked/wrong-tenant VK denied before provider dispatch; provider allowlists and rate/spend enforcement; normalized streaming behavior; trusted One-API attribution does not override VK authority; content logging disabled.
- Tenant-local Privacy router: valid signed assertion accepted; tampered, wrong-tenant, wrong-seat, wrong-audience, stale, expired, revoked-version, and replay assertions denied; local GPU unhealthy denies; provider/cloud URLs are not reachable from Privacy routing; prompt and response absent from operator-side traffic/logs.

### End-to-end staged workflow

1. Provision a synthetic tenant, one Family adult, one Family child, one Pro adult, tenant Bifrost VK, per-seat cloud tokens, local assertion signing/verification keys, and a fake/local model endpoint. Never emit credential values.
2. LibreChat login resolves only the local user. The server maps user to opaque seat; client-supplied aliases/profiles are ignored.
3. Family adult Chat/Study reaches central One-API → Bifrost → mock cloud provider and returns a valid streamed and non-streamed answer.
4. Family child Chat/Study reaches the approved child-safety path, records no PII/prompt in central records, and is blocked on safety outage. Child Work, VibeCoder, MCP, code, image and audio attempts are denied.
5. Family adult Work succeeds as plain text; MCP/tool/code attempts are denied. Pro VibeCoder/MCP succeeds only for explicitly allowlisted tools.
6. Privacy obtains/uses an assertion and reaches the tenant-local GPU. Capture the tenant and operator interfaces to prove no prompt-bearing request reached operator One-API/Bifrost/cloud. Stop local GPU and prove Privacy returns unavailable without cloud fallback.
7. Exhaust a seat cap, per-seat ceiling, Family shared pool, tenant spend budget and Bifrost VK cap independently; each rejects before exceeding its configured limit. Simulate ledger DB failure and ensure cloud dispatch is not attempted.
8. Stream disconnect and provider failure tests verify cancellation/release/idempotent settlement. Restart/revoke tests verify cloud tk and local assertion expiry/revocation bounds.

### Runtime rollout

Source tests and local mock E2E are required before any live service change. Production-like cutover requires a separate operator-approved window, backup/rollback, staged Bifrost VK/provider test, One-API rebuild/restart, LibreChat endpoint verification, and tenant-side local GPU verification. A live paid provider smoke test and any public tunnel change are separate approval gates; do not infer success from `/health` or source test results.

## 10. Workstream boundaries for implementation planning

This architecture must be delivered as independently testable workstreams, coordinated through versioned contracts:

1. **One-API cloud authorization/accounting:** trusted seat/profile policy, allowlist enforcement, tenant VK mapping, fail-closed atomic reservations, idempotent cost settlement, correct route dispatch to Bifrost.
2. **Tenant-local Privacy gateway:** signed local assertion contract, local model health/routing, fail-closed child-safety hooks, no cloud egress.
3. **LibreChat identity and orchestration:** secure server-side user→seat lookup, distinct cloud/local credentials, mode and capability enforcement, Family profile/tool behavior, no trust in browser headers.
4. **Bifrost cloud configuration and resilience:** one VK per tenant, provider/model allowlists, content-logging disablement, streaming normalization, real provider availability, bounded fallback, attribution headers accepted only as metadata.
5. **Cross-system provisioning and operations:** tenant/seat lifecycle, key/assertion rotation and revocation, audit, backup, health evidence, deployment and rollback runbook.

Each workstream needs its own reviewed implementation plan after this architecture is approved. Do not merge central One-API Privacy routing with tenant-local Privacy routing, and do not perform production data mutation or process restarts as part of source implementation without explicit rollout approval.
