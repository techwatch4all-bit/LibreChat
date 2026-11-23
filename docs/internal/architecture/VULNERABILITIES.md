# Vulnerability Register — Satchida AI Harness

Every dependency and configuration vulnerability found, with status. Distinct from `ISSUES.md`
(process and defects) and `Bugs.md` (product findings). **Append-only; a status change is an
update in place with a date, never a deletion.**

Severity: **Critical / High / Medium / Low**. Status: `Open` · `Mitigated` · `Closed`.

---

## 1. Dependency vulnerabilities — `npm install` at commit `f10b1d91`

**Baseline:** `42 vulnerabilities (6 low, 36 high)`, reported by npm after a clean install of
2,979 packages. Not yet individually triaged.

> **Do not run `npm audit fix --force`.** It applies breaking changes across the monorepo and can
> silently break the build. Triage and fix selectively.

| ID | Area | Severity | Status | Notes |
|---|---|---|---|---|
| **V1** | 36 high-severity transitive findings | High | **Open** | Untriaged. Must be triaged before any client deployment — this product goes to schools and SMEs over a tunnel. |

### Triage method (Phase 7)

1. `npm audit --json > audit.json` and group by package
2. For each: is it in `dependencies` (ships) or `devDependencies` (build-time only)? Build-time
   findings do not reach a client machine
3. Check whether a **non-breaking** fix exists (`npm audit fix --dry-run` first)
4. Where upstream is slow, record the package, the CVE, and the compensating control
5. Re-run the LibreChat test suites after any change

---

## 2. Configuration and architecture exposures

These are risks we accepted deliberately, not defects. Each has a documented control.

| ID | Exposure | Severity | Status | Control |
|---|---|---|---|---|
| **V2** | **`.env` is not a security boundary.** Every LibreChat setting — including `ALLOW_SOCIAL_REGISTRATION=false` — is a plain file on client hardware and can be edited. | High | **Mitigated** | Enforcement lives in **our** gateway: no valid Ed25519 licence token ⇒ cloud modes do not function. Licence, seat caps and spend caps are ours. **Never market local settings as enforcement.** |
| **V3** | **Cloudflare self-serve has no Data Processing Addendum.** A school, as Data Fiduciary, processes student data through a processor without a DPA. | Medium | **Accepted, disclosed** | `CLIENT-PROPOSAL.md` §9 discloses it and offers a client-owned tunnel at no charge. **Never promise a DPA we do not hold.** |
| **V4** | **Cloudflare proxies all content and terminates TLS.** It sees the end user's IP and the plaintext request. | Medium | **Accepted, disclosed** | Stated in `PRIVACY.md` §2.3a. The product claim is scoped to *no AI provider receives the prompt* — not *no byte transits a CDN*. |
| **V5** | **No email-domain allowlist in LibreChat.** Verified absent (`allowed_regex`, `allow_list`, `allowed_domain`, `email_domain`, `domainRestrict`, `allowedEmail` — zero matches). | Medium | **Mitigated** | `ALLOW_SOCIAL_REGISTRATION=false` means an unlisted Google ID has no account to sign into. Automate domain rules in the seat service (Phase 1). |
| **V6** | **Cloudflare Free-plan rate-limiting rule count unverified.** Bot Fight Mode confirmed free but **cannot be customised via WAF custom rules** (Cloudflare docs). Doc URL 404'd. | Low | **Open** | Confirm on the dashboard. Until then rely on **Turnstile** (wired in `librechat.yaml`) and `ALLOW_PASSWORD_RESET=false`. |
| **V7** | **MongoDB SSPL service clause.** If *we* operated MongoDB for clients, source disclosure could reach the deployment. | Medium | **Avoided by design** | Client operates their own database. Three independent reasons in `Satchida_Legal.md` §2.4: privacy, licensing, and BNSS s.104 court process. |
| **V8** | **API key exposure on client hardware.** Keys in a client `.env` are readable by the client. | Critical | **Avoided by design** | Keys held only by our gateway, with per-client spend caps, scheduled rotation, and revocation on offboarding. **The licence key does NOT protect the API keys** — the caps do. |
| **V9** | **Turnstile keys are placeholders.** `siteKey` / `secretKey` are `REPLACE_WITH_...` in `librechat.yaml`. | Medium | **Open** | Anti-automation is inert until real keys are supplied. Needed before public exposure. |
| **V10** | **First registered user auto-becomes ADMIN.** LibreChat promoted our bootstrap user automatically. On any fresh client deployment the first registrant is an administrator. | High | **Open** | Deployment runbook must create the admin, set `ALLOW_REGISTRATION=false`, and **verify no further user holds `role: ADMIN`**. Add to `DEPLOYMENT.md` §9 checklist. |

