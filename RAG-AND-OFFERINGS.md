# RAG, Educational Offerings & Image Economics

Answers to four questions that determine what we can actually sell: does LibreChat have RAG, can
it be sold per-account, what does image generation really cost, and what are the concrete
educational products.

Related: `SALES-OBJECTIONS.md`, `CHILDREN-SAFETY.md`, `MODEL-CATALOG.md` (**internal**),
`DEPLOYMENT.md`.

---

## 1. RAG — yes, natively integrated. Verified in this repository.

| Component | Path | Function |
|---|---|---|
| RAG integration | `packages/api/src/files/rag.ts` | Embed/delete documents |
| **Search** | `packages/api/src/files/rag/search.ts` | `executeFileSearchQuery()` |
| **Context injection** | `packages/api/src/files/rag/context.ts` | Builds the prompt context |
| Text → embed | `packages/api/src/files/text.ts:83-103` | Chunks and forwards to rag-api |
| Health check | `packages/api/src/app/checks.ts:265` | `GET ${RAG_API_URL}/health` |

### The architectural finding that matters

From `packages/api/src/files/rag.ts`:

```ts
const jwtToken = generateShortLivedToken(userId);
await axios.delete(`${process.env.RAG_API_URL}/documents`, {
  headers: { Authorization: `Bearer ${jwtToken}`, ... },
  data: [file.file_id],
});
```

**Every RAG call carries a short-lived JWT whose subject is the userId.** rag-api is
**ID-based, not user-based** — documents are addressed by `file_id`, and identity travels in the
token, not the payload.

**Consequence: a per-account RAG space is native, not something we build.** Namespace by `userId`
(or by `tenantId` where present) and retrieval is scoped by construction. This gives us:

| Offering | Mechanism |
|---|---|
| **Personal RAG space** per account | Documents addressed to that userId |
| **Shared space** for a class, cohort or committee | A shared namespace identifier |
| **Per-space limits** | Document count, vector storage, and query budget enforced at rag-api |
| **Provable isolation** | A user's JWT cannot address another user's `file_id` |

That last one is the selling point. **"Your child's textbook space is cryptographically scoped —
the school cannot read it, and no other student can either"** is verifiable and no free tool
offers it.

---

## 2. The educational killer use case

> **Regional-language PDF → RAG → speech-to-speech, all on the school's own hardware.**

Chain: student scans a textbook in any Indian language → RAG grounds every answer in *their*
material → answer generated in the taught language → spoken back via TTS in the regional language.
Nothing leaves the building.

Every component exists: rag-api (MIT), multilingual embeddings, server-side STT/TTS
(`CHILDREN-SAFETY.md` §3), local models on the 16 GB card.

**The one prerequisite: Indic language coverage.** Whisper covers several Indic languages for
STT. Indic TTS quality is far weaker and varies by language. This must be tested per language
before any claim is made — see §6.

---

## 3. Image economics — cost recovery is the wrong frame

Cost per image on the 16 GB card: **~₹0.01** (`MODEL-CATALOG.md` §5).

At ₹2/image that is a **200× margin.** The problem is not margin — it is that ₹2 is too low a
number to be worth a customer's payment decision. **Price for willingness-to-pay, not for cost.**
At these costs, cost recovery is irrelevant.

### Tiered by type and quality

| Tier | Spec | Price | Cost | Margin |
|---|---|---|---|---|
| **Quick** | 512px, 1–4 steps | **₹8** | ~₹0.004 | 2,000× |
| **Standard** | 1024px, ~8 steps | **₹20** | ~₹0.01 | 2,000× |
| **High** | 1536px + upscale | **₹60** | ~₹0.04 | 1,500× |
| **Print** | 2048px, high steps | **₹150** | ~₹0.12 | 1,250× |

### Subscription bundles (replaces the wallet)

Wallet was the wrong primitive — a second billing system on top of subscriptions. Bundle instead:

| Plan | Images/month | Note |
|---|---|---|
| Standard | **0** | Text-only, as you specified |
| Pro | **5** | Habit-forming, not generous |
| Family | **10** | Couple + 2 children |
| Enterprise | Quoted | Higher allocation |

**Additional images after the bundle: charged at the tier rate above.** No wallet, no expiry, no
prepaid balance. One billing primitive.

---

## 4. Synchronous image generation — the VRAM constraint, honestly

You are right that "submit now, collect later" is bad UX. But on a **single 16 GB card** the
constraint is physical, and the answer is the *small image model*, not the queue.

### What fits in 16 GB

| Model | VRAM (4-bit) | Notes |
|---|---|---|
| **SDXL-Turbo / Lightning** | **~6–7 GB** | **1–4 steps. 1024px in 1–4 seconds.** |
| SDXL (full) | ~9 GB | 20–40 steps, 15–25 s |
| Granite-3.1-2B (text) | ~2 GB | Your "survival" model — correct instinct |
| Qwen3-VL-4B (quality text) | ~7 GB | Cannot coexist with full SDXL |

### The recommendation

**SDXL-Turbo resident (7 GB) + Granite-2B resident (2 GB) = ~9 GB of 16 GB.**

- **Quick and Standard images render synchronously in 1–4 seconds.** No queue, no delay. Your
  instinct was right and this is how it's achieved.
- **Granite-2B stays resident as the dispatcher** — intent classification, routing decisions, and
  short factual answers. That is exactly the role you described for it.
