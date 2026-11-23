# Native Windows RAG Service — Design

A replacement for `rag-api` that runs natively on Windows, in the same language as the rest of
the product, with no Docker and no Python — while remaining **wire-compatible** with what
LibreChat already calls.

Related: `RAG-AND-OFFERINGS.md` (what we sell), `DEPLOYMENT.md` §6 (MongoDB rule),
`ARCHITECTURE.md`.

---

## 1. The contract LibreChat expects — extracted from this repository

Verified by reading the consumer side. **It is only four endpoints.**

| # | Method | Path | Request | Response |
|---|---|---|---|---|
| 1 | `GET` | `/health` | — | `200` with `statusText: 'OK'` |
| 2 | `POST` | `/text` | `multipart/form-data`: `file_id`, `file` (stream) | `{ text: string }` |
| 3 | `POST` | `/query` | JSON `{ file_id, query, k: 5, entity_id? }` | `[SearchHit, number][]` |
| 4 | `DELETE` | `/documents` | JSON `string[]` of `file_id`s | `200` / `404` |

**Auth:** `Authorization: Bearer <short-lived JWT>` on 2, 3 and 4. The token's **subject is the
userId** — `generateShortLivedToken(userId)` from `packages/api/src/crypto/jwt.ts`.

**Response shape for `/query`** (`packages/api/src/files/rag/search.ts:23`):

```ts
type SearchHit    = { page_content: string; metadata: { source: string; page?: number|string|null } };
type SearchResults = [SearchHit, number][];
```

`k` is hard-coded to **5** by LibreChat. `entity_id` is only sent for agent knowledge-base files
(`file.fromAgent === true`); **user attachments must stay user-scoped.**

### Two implementation notes that matter

- **`/text` has a 300-second timeout** (`files/text.ts`) and must return the extracted text —
  LibreChat stores that text on the document regardless of embedding outcome.
- **Markdown is deliberately bypassed** and parsed natively by LibreChat
  (`files/text.ts` — "using native parsing to preserve raw formatting"). Our service never sees
  `.md`.

### What this means

**Four endpoints and one response shape.** A compatible implementation is a small, well-bounded
service — not a research project. This is very buildable.

---

## 2. Recommendation: a TypeScript service, not a port of rag-api

### Options considered

| Option | Native Windows | Docker | Python | Verdict |
|---|---|---|---|---|
| **A. Run upstream `rag-api` natively** | ✅ (FastAPI) | — | **Required** | Compatible by definition, but every client needs a Python runtime. Poor fit for a locked-down society machine |
| **B. TypeScript service (recommended)** | ✅ | — | — | Same language as the product, ships as one installer, ~4 endpoints to implement |
| C. Qdrant binary + adapter | ✅ | — | — | Vector store is server-based; adds a process we do not need |

**Choose B.** The client's machine is a Windows desktop for one institution. Requiring Python,
uvicorn, and a virtual environment on it adds failure modes and a second supply chain for no
benefit.

---

## 3. Retrieval architecture — not a bare vector store

A bare dense-vector search **would** be obsolete. Modern retrieval is hybrid plus reranking.
Design accordingly.

### Layer by layer

