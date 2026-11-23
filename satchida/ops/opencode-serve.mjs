// @ts-check
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const LIBRECHAT_ENV_PATH = process.env.LIBRECHAT_ENV_PATH || resolve(process.cwd(), '.env');
const OPENCODE_CONFIG_PATH =
  process.env.OPENCODE_CONFIG || resolve(process.cwd(), 'config', 'opencode', 'opencode.json');
const OPENCODE_PORT = String(process.env.OPENCODE_PORT || '4096');
const OPENCODE_HOSTNAME = '127.0.0.1';
const AUTOROUTER_BASE_URL = (
  process.env.SATCHIDA_AUTOROUTER_BASE_URL || 'http://127.0.0.1:4000/v1'
).replace(/\/+$/, '');

/**
 * Loads missing environment variables from LibreChat's `.env` without overwriting
 * values already present in `process.env`.
 */
function loadEnvFile(envPath) {
  const loaded = {};
  if (!existsSync(envPath)) {
    return loaded;
  }
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) {
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) {
      loaded[key] = value;
    }
  }
  return loaded;
}

/**
 * Queries the local AutoRouter `/v1/models` endpoint dynamically so `opencode.json`
 * contains whatever models the router currently exposes (no static model list)
 * and never stores any API key on disk.
 */
async function syncOpenCodeConfig(gatewayVk) {
  /** @type {Record<string, { name: string; tool_call: boolean; attachment: boolean }>} */
  const models = {};
  try {
    const headers = { Accept: 'application/json' };
    if (gatewayVk) {
      headers.Authorization = `Bearer ${gatewayVk}`;
    }
    const response = await fetch(`${AUTOROUTER_BASE_URL}/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const payload = await response.json();
      const entries = Array.isArray(payload?.data) ? payload.data : [];
      for (const entry of entries) {
        if (entry && typeof entry.id === 'string' && entry.id.trim().length > 0) {
          const id = entry.id.trim();
          models[id] = {
            name: id,
            tool_call: true,
            attachment: true,
          };
        }
      }
      console.log(
        `[opencode-serve] Discovered ${Object.keys(models).length} model(s) from ${AUTOROUTER_BASE_URL}/models`,
      );
    } else {
      console.warn(
        `[opencode-serve] AutoRouter /models returned HTTP ${response.status}; writing empty dynamic model map`,
      );
    }
  } catch (error) {
    console.warn(
      `[opencode-serve] AutoRouter /models unreachable (${error?.name || 'Error'}); writing empty dynamic model map`,
    );
  }

  const allowedRoute = process.env.OPENCODE_GATEWAY_MODEL || 'Vibecoding';
  const discoveredIds = Object.keys(models);
  const selectedRoute = discoveredIds.includes(allowedRoute)
    ? allowedRoute
    : discoveredIds[0];

  // Expose ONLY the single Satchida Gateway Vibecoding route to OpenCode so end users
  // cannot switch to Pro, Study, Motion, or raw upstream models.
  const lockedModels = selectedRoute
    ? {
        [selectedRoute]: {
          name: 'Satchida Gateway',
          tool_call: true,
          attachment: true,
        },
      }
    : {};

  const seatProxyBaseUrl = (
    process.env.SATCHIDA_OPENCODE_LLM_PROXY_URL ||
    'http://127.0.0.1:3080/api/opencode/llm-proxy/v1'
  ).replace(/\/+$/, '');

  const config = {
    $schema: 'https://opencode.ai/config.json',
    enabled_providers: ['satchida', 'opencode', 'opencode-go'],
    default_agent: 'build',
    ...(selectedRoute ? { model: `satchida/${selectedRoute}` } : {}),
    permission: {
      edit: 'allow',
      write: 'allow',
      bash: 'allow',
      read: 'allow',
    },
    provider: {
      satchida: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Satchida Gateway',
        env: ['SATCHIDA_GATEWAY_VK'],
        options: {
          baseURL: seatProxyBaseUrl,
        },
        models: lockedModels,
      },
      opencode: {
        npm: '@ai-sdk/openai-compatible',
        name: 'OpenCode Zen (Admin Free)',
        options: {
          baseURL: seatProxyBaseUrl,
        },
        models: {
          'longcat-2.5-free': {
            name: 'OpenCode Zen: LongCat 2.5 Free',
            tool_call: true,
          },
        },
      },
      'opencode-go': {
        npm: '@ai-sdk/openai-compatible',
        name: 'OpenCode Go (Admin Free)',
        models: {
          'glm-5.3-flash': {
            name: 'OpenCode Go: GLM-5.3 Flash Free',
            tool_call: true,
          },
        },
      },
    },
  };

  const baseDir = dirname(OPENCODE_CONFIG_PATH);
  const xdgConfigOpencodeDir = resolve(baseDir, 'xdg-config', 'opencode');
  const xdgDataOpencodeDir = resolve(baseDir, 'xdg-data', 'opencode');
  mkdirSync(xdgConfigOpencodeDir, { recursive: true });
  mkdirSync(xdgDataOpencodeDir, { recursive: true });
  mkdirSync(baseDir, { recursive: true });

  // Copy ONLY opencode (Zen) and opencode-go credentials for Platform Admin use;
  // strip all other provider credentials so no other provider can ever be used.
  const userAuthPath = resolve(process.env.USERPROFILE || '', '.config', 'opencode', 'auth.json');
  if (existsSync(userAuthPath)) {
    try {
      const parsedAuth = JSON.parse(readFileSync(userAuthPath, 'utf8'));
      const isolatedAuth = {};
      if (parsedAuth['opencode']) isolatedAuth['opencode'] = parsedAuth['opencode'];
      if (parsedAuth['opencode-go']) isolatedAuth['opencode-go'] = parsedAuth['opencode-go'];
      writeFileSync(
        resolve(xdgDataOpencodeDir, 'auth.json'),
        `${JSON.stringify(isolatedAuth, null, 2)}\n`,
        'utf8',
      );
    } catch {
      /* ignore */
    }
  }

  const jsonText = `${JSON.stringify(config, null, 2)}\n`;
  writeFileSync(OPENCODE_CONFIG_PATH, jsonText, 'utf8');
  writeFileSync(resolve(xdgConfigOpencodeDir, 'opencode.json'), jsonText, 'utf8');
  return OPENCODE_CONFIG_PATH;
}

async function main() {
  const fileEnv = loadEnvFile(LIBRECHAT_ENV_PATH);
  const password = process.env.OPENCODE_SERVER_PASSWORD || fileEnv.OPENCODE_SERVER_PASSWORD || '';
  const gatewayVk = process.env.SATCHIDA_GATEWAY_VK || fileEnv.SATCHIDA_GATEWAY_VK || '';

  if (!password) {
    console.error(
      '[opencode-serve] FATAL: OPENCODE_SERVER_PASSWORD is not set in environment or LibreChat .env',
    );
    process.exit(1);
  }

  const configPath = await syncOpenCodeConfig(gatewayVk);

  const command = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
  const args = ['serve', '--pure', '--port', OPENCODE_PORT, '--hostname', OPENCODE_HOSTNAME];

  console.log(
    `[opencode-serve] Starting loopback OpenCode server on http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT} with config ${configPath}`,
  );

  // Strip direct upstream provider keys so OpenCode can ONLY route through Satchida Gateway
  const childEnv = { ...process.env };
  for (const key of [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'DEEPSEEK_API_KEY',
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY',
    'XAI_API_KEY',
    'TOGETHER_API_KEY',
    'MISTRAL_API_KEY',
  ]) {
    delete childEnv[key];
  }

  const baseDir = dirname(configPath);
  const xdgConfigHome = resolve(baseDir, 'xdg-config');
  const xdgDataHome = resolve(baseDir, 'xdg-data');
  const xdgStateHome = resolve(baseDir, 'xdg-state');
  mkdirSync(xdgConfigHome, { recursive: true });
  mkdirSync(xdgDataHome, { recursive: true });
  mkdirSync(xdgStateHome, { recursive: true });

  // AGENTS.md §6: use windowsHide without detached on Windows
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
    env: {
      ...childEnv,
      OPENCODE_SERVER_PASSWORD: password,
      OPENCODE_SERVER_USERNAME: 'opencode',
      OPENCODE_CONFIG: configPath,
      OPENCODE_CONFIG_DIR: resolve(xdgConfigHome, 'opencode'),
      XDG_CONFIG_HOME: xdgConfigHome,
      XDG_DATA_HOME: xdgDataHome,
      XDG_STATE_HOME: xdgStateHome,
      ...(gatewayVk ? { SATCHIDA_GATEWAY_VK: gatewayVk } : {}),
    },
  });

  const forwardSignal = (sig) => {
    try {
      child.kill(sig);
    } catch {
      /* already exited */
    }
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    console.warn(`[opencode-serve] opencode exited (code=${code}, signal=${signal})`);
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(`[opencode-serve] spawn error: ${error.name}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(`[opencode-serve] startup failed: ${error?.name || 'Error'}`);
  process.exit(1);
});
