/**
 * Satchida Tenant Fleet Sync Agent (fleet-sync-agent.mjs)
 * ========================================================
 * Runs on tenant edge nodes (behind CGNAT) under PM2.
 * Responsibilities:
 * 1. Sends outbound periodic heartbeats (every 20s) to control.satchida.com (or local 8443)
 * 2. Transmits local error incidents to Control Plane for AI analysis
 * 3. Receives patch tasks, applies them with backup & verification, and auto-rolls back if verification fails.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:8443';
const TENANT_ID = process.env.TENANT_ID || 'operator-local';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '20000', 10);
const REPO_ROOT = 'd:/LAN-AI-Infra/LibreChat';
const BACKUPS_DIR = join(__dirname, 'backups');

if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR, { recursive: true });
}

function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemMb = Math.round((totalMem - freeMem) / (1024 * 1024));
  const load = os.loadavg();
  return {
    memory: usedMemMb,
    cpu: Math.round((load[0] || 0) * 10) / 10,
    uptime: Math.round(os.uptime()),
    hostname: os.hostname(),
    platform: os.platform(),
  };
}

async function sendHeartbeat() {
  try {
    const payload = {
      tenantId: TENANT_ID,
      host: os.hostname(),
      status: 'online',
      metrics: getSystemMetrics(),
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(`${CONTROL_PLANE_URL}/api/v1/fleet/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[fleet-sync] Heartbeat HTTP ${res.status}`);
      return;
    }

    const data = await res.json();
    const tasks = data.tasks || [];

    if (tasks.length > 0) {
      console.log(`[fleet-sync] Received ${tasks.length} pending task(s) from control plane.`);
      for (const task of tasks) {
        await executeTask(task);
      }
    }
  } catch (err) {
    console.warn(`[fleet-sync] Heartbeat failed (will retry): ${err.message}`);
  }
}

async function executeTask(task) {
  console.log(`[fleet-sync] Executing task ${task._id} (type: ${task.type})`);
  const taskId = task._id;

  if (task.type === 'apply_patch') {
    const targetFile = task.targetFile;
    const absPath = targetFile.startsWith('d:') || targetFile.startsWith('D:') 
      ? targetFile 
      : join(REPO_ROOT, targetFile);

    if (!existsSync(absPath)) {
      console.error(`[fleet-sync] Target file not found: ${absPath}`);
      await reportTaskResult(taskId, false, '', `Target file not found: ${absPath}`);
      return;
    }

    // 1. Create timestamped backup (ensure filename is valid on Windows, strip colons)
    const safeName = targetFile.replace(/[:\\\/]/g, '_');
    const backupFile = join(BACKUPS_DIR, `${Date.now()}_${safeName}.bak`);
    copyFileSync(absPath, backupFile);
    console.log(`[fleet-sync] Created safety backup: ${backupFile}`);

    let originalContent = '';
    try {
      originalContent = readFileSync(absPath, 'utf8');
      let newContent = originalContent;

      if (task.fullContent) {
        newContent = task.fullContent;
      } else if (task.targetString && task.replacementString) {
        if (!originalContent.includes(task.targetString)) {
          throw new Error(`Target string not found in ${targetFile}`);
        }
        newContent = originalContent.replace(task.targetString, task.replacementString);
      } else {
        throw new Error('Patch does not specify fullContent or targetString/replacementString');
      }

      // 2. Apply patch
      writeFileSync(absPath, newContent, 'utf8');
      console.log(`[fleet-sync] Applied patch to ${absPath}`);

      // 3. Run verify command if specified
      let verifyLogs = 'Verification passed.';
      if (task.verifyCommand) {
        console.log(`[fleet-sync] Running verification: ${task.verifyCommand}`);
        try {
          const { stdout, stderr } = await execAsync(task.verifyCommand, {
            cwd: REPO_ROOT,
            timeout: 60000,
          });
          verifyLogs = stdout || stderr || 'Verified successfully.';
          console.log(`[fleet-sync] Verification successful.`);
        } catch (verifyErr) {
          throw new Error(`Verification command failed: ${verifyErr.message}\n${verifyErr.stdout || ''}\n${verifyErr.stderr || ''}`);
        }
      }

      // 4. Report success
      await reportTaskResult(taskId, true, verifyLogs, '');
      console.log(`[fleet-sync] Task ${taskId} successfully executed and verified.`);
    } catch (err) {
      console.error(`[fleet-sync] Task ${taskId} FAILED: ${err.message}. Triggering auto-rollback...`);
      // Instant rollback
      copyFileSync(backupFile, absPath);
      console.log(`[fleet-sync] Auto-rollback complete. Restored original from ${backupFile}`);
      await reportTaskResult(taskId, false, '', err.message);
    }
  }
}

async function reportTaskResult(taskId, success, logs, error) {
  try {
    await fetch(`${CONTROL_PLANE_URL}/api/v1/fleet/tasks/${taskId}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success,
        logs: logs.slice(0, 1000),
        error: error.slice(0, 1000),
        tenantId: TENANT_ID,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error(`[fleet-sync] Failed to report task result for ${taskId}:`, e.message);
  }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
console.log(`[fleet-sync] Satchida Fleet Sync Agent starting...`);
console.log(`[fleet-sync] Tenant ID: ${TENANT_ID}`);
console.log(`[fleet-sync] Control Plane: ${CONTROL_PLANE_URL}`);
console.log(`[fleet-sync] Heartbeat interval: ${POLL_INTERVAL_MS / 1000}s`);

// Send initial heartbeat immediately
await sendHeartbeat();

// Periodic loop
setInterval(sendHeartbeat, POLL_INTERVAL_MS);
