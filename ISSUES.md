# Issues & Open Questions — Satchida AI Harness

Live list of known defects, unresolved risks, and decisions. Unlike `Bugs.md` (which holds
findings about the product), this is the working queue.

Append-only. Resolved items move to `§5` with a date rather than being deleted.

---

## 1. Open issues

### I1 — `.env` is not a security boundary on client hardware

**Severity: High.** Every LibreChat setting lives in a `.env` file on the **client's own disk**.
`ALLOW_SOCIAL_REGISTRATION=false` can be changed by the client with a text editor. So can
`ALLOW_REGISTRATION`, `ALLOW_EMAIL_LOGIN`, and everything else.

**What this means:** none of our LibreChat-side settings prevent a determined client from
re-enabling self-registration or granting themselves more accounts locally.

**What actually holds the line:** only enforcement on **our** side.
- The gateway refuses inference without a valid Ed25519 licence token
- Seat caps, spend caps and plan entitlements live in our authorisation service
- Without a valid licence, cloud modes do not function — regardless of local config

**Action:** state this plainly in the service agreement. We do not claim to prevent local
tampering; we claim that the service stops working without us. **Do not market local settings as
enforcement.**

### I2 — Stream resumption without Redis — RESOLVED, prior claim was wrong

**Severity: Informational (was recorded as an open problem in error)**

An earlier draft stated there is no mid-response stream resumption without Redis. **That was
wrong.** Verified in this repository:

`packages/api/src/stream/createStreamServices.ts:74` selects the backend:

```
const useRedis = config.useRedis ?? cacheConfig.USE_REDIS_STREAMS;
```

Two implementations exist and both satisfy the same contract:
- `stream/implementations/InMemoryJobStore.ts` + `InMemoryEventTransport.ts`
- `stream/implementations/RedisJobStore.ts` + `RedisEventTransport.ts`

`InMemoryJobStore` implements `IJobStoreV2`, which includes the resume primitives
(`hasSubscriberAttached`, `claimFirstSubscriber`, `restoreClaimedSteers`, `transitionStatusAndDrainSteers`).

**Correct position:** resumable streams work without Redis. The only difference is **durability
across a process restart or crash**, plus multi-replica sharing. Our client deployments are
single-replica with a long-lived process, so in-memory is sufficient.

**Redis remains omitted** — for the reasons in `DEPLOYMENT.md`, not because resumption is
impossible.

### I3 — No email-domain allowlist exists in LibreChat

**Severity: Medium.** Searched `packages/api`, `packages/data-provider` and `api/server` for
`allowed_regex`, `allow_list`, `allowed_domain`, `email_domain`, `domainRestrict`,
`allowedEmail`. **Zero matches.** The setting does not exist in this build.

**What this means:** a school wanting to restrict access to `@school.edu` cannot do it with a
config toggle. Two workable substitutes:

| Option | How | Trade-off |
|---|---|---|
| **Pre-provision only** (recommended) | Client's admin creates only `@school.edu` accounts | Manual load; but combined with `ALLOW_SOCIAL_REGISTRATION=false`, a non-school Google ID is refused at sign-in |
| **Seat-service domain rule** | Our authorisation service rejects a token whose subject's domain is not on the client's allowed list | Automatic, but requires the control service (Phase 1) and the domain must be known from the token |

**Recommendation:** pre-provisioning first (free, immediate), domain rule in the control service
once it exists. Raise this proactively with any school rather than letting their IT team find it.

### I4 — Cloudflare free-plan rate-limiting rules unverified

**Severity: Low.** Bot Fight Mode is confirmed free and domain-wide (Cloudflare docs), but it
**cannot be customised via WAF custom rules** — Cloudflare states this explicitly. The exact
number of rate-limiting rules available on the Free plan could not be verified; the doc URL
404'd.

**Action:** confirm on the Cloudflare dashboard. Until then, treat `/api/auth/login` rate
limiting as unconfirmed and rely on **Turnstile** (wired in `librechat.yaml`) plus
`ALLOW_PASSWORD_RESET=false`.

### I5 — Cloudflare self-serve plan has no Data Processing Addendum

**Severity: Medium (accepted).** Recorded deliberately in `CLOUDFLARE-ACCESS.md` §8 D3. A school
as Data Fiduciary would be processing student personal data through a processor without a DPA.

**Mitigation:** `CLIENT-PROPOSAL.md` §9 discloses it and offers the client-owned tunnel at no
charge. **Never promise a DPA we do not hold.**

### I6 — 42 npm vulnerabilities (6 low, 36 high)

