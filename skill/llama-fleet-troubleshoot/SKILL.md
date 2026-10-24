---
name: llama-fleet-troubleshoot
description: Triage llama-server and local-model failures for the Satchida desktop suite. Use when chat fails, models show unloaded, or the Tauri window reports a runtime error.
---

# Llama Fleet Troubleshoot

Triage order matters. Check each layer in sequence — server, models, autostart expectations — and stop at the first red layer.

## 1. Is the server up?

- TCP probe: `127.0.0.1:8080` must accept connections.
- HTTP probe: `GET http://127.0.0.1:8080/health` must return `{"status":"ok"}`.
- If both fail, the server is down. Expected binary: `D:\LAN-AI-Infra\Satchida-AI-Interface\llama-cpp-cuda\llama-server.exe`. Check the process list before starting a second copy (double-bind on `:8080` is the classic self-inflicted outage).

## 2. Is a model loaded?

- `GET http://127.0.0.1:8080/v1/models` — inspect each entry's `status.value`.
- All `unloaded` with server `ok` is the normal idle state, not an error. Chat cannot answer until one model is loaded.
- Load path: `#/llm-fleet` page in the UI, or the models API. Only one slot is configured (`--models-max 1`), so loading a second model evicts the first.

## 3. Autostart expectations (Tauri)

` satchida-tauri/src-tauri/src/lib.rs` `setup()` starts `llama-server.exe` only when the port probe fails, with flags `--models-preset <models-preset.ini> --models-max 1 --no-models-autoload --ui-mcp-proxy --host 0.0.0.0 --port 8080`.

- The preset file is regenerated at launch by scanning `C:\LAN-AI-Infra\LLM-models\*.gguf` and `D:\LAN-AI-Infra\LLM-models\*.gguf`. A model missing from the fleet page usually means its `.gguf` is not in either dir.
- `--no-models-autoload` is deliberate: launch never loads a model. A fresh boot always needs a manual load — tell the user, do not "fix" the flag.
- The Tauri window URL is `http://127.0.0.1:8080`, so a dead server is also a blank window.

## 4. Resource checks (when loads fail)

- VRAM/disk: `C:` and `D:` free space; large (27B+) presets need tens of GB plus KV-cache headroom.
- Log tail: `llama-server.log` in the repo root — look for CUDA/OOM lines and preset parse errors.
- `models-preset.ini` at repo root must contain one `[alias]` section per discovered `.gguf`.

## Report Format

State the red layer (server / model / autostart / resources), the exact probe output, and the single next action. Do not restart the server or switch models without user confirmation.
