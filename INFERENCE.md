# Inference Architecture — Satchida AI Harness

How a prompt becomes an answer: which providers, in what order, under what privacy
guarantees, and what happens when one fails. This is the most commercially sensitive document
in the set — it records what was **verified** from provider terms and documentation, as
distinct from what was assumed.

Read with: `ARCHITECTURE.md` (§8 topology), `PRICING.md` (tiers), `Bugs.md` (risks),
`CONTEXT.md` (vocabulary).

---

## 1. Three different things people call "privacy"

Most of the confusion in this design comes from collapsing three distinct properties. They
are independent, and a product claim is only honest if it names which one it means.

| Property | Meaning | Achieved by |
|---|---|---|
| **Non-retention** | The provider does not keep your prompt after answering | Provider ZDR / no-logging terms |
| **Unlinkability** | The provider cannot tell which of your users sent a given prompt | One shared key, mixed traffic |
| **Locality** | The content never touches third-party infrastructure | Our own vLLM |

**Your reasoning "ZDR + shared key = privacy" is right about two of three, and the gap matters.**
ZDR gives non-retention. A shared key gives unlinkability *as seen by the provider*. Neither
gives locality. And critically: **we remain the identifiable party**, because we hold the key
and run the router. That is unavoidable and fine — but it must not be sold as "anonymous".

You correctly identified that distributing traffic across many providers and models makes
unlinkability *stronger*: no single provider ever holds a correlated slice of the user base.
That is the right architecture and it stays.

### What we can truthfully promise a paying customer

> "Your prompts and responses are never used to train any model. They are not retained by the
> model provider after your request completes. No provider can identify which Satchida user
> sent a given prompt."

What we must **not** claim: that content never leaves our infrastructure (false in Cloud modes),
or that Satchida is anonymous (we are not, and cannot be).

---

## 2. Verified provider facts

Researched 2026-10-03. Source URLs given so claims can be re-checked as terms change.

### 2.1 OpenAI

Source: `platform.openai.com/docs/guides/your-data`

- API data **has not been used for training since 1 March 2023**, unless explicitly opted in.
- **Abuse monitoring logs are retained up to 30 days by default**, and these "may contain
  certain customer content, such as prompts and responses, as well as metadata derived from
  that customer content".
- **Zero Data Retention requires prior approval by OpenAI** and acceptance of additional
  requirements. It is **not self-serve**. "Modified Abuse Monitoring" is a middle tier.

**Implication:** we cannot promise non-retention from OpenAI on day one. Either apply for ZDR
early (it is a business-development task with a lead time) or state the 30-day abuse-monitoring
position honestly in the privacy policy.

### 2.2b Provider licensing matrix

What each provider's terms permit. **Verified** = primary text retrieved and quoted.
**Unverified** = must be read before the provider carries any traffic. Do not assume.

| Provider | Status | Verified position |
|---|---|---|
| **Anthropic** | ✅ Verified | **§A.1 permits powering products for our own customers and end users.** §A.0: services under Commercial Terms "are not for consumer use" — serving consumers via API keys is the intended path. **§D.4 restricts** building a competing product or reselling the Services |
| **OpenAI** | ✅ Verified | API data unused for training since 2023-03-01 unless opted in. Abuse monitoring logs up to **30 days** by default, may contain prompts/responses. **ZDR requires prior approval**, not self-serve |
| **OpenRouter** | ✅ Verified | Mixed. **Permits** incorporation into our own products for customers: *"the Service enables you, your Authorized Users, and your customers (to the extent you incorporate the Service into your own products and services) access to Models."* **Restricts** "reselling API access to Models **or otherwise developing a competing service**" and multi-account quota circumvention |
| **Google (Gemini API)** | ⚠️ Unverified | Terms page is JS-rendered; primary text not retrieved. Paid-tier Gemini is not used for training by default, but **confirm before relying on it** |
| **Meta** | ⚠️ Unverified | Not retrieved. Confirm acceptable-use terms for a commercial wrapper before routing traffic |
| **TokenHarbor** | ⚠️ Unverified | Marketing page claims "Paid routes do not persistently store prompts or responses." **Terms not read** — reseller rights and multi-account language unknown |
| **CommandCode** | ⚠️ Unverified | Positions as a coding-agent product, not an open-model API gateway. Whether it offers resale-eligible API access is **unknown** |
| **OpenCode** | ⚠️ Unverified | Zen free models referenced but terms not retrieved |

**Correction to an earlier draft of this file:** it stated OpenRouter "must not carry monetised
traffic." That over-read the clause. OpenRouter's terms explicitly contemplate customers
accessing Models through products we build. The boundary is *how* we wrap it, not a blanket
prohibition. Direct provider keys remain the **recommended** default — no 5% intermediary fee,
no margin, and one fewer terms surface to reason about — but the aggregator is not categorically
excluded.

