# Business Proposal — Satchida AI Harness

Two commercial models, priced, contracted, and compared on revenue, legal exposure, and data
position. **Offer both. Recommend one.**

Related: `SERVICES.md` (current model), `PRICING.md` (plan ladder), `ROI.md` (economics),
`LEGAL.md`, `CLIENT-PROPOSAL.md`.

---

## 1. The two options in one paragraph

**Model A — Direct (B2C).** The client pays a fixed AMC. End users subscribe **directly to
Satchida** at their own choice. Two contracts, two relationships. Higher margin, higher variance.

**Model B — Accounts (B2B).** The client pays a fixed AMC **which includes a bundle of named
accounts**. The client allocates them. One contract, one relationship. Lower margin, high
certainty, materially better data position.

Both keep the client's hardware, database, and conversation data. Neither requires the client to
operate anything.

---

## 2. Head-to-head

| | **Model A — Direct (B2C)** | **Model B — Accounts (B2B)** |
|---|---|---|
| Contracts | Client AMC + Customer subscription | One client contract only |
| Who the end user contracts with | Satchida | The client |
| Who sets the end-user price | We do | The client may add a premium |
| Our margin per user | Full | Wholesale |
| Revenue predictability | **Low** — depends on conversion | **High** — paid up front |
| ₹990 Privacy upsell | **We control it** | Client may bundle or ignore |
| Upgrade path | Direct from the user | Indirect via the client |
| Data held about end users | **Identity, plan, payment** | See §5 |
| Our DPDP role for end users | **Data Fiduciary** | Closer to processor |
| GST position | Registration likely mandatory | Registration likely mandatory |
| Contract admin burden | Higher — two agreements | Lower — one |
| Churn exposure | End users can leave any month | Accounts are use-it-or-lose-it within term |

---

## 3. GST — what actually forces registration

> ⚠️ The CGST Act is in `D:\Indian ACT` and I extracted it, but the threshold text did not
> parse. The figures below are from general knowledge of Indian GST law and **must be confirmed
> with a chartered accountant before invoicing.**

### The three triggers

| Trigger | Applies to us? |
|---|---|
| **Aggregate turnover threshold** — ₹40 lakh (₹20 lakh in special-category states/UTs) | Not at 2 clients × ₹3 lakh. **But** end-user subscriptions cross it fast |
| **Inter-state supply** — mandatory registration **regardless of turnover** | ⚠️ **Yes.** A single client or customer in another state forces it |
| **Issuing a tax invoice** | ⚠️ **Yes in practice.** Societies and SMBs need a proper GST invoice for their books |

### The practical answer

**Get registered now, under both models.** Reasons:

1. **Any client or end user outside your state forces registration regardless of revenue.**
   With end users subscribing nationally under Model A, this is a certainty, not a risk.
2. **You cannot invoice an RWA society properly without a GSTIN.** Societies maintain accounts
   and some have TDS obligations. An invoice without GSTIN creates friction and can disqualify
   you from procurement.
3. **Registration is cheap and slow.** Modest government fee, but roughly 2–4 weeks. You do not
   want to be invoicing your first client while waiting.
4. Services of this kind are normally taxed at **18%**. That is a real cost line the model must
   absorb or price in.

### Does B2C vs packages change the GST position?

**Not fundamentally — but it changes the volume and the chain.**

| | Model A (B2C) | Model B (B2B) |
|---|---|---|
| Taxable supplies | One to the client + one per end user | One to the client |
| Invoices issued | Many, small | Few, large |
| Inter-state exposure | **Certain** — end users are national | Only if a client is out of state |
| Output vs input credit | Credit only against our own business expenses | Same |
| Cost of compliance | Higher per rupee | Lower per rupee |

**Practical difference:** under Model B you issue one invoice to one counterparty. Under Model A
you run a small consumer billing operation — which brings invoicing discipline, refund handling,
and reconciliation into scope that a two-client business does not otherwise have.

**A caution:** if the client resells accounts onward to its own end users for a premium, **the
client needs its own registration**, and you may be supplying into a supply chain. Confirm the
exact treatment with a CA before standardising on it.

---

## 4. Contract structure

