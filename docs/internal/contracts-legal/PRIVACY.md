# Privacy & Anonymity — Satchida AI Harness

The privacy architecture, what we may lawfully claim about it, the marketing language, and the
in-app notice. This document exists because **privacy claims are the easiest thing to
over-promise and the fastest thing to lose trust over.**

It also contains two uncomfortable facts about our own product. Both are stated here so they
cannot be lost between now and launch.

Related: `INFERENCE.md` (routing, provider terms), `PRICING.md` (Privacy tier),
`ARCHITECTURE.md` §8 (topology), `Bugs.md` (risks).

---

## 1. Naming: "Privacy", not "Private" or "Anonymous"

The third mode is a mode, and its name is a claim.

| Candidate | Assessment |
|---|---|
| **Privacy** | **Recommended.** Matches what we can defend. Parallel to Chat and Work as an intent a user picks |
| Private | Fine, but reads as an adjective rather than a mode |
| Anonymous / Anonymity | **Over-claims.** Satchida is always an identifiable party — we hold the account keys and run the router. See §3 |
| Local / On-device | Over-claims whenever the route may be cloud, and leaks the implementation |
| Shield / Vault | Memorable, but implies a security guarantee we cannot make |

**Decision: the mode is `Privacy`, and the tier is the `Privacy` tier at ₹990/month.** Aligned
naming so the plan page and the mode selector say the same word.

The customer-facing description of the mode is **"Processed only on infrastructure Satchida
operates."** That is precise, verifiable, and stronger than a vague adjective.

---

## 2. The architecture that produces the privacy property

Three mechanisms, in order of how much they actually contribute:

### 2.1 We never market any provider or model

**No provider name, no model name, anywhere user-facing.** Not in the interface, not in
responses, not in marketing, not in plan descriptions, not in the model picker. If a user never
learns which model answered, there is no provider to build a profile of them and no model to
benchmark us against.

This is a **product rule with a compliance consequence**, not just branding. Anthropic §D.4
restricts building a "competing product or service." Never presenting ourselves as provider
access keeps us squarely in wrapped-application territory under §A.1, which explicitly permits
"products and services Customer makes available to its own customers and end users."

**Operational rules that enforce it:**

- No provider or model name in any `librechat.example.yaml` value a user can observe.
- No provider-named agent, preset, or mode.
- No provider named in plan copy, feature lists, or comparison tables.
- **Do not add a "powered by X" tier later** — that single feature would be the thing that
  makes Satchida a competing product of X.

### 2.2 Distribution across providers and models

Prompts are routed by our own scheduler across multiple providers and multiple models.
**No single provider receives a complete record** of any user's activity, and none can correlate
one user's prompts because it never sees enough of the picture to do so.

Combined with §2.1, a provider cannot build a profile of an individual — it does not know who
they are, and it does not know what else they asked.

### 2.3 Single-account credentialing

Every provider sees **Satchida**, never Satchida's customers. All traffic originates from our
servers, so device count and user count are invisible upstream.

### 2.3a Transport layer — Cloudflare (decided 2026-10-03)

Clients are reached over **Cloudflare Zero Trust Named Tunnels** on `satchida.com`, because
residential CGNAT makes inbound access impossible. Cloudflare is therefore in the path of every
request and every response.

**What that means for our claims — stated precisely:**

| Layer | Who | What they receive |
|---|---|---|
| **Transport** | Cloudflare | Proxied HTTPS. Traffic metadata (IPs, timing, size) is inherently visible. The **content** of the connection passes through their edge |
| **Inference** | Cloud providers | The prompt itself, unattributed — unless Privacy mode |

**The distinction that matters:** Cloudflare proxies bytes. It is not an inference provider and is
never told who the user is by anything we send. But bytes do pass through, and we must not claim
otherwise.

⚠️ **Consequently, these two statements in earlier drafts are no longer accurate and are removed:**
- *"content never leaves your premises"* — in Privacy mode the content transits Cloudflare's edge
  before reaching the client's local model
- *"no third party ever sees content"* — Cloudflare's edge is in the path

**The claim that survives, and is genuinely strong:** in **Privacy mode, the content is never
delivered to any AI provider** — not OpenAI, not Anthropic, not an aggregator. It is processed
only on infrastructure the client operates. Nothing is used for training by anyone.

That is the meaningful promise, and it is verifiable: no provider receives the prompt at all.

**Known limitation, recorded honestly:** the self-serve Cloudflare plan does not include a Data
Processing Addendum; Cloudflare states one requires Enterprise. For B2B school sales this means the
school, as Data Fiduciary, would be processing student data through a processor without a DPA in
place. Mitigations if a school raises it: the client may run their own tunnel on their own Cloudflare
account (we supply the two commands either way), or we move to Enterprise once revenue justifies
it. **Do not promise a DPA we do not have.**

