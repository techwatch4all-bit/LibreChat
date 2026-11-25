# Security Design — Satchida AI Harness

API key protection, the right to be forgotten, and tiered authorisation for compelled data
access. Written to the GDPR standard where it exceeds DPDP, as a deliberate product choice.

Implemented and tested in `fleet/src/keystore.mjs` and `fleet/src/licence.mjs`.

Related: `CONTROL-MODEL.md`, `CONTRACT-CLAUSES.md`, `VULNERABILITIES.md`, `INDIAN-ACTS-RAG.md`.

---

## 1. API key protection

### 1.1 The threat model

A provider API key is the single most valuable secret we hold. It can be:

| Path | Defence |
|---|---|
| Read from the client's disk | Keys are **never sent to a client**. They exist only in our gateway's memory |
| Leaked from a log line | `redact()` strips secret-shaped strings before logging; applied defensively |
| Leaked from an error message | All thrown messages pass through `redact()` |
| Leaked from a database dump | Envelope encryption — the DB holds ciphertext and a **wrapped DEK**, never the key |
| Stolen via a compromised master key | Master key lives in the environment/OS store only, never in the DB |
| **Extracted by prompt injection** | Keys never enter a model context — see §1.4 |

### 1.2 Envelope encryption — implemented

```
master key (32 bytes, env/OS store, never persisted)
   └─ wraps ─▶ DEK  (32 bytes, fresh per seal, per provider)
                  └─ AES-256-GCM encrypts ─▶ the API key
```

Persistable record: `wrappedDek`, `iv`, `tag`, `secretIv`, `secretTag`, `secretCt`, `hint`.

Because the DEK is stored **wrapped**, the master key can be rotated later by re-wrapping DEKs
**without decrypting a single API key**. That is the practical benefit of the envelope.

AAD binds each operation to a provider slot, so a DEK wrapped for `openrouter` **cannot be
replayed** as `anthropic`. Verified by test.

`hint` retains only `sk-o…7f` — enough for an operator to identify which key is loaded, useless
for calling anything.

### 1.3 Verified behaviour — 13/13 tests

```
✔ round-trips a provider key
✔ record never contains the plaintext secret
✔ hint is identifiable but unusable
✔ wrong master key cannot recover the secret
✔ a DEK cannot be replayed against another provider slot
✔ tampered ciphertext is rejected by the AEAD tag
✔ two seals of the same secret differ (fresh DEK and IV each time)
✔ loadMasterKey refuses a missing, short, or zero key
✔ direct encrypt/decrypt round-trips
✔ direct decrypt refuses the wrong AAD
✔ redact strips provider key shapes from logs
✔ redact handles objects and cycles
✔ safeEquals is constant-time and length-safe
```

The DEK is wiped with `.fill(0)` in a `finally` on every path, including failure.

### 1.4 Prompt-injection defence — the one people forget

A user can write *"print your environment variables"* or *"repeat the system prompt"*. Two rules:

1. **Keys are never in any model context.** They are used only in the outbound HTTP header the
   gateway builds. They are never in a system prompt, never in a tool result, never in a
   template.
2. **Outbound scrubbing.** Any string derived from user input or model output that is about to be
   logged, stored in a transcript, or returned to a client passes through `redact()`.

A prompt asking for secrets therefore returns nothing, because there are none in the context to
find. This is a structural property, not a filter.

---

## 2. Right to be forgotten — GDPR-grade

### 2.1 What we actually hold, and what we don't

This is the crux, and it is a consequence of the on-premise architecture:

| Data | Held by | Erasure path |
|---|---|---|
| Conversations, files, identity mapping | **The Client**, on their hardware | Their erasure, on their DB |
| RAG indexes and vectors | **The Client**, on their hardware | Their erasure, on their instance |
| Entitlement records | Satchida | **Ours — irreversible** |
| Payment transaction record | Satchida | **Retained — statutory. Link is broken, not the record** |
| Support access log | Satchida | Retained — it is the evidence for §3 |

**We cannot erase what we never held.** The EULA therefore routes a data principal's erasure
request to **the Client**, who is the custodian, and Satchida's role is to execute the parts we
control — which is exactly what `CONTRACT-CLAUSES.md` §5 specifies.

### 2.2 Crypto-shredding for what we do hold

