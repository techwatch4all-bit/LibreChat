# Satchida AI Platform — Client Proposal

**Prepared for:** Residential Welfare Associations, Small & Medium Businesses, Schools, and Institutions
**Prepared by:** Satchida · Privacy-first AI infrastructure for organisations and their communities

---

## 1. The problem we solve

Your residents, employees, and students need access to modern AI tools. The problem is that every
widely available AI assistant comes with a trade-off your committee has already had to consider:

- **Your users' data goes to a third-party company.** Prompts, documents and personal information
  are transmitted to an external provider and retained under that provider's policies.
- **The provider knows exactly who your users are.** They hold the account, the email address and
  the full interaction history.
- **It is expensive and unpredictable**, and you have no control over it.
- **There is no audit.** You cannot tell your residents where their data went.

For a housing society, a school, or an SMB handling personal data of staff and customers, these
are not acceptable constraints.

---

## 2. What we propose

A **private AI platform installed on your own hardware, inside your own premises and network.**

Your organisation buys one server. The platform runs entirely on it. Conversations, documents and
user accounts stay on your infrastructure and on your internet connection. We supply the software,
the installation, the maintenance, and the updates — the same model by which you would engage any
managed service provider, and directly analogous to how you deploy CCTV.

**There is no per-user licence fee. There is one fixed annual service charge.**

---

## 3. What your users experience

Users sign in from any device — phone, tablet or laptop — over your network, using a browser or an
installable app. There is nothing to install on their device.

They choose how they want to work:

| Mode | For | Where it runs |
|---|---|---|
| **Chat** | Everyday questions, drafting, summaries | Your server, with optional cloud assist |
| **Work** | Difficult tasks needing the strongest available answer | Your server, with optional cloud assist |
| **Privacy** | Confidential material — personal, financial, legal, medical | **Your server only. Nothing leaves your premises.** |

Users never see which model answered, never see a provider name, and never need to configure
anything. They type and press enter.

**No user needs to create an account with any external AI provider.** Authentication happens on
your infrastructure.

---

## 4. What we commit to

These are commitments, not marketing. They are written into the service agreement.

1. **Your conversations are stored on hardware you own and operate. We do not access them.**
   Satchida holds a support administrator account on your instance so that we can resolve faults.
   That account is named in this agreement, every use of it is written to an access log, and that
   log is provided to you after each engagement. **In normal operation it is never used.**
2. **Your users' identity is never disclosed to any third-party AI provider.** No provider is
   told who your users are.
3. **Prompts are never used to train any model**, by us or by any provider we route to.
4. **We do not sell, share, or monetise your data** or that of your users. Ever.
5. **We do not advertise or display any AI provider or model name** to your users, and we do not
   sell your users' data to anyone.
6. **In privacy mode, your users' content is never delivered to any AI provider.** It is processed
   only on infrastructure you operate. Nothing is sent to an AI company for inference or training.
   *We should be clear: your users' browser traffic reaches your server through our network
   provider's edge, as any HTTPS traffic does. That provider proxies the connection but is
   never given a user's identity by us.*
7. **You can request deletion of any user or conversation** at any time, and we will action it
   within the agreed window.

### What we ask in return

Even in Privacy mode, users should not submit passwords, API keys, access tokens, bank or card
details, government identifiers, or medical records. A privacy-focused platform is not a channel for
confidential secrets, and the user guidance appears in the application itself. Users are
responsible for what they type — as they are with any system you operate.

---

## 5. Hardware requirements

### 5.1 Reference configuration