### Model A — two agreements

1. **Client Service Agreement** (client ↔ Satchida) — hardware platform, AMC, SLA, updates,
   support. Explicit: the client is **not** authorised to resell.
2. **Customer Terms** (Satchida ↔ end user) — plan, price, retention, privacy, sensitive-data
   guidance. Independent of the client.

**Termination clause** (the one you asked for):

> **Customer Subscriptions on Termination.** Subscriptions are between Satchida and individual End
> Users, not with the Client. On termination for any reason, Satchida shall (a) suspend End User
> Subscriptions at the end of the then-current paid term; (b) refund prepaid but unearned
> Subscription fees on a pro-rata basis within thirty (30) days; and (c) offer affected End Users
> migration to any alternative Satchida instance at the same tier for the remainder of their paid
> term. The Client has no right to suspend, cancel, transfer, or interfere with End User
> Subscriptions.

### Model B — one agreement

1. **Client Licence & Service Agreement** — AMC, included account allocation, overage, SLA,
   allocation procedure, account management.

**Termination clause:**

> **Account Allocation.** The AMC includes the stated number of named Accounts for the Term.
> Accounts are allocated by the Client at its sole discretion, are non-transferable except as
> permitted, and are **use-it-or-lose-it** during the Term. No value carries forward to a renewal
> unless expressly agreed in writing. On termination, unused Accounts cease immediately and no
> refund is due except for prepaid, unearned AMC.

Model B's clause is far simpler because **there is no third party whose contract we are breaking.**

---

## 5. Data position — and how to get out of the Data Fiduciary seat

You asked whether B2B solves the MongoDB/Data Fiduciary problem. **Partly. The bigger lever is a
design choice available under both models.**

### Three layers of data

| Layer | Held by | Who is custodian |
|---|---|---|
| Conversations, documents, prompts | **Client hardware** | Client |
| Identity mapping (account ↔ person) | **Client hardware** | Client |
| Entitlements, plans, allocations | Satchida | Satchida |
| Payment records | Satchida | Satchedia (statutory) |

### The design that minimises our exposure

> **The client provisions the accounts. It sends us a pseudonymous end-user identifier — never a
> name, never an email, never a phone number.**

Then we hold **no personal data about end users at all**. We hold:

- A random identifier
- Which plan/tier that identifier is on
- Aggregate usage counts

That data is not "personal data" under the DPDP Act — it cannot by itself identify anyone —
so the DPDP Act's obligations for that data largely fall away. This is exactly the anonymisation
argument in `LEGAL.md` §1, applied to the one layer we control.

**Do not collect end-user emails.** If the client wants users verified, the client verifies them,
on their hardware, with their Google Workspace or roll numbers.

### Does B2B help? Yes, secondarily

| | Model A | Model B |
|---|---|---|
| Relationship with end users | **Direct** — we are their Data Fiduciary | **None** — the client is |
| Accounts issued by | Satchida | The client |
| What we receive | Identity + payment | Pseudonymous ID + tier |
| DPDP exposure | Full | Minimal |

**B2B removes the relationship, which is what creates the obligation.** But the pseudonymous-provisioning
design is what actually eliminates the data. **Do both.**

**Consequence:** under either model, we are **not** a Data Fiduciary for conversation data, because
we never receive it. That is the position to defend.

---

## 6. Pricing

### Model A — AMC plus direct subscriptions

| Platform size | AMC monthly | **AMC annual** |
|---|---|---|
| ≤100 users | ₹12,000 | **₹1,20,000** |
| ≤500 users | ₹25,000 | **₹2,50,000** |
| ≤1,000 users | ₹50,000 | **₹5,00,000** |

Plus end-user subscriptions sold direct: Demo free · Standard ₹499 · Pro ₹1,499 · Family ₹2,499 ·
Privacy add-on ₹990.

### Model B — AMC including accounts

| Tier | Accounts included | Monthly | **Annual** |
|---|---|---|---|
| Starter | 25 | ₹12,000 | **₹1,20,000** |
| Standard | 100 | ₹25,000 | **₹2,50,000** |
| Professional | 250 | ₹50,000 | **₹5,00,000** |
| Enterprise | Unlimited | Quoted | Quoted |

