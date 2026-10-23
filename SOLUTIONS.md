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