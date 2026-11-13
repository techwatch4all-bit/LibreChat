/**
 * Satchida llama-fleet watchdog — cold-start guardian for :8080.
 *
 * Mirrors the Tauri autostart (satchida-tauri/src-tauri/src/lib.rs) EXACTLY:
 *   - llama-server launched with the shared models-preset.ini (24-alias dynamic
 *     fleet) — NEVER with a single --model, so /v1/models keeps the full
 *     dynamic list for the model-selection dropdown.
 *   - --no-models-autoload stays on the command line; after a watchdog cold
 *     start the watchdog itself loads the default chat model (Ternary Bonsai
 *     9B, per operator) through the models API — but only when the watchdog
 *     performed the start, never touching a running instance's loaded model.
 *
 * The only URL touched is the hardcoded loopback llama endpoint (no user
 * input). PM2 restarts this watchdog if it exits. Start attempts rate-limited
 * to one per 60s so a broken preset cannot spawn-launch-loop.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const HEALTH_URL = 'http://127.0.0.1:8080/health';
const MODELS_URL = 'http://127.0.0.1:8080/v1/models';
const LOAD_URL = 'http://127.0.0.1:8080/models/load';
const POLL_MS = 15_000;
const START_COOLDOWN_MS = 60_000;
const DEFAULT_MODEL = 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0';

const LLAMA_EXE = 'D:\\LAN-AI-Infra\\Satchida-AI-Interface\\llama-cpp-cuda\\llama-server.exe';
const PRESET = 'D:\\LAN-AI-Infra\\satchida-ai-unified-suite\\models-preset.ini';

const SERVER_ARGS = [
  '--models-preset', PRESET,
  '--models-max', '1',
  '--no-models-autoload',
  '--ctx-size', '32768',
  '--jinja',
  '--parallel', '1',
  '--flash-attn', 'auto',
  '--n-gpu-layers', '999',
  '--device', 'CUDA0',
  '--split-mode', 'none',
  '--main-gpu', '0',
  '--ui-mcp-proxy',
  '--host', '0.0.0.0',
  '--port', '8080',
];

async function serverUp() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** True when at least one model reports a loaded status. */
async function anyModelLoaded() {
  try {
    const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const body = await res.json();
    const models = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
    return models.some((m) => {
      const status = typeof m?.status === 'string' ? m.status : m?.status?.value ?? '';
      return status && status !== 'unloaded';
    });
  } catch {
    return false;
  }
}

async function loadDefaultModel() {
  try {
    const res = await fetch(LOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: DEFAULT_MODEL }),
      signal: AbortSignal.timeout(300000),
    });
    console.log(`[watchdog] default model load (${DEFAULT_MODEL}): HTTP ${res.status}`);
  } catch (err) {
    console.error('[watchdog] default model load failed:', String(err).slice(0, 200));
  }
}

function startServer() {
  console.log(`[watchdog] ${new Date().toISOString()} :8080 down — cold-starting llama fleet (preset profile).`);
  const child = spawn(LLAMA_EXE, SERVER_ARGS, {
    stdio: 'ignore',
    windowsHide: true,
    // NOTE: do NOT add detached here — detached+windowsHide together breaks
    // spawned processes on this Node/Windows build (verified 2026-11-10).
  });
  child.on('error', (err) => console.error('[watchdog] spawn error:', String(err).slice(0, 200)));
  child.unref();
}

let lastStart = 0;
console.log(`[watchdog] llama-fleet watchdog started (poll ${POLL_MS / 1000}s, cooldown ${START_COOLDOWN_MS / 1000}s, default ${DEFAULT_MODEL}).`);
for (;;) {
  try {
    if (!(await serverUp()) && Date.now() - lastStart > START_COOLDOWN_MS) {
      lastStart = Date.now();
      startServer();
      // Wait for health, then load the operator's default chat model — but
      // only for a cold start the watchdog performed itself.
      let started = false;
      for (let i = 0; i < 24 && !started; i += 1) {
        await sleep(5000);
        started = await serverUp();
      }
      if (started) {
        console.log('[watchdog] server healthy after cold start.');
        await sleep(2000);
        if (!(await anyModelLoaded())) {
          await loadDefaultModel();
        }
      } else {
        console.error('[watchdog] server still not healthy 120s after cold start.');
      }
    }
  } catch (err) {
    console.error('[watchdog] loop error:', String(err).slice(0, 200));
  }
  await sleep(POLL_MS);
}