Additional account packs: **50 / 100 / 200**, priced per pack per term.

Under Model B, **the ₹990 Privacy add-on becomes a capability the client may bundle into its
packages** rather than a line we sell. That is the real cost of choosing Model B — we give up the
highest-margin product.

### Recommendation: bundle, don't replace

Offer **both**, structured so the client chooses:

> **Base AMC** includes a small allocation and **all platform capability, including Privacy mode.**
> Additional accounts sold in packs. If the client would rather sell accounts directly, they may,
> and we accept no revenue share — that is the Model B variant of the same agreement.

This gives you the AMC floor either way, lets a technically-minded client self-serve, and preserves
the direct subscription line for clients who prefer it.

---

## 7. Revenue comparison at 6 clients

| | Model A | Model B (with packs) |
|---|---|---|
| AMC (6 clients) | ₹18.0 lakh | ₹18.0 lakh |
| Accounts sold | — | 6 × 100 avg × ₹300/account ≈ ₹10.8 lakh |
| Direct subscriptions | ~230 × ₹600 × 12 = ₹16.6 lakh | ₹0 |
| **Year 3 gross** | **₹34.6 lakh** | **₹28.8 lakh** |

**Model A earns more and Model B is far more certain.** At 230 customers under Model A you are
betting that a 30–45% conversion rate holds — `ROI.md` §7.1 flags this as the single largest
unverified assumption in the business.

**Year-1 reality check:** under Model A, two clients produce maybe ₹6 lakh and you learn nothing
about conversion until month nine. Under Model B you are paid up front for accounts you have
already sold.

---

## 8. Recommendation

**Offer both, lean Model B for survival, keep Model A for upside.**

Given that AMC is your bread and butter, end users can leave at any time, and conversion is
unmeasured:

- **Model B is the survival model.** Revenue on delivery, one contract, no conversion risk, and
  the best data position of any option.
- **Model A is the upside model.** Keep it available for clients — often smaller communities —
  where residents will subscribe directly and you can build the relationship.

The strategic risk to watch: Model B makes you dependent on the client to sell accounts, and they
may simply not try. Build the installer so onboarding a new account takes minutes, and **make the
client's own staff able to allocate accounts without calling you.** The whole value of Model B is
that it removes you from the loop.

---

## 9. What both models need, regardless

1. **GST registration** — start now (§3)
2. **LLP incorporation** — before the first invoice (`LEGAL.md` §6)
3. **Pseudonymous account provisioning** — the data lever in §5
4. **Written customer contract** — even one page, plus a data annex
5. **DPDP readiness** — core obligations commence **13 May 2027**

---

## 10. Open decisions for you

1. Which model is the **default** in the proposal, and which is the variant?
2. Is the client permitted to charge a premium over the account price? (Affects GST chain and our
   margin ceiling.)
3. Under Model B, do accounts convert between tiers mid-term, or only at renewal?
4. Is the ₹990 Privacy add-on sold separately under Model B, or bundled into the AMC?
5. Overage: what happens when a client exceeds its account allocation mid-term?

---

<!-- MERGED-DISTRIBUTED-PART -->
## Part II - Distributed Cloudflare-Tunnel edition (supersedes any VPN/Headscale/VPS wording above)

### Satchida Distributed AI Platform — Business & Operations Model

Managed, privacy-first AI infrastructure deployed on native Windows 11 edge hardware for schools, SMEs, and enterprise clients, traversed over symmetric Jio CGNAT via Cloudflare Zero Trust ($0/month infrastructure cost).

---

## 1. Value Proposition for Clients

1. **Absolute Data Sovereignty (On-Premises):**
   - All student conversations, employee questions, and company proprietary RAG documents stay inside the client's physical Windows 11 machine.
   - Fully compliant with India's Digital Personal Data Protection (DPDP) Act.
2. **Zero Inbound Router Configuration:**
   - Works natively behind standard commercial and residential broadband (Jio Fiber, Airtel Xstream, Jio 5G).
   - No static public IP required; no firewall ports opened; no network administrator intervention required.
