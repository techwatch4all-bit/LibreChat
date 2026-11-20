const express = require('express');
const mongoose = require('mongoose');
const { execSync } = require('child_process');
const { SystemCapabilities, logger } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const requireAdminSurface = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);

router.use(requireJwtAuth, requireAdminSurface, requireReadUsers);

/**
 * Helper to fetch live tenant metadata from one-api.db SQLite database
 */
function getOneApiTenantsMap() {
  try {
    const stdout = execSync('python d:/LAN-AI-Infra/ops-scripts/get_oneapi_tenants.py', {
      encoding: 'utf8',
      timeout: 3000,
    });
    return JSON.parse(stdout);
  } catch (err) {
    logger.warn('[admin/tenants] Failed to read one-api.db tenants:', err.message);
    return {};
  }
}

/**
 * GET /api/admin/tenants/consumption
 * Aggregates token consumption, cost in credits, active models, user count,
 * and recent usage activity grouped by tenantId.
 */
router.get('/consumption', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: 'Database connection not ready' });
    }

    const { periodDays = 30 } = req.query;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - Number(periodDays));

    // 1. Aggregate lifetime & period token consumption per tenant
    const consumptionAggregation = await db
      .collection('transactions')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$userInfo.tenantId', 'satchida-master'] },
            totalTokens: { $sum: { $abs: '$rawAmount' } },
            promptTokens: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: '$rawAmount' }, 0],
              },
            },
            completionTokens: {
              $sum: {
                $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: '$rawAmount' }, 0],
              },
            },
            totalCostCredits: { $sum: { $abs: '$tokenValue' } },
            transactionCount: { $sum: 1 },
            activeUsers: { $addToSet: '$userInfo._id' },
            modelsUsed: { $addToSet: '$model' },
            lastActivity: { $max: '$createdAt' },
          },
        },
      ])
      .toArray();

    // 2. Fetch tenant user distributions & plans
    const tenantUserStats = await db
      .collection('users')
      .aggregate([
        {
          $group: {
            _id: { $ifNull: ['$tenantId', 'satchida-master'] },
            totalUsers: { $sum: 1 },
            accountTypes: { $push: '$accountType' },
            emails: { $push: '$email' },
          },
        },
      ])
      .toArray();

    const userStatsMap = new Map();
    for (const tu of tenantUserStats) {
      userStatsMap.set(tu._id, tu);
    }

    // 3. Model breakdown across transactions
    const modelBreakdown = await db
      .collection('transactions')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: {
              tenantId: { $ifNull: ['$userInfo.tenantId', 'satchida-master'] },
              model: '$model',
            },
            tokens: { $sum: { $abs: '$rawAmount' } },
            costCredits: { $sum: { $abs: '$tokenValue' } },
            calls: { $sum: 1 },
          },
        },
        {
          $sort: { tokens: -1 },
        },
      ])
      .toArray();

    // 4. Daily consumption trend for the period
    const dailyTrend = await db
      .collection('transactions')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: {
              tenantId: { $ifNull: ['$userInfo.tenantId', 'satchida-master'] },
              date: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
            },
            tokens: { $sum: { $abs: '$rawAmount' } },
            credits: { $sum: { $abs: '$tokenValue' } },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.date': 1 },
        },
      ])
      .toArray();

    // Fetch live metadata map from one-api.db
    const oneApiMap = getOneApiTenantsMap();

    // Combine data per tenant
    const tenants = [];
    const allTenantIds = new Set([
      ...consumptionAggregation.map((c) => c._id),
      ...tenantUserStats.map((u) => u._id),
      ...Object.keys(oneApiMap),
    ]);

    for (const tId of allTenantIds) {
      const consumption = consumptionAggregation.find((c) => c._id === tId) || {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCostCredits: 0,
        transactionCount: 0,
        activeUsers: [],
        modelsUsed: [],
        lastActivity: null,
      };

      const userStat = userStatsMap.get(tId) || {
        totalUsers: 0,
        accountTypes: [],
        emails: [],
      };

      const tenantModels = modelBreakdown
        .filter((m) => m._id.tenantId === tId)
        .map((m) => ({
          model: m._id.model,
          tokens: m.tokens,
          costCredits: m.costCredits,
          calls: m.calls,
        }));

      const tenantDaily = dailyTrend
        .filter((d) => d._id.tenantId === tId)
        .map((d) => ({
          date: d._id.date,
          tokens: d.tokens,
          credits: d.credits,
          count: d.count,
        }));

      // Account type breakdown
      const accountTypeCounts = {};
      for (const at of userStat.accountTypes) {
        const key = at || 'standard';
        accountTypeCounts[key] = (accountTypeCounts[key] || 0) + 1;
      }

      // Resolve human-friendly display name from one-api
      const oneApiMeta = oneApiMap[tId];
      let displayName = tId;
      if (oneApiMeta && oneApiMeta.displayName) {
        displayName = oneApiMeta.displayName;
      } else if (tId === 'satchida-master') {
        displayName = 'Satchida Master Tenant (HQ)';
      }

      tenants.push({
        tenantId: tId,
        name: displayName,
        plan: oneApiMeta?.plan || 'standard',
        maxSeats: oneApiMeta?.maxSeats || userStat.totalUsers || 1,
        totalUsers: userStat.totalUsers,
        activeUsersCount: consumption.activeUsers.length,
        accountTypeDistribution: accountTypeCounts,
        totalTokens: consumption.totalTokens,
        promptTokens: consumption.promptTokens,
        completionTokens: consumption.completionTokens,
        totalCostCredits: Math.round(consumption.totalCostCredits * 100) / 100,
        transactionCount: consumption.transactionCount,
        lastActivity: consumption.lastActivity,
        modelsUsed: consumption.modelsUsed,
        modelBreakdown: tenantModels,
        dailyTrend: tenantDaily,
      });
    }

    return res.status(200).json({
      success: true,
      periodDays: Number(periodDays),
      since: sinceDate.toISOString(),
      tenants,
    });
  } catch (error) {
    logger.error('[admin/tenants/consumption] Error aggregating consumption:', error);
    return res.status(500).json({ error: 'Failed to aggregate tenant consumption' });
  }
});