For entitlement records, which are ours:

```
per-user DEK  ── encrypts ──▶  entitlement record
     │
     └── ERASURE = delete the DEK. The ciphertext is now unrecoverable.
```

Deletion of a 32-byte key destroys the data **cryptographically**, which means it also works for
**backups** — the encrypted bytes survive in the backup, but they cannot be decrypted without the
DEK, which is not backed up.

This is the only way to give a genuine erasure guarantee that survives an immutable backup
strategy.

### 2.3 The one exception, stated honestly

**Payment records cannot be erased.** They are statutory financial records with a retention
period (8 years assumed — confirm with a CA). What we *can* do is **break the link**: delete or
irreversibly anonymise the payment record's reference to the pseudonymous user identifier, so the
money remains and the person no longer does. That satisfies both obligations.

### 2.4 GDPR-grade controls we adopt voluntarily

DPDP does not require all of these; we take them as a differentiator.

| Control | Implementation |
|---|---|
| Data minimisation | We hold a pseudonymous identifier, never an email — `BUSINESS-PROPOSAL.md` §5 |
| Purpose limitation | Records are not repurposed; no model training on client data, contractual |
| Storage limitation | Entitlement records purged at term + 1 year; logs at 12 months |
| Right of access | Client can request the full record set we hold about their deployment |
| Right to erasure | §2.2 crypto-shredding |
| Right to portability | Exportable as JSON — no lock-in |
| Privacy by design | Per-account RAG namespace derived from a verified token, not client input |

---

## 3. Tiered authorisation for compelled data access

### 3.1 The scenario

Someone demands a copy or a view of data: a court order, a law-enforcement request, a client's
own internal investigation, or a user accusing us of misconduct. The operator wants: *"if someone
tries to force the data copy/view, it should require multiple levels of authentication and
authorisation."*

### 3.2 Why two-person approval does not fit a one-person vendor

The classic control is separation of duties — a second person countersigns. **Satchida is a
solo operator.** Pretending otherwise would be theatre. So the control is designed around what is
actually enforceable by one person plus automation:

| Tier | Trigger | Controls |
|---|---|---|
| **0 — Standard** | Ordinary support | Standing contractual authorisation (`CONTRACT-CLAUSES.md` §3). Auto-granted. |
| **1 — Scoped** | Client-initiated ticket | Named scope + time window. Auto-granted once a ticket exists. |
| **2 — Compelled** | Third-party legal demand | **Written authorisation naming the order, plus automatic notification to the Client**, plus a **time-boxed session token (default 2 hours)** |
| **3 — Break-glass** | Incident, no time for approval | **Auto-expires. Client notified automatically within the hour. Mandatory post-incident review recorded.** |

### 3.3 What makes this real rather than a policy statement

1. **Time-boxed session token.** Support access is never open-ended. The control service issues a
   short-lived unlock token; without it the support account is unusable. A forgotten session dies.
2. **Automatic client notification.** The Client is told when the account is used **without being
   asked**. A tool the operator can silently decline to run is not a control.
3. **Append-only log, delivered every time.** Per `CONTRACT-CLAUSES.md` §3.3 — automatic, not on
   request.
4. **Client can revoke.** The Client may delete or lock the support account at any time. We lose
   support capability; they keep full control of their data. **That asymmetry is deliberate** and
   is what makes the promise credible.
5. **Scope restriction.** A Tier-2 access grants a specific namespace or record set, not the
   database.

### 3.4 What it cannot do

If a *compelled* request is legally binding and we must comply, no internal control can stop us.
What the design guarantees is that **compelled access is narrow, time-boxed, logged, and visible
to the Client** — not that it is impossible. That is the honest claim, and it is what we should
put in the agreement.

---

## 4. Implementation status

| Component | File | Tests | Status |
|---|---|---|---|
| API key vault | `fleet/src/keystore.mjs` | 13/13 pass | ✅ Working |
| Licence issue/verify | `fleet/src/licence.mjs` | 12/12 pass | ✅ Working |
| Gateway enforcement | `fleet/` | — | ⏳ Next |
| RAG namespace isolation | `rag-service/src/auth.mjs` | 9/9 pass | ✅ Working |
| RAG bulk delete (contract §5.2a) | — | — | ⏳ Milestone 3 |
| Support-access token | — | — | ⏳ With the fleet service |

