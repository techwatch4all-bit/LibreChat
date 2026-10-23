# Services & Commercial Model — Satchida AI Harness

What is sold, to whom, by whom, and what each party pays. This document supersedes the
business-model framing in `ROI.md` §1, which assumed a per-organisation licence.

Vocabulary used consistently throughout, per operator instruction:

- **Client** — the organisation: an RWA, SMB, school, or institution. Buys hardware, holds a
  fixed service contract.
- **Customer** — the individual: a resident, employee, or student. Subscribes directly to
  Satchida.

Related: `CLIENT-PROPOSAL.md` (client-facing), `PRICING.md` (customer plan ladder),
`PRIVACY.md` (data roles), `LEGAL.md` (entity and tax).

---

## 1. The model in one paragraph

**Two independent revenue lines. The Client pays a fixed annual service charge and receives
nothing further. The Customer subscribes to Satchida directly, at their own choice, and the Client
is never a party to that transaction.**

This mirrors how a society or school deploys CCTV: the organisation procures the capability as a
service for its community, on a fixed contract, and does not meter, resell, or earn from it.

**The Client is not a reseller and is not authorised to sell customer subscriptions.** Their
incentive is reputational and practical: a private, well-run AI service for their community that
they can point to, without building or maintaining anything.

---

## 2. Revenue line 1 — Client AMC (fixed)

### 2.1 What it covers

| Included | Not included |
|---|---|
| Licence to operate the platform on their hardware | Any promise about usage volume |
| Installation, model tuning, load testing | Per-user metering or overage |
| Remote monitoring and health reporting | Resale of customer subscriptions |
| Security and platform updates | Any revenue share |
| Telephone and remote support | Access to customer identity or conversation data |
| One scheduled on-site visit per year | |
| Compliance documentation and user guidance | |

### 2.2 Pricing

| Platform size | Monthly | **Annual** |
|---|---|---|
| ≤100 active users | ₹12,000 | **₹1,20,000** |
| ≤500 active users | ₹25,000 | **₹2,50,000** |
| ≤1,000 active users | ₹50,000 | **₹5,00,000** |
| Unlimited (education) | Quoted | Quoted |

**The charge does not vary with actual usage.** This is deliberate and should be stated in every
contract: a Client is never exposed to a surprise bill, and our revenue from them does not depend
on their adoption.

### 2.3 Annual preference

