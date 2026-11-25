# MASTER PRODUCTION PLAN — For the next AI agent
# Last updated: 2026-07-01

## STATUS: What was completed this session

### DONE
- Satchida rebrand script: scripts/rebrand-to-satchida.ps1 (CREATED + EXECUTED)
  - 88 locale files scanned, 32 modified across all 11 languages
  - JSON KEY names preserved (upstream merge safe)
  - Copyright headers preserved
- FastAPI route ordering bug fixed (/planner-advice shadowed by /{scan_id})
- HuggingFace model size 0.0 GB bug fixed (quantization heuristic)
- DuckDB backup permission error fixed (COPY TO PARQUET via open connection)
- Orphaned scan cleanup on startup (main.py lifespan hook)
- PROJECT_DOCS.md created: D:\LAN-AI-Infra\PROJECT_DOCS.md
- start-all.ps1 created: D:\LAN-AI-Infra\start-all.ps1

---

## PART A: SATCHIDA (Eigent) REMAINING WORK

### A1. MCP Multi-Fallback Web Search [TODO]

Architecture: cascade of providers, no user intervention, free-first then paid.

Provider cascade (in order):
  1. DuckDuckGo (npm: duck-duck-scrape, no key)
  2. SearXNG self-hosted (if SEARXNG_URL env var set)  
  3. SearXNG public instances (rotating list, no key)
  4. Bing HTML scrape (no key)
  5. Brave Search API (BRAVE_API_KEY if configured)
  6. Tavily (TAVILY_API_KEY if configured)
  7. Serper.dev (SERPER_API_KEY if configured)
  8. Google Custom Search (GOOGLE_CSE_KEY + GOOGLE_CSE_ID if configured)

Files to create:
  - electron/main/utils/webSearch.ts — multi-fallback engine
  - resources/default-mcp-servers.json — pre-seeded MCP catalog

IPC to add: ipcMain.handle("web-search", async (_, query, maxResults) => multiSearch(query, maxResults))

MCP servers to pre-seed (resources/default-mcp-servers.json):
  - filesystem: @modelcontextprotocol/server-filesystem (no key)
  - fetch: @modelcontextprotocol/server-fetch (no key)
  - memory: @modelcontextprotocol/server-memory (no key)
  - github: @modelcontextprotocol/server-github (GITHUB_TOKEN optional)
  - sqlite: @modelcontextprotocol/server-sqlite (no key)
  - brave-search: @modelcontextprotocol/server-brave-search (BRAVE_API_KEY optional)
  - searxng-local: searxng-mcp with SEARXNG_URL=http://localhost:8080 (no key)

Settings UI: Add fields for SEARXNG_URL, BRAVE_API_KEY, TAVILY_API_KEY in MCP & Tools settings page.

Seed logic in electron/main/index.ts: on app ready, if readMcpConfig() returns empty, load from resources/default-mcp-servers.json

### A2. Desktop Shortcuts [TODO]

Create these files:

D:\LAN-AI-Infra\launch-satchida-terminal.ps1:
  Sets pwd to eigent root, runs: npm run dev:electron
  Opens in terminal window so all logs visible

D:\LAN-AI-Infra\launch-autosecposm-terminal.ps1:  
  Starts backend job (python -m uvicorn app.main:app --host 0.0.0.0 --port 3015)
  Waits 5 seconds
  Opens browser to http://localhost:5174
  Starts frontend (npm run dev -- --host 0.0.0.0 --port 5174)

D:\LAN-AI-Infra\create-desktop-shortcuts.ps1:
  Uses WScript.Shell COM to create .lnk files on Desktop
  Both shortcuts: Target=powershell.exe, Args=-ExecutionPolicy Bypass -NoExit -File <launcher>
  Satchida icon: build\icon.ico

Run to create shortcuts: powershell -ExecutionPolicy Bypass -File D:\LAN-AI-Infra\create-desktop-shortcuts.ps1

### A3. LAN Browser Access Documentation [TODO]

Add to PROJECT_DOCS.md and README.md:

LAN Browser Access (no Electron, for LAN users):
  Host machine start web server:
    cd D:\LAN-AI-Infra\Satchida-AI-Interface\eigent
    npm run dev:web -- --host 0.0.0.0 --port 5173
  
  LAN users open: http://<HOST-IP>:5173
  
  Find host IP: (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*","Wi-Fi*").IPAddress
  
  Note: Browser mode does NOT support vibe coding (local folder access blocked by browser security).
        Use Electron desktop app for full vibe coding capability.

AutoSecPosM LAN access:
  Backend already binds 0.0.0.0, so accessible at http://<HOST-IP>:3015
  Frontend: npm run dev -- --host 0.0.0.0 --port 5174 -> http://<HOST-IP>:5174

### A4. Electron Installer / Portable Build [TODO]

For corporate machines without Node/npm:

Build commands:
  npm run build:win   # Creates release/Satchida.Setup.1.0.0.exe (NSIS installer)
  
For portable (no install, just extract and run):
  Edit electron-builder.json -> win.target: add {"target": "portable", "arch": ["x64"]}
  Then run: npm run build:win
  Output: release/Satchida-1.0.0-portable.exe

Windows Defender exclusion in build/installer.nsh:
  ExecShell "" "powershell.exe" "-ExecutionPolicy Bypass -Command Add-MpPreference -ExclusionPath $INSTDIR" SW_HIDE

NSIS installer auto-creates Start Menu + Desktop shortcut.

---

## PART B: AUTOSECPOSM — 100% SCANNING COVERAGE

### B1. Install Scanning Tools [TODO]

Create D:\LAN-AI-Infra\AutoSecPosM\scripts\install-scan-tools.ps1:

Python tools to install:
  pip install pip-audit radon xenon bandit safety cyclonedx-bom vulture detect-secrets flake8 mypy

Node tools to install:
  npm install -g @cyclonedx/cyclonedx-npm jscpd retire audit-ci

Add to requirements.txt:
  pip-audit>=2.7.0
  radon>=6.0.1
  xenon>=0.9.1
  bandit>=1.8.0
  safety>=3.2.0
  cyclonedx-bom>=4.6.0
  vulture>=2.11
  detect-secrets>=1.5.0

### B2. New Scanner Engines [TODO]

Add to backend/app/scanners/scan_runner.py:

1. _run_pip_audit(target_path): 
   - Walk target for requirements.txt, Pipfile.lock, pyproject.toml
   - Run: pip-audit --requirement <file> --format json
   - Parse CVE findings, return as severity=high findings

2. _run_npm_audit(target_path):
   - Walk target for package.json (skip node_modules dirs)
   - Run: npm audit --json in each package dir
   - Parse vulnerabilities, return findings

3. _run_radon(target_path):
   - Run: radon cc <target> --min C --json
   - Flag functions with CC >= 10 as medium, CC >= 20 as high
   - Category: code-quality

4. _run_bandit(target_path):
   - Run: bandit -r <target> -f json -q --exclude .venv,node_modules
   - Parse results, map to findings with CWE IDs

5. _run_vulture(target_path):
   - Run: vulture <target> --min-confidence 80
   - Parse output lines, create low-severity dead code findings

6. _run_detect_secrets(target_path):
   - Run: detect-secrets scan <target> (JSON output)
   - Map to critical severity secrets findings

7. _run_cyclonedx(target_path, scan_id):
   - Detect project type (Python vs Node)
   - Run appropriate CycloneDX tool
   - Save SBOM to backend/data/sbom/sbom_<scan_id>.json
   - Return SBOM path in scan result metadata

Update DYNAMIC_ENGINES dict with all 7 new engines.

Update compute_overall_grade() to penalize code-quality findings (quality finding = -2 points each).

### B3. AutoSecPosM API Endpoints to Add [TODO]

1. GET /api/scans/engines — list all available engines and whether binary is installed
2. GET /api/scans/{id}/sbom — serve the SBOM JSON for a completed scan
3. GET /api/scans/{id}/report — HTML report with charts (findings by severity/category)
4. POST /api/scans/{id}/diff — diff two scans to show new vs resolved findings

### B4. Grade Calculation Improvement [TODO]

Current: only severity-based
Improved formula:
  score = 100
  score -= critical_count * 20
  score -= high_count * 10  
  score -= medium_count * 5
  score -= low_count * 1
  score -= code_quality_count * 2
  score = max(0, score)
  Grade: A=90+, B=80+, C=70+, D=60+, F=<60

---

## PART C: VERIFICATION CHECKLIST [TODO]

Satchida:
  [ ] npm run type-check -> 0 errors
  [ ] Window title shows "Satchida" not "Eigent"
  [ ] Settings -> "Satchida Cloud" displayed
  [ ] Chat welcome -> "Welcome to Satchida"
  [ ] MCP & Tools -> filesystem, fetch, memory servers listed
  [ ] Web search works with fallback (try with no API keys first)
  [ ] Ollama model loads and chat works
  [ ] HuggingFace model search shows sizes > 0
  [ ] llama.cpp manifest download works (sha256: skip accepted)
  [ ] Desktop shortcut opens terminal and launches app

AutoSecPosM:
  [ ] curl http://localhost:3015/health -> {"status":"ok"}
  [ ] pip-audit --version works
  [ ] radon --version works  
  [ ] bandit --version works
  [ ] Run scan on AutoSecPosM repo -> findings from 3+ engines
  [ ] /api/scans/planner-advice returns AI text
  [ ] Backup creates .parquet files, no permission errors
  [ ] Scan grade not stuck on wrong value

---

## REBRAND MAINTENANCE

After every upstream git merge from eigent repo:
  cd D:\LAN-AI-Infra\Satchida-AI-Interface\eigent
  git merge upstream/main
  powershell -ExecutionPolicy Bypass -File scripts\rebrand-to-satchida.ps1
  npm run type-check

---

## NEXT SESSION STARTUP

1. Read this file and PRODUCTION_PLAN.md
2. curl http://localhost:3015/health (restart if down)
3. Pick up from A2 (desktop shortcuts) or B1 (tool installation)
4. Check: Get-Content D:\LAN-AI-Infra\Satchida-AI-Interface\eigent\todo.md -Tail 40
