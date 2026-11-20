# Satchida AI & Satchida Code — Comprehensive Product Improvement Plan

Updated: 2026-11-20

## 1. Executive Summary & Architectural Decisions

### Decision 1: Retire Shared `code-server` ("VibeStudio IDE") in Favor of 100% Embedded Satchida Code
| Criterion | Legacy `code-server` (VS Code Web `:8085` / `:4099`) | Embedded **Satchida Code** (`opencode-serve` `:4096` + Dual-Mode LibreChat IDE) |
|---|---|---|
| **Simultaneous Multi-User Sessions on Tenant PC** | **Fails.** `code-server` runs as a single OS process sharing one `--user-data-dir`, one `globalStorage` (Cline state), and one workspace (`D:/LAN-AI-Infra/workspace`). User B sees User A's open files, terminal, and Cline chat in real time. | **100% Supported.** Every project is isolated in its own directory (`getChatProject(userId, projectId)`), sessions are scoped per directory, previews bind dynamic ports (`PORT=0`), and `/api/opencode/llm-proxy/v1` attributes each concurrent LLM request to that exact user's `seatToken`. |
| **Cline Extension Disappearing Issue** | Caused by `code-server` storing extension state in shared `--user-data-dir` + browser IndexedDB inside a proxied iframe (`/api/ide/`), which resets or collides across sessions. | **Eliminated.** The AI coding agent is native to LibreChat (`OpenCodeChatPanel.tsx`) and never depends on browser IndexedDB or VS Code extension hosts. |
| **Satchida Gateway (`one-api`) & Bifrost Anti-Bypass** | **Impossible to lock down.** Users inside `code-server` can install arbitrary `.vsix` extensions (Continue, Roo, Copilot), edit `settings.json`, or use the terminal to call external APIs directly. | **100% Locked Down.** All tenant users and Tenant Admins are forced through `/api/opencode/llm-proxy/v1` → `one-api` (`:4000`) → `Bifrost` (`:8700`). Only LibreChat Platform Admins (`satchida-master` `ADMIN` / `admin` group) can access OpenCode Zen/Go free models and the raw PTY terminal. |
| **RAM & CPU Footprint on Tenant PC** | ~600–900 MB RAM per user if isolated processes were spawned. | ~80 MB total for `opencode-serve`; Monaco runs client-side in the user's browser. |

**Action:** Replace the legacy `code-server` iframe in `client/src/components/IDE/IdeView.tsx` with a direct launch into **Satchida Code (`/projects`)**.

---

## 2. Seven Core Improvement Tracks (Implemented)

### Track 1: Roadmap Add-Ons to Beat Cursor, Kimi, Bolt & Lovable
1. **1-Click Auto-Fix (Server & Browser Runtime Error Capture):**
   - Proxy injects a lightweight `window.onerror` / `unhandledrejection` bridge into HTML preview responses that posts browser runtime errors to `OpenCodePreviewPanel.tsx`.
   - Both browser runtime errors and server startup/stderr logs trigger a 1-click **"Auto-Fix with AI"** button that dispatches the stack trace directly to the active Satchida Code session.
2. **1-Click Project Starter Templates & Export ZIP:**
   - **Starter Templates:** Empty sessions present 4 one-click plain-English app templates (*Live Web & Price Monitor*, *CRM & Lead Tracker*, *Kanban Task Board*, *REST API & Live Analytics*).
   - **Download Project (`.zip`):** `GET /api/opencode/:projectId/export-zip` packages the project workspace (excluding `node_modules`, `.git`, `dist`, `build`) into a downloadable `.zip` archive from the top toolbar.
3. **Built-in Satchida Headless Reader Endpoint (`GET /api/opencode/reader?url=...`):**
   - Loopback service endpoint (`http://127.0.0.1:3080/api/opencode/reader?url=...`) that extracts page title, metadata, links, embedded JSON/Next.js/LD+JSON state, and clean readable text so vibecoded apps can scrape modern websites with a single `fetch()` call.

