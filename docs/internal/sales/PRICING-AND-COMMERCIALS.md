# Plans, Pricing & Capacity — Satchida AI Harness

INR pricing, tier entitlements, and the cost model behind them. Every figure below is a
**proposal with its arithmetic shown**, so you can change an input and see the effect.
Assumptions are listed in §1 and are the only things you need to correct.

Related: `ARCHITECTURE.md` (component design), `Implementation-plan.md` (sequencing),
`CONTEXT.md` (domain language), `Bugs.md` (known issues).

---

## 1. Assumptions

| Input | Value | Note |
|---|---|---|
| GPU | Single, 16 GB | Your stated hardware |
| Local model | Qwen3-VL-4B + mmproj | 4-bit quantised |
| Hardware cost | ₹2,50,000 | GPU + board, one-off |
| Amortisation | 3 years at 50% utilisation | 13,140 GPU-hours total |
| Power + cooling | ₹5 / GPU-hour | ~450 W draw, PUE ~1.3, ₹8/kWh |
| Local aggregate throughput | ~2.4M tokens / GPU-hour | ~650 tok/s under load at 4-bit |
| Context cap | 8K, compacted | Hard ceiling, per your requirement |
| Target | 1,000 subscribers | Concurrent peak well below this |

**Derived hardware cost:** ₹2,50,000 ÷ 13,140 = ₹19/hr, plus ₹5/hr power = **₹24/GPU-hour**.
Run 24×7, that's 720 × ₹24 = **₹17,280/month fixed**, regardless of subscriber count.

---

## 2. The honest cost picture

Three things worth stating plainly before the table, because they change how you sell it.

**Local inference is not cheaper per token than cheap cloud models.** At ₹24/GPU-hour and
2.4M tokens/hour, a local 1M tokens costs about **₹10**. GPT-4o-mini is roughly ₹1.4/1M input,
and Gemini Flash about ₹1.1/1M. Your local path is *ten times* the marginal cost of a cheap
cloud model per token.

It is still the right choice, for three reasons that have nothing to do with token price:

1. **The GPU is a fixed cost, cloud is variable.** ₹17,280/month divided across 1,000
   subscribers is **₹17/user/month fully utilised** — and ~₹58/user/month at 30%
   utilisation. Cloud never amortises; it scales linearly with the heaviest user.
2. **Privacy is the actual product.** Queries that never leave your hardware are the
   differentiator a ChatGPT-parity feature list cannot copy.
3. **No per-token billing exposure.** A metered provider can raise prices or throttle you;
   your own hardware cannot.

**The thing that will actually hurt is cloud fallback.** If free tiers run out and you pay
per query, that is the only unbounded cost in the model. It must be metered, and it is why
free-first-with-paid-overflow is the right policy.

**Do not advertise token counts.** Users compare conversations and answers, not tokens.
"8K context with compaction" is a feature statement; "2 million tokens" is a commodity
statement that invites comparison with cheaper API credits.

---

## 3. Commercial Tier Hierarchy & Feature Matrix

The Satchida AI platform features 7 standardized, harmonized commercial tiers synchronized across LibreChat, One-API (license_tiers), and Bifrost (satchida-master analytics & margin engine):

