# Satchida MCP Manifest (shippable)

Shipping manifest for every MCP server wired into `librechat.yaml`, plus the
curated external catalog. **All Satchida MCP code lives inside this repo** under
`skill/` (292 files, git-tracked) — a client clone carries every custom server.
What ships *besides* the repo is documented under External runtimes and
Per-client path rewrites below.

## Contents

| File | What it is |
|---|---|
| `recommended-mcp.ts` | Curated opt-in catalog of verified external MCP servers (zero-auth preferred for sovereign nodes). Verbatim copy of the unified-suite constant with the `RecommendedMCPServer` type inlined. |
| `README.md` | This manifest. |

## Built-in servers (in-repo, stdio)

All `python` entries run `python <repo>/skill/<file>.py`. `startup: true`
servers spawn at boot; `false` spawn on first use.

| Server | Script | startup | Backs (persona / feature) |
|---|---|---|---|
| `satchida-web-search` | `skill/satchida-web-search-server.py` | true | Markets, Bullion, Citizen, Geopolitics, CVE — keyless DDG/Google News/Bing News/Yandex/Wikipedia + `fetch_page` |
| `satchida-stem-study` | `skill/stem-study-server.py` | true | Symbolic Math, Physics, CS Algorithms — SymPy/Matplotlib/chemistry |
| `satchida-work-suite` | `skill/work-productivity-server.py` | true | Equity, Edge Vision, Architecture, Database, Vibe UI — Pandas/Mermaid/diff |
| `satchida-panchang-vedic` | `skill/panchang-vedic-server.py` | true | Panchang, Festivals — computed Drik Panchang (never LLM-math) |
| `satchida-health-wellness` | `skill/health-wellness-server.py` | true | Pharma, DDx, Ayurveda, Yoga — nutrition/yoga/Ayurveda + contraindications |
| `satchida-maker-engineering` | `skill/maker-engineering-server.py` | true | Maker/hardware personas |
| `satchida-ai-engineer` | `skill/ai-engineer-server.py` | true | GPU Compute, AI Architecture sizing |
| `satchida-knowledge-vault` | `skill/anythingllm_mcp_server.py` | true | Vault RAG, Document Gen, E-Book — includes `deep_research_web_search`, `search_web_images`, `create_formatted_document` (needs AnythingLLM sidecar) |
| `deeptutor-integration` | `skill/deeptutor-mcp/dist/index.js` | true | DeepTutor — **`dist/` is not git-tracked; build required on every target** (`cd skill/deeptutor-mcp && npm ci && npm run build`); needs DeepTutor service on `:8001` |
| `legal-research` | `skill/legal-research-server.py` | false | Legal & Governance — **scope note: serves US eCFR/case law; Indian statutes (RBI/SC/Gazette) are covered by `satchida-web-search` — verify pairing in P1 matrix pass** |
| `academic-search` | `skill/academic-search-server.py` | false | Deep Research, Scholar — OpenAlex/CrossRef/PubMed |
| `accessibility-tools` | `skill/accessibility-server.py` | false | WCAG 2.2 starter — **description says WCAG 2.1 contrast; confirm version coverage in P1 pass** |
| `devops-security` | `skill/devops-security-server.py` | false | CVE, Code Security, GRC, Cyber Warfare — hashing/ports/.env leak audit |
| `clinical-research` | `skill/clinical-research-server.py` | false | PubMed/ClinicalTrials/FDA boxed warnings — **currently unbound by any of the 44 starters; candidate binding for Clinical DDx / Drug Safety (P1)** |

Notes:
- `skill/stem-math-server.py` exists but is not referenced by `librechat.yaml`
  (superseded by `stem-study-server.py`) — leave or delete consciously.
- Python runtime deps observed across servers: `mcp` (`mcp.server.mcpserver`)
  and `requests`; remainder is stdlib. Provisioning step:
  `pip install mcp requests` (re-check imports server-by-server).

## Packaged servers (downloaded on first spawn)