### 2.4 Privacy mode: locality

In **Privacy** mode, content is processed on hardware we operate and **never leaves our
infrastructure**. This is the only mode offering true locality, and it is the strongest property
we can offer.

---

## 3. Two facts about our own product that must be disclosed

These are the reasons we cannot say "anonymous" or "nothing is retained by anyone."

### 3.1 Satchida retains your conversations

LibreChat stores conversation history and messages in MongoDB. **Your prompts and responses are
retained by us.** They are not sent to a third party in Privacy mode, but they exist on our
systems.

This is not incidental — it is what makes multi-turn conversations work. It must be in the
privacy policy plainly, with a retention period and a deletion control.

### 3.2 The retention picture depends on the deployment — and one of them is much better

**Correction to an earlier draft of this document**, which stated flatly that Satchida retains
conversations. That is true of one deployment model and false of the other, and the difference
should drive the product.

| | **On-premise (RWA / SMB)** | **Multi-tenant SaaS** |
|---|---|---|
| Who owns the hardware | **The customer** | You |
| Where the database lives | **Their server** | Yours |
| Who holds the identity mapping | **The customer** | You |
| Does a prompt reach you | **Only in Chat/Work, transiently, at the router** | Yes |
| Are you the Data Fiduciary | Arguably **no — the society is** | **Yes** |

**In the on-premise model the strongest claim in this entire document becomes available:**

> **"Your conversations are stored on hardware you own and operate. Satchida does not receive
> them."**

That is true by architecture rather than by promise, and it is a *far* better sentence for a
prospect than "we retain your data for 30 days." Never say it in a deployment where it is false.

In **Privacy mode on-premise, prompts never leave the customer's premises at all** — the local
model runs on their hardware and the router is never consulted.

### 3.3 Anonymity: the operator is right, and I was too conservative

An earlier draft said we hold the credentials and could correlate, therefore "anonymous" is
false. **That reasoning was incomplete.** It conflates two different questions:

- *Can we re-identify?* In the on-premise model, **no** — the customer holds the database and the
  identity mapping. In the SaaS model, yes unless we purge.
- *Can the model provider re-identify?* **No, ever.** No identity is transmitted. Traffic is
  aggregated across many users and distributed across many providers.

The VPN analogy is correct. VPN operators legitimately say they do not disclose user details
absent a legal process, and the claim is sound because of **what the network can and cannot see**,
not because of trust. Our position is the same shape and is in fact easier to state: the provider
receives **no identifier at all**.

**So the accurate formulation is scoped, and it should be quoted this way:**

> ✅ **"Your identity is never disclosed to any model provider. No provider knows who you are."**
> — accurate in every mode, every deployment.

> ❌ **"You are anonymous."** — imprecise, because in the SaaS model *we* hold the account and
> the payment record, and anonymity to a third party is not anonymity simpliciter.

The scoped claim is **stronger** than the blanket one, because it is specific and falsifiable.

### 3.4 Irreversible anonymisation is what removes data from law

See `LEGAL.md` §1. DPDP protects "digital personal data — the data by which a person may be
identified." Tokenising a user ID is **pseudonymisation**, and the data stays personal data. Only
**irreversible** anonymisation followed by purge removes it from scope.

This makes retention design a legal decision, not just a customer-relations one:

| Implementation | Legal result |
|---|---|
| Tokenise user ID, keep the mapping | Still personal data — DPDP applies in full |
| Tokenise, discard the mapping after N days | Moves toward anonymised — a genuine reduction in scope |
| Anonymise conversation content irreversibly, then purge | **Out of DPDP scope entirely** |

### 3.5 What genuinely must be retained

**The payment transaction.** It is a financial record and has a statutory retention period
(confirm the exact figure with a CA — commonly eight years under Indian commercial and tax
practice).

That is the **only** record we are asserting a need to keep. Everything else should purge on a
timer. Where a timer is short and the mapping is discarded, we are both more privacy-respecting
*and* legally lighter.

---

## 4. Claims ledger

Every claim marked **No** is a claim we must not make. This table is the reference for all
copy, the sales page, and the app.