**What is genuinely prohibited everywhere: multiple accounts used to multiply a free quota.**
One personal key per provider is ordinary use.

---

### 2.3 OpenRouter — detailed findings

Sources: `openrouter.ai/docs/faq`, `openrouter.ai/privacy`, `openrouter.ai/terms`

**Free model quota (exact, from their FAQ source constants):**

| Condition | Free-model requests per day |
|---|---|
| Account with **no credits** | **50** |
| Account with **≥ $10 credits** | **1,000** |

So keeping $10+ in the account raises the free pool from 50 to **1,000 requests/day**. That is
the number the whole free-tier design must be sized against — not an unbounded supply.

**Logging — their own documents disagree:**

- FAQ: "Prompt and completion are not logged by default. We do zero logging of your
  prompts/completions, even if an error occurs, unless you opt-in to logging them." Opting in
  gives a 1% discount.
- Privacy Policy: "Any text or data you input into the Service ('Inputs') that include personal
  data **will also be collected by us**."

Record the discrepancy. Do not rely on either sentence as a contractual guarantee.

**Provider-level privacy filtering is real and useful:** OpenRouter will not route to providers
that log or whose policy is unconfirmed, unless the training toggle is enabled. If provider
routing is specified but no provider matches the account's privacy level, the request errors
rather than completing. That is a genuine tool for the Privacy mode.

**Terms of Service — two clauses that decide the architecture:**

> "create a false identity, misrepresent your identity, or **create multiple accounts as a single
> user, for purposes of bypassing or circumventing use limits** on the Site or Service or for
> any other reason"

> "access the Site or Service for purposes of **reselling API access to Models** or otherwise
> developing a competing service"

Section 5.7 makes circumventing provider safeguards "a material breach subject to immediate
suspension and/or termination," and names VPN/proxy use for restricted models.

**Three consequences:**

1. **Multiple accounts on one aggregator to multiply free quota is prohibited.** One personal
   key is fine — that clause targets deliberate quota stacking, not single-account use.
2. **The clause that matters is the second limb:** "for purposes of reselling API access to
   Models **or otherwise developing a competing service**." That applies whether or not we name
   the provider or sell access. So OpenRouter must not carry monetised traffic — **not because
   monetised AI is prohibited anywhere, but because the aggregator's terms prohibit building a
   competing service on top of them.** Direct provider keys carry no equivalent restriction.