3. **Frictionless Access for Users:**
   - Teachers, students, and employees do not need to install complex VPN software, Tailscale, or root certificates.
   - They navigate to `https://client.yourdomain.com` or tap "Add to Home Screen" on their mobile device.

---

## 2. Infrastructure Cost Structure

By replacing third-party cloud VPN/Headscale servers with Cloudflare Zero Trust Named Tunnels:
- **Cloud Hosting / VPS Cost:** **₹0 / month** ($0).
- **Domain Maintenance:** Existing Cloudflare-managed domain.
- **Inference Compute:**
  - Local Private Mode: Powered by the client machine's own GPU using llama.cpp.
  - Upstream Cloud Reasoning: Consumed on-demand and billed through token packages.

---

## 3. Remote Governance & License Monetization

1. **Hardware Independence:** Client purchases or supplies their own Windows 11 Pro desktop (e.g. Core i5/i7 + RTX 3060/4060).
2. **Seat & Quota Management:**
   - Clients buy a base subscription (e.g. 50 seats + 100M tokens).
   - Client administrators request quota increases from their local dashboard.
   - You review and authorize the change on your Seller Central HQ console; the change syncs to the client node within 30 seconds via outbound heartbeat.
3. **Master Credential Security:** Upstream provider API keys (OpenAI, Anthropic, Gemini, DeepSeek) are never exposed to the client, preventing credential theft or abuse.
---

## Addendum (2026-10-05) — Sovereign RAG and the Acts corpus

### What actually ships

A **fully offline, per-node retrieval service** (`rag-service/`). No third-party RAG
package is installed and none is required. It runs against the client's own Ollama with
`all-minilm:l6-v2` (23 MB, 384-dim), so:

- **No API key and no per-query cost.** This is what makes a low-priced RWA tier viable.
- **No document ever leaves the premises.** For schools and housing societies handling
  personal data under DPDP, this is the differentiator — a hosted-embedding RAG cannot be
  sold into that segment without a data-processing argument.

Verified this session: 165 official Bare Act PDFs available locally; two ingested and
retrieval-correct — a question about reporting a child offence returns **POCSO s.19**, an
access query returns **DPDP s.11 Right to access**.

### Product 1 — The Acts corpus, sold to RWAs

**What it is.** All 163 Bare Acts from the Government of India corpus, ingested once at HQ,
served to every tenant as a read-only shared reference.

**Why an RWA buys it.** A resident-facing management committee deals with the Model
Tenancy Act, the RWA Act, the Consumer Protection Act and the civil codes every single
day. Today that means a WhatsApp forward, or a paid lawyer for what is usually a
paragraph. The differentiator is not "AI knows law" — it is **the exact section, cited, from
the authoritative PDF, on the secretary's own laptop, with nothing sent to a third party.**

**Selling value.**
- No API cost per query, so a low monthly price still has a real margin.
- One ingest serves unlimited tenants; marginal cost is disk (≈100–150 MB for the full set).
- Defensibility: competitors must run their own corpus ingest to match it.

**Tenancy model (required for this to be sellable).** Every chunk row carries an owner.
Tenants read the shared Acts corpus but cannot delete or re-ingest it; the operator's admin
profile owns it. A tenant's own uploads are scoped strictly to that tenant. Without this
scoping an RWA's uploaded board minutes would leak across tenants, which would end the
product.

**Delivery.** Runs on the client's own Windows node — no Docker, no cloud, no per-seat
licence fee from a third party. Fits the existing RWA/SME distribution model.

### Honest limits to state in sales material

- **No text embedding model can read an image.** Anatomy diagrams, complex charts and
  candlestick history are invisible to retrieval today. Omni on `:8080` reads a diagram and
  emits a description, which is then embedded — that route is designed but not yet built.
- Retrieval quality on **paraphrased** questions is currently modest; every local model
  tested scored 1/4–2/4 on rewording. A hybrid keyword scorer is on the roadmap and is
  required before quoting accuracy figures to a customer.
- The DPDP Act 2023 **s.9** body text (children's data) is still unread from the corpus
  copy. Do not let sales quote it.

### Where this is tracked

`todo.md` §C4–C5, `Bugs.md` B12–B13, `HANDOVER.md` §16.2.
