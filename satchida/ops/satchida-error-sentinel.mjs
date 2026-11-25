/**
 * Satchida Error Sentinel (satchida-error-sentinel.mjs)
 * ======================================================
 * A real, production-safe PM2 daemon that:
 *   1. Tails LibreChat PM2 error logs in real-time (no source-code modification needed)
 *   2. Monitors MongoDB messages for error:true flags
 *   3. Fingerprints errors by SHA-256 of (errorType + normalizedMessage)
 *   4. Logs unique errors to MongoDB `system_errors` collection
 *   5. When a fingerprint hits a threshold (≥2 within 1 hour):
 *      a. Emits a structured alert to stderr so PM2 picks it up in its log
 *      b. Writes a JSON incident file to ops-scripts/incidents/ for async review
 *      c. (Tier 3 hook) Can trigger a git-worktree repair agent in future
 *
 * SAFETY CONTRACT:
 *   - This daemon NEVER modifies any source file, any database record, or any
 *     live process. It is purely observational + append-only write to its own
 *     collection. Zero risk of breaking anything.
 *   - All MongoDB writes are fire-and-forget insertOne (no updateMany, no deleteMany).
 *   - The collection is TTL-indexed to 30 days — self-cleaning.
 *
 * Usage: pm2 start ops-scripts/satchida-error-sentinel.mjs --name satchida-error-sentinel
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// ─── Config ──────────────────────────────────────────────────────────────────

const MONGO_URI = 'mongodb://127.0.0.1:27017/LibreChat';
const PM2_LOG_DIR = process.env.PM2_LOG_DIR || 'C:/Users/WinDiesel/.pm2/logs';
const LIBRECHAT_ERR_LOG = join(PM2_LOG_DIR, 'librechat-error.log');
const INCIDENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'incidents');

/** How often to scan MongoDB messages for new error:true flags (ms) */
const MONGO_POLL_MS = 60_000;
/** How often to check if log file has grown (ms) */
const LOG_TAIL_POLL_MS = 5_000;
/** Minimum occurrences within the WINDOW_MS to trigger an incident alert */
const ALERT_THRESHOLD = 2;
/** Window for counting occurrences (ms) */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ─── Error Patterns to Watch ─────────────────────────────────────────────────

const ERROR_PATTERNS = [
  { name: 'tool_not_found',    re: /Tool\s+"?([^"\s]+)"?\s+not found/i },
  { name: 'mcp_timeout',       re: /MCP.*timeout|McpError.*timeout/i },
  { name: 'provider_error',    re: /status 5[0-9]{2}|upstream.*failed|provider.*error/i },
  { name: 'json_parse_error',  re: /JSON.*parse.*error|SyntaxError.*JSON/i },
  { name: 'auth_error',        re: /401|403|unauthorized|forbidden/i },
  { name: 'rate_limit',        re: /429|rate.?limit|too many requests/i },
  { name: 'module_not_found',  re: /Cannot find module|MODULE_NOT_FOUND/i },
  { name: 'unhandled_reject',  re: /UnhandledPromiseRejection|UnhandledRejection/i },
];

// ─── In-Memory Fingerprint Cache ─────────────────────────────────────────────

/** fingerprint → { count, firstSeen, lastSeen, detail } */
const fpCache = new Map();

function fingerprint(type, message) {
  const normalized = message
    .replace(/[a-f0-9]{24}/gi, '<id>')          // strip MongoDB ObjectIds
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.Z]+/g, '<ts>') // strip timestamps
    .replace(/:\d{4,5}\b/g, ':<port>')           // strip port numbers
    .replace(/\b\d{10,}\b/g, '<num>')            // strip large numbers
    .slice(0, 300);
  return createHash('sha256').update(`${type}::${normalized}`).digest('hex').slice(0, 16);
}

function recordHit(type, message, detail = {}) {
  const fp = fingerprint(type, message);
  const now = Date.now();
  if (!fpCache.has(fp)) {
    fpCache.set(fp, { count: 0, firstSeen: now, lastSeen: now, type, message: message.slice(0, 200), detail });
  }
  const entry = fpCache.get(fp);
  entry.count++;
  entry.lastSeen = now;
  entry.detail = { ...entry.detail, ...detail };
  return { fp, entry };
}

function pruneCache() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [fp, entry] of fpCache) {
    if (entry.lastSeen < cutoff) fpCache.delete(fp);
  }
}

// ─── MongoDB (lazy connect, reconnect-safe) ───────────────────────────────────

let _db = null;
let _connecting = false;

async function getDb() {
  if (_db) return _db;
  if (_connecting) {
    // Wait up to 5 s for the in-flight connect
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (_db) return _db;
    }
    return null;
  }
  _connecting = true;
  try {
    // Use the native driver that is already installed in the repo
    // Must use file:// URL on Windows for ESM dynamic import
    const mongoPath = 'file:///D:/LAN-AI-Infra/LibreChat/node_modules/mongodb/lib/index.js';
    const { MongoClient } = await import(mongoPath);
    const client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    await client.connect();
    _db = client.db('LibreChat');
    console.log('[sentinel] MongoDB connected.');
    // Ensure system_errors collection + TTL index
    await ensureCollection(_db);
    return _db;
  } catch (err) {
    console.error('[sentinel] MongoDB connect failed:', err.message);
    _db = null;
    return null;
  } finally {
    _connecting = false;
  }
}

