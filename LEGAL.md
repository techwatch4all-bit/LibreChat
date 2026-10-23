# Legal & Regulatory Position — India

> **This is research, not legal advice.** It summarises published law and flagpoints for a
> qualified professional. Nothing here should be relied on without a CA and an Indian
> advocate reviewing the specific deployment. Where I could not verify a source, I say so.

Prepared 2026-10-03 for: individual operator, Satchida-branded LibreChat deployed to RWA
societies and SMBs on customer-owned hardware, accessed over HTTPS via Cloudflare Tunnel by browser/PWA, monetised by
subscription plus UPI.

Related: `PRIVACY.md` (claims), `INFERENCE.md` (routing), `SERVICES.md` (offer and pricing),
`ARCHITECTURE.md` §10 (key custody).

---

## 1. DPDP Act 2023 — what applies and when

**Verified.** Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023). Assented
11 August 2023. It is **in force in stages**:

| Commencement | Provisions |
|---|---|
| **13 Nov 2025** | Data Protection Board of India; ss.18–26, 35, 38–43, 44(1)&(3) — **already live** |
| **13 Nov 2026** | s.6(9), s.27(1)(d) — ~1 month away |
| **13 May 2027** | **Remaining provisions — the substantive processing obligations** |

Source: Wikipedia, DPDP Act 2023. **Confirm against MeitY before relying on these dates.**

**You have roughly seven months before the core obligations bite.** That is genuine runway and
it should be used to build compliance in, not to defer it.

### What applies to you

- **You are a Data Fiduciary.** The Act defines Data Fiduciary to include "persons, companies
  and government entities." An individual operator is captured.
- **Scope is extraterritorial** — it applies to offering goods or services to data principals
  in India regardless of where processing happens. Hosting on an RWA's server does not remove
  you from scope.
- **There is no "legitimate interest" or "contractual necessity" basis.** Verified: unlike the
  GDPR, the DPDP Act does **not** recognise contractual necessity or legitimate interests as a
  legal basis. Processing rests on **consent**, plus limited specified uses (voluntary provision,
  state function, positive legal obligation, emergencies). This is a meaningfully narrower
  toolkit than GDPR and it shapes what you can build.
- **Data principal rights** you must eventually honour: access, correction, **erasure**,
  grievance redressal.
- **Financial penalties** for breach.

### The exemption that matters most

**Section 16 provides a small-enterprise exemption.** Small enterprises are relieved of the
Data Protection Officer and Data Protection Impact Assessment obligations, subject to
notification to the Board. The threshold definition and current Rules treatment must be checked
— the Rules were still being finalised through 2025–26.

At 1,000 subscribers you may sit near the line. Design for the notification requirement.

### The provision that changes your architecture

**Anonymised data is not personal data.** The Act protects "digital personal data (that is, the
data by which a person may be identified)."

This is the single most valuable legal fact in this document:

| Data state | DPDP applies? |
|---|---|
| Plaintext conversation linked to an account | **Yes, in full** |
| **Pseudonymised** — tokenised, but a re-identification mapping is retained | **Yes — still personal data** |
| **Anonymised** — irreversible, re-identification not reasonably possible, then purged | **No** |

**Irreversible anonymisation plus purge removes the data from DPDP scope entirely.** Tokenisation
with a retained key does not — that is pseudonymisation, and it stays inside the Act.

This is a legal consequence of an engineering decision, so it must be specified carefully.
"Tokenise the user ID" is not enough. "Tokenise the user ID, discard the mapping after N days,
and anonymise conversation content" is.

---

## 2. The RWA deployment model may put you in a *better* position

If the RWA society owns the hardware, runs the database, and its own residents are the users,
then **the society is arguably the Data Fiduciary and you are the processor** — a vendor under
its instructions.

That materially narrows your obligations and is worth structuring deliberately:

- The society holds the identity mapping; you never do.
- The society decides what to collect and for how long.
- Your contract should say so explicitly — processor terms, not controller terms.

**This is the strongest structural answer to your anonymity question, and it needs no
engineering.** If the database is on their box and they hold the mapping, then *neither you nor
the model provider can identify a user*. That is genuine anonymity, and it is true by
architecture rather than by promise.

**Caution:** in a shared multi-tenant SaaS deployment (Community/Standard/Pro tiers), **you** are
the Data Fiduciary and none of this applies. Be explicit about which model each tier uses.

### Children's data

RWA societies are family communities. **DPDP has specific provisions for processing children's
personal data**, including a requirement of verifiable parental consent. If minors will use the
system — and in a society they likely will — this is a real obligation, not a theoretical one.
Verify the current threshold (the Act has used 18; confirm).

---

## 3. Retention: what Indian law requires

**Section 8 requires that personal data be erased once the purpose of processing is served, and
that it be retained only as long as necessary for that purpose.**

That aligns with what you want anyway. Purge is not a concession to customers — it is the
statutory default.

**The honest technical position:**

- LibreChat stores conversations in MongoDB. Multi-turn context requires it.
- **Purge is native and already used.** TTL indexes with `expireAfterSeconds` are present in
  `aclEntry`, `agentApiKey`, `key`, and `queuedTurn` schemas. Extending the pattern to
  conversations is a schema and index change, not a rewrite.
- **What data does genuinely have to be retained: the payment transaction.** This is a financial
  record. Retain it for the statutory period — commonly eight years under Indian commercial
  and tax record-keeping practice — but **confirm the exact requirement with your CA.**

**The wording that is both true and attractive** — much better than "we retain your
conversations":