3. OpenRouter has **built-in provider fallbacks** already ("unified API and fallbacks so that
   you get much better uptime"). Our autorouter's job is therefore *not* basic provider failover —
   it is cross-provider failover, free-first ordering, and local terminal fallback, none of which
   OpenRouter can do for us.

### 2.3 TokenHarbor

Source: `tokenharbor.ai` (marketing page)

Positions itself as "one API for the world's leading AI models" with: "Paid routes do not
persistently store prompts or responses. Free routes stay off until you opt in," and "No silent
model swaps."

Worth evaluating — the stated no-training and route-dependent retention posture is more explicit
than most aggregators. **Their terms must be read before any commitment**, specifically for
reseller rights and multi-account language. Unverified; see `Bugs.md`.

### 2.4 CommandCode

Source: `commandcode.ai`

Positions as "the best coding agent for open models" — a coding-agent product, not an
open-model API gateway. Whether it offers resale-eligible API access is unconfirmed. Do not
assume it is a provider; verify before it enters the registry.

### 2.5 Providers to evaluate

Named by the operator: **OpenCode** (Zen free models), **TokenHarbor**, **CommandCode**,
**Experiential Labs** (unconfirmed — no matching service identified; needs the correct name or
URL).

For any candidate, the registry entry must record, before it goes live: whether paid API
access may be **resold to your own customers**, whether **multiple accounts are permitted**, and
whether prompts are **retained**.

---

## 3. Provider registry — the licensing gate

This is the architectural correction. Every provider must pass three checks before it can
carry a paying customer's traffic.

```
                 ┌─────────────────────────────────────────┐
  candidate ────▶│ 1. Resale permitted in their ToS?       │
                 │ 2. Multi-account permitted?              │
                 │ 3. Retention position documented?        │
                 └────────────────┬────────────────────────┘
                                  │ all three pass
                                  ▼
                         ┌──────────────────┐
                         │  Provider registry │
                         │  (routing-eligible)│
                         └──────────────────┘
```

**Aggregator resellers generally fail check 1.** That is not a reason to abandon them — it is a
reason to confine them to non-revenue traffic (Demo tier, recovery, internal use) where the
prohibition does not bite, and to carry paid tiers on **directly contracted** providers.

### The legitimate paths

**Correction (2026-10-03, second review):** an earlier draft of this document stated that paid
tiers require a signed reseller agreement. **That was wrong.** Standard commercial API terms
already permit powering products for your own end users.

Anthropic Commercial Terms §A.1: *"Subject to these Terms, Anthropic gives Customer permission
to use the Services, including to power products and services Customer makes available to its
own customers and end users ("Users")."* §A.0 also notes *"Services under these Terms are not
for consumer use"* — serving consumers through API keys under commercial terms is the intended
path, not a workaround.

| Route | How | Notes |
|---|---|---|
| **Direct provider API keys** | Our own account/key, standard commercial terms | **The default and correct path.** Explicitly permits powering products for our own end users. No special agreement needed. |
| **Self-hosted local model** | Our own vLLM | Zero third-party terms. The licence-clean core. |
| **BYOK** | Customer's own key, their own provider | Customer contracts the provider directly; we are not a party. Zero resale question. |
| **Aggregator** | OpenRouter, TokenHarbor, OpenCode | Confined to non-revenue traffic — see the finding below |

**No reseller agreement is required.** What the standard terms *do* restrict is building a
**competing product**. Anthropic §D.4: *"Customer may not and must not attempt to (a) access the
Services to build a competing product or service, including to train competing AI models or
resell the Services except as expressly approved by Anthropic."*

**This is where the model-hiding design earns its keep twice.** Because we never name the
provider, never market by model, and never offer a provider-branded mode, we are a wrapped
application under §A.1 rather than a competing product under §D.4. The anonymity the product
wants for user privacy and the compliance posture it needs are the same decision. Adding a
"powered by <provider>" tier later would drift toward the restriction.

**Still prohibited everywhere: multiple accounts used to multiply a free quota.** One personal
key per provider is fine and is not circumvention.

---

## 4. Three modes

| Mode | Routing | Search | Guaranteed to customer |
|---|---|---|---|
| **Chat** | free cloud → paid cloud → **local** | standard web search | not-retained, not-trained (per provider terms) |
| **Work** | paid cloud preferred → free cloud → local | standard web search | highest quality available |
| **Privacy** | **local only** — content never leaves our infrastructure | none, or a contracted provider | locality: the strongest property we can offer |

**"Privacy"** is the chosen public name. Customer-facing description: **"Processed only on
infrastructure Satchida operates."** Precise and verifiable, where "Anonymous" over-claims —
Satchida holds the credentials and is always an identifiable party. See `PRIVACY.md` §1.

### Privacy mode is local-only at launch

Earlier drafts split this into Privacy (Local) and Privacy (Cloud). **That split is dropped.**
A cloud variant cannot be described as Privacy while OpenAI ZDR is approval-gated and default
abuse-monitoring logs run 30 days — it would be exactly the over-claim this product exists to
avoid.

- **Privacy mode, now** — local inference only. True locality. Limited to ~8 concurrent GPU
  streams, so it must be capacity-limited, not token-limited.
- **Privacy (Cloud), later and gated** — only once a contract with documented non-retention terms
  exists. It would be a **separate mode with its own name and its own notice**, not a variant of
  this one. Do not build UI implying it exists today.

The commercial point holds either way: **Privacy is our highest-margin mode** because its COGS is
approximately zero, and it is the only tier sellable without depending on any provider's
retention posture.

### The VPN is network hygiene, not a privacy feature

A paid VPN on the server hides server↔ISP traffic. It does **not** hide anything from the AI
provider — they still see the VPN's IP, and we are still the identifiable account holder. It
protects against the local network, not against OpenAI.

Ship it as operational hygiene for the VPN deployment. Do not list it as a customer privacy
benefit; that would be the same category of error as claiming "finetuned" with no fine-tune.

---

## 5. The autorouter

LibreChat has no provider failover. Verified: `packages/api/src/endpoints/config/providers.ts:40`
maps one provider name to one initialize function; the two `fallback` references there are
case-insensitive name normalisation; every `429` in the codebase is internal queue pressure
(`QUEUED_TURN_QUEUE_FULL`, `STEER_QUEUE_FULL`), never an upstream model provider's rate limit.

So the router is ours to write. It sits in front of vLLM and LibreChat points at exactly one
endpoint — the router.

### Structure

```
LibreChat ──(single endpoint: "satchida")──▶ Autorouter
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              local vLLM              cloud providers            quota/circuit state
              (terminal fallback)      (registry, ranked)         (Redis)
```

### Registry entry

```ts
{
  provider, model,
  apiKeys: string[],          // keys this provider is entitled to use
  capabilities: ['text','vision','tools','streaming'],
  retention: 'none' | 'documented' | 'unknown',   // never assume
  resalePermitted: boolean,                       // the §3 gate
  costPerMTok: { input, output },
  priority: number,                               // per mode
}
```

`retention` defaults to `'unknown'` and an entry with `unknown` retention **must not** serve
Privacy mode. Fail closed.

### Quota state — Redis

```
quota:{provider}:{model}:{window} → { resetsAt: <epoch>, reason: 'rate_limit'|'budget' }
```

On a 429, parse `Retry-After` or the provider's reset field and set the cooldown. Where a
provider publishes remaining quota, poll it rather than discovering exhaustion by failing.

### Selection

1. Drop everything in cooldown
2. Drop entries failing the mode's `retention` requirement
3. Drop entries lacking a required capability (vision needs mmproj; agents need tools)
4. Order by mode priority
5. **Local vLLM is the terminal fallback** for every mode

Plus a **circuit breaker** keyed on failure *rate*, not just 429s — otherwise a provider
returning 500s keeps being selected forever.

### Quota arithmetic — size the free pool honestly

Free models yield **1,000 requests/day** on OpenRouter with $10 in the account. That is the
entire free budget, across all users, all modes, and all recovery traffic.

At 1,000 subscribers that is roughly **one free request per user per day**. It is an
opportunistic saving on the margin, not capacity. The design must not depend on it, and the
Demo tier in particular should be budgeted against the **local** model, not free cloud.

---

## 6. Mid-turn recovery — multi-bot on free models

Per the operator's decision: when a response fails, do not surface a partial buffer or an
error. Discard it and re-derive a complete answer, preferring free routes so recovery costs
close to nothing.

Multi-agent orchestration is native — `@librechat/agents` is a LangGraph runtime for
single- and multi-agent runs, and LibreChat ships a task store and subagent threads.

### Design

1. Detect failure (stream error, provider 5xx, unusable truncation)
2. Discard the partial buffer entirely
3. Fan out the same prompt to N eligible free-route providers **in parallel**
4. Select one result
5. Emit as a single continuous response

### Why the earlier checkpoint objection is resolved

The correctness problem with replay is duplicated side effects — a tool call, a file write, a
code execution that already happened. Multi-bot recovery avoids it structurally: rather than
replaying a partially-executed turn, it **re-executes the turn from the beginning** on a clean
model with no side-effect history. There is nothing to duplicate because nothing carried over.

The cost is that any tool work the first attempt did is redone. For the failure classes that
matter (rate limit, upstream 5xx, mid-stream disconnect) the first attempt typically did little,
so this is cheap in practice.

### The hard problem: selection

Best-of-N needs a judge, and a judge is a model you must trust. Options, ranked:

| Strategy | Cost | Quality | Note |
|---|---|---|---|
| **First complete, above a length floor** | 0 | adequate | Recommended default. Fast, no extra model, no judge to game |
| Longest non-truncated | 0 | low | Rewards verbosity, not correctness |
| Free model judges free models | 0 | poor | Judges are weak; adds latency and compounds the rate limit |
| Local vLLM as judge | GPU | good | Consumes the scarcest resource; only viable at low volume |
| Paid model as judge | money | good | Defeats the zero-cost premise |

Recommendation: **first-complete-wins with a minimum-quality floor** — reject truncated or
degenerate output and fall through to the next candidate. No judge model in the critical path.

### Two limits you should know

**The rate-limit collision.** Recovery fires *because* something failed — frequently *because*
of rate limiting. If the primary provider 429'd, the free pool may be near exhaustion too. The
1,000/day budget is shared between normal Chat traffic and recovery, so heavy recovery periods
will consume it quickly and starve the Demo tier. Reserve a share: e.g. 70% general, 30%
recovery, enforced by the selector rather than left to chance.

**Free-model quality is uneven.** Recovery is exactly when the user least wants a worse answer.
Free routes are appropriate for re-deriving a *structurally sound* answer, not for a turn that
needed frontier reasoning. Recovery should fall back through free routes and then **local vLLM**
rather than stopping at the weakest free model.

---

## 7. Egress and network

- **Server VPN egress** — operational hygiene for the VPN deployment; hides server↔ISP traffic.
  Not a customer-facing privacy feature.
- **No Tor.** Not justified here: it adds latency and unreliability, and the privacy argument
  is already carried by multi-provider distribution plus direct non-retention contracts. Revisit
  only if a customer-facing requirement demands it.
- **Search** — Privacy mode must not issue search queries to public engines, because the *query*
  leaks even when the answer does not. Either a contracted search provider, or no search in
  Privacy mode. Do not repeat the SearXNG approach (see `Bugs.md` §B6).

---

## 8. Open items

1. Correct name or URL for **Experiential Labs**
2. Whether **CommandCode** offers resale-eligible API access at all
3. **TokenHarbor** terms — reseller rights and multi-account language
4. Whether to apply for **OpenAI ZDR** now (lead time) or ship Privacy (Local) first
5. Legal review of the privacy-policy wording in §1 before any customer sees it