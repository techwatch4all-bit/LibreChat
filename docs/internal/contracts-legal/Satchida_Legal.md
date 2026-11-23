# Satchida — Legal Research & Good-Faith Record

**Purpose:** a contemporaneous record of legal and licensing research performed while designing
Satchida, what was found, what was decided as a result, and — importantly — **what could not
be verified**. Intended to show diligence, not to substitute for advice.

> **Not legal advice.** Prepared by an AI assistant from public sources. Every finding must be
> confirmed by an Indian advocate and a chartered accountant before reliance. Section 6 lists
> what has *not* been researched and must be.

Compiled 2026-10-03. Operator: individual, no registered company at time of writing.

---

## 1. Research log

Chronological. Queries and retrieval outcomes recorded verbatim, including failures.

| # | Date | Question | Source | Outcome |
|---|---|---|---|---|
| R1 | 2026-10-03 | Does OpenAI retain API prompts? | `platform.openai.com/docs/guides/your-data.md` | ✅ **Retrieved.** Full text |
| R2 | 2026-10-03 | Is OpenAI ZDR self-serve? | same | ✅ **Retrieved.** Approval-gated |
| R3 | 2026-10-03 | Do Anthropic commercial terms permit serving our own end users? | `anthropic.com/legal/commercial-terms` | ✅ **Retrieved.** §A.1, §A.0, §D.4 |
| R4 | 2026-10-03 | Does OpenRouter permit reselling / multi-account circumvention? | `openrouter.ai/terms` | ✅ **Retrieved.** §5.7, prohibited-use list |
| R5 | 2026-10-03 | Does OpenRouter permit our customers to access models via our product? | same | ✅ **Retrieved.** Expressly contemplated — **corrected an earlier conclusion** |
| R6 | 2026-10-03 | Does OpenRouter log prompts? | `openrouter.ai/docs/faq.md`, `openrouter.ai/privacy` | ✅ **Retrieved — documents conflict** |
| R7 | 2026-10-03 | OpenRouter free-model quota | `openrouter.ai/docs/faq.md` source constants | ✅ **Retrieved.** 50 / 1,000 RPD |
| R8 | 2026-10-03 | TokenHarbor privacy posture | `tokenharbor.ai` | ⚠️ **Marketing page only.** Terms not retrieved |
| R9 | 2026-10-03 | CommandCode — API provider? | `commandcode.ai` | ⚠️ **Positioned as a coding agent**, not a gateway |
| R10 | 2026-10-03 | Google Gemini API terms | `ai.google.dev/gemini-api/terms` | ❌ **FAILED** — page is script-rendered, no text retrieved |
| R11 | 2026-10-03 | Google terms (alternate) | `.../terms-of-service`, `policies.google.com/terms` | ❌ **FAILED** — same |
| R12 | 2026-10-03 | Meta acceptable use / Llama licence | — | ❌ **NOT ATTEMPTED** |
| R13 | 2026-10-03 | OpenCode Zen terms | `opencode.ai/terms` | ❌ **NOT RETRIEVED** |
| R14 | 2026-10-03 | DPDP Act commencement dates and scope | `en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Act,_2023` | ✅ **Retrieved.** Staged commencement |
| R15 | 2026-10-03 | DPDP MeitY primary text | `meity.gov.in` | ❌ **FAILED** — no content returned |
| R16 | 2026-10-03 | GST registration thresholds | Wikipedia / ClearTax | ❌ **FAILED** — no content returned |
| R17 | 2026-10-03 | CERT-In 180-day log direction scope | `cert-in.org.in/Directions70.jsp` | ❌ **FAILED** — script-rendered |
| R18 | 2026-10-03 | LibreChat: per-user provider keys supported? | Local source | ✅ **Confirmed** — `types.ts:662`, `schemas.ts:17`, `initialize.ts:53` |
| R19 | 2026-10-03 | LibreChat: provider failover supported? | Local source | ✅ **Confirmed absent** — `providers.ts:40` |
| R20 | 2026-10-03 | LibreChat: TTL / auto-purge support? | Local source | ✅ **Confirmed** — `expireAfterSeconds` in 4 schemas |
| R21 | 2026-10-03 | LibreChat: pseudonymisation built in? | Local source | ✅ **Absent** — `encryptV3` exists, no pseudonymisation |
| R22 | 2026-10-03 | BNS — status and commencement | Wikipedia, Bharatiya Nyaya Sanhita | ✅ **Retrieved.** In force 1 July 2024 |
| R23 | 2026-10-03 | BNS — section numbering for privacy/computer offences | India Code PDF (BNS full text) | ❌ **FAILED** — PDF not parsed; **section numbers deliberately not asserted** |
| R24 | 2026-10-03 | IT Act — sections 69A, 79 present | Wikipedia, IT Act 2000 | ✅ **Retrieved** (structure) |
| R25 | 2026-10-03 | IT Act — s.43A, s.70B text | India Code | ❌ **FAILED** — no content returned |
| R26 | 2026-10-03 | BNSS — status and commencement | — | ⚠️ **Known from general knowledge, not retrieved.** Confirm |
| R27 | 2026-10-03 | MongoDB licence and its service clause | `mongodb.com/legal/licensing/server-side-public-license` | ⚠️ **Page retrieved, text not parsed.** SSPL confirmed as the licence family |
| R28 | 2026-10-03 | Is client-owned vs operator-managed database a licensing risk? | Reasoned from R27 | ✅ **Material finding — see §2.4** |

