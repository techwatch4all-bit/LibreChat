// @ts-check
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const OPENFILM_SERVER_SCRIPT = 'C:\\Users\\WinDiesel\\AppData\\Local\\npm-cache\\_npx\\ab5ca1f87d8cabd8\\node_modules\\openfilm\\studio\\server\\main.mjs';

function getRunInfo() {
  const runFile = join(homedir(), '.openfilm', 'run.json');
  if (!existsSync(runFile)) return null;
  try {
    return JSON.parse(readFileSync(runFile, 'utf8'));
  } catch {
    return null;
  }
}

async function isAlive() {
  const info = getRunInfo();
  if (!info || !info.origin) return false;
  try {
    const res = await fetch(`${info.origin}/health`, {
      headers: {
        'Accept': 'text/html',
        'Cookie': `openfilm_studio=${info.key}`
      },
      signal: AbortSignal.timeout(3000)
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function startServer() {
  console.log('[OpenFilm Service] Starting OpenFilm Studio supervisor...');
  const child = spawn(process.execPath, [OPENFILM_SERVER_SCRIPT], {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      PORT: '4747'
    }
  });

  child.on('exit', (code, sig) => {
    console.warn(`[OpenFilm Service] Studio process exited with code ${code}, signal ${sig}`);
  });

  return child;
}

async function main() {
  console.log('[OpenFilm Service] Initializing OpenFilm Studio service...');
  const alive = await isAlive();
  if (alive) {
    console.log('[OpenFilm Service] OpenFilm Studio is already active and healthy.');
  } else {
    await startServer();
  }

  // Monitor loop
  setInterval(async () => {
    const ok = await isAlive();
    if (!ok) {
      console.warn('[OpenFilm Service] OpenFilm Studio not responding; restarting...');
      await startServer();
    }
  }, 15000);
}

main().catch(console.error);
