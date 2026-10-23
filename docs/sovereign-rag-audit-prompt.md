# Audit + Build Prompt — Sovereign RAG Platform

> Copy everything below this line into the other AI session.

```
You are auditing and hardening a RAG platform at:
  D:\LAN-AI-Infra\sovereign-rag-platform

It is a Python monorepo: uv + hatchling, FastAPI gateway (apps/gateway), Next.js UI
(apps/web-ui), and packages/{core,retrieval,ingestion,connectors,governance,gateway-sdk,
mcp-server,eval,langchain,langgraph}. Native Windows. Docker is out of scope.
Ollama runs on http://127.0.0.1:11434 with `all-minilm:l6-v2` installed.

A PRE-AUDIT HAS ALREADY BEEN RUN. Treat these as leads to CONFIRM, not as settled fact.
Confirm each one yourself before acting, and correct it if the code disagrees.

====================================================================
FINDING 1 (CRITICAL) — OCR silently returns fake results
====================================================================
packages/ingestion/src/sovereign_ingestion/ocr_processor.py:
  line ~42:  return self._fallback_text(f"OCR unavailable: {file_path}")
  line ~69:  return self._fallback_text(f"PDF parsing failed: {file_path}")
  line ~74:  same, on exception.

`_HAS_DOCTR` is False because `doctr` is NOT in the venv. So EVERY OCR call returns the
literal string "OCR unavailable: <path>", which is then chunked, embedded and stored in
Qdrant. A search will "retrieve" a fake result shaped exactly like real data.

REQUIRED:
  a) Confirm this by reading the code and by RUNNING process_image() on a real image.
  b) Replace every fake-fallback path with an EXPLICIT, LOUD failure:
       raise OCRUnavailable(...) / OCRFailed(...)
     Never return placeholder text that can be indexed. A caller must be able to distinguish
     "no OCR" from "OCR ran and found nothing". If a caller genuinely needs a degraded path,
     it must be opt-in, explicitly named, and the chunks must be marked `degraded=True` with
     the reason, so they can be excluded from search by default.
  c) grep the ENTIRE repo for this anti-pattern, not just OCR. Any place that returns a
     human-readable string in place of a real result is the same defect. Report every hit.
  d) Then install a real OCR engine and make it actually run (see CAPABILITY 1).

====================================================================
FINDING 2 (CRITICAL) — no vector isolation; searches return every user's data
====================================================================
packages/retrieval/src/sovereign_retrieval/engine.py:
  - The Qdrant PointStruct payload contains ONLY: document_id, chunk_id, chunk_index,
    content, content_type, token_count, metadata. There is NO user_id and NO tenant_id.
  - `retrieve()` calls query_points(...) / search(...) with NO `models.Filter` at all.

The pydantic models DO carry `tenant_id: str = "default"` and `user_id: str = ""` — so the
DATA MODEL supports tenancy, but the STORAGE LAYER discards it.

Consequence: with two users ingesting anything, a search returns both users' chunks.

REQUIRED:
  a) Confirm by ingesting two documents tagged with different user/tenant ids and showing
     that a scoped query returns both. Paste the real output.
  b) Fix: persist user_id and tenant_id in the Qdrant payload, and make EVERY read path
     require a filter on them. A retrieval service that can return another user's rows is a
     data breach, not a bug — treat it as the highest-priority defect in this task.
  c) `retrieve()` must FAIL CLOSED: if no tenant/user scope is supplied, raise. Do not
     default to "unscoped" or to tenant_id="default".
  d) Add a test that proves isolation: user A's query never returns user B's chunks.
  e) ALSO audit the OTHER stores. Note `llama_index_embeddings_openai` is present in the
     venv — determine whether any embedding or query path currently calls OpenAI. If it
     does, that is a data-egress finding: state exactly what leaves the machine and when.
     The product is positioned as fully offline/sovereign.

====================================================================
FINDING 3 — the platform is NOT LibreChat-compatible today
====================================================================
LibreChat's RAG client expects exactly this wire contract:
  GET    /health
  POST   /text        multipart: file_id, file   -> MUST return a `text` field
  POST   /query       {file_id, query, k}        -> MUST return
                    [[{page_content, metadata:{source,page}}, score], ...]
  DELETE /documents
The bare array-of-tuples shape is not a convenience wrapper; a `{results:[...]}` envelope
silently yields zero hits.

`apps/gateway/src/sovereign_gateway/routes/graph_rag_api.py` is a DIFFERENT, GraphRAG-specific
API. There is no /text and no rag-api-compatible /query.

REQUIRED: build a compatibility adapter exposing the four endpoints above, backed by the real
retrieval engine. Requirements:
  - `text` field present and non-empty, or a clear 4xx/5xx — never a silent fallback string
  - /query returns the bare tuple array, respecting user/tenant scope from Finding 2
  - /health reports real state, including whether OCR and embeddings are actually working
  - DELETE /documents must delete only the caller's own documents

====================================================================
FINDING 4 — multi-tenancy is designed but unenforced; governance is empty
====================================================================
  - packages/governance/src/sovereign_governance/__init__.py is ONE LINE. That package is empty.
  - apps/gateway api_keys table: id, name, key_hash, masked_key, created_at. No user or
    tenant binding. API keys are enforced in middleware, so an API key identifies NOTHING
    about whose data it may reach.
  - tenant_id defaults to the literal "default" throughout the models.

REQUIRED — answer this question explicitly and then implement it:
  "Should each client be one full isolated RAG deployment, or one deployment serving many
  logically-isolated tenants?"
  Recommend one, with the trade-off (isolation strength vs operational cost of N deployments),
  then IMPLEMENT tenant scoping end to end: key→tenant binding, ingestion scope, retrieval
  scope, admin visibility, and per-tenant quotas. Populate packages/governance.

====================================================================
FINDING 5 — no image embedding anywhere
====================================================================
packages/ingestion/src/sovereign_ingestion/image_extractor.py extracts embedded images from
PDF/DOCX and writes them content-addressed under data/images/<sha256>.<ext>, returning
descriptors carrying the stored PATH. That is extraction, not representation: nothing encodes
an image to a vector, so "find a diagram like this one" cannot work.

====================================================================
CAPABILITIES TO VERIFY, THEN BUILD IF MISSING
====================================================================
For EACH: run it. Paste real output. "The module exists" is not evidence. A stub, a TODO, an
import that never executes, or a placeholder return is NOT working.

--- CAPABILITY 1: OCR for text inside images (axis labels, legends, printed numbers) ---
VERIFIED LICENSED, do not re-research:
  PaddlePaddle/PaddleOCR — Apache-2.0 code AND PP-FormulaNet_plus-L/_S weights verified
  Apache-2.0 on HuggingFace, not gated. Native Windows CPU and GPU wheels.
PASS: printed labels/numbers returned correctly WITH positional data (bounding boxes or at
least reading order). Flat text with no positions is PARTIAL — chart extraction needs boxes.

--- CAPABILITY 2: chart image -> structured data table ---
VERIFIED LICENSED:
  google-research/pix2struct (Apache-2.0) + google/deplot weights on HuggingFace
  (Apache-2.0, not gated). NOTE: there is NO standalone google-research/deplot REPO — the
  model is HuggingFace-only. Don't waste time hunting for the repo.
PASS: run on a chart with KNOWN values. REPORT ACCURACY AS A NUMBER (point accuracy %, max
cell error). A qualitative "looks right" is not acceptable.

--- CAPABILITY 3: image embeddings (visual similarity search) ---
Candidates — verify the licence YOURSELF by reading the LICENSE / HF licence field:
  openai/clip-vit-base-patch32 (repo openai/CLIP)
  google/siglip-base-patch16-224 (SigLIP family)
Pick whichever is permissive AND runs on Windows. Report the exact licence and how you verified it.
MUST be a SEPARATE vector space from text embeddings, stored in a SEPARATE collection with
its own dimension. Do NOT fake it by describing the image with a VLM and embedding the text —
that is Capability 1 and it loses visual detail.
PASS: embed N visually distinct images, query with each, correct one ranks #1 every time.
Report correct-vs-incorrect similarity scores.

--- CAPABILITY 4: extracted tabular / time-series store  (HIGHEST VALUE) ---
GOAL: once chart VALUES are extracted (Capability 2), persist them as QUERYABLE STRUCTURED
DATA supporting arithmetic, time ordering, aggregation and window functions — then compute
indicators over it.

WHY THIS MATTERS MOST: vector/cosine search cannot answer numeric questions. It has no
arithmetic and no notion of time. "Show me the 20-year trend with all key indicators" must be
answered by a numeric query over stored rows and then narrated. Retrieving a
similar-looking DESCRIPTION of a chart is a category error, not a slower answer.

REQUIRED:
  - A relational/time-series table alongside the vector store, e.g.
      candles(tenant_id, user_id, symbol, ts, open, high, low, close, volume)
    It lives inside the SAME database as the vectors where possible. Migrating existing
    vector data must not require a rebuild.
  - Support: date-range filters, ORDER BY ts, min/max/avg/sum, moving averages
    (OVER (ORDER BY ts ROWS BETWEEN N PRECEDING AND CURRENT ROW)), pct change, max drawdown.
  - Indicator computation over stored rows: SMA/EMA, RSI, MACD, volatility, drawdown.
  - PROVENANCE + CONFIDENCE on every row: source document/image id, per-cell extraction
    confidence, timestamp. OCR/DePlot values are ESTIMATES and a caller must be able to see
    that. A caller must be able to suppress low-confidence cells.
  - Note packages/retrieval/src/sovereign_retrieval/temporal_queries.py exists — audit it and
    build on it or replace it; do not leave two overlapping implementations.

====================================================================
LICENSING — ensure the platform is safe to sell commercially
====================================================================
The repo is PROPRIETARY / ALL RIGHTS RESERVED. That is appropriate for a commercial product and
requires no change. You must verify the LAYER BENEATH it.

  a) Every runtime dependency: record name + version + licence, from package metadata (not
     README claims). Flag anything non-permissive (AGPL, GPL, SSPL, BSL, "Other", NOASSERTION,
     or unparseable). An unknown licence is all-rights-reserved by default.
  b) Every MODEL WEIGHT that will be downloaded and shipped, and how you verified its licence
     on HuggingFace. This is the trap that has already been hit in a sibling project:
       datalab-to/marker   — code Apache-2.0, WEIGHTS revenue-capped (free only under $5M)
       datalab-to/surya    — same weights restriction
       facebookresearch/nougat — code MIT, WEIGHTS CC-BY-NC  (not commercial)
       opendatalab/MinerU  — Apache-2.0 PLUS auto-termination terms above revenue thresholds
       allenai/olmocr      — Apache-2.0 but Linux/WSL-only, ~8GB VRAM
     A green GitHub badge covers CODE and frequently not WEIGHTS.
  c) Bundled binaries/vendor: bin/neo4j-community-5.26.5/ is GPLv3. Confirm it is never linked
     into proprietary code and only ever run as an unmodified separate service. Say so
     explicitly with the evidence you checked.
  d) mcp-servers/ contains vendored third-party repos (APIFold, context7, deepseek-mcp-server,
     etc.). List each with its licence and confirm the file it was copied from.
  e) backup/docs contains "LICENSE.MIT-before-proprietary-20261005.txt", i.e. the repo was MIT
     and was relicensed on 2026-10-05. Confirm from git history that the relicensing was valid
     (sole authorship, or written contributor consent). Flag it if you cannot establish that.
  f) Produce a THIRD-PARTY-NOTICES.md listing every dependency, model weight and vendored
     component with its licence and attribution requirement.

====================================================================
DELIVERABLES
====================================================================
1. CONFIRMATION TABLE for Findings 1-5 and Capabilities 1-4:
   | Item | Confirmed? | Evidence (command + real output) | Verdict |
   Verdict ∈ {EXISTS (proven), PARTIAL (name the exact gap), ABSENT, UNVERIFIED (reason)}.
   "UNVERIFIED: model card gated, no HF credentials" is acceptable. A fabricated PASS is not.

2. For every PARTIAL/ABSENT item: FIX IT, then re-run the same test and paste post-fix output
   BESIDE the pre-fix output so the change is auditable.

3. For each of the four original capabilities, a RUNNABLE test command + where models are cached.

4. THIRD-PARTY-NOTICES.md (see 4f).

5. A one-paragraph answer to the multi-tenancy question (Finding 4) with the chosen model and
   what it costs.

WORKING RULES
  - Verify cheaply first (read code, run existing tests), then run for real.
  - Do NOT break existing behaviour. If a change risks it, STOP and report before changing.
  - Do NOT introduce a mock, stub, placeholder or silent-fallback anywhere. This codebase
    already has that defect in ocr_processor.py; do not add more.
  - Nothing destructive or irreversible without asking first. Back up before migrating schemas.
  - If something cannot be run (missing GPU, gated model, no network), report UNVERIFIED with
    the exact blocker. An honest blocker beats an invented result.
  - Write findings to AUDIT-IMAGE-CAPABILITIES.md in the repo and summarise here.
```