---

## 2b. Cryptographic and data-protection exposures

| ID | Exposure | Severity | Status | Control |
|---|---|---|---|---|
| **V21** | **Master key exposed in a diagnostic output and present as a plain environment variable.** An existing `SATCHIDA_MASTER_KEY` was echoed during a keystore test run and is visible in the shell environment. | **Critical** | **Open — rotate now** | Rotate the master key before any real secret is sealed. Move it to an OS credential store or HSM; an environment variable is readable by any process and appears in shell history. See `SECURITY-DESIGN.md` §5. |
| **V22** | **Prompt injection against the API key.** A user can ask a model to print its environment. | High | **Mitigated** | Keys are never in any model context — structural, not a filter. Outbound `redact()` strips secret-shaped strings. Verified by test (`SECURITY-DESIGN.md` §1.4). |
| **V23** | **Backup copies defeat naive erasure.** Deleting a database row leaves the data in backups. | Medium | **Mitigated** | Crypto-shredding: delete the per-user DEK and the ciphertext becomes unrecoverable even in an immutable backup. Not yet implemented for entitlement records. |
| **V24** | **Support access with no time bound.** An open support session would let access persist indefinitely. | High | **Open** | Time-boxed session tokens (default 2 hours), automatic client notification, append-only log delivered every engagement. Partially designed in `SECURITY-DESIGN.md` §3. |

---

## 3. Licensing exposures

| ID | Exposure | Severity | Status | Control |
|---|---|---|---|---|
| **V11** | **AGPL-3.0 admin-panel.** AGPL §13 triggers source disclosure on network use. | Critical | **Avoided** | Not deployed. LibreChat's own `packages/api/src/admin/*` serves the same APIs. |
| **V12** | **Aggregator resale restrictions.** OpenRouter's ToS bars reselling API access and building a competing service. | Medium | **Avoided** | Paid traffic routes on **direct provider keys** under standard commercial terms (Anthropic §A.1 permits powering products for your own end users). Aggregators confined to Demo, recovery and internal traffic. |
| **V13** | **Multi-account quota circumvention.** OpenRouter forbids creating multiple accounts to bypass limits. | High | **Avoided** | One key per provider. Our architecture never requires quota stacking. |
| **V14** | **Non-commercial model licences.** Several Indic-language models are `CC-BY-NC`, which forbids commercial use. | High | **Open** | A per-language licence checklist is required before any regional-language claim. BGE-M3 and multilingual-e5 are MIT and safe. |

---

## 4. Regulatory exposures

| ID | Exposure | Severity | Status | Control |
|---|---|---|---|---|
| **V15** | **DPDP core obligations commence 13 May 2027.** Consent flow, data-principal rights (access, correction, **erasure**, grievance), retention enforcement, security measures. | High | **Open** | ~7 months' runway. `DPDP-CHILDREN.md` holds the verified rule text. |
| **V16** | **Act s.17 small-enterprise exemption unverified.** Operative text not extractable from the folder's Act PDF. | Medium | **Open** | Obtain a complete Bare Act. Affects whether we must notify the Data Protection Board. |
| **V17** | **POCSO s.19 reporting duty.** *Any person* with knowledge or apprehension of an offence must report to the SJPU or local police. s.2(da) expressly covers **computer-generated images appearing to depict a child**. | High | **Mitigated** | **Image generation disabled for under-18 accounts** (`CHILDREN-SAFETY.md` §7). Reporting mechanism and named contact required before school rollout. |
| **V18** | **IT Act s.67C intermediary duties** may attach to user-generated imagery. | Medium | **Open** | Counsel opinion before offering image generation to any school. |
| **V19** | **Rule 8(3) one-year minimum retention** of personal data, traffic data and processing logs — corrects an earlier "purge fast" recommendation. | Medium | **Open** | Retention design must respect the floor. Third Schedule class for our size unverified. |
| **V20** | **Individual-operator unlimited personal liability.** No entity boundary on software defects, data breaches, or API key loss. | High | **Open** | Form an **LLP** before the first invoice (`LEGAL.md` §6). |

---

## 5. Status summary

| Status | Count | IDs |
|---|---|---|
| **Open** | 8 | V1, V6, V9, V10, V15, V16, V18, V19, V20 |
| **Mitigated** | 4 | V2, V5, V17 |
| **Accepted / disclosed** | 2 | V3, V4 |
| **Avoided by design** | 5 | V7, V8, V11, V12, V13 |

**Highest priority before any client deployment:** V1 (dependency triage), V9 (real Turnstile
keys), **V10 (auto-admin on fresh deploy)**, and V20 (entity incorporation).

*Last updated 2026-10-04.*