| Component | Minimum | Recommended |
|---|---|---|
| **Graphics card (GPU)** | NVIDIA GeForce RTX 4060 Ti 16 GB | NVIDIA RTX 5090 32 GB, or RTX 6000 Ada |
| **Processor (CPU)** | AMD Ryzen 5 7500F / 7600 (6-core) | AMD Ryzen 7 7700 / Intel Core i5-14600K |
| **Motherboard** | MSI PRO B650M-A WIFI / ASRock B650M-HDV/M.2 | MSI MAG B650 TOMAHAWK / ASUS TUF B650 |
| **Memory (RAM)** | 32 GB (2 × 16 GB) DDR5-6000 | **64 GB (2 × 32 GB) DDR5-6000** |
| **Primary storage** | 1 TB NVMe PCIe 4.0 M.2 | 2 TB NVMe PCIe 4.0 M.2 |
| **Secondary storage** | — | 1 TB SATA SSD (models, backups, logs) |
| **Power supply (PSU)** | 650 W, 80+ Bronze | 750 W, 80+ Gold |
| **Cabinet** | Mid-tower ATX, 4+ fans | Mid-tower ATX, mesh front, 4+ fans |
| **CPU cooler** | DeepCool AG400 / Thermalright Assassin X 120 | DeepCool AG620 / Thermalright PA120 |
| **Operating system** | **Windows 11 Pro (licensed)** | Windows 11 Pro (licensed) |
| **Power backup** | 1 KVA online UPS | 2 KVA online UPS |
| **Network** | Wired Ethernet, 100 Mbps | Wired Ethernet, 1 Gbps |

**Indicative hardware cost: ₹1.9 – 2.6 lakh** (excluding Windows licence and installation).

### 5.2 Notes on this specification

- **16 GB of VRAM is the true constraint**, not CPU or storage. It determines how many users can
  be served at once and which models can run locally. 16 GB is a working minimum; 32 GB is
  materially better.
- **The GPU occupies three expansion slots.** The cabinet must be a mid-tower ATX, not a compact
  or SFF case.
- **Wired Ethernet is required. Wi-Fi is not acceptable** for a server. A society or school Wi-Fi
  will not hold a stable AI service for a full working day.
- **A UPS is not optional in India.** Power cuts during an inference request corrupt the database.
  Minimum 1 KVA online.
- **Storage endurance matters.** Conversation databases write continuously. Use a decent NVMe
  drive, not a budget one.
- **Windows 11 Pro must be licensed.** Home edition cannot run the platform correctly and cannot
  join a domain for administration.
- **Do not use a laptop or all-in-one.** Sustained GPU load requires desktop cooling and a
  dedicated GPU.

### 5.3 Capacity on the minimum configuration

| Configuration | Concurrent users | Notes |
|---|---|---|
| RTX 4060 Ti 16 GB | **~6 – 10** | Comfortable for a society in off-peak hours |
| RTX 5090 32 GB | **~15 – 25** | Recommended for schools and busy SMBs |
| RTX 6000 Ada 48 GB | **~30 – 50** | Enterprise tier |

This is simultaneous active conversations, not registered users. A society with 300 flats will
comfortably serve its residents on the minimum configuration, because residents do not all chat at
the same moment. Where peak demand exceeds the figure, requests queue briefly rather than failing.

### 5.4 Important: this platform does not run on this hardware out of the box

The high-performance serving engine used in data centres is not available on Windows. The platform
therefore uses a **different, equally capable inference engine purpose-built for Windows desktop
hardware**, which we install and tune as part of the deployment.

Practically: it runs on your machine, with your hardware, to a quality standard your users will
find indistinguishable. The difference is invisible to your users and irrelevant to your
operations. We mention it only so you are not misled by third-party benchmarks.

---

## 6. Division of responsibility

| You provide | We provide |
|---|---|
| The server hardware and Windows licence | The Satchida platform, licensed and configured |
| The premises, power, and internet connection | Installation, model tuning, and performance setup |
| A named administrator to receive updates | Maintenance, monitoring, and remote support |
| Local policy on who may register as a user | The user application for phone, tablet, and laptop |
| Backups of your own choice, if you want one | Security updates and platform updates |

---

## 7. Commercial terms

### 7.1 One-time charges

| Item | Charge |
|---|---|
| Installation, configuration and commissioning | **₹75,000** |
| User onboarding and administrator training | Included |

### 7.2 Recurring service charge (AMC) — fixed, not per user

