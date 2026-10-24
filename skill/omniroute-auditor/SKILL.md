---
name: omniroute-auditor
description: Automated proactive health checker and remediator for OmniRoute, local inference runners (LM Studio, Ollama, vLLM), SQLite persistence, and provider connections.
---

# OmniRoute Infrastructure & AI Inference Auditor Skill

This skill provides automated proactive diagnostics and remediation for OmniRoute and its connected local AI inference engines.

## Capabilities
1. **Git & Build Environment**: Verifies Git remotes, tags, branch state, and Node.js engine compatibility.
2. **Database & Persistence**: Performs physical SQLite integrity checks (`PRAGMA quick_check`), validates schema migration count (130+), and ensures global system prompt formatting safeguards (preventing models from emitting raw XML `<tool_call>` tags).
3. **Provider Credentials & Health**: Audits all registered provider connections, identifies expired/401 credentials (e.g. OpenCode Go), and auto-deactivates dead keys to eliminate dashboard warning toasts.
4. **Local Inference Servers**: Tests connectivity to LM Studio (`http://127.0.0.1:1234`), Ollama (`http://127.0.0.1:11434`), and validates private loopback SSRF firewall settings in `.env`.

## Usage
Run the auditor anytime from PowerShell or terminal:

```bash
python D:\LAN-AI-Infra\skills\omniroute-auditor\audit.py
```

Options:
- `--no-fix`: Run in diagnostic-only mode without applying auto-remediations.
- `--json`: Output machine-readable JSON results.