- **High and Print tiers unload the image model and load the full pipeline**, taking ~30–60 s.
  Those are explicitly premium tiers where the wait is expected and justified.

So: **synchronous by default, slow only for the tiers priced as slow.** No overnight queue at all.

### The remaining constraint, stated plainly

**You cannot have the full-quality text model and image generation resident at the same time on
16 GB.** When a conversation needs the good text model, the image model unloads; when an image is
requested, the text model drops to Granite. That swap is 10–30 seconds.

This is a hardware limit, not a design choice, and it is the strongest argument for a second card.
It is also a concrete upsell: **a second GPU in the client's box removes all swapping.**

---

## 5. Moderation models on a 16 GB card

Both are permissively licensed and run locally.

| Model | Size | VRAM @ fp16 | @ 4-bit | Fits 16 GB? |
|---|---|---|---|---|
| **ShieldGemma 2B** | 2B | ~5 GB | ~2 GB | ✅ **Recommended** |
| ShieldGemma 9B | 9B | ~20 GB | ~8 GB | ⚠️ Tight |
| Llama Guard 3 1B | 1B | ~2.5 GB | ~1.5 GB | ✅ Cheapest |
| Llama Guard 3 8B | 8B | ~17 GB | ~7 GB | ❌ Too large alone |

**Recommendation: ShieldGemma 2B at 4-bit (~2 GB).** Apache-2.0, small, strong category coverage,
and it leaves room for everything else.

**Placement:** `input moderation → model → output moderation`, all local. Combined with the
built-in `messageFilter` for PII redaction (verified in `configSchema`), that is two distinct
filters doing two distinct jobs.

---

## 6. Non-commercial licences — what "CC-BY-NC" actually means

Apologise for the jargon. Plainly:

**AI models have licences, exactly like software. Most are permissive — MIT or Apache-2.0 — meaning
you can use them commercially, including in a paid product. Some are "non-commercial" (marked
`NC` or `CC-BY-NC`), which means you may use them for research or personal use but you may NOT use
them to make money.**

**Why I flagged it:** the restriction is that you cannot use them *in a service you charge for*.
Meta's NLLB-200, a major translation model covering many Indic languages, is CC-BY-NC. Shipping it
inside a paid subscription would be a licence breach.

**Why this matters more here than elsewhere:** academic and open-research releases are
over-represented in Indic-language models, because that's where the research funding went. So the
NC trap is *more* likely in regional-language models than anywhere else in our stack.

**The rule, applied mechanically:** before any model enters the paid tier, check its licence.
If it says `NonCommercial`, `CC-BY-NC`, `NC`, or `research-only`, it cannot ship in anything a
customer pays for. It may still be used in internal testing.

**Practical alternative:** BGE-M3 and multilingual-e5 are **MIT** and genuinely multilingual, so
embeddings are solvable. For *translation* specifically we need per-language licence checks — that
list does not exist yet and should be built before we make any regional-language claim.

---

## 7. Educational product catalogue

Every one of these is a configuration or integration, not new software.

| # | Product | Mechanism | Dependency |
|---|---|---|---|
| 1 | **Regional-language textbook tutor** | rag-api + multilingual embeddings + local model | Indic coverage (§6) |
| 2 | **Exam practice from their own papers** | Upload past papers → RAG → generate Q&A, mark against source | None — fully buildable now |
| 3 | **Socratic tutor** | System-prompt contract + turn counter in agent state | ~1 day as a preset |
| 4 | **Cited answers** | RAG hit returns page reference; answer cites it | None |
| 5 | **Parent digest** | Scheduled job, local model, regional language, bound to Family plan | Indic TTS/STT |
| 6 | **Math practice** | Step-by-step agent; render working to an artifact | None |
| 7 | **Physics lab** | Text-to-image for diagrams, local; 18+ only per your rule | Image pipeline |
| 8 | **Coding trainer** | Code interpreter on the Code API; artifacts render output | Code API (Apache-2.0) |
| 9 | **Lecture capture** | Upload recording transcript → RAG → revision sets | STT |
| 10 | **Vocabulary drill** | Spaced repetition over their own PDFs | RAG |

### Whiteboard

**Not present natively.** `AgentCapabilities.artifacts` exists and renders **code, HTML and SVG** —
so a student's generated chart or simulation displays. That is closer to a whiteboard than a text
box, but it is not freehand drawing.

If a real canvas matters, it is an **artifact with a canvas component** — a contained piece of work
that renders inside the existing artifact surface. Worth doing only if a school asks for it.

### Restricted for minors — per your rule

**Image generation: 18+ accounts only.** Under-18 accounts receive text-to-text and
speech-to-speech, both of which run locally with no image generation anywhere in the path. This
also keeps us clear of the POCSO image provision flagged in `CHILDREN-SAFETY.md` §1.1.

---

## 8. Per-account RAG — how to sell and limit it

| Tier | RAG space | Limit |
|---|---|---|
| Standard | Personal | 25 documents |
| Pro | Personal + 1 shared | 100 documents, shared space |
| Family | Personal + family shared | 150 documents, shared space |
| Enterprise | Shared spaces + cohort spaces | Quoted |

Documents are scoped by `userId` inside the JWT (`packages/api/src/files/rag.ts`). Limits are
enforced at rag-api by namespace document count and query budget.

**The pitch line:** *"Every account gets its own space. Your child's textbook space is scoped so
the school cannot read it and no other student can either."* Verifiable, and no free tool offers it.