| Platform size | Monthly | **Annual (preferred)** |
|---|---|---|
| Up to 100 active users | ₹12,000 | **₹1,20,000** |
| Up to 500 active users | ₹25,000 | **₹2,50,000** |
| Up to 1,000 active users | ₹50,000 | **₹5,00,000** |
| Unlimited (education / enterprise) | Quoted | Quoted |

**The charge is fixed and does not vary with how many of your users actually use the platform.**
There is no per-seat metering, no token billing, and no surprise invoices at month end.

### 7.3 What's included in the AMC

- Hosting equipment is yours; we maintain the software
- Remote monitoring and health reporting
- Security and platform updates
- Telephone and remote support during business hours
- One scheduled on-site visit per year
- Compliance documentation, privacy policy, and user guidance
- Restoration of service if a fault arises

### 7.4 End-user subscriptions

Detailed tier specifications and user plans are detailed in SALES-PROPOSAL-FLAGSHIP.md (flagship Pro, Pro Family, and Privacy tiers) and SALES-PROPOSAL-VALUE.md (Standard and Family value plans).

Your users may subscribe to additional Satchida services directly. **This is arranged entirely
between Satchida and the individual user.** Your organisation is not a reseller, is not involved
in those transactions, and receives no commission.

If you would prefer not to offer this at all, tell us and we will not enable it on your platform.

### 7.5 Payment terms

- Annual, paid in advance — preferred, and carries the discount above
- Monthly, paid in advance by standing instruction or UPI
- Services commence on payment. Hardware and OS licence are procured separately by you.

---

## 8. Implementation

| Phase | Duration | What happens |
|---|---|---|
| **1. Site survey** | 2–3 days | Power, network, location, rack/desk space |
| **2. Delivery & base setup** | 1 day | Server received, OS and network configured |
| **3. Platform install** | 1 day | Platform, database, and local model installed and tuned |
| **4. Integration & test** | 1 day | Cloud assist routed, privacy mode verified, load tested |
| **5. Handover & training** | 1 day | Administrator training, user registration, go-live |
| **Total** | **5–7 working days** | |

Go-live target: within two weeks of hardware arrival.

---

## 9. What this service is not

Stated plainly, because a proposal that oversells is worse than one that under-sells.

- **It is not a guarantee of anonymity from us.** We know who your paying users are — we must, in
  order to bill them and provide support. We do not use that knowledge to read your users'
  conversations, and in the on-premise architecture we do not receive them at all.
- **It is not a guarantee that no third party ever sees any content.** In Chat and Work modes,
  requests may be passed to external AI infrastructure so that users get the best available answer.
  **Privacy mode exists precisely for when that is not acceptable.**
- **Your users' traffic passes through a network provider's servers**, because your connection
  is behind carrier-grade NAT and cannot be reached directly. That provider proxies the
  connection and sees the network metadata of it. It is not given your users' identities by us,
  and it is not an AI provider. If your legal advisers require a data processing agreement with
  that network provider, you may run the tunnel from your own account instead — we will set it up
  for you at no extra charge.
- **It does not remove the user's responsibility** for what they type or upload.
- **It is not a substitute for your organisation's own policies** on what users may do with it.

---

## 10. Why not simply install a free open-source version?

Because it is only the software. It is not the service.

| | Free open-source install | Satchida as proposed |
|---|---|---|
| Installation and tuning | Your team, or a freelancer who may never have done it | Included |
| Which model runs, and how well | Unknown — you get whatever default ships | Tuned and load-tested for your hardware |
| Privacy commitments | **None.** No promises, nobody accountable | Written into the service agreement |
| Updates and security patches | Unmaintained, and nobody is watching | Included in the AMC |
| Something to call when it breaks | Nobody | A named party, with an SLA |
| Legal exposure if it leaks | Falls on you | Shared, with us accountable |

The free version is genuinely good software. On a committee member's laptop it will run. It will
also be unconfigured, unmonitored, and unsupported — and when a resident's data is exposed, there
is no one to call.

---

## 11. Next step