| Server | Launch | Package | startup | Requires |
|---|---|---|---|---|
| `time-server` | `uvx` | `mcp-server-time` (Asia/Kolkata) | true | `uv`/`uvx` on PATH + network (or pre-warmed cache) |
| `web-fetch` | `uvx` | `mcp-server-fetch` | false | " |
| `git-librechat` | `uvx` | `mcp-server-git --repository D:/LAN-AI-Infra/LibreChat` | false | " + path rewrite |
| `arxiv-search` | `uvx` | `arxiv-mcp-server` | false | " |
| `openfda-drugs` | `uvx` | `openfda-mcp` | false | " |
| `filesystem-shared` | `npx.cmd` | `@modelcontextprotocol/server-filesystem D:/LAN-AI-Infra/SharedDocs` | false | Node + path rewrite |
| `knowledge-graph-memory` | `npx.cmd` | `@modelcontextprotocol/server-memory` (`MEMORY_FILE_PATH=D:/LAN-AI-Infra/LibreChat/data/memory.json`) | false | Node + path rewrite |

First-run fetches hit PyPI/npm. For offline/CGNAT client nodes, pre-warm during
provisioning: `uvx mcp-server-time --help` and
`npx -y @modelcontextprotocol/server-memory --help` on the target machine.

## Per-client path rewrites (P2 todo: make portable)

`librechat.yaml` currently hardcodes this development machine's layout. Rewrite
every row during client provisioning — exact strings to search:

| `librechat.yaml` key | Current value | Client value |
|---|---|---|
| 10× python `args` | `D:\LAN-AI-Infra\LibreChat\skill\*.py` / `D:/LAN-AI-Infra/LibreChat/skill/*.py` | `<client-repo>/skill/*.py` |
| `git-librechat.args` | `D:/LAN-AI-Infra/LibreChat` | client repo path |
| `filesystem-shared.args` | `D:/LAN-AI-Infra/SharedDocs` | tenant shared-documents dir (outside repo) |
| `knowledge-graph-memory.env.MEMORY_FILE_PATH` | `D:/LAN-AI-Infra/LibreChat/data/memory.json` | `<client-repo>/data/memory.json` |
| `satchida-knowledge-vault.env.SATCHIDA_EXPORTS_DIR` | `D:\LAN-AI-Infra\AnythingLLM\server\storage\documents\generated` | tenant AnythingLLM exports dir |
| `satchida-knowledge-vault.env.ANYTHINGLLM_API_KEY` | **hardcoded literal** | replace with `${ANYTHINGLLM_API_KEY}` and **rotate the exposed key** (P1 todo) |

## External sidecars (not in this repo)

| Sidecar | Endpoint | Needed by | Provisioning |
|---|---|---|---|
| AnythingLLM | `127.0.0.1:3012` | `satchida-knowledge-vault` (RAG + document generation) | Separate install + workspace config |
| DeepTutor | `127.0.0.1:8001` | `deeptutor-integration` | Service running + `DEEPTUTOR_API_URL` |
| Bifrost gateway | `127.0.0.1:4000` | `Satchida-Gateway` endpoint | `X-Bifrost-Mode` routing |
| Satchida local endpoint | `127.0.0.1:4099` | Privacy/Study-Local modes | Local sovereign runtime |
| Wigolo (optional, unified-suite) | `127.0.0.1:3333` | external catalog entry only | `npx` install; AGPL — never bundled |

## Verification checklist (per target node)

1. `uvx --version`, `npx -v`, `python -c "import mcp, requests"` all succeed.
2. `skill/deeptutor-mcp/dist/index.js` exists (built).
3. Boot log shows the ten `startup: true` servers spawning without errors.
4. Sidecars above reachable (`curl -sf http://127.0.0.1:3012`, `:8001`).
5. Per-persona smoke test: click one starter per category, confirm the bound
   servers are selected and actually invoked (ties into the P2 QA-matrix todo).
6. No `D:/LAN-AI-Infra` string remains in the shipped `librechat.yaml`
   (grep after rewrite).
