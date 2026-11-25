/**
 * Satchida Control Plane (control-plane.mjs)
 * ===========================================
 * Centralized telemetry receiver, AI analysis coordinator, patch dispatcher,
 * and Operator Dashboard server for Satchida Distributed Multi-Tenant Fleet.
 *
 * ZERO-DEPENDENCY NATIVE NODE ENGINE:
 * Uses node:http and native ESM. Zero external npm dependencies required.
 *
 * Runs natively on the Operator PC on port 8443 (and 8444 for operator UI).
 * Exposed via Cloudflare Zero Trust tunnel as control.satchida.com.
 */

import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeIncident } from './fleet-ai-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.CONTROL_PLANE_PORT || '8443', 10);
const DASHBOARD_PORT = parseInt(process.env.OPERATOR_DASHBOARD_PORT || '8444', 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
const FLEET_SECRET = process.env.FLEET_SECRET || 'satchida_master_fleet_secret_2026';

// ─── MongoDB Connection ────────────────────────────────────────────────────────
let _db = null;
async function getDb() {
  if (_db) return _db;
  try {
    const mongoPath = 'file:///D:/LAN-AI-Infra/LibreChat/node_modules/mongodb/lib/index.js';
    const { MongoClient } = await import(mongoPath);
    const client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    _db = client.db('LibreChat');
    console.log('[control-plane] Central MongoDB connected.');
    await initCollections(_db);
    return _db;
  } catch (err) {
    console.error('[control-plane] MongoDB connect failed:', err.message);
    return null;
  }
}

async function initCollections(db) {
  try {
    const colls = await db.listCollections().toArray();
    const names = new Set(colls.map(c => c.name));

    if (!names.has('fleet_tenants')) {
      await db.createCollection('fleet_tenants');
      await db.collection('fleet_tenants').createIndex({ tenantId: 1 }, { unique: true });
    }
    if (!names.has('fleet_incidents')) {
      await db.createCollection('fleet_incidents');
      await db.collection('fleet_incidents').createIndex({ fingerprint: 1 });
      await db.collection('fleet_incidents').createIndex({ tenantId: 1 });
      await db.collection('fleet_incidents').createIndex({ status: 1 });
      await db.collection('fleet_incidents').createIndex({ createdAt: -1 });
    }
    if (!names.has('fleet_tasks')) {
      await db.createCollection('fleet_tasks');
      await db.collection('fleet_tasks').createIndex({ tenantId: 1 });
      await db.collection('fleet_tasks').createIndex({ status: 1 });
    }
    console.log('[control-plane] Collections and indexes initialized.');
  } catch (e) {
    console.error('[control-plane] Collection init error:', e.message);
  }
}

// ─── SSE Clients ──────────────────────────────────────────────────────────────
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ─── Request Body Helper ──────────────────────────────────────────────────────
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-satchida-sig, x-tenant-id',
  });
  res.end(JSON.stringify(data));
}

// ─── Incident Handler ─────────────────────────────────────────────────────────
async function handleIncomingIncident(incidentData, tenantId, db) {
  const fp = incidentData.fingerprint || 'unknown';
  const now = new Date();

  let existing = null;
  if (db) {
    existing = await db.collection('fleet_incidents').findOne({ fingerprint: fp });
  }

  let incidentRecord;
  if (existing) {
    await db.collection('fleet_incidents').updateOne(
      { fingerprint: fp },
      {
        $inc: { count: incidentData.count || 1 },
        $set: { lastSeen: now, status: existing.status === 'resolved' ? 'reopened' : existing.status },
        $addToSet: { affectedTenants: tenantId }
      }
    );
    incidentRecord = await db.collection('fleet_incidents').findOne({ fingerprint: fp });
  } else {
    console.log(`[control-plane] New incident fingerprint ${fp}. Triggering AI analysis...`);
    const aiResult = await analyzeIncident({ ...incidentData, tenantId });

    incidentRecord = {
      fingerprint: fp,
      errorType: incidentData.errorType || 'unknown',
      message: incidentData.message || '',
      detail: incidentData.detail || {},
      count: incidentData.count || 1,
      affectedTenants: [tenantId],
      firstSeen: now,
      lastSeen: now,
      status: 'detected',
      aiAnalysis: aiResult.analysis || null,
      aiSuccess: aiResult.success || false,
      createdAt: now,
    };

    if (db) {
      await db.collection('fleet_incidents').insertOne(incidentRecord);
    }
  }

  broadcastSSE('incident', incidentRecord);
  return incidentRecord;
}