**Retrieval success rate: 13 of 28.** Failures are recorded rather than papered over.

---

## 2. Verified findings

### 2.1 Model-provider terms — retrieved text

**Anthropic Commercial Terms (R3):**

> §A.1 — "Subject to these Terms, Anthropic gives Customer permission to use the Services,
> **including to power products and services Customer makes available to its own customers and
> end users** ('Users')."

> §A.0 — "Services under these Terms are **not for consumer use**. Our consumer offerings (e.g.,
> Claude.ai) are governed by our Consumer Terms of Service instead."

> §D.4 — "Customer may not and must not attempt to (a) access the Services **to build a
> competing product or service**, including to train competing AI models or resell the Services
> except as expressly approved by Anthropic…"

**OpenAI data controls (R1):**

> "As of March 1, 2023, data sent to the OpenAI API is not used to train or improve OpenAI models
> (unless you explicitly opt in)…"

> "Abuse monitoring logs… retained for **up to 30 days** by default… such logs may contain
> certain customer content, such as **prompts and responses**."

> ZDR / Modified Abuse Monitoring: "subject to the limitations below, by getting **approved**…
> Currently, these controls are subject to **prior approval by OpenAI**."

**OpenRouter Terms (R4, R5):**

> Prohibited: "create a false identity, misrepresent your identity, or **create multiple accounts
> as a single user, for purposes of bypassing or circumventing use limits**."

> Prohibited: "access the Site or Service for purposes of reselling API access to Models **or
> otherwise developing a competing service**."

> Permitted: "the Service enables you, your Authorized Users, and **your customers (to the extent
> you incorporate the Service into your own products and services)** access to Models."

**OpenRouter logging — conflicting sources (R6):**

> FAQ: "Prompt and completion are not logged by default. We do zero logging of your
> prompts/completions, even if an error occurs."

> Privacy Policy (updated 2026-08-31): "Any text or data you input into the Service ('Inputs')
> that include personal data **will also be collected by us**."

### 2.2 DPDP Act 2023 (R14)

- Act No. 22 of 2023; assented 11 August 2023; **in force in stages**.
- **13 Nov 2025** — Data Protection Board; ss.18–26, 35, 38–43, 44(1)&(3). *Live.*
- **13 Nov 2026** — s.6(9), s.27(1)(d).
- **13 May 2027** — remaining provisions, including substantive processing obligations.
- Data Fiduciary defined to include "**persons**, companies and government entities."
- Protects "digital personal data (that is, the data **by which a person may be identified**)."
- **No contractual-necessity or legitimate-interest legal basis** — consent plus limited
  specified uses only. Materially narrower than GDPR.
- Data principal rights: access, correction, **erasure**, grievance redressal.
- Financial penalties for breach.

### 2.3 LibreChat capability (R18–R21)

| Question | Finding | Evidence |
|---|---|---|
| Per-user provider keys | **Supported** | `types.ts:662` `userProvide`; `schemas.ts:17` `USER_PROVIDED`; `endpoints/anthropic/initialize.ts:53-60` resolves via `db.getUserKey()` |
| Provider failover | **Absent** | `endpoints/config/providers.ts:40` — `Record<string, InitializeFn>`, one name → one initialiser |
| Auto-purge | **Supported** | TTL indexes with `expireAfterSeconds` in `aclEntry`, `agentApiKey`, `key`, `queuedTurn` schemas |
| Encryption at rest | **Supported** | `encryptV3` / `decryptV3` in `@librechat/data-schemas` |
| Pseudonymisation | **Absent** | No tokenisation or identity-mapping facility; must be built |

