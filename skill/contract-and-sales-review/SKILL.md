---
name: contract-and-sales-review
description: Use when drafting, reviewing or negotiating Satchida client agreements, partner terms, pricing or commercial proposals — keeps liability, POCSO duty, payment terms and scope consistent with the existing contract set.
when-to-use: Trigger on contract, agreement, clause, NDA, SLA, liability, indemnity, pricing, proposal, quotation, commission, UPI, partner, PO, or renewal terms.
allowed-tools:
  - fetch_webpage
user-invocable: true
always-apply: false
---

# Contract and Sales Review

Satchida's contract set is already drafted. Read the existing instrument before writing a new
clause; extending a consistent set beats inventing a parallel one.

## The instruments

| File | Covers |
|---|---|
| `CONTRACT-CLAUSES.md` | Master client agreement, §3 operator duties, §5.2a erasure, §10 liability |
| `TERMS.md` | End-user terms; §3 prohibitions, §5 credits, family-pooling carve-out |
| `BILLING-PARTNER-AGREEMENT.md` | Payment partner; 2% commission, Mumbai jurisdiction |
| `PRIVACY.md` | Privacy notice |
| `CLIENT-PROPOSAL.md`, `BUSINESS-PROPOSAL.md` | Commercial offers |
| `PRICING.md`, `SERVICES.md`, `ROI.md` | Pricing, scope, business case |
| `SALES-OBJECTIONS.md` | Prepared responses |

## Load-bearing clauses — do not contradict these

**Liability (§10).** Aggregate liability is capped at zero. This is intentional and is the
operator's stated position. Do not soften it, and do not add an indemnity that reintroduces
uncapped exposure.

**POCSO duty.** The **Client** owns the statutory reporting duty under POCSO s.19, proactive
monitoring, human review, and appointment of its safeguarding lead. Satchida supplies software,
filtering, logging and evidence. This was amended deliberately because the server sits on the
client's premises. §3 must keep the duty on the operator of the service. `CHILDREN-SAFETY.md` §1.1
and `TERMS.md` §3 must agree with it — if one is edited, check the others.

**Licence enforcement.** Expiry is a hard boundary — `402 licence_expired` with no grace period.
A renewal clause that implies a grace window contradicts the enforcement code.

**Service credits.** Credits attach to a `familyId` and are shared within a family, but are
**non-transferable between families**. `guardTransfer()` blocks movement between accounts; that is
a different rule from members sharing one entitlement.

## Drafting rules

- **Scope what Satchida does not do.** No Docker on client Windows nodes, no paid VPN/VPS, no
  cloud keys at the client. These exclusions are architectural, so they belong in the contract.
- **Name a POCSO reporting contact** before any school goes live. It is a precondition, not a
  deliverable.
- Keep jurisdiction consistent with the existing instruments — Mumbai.
- Never commit to an SLA that depends on the operator's own edge node uptime without saying the
  client operates that node.

## Before signing anything

Check: does it contradict `TERMS.md`? Does it reintroduce uncapped liability? Does it place a
reporting duty on Satchida? Does it promise a grace period? Does it name a reporting contact?