### Track 2: `Normal` Mode — Hide Technical Details "In Plain Sight"
- In `Normal` mode (`simpleMode === true` in `OpenCodeChatPanel.tsx`), intermediate tool calls (`part.type === 'tool'`), reasoning blocks (`part.type === 'reasoning'`), and raw intermediate technical narration are automatically grouped into a sleek collapsible pill:
  **`✨ Built & verified (N steps completed) — Show technical details ▾`**
- Non-technical users see only their prompt, the clean progress pill, and the final plain-English summary—while the full technical trace remains one click away ("hidden in plain sight") or in `Developer` mode.

### Track 3: `Developer` Mode — VS Code-Grade Editor Assistance
- Upgraded `MonacoEditor` in `VibeWorkspace.tsx` with:
  - **Rainbow Bracket Pair Colorization** (`bracketPairColorization.enabled = true`, `independentColorPoolPerBracketType = true`) and active bracket/indentation guides.
  - **Live Syntax & Type Diagnostics (`Problems (N)`)**: Captures Monaco language-service validation markers in real time, displays an inline error/warning badge in the editor header, and provides a collapsible **Problems Drawer** with jump-to-line and a 1-click **"Fix Problems with AI"** button.
  - **Editor Toolbar Enhancements**: Breadcrumb file path display, `Ctrl+S` keyboard shortcut, toggleable **Minimap**, **Word Wrap**, **Format Document**, and **Ask AI to Improve/Fix File**.

### Track 4: Paste & Attach Images / Screenshots in Vibe Coding Chat
- Added clipboard image paste (`Ctrl+V` / `onPaste`), drag-and-drop, and an **Attach Screenshot** button (`ImagePlus`) in `OpenCodeChatPanel.tsx` with thumbnail previews.
- Backend (`sendPrompt` / `createSessionPrompt` in `packages/api/src/opencode/http.ts`) saves attached screenshots to `<projectRoot>/.satchida-screenshots/<filename>` and automatically performs a vision pre-analysis via Satchida Gateway (`Motion` vision route / local `qwen3-vl:4b-instruct`), injecting both the file path and visual UI/error/OCR analysis into the coding prompt so text-only ZDR coding models (`DeepSeek-V4-Flash-0731`) never fail with HTTP 400.

### Track 5: Smart Existing-Project Runner & Port/Script Automation (`OpenHands`, etc.)
- `GET /api/opencode/:projectId/preview/status` now inspects `<projectRoot>/package.json` and returns `availableScripts` (e.g., `dev:mock`, `dev:frontend`, `dev`, `start`, `preview`).
- `OpenCodePreviewPanel.tsx` surfaces a **Script Selector dropdown**, streams live startup logs directly below the spinner while waiting for a port (so the screen is never a black void), automatically prefers standalone frontend/mock scripts (`dev:mock` / `dev:frontend`) when opening complex multi-container repos like `OpenHands`, and provides a 1-click **"Auto-Configure & Start with AI"** button if a script exits or fails.

### Track 6: Smart Automation for Memories & Agent Builder
- **Automatic Memory Extraction (`librechat.yaml`):** Enabled `memory.agent.enabled: true` (`provider: Satchida`, `model: Work`) so durable user preferences, profile facts, goals, and project context are automatically extracted from conversations.
- **1-Click Smart Memory Starters (`MemoryPanel.tsx`):** Added guided 1-click memory starter pills in the empty state (*Role & Domain*, *Communication Style*, *Tech Stack Preferences*, *Current Goals*).
- **1-Click Agent Builder Quick-Templates (`AgentConfig.tsx`):** Added a **Quick-Fill Agent Template** bar at the top of the Agent Builder (*Research & Web Analyst*, *Full-Stack Coding Partner*, *Business & Operations Assistant*, *Academic & Exam Tutor*) that populates Name, Description, Model (`Satchida / Work`), Category, System Instructions, and Conversation Starters in one click.