/**
 * GET /api/admin/tenants/fleet-ops
 * Fetches real-time fleet health, connected edge nodes, and active telemetry incidents
 */
router.get('/fleet-ops', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const oneApiMap = getOneApiTenantsMap();

    let fleetTenants = [];
    let fleetIncidents = [];
    let fleetTasks = [];

    if (db) {
      fleetTenants = await db
        .collection('fleet_tenants')
        .find({})
        .sort({ lastHeartbeat: -1 })
        .toArray();
      fleetIncidents = await db
        .collection('fleet_incidents')
        .find({})
        .sort({ lastSeen: -1 })
        .limit(30)
        .toArray();
      fleetTasks = await db
        .collection('fleet_tasks')
        .find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
    }

    // Map one-api human display names onto edge tenants
    const enrichedTenants = fleetTenants.map((t) => {
      const meta = oneApiMap[t.tenantId] || {};
      return {
        ...t,
        displayName: meta.displayName || t.tenantId,
        plan: meta.plan || 'standard',
        maxSeats: meta.maxSeats || 1,
      };
    });

    const enrichedIncidents = fleetIncidents.map((inc) => {
      const primaryTenant = inc.affectedTenants?.[0] || 'operator-local';
      const meta = oneApiMap[primaryTenant] || {};
      return {
        ...inc,
        tenantDisplayName: meta.displayName || primaryTenant,
      };
    });

    return res.status(200).json({
      success: true,
      tenants: enrichedTenants,
      incidents: enrichedIncidents,
      tasks: fleetTasks,
    });
  } catch (err) {
    logger.error('[admin/tenants/fleet-ops] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/tenants/launch-openhands
 * Triggers an isolated OpenHands worktree session for an incident
 */
router.post('/launch-openhands', async (req, res) => {
  try {
    const { fingerprint, tenantId } = req.body;
    if (!fingerprint) return res.status(400).json({ error: 'Missing incident fingerprint' });

    const db = mongoose.connection.db;
    let incident = null;
    if (db) {
      incident = await db.collection('fleet_incidents').findOne({ fingerprint });
    }

    // Import OpenHands bridge dynamically
    const bridgePath = 'file:///D:/LAN-AI-Infra/ops-scripts/openhands-bridge.mjs';
    const { createIncidentWorktree, prepareTaskPrompt } = await import(bridgePath);

    const worktreeInfo = await createIncidentWorktree(fingerprint, tenantId);
    const taskBriefPath = await prepareTaskPrompt(
      incident || { fingerprint, errorType: 'general' },
      worktreeInfo.worktreePath,
    );

    return res.status(200).json({
      success: true,
      worktreePath: worktreeInfo.worktreePath,
      branchName: worktreeInfo.branchName,
      taskBriefPath,
      openhandsUrl: 'http://localhost:3001',
      message: 'OpenHands vibecoding worktree prepared and ready.',
    });
  } catch (err) {
    logger.error('[admin/tenants/launch-openhands] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/tenants/deploy-patch
 * Gated patch deployment to edge nodes (internal backend proxy to avoid mixed-content/CORS)
 */
router.post('/deploy-patch', async (req, res) => {
  try {
    const { fingerprint, targetTenant = 'all', customPatch = null } = req.body;
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'Database unavailable' });

    let incident = null;
    if (fingerprint) {
      incident = await db.collection('fleet_incidents').findOne({ fingerprint });
    }

    const ai = incident?.aiAnalysis || {};
    const taskRecord = {
      type: 'apply_patch',
      tenantId: targetTenant,
      fingerprint: fingerprint || 'manual_patch',
      patchType: customPatch?.patchType || ai.patchType || 'config',
      targetFile: customPatch?.targetFile || ai.affectedFile || '',
      patchAction: customPatch?.patchAction || ai.patchAction || 'yaml_update',
      targetString: customPatch?.targetString || ai.suggestedPatch?.targetString || '',
      replacementString: customPatch?.replacementString || ai.suggestedPatch?.replacementString || '',
      fullContent: customPatch?.fullContent || null,
      verifyCommand: customPatch?.verifyCommand || ai.verifyCommand || '',
      status: 'pending',
      createdAt: new Date(),
    };

    const result = await db.collection('fleet_tasks').insertOne(taskRecord);
    if (incident) {
      await db.collection('fleet_incidents').updateOne(
        { fingerprint },
        { $set: { status: 'patch_queued', patchTaskId: result.insertedId } },
      );
    }

    logger.info(`[admin/tenants/deploy-patch] Patch task ${result.insertedId} queued for ${targetTenant}`);
    return res.status(200).json({ ok: true, taskId: result.insertedId, task: taskRecord });
  } catch (err) {
    logger.error('[admin/tenants/deploy-patch] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

const { createApplyTenantContractHandler } = require('@librechat/api');
const applyTenantContractHandler = createApplyTenantContractHandler();
router.post('/:tenantId/contract', (req, res) => applyTenantContractHandler(req, res));

module.exports = router;