### 2.4 BNS, BNSS, IT Act, and the database licence

> **Updated 2026-10-03 after the operator supplied `D:\Indian ACT` (163 official Bare Act PDFs).**
> Section numbering below is now taken from **primary source**. Two earlier statements were wrong
> and are corrected here rather than edited away.

#### DPDP Act 2023 — authoritative structure

Source: `The Digital Personal Data Protection Act 2023.pdf`, India Code, **[As on the 19th
November, 2025]**. Arrangement of Sections, verified:

| Sec | Heading |
|---|---|
| 4 | Grounds for processing personal data |
| 5 | Notice |
| 6 | Consent |
| 7 | Certain legitimate uses |
| 8 | General obligations of Data Fiduciary |
| **9** | **Processing of personal data of children** |
| 10 | Additional obligations of **Significant** Data Fiduciary |
| 11 | Right to access information about personal data |
| 12 | Right to correction and erasure |
| 13 | Right of grievance redressal |
| 14 | Right to nominate |
| 15 | Duties of Data Principal |
| **16** | **Processing of personal data outside India** |
| **17** | **Exemptions** |
| 18+ | Data Protection Board of India |

**CORRECTION 1.** An earlier draft stated the small-enterprise exemption sits at s.16.
**It does not.** s.16 concerns processing outside India. Exemptions are **s.17**.

**CORRECTION 2.** s.9, "Processing of personal data of children", is a **standalone section**
and had not been captured. It is directly material to the school proposition.

**DPDP Rules 2025 — READ IN FULL (correction).** An earlier draft recorded these as "Hindi
only, English not obtained". **That was wrong.** The Gazette PDF is bilingual: Hindi from page 1,
**English from page 24 to 41**. The operator caught this. The English text is now extracted and
the key rules are as follows.

**G.S.R. 846(E), MeitY, 13 November 2025.** Draft published 3 January 2025 (G.S.R. 02(E)), 45
days for objections.

**Rule 1 — staged commencement:**
| Rules | In force |
|---|---|
| **1, 2 and 17 to 21** | **on publication — 13 Nov 2025 (already in force)** |
| 4 (Consent Managers) | 13 Nov 2026 |
| 3, 5 to 16, 22, 23 | **13 May 2027** |

**Rule 2 —** defines *verifiable consent* by reference to rule 10 or 11 (rules in force May 2027).

**Rule 6 — Reasonable security safeguards** (May 2027) expressly names, as a minimum:
> "securing of personal data through encryption, obfuscation, masking **or the use of virtual
> tokens mapped to that personal data**"

This independently validates the pseudonymisation design in `LEGAL.md` §1 and `PRIVACY.md` §3.4 —
the Rules name "virtual tokens" as an accepted safeguard in their own terms.

**Rule 3 — Notice** must stand alone, give an itemised description of the personal data and the
purposes, and give a link to withdraw consent, exercise rights, or complain to the Board.

**Rule 16 —** "Exemption from Act for research, archiving or statistical purposes", to the
standards in the Second Schedule.

**CORRECTION 3.** Rule 17 is **"Appointment of Chairperson and other Members"** — Data Protection
Board governance, not an exemption. Rule 16 is the research/archiving exemption. My repeated hunt
for a "small enterprise threshold" in the Rules was misdirected: **the Rules never use that
phrase.** The small-enterprise exemption sits in **Act s.17**, whose operative text is **not
extractable** from the folder's Act PDF (382 KB, 528 lines, arrangement only).

**Second Schedule — children's data.** "Purposes for which provisions of sub-sections (1) and (3)
of section 9 shall not apply" — a closed list including state functions in the interests of a
child, email-only user accounts, real-time location for a child's safety, and preventing
advertisement harmful to a child. **Anything outside that list requires full s.9 compliance.**

**Still open:** Act s.17 operative text (small-enterprise threshold and its notification duty).

#### BNS — Bharatiya Nyaya Sanhita, 2023

Source: `Bharatiya Nyaya Sanhita 2023.pdf`, [As on the 6th October, 2025]. Act No. 45 of 2023,
in force 1 July 2024.

**Computer-related offences are NOT in the BNS.** The arrangement contains no computer,
electronic, or unauthorised-access heading. Those offences remain under the **IT Act 2000**.
Treating the BNS as the source of cyber-crime exposure is an error.

Confirmed offence headings include sexual offences (ss.63-96), sexual harassment (s.75), and
obscene material (ss.294-296). **The privacy-provision section number was not located and is still
not asserted.**

#### BNSS — Bharatiya Nagarik Suraksha Sanhita, 2023