| Claim | Verdict | Notes |
|---|---|---|
| "Your identity is never disclosed to any model provider" | ✅ **Yes** | No identifier is transmitted, in any mode or deployment |
| "No model ever learns who you are" | ✅ **Yes** | Same as above |
| "We never reveal which provider or model answered" | ✅ **Yes** | Enforced by §2.1 |
| "Your prompts are not used to train any model" | ✅ **Yes** | OpenAI since 2023-03-01; Anthropic commercial; verify per provider at launch |
| "We do not sell or share your data" | ✅ **Yes** | Must remain true as we grow |
| "Requests are spread across providers, so none sees the full picture" | ✅ **Yes** | §2.2 |
| **"Your conversations are stored on hardware you own. We do not receive them."** | ✅ **Yes — on-premise only** | Strongest claim available. **Never say it in SaaS** |
| "In Privacy mode your content is never delivered to any AI provider" | ✅ **Yes** | The real and verifiable claim. Content does transit Cloudflare's edge in transit — do not claim otherwise |
| "Conversations are deleted after N days" | ✅ **Yes, if implemented** | Must be a real purge, not a policy statement |
| "You are anonymous" | ❌ **No** | Imprecise — we hold the account and payment record in SaaS |
| "Nothing is ever retained by anyone" | ❌ **No** | Payment records must be retained; some providers run 30-day abuse logs until ZDR lands |
| "Your data never leaves your device" | ❌ **No** | False in Chat and Work, and false in Privacy mode too — content transits Cloudflare's edge |
| "No third party ever sees your content" | ❌ **No** | Cloudflare proxies every request. It is transport, not inference — but the bytes pass through |
| "We cannot technically re-identify you" | ❌ **No** | False in the SaaS deployment |
| "100% private" / "complete privacy" / "unhackable" | ❌ **No** | Over-claims; creates legal exposure |

---

## 5. Marketing language

Draft copy. Every sentence maps to a ✅ row in §4.

### Headline

> **No model ever learns who you are.**

### Primary pitch

> Most AI assistants belong to their model provider. Your prompts, your account, your history —
> all of it sits with a company whose product you are.
>
> Satchida belongs to you. We never reveal which provider or model answers your request — not in
> the interface, not in the answer, not anywhere. Requests are routed across multiple providers
> and models, so no single company ever holds a complete picture of what you ask or who you are.
>
> Your prompts are never used to train any model, and we never sell or share your data.

### Privacy mode

> **Privacy mode — processed only on infrastructure we operate.**
>
> Your conversation runs entirely on hardware Satchida operates and never leaves it. No third
> party receives your content at all. Choose it whenever the material is yours to move.

### Short form

> Your prompts are not used for training. No provider is told your name, your email, or your
> identity. We do not tell you which model you are talking to, because that is not information
> you need — and not information any provider needs about you.

### The competitive line

> With ChatGPT you are OpenAI's customer. With Satchida you are Satchida's customer, and the model
> provider never learns you exist.

---

## 6. In-app notice

Displayed on first use and reachable from Settings. Copy per `AGENTS.md`: English keys only in
`client/src/locales/en/translation.json`, surfaced through `useLocalize()`.

### 6.1 First-use notice

> **Before you start — a note on sensitive information**
>
> Satchida is designed so that no model provider knows who you are. That does not make it a
> channel for confidential material.
>
> Depending on the mode you choose, your messages, uploaded files and links may be processed by
> third-party infrastructure. You remain solely responsible for what you submit. Please do not
> enter passwords, API keys, access tokens, financial or card details, government identifiers,
> medical information, or any other confidential or regulated information — whether in a message,
> a document, or a link.
>
> Your conversations are stored on Satchida servers so you can return to them. You can delete
> them at any time from Settings.
>
> [ I understand ]

### 6.2 Per-mode notice

Shown when switching modes. One short line each — the point is that the answer differs by mode,
so a single blanket notice would be both longer and less useful.

| Mode | Line |
|---|---|
| Chat | "Processed by third-party infrastructure. Your prompt is not retained by the model provider and is never used for training." |
| Work | "Processed by third-party infrastructure. Your prompt is not retained by the model provider and is never used for training." |
| Privacy | "Processed only on infrastructure Satchida operates. Your content does not leave our systems." |

### 6.3 Settings > Privacy

> Satchida stores your conversations on our servers so you can continue them across devices. We
> do not use your prompts to train any model, and we do not sell your data.
>
> Satchida routes requests across multiple providers and models. No model provider is given your
> name, email address, or account details, and no single provider receives a complete record of
> your activity.
>
> We do not identify you to any model provider. This is a design commitment: no provider should
> come to know who you are.
>
> **What we do store:** your account details, your conversations, and the operational logs needed
> to run and secure the service.

---

## 7. What this design cannot promise, restated

- A provider that retains content under its own abuse-monitoring policy retains it from
  **Satchida**, not from you, and we do not use it.
- We retain your conversations. That is disclosed, not hidden.
- We hold the credentials and could correlate. We do not, and the privacy policy should say so
  in plain language rather than leave it implied.
- Routing is decided at request time, so a single prompt's destination is not knowable in
  advance by anyone, including us, in a way the user can audit. We can tell you the
  *architecture*; we cannot let you verify an individual request.

That last point is the honest limit. Do not imply per-request auditability we have not built.