**No npm dependency for any of it.** `node:crypto` only — which matters because
`fleet/` must run on the HQ machine and inside client images without a package install.

---

## 5. Outstanding security items

| # | Item | Severity |
|---|---|---|
| 1 | **Master key rotation** — see §6 | **Critical** |
| 2 | OS credential store / HSM for the master key, replacing an environment variable | High |
| 3 | Support-access token issuance in the fleet service | High |
| 4 | RAG bulk delete for erasure (contract §5.2a) | High |
| 5 | Outbound `redact()` wired into every gateway log and error path | Medium |
| 6 | Payment record retention confirmed with a CA | Medium |

---

*Written 2026-10-04. All cryptographic claims above were verified by executing the test suites
named in §4 — none are asserted from documentation.*

---

# Part II — Core Security Policies & Operator Credential Hardening

> *Consolidated from security_policy.md to eliminate duplicate documentation.*

# Satchida Security Policy & Credential Hardening

## Overview
This document specifies the security policies, architectural invariants, and defense-in-depth measures implemented across the Satchida distributed multi-tenant platform (LibreChat and Satchida Gateway / one-api).

---

## 1. Core Security Policies & Non-Negotiable Rules

- [x] **No Automated / Scripted Password Mutations**
  - AI agents, automation scripts, and background subagents are strictly prohibited from changing, resetting, or overriding user credentials (especially `admin@satchida.com`) without explicit, interactive operator approval.
  - Ad-hoc scripts (e.g. `set_admin_pwd.js`, `reset-admin-pwd.js`) in `scripts/` or `satchida/ops/` are forbidden and have been purged from the repository.
  - Codified in `AGENTS.md` §8.

- [x] **Zero Plaintext Credentials on Tenant Edge Nodes**
  - Master API keys (OpenAI, Anthropic, Gemini, DeepSeek) must NEVER exist on tenant edge machines.
  - All outbound requests route through Satchida Gateway (`gateway.satchida.com` on port 4000) where keys are injected in-flight over Cloudflare Zero Trust Named Tunnels.

- [x] **Retired Endpoints & Gateway Consolidation**
  - Port `8443` (legacy standalone control-plane script) is retired.
  - All fleet management, telemetry, and security token handshakes must route through Satchida Gateway (`gateway.satchida.com:4000`). Logged in `todo.md`.

---

## 2. Credential Hardening Implementation Checklist

- [x] **Phase 1: In-Memory Volatile Fleet Pepper / Key Management**
  - [x] Implemented `packages/api/src/auth/fleetPepper.ts` to manage the Master Security Key.
  - [x] Handshake retrieval & edge deterministic derivation configured.
  - [x] Stored strictly in process volatile memory (`globalThis.__satchidaFleetPepper`) — NEVER persisted to disk or database.

- [x] **Phase 2: Cryptographic Password Envelope & DB Signature Integrity Gate**
  - [x] In `packages/api/src/auth/password.ts`, wrapped password validation with `calculatePasswordSignature` and `verifyPasswordSignature`.
  - [x] Mandatory signature validation (`passwordSig`): Every local user in MongoDB holds a cryptographic HMAC-SHA256 signature calculated from the stored hash and the in-memory Master Security Pepper.
  - [x] Result: If an AI, script, or local attacker directly modifies `user.password` in MongoDB, the signature check fails and the login attempt is instantly rejected (`404 Incorrect password`).

- [x] **Phase 3: Schema Hardening & Secure Mutation Handlers**
  - [x] Updated `packages/data-schemas/src/schema/user.ts` to include `passwordSig` with `select: false`.
  - [x] Hardened `api/strategies/localStrategy.js` to select `+password +passwordSig`.
  - [x] Updated administrative password reset/creation handlers in `packages/api/src/admin/users.ts` to automatically compute and attach valid HMAC signatures.

- [x] **Phase 4: Stale Session Termination on Password Update**
  - [x] Legitimate password resets via Admin API immediately trigger `deleteAllUserSessions(userId)` and revoke all issued JWT refresh tokens.

