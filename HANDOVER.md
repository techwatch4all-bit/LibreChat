# SATCHIDA — SESSION HANDOVER

**Read this first in a new session.** Updated as a continuation handover; timestamped execution evidence is in `OVERNIGHT-LOG.md`.
Verified state, not intentions. The “Resume now” section below overrides older snapshots in this document.

---

## ⚡ OPERATOR PRIORITY DIRECTIVE — 2026-10-05

The operator has set explicit build priorities. **Do not start family or STT work until P1–P3 are complete.**

### P1 — OPERATOR ADMIN DASHBOARD + CONTROL PLANE (BUILD FIRST)

Build a full first-party operator control plane. The AGPL `admin-panel` remains rejected and must not be shipped.

**Required surfaces:**

| Surface                         | Description                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenant console**        | List all client nodes: status, licence expiry, seat count, spend, heartbeat age, model routing config                                                                                                                                                                                                               |
| **Licence management**          | Issue / revoke / renew licences (monthly / quarterly / annually). Each licence is a signed Ed25519 JWT carrying `clientId`, `plan`, `allowed_seats`, `family_enabled`, `max_minor_profiles`, `image_gen_adults_enabled`, `image_gen_minors_default`, `token_credits_monthly`, `image_credits_monthly`, `features[]` |
| **Account allocations**         | Per-client: token spend cap, seat cap, image credit cap, feature flags — all operator-editable                                                                                                                                                                                                                      |
| **Provider key pool**           | UI to add / rotate / retire paid provider accounts (OpenAI, Anthropic, Gemini, DeepSeek). Keys stored ONLY in HQ keyring — injected in-flight, never sent to client nodes                                                                                                                                           |
| **Multi-account auto-rotation** | Gateway selects the best available paid account (lowest spend, no error state), injects key in-flight, logs `(clientId, accountId, provider, tokens)` to the ledger. Never crosses a provider's contractual/quota limit                                                                                             |
| **Tenant management**           | Create, suspend, delete tenants. Push policy changes to client nodes via heartbeat response                                                                                                                                                                                                                         |
| **Audit trail**                 | Every operator action: timestamp, action, target, actor                                                                                                                                                                                                                                                             |

**Architecture decisions:**

- Control service: `:8443` at HQ only, tunnelled via `control.satchida.com` with Cloudflare Service Token
- Durable store: SQLite (schema already designed in Implementation-plan.md Phase 1)
- Dashboard SPA: served from the control service itself — NOT from LibreChat `:3080`
- Auth: Cloudflare Service Token (browser → HQ), HMAC-SHA256 signed (client node → HQ)

---

### P2 — HEARTBEAT: 6-HOUR CYCLE + AUTO-DISABLE + 48-HOUR BLOCK

**Exact behaviour to implement:**

```
CLIENT HEARTBEAT:
  Every 6 hours → POST https://control.satchida.com/api/v1/fleet/heartbeat
  Body includes: HMAC-SHA256(clientId + timestamp + nonce, client_secret)
  Response carries: licence validity, plan package, policy flags, commands[]

LICENCE EXPIRY — AUTO-DISABLE:
  When licence.expiresAt < now:
  → Gateway: 402 { code: "licence_expired" } on every inference request
  → Operator console: EXPIRED badge (red)
  → No grace period — hard boundary

MISSED HEARTBEAT — TWO-STAGE BLOCK:
  Stage 1: last heartbeat > 6h AND licence still valid
    → Warning only — client continues to work
  Stage 2: last heartbeat > 48h CONSECUTIVE AND licence is expired
    → BLOCKED: gateway returns 403 { code: "node_blocked_no_heartbeat" }
    → Operator console: BLOCKED badge (dark red)
    → Unblock: operator must issue new licence OR manually clear the block

  Rule: heartbeat failure during valid tenure = warning only.
  Block only fires when BOTH conditions are true simultaneously.
```

**Status state machine:**

```
ACTIVE → EXPIRED     (licence boundary reached)
ACTIVE → BLOCKED     (licence expired + 48h no heartbeat — cannot reach BLOCKED without first being EXPIRED)
EXPIRED → ACTIVE     (operator issues new licence)
BLOCKED → ACTIVE     (operator issues new licence AND manually clears the block flag)
```

**Files to build:**

- `fleet/src/control-service/heartbeat.ts` — receive, HMAC-validate, update `last_seen`
- `fleet/src/control-service/scheduler.ts` — background sweep every 15 min; updates `tenants.status`
- `fleet/src/control-service/licence.ts` — Ed25519 JWT issue, verify, revoke
- `fleet/src/sync-agent/` — polls `:8443`, writes `node_state.json` on client node
- `fleet/src/gateway.mjs` — reads `node_state.json` on every request for status enforcement

---

### P3 — FULL ADMIN SETTINGS PAGE (GLOBAL — APPLIES TO ALL TENANTS)

Settings are set by operator → stored in HQ SQLite → delivered in heartbeat response → written to `node_state.json` on client → consumed by gateway and LibreChat.

| Category              | Items                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| **MCP Servers**       | Global list; enable/disable per plan tier                                                         |
| **Agent Marketplace** | Agent list with skills, categories, visibility per plan                                           |
| **RAG**               | Enable per tier, embedding model, chunk size, similarity threshold                                |
| **Content Filtering** | Guardrails AI rulesets, DNS preset (1.1.1.3 / AdGuard / NextDNS), ShieldGemma enable per tier     |
| **Model Routing**     | Provider account assignment per tier, fallback order, local-vs-cloud preference                   |
| **Family Plan**       | Enable/disable per client, max minor profiles (1–3)                                               |
| **STT / TTS**         | Pre-configure at operator level (Omni at :8080 for STT); tenants inherit, no manual config needed |

---

## PENDING WORK — VERIFIED STATUS (2026-10-05)

### ✅ DONE — Do Not Rebuild