**Severity: Medium.** From `npm install` at commit `f10b1d91`. Predominantly transitive.

**Action:** `npm audit` triage before any client deployment. **Do not run `npm audit fix --force`**
— it applies breaking changes. This is a product going to schools and SMEs.

### I7 — Search your confirmation flow

**Severity: Informational.** `Client uses an identity alias` (Student001 / John Doe) as the
LibreChat username, with a society-issued password, and holds a paid Satchida subscription.

**Answer:** yes, this works. `ALLOW_EMAIL_LOGIN=true` with `ALLOW_REGISTRATION=false` is exactly
that model — the society provisions accounts, no external identity provider involved. **We never
see the account**: the database is on the client's hardware.

**Caveat:** if the society uses Google OAuth instead, Google's verified email lands in the
society's database, so *they* hold the real identity. Alias-based local accounts keep them
pseudonymous. That trade-off is theirs to make; either way we are unaffected.

### I8 — Nothing binds to 3080/8010 after a shell restart

**Severity: Low (operational).** Both services must be started as **Windows services** (NSSM) to
survive reboot. `PORT=5174` is exported in the interactive shell by the SCode harness profile
and silently overrides `.env`; a Windows service does not load that profile, so it does not affect
production.

---

## 2. Unverified third-party terms

| Provider | Status |
|---|---|
| Google Gemini API | ⚠️ Terms page script-rendered; not retrieved |
| Meta | ⚠️ Not retrieved |
| OpenCode Zen | ⚠️ Not retrieved |
| TokenHarbor | ⚠️ Marketing page only |
| CommandCode | ⚠️ Appears to be a coding agent, not an API gateway |
| Experiential Labs | ⚠️ No matching service identified |

**These may not carry paid customer traffic until read.**

## 3. Unverified statutory text

All four are extraction failures on one PDF, not research failures:

| Provision | Subject |
|---|---|
| DPDP Act **s.17** | Small-enterprise exemption and notification duty |
| DPDP Act **s.9** | Parent-consent standard |
| DPDP Act **s.16** | Cross-border transfer restrictions |
| IT Act **s.43A / s.70B** | Leakage compensation; nodal contact → CERT-In link |
| DPDP Rules **Third Schedule** | Retention class applicable to an operator our size |

## 4. Decisions awaiting the operator

1. Seat-pack pricing and mid-term increase mechanics (`BUSINESS-PROPOSAL.md` §9)
2. Whether Image bundles are sold separately or inside the AMC
3. Whether Clients may mark up account packs
4. Whether the Privacy add-on is available on Standard or Pro-and-above
5. Cloudflare tunnel ownership per client (we operate, or they do)
6. Whether Satchida will supply the router on client hardware or proxy from HQ

---

## 5. Resolved

| Date | Item |
|---|---|
| 2026-10-04 | **RAG port collision.** Port 8000 was Satchida Hands (OpenHands SPA) returning 200 + `text/html` on every path; LibreChat logged a false "RAG API reachable". Moved to **8010**; `.env` and `LIBRECHAT-BUILD.md` updated with a warning. |
| 2026-10-04 | **`librechat.yaml` failed Zod validation.** `fileConfig.endpoints.custom` was an array (schema keys limits by endpoint **name**); `endpoints.azureOpenAI.disabled` is not a field and `azureOpenAISchema` requires `groups`. Both fixed properly rather than with `CONFIG_BYPASS_VALIDATION`. |
| 2026-10-04 | **Schedules engine would not arm** without Redis. `SCHEDULES_SINGLE_PROCESS=true` added — correct for single-replica client nodes. |
| 2026-10-04 | **Config schema version outdated.** `version: 1.1.7` → **`1.3.17`** (`Constants.CONFIG_VERSION`, `packages/data-provider/src/config.ts:4172`). |
| 2026-10-04 | **Nobody could sign in.** `ALLOW_SOCIAL_LOGIN` and `registration.enabled` were both off. Auth posture rewritten: `ALLOW_SOCIAL_REGISTRATION=false` as the authorisation gate, `ALLOW_EMAIL_LOGIN=true`, `ALLOW_UNVERIFIED_EMAIL_LOGIN=false`, `ALLOW_PASSWORD_RESET=false`, `ALLOW_SOCIAL_LOGIN=false` by default. |
| 2026-10-04 | **DPDP Rules 2025 English text** located at pages 24–41 of the Gazette PDF; previously mis-recorded as "Hindi only". Rules 1, 3, 6, 8, 9, 10, 11, 16 and Schedules extracted to `DPDP-CHILDREN.md` and `Satchida_Legal.md`. |