| Tier Code | Plan Name | Target Audience | Seats | Monthly Fee | Annual Fee (2 Mo Free) | Token Quota / mo | Active Modes | Key Capabilities & Developer Tools | Upstream COGS | Gross Margin |
|---|---|---|---|---|---|---|---|---|---|---|
| asic | **Basic (Free Trial)** | First-time evaluators | 1 seat | **₹0** | ₹0 | 500,000 | Chat | Web search, basic artifacts | ~.10 | N/A (Acquisition) |
| standard | **Standard** | Solopreneurs, writers, consultants | 1 seat | **₹299** | ₹2,990 | 2,000,000 | Chat, Work | Deep document analysis, file uploads, web search | ~.40 (₹39.60) | **86.8%** |
| amily | **Family** | Households (2 Adults + 2 Kids) | **4 seats** (pooled) | **₹999** | ₹9,990 | 6,000,000 (pooled) | Chat, Study, Work | POCSO-compliant safe browsing, homework assistant, shared household quota | ~.50 (₹148.50) | **85.1%** |
| pro | **Pro Developer** | Engineers, quantitative analysts, power users | 1 seat | **₹1,499** | ₹14,990 | 15,000,000 | Chat, Study, Work | Full VSCode Server Web IDE, MCP tool servers, sandboxed code execution, agents, BYOK | ~.50 (₹445.50) | **70.3%** |
| pro_family | **Pro Family** | Tech-forward households | **4 seats** (pooled) | **₹2,499** | ₹24,990 | 25,000,000 (pooled) | Chat, Study, Work | 4 pooled accounts with full Pro toolchain on adult seats + child-safe study mode | ~.50 (₹742.50) | **70.3%** |
| privacy | **Privacy (Sovereign Hybrid)** | Clinics, CA/Law firms, SMEs with local GPU | **1 seat** (licensed per seat) | **₹3,499 / seat** | ₹34,990 / seat | **15M Cloud / seat + Uncapped Local** | Chat, Study, Work, Privacy | Dual Engine: Uncapped local GPU in Privacy mode + Full Pro cloud developer suite for Chat/Work/Vibe coding | ~.50 (₹445.50) / seat | **87.3%** |
| enterprise | **Enterprise** | Schools, colleges, distributed enterprises | Custom (10–100+) | **from ₹15,000** | Custom SLA | Custom pooled | Chat, Study, Work, Privacy | Dedicated tenant gateway, custom fine-tuned local models, SAML/SSO, audit log compliance | Negotiated | **75%–85%** |

### Strategic Proposals & Sales Decks

The sales strategy is bifurcated into two distinct, executive-ready sales decks:

1. **Flagship Sales Proposal (SALES-PROPOSAL-FLAGSHIP.md)**:
   - Primary high-revenue focus: **Pro** (₹1,499/mo), **Pro Family** (₹2,499/mo), and **Privacy Sovereign Edge** (₹3,499/mo).
   - Targeted at tech professionals, high-income families, and regulated organizations requiring local GPU isolation.
2. **Negotiation & Downsell Sales Proposal (SALES-PROPOSAL-VALUE.md)**:
   - Value & volume focus: **Standard** (₹299/mo), **Family** (₹999/mo for 4 seats = ₹250/seat), and **Pro** (₹1,499/mo).
   - Deployed during hard procurement negotiations to close deals without discounting the flagship price points.

## 4. Credits — what they actually mean

`balanceSchema` in LibreChat stores `tokenCredits`, documented as *1000 tokenCredits = 1
mill USD*. That is a **cost-denominated** unit, which is exactly right for us, and it handles
the local/cloud differential for free.

**Redefinition for Satchida:** `1 credit = ₹0.01 of blended cost to Satchida.` Never surfaced
to users as currency — the UI shows an abstract "usage" figure, not rupees.

| Path | Blended cost | Credit rate |
|---|---|---|
| Local vLLM | ~₹10 / 1M tokens | ~1,000 credits / 1M |
| Free-tier cloud | ₹0 | ~0 credits (still rate-limited) |
| Paid cloud overflow | ~₹5 / 1M tokens | ~500 credits / 1M |

Two properties fall out of this that you would otherwise have to build:

- A user who consumes mostly local inference costs you far fewer credits than one whose
  queries keep overflowing to paid cloud. **Heavy cloud users self-limit automatically** —
  no abuse heuristics required.
- Because the router knows the true cost of every request, credits can be charged by
  *measured* cost rather than estimated by token count. Stricter than any static rate card.

### Demo account

Per your requirement: registered + authenticated, no payment, **very low, 24 hours**.