| Item                                                                                                 | Evidence                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Gateway licence enforcement (seat cap, balance, route)                                               | 60/60 tests pass                                  |
| Chat E2E: LibreChat → gateway → Omni :8080                                                           | `"CHAT FIXED"` verified                           |
| Omni text / vision / STT capability                                                                  | All three verified with real inputs               |
| STT gateway source route (`POST /v1/audio/transcriptions`)                                           | Edited-source probe: HTTP 200, correct transcript |
| Family schema substrate (nullable fields, IUser/Mongoose)                                            | DB-free schema tests pass                         |
| Satchida rebranding (title, assets, config)                                                          | Served from local app                             |
| Turnstile placeholder bug                                                                            | Removed from `librechat.yaml`                     |
| Gateway auth: Bearer + custom header + query param                                                   | Verified                                          |
| CONTRACT-CLAUSES.md §10 (zero liability), Schedule A (POCSO), Schedule B (multi-signatory execution) | On disk                                           |
| BILLING-PARTNER-AGREEMENT.md                                                                         | KT Educare, 2% commission, Mumbai jurisdiction    |
| TERMS.md: family pooling non-transferable carve-out                                                  | Done                                              |
| Backup: `D:\LAN-AI-Infra\LibreChat\backup\20261004-220640\`                                          | Done                                              |
| OVERNIGHT-PLAN.md at repo root                                                                       | Copied                                            |

### ❌ NOT IMPLEMENTED — Priority Order

**P1 — Operator Dashboard & Control Plane:**

- [ ] Control service `:8443` with SQLite durable store and HMAC heartbeat receiver
- [ ] Ed25519 licence JWT issue / revoke / renew
- [ ] Operator admin SPA (`/admin` in control service)
- [ ] Multi-tenant list, licence management, account allocation UI
- [ ] Paid provider key pool UI (keys stay at HQ keyring only)
- [ ] Multi-account auto-rotation in gateway (per-account spend ceiling, error state, audit)
- [ ] Audit log for all operator actions
- [ ] Cloudflare Service Token gating for operator console

**P2 — Heartbeat & Auto-Block:**

- [ ] 6-hour client heartbeat cycle (sync agent)
- [ ] Durable `tenants` table: `last_seen`, `status`, `licence_expires_at`
- [ ] Background sweeper: ACTIVE → EXPIRED → BLOCKED transitions
- [ ] Gateway: 402 on `licence_expired`, 403 on `node_blocked_no_heartbeat`
- [ ] Operator console: ACTIVE / EXPIRED / BLOCKED status badges

**P3 — Admin Settings Page:**

- [ ] MCP server list (operator-editable, tier-gated, heartbeat-delivered)
- [ ] Agent marketplace config (add/remove/enable per tier)
- [ ] RAG config per tier
- [ ] Content filtering toggles per tier
- [ ] STT/TTS pre-configuration at operator level
- [ ] All settings → heartbeat delivery → `node_state.json` → gateway reads

**Remaining lower-priority items:**

- [ ] STT: active `:4000` gateway + LibreChat browser microphone path — B2 (source passes; deployed path not proven)
- [ ] NSSM service installation (all processes die on reboot — B3)
- [ ] Family API routes: 5 endpoints in `packages/api/src/admin/family.ts`
- [ ] MonitoringBanner React component (`client/src/components/Family/MonitoringBanner.tsx`)
- [ ] RAG Milestone 2+3: `/text`, `/query` wired with LanceDB
- [ ] Chat toolbar: mode selector, style tabs, think toggle, web search flag (todo.md B3)
- [ ] PWA manifest for Android
- [ ] `Deploy-EdgeNode.ps1` self-install archive script
- [ ] Langfuse: point to control service (UI integration present in LibreChat settings)
- [ ] ShieldGemma 2B (post-launch, not a launch blocker)
- [ ] todo.md B2: router reads `token.isChild`, `token.modes`, `token.limits.*`
- [ ] todo.md B6: provider registry cleanup (base URLs, Novita, Deep Infra, etc.)
- [ ] todo.md B7: docs VPN → Cloudflare Tunnel wording cleanup

---

## RESUME NOW — approved product work and verified state

The approved implementation plan is `.zcode/plans/plan-sess_ca1bf476-375b-4695-9268-cd1e84fa14b1.md`.

Continue it without asking routine questions. The operator specifically directed work away from further theme iteration and toward product features.

### Product architecture and accepted decisions

- Build the operator control plane and dashboard first, then the paid-account router and node sync agent, then family APIs/UI. The AGPL admin panel is not to be shipped.
- Provider accounts are a **shared operator-owned pool of legitimate paid accounts across tenants** for capacity and availability. This is not quota evasion. Attribute usage to both account/quota principal and tenant; enforce tenant budgets, provider/account/org limits, provider terms, and audit. Do not cross a provider-wide/contractual limit by silently changing keys.
- Control service is planned for `:8443`; one inference front door stays on `:4000`. The existing router and fleet gateway both default to `:4000`, so do not run them as separate listeners there.
- Keep real upstream provider keys at HQ only. Never put them on client nodes, print them, or send them to an external service. Edge Privacy stays local; cloud inference goes through the authorized tunnel. Do not introduce Docker on Windows nodes, VPS/DERP/Headscale, or extra llama-server processes.
- Do not commit or stage: the worktree has extensive pre-existing operator changes and untracked files.

### Implementation state (distinguish source from deployed behavior)

- **Family profile substrate: partial.** `IUser` and the Mongoose schema include nullable family owner/guardian/role, validated limits, and separate processing/transcript/image-consent fields. Public user serialization permits only `familyRole`; generic login/refresh responses remove family metadata. DB-free schema tests and response-allowlist/auth tests passed in the previous run. There are no family endpoints, account-creation flow, parent UI, or transcript authorization yet. Mongo-backed controller tests remain blocked by the local `mongodb-memory-server` MD5 mismatch; do not disable checksum validation or delete its cache.
- **STT gateway source: implemented and tested, deployment/UI path incomplete.** `fleet/src/gateway.mjs` proxies licensed multipart `POST /v1/audio/transcriptions`; `fleet/test/gateway.test.mjs` passed 12/12. A generated known-phrase WAV was sent through a temporary ephemeral server created from the edited source to the existing `:8080` Omni model; HTTP 200 returned “The quick brown fox jumps over the lazy dog.” The existing long-running `:4000` process was started before the edit and was not restarted, so this does **not** prove that the active gateway or LibreChat microphone flow uses the new route. Do not call full UI STT acceptance complete.
- **Operator APIs/UI, durable control service, shared paid-account pool, heartbeat/sync agent, and family APIs/UI: not implemented.** `:8443` was closed in the last recorded check. `/admin` returned the SPA fallback, not an operator page; `/api/admin` returned 404 in that runtime check. Existing admin API modules/capability patterns are reusable.
- **Brand/build state:** production frontend build and package builds passed in recorded runs; the local app served Satchida title/assets/config, and dark/light preferences were exercised. Visual acceptance is still **not passed**: login brand lockup is unverified and chat gradient screenshots were judged insufficient/ambiguous. Do not spend the next session on theme tuning unless product work exposes a concrete blocking issue.
- **Services:** NSSM was absent and no Windows services were installed. `:8080` and `:8091` are the operator’s model servers and were not touched. Recheck all PIDs/ports before any restart; the `:4000` gateway is not necessarily the edited `fleet/src/gateway.mjs` process.
- **Checks:** `npm run static-checks -- --against origin/dev` was blocked because `origin/dev` is absent in this shallow checkout; no fetch was run. DB-backed tests are blocked by the mongod MD5 mismatch. Record all later checks in `OVERNIGHT-LOG.md` with PASS/FAIL/BLOCKED/UNVERIFIED distinctions.

### Start the next session here

1. Recheck the current worktree and read `AGENTS.md`, this handover, `OVERNIGHT-LOG.md`, and the approved plan. Preserve the existing changes.
2. Run the DB-free family schema/response tests and current `npx tsc --noEmit` checks/builds for `packages/data-schemas`, `packages/data-provider`, and `packages/api`; correct any stale assertion or type issue before moving on.
3. Implement the planned durable control service on `:8443` with isolated tests and injected dependencies. Do not wire unsafe auth, in-memory production accounting, or a second `:4000` listener.
4. Then add authenticated `/api/admin/fleet/*` routes and a first-party `/admin` UI using existing auth/capability/audit patterns, typed provider contracts, query keys, localization, and real loading/error/empty states.
5. Continue with shared paid-account pool enforcement, the real HMAC heartbeat/policy sync flow, and family services/UI as specified in the approved plan. Update this handover and the execution log only when evidence changes.

---

## 0a. TOP PRIORITY — operator dashboard & admin panel

**The operator control plane/dashboard is the top product priority.** It is not implemented yet.

**Reality (verified):** `/admin` currently falls through to the SPA shell; there is no first-party operator page. The runtime check returned 404 for `/api/admin`. Existing authenticated admin APIs and capability patterns exist under `packages/api/src/admin/*`, but they do not constitute the Satchida fleet console. The AGPL-3.0 `admin-panel` remains rejected on licence grounds.

### What we must ship

| Surface                        | For                           | Content                                                                                                                     |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenant admin console** | **Satchida operator**         | Clients/nodes, licences, seat and spend caps, health, model routing, provider paid-account pool, policy push, revoke, audit |
| **Client dashboard**           | Client admin (society/school) | Their users, seats used, usage, spend, audit trail, support-access log                                                      |
| **Parent console**             | Parent                        | Child activity, time limits, schedule, per-mode permissions and explicit consent state                                      |

### Reuse and boundaries

- Reuse LibreChat's authenticated admin APIs, capability checks, audit log, and Langfuse integration where they fit. Langfuse can provide observability; it does not supply tenant licensing, enforcement, control-plane persistence, or the Satchida operator workflows.
- Guardrails, DNS filtering, moderation, PII scrubbing, and statutory reporting remain separate concerns; parental consent does not replace them. See `CHILDREN-SAFETY.md` and the approved plan.
- Helicone remains rejected as a redundant proxy. The control service stores only fleet/control metadata, not conversations or customer documents.
- The control plane requires a real durable store and signed heartbeat/policy flow; do not describe it as merely a UI over existing gateway state.

---

## 0b. Content filtering stack (client-side, since servers sit at client sites)

The four POCSO obligations are **content filtering, proactive monitoring, human review, statutory
reporting**. Reporting is assigned to the **Client** (see §0c). The rest:

| Layer                         | Choice                                                                                                                | Licence                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Gateway-level text filter** | **Guardrails AI** — programmatic, runs on local models                                                                | Apache-2.0                                 |
| **Model-level moderation**    | **ShieldGemma 2B** (~2 GB, fits 12 GB)                                                                                | Apache-2.0                                 |
| **DNS-level fallback**        | **Cloudflare 1.1.1.3** (malware + adult), **AdGuard DNS 94.140.14.14** (family), **NextDNS** (per-profile blocklists) | Free public services — **no self-hosting** |
| **PII scrubbing**             | Presidio                                                                                                              | MIT                                        |
| **Audit / activity trail**    | LibreChat's own `auditLog.ts` — `user`, `action`, `ip`, `userAgent`, `createdAt`, append-only `chainKey`/`seq`        | built in                                   |

**DNS approach the operator proposed is the right one:** set the client box's system DNS to a
filtering resolver. No self-hosting, no GPL entanglement, and it covers the whole machine rather
than only our UI. Offer it as a configurable setting on the deployment, with 1.1.1.3 as the
permissive default and a family blocklist as an option.

**Parent toggle enables child image generation; it does NOT replace filtering.** All four layers
above stay on regardless of the parental setting.

---

## 0c. Contract change — POCSO reporting duty moves to the Client

**Operator instruction, and it is correct:** we do not directly serve the end user — the server
sits at the client's location, on the client's network and ISP connection.

Therefore `CONTRACT-CLAUSES.md` must be amended so that the **Client** owns:

- the **statutory reporting duty** under POCSO s.19 to the Special Juvenile Police Unit / local
  police,
- proactive monitoring and human review of usage on its own instance,
- appointment of its safeguarding lead.

**Satchida's role** becomes: software, filtering, logging, and evidence — **not** the reporting
duty. This is both accurate and better for us: it puts the statutory obligation on the party that
is physically the service operator.

Amend §3 of `CONTRACT-CLAUSES.md` and add a client-side POCSO annex. Also update
`CHILDREN-SAFETY.md` §1.1 and `TERMS.md` §3 so the EULA puts the duty on the operator.

---

## 0d. Web search is blocked — full explanation and workarounds

**Symptom:** `mcp__fetch__fetch` and `WebFetch` fail on web search engines.

**Root cause — not our bug, and not fixable from here:**

| Host                         | Response                                            |
| ---------------------------- | --------------------------------------------------- |
| `duckduckgo.com/html/?q=...` | `robots.txt` → `Disallow: /html`, `Disallow: /lite` |
| `google.com/search`          | `robots.txt` → `Disallow: /search`                  |
| `meity.gov.in`               | returns empty content (JS-rendered)                 |
| `india code` PDF/bitstream   | returns **zero bytes** (blocks the agent UA)        |
| `egazette.nic.in`            | no response                                         |

**Why:** the fetching agent sends `User-Agent: ModelContextProtocol/Autonomous`. Those sites
disallow `/search` and `/html` for all agents, so the fetch is correctly refused. `google.com`
served a robots.txt _and_ the HTML in the same response because the MCP client fetched the
robots file, got 404-ish handling, then fell back — net result unusable.

**Options, in the order that worked:**

1. ✅ **GitHub REST API via `curl` — WORKS.**
   `curl -s "https://api.github.com/repos/OWNER/REPO"` → licence, stars, description, all JSON.
   Also `api.github.com/search/repositories?q=...` for discovery. Rate-limited (60/hr unauthenticated),
   so batch queries and prefer direct `/repos/` lookups when the project name is known.
   _This is what found Langfuse / Guardrails / AdGuardHome._
2. ✅ **Direct URL fetches of non-search pages** work when the target allows agents —
   `platform.openai.com/docs/...`, `anthropic.com/legal/...`, `developers.cloudflare.com/...`,
   `openrouter.ai/api/v1/models`, `api.github.com/...`.
3. ⚠️ **`.md` suffix trick** — many docs sites serve a clean Markdown version when you append
   `.md` to the URL (OpenAI's docs do). Worth trying before falling back to raw HTML.
4. ❌ **Web search engines** — blocked, treat as unavailable. Use option 1 + operator-supplied URLs.
5. ❠️ **If an operator supplies a URL, fetch it directly** rather than searching for it.

**Standing rule:** when research is needed, ask for the URL, or use the GitHub API. Do not burn
turns retrying a blocked engine.

---

## 0e. B2 — STT source route is implemented; active UI path remains unverified

The gateway source now implements licensed multipart `POST /v1/audio/transcriptions` and the
focused fleet gateway suite passed 12/12. An edited-source probe used a generated Windows-TTS WAV
and the existing `:8080` Omni model; it returned HTTP 200 with _"The quick brown fox jumps over
the lazy dog."_ See the dated test evidence in `OVERNIGHT-LOG.md`.

This is not yet end-to-end acceptance for the LibreChat microphone: the long-running `:4000`
process predates the route edit, and the active gateway plus LibreChat STT configuration/user
settings have not been confirmed to call this route. Do not report B2 fixed until the deployed
`:4000` gateway and actual browser microphone flow are verified. Never restart or replace the
`:8080` or `:8091` model servers to do this.

`/api/config` previously exposed no audio/STT defaults. If provisioning defaults are added, keep
them server-side, preserve user overrides, and test the actual settings and microphone flow.
TTS remains a separate acceptance question; do not assume the browser or Omni talker path is
complete solely from a successful transcription.

---

## 0f. Chat — what is verified and what is still open

**Verified working end-to-end:**

```
LibreChat :3080 ──▶ gateway :4000 ──▶ :8080 Omni
"CHAT FIXED" returned. Full chain, licence enforced.
```

**Two bugs found and fixed:**

1. **Gateway auth (mine).** Read only `x-satchida-licence`; LibreChat sends
   `Authorization: Bearer`. Now accepts bearer first, then the custom header, then `?licence=`.
   Gateway: `fleet/src/gateway.mjs`.
2. **Turnstile placeholder.** `librechat.yaml` had `siteKey: "REPLACE_WITH_..."`. A placeholder is
   _truthy_ → captcha required → widget can't load → **Continue disabled forever for every user
   including admin**, no UI recovery. Removed, with an explanatory comment.

**Env-var expansion — VERIFIED WORKING.** `librechat.yaml` uses
`apiKey: "${SATCHIDA_GATEWAY_LICENCE}"` (value lives in `.env`, gitignored). Expansion happens at
request time in `packages/api/src/endpoints/custom/initialize.ts:194` via `extractEnvVariable`,
with a guard at :197 that throws `Missing API Key` if it _fails_ to resolve.

**If chat still fails in the browser, check in this order:**

1. Gateway log `/tmp/gw.log` — is a request arriving at all? No request ⇒ LibreChat is not
   reaching the gateway (check `baseURL` and that :4000 is up).
2. Request arriving but `401 no_licence` ⇒ the bearer token is not resolving — confirm
   `SATCHIDA_GATEWAY_LICENCE` is present in `.env` **and** that LibreChat was restarted after it was
   added.
3. `402 seat_cap_exceeded` / `balance_exhausted` ⇒ entitlement, not auth.
4. `no_route_for_provider` ⇒ a cloud route was requested without a sealed key. Local is the
   default; cloud needs `?provider=<name>` **and** a sealed key.

**Note:** `/tmp` paths are Git Bash temp files and will not survive a reboot.

---

## 0. The one behavioural rule for whoever picks this up

**Test each link end-to-end. Do not assert that a feature works because the code for it exists.**

This session's failures, all mine:

| Claimed                                      | Actually                                                  |
| -------------------------------------------- | --------------------------------------------------------- |
| "Admin panel at `/admin`"                    | **No such route exists.** Never checked                   |
| "Stream resumption impossible without Redis" | In-memory `IJobStoreV2` implements it                     |
| "Wallet creates KYC exposure"                | Assumed a cash wallet; the real design is service credits |
| "DPDP Rules are Hindi only"                  | Bilingual — English from page 24                          |

Every one was caught by the operator testing something real. **Check, don't assume.**

---

## 1. Repo and git

```
Path:    D:\LAN-AI-Infra\LibreChat
origin:  https://github.com/techwatch4all-bit/LibreChat.git   (our fork)
upstream:https://github.com/LibreChat-AI/LibreChat.git
branch:  satchida   (working branch; NOT yet pushed)
upstream commit: f10b1d91 (2026-09-30, "ci: Remove Legacy GHCR Mirror #16585")
```

`git remote -v` to confirm. **Nothing has been pushed yet.**

## 2. Running services (verify with the port check below)

| Port | Service                                     | State                  |
| ---- | ------------------------------------------- | ---------------------- |
| 3080 | LibreChat                                   | ✅ boots, chat works   |
| 4000 | Satchida gateway                            | ✅ licence-enforced    |
| 8010 | RAG service (ours)                          | ✅ `/health` only      |
| 8080 | **User's** llama-server (CUDA, multi-model) | ✅ vision+STT verified |
| 8091 | **User's** granite (finetuned)              | ✅                     |

**These are dev processes. None are Windows services. All die on reboot** (tracked as V8).

Check:

```bash
for p in 3080 4000 8010 8080 8091; do printf "  %-5s " $p; curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://127.0.0.1:$p/; done
```

Expected: `3080→200  4000→401  8010→401  8080→415  8091→415`
(401/415 are correct — they mean auth required / no route at `/`.)

## 3. The user's model servers — DO NOT REPLACE

The user already runs a production-grade local inference setup. **Do not start duplicate
llama-servers.** (I did this once and was corrected.)

- **:8080** — `D:\LAN-AI-Infra\Satchida-AI-Interface\llama-cpp-cuda\llama-server.exe`
  - launch: `--ctx-size 32768 --jinja --n-gpu-layers 99 --device CUDA0 --flash-attn auto
--parallel 1 --models-preset D:\LAN-AI-Infra\satchida-ai-unified-suite\models-preset.ini
--models-max 1 --models-autoload`
  - GPU: **RTX 5070 Ti, 12 GB VRAM**
  - Verified working: `Qwen2.5-Omni-7B-Q4_K_M` (text+vision+audio),
    `Gemma-4-E4B-Uncensored`, `MiniCPM-V-4_6`
  - `D-Qwen3.6-12B-IQ-Q4_K_M` **fails to load** (likely VRAM)
- **:8091** — granite-4.0-1b, **finetuned by the user**: chat, vibe coding, deep research, 8K ctx.
  Not a utility dispatcher.

### models-preset.ini fix already applied (backup: `models-preset.ini.bak-satchida`)

Two bugs in the `Qwen2.5-Omni-7B-Q4_K_M` entry, both now fixed:

1. Path pointed at a non-existent `Qwen2.5-Omni-7B\` subfolder
2. **No `mmproj` line at all** — vision/audio 500'd for everyone. It was the only
   vision/omni entry of 21 missing one.

```ini
model  = C:\LAN-AI-Infra\LLM-models\Qwen2.5-Omni-7B-Q4_K_M.gguf
mmproj = D:\LAN-AI-Infra\LLM-models\Qwen2.5-Omni-7B\mmproj-Qwen2.5-Omni-7B-Q8_0.gguf
```

---

## 4. Verified working — don't rebuild

| Capability      | Evidence                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Omni text**   | returned `"OMNI TEXT OK"` exactly                                                                                                                |
| **Omni vision** | read the real `Satchida-logo.png` → _"promotional graphic for 'Satchida: True Conscious Intelligence.' Dominant colors are blue, pink, purple."_ |
| **Omni STT**    | fed real Windows-TTS speech → _"The quick brown fox jumps over the lazy dog."_                                                                   |
| **Gateway**     | licence → seat cap → balance → local route, all enforced                                                                                         |
| **Chat E2E**    | `"CHAT FIXED"` through LibreChat → gateway → Omni                                                                                                |
| **Tests**       | **60/60**: fleet 51 (keystore 15, licence 12, gateway 9, credits 15) + RAG 9                                                                     |

### Two bugs fixed this session

1. **Gateway auth** — read only `x-satchida-licence`; LibreChat sends `Authorization: Bearer`.
   Fixed to accept bearer first, then custom header, then query param.
2. **Turnstile placeholder** — `librechat.yaml` had `siteKey: "REPLACE_WITH_..."`. A placeholder
   string is _truthy_ → `requireCaptcha=true` → widget can't load → **Continue button disabled
   forever, locking out every user including admin, with no UI recovery.** Block removed with an
   explanatory comment. **Never put a placeholder in that field.**

---

## 5. Credentials — locations only, never values

| What                       | Where                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Master key (API key vault) | `C:\ProgramData\Satchida\keyring\master.key` — ACL: SYSTEM + current account only                                            |
| Gateway signing keypair    | `fleet/.state/signing.key.pem` (private), `signing.pub.pem`                                                                  |
| Licence token              | `fleet/.state/licence.token` — this is the endpoint `apiKey` in `librechat.yaml` via `${SATCHIDA_GATEWAY_LICENCE}` in `.env` |
| Admin login                | `admin@satchida.local` — password was in shell history, **rotate it**                                                        |
| LibreChat `.env`           | gitignored (verified with `git check-ignore`)                                                                                |

**Operator directive: never print, echo or copy any key. Never store a key in an environment
variable, in `.env`, or in code.** An earlier `SATCHIDA_MASTER_KEY` registry variable was found
and removed from `HKCU\Environment` (V21).

## 6. Config files that matter

| File                                         | What                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `librechat.yaml`                             | 3 modes (Chat/Work/Privacy), 8K ctx, endpoint → gateway                                                                      |
| `.env`                                       | `ALLOW_SOCIAL_REGISTRATION=false` (**the auth gate**), `RAG_API_URL=:8010`, `SCHEDULES_SINGLE_PROCESS=true`, gateway licence |
| `D:/Indian ACT/`                             | 163 official Bare Act PDFs — the legal research corpus                                                                       |
| `D:/LAN-AI-Infra/Satchida/Satchida-logo.png` | confirmed master logo (opaque-white-plate — see `Customizations.md`)                                                         |

---

## 7. OPEN BUGS

| #      | Bug                                                                                                                                                                                                                       | Notes                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** | **No operator console.** `/admin` currently falls through to the SPA shell; no first-party Satchida console is implemented. Existing admin APIs are not the fleet dashboard. The AGPL-3.0 `admin-panel` remains rejected. | Biggest gap. See Resume now and §8                                                                                                                                                                                                                                                    |
| **B2** | **STT from the UI mic is not fully deployed/verified**                                                                                                                                                                    | The gateway source now proxies licensed `/v1/audio/transcriptions`, with focused tests and a live edited-source probe passing. The long-running `:4000` process predates that edit, and the LibreChat microphone/configuration path has not been verified end-to-end. See Resume now. |
| **B3** | Services die on reboot                                                                                                                                                                                                    | All dev processes; need NSSM (V8)                                                                                                                                                                                                                                                     |
| **B4** | `Qwen3.5-9B-VLM` returned empty on vision test                                                                                                                                                                            | Omni covers vision; investigate before routing to it                                                                                                                                                                                                                                  |
| **B5** | `librechat.yaml` modelSpecs claim 128K on some entries                                                                                                                                                                    | Unreachable in 12 GB VRAM — a second cause of 500s                                                                                                                                                                                                                                    |

## 7a. NEW — decided this session (2026-10-04, late)

### Observability: **Langfuse, not Helicone** — decision made

The operator saw a Langfuse integration already present in LibreChat settings, which makes it
near-free to adopt for observability. **Helicone was considered and rejected** as a second proxy.
The current fleet gateway has injected hooks for licence, seat, spend, and key enforcement, but
its default spend store is not durable and it is not yet integrated with the planned control plane
or tenant/account ledgers. Passing gateway tests does not establish production accounting.

**Action:** confirm the Langfuse integration in LibreChat settings, point it at our control
service, use it for per-tenant usage and cost dashboards.

### Parental consent & child supervision — design recorded; implementation pending

The approved implementation plan now records the required safeguards and staged delivery. The current schema is only a substrate; there are no family endpoints, validated child-account creation, parent UI, transcript access controls, or enforcement yet. Requirements include:

- A **parent toggles image generation on for their child**, through their own account.
- The parent accepts a **separate parental-consent EULA**, recorded in the DB.
- **Image generation for a child is enabled only by that parental action** — the framing that
  makes it the parent's decision, not ours.
- The parent can **enable/disable the child's account by schedule and time-of-day limits**.
- **Child supervision dashboard** — the operator expects this to be a strong selling point.

**Substrate already exists — do not go looking for an OSS product for this.** LibreChat's
`packages/data-schemas/src/schema/auditLog.ts` already carries `user`, `action`, `ip`,
`userAgent`, `createdAt`, plus an append-only `chainKey`/`seq` chain. That is an activity log
with tamper-evidence. I searched for an OSS parental-control product and **could not verify one
exists**: the credible analogues (Google Family Link, Apple Screen Time) are closed, and
self-hosted DNS filters (Pi-hole, Blocky) do categories only — no per-child time limits, no
consent flow, no activity log. **This is a feature build on existing primitives, not an
integration.** Do not fabricate a product name to satisfy the "reuse" instinct here.

### POCSO — precise position

Cloud providers serve minors and do **not** rely on parental consent. They rely on four
independent things: technical filtering, proactive monitoring, human review, and a **statutory
reporting duty** under POCSO s.19 to the Special Juvenile Police Unit / local police.

Parental consent is an **additional** layer, not the legal mechanism. So:

- The parental-toggle design **strengthens** the position but does **not** replace filtering,
  moderation, reporting, and logging.
- **ShieldGemma 2B** (Apache-2.0, ~2 GB, fits in 12 GB VRAM) is the moderation choice.
- A **named POCSO reporting contact** must be published before image generation ships to any
  school, and a visible report path must exist in-product.

### Image generation by mode — operator requirement

|           | Chat | Work | Study | Privacy |
| --------- | ---- | ---- | ----- | ------- |
| **Adult** | ✅   | ✅   | ✅    | ✅      |
| **Child** | ❌   | ❌   | ✅    | ✅      |

Child access is gated on the **parental toggle + parental EULA**, never on our own grant.
Image generation for under-18 accounts therefore **cannot ship** until moderation (ShieldGemma),
the reporting mechanism, and the named contact are live. See `CHILDREN-SAFETY.md`.

### Design constraint for supervision — do not violate

**A child must always be able to see that a parent is viewing.** No hidden monitoring channel,
no invisible toggle. Suppression surfacing is both an ethics failure and the fastest way to
destroy the trust the feature depends on.

Suggested default: parent sees **categories, topics and time-of-day**; full transcript only where
a parent has explicitly enabled it for their own child, and always visible to the child.

### Family pooling — open questions for the operator

Credits attach to a `familyId`; members draw from the shared pool; `guardTransfer()` is
**unchanged** (it blocks movement _between_ accounts, which is different from members sharing one
entitlement — precedent: mobile family plans). Undecided:

1. Do **images pool** or stay individual? _(recommend individual — image cost is bursty and
   abuse-prone)_
2. Does a **child draw from the family pool**? If yes, under-18 restrictions still apply —
   no image generation regardless of pool balance.

## 8. Next actions, in order

1. **Control service on `:8443`**, durable persistence, HMAC heartbeat, signed policy/license response, replay and expiry checks, and audit. This is the first implementation milestone in the approved plan.
2. **Authenticated operator API and first-party `/admin` console** for fleet, tenant policy, paid provider accounts, routing, health, and audit. Reuse auth/capabilities; do not ship the AGPL admin panel.
3. **Consolidated inference router and shared paid-account pool** on the single `:4000` front door. Enforce account/quota-principal and tenant accounting, provider limits/terms, licences, and retry rules. Never put upstream provider keys on client machines.
4. **Native node sync agent** and verified policy application. Test a real node check-in and an inference decision changed by policy before claiming the heartbeat phase complete.
5. **Finish family API and parent/child UI** only after control-plane policy exists. Preserve separate consent categories and visible/audited transcript access.
6. **Complete STT acceptance** by safely restarting only the verified gateway process if required, then exercising the actual LibreChat microphone path through the active `:4000` gateway. Seed user speech defaults only as a separate, tested change.
7. **RAG m6/m3** and NSSM/service installation remain separate follow-up work; NSSM is absent and service installation is not authorized by the current build task.

### Operator console — Langfuse for the console, our gateway for enforcement

| Need                                       | Answer                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Usage + cost observability                 | **Langfuse** integration exists in LibreChat settings; it does not implement Satchida's fleet console or durable tenant accounting                     |
| Seat caps, spend caps, licence enforcement | Existing fleet gateway has injected enforcement hooks, but production durable tenant/account ledgers and control-plane integration are not implemented |
| Second proxy in front                      | **Not needed.** Helicone was evaluated and rejected as redundant                                                                                       |

## 9. Product requirements from the operator (not yet designed)

- **Image generation by mode:** child gets it in **Study** and **Privacy**; adult in **all four**
  modes (Chat, Work, Study, Privacy).
- **Child supervision:** adult/parent view of a child's prompts, images, and usage. The operator
  believes this will sell strongly. Needs a deliberate privacy design — categories and topics
  rather than raw transcripts was my earlier suggestion.
- **Family pooling:** credits attach to a `familyId`, not an individual; members draw from the
  shared pool; **non-transferable between families**. `guardTransfer()` is unchanged — it blocks
  movement _between_ accounts, which is different from members sharing one entitlement
  (precedent: mobile family plans). Two open questions: do images pool or stay individual
  (recommend individual — image cost is bursty), and does a child draw from the family pool.

## 10. Architecture decisions — settled, don't relitigate

- **Cloudflare Named Tunnels on `satchida.com`**, not Headscale. One tunnel per client; `control`
  (metadata, Service Token) separated from `api` (router, carries content).
- **No Docker anywhere.** Native Windows + NSSM.
- **No Redis** — no MIT/Apache Redis-compatible server has a native Windows build.
- **vLLM is out** — Linux/CUDA only. **llama.cpp** is the engine.
- **MongoDB is client-operated** — privacy, SSPL, and BNSS s.94 all point the same way.
- **Licensing gate is `ALLOW_SOCIAL_REGISTRATION=false`** — OAuth may sign in an existing account,
  it can never create one.
- **Support admin is disclosed**, `.invalid` email (RFC 2606, provably no mailbox, provably not
  an OAuth identity), unique random password per client, client can revoke.
- **Payment records cannot be erased** (statutory); break the _link_ instead.
- **Naming: use `Satchida`.** Drop the suffix — "ASI" is a loaded term, "anonymous" over-claims.

## 11. Documents (read in this order)

| Doc                                                  | What it settles                                             |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `SOLUTIONS.md`                                       | Every settled decision + **8 corrections I made**           |
| `CONTROL-MODEL.md`                                   | What is enforceable and where; why `.env` is not a boundary |
| `SECURITY-DESIGN.md`                                 | Key vault, crypto-shredding, tiered access                  |
| `CONTRACT-CLAUSES.md`                                | Client agreement + erasure clause 5.2a                      |
| `VULNERABILITIES.md`                                 | V1–V24 with open/mitigated/closed status                    |
| `TERMS.md`                                           | End-user terms; **§3 prohibitions, §5 credits**             |
| `INDIAN-ACTS-RAG.md`, `DPDP-CHILDREN.md`, `LEGAL.md` | Indian legal position                                       |
| `MODEL-CATALOG.md`                                   | **INTERNAL ONLY** — never show a user                       |

## 12. Test suites

```bash
cd fleet && node --test --test-force-exit test/keystore.test.mjs test/licence.test.mjs \
  test/gateway.test.mjs test/credits.test.mjs      # 51
cd rag-service && node --test test/contract.test.mjs   # 9
```

`--test-force-exit` matters: undici keeps connections alive and `server.close()` would hang.
`close()` already calls `closeAllConnections()`, but the flag is belt-and-braces.

## 13. Environment notes

- **`PORT=5174` is exported in the shell** by the SCode harness profile. It **overrides** `.env`'s
  `PORT=3080` because dotenv does not override existing `process.env`. Always `unset PORT` before
  `npm run backend`. Windows services don't load that profile, so it won't affect production.
- Shell is **Git Bash** on Windows. `pdftotext` and `python` are available.
- Disk D: had 94 GB free at last check (was 32 GB earlier — keep an eye on it).

## 14. Highest-priority open items

1. Durable fleet control service and heartbeat on `:8443`, followed by authenticated operator APIs and the `/admin` console.
2. Consolidated `:4000` inference ingress with shared paid-account routing, per-tenant and per-account accounting, provider quota/terms enforcement, and signed entitlement.
3. Native node sync agent and verified signed policy application; no heartbeat/control service exists yet.
4. Family APIs, safe child-account creation, consent-gated parent views, and parent/child UI; only schema/privacy substrate exists.
5. Complete active-gateway and actual LibreChat microphone STT acceptance (source route and edited-source probe pass; current long-running service/browser path is not proven).
6. Services die on reboot; NSSM was absent and no service was installed. Do not install/register services without the required maintenance approval.
7. Re-run `VULNERABILITIES.md` items and verify current status before acting; older notes about Turnstile placeholders, dependency counts, and fresh-install admin bootstrap may be stale.

---

## 15. Three-Tier Dashboard — Full Element-by-Element Design

_Approved by operator 2026-10-05. Build these interfaces after the P1 control service backend exists._

---

### Console Architecture

```
Tier 1 — OPERATOR CONSOLE    control.satchida.com:8443
         Satchida operator only.  Cloudflare Service Token + bcrypt.
         Sees ALL tenants, ALL provider accounts, ALL keys (fingerprint only).

Tier 2 — CLIENT/TENANT ADMIN PANEL   <subdomain>.satchida.com/client-admin
         School/RWA/SMB admin only.  Local client-provisioned admin account.
         Sees THEIR tenant only.

Tier 3 — END-USER USAGE DASHBOARD   (LibreChat Settings tab)
         Individual user.  Parent sees child's data too if family plan.
```

---

### Tier 1 — Operator Console Elements

**1A — Fleet Dashboard (landing page):**

- Global health bar: tenants ACTIVE/EXPIRED/BLOCKED/SUSPENDED counts, total active seats, total token spend today, alert count
- Tenant table columns: Client Name, Subdomain, Status Badge, Plan, Seats (Used/Allowed), Licence Expiry + countdown, Last Heartbeat age, **Node IP** (dynamic — Cloudflare tunnel source IP from `CF-Connecting-IP` header), Token Spend Today, Token Spend This Month
- Actions per row: Renew / Suspend / Revoke / Push Config / View Details
- Filters: Status, Plan, Expiry window (7/30 days), Search

**1B — Tenant Detail Drilldown:**

- Identity: client_id, subdomain, tunnel URL, plan, licence JWT payload (human-readable decoded)
- Licence history timeline: issued → renewed → upgraded → suspended → revoked
- Real-time node status: last heartbeat ts + source IP, router_version, active sessions, enforcement status
- Usage ledger: today / week / month / all-time tokens; breakdown by provider account AND by mode (Chat/Work/Study/Privacy)
- Image credits: used / allocated
- Heartbeat history chart: 7-day timeline of 6-hour slots (up/down), table with ts + active_seats + token_usage_delta + IP
- Licence event log: immutable audit of all events with operator identity
- Actions: Issue Licence, Renew (1mo/3mo/1yr), Upgrade/Downgrade, Suspend, Revoke, Unblock, Push Config

**1C — Provider Key Pool Management:**

- Table: Account Alias, Provider, Key Fingerprint (last 4 chars only — NEVER full key), Monthly Spend Ceiling, Spend This Month, Spend %, Status badge, Tenants Using count, Last Used
- Add key: secure input → stored in `C:\ProgramData\Satchida\keyring\` encrypted → fingerprint logged to audit → old key RETIRED → new key AVAILABLE (no restart)
- Routing rules: drag-and-drop fallback order per plan tier
- Alerts: key not rotated > 90 days; account at > 80% spend ceiling

**1D — Account Allocations Manager:**

- Per-tenant: seat count, token credits/month, image credits/month, feature flags, family plan toggle + max minors, plan tier, mode access checkboxes, STT/TTS toggle, content filter level
- Batch operations: multi-select tenants → apply same allocation

**1E — Global Admin Settings (pushed to all tenants via heartbeat):**

- MCP Servers: table with name/URL/transport/auth/enabled tiers; add/edit/disable; tier gate
- Agent Marketplace: name/category/skills/visible-to tiers; enable/disable/feature
- RAG: enable per tier, embedding model, chunk size, overlap, similarity threshold, max results
- Content Filtering: Guardrails AI ruleset per tier, DNS preset (1.1.1.3/AdGuard/NextDNS), ShieldGemma toggle
- Model Routing: provider account assignment per tier, fallback order, local-vs-cloud slider
- Family Plan: enable per client, max minor profiles
- STT/TTS: Omni :8080 endpoint pre-configured for all tenants; per-tenant override available

**1F — Reconciliation Console:**

- Pending UPI payment table: user/tenant, plan requested, amount, UPI ref, submission ts, status
- Actions: Approve (issues licence + activates subscription) / Reject (with reason)
- CSV export for bank reconciliation

**1G — Operator Audit Log:**

- Every operator action: timestamp, operator identity, action type, target, payload diff, source IP
- Non-deletable, filterable, paginated

---

### Tier 2 — Client/Tenant Admin Panel Elements

**2A — Tenant Dashboard:**

- Summary row: active users / seats used, token spend today, token spend this month, image credits used, service status + expiry countdown
- Renewal button → opens UPI payment flow (QR + reference submission to pending queue)

**2B — User Account Provisioning:**

- User list table: display name, account type (Standard/Child/Admin), status, seat (active session Y/N), tokens today, tokens this month, images this month, last active, family group, actions
- Create user form: username, display name, role (User/ClientAdmin/Child), if Child → assign parent, if Family → assign group, initial password, feature overrides (client admin can only restrict, not expand beyond plan)
- Bulk CSV import: provision N users at once
- Bulk operations: suspend, reset passwords
- V10 protection: `ALLOW_REGISTRATION=false` enforced — cannot accidentally open self-signup

**2C — Per-User Usage Breakdown:**

- Usage table: user, chat messages, tokens (in+out), images, RAG queries, web searches, last active, mode breakdown
- Charts: daily token spend (30-day bar), mode distribution pie, peak hour heatmap
- Per-user drilldown: usage history, session log; (parent only) child chat transcript if monitoring enabled

**2D — Family Account Management (Family Plan only):**

- List all family groups: owner, secondary adult, children (up to 3)
- Per-family pool balance
- Create/edit group: assign owner, secondary, children
- Per-child controls: image gen toggle (default OFF), usage schedule (allowed hours), daily token cap, daily image cap
- MonitoringBanner: ON always, non-configurable

**2E — Client Audit Log:**

- Client admin actions only: user creates/deletes/suspensions, password resets, family group changes
- Read-only, non-deletable

---

### Tier 3 — End-User Dashboard Elements

**3A — Personal Usage Summary:**

- Current period: tokens used / allocated (progress bar), images / allocated, web searches, RAG queries
- Plan badge + renewal date
- Today: messages, tokens, mode breakdown

**3B — Usage History:**

- 30-day daily bar chart (tokens in / out)
- Mode usage over time
- Download CSV of own usage metadata (DPDP Act 2023 s.11 right of access)

**3C — Parent Dashboard (Family Plan parent only):**

- Child list: name, status, usage today, session active
- Family pool tokens remaining
- Per-child: usage stats, session history, chat transcript access (if monitoring enabled at signup)
- Child controls: image gen toggle, usage schedule, temporary suspend ("Pause for tonight")

---

### 8 Design Gaps Not Yet in Any Architecture Doc

1. **Node IP tracking** — gateway must read `CF-Connecting-IP` from Cloudflare tunnel and include it in heartbeat body. HQ stores as `tenants.last_ip`. Required for operator console node IP column.

2. **Real-time usage events** — current design batches usage in heartbeat delta (6h). For live operator view: add lightweight async `POST /fleet/usage-event` that gateway fire-and-forgets after each response. Non-blocking to inference path.

3. **Per-account spend breakdown** — gateway must log `(clientId, accountAlias, provider, input_tokens, output_tokens)` per request, not just totals. Required for provider key pool spend-per-account column.

4. **CLIENT_ADMIN role** — LibreChat RBAC has ADMIN and USER. Need a `CLIENT_ADMIN` role: can manage users and view usage within their tenant only; cannot see other tenants or operator settings. Sits between ADMIN and USER in `role.ts`.

5. **Session log** — login/logout events not in current auditLog. Add `action: 'session.start'` and `action: 'session.end'` to `auditLog.ts` capture. Required for parent dashboard session view.

6. **Client-side payment flow** — when Tier 2 admin's licence is expiring, they initiate renewal via UPI QR + transaction ref submission from within their admin panel. This POST route and the client-facing UPI QR display are not designed anywhere yet.

7. **MonitoringBanner server enforcement** — banner must be non-bypassable. Implementation: `isChild: true` in licence JWT → API adds `X-Monitoring-Active: true` header on every response → LibreChat client reads header and renders banner regardless of DOM state. Removal from DOM has no effect because next request re-adds it.

8. **DPDP data export** — `GET /api/user/data-export` endpoint: returns own conversation metadata (timestamps, modes, token counts — NOT raw content unless explicitly requested) as JSON/CSV. Required before any school or minor user is onboarded (DPDP Act 2023 s.11).

---

## 16. SESSION 2026-10-05 (evening) — extensions, RAG, and a broken chat

Read this section before touching routing. It corrects an earlier impression.

### 16.1 What was built and verified

**Extensions now populated (all verified live via the API and the browser):**

|             | Count  | Notes                                                                                 |
| ----------- | ------ | ------------------------------------------------------------------------------------- |
| Agents      | **45** | 4 Satchida product agents + 23 from the local agent pack + 18 converted from opencode |
| Skills      | **20** | 6 authored + 4 from the local download + 10 pulled from `zai-org/ZCode` (Apache-2.0)  |
| MCP servers | **5**  | filesystem, memory, sequential-thinking, playwright, context7 — all connected         |
| Hooks       | **3**  | shell guardrail, secret redaction, child-safety gate; 63/63 tests                     |

Scripts that produced these, all idempotent: `scripts/seed-satchida-agents.mjs`,
`scripts/convert-local-agent-pack.mjs`, `scripts/convert-opencode-agents.mjs`,
`scripts/provision-master-tenant.mjs`.

**Two root causes worth remembering** — both made a working feature look broken:

1. Mongoose stores agents in collection **`agents`** (lowercase). An earlier seed wrote to
   `Agent`, creating a collection no query ever reads. Always create agents through the API.
2. `user.tenantId` was absent, so every tenant-scoped read returned `permission_denied`
   and the marketplace showed "No agents found". Fixed by `provision-master-tenant.mjs`,
   which creates the **`satchida-master`** tenant (HQ is itself the master tenant).

**Master tenant** `satchida-master` exists; `admin@satchida.local` and the 4 Satchida
agents carry it.

### 16.2 RAG is real and working — no third-party RAG was installed

To be explicit, because this was mis-stated earlier in the session: **no external RAG
package was downloaded or merged.** `rag-service/` was an existing Satchida stub
(`501 not_implemented` on all three routes) and has been finished in place.

- Embeddings come from **Ollama on `:11434`**, which was already running with models
  installed. Chosen: **`all-minilm:l6-v2`** (384-dim, 23 MB) over
  `nomic-embed-text-v2-moe` (768-dim, 1 GB) — identical measured quality, 14x faster,
  negligible VRAM. `bge-m3` was pulled and benchmarked; it was **worse** (1/4 vs 2/4)
  at 1.2 GB, so it is not used.
- **No API key required and nothing leaves the machine.** `OPENAI_API_KEY` in `.env` is a
  13-character placeholder, not a working key.
- Verified: POCSO Act 2012 -> 66 chunks; DPDP Act 2023 -> 79 chunks; 384-dim;
  `/health` reports `embeddings: verified`; loopback-only; forged token rejected.
- Retrieval is correct: "Who must report a child offence?" returns **POCSO s.19**; an
  access query returns **DPDP s.11 Right to access**.
- **Two contract violations were found and fixed** so LibreChat actually calls it:
  `/text` must return `text` (`packages/api/src/files/text.ts:134`) and `/query` must
  return `[[{page_content, metadata:{source,page}}, score], ...]`
  (`packages/api/src/files/rag/search.ts:23-28`). The first version returned a different
  shape and LibreChat silently fell back to native parsing.
- Run it with **`node rag-service/start.mjs`** — not `src/index.mjs`. The launcher is what
  loads `.env` and binds the Ollama key; without it the service comes up on the wrong port.
- `sovereign-rag-platform` was assessed and **deliberately not merged**: its own checklist
  puts it at 14.3% (Phase 0), `:3020` is down, and it is proprietary.

### 16.3 CHAT IS BROKEN — fix this first

Browser-verified by sending a real message:

> The model provider could not complete this request (status 400). **400 model 'Chat' not found**

**Correction to a wrong assumption made earlier in this session: no second llama-server
was or should be created.** The `:4000` process is `fleet/scripts/dev-gateway.mjs`, a thin
Node proxy. It contains **no `spawn`, no `exec`, no child process**, and
`defaultUpstreams()` already points local traffic at your existing
`http://127.0.0.1:8080`. The `:8080` llama-server (21 models loaded) is untouched.

The actual defect: `fleet/src/gateway.mjs` is a **transparent proxy** — it forwards the
`model` field verbatim. `Chat`/`Work`/`Study`/`Privacy` are LibreChat-facing labels, and
no component translates them to a concrete GGUF alias that `:8080` recognises.

Fix in `gateway.mjs`: resolve the mode label to a real local model id before the upstream
call. Do not start another llama-server.

**Also unresolved:** `fleet/scripts/dev-gateway.mjs` and
`satchida/router/src/server.mjs` both default to port 4000. Only one may listen.
Licence, seat and spend enforcement lives in the fleet gateway and must be preserved.

**Both licences verify correctly** (`fleet/.state/licence.token` and the
`SATCHIDA_GATEWAY_LICENCE` in `.env`). An earlier "401 licence_invalid" reading in this
session was a bad test (`Bearer test`), not a real fault.

### 16.4 Model limits to state honestly to customers

- **No text embedding model can analyse an image.** `all-minilm`, `nomic` and `bge-m3` all
  take text. An anatomy diagram or a 20-year trading chart is pixels. The only local route
  is: Omni `:8080` reads the image -> emits a description -> that text is embedded.
- Every local embedding model scores **1/4–2/4 on paraphrased queries**. Pure vector
  search will miss reworded questions; a hybrid keyword fallback is a requirement, not a
  nicety.
- `:8080` cannot serve embeddings at all (`501: start it with --embeddings`). That is
  expected and irrelevant while Ollama provides them.

### 16.5 Standing directive

**Verify features as a real user in the browser.** Use the in-app browser; do not accept
an API probe as proof of a user-facing feature. This directive exists because an API-only
check would have reported chat as working when the UI returned a 400.

### 16.6 Operator-only RBAC status (2026-10-06)

`operator:control` is a direct USER platform grant, excluded from the ADMIN role and
rejected by generic grant writes. Startup removes legacy platform-scoped grants from
the ADMIN role and reconciles the configured operator's direct platform capability set;
tenant-scoped grants are preserved. The configured master-tenant user currently has the
direct operator grant in MongoDB. The root `.env` contains `SATCHIDA_OPERATOR_USER_ID`
and is loaded by `api/config/credentials.js`; absence from PM2's serialized env snapshot
does not mean dotenv bootstrap is skipped.

The running PM2 process has **not** been restarted after the latest route/package changes,
so the database grant is live but the loaded server code may be stale. Restart only during
a separately approved maintenance window, then verify the real browser/operator surface.
Do not grant operator access by role. See `Bugs.md` B24. Tenant provisioning/usage APIs
and the operator console are not implemented. Bifrost Phase 3 remains paused pending
explicit approval.
