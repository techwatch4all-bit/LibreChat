---
name: dpdp-privacy-operations
description: Use when handling a DPDP Act 2023 request, a data-export or erasure demand, consent questions, or a privacy design decision — applies the children's rules, the school-as-Data-Fiduciary position, and the payment-records carve-out.
when-to-use: Trigger on DPDP, privacy, personal data, consent, right of access, erasure, data export, Data Fiduciary, breach, or a school asking what data Satchida holds.
allowed-tools:
  - fetch_webpage
user-invocable: true
always-apply: false
---

# DPDP Privacy Operations

The Digital Personal Data Protection Act 2023 and its 2025 Rules govern the platform.

## The structural position

Satchida's servers sit **at the client's premises, on the client's network and ISP connection**.
Satchida is therefore not the Data Fiduciary for the school's end users — **the school is.** This
determines who answers a data subject's request, who is legally obliged to act on it, and who must
be named in a breach notification. Getting this backwards puts the school in breach.

State this plainly when a school asks. It is also the better commercial position: the statutory
duty lands on the party that is physically the service operator.

## Children's data

- Children's data requires **verifiable parental consent** — a school must be able to demonstrate
  it, which means the school collects it, not Satchida.
- Do not collect a child's external email or date of birth. The parent owns the consent.
- **Known gap:** DPDP Act 2023 **s.9** (processing of personal data of children) is the single most
  consequential provision and its **body text has not been read** from the corpus copy at
  `D:\Indian ACT\The Digital Personal Data Protection Act 2023.pdf`, which carries the arrangement
  of sections. Do not state s.9's contents as settled law. Flag it as an open legal item.
- DPDP Act 2023 **s.11** is the right of access. A user may export their own data.

## Data export

Every user can export their own conversation metadata — timestamps, modes, token counts, message
counts. **Metadata by default, raw content only on explicit request.** This is a product
requirement, not a nice-to-have: s.11 must be satisfiable before a school or a minor is onboarded.

## Erasure — the payment carve-out

**Payment records cannot be erased.** Statutory retention requires them to outlive the account.
What Satchida does instead is **break the link** between a retained financial record and the
person: the record survives, the identity does not travel with it. When asked to delete a user
completely, explain the carve-out and offer link-breaking. Do not promise deletion and then fail it
at audit time.

## Breach response

1. Do not speculate about scope to the affected party.
2. Preserve logs — the audit trail is append-only with a tamper-evident `chainKey`/`seq`.
3. The **Client** owns notification to its users and to the Data Protection Board; Satchida supplies
   the log, the timeline and the technical evidence.

## Design rules

- **Minimise at collection.** An RWA secretary's roll number is not needed to run a chat.
- **Encryption at rest** for anything a client would call sensitive.
- Support access is **disclosed, logged, and revocable** by the client. Never a hidden backdoor.
- Key material never reaches a client machine and never appears in a log, a report, or a
  screenshot.