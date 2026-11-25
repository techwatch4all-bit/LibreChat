# Satchida Ecosystem — Master Repository Inventory
> **Auto-generated: 2026-06-22 by Antigravity AI**
> Purpose: Any AI agent starting a session on this machine reads this file FIRST.
> Update whenever a new project, service, or integration is added.
> Full detailed version is kept in the Antigravity artifact store.
> Session ID (Satchida-App build): 226c5aa4-11f7-46aa-a4dd-c61998695fae

---

## QUICK NAVIGATION

| Project | Path | Status | Next Action |
|---------|------|--------|-------------|
| **Satchida-App** (Electron+C++) | D:\LAN-AI-Infra\Satchida-App | Phase B done | Phase C: Chat UI |
| **Satchida_HomeServer** (FastAPI) | D:\LAN-AI-Infra\Satchida_HomeServer | Partially shipped | Fix voice grounding bugs |
| **RealtimeVoiceChat** (OSS ref) | D:\LAN-AI-Infra\RealtimeVoiceChat | Running | Do not modify |
| **Infrastructure** | C:\LAN-AI-Infra | Running | See C:\LAN-AI-Infra\TODO.md |

---

## SATCHIDA-APP — Phase Status

`
Phase A ✅  Native voice pipeline (VAD→Whisper→Apodex→Kokoro) — built, bugfixed
Phase B ✅  Web search, web fetch, deep research — built and wired
Phase C 🔜  Chat UI (text/voice/image/file multi-modal)
Phase D 🔜  Memory and RAG (sqlite-vec)
Phase E 🔜  Vibe Coding IDE
Phase F 🔜  Multi-Agent Orchestration
Phase G 🔜  Web Server (multi-user)
`

## KEY FILES BUILT (Phase A+B)

- embedded-core/src/nitro_llm.cc         — llama.cpp LLM wrapper
- embedded-core/src/nitro_whisper.cc     — whisper.cpp STT wrapper
- embedded-core/src/nitro_tts.cc         — ONNX Kokoro-82M TTS wrapper
- embedded-core/src/nitro_bridge.cc      — C++ orchestrator
- electron-desktop/electron/audio/       — AudioWorklet, VAD, pipeline
- electron-desktop/electron/ipc/tool-delegation.ts — Apodex tool routing
- electron-desktop/electron/services/web-search.ts — DDG Lite + Brave
- electron-desktop/electron/services/web-fetch.ts  — URL fetch + text extract
- electron-desktop/electron/services/deep-research.ts — Multi-step research

## OSS IN USE (Satchida-App)

| Library | License | Purpose |
|---------|---------|---------|
| llama.cpp (ggml-org) | MIT | LLM inference |
| whisper.cpp (ggerganov) | MIT | STT |
| onnxruntime (Microsoft) | MIT | Kokoro TTS |
| Silero VAD v5 | MIT | Voice activity detection |
| Electron 34 | MIT | Desktop shell |

## OSS IN USE (HomeServer)

| Library | License | Purpose |
|---------|---------|---------|
| RealtimeSTT (KoljaB) | MIT | Streaming STT |
| RealtimeTTS (KoljaB) | MIT | Streaming TTS |
| faster-whisper | MIT | GPU Whisper |
| Ollama | MIT | Local LLM |
| FastAPI | MIT | WebSocket server |

## OSS TO ADOPT NEXT

| OSS | License | When | Purpose |
|-----|---------|------|---------|
| sqlite-vec (asg017) | Apache-2.0 | Phase D | Local RAG/memory |
| mem0 | Apache-2.0 | Phase D | Memory layer |
| OpenWebUI | MIT | Phase C ref | Chat UI patterns |
| Perplexica | MIT | Phase C ref | Search-grounded answers |
| Continue.dev | Apache-2.0 | Phase E | IDE AI extension |
| Goose (Block) | Apache-2.0 | Phase F | Local agent executor |

## BRAND

- Brand: Satchida
- Website: Satchida.com
- Logo: D:\LAN-AI-Infra\logo\Baseline_v2.0.png

## SECURITY & OPERATIONAL RULES (always enforce)

1. Never log audio, transcripts, or user content without consent
2. Never add telemetry or external callbacks
3. All inference stays local (no cloud unless user enables web search)
4. API keys in .env only — never hardcode
5. Validate all JSON tool-call payloads before execution
6. Use crypto.randomBytes for IDs — never Math.random()
7. Run npm audit + pip-audit before every release build
8. **Ecosystem Scan**: Always review `D:\LAN-AI-Infra\ASSET_INVENTORY.md` and `D:\LAN-AI-Infra\SATCHIDA_ECOSYSTEM_INVENTORY.md` before starting any development, code generation, or build step.
9. **Modular Reuse**: Always verify if a feature or helper already exists in `D:\LAN-AI-Infra\skills\`, `dashboard\`, or `agents\` before writing new code. Import/link shared modules instead of duplicate implementations.

---
*See full detailed inventory in Antigravity artifacts: session 226c5aa4-11f7-46aa-a4dd-c61998695fae*