- ~50K local tokens total, ~500 credits
- `refillIntervalValue: 1`, `refillIntervalUnit: days`
- Expires to a hard stop at 24h rather than refilling — a rolling refill invites a
  permanently-free tier to exist

Better than a rolling demo: a genuine 24-hour trial. Converts better, and cannot be farmed.

### BYOK — revised per your correction

You are selling a **bundle**: trusted vendor, hardware, maintenance, electricity, updates,
support. So:

**Subscription price = base fee (bundle) + usage component (variable cost).**

- BYOK users **still pay the base fee.** They buy the same bundle; BYOK changes who pays the
  token bill, not what the service is worth.
- BYOK **increases** the included allowance, because their queries cost us less and consume
  less of the shared scarce resource.
- The cap that genuinely matters is **local-GPU time, not tokens** — a BYOK user still
  occupies our GPU whenever routed locally, and always occupies our queue.

So BYOK is an entitlement granting (a) the BYOK path and (b) an enlarged local-GPU fair-use
allowance. Pro: 1.5× standard allowance per rupee. Family: pooled.

---

## 5. Queue and capacity management

Your real constraint is the 16 GB card, not users.

**Estimated capacity: 6–12 concurrent 8K-context streams** on Qwen3-VL-4B at 4-bit, including
mmproj vision overhead. Realistically ~8 sustained.

That supports ~1,000 subscribers at a **2–4% concurrent peak** — which is normal for a chat
product (evening skew, sessions of minutes). It does **not** support 1,000 simultaneous
users. Plan for the peak, not the total.

Behaviour when saturated — the router's decision order:

1. **Queue** (default). Wait up to N seconds. Show the user "Satchida is thinking" rather than
   an error. This is the behaviour you want most of the time.
2. **Route to cloud** if the queue exceeds its wait budget. User is not told, per your
   requirement.
3. **Reject** only if both fail. Must be rare enough that users never see it.

Priority: Enterprise > Privacy (Local) > paid > Demo, so a demo user cannot be starved by
paid load. Privacy (Local) ranks high because its users pay for exactly this scarce capacity.

### The free-tier budget, sized honestly

Verified from OpenRouter's own FAQ constants: free models allow **50 requests/day** with no
credits, or **1,000 requests/day** with **≥ $10** in the account.

At 1,000 subscribers that is roughly **one free request per user per day**, shared across all
modes *and* all mid-turn recovery traffic. It is an opportunistic COGS saving on the margin,
never capacity.

Budget it explicitly rather than leaving it to chance: reserve roughly **70% general traffic /
30% recovery** in the selector. Without a reservation, a bad afternoon of upstream failures
consumes the pool and the Demo tier starves.

**Hard requirement:** when every cloud path is unavailable, the router must degrade to *longer
queue*, never to failure. Build that test first.

See `INFERENCE.md` for the full routing design, the provider licensing gate, and mid-turn
recovery.

---

## 6. Model identity

Per your decision, the identity line is:

> **I am Satchida, an AI assistant built by Satchida.**

Not "finetuned" — no fine-tune exists today, and that would be an untrue claim to paying
customers. The wording is a config value, so a real fine-tune later can change it.

### What hiding the model does and does not achieve

| Surface | Hidden? | How |
|---|---|---|
| Model picker in UI | Yes | Remove the endpoint from user-visible config |
| Model name in messages | Yes | System prompt |
| `GET /api/*` responses | Yes | Redact at the router/API boundary |
| Error text | Yes | Map provider errors to user-safe codes |
| Network payloads | **No** | A determined user reading devtools sees it |
| Server logs / DB | Yes to user | Internal only |

Absolute non-disclosure is not achievable and should not be promised. The achievable goal —
**no user ever casually encounters the model name** — is fully within reach and is what
keeps the product coherent. Admin retains full visibility for management, which is what you
asked for.

---

## 7. What to change first

Re-run this arithmetic with your real figures before committing:

- [ ] Confirm GPU + board actual cost → changes amortisation, the largest single input
- [ ] Benchmark real throughput on the 16 GB card → the 2.4M tok/hr figure is an estimate, and
      it moves both COGS and capacity
- [ ] Confirm whether mmproj (vision) stays enabled on all tiers — it costs memory that
      directly reduces concurrency
- [ ] Confirm the free-tier providers you intend to use and their actual limits
- [ ] Decide whether Pro annual is 2 months free (recommended) or matches the 20% standard

---

# Part II — ROI & Financial Model

> *Consolidated from ROI.md.*

# ROI & Financial Impact — Satchida AI Harness

Honest look at whether this pays. Built for the model actually chosen: **B2C. Clients pay a fixed
AMC; customers subscribe directly to us.**

> Every figure is an estimate with its assumptions shown. This is a structure for deciding what to
> test, not a forecast.

Related: `SERVICES.md` (the model), `CLIENT-PROPOSAL.md` (client-facing pricing),
`PRICING.md` (customer ladder), `DEPLOYMENT.md` (install target), `LEGAL.md` (compliance cost).

---

## 1. Vocabulary

- **Client** — the organisation (RWA, SMB, school). Pays fixed AMC. Never a reseller.
- **Customer** — the individual (resident, employee, student). Subscribes directly to us.

This is the CCTV model: the organisation procures the capability as a service for its community;
we sell to the individuals who use it.

---

## 2. Two revenue lines

| | Client AMC | Customer subscriptions |
|---|---|---|
| Payer | Organisation | Individual |
| Basis | **Fixed**, by platform size | Plan chosen by the customer |
| Depends on usage? | **No** | Yes |
| Avg value | ₹25,000/month (₹3 lakh/yr) | ₹600/month blended |
| Who we invoice | The client's committee | The customer |
| Churn driver | Committee turnover, annual budget | Customer's own choice |

**Why this pairing is sound:** the AMC is a *floor* that does not depend on adoption, and the
subscription line is the *upside* where we hold the margin and the customer relationship. If
adoption is poor we still recover the Client AMC. If adoption is strong the subscription line
compounds without any further sales effort.

**The asymmetry that matters:** we get the customer relationship *through* the Client's user base
without the Client having to sell anything. The Client's incentive is goodwill and differentiation;
ours is a captive, reachable audience at zero acquisition cost.

---

## 3. Realistic volume assumptions

Per operator direction, **do not assume 60 clients. Assume 2 per year.** RWA and SMB sales in
India run 3–6 month committee cycles, and one Client each year is a realistic outcome.

| Year | Cumulative Clients | Active Customers | Target |
|---|---|---|---|
| 1 | 2 | 20–40 | Prove the model; get the first renewals |
| 2 | 4 | 80–140 | Prove the install automation |
| 3 | 6 | 180–280 | Repeatable, no longer pilot-shaped |
| 5 | 10 | 400–700 | Steady state |

Adoption assumption: **30–45% of a platform's active users convert to a paid plan** in year one,
then stabilising. A society of 200 flats has 60–120 realistically active users; 15–40 subscribing
is credible when the service is presented as a society amenity.

⚠️ **This adoption figure is the least verified number in this document.** It should be measured
in pilot 1 and everything re-run against reality.

---

## 4. Revenue build

### 4.1 Year 1 — two clients, adoption ramping

| Line | Calculation | Year 1 |
|---|---|---|
| Client AMC | 2 clients, ramped from month ~4 | **₹4.5 lakh** |
| Customer subscriptions | avg 12 customers/client/month × ₹600 | **₹1.7 lakh** |
| **Gross revenue** | | **₹6.2 lakh** |

Against setup costs of ₹1.2–2.7 lakh (`LEGAL.md` §6) this is a fast payback on paper — but year 1
is spent selling and installing, not earning.

### 4.2 Year 3 — six clients, adoption proven

| Line | Calculation | Year 3 |
|---|---|---|
| Client AMC | 6 × ₹3 lakh | **₹18.0 lakh** |
| Customer subscriptions | 230 avg × ₹600 × 12 | **₹16.6 lakh** |
| **Gross revenue** | | **₹34.6 lakh** |