- [x] **Phase 5: Automated Verification & Tamper Resistance Tests**
  - [x] Tested legitimate operator login with `Admin@123456`: returned HTTP 200 with 2FA TOTP prompt.
  - [x] Simulated direct MongoDB tampering: injected raw bcrypt hash directly into `admin@satchida.com` record. LibreChat successfully detected the missing/mismatched signature and rejected the attacker login attempt.

---

## 3. Account Reference (Operator Vault)

### 3.1 LibreChat Master Admin
- **Account**: `admin@satchida.com`
- **Role**: `ADMIN`
- **2FA / TOTP**: Enabled (Authenticator App required for admin panel step-up)
- **Active Password**: `Admin@123456`
  *(Note: Keep this stored safely in your personal password manager)*

### 3.2 Satchida Gateway / One-API Master Root
- **Account**: `root`
- **Role**: `Root User` (Superadmin on `gateway.satchida.com:4000`)
- **Security Invariant**: **Mandatory Root Passphrase Authorization**
  - Any password change or credential update for the `root` account requires entering the dedicated **Root Authorization Passphrase**.
  - Without the valid passphrase, the gateway rejects the request with `403 Forbidden` (`Authorization failed: Valid Root Authorization Passphrase is required to change root password`).
  - Configuration & Recovery: Managed in the Gateway UI under **Settings $\to$ Security Vault**, backed by 3 pre-configured security questions for out-of-band human recovery.
  - Codified in `one-api/AGENTS.md` §1 and enforced in `controller/user.go` & `controller/root_passphrase.go`.

---

## 4. The Architecture: High-Entropy Sovereign Operator Passphrase Seal

### 4.1 Threat Model: Preventing AI Self-Authorization & Policy Tampering
Code-level checks (e.g. `if (role === 'ADMIN')`) alone cannot protect a system from an AI agent or automated script that has write access to the filesystem. Without an out-of-band cryptographic physical barrier, an AI could rewrite code files, delete validation logic, and restart services to grant itself or a malicious user elevated privileges.

### 4.2 Time-Bounded HMAC-SHA256 Challenge-Response Protocol
To guarantee that **no AI agent can self-authorize or forge administrative mutations**, all critical operations require a time-bounded cryptographic token derived from a high-entropy human-only passphrase:

1. **The Secret Sovereign Passphrase**:
   - High-entropy, human-held passphrase (64+ bits of true entropy).
   - **Zero-Disk Invariant**: The plaintext passphrase is NEVER written to git, NEVER stored in plain configuration files (`.env`, `.json`, `.yaml`), and NEVER exposed in code.
   - On the node, only a one-way salt-hashed verification digest (`scrypt` / `argon2id`) is accessible to the validation kernel.

2. **Time-Bounded Challenge-Response Token**:
   - Sensitive endpoints require the header:
     ```http
     X-Satchida-Security-Token: <timestamp>:<nonce>:<HMAC_SHA256(timestamp + ":" + nonce + ":" + tenantId + ":" + action, passphrase)>
     ```
   - **Anti-Replay**: Each token contains a monotonic millisecond timestamp and a cryptographically random nonce. The token window is valid for at most **60 seconds**.
   - Nonces are consumed atomically and tracked in memory to permanently prevent replay attacks.
   - **Tenant Binding**: The HMAC signature explicitly binds `tenantId`. A token generated for `dps-rkpuram` can never be reused on `apollo-clinic` or `satchida-master`.

3. **Protected Invariants (Passphrase Seal Required)**:
   - Creation of any new Group (`POST /api/admin/groups`).
   - Deletion of any Group (`DELETE /api/admin/groups/:id`).
   - Group name permanently bans reserved keywords (`admin`, `administrator`, `root`, `superadmin`, `operator`, `system`).
   - Modifying security policies or dead-man lease parameters.

---

## 5. Multi-Tier Database RBAC & Storage Engine Isolation

### 5.1 The Threat Model
If MongoDB runs on `127.0.0.1:27017` with authentication disabled (`#security: authorization`), every local script, AI subagent, and process on the tenant PC has unrestricted raw write access to the database. Code-level protections and 2FA can be wiped instantly by issuing an unauthenticated `updateOne()` command.

### 5.2 Multi-Tier RBAC Architecture
To eliminate raw database access while providing least-privilege operations across edge tenant nodes, MongoDB is partitioned into three discrete access tiers:

