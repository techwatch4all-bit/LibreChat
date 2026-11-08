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