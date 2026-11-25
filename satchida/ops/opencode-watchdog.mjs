/**
 * Satchida OpenCode Fleet Watchdog — Persistent Loopback Guardian for :4096 & :4000.
 *
 * Mission-critical invariant:
 * - Continuously monitors OpenCode (:4096) and Satchida Gateway (:4000).
 * - Verifies every 15s that OpenCode is online AND configured with 'satchida' provider + 'Vibecoding' model.
 * - If satchida-gateway (:4000) or opencode (:4096) desyncs, automatically regenerates config,
 *   disposes cached instances or triggers PM2 restart to ensure zero downtime for Pro and Privacy tiers.
 */
import { exec } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';

const execAsync = promisify(exec);

const LIBRECHAT_ROOT = resolve(dirname(import.meta.dirname || '.'), '..');
const LIBRECHAT_ENV_PATH = process.env.LIBRECHAT_ENV_PATH || join(LIBRECHAT_ROOT, '.env');
const envVars = loadEnvFile(LIBRECHAT_ENV_PATH);
const DEFAULT_IN_REPO_CONFIG = join(LIBRECHAT_ROOT, 'repos', 'opencode', 'opencode.json');
const OPENCODE_CONFIG_PATH =
  process.env.OPENCODE_CONFIG ||
  envVars.OPENCODE_CONFIG ||
  (existsSync(DEFAULT_IN_REPO_CONFIG) ? DEFAULT_IN_REPO_CONFIG : 'D:\\LAN-AI-Infra\\opencode\\opencode.json');
const OPENCODE_PORT = String(process.env.OPENCODE_PORT || envVars.OPENCODE_PORT || '4096');
const OPENCODE_HOSTNAME = '127.0.0.1';
const rawGateway = (
  process.env.SATCHIDA_GATEWAY_URL ||
  envVars.SATCHIDA_GATEWAY_URL ||
  process.env.SATCHIDA_AUTOROUTER_BASE_URL ||
  envVars.SATCHIDA_AUTOROUTER_BASE_URL ||
  process.env.ONEAPI_BASE_URL ||
  envVars.ONEAPI_BASE_URL ||
  'http://127.0.0.1:4000/v1'
).trim().replace(/\/+$/, '');
const AUTOROUTER_BASE_URL = rawGateway.endsWith('/v1') ? rawGateway : `${rawGateway}/v1`;
const POLL_INTERVAL_MS = 15_000;
const RESTART_COOLDOWN_MS = 30_000;

function loadEnvFile(envPath) {
  const loaded = {};
  if (!existsSync(envPath)) return loaded;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) loaded[key] = value;
  }
  return loaded;
}

function getCredentials() {
  const envVars = loadEnvFile(LIBRECHAT_ENV_PATH);
  const password = process.env.OPENCODE_SERVER_PASSWORD || envVars.OPENCODE_SERVER_PASSWORD || '';
  const gatewayVk = process.env.SATCHIDA_GATEWAY_VK || envVars.SATCHIDA_GATEWAY_VK || '';
  const authHeader = 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64');
  return { password, gatewayVk, authHeader };
}

let lastRestartTime = 0;

