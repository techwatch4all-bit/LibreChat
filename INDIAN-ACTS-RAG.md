# Indian Acts RAG — Product & Safeguards

A pre-built, versioned research corpus over Indian legislation, built once and sold to many
clients. This document defines the product, its safeguards, and the commercial terms.

> **This is a research tool. It is not legal advice, and it must never be presented as legal
> advice.** Every safeguard below exists to keep that line unambiguous.

Related: `RAG-SERVICE.md`, `RAG-AND-OFFERINGS.md`, `LEGAL.md`, `Satchida_Legal.md`.

---

## 1. What it is

A namespace, built once and updated centrally, containing the text of Indian Bare Acts and
statutory rules. A client enables it and every account on their platform can query it.

**It is not a chatbot about law. It is a retrieval surface with citations**, because that is the
only version of this we can defend.

### Current source inventory

`D:\Indian ACT` holds **163 official Bare Act PDFs** plus a `CATALOG_OF_ACTS.md` inventory,
sourced from India Code / Legislative Department / Gazette. Already identified as directly
relevant:

| Act | Why it matters to our clients |
|---|---|
| **DPDP Act 2023** + Rules 2025 | Our own compliance, and every client's |
| **Bharatiya Nyaya Sanhita 2023** | Criminal exposure — offence definitions |
| **Bharatiya Nagarik Suraksha Sanhita 2023** | Court process; s.94 document production |
| **IT Act 2000** | s.43A leakage liability, s.67C intermediary duties, s.79 |
| **Right to Education Act 2009** | School customers |
| **POSH Act 2013** | School customers |
| **Child Labour Prohibition Act 1986** | School customers |
| **Societies Registration Act 1860** | RWA customers |
| **Payment and Settlement Systems Act 2007** | Our payment design |
| **Limitation Act 1963**, **Income-tax Bill 2025** | Retention periods |
| **Consumer Protection Act 2019** | Our customer contracts |
| **Companies Act 2013** | Entity structuring advice |
| **CGST / IGST Acts 2017** | Our GST registration position |

**Also available in the same folder but not yet reviewed:** Evidence Act successor, Arbitration
Act, Consumer Courts Act, SC/ST Atrocities Act, Foreign Exchange Management Act, and roughly 140
others.

### Currency marking — the most important feature

Every India Code consolidation carries a currency marker, and ours already show them:

- **BNS** — *"[As on the 6th October, 2025]"*
- **DPDP Act** — *"[As on the 19th November, 2025]"*

**Every answer must carry the date the provision was current as of.** Not the date we answered —
the date the law was current. A client asking about GST in March 2027 must be told whether the
text is the October 2025 consolidation or a newer one.

> **Never present a provision without its currency date.** This is the single safeguard that
> prevents the product from misleading anyone.

---

## 2. Known gaps — must close before sale

| Gap | Status | Action |
|---|---|---|
| **DPDP Rules 2025 in English** | ⚠️ Folder copy is **Hindi** | Obtain English text; two download attempts 404'd |
| **IT Act s.43A / s.70B** | ⚠️ Section text not extracted | Extract and verify |
| **BNS privacy section number** | ⚠️ Not located in arrangement | Confirm current numbering |
| Unilateral amendments between consolidations | ⚠️ Structural | Publish a "check before relying" notice |

**An incomplete corpus is worse than no corpus** for legal research, because a user cannot tell
what is missing. Mitigations:

1. Publish a **coverage manifest** — exactly which Acts are included and which are not
2. Every answer names the **Act, section, and currency date** it came from
3. A standing notice: *"This tool covers the Acts listed below. It is not a complete statement of
   Indian law. Verify before relying on anything."*

---

## 3. Safeguards

### 3.1 Mandatory in every answer

| Safeguard | Implementation |
|---|---|
| **Act + section citation** | Never a bare answer — always "BNS s.356 (as on 6 Oct 2025)" |
| **Currency date** | Rendered alongside the citation |
| **Verbatim text** | The actual provision, not a paraphrase. Paraphrase is where legal error enters |
| **Coverage notice** | Shown on first use in every session |
| **Not-legal-advice notice** | In-app, in the agreement, and in any export |

### 3.2 Explicitly prohibited behaviour

| Prohibited | Why |
|---|---|
| Answering "what should I do" | That is advice, and it is the exact failure mode |
| Predicting outcomes or liability | Liability assessment is legal advice |
| Omitting the currency date | A stale provision is a wrong provision |
| Citing a provision not in the corpus | Confidently invented citations are the worst outcome |
| Presenting model commentary as statutory text | Verbatim text and explanation must be visually distinct |

### 3.3 Presentation requirement

**Statutory text and model commentary must be visually separated and never blended.** A user must
be able to tell, instantly, what is the law and what is the machine. The same principle that
governs `PRIVACY.md` §6 — users must always know which part is the source and which is us.

### 3.4 Data handling

On-premise deployments keep queries on the client's hardware — consistent with
`SERVICES.md` §4. For any hosted deployment, **query logs must not be retained**, because a legal
query is often itself confidential (pending litigation, HR disputes, compliance exposure).

---

## 4. Commercial model

### 4.1 Pricing

| Offering | Price |
|---|---|
| **Add-on**, any paid tier | **₹199/account/month**, ₹1,790/account/year |
| **Per-client institutional licence** | **₹24,999/year** up to 500 accounts |
| **Enterprise** | Quoted, includes custom Act coverage |

### 4.2 Why this is the best-margin product in the catalogue

- **Built once.** No per-client customisation, no per-client deployment effort
- **No marginal inference cost** beyond ordinary retrieval
- **Independence.** Sells to any client without a hardware purchase, so it can reach SMBs who
  will never buy a ₹2 lakh server
- **Renewal is natural** — new rules and amendments are the reason to renew, and they arrive
  regularly

### 4.3 Who buys

| Segment | Use |
|---|---|
| **RWA secretaries and committees** | Society registration, bye-laws, compliance. Genuinely underserved |
| **School administrators** | RTE, POSH, child labour, affiliation |
| **SMB HR and administration** | POSH, labour, consumer protection, contracts |
| **Small CA and law practices** | Research over a fixed cost |
| **NGOs** | Compliance at low budget |

### 4.4 The update commitment

Version the corpus. Publish each release with its date and a changelog of added or amended Acts.
**A subscription implies we track amendments** — that is the product, and it must be honoured.

---

## 5. Launch conditions

Do not sell this until all of the following are true:

- [ ] Every included Act carries a currency date, verified against the source
- [ ] The coverage manifest is published
- [ ] The four known gaps in §2 are either closed or explicitly excluded from the manifest
- [ ] Citation rendering shows Act + section + currency date on every answer
- [ ] The not-legal-advice notice is in-app, in the agreement, and in every export
- [ ] Statutory text and model commentary are visually separated
- [ ] Query logs are disabled or short-retention in any hosted deployment
- [ ] A lawyer has reviewed the presentation and the notices
- [ ] At least one pilot client has used it for a real question and found it useful

**That last one is not a formality.** A legal research tool that has never been tested against a
real question is an untested liability, and the first real user will find what is missing.

---

## 6. Honest limitations to state in the agreement

1. The corpus is not a complete statement of Indian law
2. Provisions change; the currency date is the last consolidation we ingested, not a live feed
3. Absence of a provision in this tool does not mean it does not exist
4. Nothing here is legal advice or a substitute for a qualified lawyer
5. Unilateral amendments between consolidations may not yet be reflected
6. Statutory text is reproduced from official sources; if a discrepancy is found, the official
   text prevails