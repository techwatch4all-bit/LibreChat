# Sales Objections & Offerings — Satchida AI Harness

How to answer the objections that will actually be raised, and the mechanism behind each
offering. A use case with no solution is a wish; this document pairs each with what we build.

Related: `CLIENT-PROPOSAL.md` (client-facing), `MODEL-CATALOG.md` (**internal only**),
`PRIVACY.md` §4 (claims ledger).

---

## Part A — Objections

### A1. "Why not just install Ollama / LM Studio / llama.cpp ourselves? It's free."

**This is your strongest objection, and the honest answer is that they are right.** Do not
pretend otherwise — a client who installs upstream software and discovers the maintenance burden
will blame you for overselling.

**Say this:**

> "Yes, you can, and if you have someone comfortable with model tuning, you should. This software
> is genuinely free and good. We are not selling you the software."

Then redirect to what actually breaks:

| What breaks | How it feels to them |
|---|---|
| **Nobody maintains it.** Upstream ships monthly; there are security patches and breaking changes | A resident reports it stopped working on a Tuesday evening |
| **Nobody is accountable.** If a user gets a wrong answer about society rules, who answers? | The committee has to explain it |
| **Nobody monitors it.** Model drift, driver updates, a quantisation that quietly degrades output | Silently worse answers, discovered only by complaint |
| **Nothing is committed in writing.** No privacy guarantee, no SLA, no remedy | A resident asks "where does my data go?" and nobody has an answer |
| **No multi-user safety.** Defaults are permissive | Anyone can register, anyone can see another's history |

**The line that closes it:**

> "You are not buying access to a model. You are buying the answer to 'what happens when it breaks,
> and who is accountable?' The model is free. Accountability is the product."

**The offer that makes it credible:** extend `CLIENT-PROPOSAL.md` §11 into a standing challenge —
> *"We install it free. If your own team keeps it running satisfactorily for twelve months, you
> never pay us a rupee."*

Nobody makes that offer unless they believe in the product. It converts because something *will*
need attention, and they will remember who answered.

### A2. "I want to know exactly which model you're using. I can't trust AI quality without that."

**Refuse the name, and give something better than the name.**

Why the name is refused — all three reasons are true, and only the first is policy:

1. **Contractual.** Naming the provider edges toward being a competing product of that provider,
   which the provider's terms restrict. (See `Satchida_Legal.md` §2.2.)
2. **It becomes the product.** The routing changes as costs and quality move. A model named in a
   contract is a model you are locked into.
3. **Users compare names, not answers.** A lesser-known model name reads as inferior regardless
   of output quality.

**What to offer instead — this is the real answer:**

> "We will not publish model names, for the reason above. What we will give you is *evidence*.
> Every month we publish, for your platform, measured quality on the tasks your residents actually
> do — your languages, your documents, your questions — with the model withheld. If quality drops
> below the level you bought, you leave without penalty."

Concretely, build:
- **A monthly quality report** per client: benchmark score on their domain, latency, uptime,
  cost per active user.
- **A named quality commitment** in the contract, with a remedy.
- **Admin-level visibility** — the client's administrator can see which route served a conversation,
  so an SLA is operable. End users never can.

A name is a brand. A benchmark on their own use case is evidence. Evidence is what they actually
said they wanted.

### A3. "Give us Claude at that price."

Do not argue about whether Claude is better. Answer with arithmetic, then solve it:

> "Claude is excellent and we can give it to you. Here is the honest number: at your typical usage
> it costs about ₹320 per user per month, against a ₹499 subscription. That works at our Standard
> tier with Claude Sonnet. Claude Opus costs roughly five times that and does not fit the price."

Then offer the clean route:

> "Or bring your own Anthropic key. You contract with them directly, at their price, on your
> terms — and we wire it in. You get Claude, and we never name it, sell it, or mark it up."

**That is the elegant part:** BYOK sidesteps the naming issue entirely, because the customer
contracts with the provider directly. You stop being the party offering Claude and become the
system that connects their key to their conversations.

BYOK is an entitlement on Pro, Family and Enterprise. Offer it as the answer to any
"give me a frontier model" objection.

### A4. "Cheap models will give cheap answers."

Turn it into evidence and a guarantee (see A2). Also be candid about one real limitation:

> "Some questions will be harder than others. Our routing sends the harder ones to a stronger
> route automatically — you do not choose, and you do not pay extra for it. And if it gets a hard
> question wrong, that is when the benchmark matters."

### A5. "Their data on our server? What if it leaks?"

Answer with the architecture, not the promise:

- Conversations are on their hardware, in their database, on their connection
- We never receive them
- Court orders reach **them**, not us (BNSS s.94 — `Satchida_Legal.md` §2.4)
- They may inspect the database at any time — it is their box

Then give them the test: *"Take a full disk image of the server and search it. You will find no
user conversations, because none were ever there."*

That is checkable, which is worth more than any policy document.

### A6. "Why not just get our own OpenRouter / cloud API key and plug it into a free chat UI?"

Use the **November 2026 OpenRouter / GMI Cloud breach** as concrete, indisputable proof of why DIY cloud accounts + API keys are a security and privacy nightmare:

- **The silent sub-processor trap**: When you plug an aggregator or cloud API key into a free UI, your prompts are silently routed to third-party inference hosts you never vetted. Between **October 18 and November 18, 2026**, an attacker used two compromised credentials to access an internal troubleshooting system at **GMI Cloud** (an OpenRouter provider) that retained ~3 days of raw prompt content.
- **Active credential harvesting**: The attacker searched those prompt logs for secrets. In a security researcher's canary test, **AWS test keys placed in prompts on Oct 21, 22, 27, and 28 were actively harvested and used to make live AWS calls** (attempting to create new IAM users and access keys).
- **30-day delayed discovery**: Endpoints were only disabled on November 20, leaving customers scrambling a month later to rotate every key, password, token, and signed URL that appeared in any prompt.