We propose a **no-obligation demonstration**. We install and configure a platform on a machine of
your choosing for a trial period. Your committee and a representative group of users try it under
real conditions. You decide afterwards.

There is no cost and no commitment to proceed.

---

**Satchida** · Privacy-first AI for organisations and the communities they serve

---

<!-- MERGED-DISTRIBUTED-PART -->
## Part II - Distributed Cloudflare-Tunnel edition (supersedes any VPN/Headscale/VPS wording above)

### Satchida Managed AI Platform — Client Solution Brief

On-premises, privacy-first AI assistant built for schools, colleges, and business enterprises in India.

---

## 1. What You Get

1. **Dedicated AI Workstation (In Your Office or Campus):**
   - Runs directly on your Windows 11 desktop computer.
   - 100% private: your student records, proprietary files, and confidential queries remain on your premises.
2. **Instant Multi-Device Access:**
   - Available to your staff and students at your dedicated link (e.g., `https://yourschool.yourdomain.com`).
   - Accessible from laptops, tablets, and mobile phones (via browser or 1-tap Progressive Web App).
   - Zero software or VPN installation required for end-users.
3. **Integrated Knowledge Search (RAG):**
   - Upload internal curriculum, school circulars, employee manuals, or reference textbooks.
   - Ask questions and get citations with exact page references.
4. **Autonomous Management:**
   - Administrator controls to manage user accounts, assign roles, and request additional seat or token quotas with one click.

---

# Part III — Finalised Technical Solutions & Decisions

> *Consolidated from SOLUTIONS.md.*

# Finalised Solutions — Satchida AI Harness

Consolidated record of decisions **reached and verified**, distinct from open questions in
`ISSUES.md` and risks in `VULNERABILITIES.md`. Where a decision replaced an earlier one, the
correction is shown rather than erased.

Last consolidated: 2026-10-04.

---

## A. Third-party repositories — what we use and why

| Repo | Decision | Basis |
|---|---|---|
| `LibreChat` | **Forked.** `origin` = our fork, `upstream` = LibreChat, work on long-lived `satchida` | Upstream updates stay possible; a bad merge is never live until a release |
| `rag-api` | **Replaced by our own service.** Upstream stays in compose for reference only | It's Python/Docker. We need native Windows with no second runtime |
| `code-interpreter` | **Deploy it** (Apache-2.0), tier-gated | No compose service upstream; Run Code is a paid-tier differentiator |
| `@librechat/agents` | **Already a dependency** `^4.0.1`. Never clone | It is an npm library, not a service |
| `quickbooks-online-mcp` | **Register as an MCP server**, Enterprise-only | MCP registration, not a code change |
| `admin-panel` | **Rejected** | AGPL-3.0 — §13 source disclosure on network use. LibreChat's own `packages/api/src/admin/*` serves the same APIs |
| `static-browser-server` | **Rejected** | Last pushed April 2025; zero source references in the tree |

**Verified:** neither LibreChat's native admin nor admin-panel has *any* awareness of balance,
credits, plan, subscription, payment, invoice, usage or quota. The reconciliation console must be
built regardless.

---

## B. Privacy architecture

### B1. Three independent properties — keep them distinct

| Property | How | Claim we may make |
|---|---|---|
| **Non-retention** | Contracted provider terms | ✅ per that provider's terms |
| **Unlinkability** | One shared key, mixed traffic, multi-provider distribution | ✅ "your identity is never disclosed to any model provider" |
| **Locality** | Local model on client hardware | ✅ "in Privacy mode, content never reaches any AI provider" |

**Never claim** "you are anonymous" — Satchida holds the account and payment record, so we are
always an identifiable party.

### B2. Transport layer is disclosed, not hidden

Cloudflare proxies every request and terminates TLS. The end user's IP and the plaintext request
are visible at the edge.

**Correct scope:** *no AI provider receives the prompt.* Byte transit through a CDN is the same
exposure every HTTPS site has. Do not overclaim, and do not underclaim either.

### B3. Data location

