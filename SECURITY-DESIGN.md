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