| Layer | Technique | Why it is required |
|---|---|---|
| **Sparse retrieval** | BM25 via SQLite FTS5 (built into Node's SQLite) | Catches exact terms, names, numbers, formulae — where pure embeddings fail |
| **Dense retrieval** | LanceDB + BGE-M3 embeddings | Catches paraphrase and meaning |
| **Fusion** | Reciprocal Rank Fusion (RRF) | Combines both rankings without score calibration |
| **Reranking** | `BAAI/bge-reranker-v2-m3` cross-encoder | Reorders top-k by true relevance. Single largest quality win |
| **Citation metadata** | Page number + source on every chunk | **The differentiator — see below** |

**RRF** scores by `1/(k + rank)` across both result sets. It needs no score normalisation, which
matters because BM25 and cosine scores are not comparable.

### Why hybrid, not vector-only

School textbooks are full of exact strings — formulas, dates, chemical names, definitions,
proper nouns. Dense retrieval is weak on those and often returns topically-similar-but-wrong
chunks. **A client asking for "the definition of photosynthesis in Chapter 4" must get the exact
text, not a paraphrase.** That failure is visible and destroys trust immediately.

Hybrid retrieval fixes it. This is what production systems actually do.

### The reranker is the quality lever

`bge-reranker-v2-m3` (MIT) is a cross-encoder: it reads the query *and* each candidate chunk
together and scores true relevance. Retrieval returns 20–50 candidates; the reranker keeps the
best 5. It runs on CPU in seconds and typically moves answer quality more than any other single
change.

### The differentiator is citations, not the retrieval algorithm

> Every answer cites the textbook page it came from. The student can verify it. We cannot be
> accused of hallucinating a syllabus.

That is what no free tool does, and it is what `RAG-AND-OFFERINGS.md` §7 sells. **Retrieval
quality is table stakes; verifiable citations are the product.**

### What we are deliberately NOT building yet

**GraphRAG** (Microsoft) and similar knowledge-graph retrieval genuinely help on *relational*
questions — "how are these entities connected across the whole corpus." It is not in the first
release, for two concrete reasons:

1. **Cost.** GraphRAG runs an LLM pass at index time to extract entities and relations from every
   document, and again at query time for community summarisation. On a 16 GB card serving live
   users, that is prohibitive in latency.
2. **Query fit.** Our customers ask *locational* questions — "what does page 42 say", "give me
   practice questions on this chapter". GraphRAG is engineered for *global* sense-making over large
   heterogeneous corpora. Wrong tool for the job.

If a client later needs cross-document entity reasoning, the architecture above can absorb a graph
layer without rework, because the retrieval interface stays the same.

### The answer to "your RAG is obsolete"

> "Our retrieval is hybrid — BM25 plus dense vectors, fused by rank, then reranked by a
> cross-encoder. That is the same architecture used in production systems today. We do not use
> knowledge graphs because your questions are about page 42, not about relationships across a
> hundred-thousand-document corpus. And every answer cites the page it came from — ask our
> competitor to show you that."

Benchmark it before a client does. `RAG-AND-OFFERINGS.md` §7 item 6 is the harness.

---

## 3a. Vector store: LanceDB *and* Qdrant, behind one interface

Both are Apache-2.0 and both are legitimate. They suit different deployments.

| | LanceDB | Qdrant |
|---|---|---|
| Form | **Embedded library** — vectors are files in the client's data directory | Rust server binary, HTTP/gRPC |
| Processes on client machine | **None** | One to supervise |
| Best for | Single-tenant appliance, one machine | Multi-tenant or multi-server |
| Filtering | Supported | Excellent, heavily optimised |
| Licence | Apache-2.0 | Apache-2.0 |

**Both behind a `VectorStore` interface** with four methods (`upsert`, `query`, `delete`,
`count`). LanceDB ships as the default for client appliances; Qdrant is the swap if we ever go
multi-tenant or host for a client. The choice is a deployment config, not a rewrite.

Chroma is workable but is neither as embedded nor as production-hardened as these two.

---

## 3b. Language context — LangChain is not a vector database

Worth separating clearly, because the comparison is often made wrongly:

| Category | Examples | Role |
|---|---|---|
| **Vector database** | LanceDB, Qdrant, Chroma, pgvector | Stores and searches embeddings |
| **RAG framework / orchestration** | LangChain, LlamaIndex, Haystack | Chains, tools, retrievers, agents |
| **Graph RAG pattern** | GraphRAG, LightRAG | A retrieval *strategy* over a store |

LangChain **is not a competitor to LanceDB** — it is an orchestration layer, and this repository
already depends on it (`@langchain/langgraph`). We use it for chunking and agent graphs. What we
do *not* do is push the product's whole retrieval onto a framework that adds Python, a heavier
runtime, and little we need — our retrieval is four endpoints with a known contract.

**If a client names LangChain, the answer is: we already use LangChain for orchestration; our
vector store is LanceDB because it runs inside the client's own machine with no extra process.**

---

## 4. Per-account isolation — free from the contract

Because identity travels in the JWT rather than the body:

```
Client LibreChat ──► satchida-rag
                      │  1. verify JWT (same secret LibreChat uses)
                      │  2. extract userId from the token subject
                      │  3. namespace = f"{tenantId}:{userId}"
                      │  4. operate only within that namespace
```

**A user cannot address another user's documents**, because the namespace is derived from a
verified token, never from client input. `entity_id` is the only client-supplied scoping field
and LibreChat only sends it for agent knowledge-base files.

**Shared spaces** (a class, a cohort, a committee) use a namespace keyed by `entity_id` instead,
which is why LibreChat already sends that field for agent files.

**Limits** (document count, vector storage, queries per day) are enforced at this service by
namespace — no upstream changes needed.

---

## 5. Windows deployment

| Aspect | Approach |
|---|---|
| Process | NSSM-wrapped Node service, auto-start, same as the backend |
| Storage | LanceDB files inside the client's data directory |
| Model cache | ONNX weights under a client-local path; bundle at install or download once |
| Hardware | **CPU-only embeddings are acceptable.** BGE-M3 on CPU is seconds per chunk and needs no GPU |
| Offline | ✅ Fully functional with no internet — retrieval is local |

**Embedding on CPU is the key unlock**: it means the RAG space works even when the GPU is
serving a large model or generating images. No VRAM contention.

---

## 6. Feasibility and disk

I previously flagged 32 GB free as a blocker. **That was an overstatement and I withdraw it.**
I had conflated two different things: a full local-inference deployment (which needs several GB of
model weights) with a **RAG-only test**, which needs neither a GPU nor an LLM.

Realistic requirement for a RAG test:

| Item | Size |
|---|---|
| `node_modules` (3,159 packages) | ~2–3 GB |
| MongoDB test data | < 500 MB |
| Embedding model (ONNX, ~500 MB–1.2 GB) | ~1 GB |
| **Total** | **~4–5 GB** |

**32 GB is sufficient.** The disk constraint is real for a *full* client appliance with local LLM
weights, but it is not a constraint for validating RAG.

---

## 7. What a real end-to-end test would prove

1. Attach a PDF → LibreChat calls `POST /text` → text extracted, chunks stored in LanceDB
2. Ask a question → LibreChat calls `POST /query` with the same `file_id` → 5 hits with
   `page_content` and `metadata.page`
3. **Citations resolve to real page numbers** — this is the differentiator in
   `RAG-AND-OFFERINGS.md` §7 item 4, and it needs proving before we sell it
4. Delete the file → `DELETE /documents` → embeddings removed
5. Cross-user attempt → **rejected**, because the namespace comes from a verified token
6. Multilingual: an Indic-language PDF retrieves correctly with BGE-M3

**Steps 3 and 5 are the two that would embarrass us if wrong.** They are also the two that prove
the product claims, so they are what the test should prioritise.

---

## 8. Build order

1. `GET /health` and the JWT verifier — proves the contract and the auth boundary
2. `POST /text` with `pdfjs-dist` + `mammoth` — already-installed parsers
3. LanceDB store, namespaced by `userId`
4. `POST /query` returning the exact `SearchResults` shape
5. Embeddings via transformers.js + BGE-M3
6. `DELETE /documents`
7. End-to-end against a real LibreChat instance

Steps 1–2 need no model download at all, so the contract can be validated on the first day.