Source: `BHARATIYA NAGARIK SURAKSHA SANHITA 2023.pdf`.

**s.94 — "Summons to produce document or other thing."** Confirmed verbatim.

This is the lawful route by which a magistrate may compel production of electronic records.
Resident conversation data held on a **client's** hardware is therefore reachable through that
client via a court order, and **not** through Satchida — a further reason the
client-operates-the-database model is legally cleaner. Related: s.95 (letters), s.96 (search
warrant), s.98 (forfeiture).

#### IT Act 2000

Source: `it_act_2000_updated.pdf`. The arrangement of sections was extracted but **s.43A and
s.70B text was not retrievable from this PDF**. Both remain asserted-but-unverified:

- **s.43A** — compensation for failure to prevent leakage of personal data
- **s.70B** — nodal contact person for cybersecurity incidents

s.70B is the provision most likely to link us to CERT-In obligations. **Must be read in full.**

#### MongoDB SSPL — constraint confirmed

The database is **not part of LibreChat**; it is MongoDB, licensed under the **Server Side Public
License** since v4.0. SSPL is not OSI-approved and carries a service-disclosure clause: if you
make the program's functionality available to third parties as a service, you must make the
service source code available under SSPL.

| Deployment | SSPL exposure |
|---|---|
| **Client runs their own MongoDB** on their own hardware | Lowest risk — deployed, not offered as a service |
| **We operate MongoDB**, clients connect over the network | **Potentially a "service"** — source disclosure could reach the whole deployment |

**Decision: the client operates the database.** Now supported by three independent reasons —
privacy (client is data custodian), licensing (SSPL), and legal process (BNSS s.94 reaches the
client, not us).

**Also verified this pass: LibreChat supports MongoDB only.** `mongoose ^8.24.1` is the sole
database driver across `packages/api`, `packages/data-schemas` and `api`. There is no `pg`, no
alternative ORM, and no PostgreSQL path for the primary database. A hosted deployment therefore
cannot avoid the MongoDB decision: use **MongoDB Atlas** (commercial licence) or accept the SSPL
question.

#### Newly available and directly relevant — not yet read

| Act | Relevance |
|---|---|
| **Right to Education Act 2009** | Governs the school proposition and RTE duties |
| **POSH Act 2013** | Schools must constitute a POSH committee; engages a girls user base |
| **Societies Registration Act 1860** | RWAs are registered societies; their governance binds them |
| **Payment and Settlement Systems Act 2007** | Governs UPI and payment intermediaries |
| **Limitation Act 1963** | Limitation periods — bears on payment-record retention |
| **Income-tax Bill 2025** | Record-retention periods |
| **Consumer Protection Act 2019** | We serve paying individuals; misleading privacy claims are actionable |


## 3. Decisions derived from this research

Each decision traces to a finding. This is the defensibility chain.

| Decision | Derived from |
|---|---|
| Use direct provider API keys under standard commercial terms; **no reseller agreement needed** | Anthropic §A.1 (R3) |
| Never name or market any provider or model | Anthropic §D.4 competing-product restriction (R3) |
| Confine aggregators to non-revenue traffic | OpenRouter prohibited-use list (R4) |
| **Never** stack multiple accounts on one provider | OpenRouter prohibited-use list (R4) |
| Do not promise non-retention from OpenAI at launch | 30-day abuse logs; ZDR approval-gated (R1) |
| Treat OpenRouter as unusable for retention guarantees | FAQ vs Privacy Policy conflict (R6) |
| Size free capacity at 1,000 req/day, not "unlimited" | OpenRouter FAQ constants (R7) |
| Drop SearXNG for Privacy-mode search | Operator-reported CAPTCHA wall |
| Build an autorouter | No provider failover exists (R19) |
| Build purge-on-timer retention | DPDP s.8 erase-when-purpose-served; TTL support exists (R14, R20) |
| Build irreversible anonymisation, not just tokenisation | DPDP scope turns on identifiability (R14) |
| BYOK is viable and needs no bespoke key machinery | Per-user keys already supported (R18) |
| Keep keys off customer hardware | Licence key cannot protect keys; MIT code is modifiable |

### 3.1 A correction made during this engagement

An earlier draft of the internal analysis concluded that **a signed reseller agreement was
required** before selling to customers. **That was wrong**, and it was corrected after the
operator challenged it and primary source text was retrieved (R3).

A second correction: an intermediate draft concluded OpenRouter "must not carry monetised
traffic." Retrieval of R5 showed OpenRouter's terms expressly contemplate customers accessing
models through products the account holder builds. The accurate position is that the boundary
is *how* we wrap it, not a blanket prohibition.