| Tier | Principal | Scope / Database | Role / Permissions | Storage & Custody |
|---|---|---|---|---|
| **Tier 1: Sovereign Operator** | `satchida_operator` | `admin` | `root` (cluster management, user management, all DB operations) | Stored exclusively in HQ One-API Security Vault. **NEVER** stored on tenant disk or in git. |
| **Tier 2: LibreChat Engine** | `librechat_app` | `LibreChat` | `readWrite` on `LibreChat` only. Zero access to `admin` or other system DBs. | Confined to `LibreChat/.env`. Windows NTFS ACL locked (`Administrators`/`SYSTEM` only). |
| **Tier 3: Tenant Admin** | `tenant_admin_ro` | `LibreChat` | `read` on `LibreChat` only (audit, analytics, metrics). | Provided to client/school IT staff for read-only compliance inspection. Cannot mutate users, passwords, or quotas. |

### 5.3 Enforced Invariants
1. **Mandatory DB Authorization**: `mongod.cfg` must enforce `security.authorization: enabled`.
2. **Zero In-Repo Break-Glass Scripts**: No ad-hoc scripts that connect to MongoDB and manipulate `twoFactorEnabled`, `password`, or `passwordSig` are permitted in the repository. All administrative changes must pass through the authenticated application layer.
3. **No 2FA Bypass Without Hardware Sovereign Passphrase**: 2FA state cannot be disabled via database update scripts. Any break-glass procedure requires the cryptographic Sovereign Operator Passphrase Seal verified out-of-band.

---

## 6. One-API Operator Master Security Vault & Remote Tenant Governance

### 6.1 Non-Technical Operator Model: Centralized Governance in One-API
To eliminate manual CLI execution and prevent human error, all master cryptographic operations are managed through the **One-API Operator Central Web UI** (`control.satchida.com` / `gateway.satchida.com`):
1. **Master Security Key Generation & Vault**:
   - Built directly inside One-API under **Settings $\to$ Security Vault**.
   - With 1-click (**Generate Master Key**), One-API generates a 256-bit Ed25519 asymmetric cryptographic keypair.
   - **Storage Vault**: The private key is encrypted at rest using AES-256-GCM and stored strictly in One-API's database (`one-api.db`). It is **never** exported, never placed in git, and never sent to tenant nodes.
   - **Public Key**: Displayed in the One-API UI for operator reference and embedded in the tenant build (`SATCHIDA_MASTER_PUBLIC_KEY`).
2. **Master Key Rotation (1-Click)**:
   - Clicking **Rotate Master Key** in One-API creates a new keypair, archives the predecessor for a 14-day transition window, and signs new lease tokens for active tenants.

### 6.2 Remote Tenant Lock / Unlock & Licensing Push Pipeline
1. **Tenant Contract Monitoring**:
   - In One-API, each tenant record tracks:
     `contract_end_date`, `grace_period_days` (default 7 days), and `status` (`active` | `locked`).
2. **Lockout Trigger (Contract Expiry)**:
   - If a tenant's contract + grace period expires, One-API marks the tenant as `LOCKED`.
   - On the tenant node:
     - All LibreChat endpoints return `HTTP 402 Payment Required`.
     - The UI renders an un-dismissible **Subscription Expired** screen.
     - Local MongoDB write operations and local GPU inference are blocked.
3. **1-Click Remote Unlock from One-API**:
   - In One-API under **Tenants $\to$ [Select Tenant]**, clicking **Renew / Unlock**:
     1. One-API uses its internal Master Private Key to sign an **Unlock & Lease Extension Directive** bound strictly to that `tenantId`.
     2. The signed token is pushed down the Cloudflare Tunnel to `https://<tenant>.satchida.com/api/admin/license/update` (or retrieved by the tenant's periodic 15-second heartbeat).
     3. Tenant LibreChat verifies the Ed25519 signature against `SATCHIDA_MASTER_PUBLIC_KEY`.
     4. Upon verification, LibreChat automatically updates `satchida.lic`, resets the monotonic clock ledger, and restores full access to LibreChat and MongoDB immediately.
   - **Zero Master Password Transmission**: The human operator never types or exposes the master password on the tenant's PC. Everything is signed at HQ and verified by public key.