### 4.3 Costs at year 3

| Item | Cost/year |
|---|---|
| Cloud fallback (our gateway) — 230 × ₹150/mo | ₹4.1 lakh |
| Professional indemnity insurance | ₹0.4 lakh |
| Chartered accountant | ₹0.5 lakh |
| Legal retainer | ₹1.0 lakh |
| **Total cash cost** | **₹6.0 lakh** |
| **Gross margin** | **83%** |

---

## 5. Where the margin actually is

**Inference is free.** Local inference runs on the Client's hardware — our cost is ₹0. Cloud
fallback is the only variable cost, and it is bounded by the model mix:

| Work-mode mix | COGS/customer/month |
|---|---|
| Local + free routes | ₹0–20 |
| Mid-tier paid | ~₹150 |
| Frontier paid | ~₹1,500 |

**Defaulting Work mode to mid-tier models is worth more than any price rise available to us.** At
frontier defaults, 230 customers would cost ₹41 lakh/year — more than the entire revenue line.
This is the single highest-leverage product decision in the business, and it is a configuration
choice, not a feature.

**We are not in the business of reselling tokens.** That is the most commoditised, lowest-margin
part of this entire market, and this architecture deliberately stays out of it.

---

## 6. The real constraint: our time

The margin concern is largely unfounded. **The constraint is hours.**

| Activity | Per client | Annual (6 clients) |
|---|---|---|
| Install (current process) | 5–7 days | 35 days |
| Support (steady state) | 2 h/month | 144 h/year |
| Updates / onsite visit | 8 h/year | 48 h/year |
| Sales cycle (amortised) | 60–80 h | 400–500 h/year |

At year 3 that is roughly **600–700 hours/year** — more than a full-time job, with no slack.

### The number worth optimising

| | Target | Effect |
|---|---|---|
| **Install time** | 5–7 days → **≤ 90 min** | Removes ~200 h/year at 6 clients |
| **Support time** | 2 h/mo → **≤ 30 min/mo** | Removes ~90 h/year |

Every hour spent building the installer instead of serving a client is an hour that converts a
consulting income of ~₹20 lakh into a software income of ~₹35 lakh. **This is the only metric that
matters in year one.** See `DEPLOYMENT.md` §9.

---

## 7. Risks that would change the answer

### 7.1 Adoption risk — the biggest unknown

If a Client's residents do not convert, the AMC still pays but the subscription line never
materialises, and the business is ₹18 lakh by year 3 instead of ₹35 lakh. **Still viable — but
the growth story is gone.**

*Mitigation:* the demonstration in `CLIENT-PROPOSAL.md` §11 is not just a sales tool. It is the
adoption experiment. Measure conversion in the pilot before committing to the automation build.

### 7.2 Competitive risk — LibreChat is MIT

A Client's IT volunteer can install the upstream project for free. There is no licence fee to
collect and no technical barrier.

| Our defence | Their gap |
|---|---|
| Maintained, patched builds | Upstream only, no support |
| Written privacy commitments | **None — no promises, nobody accountable** |
| Tuned and load-tested | Unknown default |
| A named accountable party | A volunteer with other jobs |

**This is defensible only for Clients with no IT capacity.** Sell to committees, not to technicians.
And price it as a *service* — a Client who sees it as a licence will install the free version.

### 7.3 Concentration risk — real and unhedged

At 2 Clients per year, **each Client is 30–50% of revenue.** Losing one is a crisis. B2B sales
cycles of 3–6 months mean a single lost deal removes six months of income.

*Honest assessment:* this is the structural weakness of the model, and it does not resolve quickly.
It improves as Clients accumulate — by year 3 the largest is ~17% of revenue — but years 1 and 2
are genuinely fragile. Hold personal expenses low through that period.

### 7.4 What the licence does not protect