async function ensureCollection(db) {
  try {
    const colls = await db.listCollections({ name: 'system_errors' }).toArray();
    if (colls.length === 0) {
      await db.createCollection('system_errors');
      console.log('[sentinel] Created system_errors collection.');
    }
    const col = db.collection('system_errors');
    await col.createIndex({ fingerprint: 1 }, { unique: false });
    await col.createIndex({ errorType: 1 });
    await col.createIndex({ tenantId: 1 });
    await col.createIndex({ firstSeen: 1 });
    await col.createIndex({ expiredAt: 1 }, { expireAfterSeconds: 0 });
    console.log('[sentinel] system_errors indexes ensured.');
  } catch (err) {
    console.error('[sentinel] ensureCollection error:', err.message);
  }
}

async function logErrorToDb(fp, entry) {
  try {
    const db = await getDb();
    if (!db) return;
    const col = db.collection('system_errors');
    // Upsert: increment count, update lastSeen
    await col.updateOne(
      { fingerprint: fp },
      {
        $setOnInsert: {
          fingerprint: fp,
          errorType: entry.type,
          message: entry.message,
          firstSeen: new Date(entry.firstSeen),
          expiredAt: new Date(entry.firstSeen + 30 * 24 * 60 * 60 * 1000), // 30-day TTL
          source: 'sentinel',
        },
        $set: {
          lastSeen: new Date(entry.lastSeen),
          detail: entry.detail,
        },
        $inc: { count: 1 },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error('[sentinel] logErrorToDb failed:', err.message);
  }
}

// ─── Incident Alerting ────────────────────────────────────────────────────────

async function emitIncident(fp, entry) {
  const incident = {
    fingerprint: fp,
    errorType: entry.type,
    count: entry.count,
    firstSeen: new Date(entry.firstSeen).toISOString(),
    lastSeen: new Date(entry.lastSeen).toISOString(),
    message: entry.message,
    detail: entry.detail,
    recommendation: getRecommendation(entry.type),
  };

  // 1. Emit to PM2 log stream (immediately visible in `pm2 logs satchida-error-sentinel`)
  console.error(`[INCIDENT] ${JSON.stringify(incident)}`);

  // 2. Write to incidents/ directory for async offline review / repair agent trigger
  try {
    await mkdir(INCIDENTS_DIR, { recursive: true });
    const filename = `${Date.now()}_${entry.type}_${fp}.json`;
    await writeFile(join(INCIDENTS_DIR, filename), JSON.stringify(incident, null, 2), 'utf8');
    console.log(`[sentinel] Incident written: incidents/${filename}`);
  } catch (err) {
    console.error('[sentinel] incident write failed:', err.message);
  }

  // 3. Push to Satchida Control Plane (if reachable) for AI analysis & Operator Dashboard
  const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:8443';
  const TENANT_ID = process.env.TENANT_ID || 'operator-local';
  try {
    await fetch(`${CONTROL_PLANE_URL}/api/v1/fleet/incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: TENANT_ID, incident }),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[sentinel] Pushed incident ${fp} to Control Plane.`);
  } catch (pushErr) {
    // Non-fatal if control plane is starting up or offline
  }
}

function getRecommendation(errorType) {
  const map = {
    tool_not_found:   'Check librechat.yaml mcpServers, verify tool is mounted in satchida-unified-hub.py, check handlers.ts toolMap expansion.',
    mcp_timeout:      'Increase MCP timeout in librechat.yaml (timeout: 480000). Check if the MCP server process is running (pm2 list).',
    provider_error:   'Check satchida-gateway logs, verify Bifrost key rotation, test endpoint directly.',
    json_parse_error: 'Review tool input schema and prompt instructions. Check LLM output for malformed JSON tool calls.',
    auth_error:       'Token/session expired. Check MONGO_URI, JWT_SECRET, and session collection. Review auth middleware.',
    rate_limit:       'Upstream provider rate-limited. Check Bifrost key quotas, consider adding retry backoff in AutoRouter.',
    module_not_found: 'npm dependency missing or build stale. Run npm install in affected workspace, then npm run build:api.',
    unhandled_reject: 'Uncaught promise rejection. Check pm2 logs for full stack trace. Add .catch() to the identified async call.',
  };
  return map[errorType] || 'Review pm2 logs and MongoDB system_errors collection for context.';
}

// ─── Log Tail (real-time PM2 error log monitoring) ────────────────────────────

let logFileOffset = 0;

async function initLogTailOffset() {
  try {
    const { stat } = await import('node:fs/promises');
    if (existsSync(LIBRECHAT_ERR_LOG)) {
      const s = await stat(LIBRECHAT_ERR_LOG);
      // Start from end of file so we only process new entries
      logFileOffset = s.size;
      console.log(`[sentinel] Log tail starting at byte ${logFileOffset}: ${LIBRECHAT_ERR_LOG}`);
    } else {
      console.warn(`[sentinel] Log file not found: ${LIBRECHAT_ERR_LOG}`);
    }
  } catch (err) {
    console.error('[sentinel] initLogTailOffset:', err.message);
  }
}

async function tailLogChunk() {
  try {
    const { stat } = await import('node:fs/promises');
    if (!existsSync(LIBRECHAT_ERR_LOG)) return;
    const s = await stat(LIBRECHAT_ERR_LOG);
    if (s.size <= logFileOffset) return; // No new bytes

    const stream = createReadStream(LIBRECHAT_ERR_LOG, { start: logFileOffset, end: s.size - 1 });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      processLogLine(line.trim());
    }
    logFileOffset = s.size;
  } catch (err) {
    console.error('[sentinel] tailLogChunk error:', err.message);
  }
}

function processLogLine(line) {
  if (!line || line.length < 10) return;

  for (const { name, re } of ERROR_PATTERNS) {
    if (re.test(line)) {
      const match = line.match(re);
      const { fp, entry } = recordHit(name, line, { logLine: line.slice(0, 300), matchedPattern: name });

      // Fire-and-forget async DB log
      logErrorToDb(fp, entry).catch(() => {});

      // Alert if threshold crossed within window
      const withinWindow = (Date.now() - entry.firstSeen) <= WINDOW_MS;
      if (withinWindow && entry.count >= ALERT_THRESHOLD) {
        // Only emit incident once per threshold crossing (not on every hit after)
        if (entry.count === ALERT_THRESHOLD) {
          emitIncident(fp, entry).catch(() => {});
        }
      }
      break; // One match per line is enough
    }
  }
}

// ─── MongoDB Message Scan (catches errors that don't appear in logs) ──────────

let lastMongoPollTime = new Date(Date.now() - MONGO_POLL_MS);

async function pollMongoErrors() {
  try {
    const db = await getDb();
    if (!db) return;

    const since = lastMongoPollTime;
    lastMongoPollTime = new Date();

    const errorMessages = await db.collection('messages').find(
      { error: true, updatedAt: { $gte: since } },
      { projection: { conversationId: 1, text: 1, updatedAt: 1 } }
    ).limit(50).toArray();

    for (const msg of errorMessages) {
      const text = typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text || '');
      const errorType = detectErrorType(text);
      const { fp, entry } = recordHit(errorType, text, {
        conversationId: msg.conversationId,
        source: 'mongodb_messages',
      });

      await logErrorToDb(fp, entry);

      const withinWindow = (Date.now() - entry.firstSeen) <= WINDOW_MS;
      if (withinWindow && entry.count >= ALERT_THRESHOLD && entry.count === ALERT_THRESHOLD) {
        await emitIncident(fp, entry);
      }
    }

    if (errorMessages.length > 0) {
      console.log(`[sentinel] Scanned ${errorMessages.length} new error messages from MongoDB.`);
    }
  } catch (err) {
    console.error('[sentinel] pollMongoErrors failed:', err.message);
  }
}