async function checkGatewayHealth(gatewayVk) {
  try {
    const cfClientId = process.env.CF_ACCESS_CLIENT_ID || envVars.CF_ACCESS_CLIENT_ID;
    const cfClientSecret = process.env.CF_ACCESS_CLIENT_SECRET || envVars.CF_ACCESS_CLIENT_SECRET;
    const headers = {
      Accept: 'application/json',
      ...(cfClientId ? { 'CF-Access-Client-Id': cfClientId } : {}),
      ...(cfClientSecret ? { 'CF-Access-Client-Secret': cfClientSecret } : {}),
    };
    if (gatewayVk) headers.Authorization = `Bearer ${gatewayVk}`;
    const res = await fetch(`${AUTOROUTER_BASE_URL}/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    const hasVibecoding = models.some((m) => m.id === 'Vibecoding');
    return { ok: true, count: models.length, hasVibecoding };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function checkOpenCodeHealth(authHeader) {
  try {
    const res = await fetch(`http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}/global/health`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkOpenCodeProviders(authHeader) {
  try {
    const res = await fetch(`http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}/provider`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const all = Array.isArray(data?.all) ? data.all : [];
    const satchida = all.find((p) => p.id === 'satchida');
    const satchidaModels = Object.keys(satchida?.models || {});
    const isConnected = Array.isArray(data?.connected) && data.connected.includes('satchida');
    const hasVibeModel = satchidaModels.includes('Vibecoding');
    return {
      ok: true,
      hasSatchidaProvider: Boolean(satchida),
      hasVibeModel,
      isConnected,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function triggerInstanceReload(authHeader) {
  try {
    const res = await fetch(`http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}/instance/dispose`, {
      method: 'POST',
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function restartOpencodeServe() {
  const now = Date.now();
  if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
    console.warn('[opencode-watchdog] Rate limit: restart cooling down');
    return;
  }
  lastRestartTime = now;
  console.log('[opencode-watchdog] Triggering PM2 restart for opencode-serve...');
  try {
    await execAsync('pm2 restart opencode-serve');
    console.log('[opencode-watchdog] PM2 restart opencode-serve succeeded');
  } catch (err) {
    console.error('[opencode-watchdog] PM2 restart failed:', err?.message || err);
  }
}

async function ensureConfigHealth(gatewayVk) {
  try {
    if (!existsSync(OPENCODE_CONFIG_PATH)) return false;
    const content = JSON.parse(readFileSync(OPENCODE_CONFIG_PATH, 'utf8'));
    if (!content.provider?.satchida || !content.provider?.satchida?.models?.Vibecoding) {
      console.warn('[opencode-watchdog] opencode.json missing satchida/Vibecoding! Patching file...');
      content.enabled_providers = ['satchida', 'opencode', 'opencode-go'];
      delete content.disabled_providers;
      content.model = 'satchida/Vibecoding';
      content.provider = content.provider || {};
      content.provider.satchida = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Satchida Gateway',
        env: ['SATCHIDA_GATEWAY_VK'],
        options: {
          baseURL: 'http://127.0.0.1:3080/api/opencode/llm-proxy/v1',
        },
        models: {
          Vibecoding: {
            name: 'Satchida Gateway',
            tool_call: true,
            attachment: true,
          },
        },
      };
      writeFileSync(OPENCODE_CONFIG_PATH, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
      return true;
    }
  } catch (e) {
    console.error('[opencode-watchdog] Error validating config:', e?.message || e);
  }
  return false;
}

console.log(`[opencode-watchdog] Satchida OpenCode Fleet Watchdog started (interval: ${POLL_INTERVAL_MS / 1000}s)`);

for (;;) {
  try {
    const { gatewayVk, authHeader } = getCredentials();

    // 1. Check Gateway health
    const gwStatus = await checkGatewayHealth(gatewayVk);
    if (!gwStatus.ok) {
      console.warn(`[opencode-watchdog] Satchida Gateway (:4000) not ready: ${gwStatus.error}`);
    }

    // 2. Check OpenCode server status
    const opencodeUp = await checkOpenCodeHealth(authHeader);
    if (!opencodeUp) {
      console.warn('[opencode-watchdog] OpenCode server (:4096) is down! Restarting service...');
      await restartOpencodeServe();
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // 3. Ensure opencode.json on disk has satchida/Vibecoding
    const patchedConfig = await ensureConfigHealth(gatewayVk);
    if (patchedConfig) {
      console.log('[opencode-watchdog] Config patched. Triggering instance reload...');
      await triggerInstanceReload(authHeader);
    }

    // 4. Verify OpenCode loaded provider state
    const providerStatus = await checkOpenCodeProviders(authHeader);
    if (providerStatus.ok) {
      if (!providerStatus.hasSatchidaProvider || !providerStatus.hasVibeModel) {
        console.warn('[opencode-watchdog] OpenCode is missing satchida/Vibecoding provider in runtime! Reloading...');
        const disposed = await triggerInstanceReload(authHeader);
        if (!disposed) {
          await restartOpencodeServe();
        }
      }
    } else {
      console.warn(`[opencode-watchdog] Failed to query OpenCode providers: ${providerStatus.error}`);
    }
  } catch (err) {
    console.error('[opencode-watchdog] Loop error:', err?.message || err);
  }

  await sleep(POLL_INTERVAL_MS);
}