// ─── Native HTTP Request Dispatcher ───────────────────────────────────────────
async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-satchida-sig, x-tenant-id',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Dashboard Static HTML
  if (req.method === 'GET' && (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/')) {
    const indexPath = join(__dirname, 'dashboard', 'index.html');
    if (existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return createReadStream(indexPath).pipe(res);
    }
  }

  // 2. SSE Event Stream
  if (req.method === 'GET' && pathname === '/api/v1/fleet/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 3. Tenant Heartbeat & Error Telemetry Ingestion
  if (req.method === 'POST' && pathname === '/api/v1/fleet/heartbeat') {
    try {
      const body = await parseJsonBody(req);
      const { tenantId = 'unknown-tenant', host = '', status = 'online', metrics = {}, errors = [] } = body;
      const db = await getDb();
      const now = new Date();

      if (db) {
        await db.collection('fleet_tenants').updateOne(
          { tenantId },
          {
            $set: {
              tenantId,
              host,
              status,
              metrics,
              lastHeartbeat: now,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now }
          },
          { upsert: true }
        );

        if (Array.isArray(errors) && errors.length > 0) {
          for (const err of errors) {
            await handleIncomingIncident(err, tenantId, db);
          }
        }
      }

      let pendingTasks = [];
      if (db) {
        pendingTasks = await db.collection('fleet_tasks')
          .find({ tenantId: { $in: [tenantId, 'all'] }, status: 'pending' })
          .toArray();

        if (pendingTasks.length > 0) {
          const ids = pendingTasks.map(t => t._id);
          await db.collection('fleet_tasks').updateMany(
            { _id: { $in: ids } },
            { $set: { status: 'dispatched', dispatchedAt: now } }
          );
        }
      }

      broadcastSSE('heartbeat', { tenantId, status, lastHeartbeat: now, metrics });
      return sendJson(res, 200, { ok: true, timestamp: now.toISOString(), tasks: pendingTasks });
    } catch (err) {
      console.error('[control-plane] Heartbeat error:', err.message);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. Direct Incident Ingestion
  if (req.method === 'POST' && pathname === '/api/v1/fleet/incident') {
    try {
      const body = await parseJsonBody(req);
      const { tenantId = 'operator-local', incident } = body;
      if (!incident) return sendJson(res, 400, { error: 'Missing incident payload' });

      const db = await getDb();
      const record = await handleIncomingIncident(incident, tenantId, db);
      return sendJson(res, 200, { ok: true, incident: record });
    } catch (err) {
      console.error('[control-plane] Incident error:', err.message);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5. Operator Fleet Status
  if (req.method === 'GET' && pathname === '/api/v1/fleet/status') {
    try {
      const db = await getDb();
      if (!db) {
        return sendJson(res, 200, {
          ok: true,
          summary: { totalTenants: 1, onlineTenants: 1, openIncidents: 0, pendingTasks: 0 },
          tenants: [{ tenantId: 'operator-local', status: 'online', lastHeartbeat: new Date() }],
          incidents: [],
          tasks: [],
        });
      }

      const tenants = await db.collection('fleet_tenants').find({}).sort({ lastHeartbeat: -1 }).toArray();
      const incidents = await db.collection('fleet_incidents').find({}).sort({ lastSeen: -1 }).limit(30).toArray();
      const tasks = await db.collection('fleet_tasks').find({}).sort({ createdAt: -1 }).limit(20).toArray();

      const now = Date.now();
      let onlineCount = 0;
      for (const t of tenants) {
        const diff = now - new Date(t.lastHeartbeat).getTime();
        if (diff < 60000) {
          t.status = 'online';
          onlineCount++;
        } else {
          t.status = 'offline';
        }
      }

      return sendJson(res, 200, {
        ok: true,
        summary: {
          totalTenants: tenants.length,
          onlineTenants: onlineCount,
          openIncidents: incidents.filter(i => i.status !== 'resolved').length,
          pendingTasks: tasks.filter(t => t.status === 'pending' || t.status === 'dispatched').length,
        },
        tenants,
        incidents,
        tasks,
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 6. Deploy Patch
  if (req.method === 'POST' && pathname === '/api/v1/fleet/deploy-patch') {
    try {
      const body = await parseJsonBody(req);
      const { fingerprint, targetTenant = 'all', customPatch = null } = body;
      const db = await getDb();
      if (!db) return sendJson(res, 500, { error: 'Database unavailable' });

      let incident = null;
      if (fingerprint) {
        incident = await db.collection('fleet_incidents').findOne({ fingerprint });
      }

      const patchDetails = customPatch || incident?.aiAnalysis?.suggestedPatch;
      if (!patchDetails || !patchDetails.targetFile) {
        return sendJson(res, 400, { error: 'No valid patch found for this incident' });
      }

      const task = {
        type: 'apply_patch',
        tenantId: targetTenant,
        fingerprint: fingerprint || 'manual',
        patchType: incident?.aiAnalysis?.patchType || 'config',
        targetFile: patchDetails.targetFile,
        patchAction: incident?.aiAnalysis?.patchAction || 'code_replace',
        targetString: patchDetails.targetString || null,
        replacementString: patchDetails.replacementString || null,
        fullContent: patchDetails.fullContent || null,
        verifyCommand: customPatch?.verifyCommand !== undefined ? customPatch.verifyCommand : (incident?.aiAnalysis?.verifyCommand || null),
        status: 'pending',
        createdAt: new Date(),
      };

      const insertResult = await db.collection('fleet_tasks').insertOne(task);
      task._id = insertResult.insertedId;

      if (fingerprint) {
        await db.collection('fleet_incidents').updateOne(
          { fingerprint },
          { $set: { status: 'deploying', patchTaskId: task._id } }
        );
      }

      broadcastSSE('task_created', task);
      return sendJson(res, 200, { ok: true, taskId: task._id, message: 'Patch task queued for delivery.' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 7. Report Task Result
  const taskResultMatch = pathname.match(/^\/api\/v1\/fleet\/tasks\/([a-zA-Z0-9_-]+)\/result$/);
  if (req.method === 'POST' && taskResultMatch) {
    try {
      const taskId = taskResultMatch[1];
      const body = await parseJsonBody(req);
      const { success, logs = '', error = '', tenantId = 'unknown' } = body;
      const db = await getDb();

      if (db) {
        const mongoPath = 'file:///D:/LAN-AI-Infra/LibreChat/node_modules/mongodb/lib/index.js';
        const { ObjectId } = await import(mongoPath);
        const taskOid = ObjectId.isValid(taskId) ? new ObjectId(taskId) : null;

        const updateData = {
          status: success ? 'verified' : 'failed',
          resultLogs: logs,
          resultError: error,
          executedByTenant: tenantId,
          completedAt: new Date(),
        };

        if (taskOid) {
          await db.collection('fleet_tasks').updateOne({ _id: taskOid }, { $set: updateData });
          const task = await db.collection('fleet_tasks').findOne({ _id: taskOid });

          if (task && task.fingerprint) {
            await db.collection('fleet_incidents').updateOne(
              { fingerprint: task.fingerprint },
              { $set: { status: success ? 'resolved' : 'detected' } }
            );
          }
        }
      }

      broadcastSSE('task_completed', { taskId, success, logs, error, tenantId });
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 8. Resolve Incident
  if (req.method === 'POST' && pathname === '/api/v1/fleet/resolve-incident') {
    try {
      const body = await parseJsonBody(req);
      const { fingerprint } = body;
      const db = await getDb();
      if (db && fingerprint) {
        await db.collection('fleet_incidents').updateOne(
          { fingerprint },
          { $set: { status: 'resolved', resolvedAt: new Date() } }
        );
      }
      broadcastSSE('incident_resolved', { fingerprint });
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Fallback 404
  return sendJson(res, 404, { error: 'Not found' });
}

// ─── Start Servers ────────────────────────────────────────────────────────────

const server8443 = createServer(handleRequest);
server8443.listen(PORT, '0.0.0.0', () => {
  console.log(`[control-plane] Satchida Control Plane listening on http://0.0.0.0:${PORT}`);
  console.log(`[control-plane] Dashboard UI available at http://localhost:${PORT}/dashboard`);
});

const server8444 = createServer(handleRequest);
server8444.listen(DASHBOARD_PORT, '0.0.0.0', () => {
  console.log(`[control-plane] Dedicated Operator Dashboard listening on http://0.0.0.0:${DASHBOARD_PORT}`);
});