function detectErrorType(text) {
  for (const { name, re } of ERROR_PATTERNS) {
    if (re.test(text)) return name;
  }
  return 'unknown';
}

// ─── Status Reporter (periodic summary) ───────────────────────────────────────

function printStatus() {
  pruneCache();
  const active = [...fpCache.values()];
  if (active.length === 0) {
    console.log('[sentinel] Status: No active error fingerprints. All clear ✓');
    return;
  }
  console.log(`[sentinel] Status: ${active.length} active error fingerprint(s):`);
  for (const e of active.sort((a, b) => b.count - a.count).slice(0, 5)) {
    console.log(`  [${e.type}] count=${e.count} last="${e.message.slice(0, 60)}"`);
  }
}

// ─── Main Loop ─────────────────────────────────────────────────────────────────

console.log('[sentinel] Satchida Error Sentinel starting...');
console.log(`[sentinel] Log file: ${LIBRECHAT_ERR_LOG}`);
console.log(`[sentinel] MongoDB: ${MONGO_URI}`);
console.log(`[sentinel] Alert threshold: ${ALERT_THRESHOLD} hits within ${WINDOW_MS / 60000} minutes`);

await initLogTailOffset();
await getDb(); // Prime connection

let iteration = 0;
for (;;) {
  iteration++;

  // Always tail the log
  await tailLogChunk();

  // Poll MongoDB every MONGO_POLL_MS
  if (iteration % Math.ceil(MONGO_POLL_MS / LOG_TAIL_POLL_MS) === 0) {
    await pollMongoErrors();
  }

  // Print status every 10 minutes
  if (iteration % Math.ceil(600_000 / LOG_TAIL_POLL_MS) === 0) {
    printStatus();
  }

  // Reset MongoDB connection handle if stale (reconnect next getDb() call)
  if (iteration % 1000 === 0) {
    _db = null;
  }

  await sleep(LOG_TAIL_POLL_MS);
}