> **"Your conversations are stored on hardware you own and operate. Satchida does not receive
> them."**

That is true in the RWA model and it is a *stronger* claim than a deletion promise. Only say it
in deployments where it is true.

Where the deployment is ours (multi-tenant tiers), the honest statement is retention-plus-purge:

> "Conversations are stored so you can continue them across sessions, and are permanently
> deleted after *N* days. You can delete any conversation at any time."

**Do not claim "we do not store your conversations" in any deployment where we do.** A single
demonstrable falsehood voids every other privacy claim you make.

---

## 4. CERT-In log retention — almost certainly not applicable, but check

**I could not retrieve the primary source** (the CERT-In page is script-rendered). From general
knowledge, the CERT-In Directions of 28 April 2022 impose **180-day log retention** for ISPs,
licensees, and entities under specific sections — the scope is telecom/intermediary and VAPT,
**not ordinary private application services**.

**Do not treat that as settled.** It is exactly the kind of scope question where being wrong is
expensive. Have your counsel confirm that an RWA-internal or SMB-internal AI service falls
outside it, and confirm whether Section 69A interception or IT Act intermediary obligations
attach if you operate a public-facing service.

---

## 5. GST — you almost certainly need registration

**I could not retrieve a primary source for current thresholds** (fetch returned no content).
From general knowledge, treat the following as indicative and confirm with a CA:

- Registration threshold: **₹40 lakh** aggregate turnover for goods/services, **₹20 lakh** in
  special-category states and union territories.
- **Inter-state supply requires registration regardless of turnover.**
- **Composition scheme is unavailable for services** (roughly), so a service provider does the
  regular scheme.

**Practical consequences for you:**

1. If any customer is in another state, **registration is compulsory** — you cannot wait until
   you hit a revenue threshold.
2. RWA societies and SMBs will want a **GST invoice**. Societies maintain accounts and may have
   TDS obligations; an invoice without GSTIN creates friction and, in some procurement contexts,
   disqualifies you.
3. Software sold on-premise plus a maintenance contract is a **classification question** —
   software licence, or a service? The treatment differs. Needs a CA.

**This is not optional housekeeping. It is a prerequisite for being paid properly by the
customers you want.**

---

## 6. Operating as an individual — the part that should concern you most

You described possibly operating with no registered company. That is the single largest
personal risk in this plan, and it is unrelated to the software.

### Unlimited personal liability

An individual bears **unlimited personal liability**. If an RWA society's deployment leaks
resident data, or the software causes loss, that liability lands on your personal assets — your
home, savings, other ventures. There is no entity boundary.

Combined with point 2 below, the exposure is larger than it looks.

### API key loss lands on you personally

You estimated "a month's worth of usage" as your maximum exposure. **That estimate only holds
if the keys are on infrastructure you control.** If keys sit in a config file on an RWA's server,
the RWA can read them, and the loss is unbounded and yours personally. See
`ARCHITECTURE.md` §10 — this is the single most important architectural constraint in the
project.

### The code is personal property

Today the Satchida fork, the autorouter, and the docs are **your personal intellectual
property**. That makes it hard to raise capital, take investment, bring in a co-founder, sell,
or hand to a successor. It also means a dispute with a co-founder has no corporate entity to
resolve it in.

### Recommendation: form an LLP, before the first paying customer

| | **LLP** | **OPC** |
|---|---|---|
| Liability | **Limited** | Limited |
| Minimum capital | **None** | ₹10 lakh authorised |
| Directors/partners | Partners | You as director |
| Cost | Low (~₹8–15k) | Higher — annual ROC filings, accounts |
| Fits | Solo software + services | Plans to raise capital |

**An LLP is the better fit** for a solo operator selling software and maintenance services:
limited liability, no minimum capital, simple annual compliance. An OPC is the right structure
later, if you need to raise money — but it carries filings you do not need yet.

Sequence it as: **incorporate the LLP → assign the Satchida IP to it → issue invoices from
it.** Then the software is not your personal asset, the liability is bounded, and the business
is transferable.

### Also worth arranging

- **IP assignment** — if anyone else contributes code, it must be assigned in writing.
- **Written customer contract** — even a one-page licence + maintenance + data-processing annex.
  Verbal arrangements with societies are how disputes happen.
- **Professional indemnity insurance** — cheap relative to the exposure.

---

## 7. Open legal questions for your counsel

1. Does the RWA model make the society the Data Fiduciary and us the processor? Draft to match.
2. DPDP small-enterprise threshold in the current Rules — do we qualify, and what is the
   notification requirement?
3. Children's data — applicable age threshold and parental-consent mechanism for societies.
4. GST classification of on-premise software plus a maintenance contract; registration threshold
   if any customer is out of state.
5. CERT-In / IT Act — confirm no 180-day log obligation attaches.
6. Payment-record retention period — confirm the exact statutory period.
7. Whether Section 69A or intermediary obligations attach to a publicly reachable service.

---

## 8. Compliance timeline

| When | What |
|---|---|
| **Now → first customer** | Form the LLP. Assign IP. Write the customer contract with a processor annex. Register GST if any customer is out of state. |
| **Before launch** | Privacy policy and in-app notice per `PRIVACY.md` §6. Retention policy with real purge. Breach-response runbook. |
| **By 13 Nov 2026** | s.6(9) and s.27(1)(d) commence — confirm what they require. |
| **Before 13 May 2027** | Core DPDP obligations: consent flow, data-principal request handling (access, correction, **erasure**, grievance), retention enforcement, security measures. Small-enterprise notification if applicable. |

The runway is real. Build it in deliberately.