The licence gate does not protect API keys, and MIT grants no right to prevent forking. The real
bound on key loss is **per-client spend caps at the gateway** (`ARCHITECTURE.md` §12.1). Build
those first.

---

## 8. Honest verdict

| Question | Answer |
|---|---|
| Is gross margin good? | **Yes — 83% at scale**, higher without cloud fallback |
| Is setup capital a barrier? | **No** — under ₹3 lakh |
| Is this viable as a livelihood? | **Yes, from year 2–3.** ~₹28 lakh gross, ~₹25 lakh net |
| Is it a large business? | **No.** Not with 2 Clients/year. This is ₹35 lakh scale, not venture scale |
| Is there a hard ceiling? | **Yes — our time**, until the installer exists |
| Is the largest risk adoption? | **Yes.** Conversion is unmeasured and everything above assumes it |

### Where I disagree with the pessimism

The instinct that "this hardly pays" is wrong on margin and right on scale. Gross margin is 83%,
setup capital is trivial, and the entry cost to a Client is ₹2 lakh against a society that already
spends far more on CCTV, landscaping and security. The economics are sound.

### Where I agree, more strongly

**Two things will decide this, and neither is code.** First, adoption — whether a society's
residents actually subscribe. Second, Client concentration. A model where each year brings two
customers and each customer is half your revenue is fragile until the fifth year, and you should
plan your personal finances around that rather than around the ₹35 lakh figure.

Build the installer so the hours problem disappears, and measure conversion in the first pilot.
Those two numbers, not any architectural decision, will determine whether this is a good business
or a modest one.

---

## 9. What to measure from day one

| Metric | Target | Decides |
|---|---|---|
| Install time, clean machine | **≤ 90 min** | The hours ceiling |
| Support contacts/client/month | **< 1** | Whether the product is underspecified |
| **Conversion: active users → paid** | **≥ 30%** | Whether the subscription line exists |
| Customers per platform | Track from pilot 1 | Largest single unknown |
| Cloud COGS/customer/month | **< ₹150** | Protects margin |
| AMC renewal at 12 months | **> 90%** | Whether the service framing works |

---

## 10. Assumptions to challenge first

1. **30–45% conversion.** Entirely unmeasured. Run the pilot and re-run every number here.
2. **₹25,000/month AMC is acceptable to a committee.** Test with the first proposal.
3. **Annual terms.** If most Clients refuse annual, cash flow and retention both worsen.
4. **Support stays at 2 h/month.** Usually optimistic. Measure it in pilot 1.
5. **Two Clients per year is a floor, not a ceiling.** If referrals outperform, this whole model
   changes shape — and the automation becomes urgent rather than important.

---

# Part III — Commercial Structure, GST & AMC Options

> *Consolidated from BUSINESS-PROPOSAL.md.*

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

Plus end-user subscriptions sold direct (see PRICING.md and SALES-PROPOSAL-FLAGSHIP.md):
- **Basic (Free Trial)**: ₹0 (500k tokens, Chat mode only)
- **Standard**: ₹299/mo (2M tokens, Chat + Work modes, solopreneurs)
- **Family (4 Pooled Seats)**: ₹999/mo (6M tokens pooled = ₹250/seat, Chat + Study + Work, POCSO child safety guardrails)
- **Pro Developer**: ₹1,499/mo (15M tokens, Chat + Study + Work, VSCode Server Web IDE, MCP, Agents)
- **Pro Family (4 Pooled Seats)**: ₹2,499/mo (25M tokens pooled, full Pro developer tools on adult seats)
- **Privacy Sovereign Edge (3 Seats)**: ₹3,499/mo (100% on-premises inference on client\'s >=24GB GPU, Zero-Knowledge relay)
- **Enterprise**: from ₹15,000/mo (custom seats & token pools, dedicated node, SAML SSO, SLA)

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

---

# Part IV — Services & Dual-Revenue Accountability Model

> *Consolidated from SERVICES.md.*

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