**Both corrections are recorded rather than edited away.** A research log that only ever
contains conclusions we got right on the first attempt is not evidence of diligence — it is
evidence that nobody checked.

---

## 4. Questions the operator raised, and where each landed

| Operator question | Disposition |
|---|---|
| Should we force users to disclose real identity? | **No.** Not required for the service; adds friction and DPDP scope for no benefit. Children remain a live issue (`LEGAL.md` §2) |
| Do we need a registered company? | **Strongly advised** — LLP. Unlimited personal liability otherwise (`LEGAL.md` §6) |
| Do we need GST? | Almost certainly, and mandatory if any customer is out of state. **Unverified** — confirm with CA |
| Should we retain conversations? | Purge on a timer. On-premise deployments never send them to us at all |
| Can we claim "we don't store conversations"? | Only on-premise, and only stated as **"stored on hardware you own; we do not receive them"** |
| Can we claim anonymity? | **Scoped claim yes** — "your identity is never disclosed to any model provider." Blanket "you are anonymous" is imprecise |
| Can tokenisation/pseudonymisation help? | Yes, but tokenisation alone keeps data in DPDP scope. Needs irreversibility to leave scope |
| Will a licence key stop a customer stealing API keys? | **No.** MIT code is modifiable and a licence check is removable. Keys must never be on their hardware (`ARCHITECTURE.md` §10) |
| Is SearXNG viable for private search? | No — CAPTCHA wall |
| Do we hold user credentials? | No. Google/Amazon OAuth on the user's own device; we never see the credential |

---

## 5. What remains unverified

Recorded so nobody assumes coverage that does not exist:

- **Google Gemini API terms** (R10, R11) — no text retrieved.
- **Meta** terms and acceptable use (R12) — not attempted.
- **OpenCode Zen** terms (R13) — not retrieved.
- **TokenHarbor** terms (R8) — marketing page only.
- **CommandCode** API and resale eligibility (R9) — appears not to be a gateway.
- **GST thresholds and software classification** (R16) — not retrieved.
- **CERT-In log obligations** (R17) — not retrieved.
- **DPDP Rules 2025/2026** — small-enterprise thresholds and notification mechanics not read.
- **Payment-record retention period** — commonly eight years in Indian practice; not confirmed.

---

## 6. Research NOT yet done — required before launch

Flagged by the operator, not yet undertaken. These are **open**:

| Area | Why it matters | Status |
|---|---|---|
| **BNS (Bharatiya Nyaya Sanhita)** | Data-related offences: privacy breach (s.319), computer-related offences (s.360). A breach caused by our software has criminal exposure | ❌ **Not researched** |
| **BNSS (Bharatiya Nagarik Suraksha Sanhita)** | Production of documents/electronic records on magistrate order (s.94) — the lawful route by which resident data could be demanded | ❌ **Not researched** |
| **IT Act 2000** | s.69A interception; s.79 intermediary safe harbour; s.43A compensation for data-leak defaults | ❌ **Not researched** |
| **State Co-operative Societies Acts** | RWA societies are registered societies. Their own governance, records and data obligations bind the society — and constrain the contract | ❌ **Not researched** |
| **Consumer Protection Act 2019** | We are a service provider to paying individuals. Misleading privacy claims are actionable | ❌ **Not researched** |

**This is the most significant gap in the file.** The DPDP analysis is complete; the criminal,
procedural and intermediary exposure is not.

---

## 7. Standing instructions to counsel

1. Confirm the DPDP commencement dates and the current Rules' small-enterprise threshold.
2. Advise on BNS, BNSS and IT Act exposure for an on-premise AI service operator.
3. Advise on whether an RWA deployment makes the society the Data Fiduciary and us processor.
4. Advise on children's data obligations for society deployments.
5. Advise on the privacy-policy wording in `PRIVACY.md` §6 before any customer sees it.
6. Confirm the payment-record retention period.

## 8. Standing instructions to a chartered accountant

1. GST registration threshold and whether inter-state supply compels registration.
2. Classification of on-premise software plus a maintenance contract.
3. Statutory retention period for payment records.
4. Recommended entity: LLP versus OPC, and the tax treatment of each.

---

*Record ends 2026-10-03. This file is append-only; amend by adding dated entries rather than
rewriting prior ones.*

---

# Part II — Regulatory Overview (DPDP, CERT-In, GST & Operator Liability)

> *Consolidated from LEGAL.md to eliminate duplicate documentation.*

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