Then contrast with Satchida's architecture:

1. **Zero-Knowledge Relay (Cloud Modes)**: No master API keys ever exist on client machines, and every cloud request is stripped of tenant identity, account, and origin before reaching an upstream provider.
2. **Air-Gapped Privacy Mode (Track B)**: Sensitive code, `.env` files, credentials, and client files run **100% locally on your own GPU** with ephemeral in-memory sessions—zero downstream providers, zero troubleshooting logs, ₹0 cloud egress.
3. **Physical Tenant Isolation**: Your database and LanceDB Knowledge Vault live strictly inside your own isolated deployment—never commingled on a third-party cloud.

---

## Part B — Offerings, with the mechanism

Each of these is a **configuration or integration**, not a new product. Budget accordingly.

### B1. Regional language tutoring

**Not competing with tutors — filling the gap between sessions.** A tutor teaches; this is where
a student practises between classes.

| Element | Mechanism | Licence |
|---|---|---|
| Answer in the learner's language | Route to a multilingual model | MIT (BGE-M3, multilingual-e5 for embeddings) |
| Knows *their* textbook | **rag-api + the school's own PDFs** | MIT |
| Explains in the mother tongue, answers in the taught language | Two-pass prompt template | — |

**The solution to "we can't compete with tutors":** don't. Position it as *their* homework tool.
A tutor gets a better-informed student; the school gets fewer repetitive doubts.

**⚠️ Licence trap:** many Indic translation models are **non-commercial** — Meta's NLLB-200 is
**CC-BY-NC**, which forbids commercial use outright. This must be verified for every language model
before it is used in a paid product. Treat any NC-licensed model as disqualified for the paid tier.

### B2. Board exam prep (CBSE / ICSE / State)

**You identified the real risk correctly: a maintained syllabus database is a maintenance trap and
an accuracy trap. So we do not build one.**

**The solution: the school maintains its own corpus, not us.**

1. The school uploads its syllabus, textbooks and past papers → `rag-api` (MIT)
2. Answers are grounded **in their material**, not in model memory
3. **Every answer cites the textbook page it came from** — students can verify, and you cannot be
   accused of hallucinating a syllabus

This solves the accuracy problem and the maintenance problem in one move: **the client updates
the corpus, not us.** When the board changes the syllabus, they replace a folder.

Add: previous-year paper practice generated from their own papers, and a revision list.

### B3. Socratic tutor

**This is a prompt and a preset, not a product.** Roughly a day of work.

- A system prompt contract: never state the final answer; ask the next question; if the student
  is stuck for three turns, offer a worked hint
- Difficulty levels as separate presets
- A turn counter in the agent state to detect "stuck"

LiveChat-style behaviour emerges from a well-written system prompt plus a small state machine.
Ship it as a named agent the school enables.

### B4. Parent summaries in the regional language

**Mechanism:** a scheduled job on the client's hardware.

1. Weekly, summarise what the child asked and which topics were covered
2. Generate **in the parent's language, on the local model** — no cloud, no egress
3. Deliver into the parent's app (or a weekly PDF/WhatsApp summary the school chooses)

Runs entirely on their box. Nothing leaves. For parents who do not read English, this is the single
most valued feature in the product, and it costs us nothing to deliver.

---

## Part C — Further value we can add (all MIT / Apache)

| Capability | Software | Licence | Who it serves |
|---|---|---|---|
| **Voice input/output** | Whisper (STT); server-side TTS via our gateway | MIT | Senior citizens, low-literacy users |
| **Indic-language speech** | ⚠️ verify each model — several are NC-licensed | varies | The largest genuine gap in India |
| **Document parsing** | Docling, Marker | MIT / Apache | Bills, forms, certificates |
| **OCR** | PaddleOCR, Tesseract | Apache | Scanned documents, ID-less workflows |
| **Multilingual embeddings** | BGE-M3, multilingual-e5 | MIT | Required for regional language RAG |
| **Private retrieval** | rag-api | MIT | Schools, societies with their own documents |
| **Accessible UI** | our own work | — | Senior citizens, visually impaired |
| **Report cards / certificates** | docxtemplater, LibreOffice headless | MIT | Schools |
| **Offline operation** | local model | — | Weak-internet locations |

### The two genuine opportunities

1. **Voice in Indic languages.** Whisper covers several Indic languages at MIT cost. Everything
   else in this market is English-first. For a society or a school with non-English parents, this
   is the feature that converts them.

2. **Accessible, private, offline AI for seniors.** Large text, voice-first, works without
   internet, nothing leaves their building. No free product does this well, and it is a
   respectable room in a country where most seniors own a smartphone and no other AI works.

---

## Part D — What we must never say

From `PRIVACY.md` §4. Enforce in every conversation:

| Never | Because |
|---|---|
| "This is Claude/GPT/DeepSeek" | Contractual, and it makes the model the product |
| "You are anonymous" | We hold the account and payment record |
| "Nothing is ever retained" | Payment records are retained; some providers log for 30 days |
| "Your data never leaves your device" | False in Chat and Work modes |
| "We never see your conversations" | **True — but only in Privacy mode.** In cloud modes prompts transit us |
| "100% private" / "unhackable" | Over-claims, and actionable under the Consumer Protection Act |

**The one that catches people:** promising "we never see your conversations" without the Privacy
mode qualifier. It is true of the on-premise architecture for *stored* conversations, and false for
*live* cloud-routed prompts. Say the qualified version or say nothing.