Annual is the preferred term — better cash flow for us, lower acquisition cost per Client, and a
stronger renewal rate. The discount is already reflected above (2 months' equivalent). Monthly
remains available for Clients who cannot commit, but should be priced to steer.

---

## 3. Revenue line 2 — Customer subscriptions (direct B2C)

Sold **by us, to the individual, billed by us, supported by us.** The Client is not involved.

### 3.1 Plan ladder

Defined in full in `PRICING.md`. Summary:

| | Demo | Standard | Pro | Family | Enterprise |
|---|---|---|---|---|---|
| Monthly | ₹0 | ₹499 | ₹1,499 | ₹2,499 | from ₹24,999 |
| Annual | — | ₹4,790 | ₹14,390 | ₹23,990 | from ₹2,39,990 |
| Privacy mode | — | — | — | **₹990 add-on** | included |
| BYOK | — | — | ✓ | ✓ | ✓ |

### 3.2 Who the Customer signs up with

Directly with Satchida, through:

- Google or other identity provider sign-in (we never hold the credential)
- UPI payment (manual approval at launch; gateway later — see `INFERENCE.md` §5)
- The authorisation service holds the resulting entitlement, not the conversation

### 3.3 Privacy mode as a paid add-on

**₹990/month, purchasable by any Customer on Pro or above.** It routes exclusively to local
inference on the Client's hardware, so the content does not leave the Client's premises.

This is our highest-margin product — cost is approximately zero — and the one that most directly
demonstrates the privacy architecture. It should be the most visible part of our marketing.

---

## 4. Roles, data, and who is accountable

This is the part that must be unambiguous in every contract.

| | Client | Customer | Satchida |
|---|---|---|---|
| Owns the hardware | ✅ | — | — |
| Owns the platform database | ✅ | — | — |
| Data custodian for conversations | ✅ | — | **Receives none** |
| Data custodian for billing | — | ✅ (self) | ✅ (minimal) |
| Authentication credential held by | — | Their provider | **No one** |
| Party to the subscription contract | ✗ **Not a party** | ✅ | ✅ |

### 4.1 What Satchida holds about a Customer

Minimised by design. This is the complete list:

- An identifier derived from their identity-provider subject (for entitlement matching)
- Plan, subscription status, and renewal dates
- Payment transaction record (statutory retention — see `LEGAL.md` §3)
- Operational logs required to run and secure the service

**No conversation content. No prompts. No uploaded documents. No links.** In the on-premise
architecture these exist only on the Client's hardware.

### 4.2 What the Client holds

Everything about their own users, including the identity mapping that links an account to a person.
We do not receive it.

### 4.3 The one unavoidable transit

In **Chat** and **Work** modes, requests may pass through infrastructure we operate in order to
route them to external AI capacity, and to hold the credentials that pay for it. This is disclosed
in `CLIENT-PROPOSAL.md` §4 and §9 and must be in the service agreement.

**Privacy mode avoids it entirely** — which is precisely what the Customer is buying when they pay
₹990 for it.

---

## 5. The authorisation architecture

How a Customer's subscription unlocks features on a Client's on-premise instance:

```
Customer subscribes (our site, Google sign-in, UPI)
        │
        ▼
Authorisation service (ours) — holds plan + status only
        │
        ▼ signed, short-lived entitlement token
        ▼
Satchida gateway / router (ours) — validates token, enforces plan
        │
        ▼
Local platform on the Client's hardware
```

**Licensing gate:** the platform on the Client's machine will not serve inference without a valid
token from the Authorisation service. That is the primary commercial control and it lives in our
code, not in the Client's. Full design in `ARCHITECTURE.md` §10.

**A Client cannot lock out their own residents by refusing us access** — the Customer's
subscription is between the Customer and Satchida. The Client's AMC and the Customer's plan are
independent. If a Client stops paying, the platform keeps working for customers on annual plans,
with Cloud/Work modes disabled. That is deliberate: **we do not hold the end user's service
hostage in a dispute with the organisation.**

---

## 6. What we deliberately do not do

| Not doing | Why |
|---|---|
| Let Clients resell subscriptions | Operator instruction. Also avoids a GST and contract chain we would have to support |
| Offer a revenue share to Clients | Would convert a goodwill purchase into a commercial negotiation and add per-user pressure we explicitly reject |
| Meter or bill Clients by usage | Breaks the CCTV analogy and makes them cost-conscious rather than proud of the service |
| Offer VPN as a service | Licensing and ISP-terms exposure for the Customer |
| Sell a hosted tier | Every deployment is on Client hardware. A hosted tier would put us in the DPDP Data Fiduciary seat we deliberately avoid |

---

## 7. Contract structure

Three documents, per Client:

1. **Service Agreement** — Client ↔ Satchida. Hardware, platform licence, AMC, SLA, updates,
   support, on-site visit. Explicitly states the Client is not authorised to resell.
2. **Data Processing Annex** — Client is data custodian; we act as processor for platform
   telemetry only; no conversation content; deletion commitments.
3. **Customer Terms** — Satchida ↔ Customer. Independent of the Client, survives a Client's
   departure, sets out retention and the sensitive-data guidance.

**Point 3 must survive independently.** If a Client leaves, their customers should not lose
service they paid us for. This is both correct and a genuine differentiator.

---

## 8. Reconciling the two plans documents

`PRICING.md` was written before the B2C-only model was settled. Reconciling:

| `PRICING.md` said | Status | Where it lives now |
|---|---|---|
| Per-user subscription ladder | **Retained** | §3 above — the Customer is the paying user |
| Demo tier, 1-day, very low quota | **Retained** | Unsubscribed users get Demo on the Client's instance |
| Annual 20% discount | **Retained** | Applied to both revenue lines |
| Privacy tier ₹990 | **Retained, reclassified** | Now a **Customer add-on**, not a Client tier |
| Privacy (Cloud) variant | **Dropped** | ZDR is approval-gapped; cannot be claimed at launch |
| Shared multi-tenant SaaS tier | **Dropped** | Every deployment is on Client hardware |

The **Family** plan needs a decision before launch: Family implies pooling across seats, and
seats may be in different households within one Client. Confirm whether Family is scoped per
Client or globally.

---

## 9. Open commercial questions

1. Is the ₹990 Privacy add-on available on Standard as well as Pro, or Pro-and-above only?
2. What happens to a Customer's subscription if their Client terminates the platform? (§7 says
   they keep it — needs a technical path to a fallback instance, or is it suspended?)
3. Does a Client get any benefit for *introducing* us? Non-financial recognition only, or a
   one-time referral credit against AMC?
4. Trial length for the demonstration in `CLIENT-PROPOSAL.md` §11 — 14 days, or 30?
5. Should the annual AMC be price-indexed annually, or held fixed for the contract term?