| Layer | Custodian |
|---|---|
| Conversations, documents, identity mapping | **The client**, on client hardware |
| Entitlement, payment record | Satchida — minimised to the bare minimum |

MongoDB **must** be client-operated — privacy (custodian), licensing (SSPL service clause), and
legal process (BNSS s.94 court orders reach the client, not us) all point the same way.

### B4. Pseudonymous provisioning — the strongest lever

**The client provisions accounts and sends us a pseudonymous identifier, never an email.** We then
hold no personal data about end users at all, which removes it from DPDP scope. This works under
both commercial models and is the single most valuable privacy decision we have made.

---

## C. Access and licensing

### C1. Social login authenticates; it never authorises

`ALLOW_SOCIAL_REGISTRATION=false` is the gate. Without it, **any Google account could complete
OAuth against a client subdomain and consume a seat.** Verified at
`api/server/routes/config.js:96`.

Two modes: RWA/SME use society-provisioned local accounts (`Student001`); schools use Google
Workspace OIDC with pre-provisioning.

### C2. Real enforcement is ours, not LibreChat's

`.env` is a plain file on client hardware — **not a security boundary** (`VULNERABILITIES.md` V2).
What holds: the gateway refuses inference without a valid Ed25519 licence token; seat and spend
caps live in our authorisation service. **Never market local settings as enforcement.**

### C3. Key custody

Provider API keys live **only** on our gateway. Clients never hold them — keys in a client `.env`
are readable by the client, and the loss would be unbounded and personal. The licence key does
**not** protect API keys; **per-client spend caps** are what bound the exposure.

---

## D. Infrastructure — verified decisions

| Decision | Resolution |
|---|---|
| **Transport** | Cloudflare Zero Trust Named Tunnels on `satchida.com`. Headscale/DERP rejected — rejected on cost ($0 vs ₹500–1,500/mo) and zero-install adoption |
| **Tunnel topology** | One tunnel per client, own token, own subdomain. `control` (metadata, Service Token) is a **separate** tunnel from `api` (router, carries content) |
| **Control plane** | **Outbound-only.** Clients poll us; nothing pushes inbound. This is why CGNAT is irrelevant to licensing |
| **Local model engine** | **llama.cpp server** (MIT, native Windows). vLLM does not run on Windows and is not being reconsidered |
| **Database** | MongoDB 8.3, client-operated. LibreChat is **MongoDB-only** — no PostgreSQL path |
| **Redis** | **Omitted.** No MIT/Apache Redis-compatible server has a native Windows build |
| **Install** | Native Windows, **no Docker**. NSSM services, dependency-ordered boot |
| **RAG service** | **8010.** Never 8000 |
| **Deployment** | Hybrid — shared multi-tenant for Community/Standard/Pro/Family; dedicated instance for Enterprise |

---

## E. RAG

### E1. Contract verified, milestone 2 live

Four endpoints: `GET /health`, `POST /text`, `POST /query`, `DELETE /documents`.
Auth: HS256 JWT, payload `{ id: userId }`, 5-minute expiry, verified against
`packages/api/src/crypto/jwt.ts`. **9/9 contract tests pass**, including `alg:none` rejection.

Extraction tested against real files from `D:\Indian ACT`:

| File | Pages | Chars | Time |
|---|---|---|---|
| Bharatiya Nyaya Sanhita 2023 | 112 | 394,247 | 1,003 ms |
| IT Act 2000 *(TOC only — see `ISSUES.md`)* | 36 | 124,031 | 223 ms |
| DPDP Rules 2025 | 41 | 119,190 | 814 ms |

### E2. Per-account isolation is structural

Namespace derives from the **verified JWT subject**, never request input. A user cannot address
another user's documents. Shared spaces key off `entity_id`.

### E3. Retrieval must be hybrid

BM25 (SQLite FTS5) + dense vectors + Reciprocal Rank Fusion + cross-encoder rerank
(`bge-reranker-v2-m3`). Pure vector search fails on exact terms — formulas, dates, definitions —
which is what students actually ask about. **GraphRAG deliberately not used:** expensive at index
time, and wrong for locational questions.

