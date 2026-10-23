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