### E4. The differentiator is citations

Every answer cites the page it came from. Verifiable, and no free tool does it.

### E5. Page images survive document deletion

At ingest we keep **our own copy** of the source document in the RAG data directory. The browser
renders from that copy, so deleting the user's original does not break retrieval or rendering. This
fixes a flaw found in review.

---

## F. Commercial model

**B2C only.** Clients are never authorised to resell.

| Line | Payer | Basis | Depends on usage? |
|---|---|---|---|
| Client AMC | Organisation | Fixed by platform size | **No** |
| Customer subscription | Individual | Plan chosen by the customer | Yes |

**AMC is the floor; subscriptions are the upside.** If adoption disappoints we still recover the
AMC. Both models offered — see `BUSINESS-PROPOSAL.md`. Pricing in `PRICING.md`.

**Unit economics:** compute is effectively free. At 230 customers against ₹1,14,770 monthly
revenue, `deepseek-v4-flash` costs **₹308/month — 0.3%**. Frontier would cost ₹49,200 (43%).
**The business is distribution and support, not COGS.**

---

## G. Corrections made during this engagement

Recorded because a document that only contains conclusions we got right first time is not
evidence of diligence.

| # | Was | Now |
|---|---|---|
| 1 | DPDP Rules 2025 were "Hindi only, English not obtained" | The Gazette PDF is **bilingual — English from page 24**. Operator caught this |
| 2 | Small-enterprise exemption is DPDP Act **s.16** | It is **s.17**. s.16 is processing outside India |
| 3 | Rule 17 is an exemption | Rule 16 is research/archiving; **rule 17 is Data Protection Board appointment** |
| 4 | A reseller agreement is required for paid tiers | **Not required.** Anthropic §A.1 expressly permits powering products for your own end users |
| 5 | OpenRouter must not carry monetised traffic | Over-read. Their terms contemplate customers accessing Models via products you build |
| 6 | No stream resumption without Redis | **In-memory `IJobStoreV2` implements it.** Only cross-restart durability is lost |
| 7 | "No third party ever sees content" | False — Cloudflare proxies and terminates TLS |
| 8 | 32 GB disk insufficient for a RAG test | Over-stated; ~4–5 GB is enough. I conflated a RAG test with a full local-inference deployment |

---

## H. What we sell

| Offering | Basis | Status |
|---|---|---|
| Chat / Work / Privacy modes | Mode routing, no model names shown | Designed |
| Privacy mode | Local inference only, no AI provider receives content | Designed |
| RAG with page citations | Hybrid retrieval + rerank + citation | M1+M2 live |
| Indian Acts RAG | Pre-built, versioned, currency-dated | `INDIAN-ACTS-RAG.md` |
| Board exam prep | Client's own syllabus RAG — **client maintains the corpus, we don't** | Designed |
| Socratic tutor | Prompt contract + turn counter, ~1 day as an agent preset | Designed |
| Parent digest | Scheduled job on client hardware, regional language, Family plan | Designed |
| Speech to speech | Native STT/TTS via our gateway | Verified supported; **audio pricing not yet researched** |
| Image generation | Local, ~₹0.01/image, **18+ accounts only** | Designed, POCSO-gated |
| Voice in Indic languages | The genuine gap in India | Licence checks outstanding |

---

## I. Blocking sequence

1. **RAG m6** — wire `POST /text` into the live server
2. **RAG m3** — LanceDB + document retention (the PDF-deletion fix)
3. **Fleet control service** — outbound heartbeat, Ed25519 licence, seat caps, polling of tenant config
4. Brand assets from `Satchida-logo.png`
5. Cloudflare tunnel provisioning + Turnstile keys (`VULNERABILITIES.md` V9)
6. NSSM service install so services survive reboot
7. Form the LLP **before the first invoice** (`VULNERABILITIES.md` V20)

---

# Part IV — RAG & Educational Offerings

> *Consolidated from RAG-AND-OFFERINGS.md.*

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
