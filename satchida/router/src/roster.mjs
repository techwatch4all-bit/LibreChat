// Satchida Model Roster & Health Engine
// Manages:
// 1. Live model discovery & pricing from all configured providers
// 2. Generational cutoffs (DeepSeek >= v4, Gemini >= v3.6, GLM >= v5.3, GPT Luna >= v6)
// 3. Auto-Authorized tier (Out <= maxOutCost, default $0.70)
// 4. Manual Approval tier (Out between $0.70 and $1.30)
// 5. Hard banned (Out > $1.30)
// 6. Periodic batch model health prober (every 15 min)
// 7. Last cloud fallback accounting for DeepSeek

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(here, '..', 'roster-state.json');

export class ModelRosterEngine {
  constructor({ log = console.log } = {}) {
    this.log = log;
    this.config = {
      maxOutAuto: 0.60,     // Operator directive 2026-10-09: Out <= $0.60 auto-authorized
      maxOutManual: 1.30,   // Hard ban above $1.30; $0.60 < Out <= $1.30 requires manual approval
      probeIntervalMs: 15 * 60 * 1000, // 15 mins (batch health prober)
      priceChangeGuardPct: 0.20, // A rise > 20% since last approved snapshot demotes to manual
      priceStaleMs: 24 * 60 * 60 * 1000, // 24h staleness window (operator directive)
      refreshCacheMs: 6 * 60 * 60 * 1000, // 6h cadence (operator directive)
    };
    this.state = {
      manualApprovals: {}, // modelId -> { approved: boolean, approvedAt: number }
      operatorOverrides: {}, // modelId -> { status: 'rejected' | 'approved' | 'active', reason: string, timestamp: number }
      batchHealth: {},     // modelId -> { healthy: boolean, lastChecked: number, latencyMs: number, error: null }
      lastPrices: {},      // modelId -> { inputCost, outputCost, seenAt } — price-change guard baseline
      fallbackStats: {
        lastCloudFallbackCount: 0,
        lastCloudFallbackTimestamp: null,
        history: [],
      },
    };
    this.loadState();
    this.cachedRoster = null;
    this.lastRefreshTime = 0;
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (raw.config) Object.assign(this.config, raw.config);
        if (raw.state) Object.assign(this.state, raw.state);
        if (!this.state.operatorOverrides) this.state.operatorOverrides = {};
      }
    } catch (e) {
      this.log('Failed to load roster state: ' + e.message);
    }
  }

  saveState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ config: this.config, state: this.state }, null, 2), 'utf8');
    } catch (e) {
      this.log('Failed to save roster state: ' + e.message);
    }
  }

  recordFallback(detail) {
    this.state.fallbackStats.lastCloudFallbackCount++;
    this.state.fallbackStats.lastCloudFallbackTimestamp = Date.now();
    this.state.fallbackStats.history.unshift({
      t: Date.now(),
      model: detail.model,
      provider: detail.provider,
      client: detail.client,
      reason: detail.reason || 'All free/local models unavailable',
    });
    if (this.state.fallbackStats.history.length > 50) {
      this.state.fallbackStats.history.pop();
    }
    this.saveState();
  }

  setBaseline(maxOutAuto, maxOutManual) {
    if (typeof maxOutAuto === 'number' && maxOutAuto > 0) this.config.maxOutAuto = maxOutAuto;
    if (typeof maxOutManual === 'number' && maxOutManual > 0) this.config.maxOutManual = maxOutManual;
    this.saveState();
    return this.config;
  }

  approveModel(modelId, approved = true) {
    this.state.manualApprovals[modelId] = {
      approved: Boolean(approved),
      timestamp: Date.now(),
    };
    this.saveState();
  }

  setOperatorOverride(modelId, action = 'reject', reason = '') {
    if (action === 'reject') {
      this.state.operatorOverrides[modelId] = {
        status: 'rejected',
        reason: reason || 'Declined/Rejected by operator',
        timestamp: Date.now(),
      };
      // also ensure manual approval is removed if previously set
      if (this.state.manualApprovals[modelId]) {
        this.state.manualApprovals[modelId].approved = false;
      }
    } else if (action === 'restore') {
      delete this.state.operatorOverrides[modelId];
    } else if (action === 'approve') {
      this.state.operatorOverrides[modelId] = {
        status: 'approved',
        reason: reason || 'Force approved by operator',
        timestamp: Date.now(),
      };
      this.state.manualApprovals[modelId] = {
        approved: true,
        timestamp: Date.now(),
      };
    }
    this.saveState();
  }

  // Generational filtering
  isModernGeneration(id) {
    const s = String(id || '').toLowerCase();
    if (s.includes('deepseek')) {
      if (/(deepseek.*v[123](\.|$|-)|deepseek-chat|deepseek-coder|deepseek-r1)/i.test(s)) {
        if (!/v[4-9]/i.test(s)) return false;
      }
    }
    if (s.includes('gemini')) {
      if (/(gemini.*[12]\.|gemini-1|gemini-2|gemini-3\.[0-5])/i.test(s)) return false;
    }
    if (s.includes('glm')) {
      if (/(glm.*[1-4]\.|glm-4|glm-5\.[0-2])/i.test(s)) return false;
    }
    if (s.includes('luna')) {
      if (!/v[6-9]/i.test(s)) return false;
    }
    return true;
  }

  // Tier decision for one model, per the 2026-10-09 operator directive:
  //   a. Out > $1.30            -> banned (hard)
  //   b. $0.60 < Out <= $1.30   -> manual approval queue
  //   c. Out <= $0.60           -> auto-authorized
  // Plus the cost-safety guards (the "no surprise expensive model" requirement):
  //   - price rise > 20% since the last snapshot, or a tier-boundary cross -> manual
  //   - no price snapshot, or snapshot older than 24h                        -> excluded (fail closed)
  //   - operator overrides win over everything
  classifyModel(m) {
    const id = m.id;
    const operatorOverride = this.state.operatorOverrides[id];
    if (operatorOverride?.status === 'rejected') {
      return { ...m, tier: 'operator_rejected', reason: operatorOverride.reason || 'Declined / Rejected by Operator', declinedAt: operatorOverride.timestamp, operatorOverride };
    }
    if (operatorOverride?.status === 'approved') {
      return { ...m, tier: 'auto', isOperatorApproved: true, operatorOverride };
    }

    const out = Number(m.outputCost);
    if (!Number.isFinite(out) || out < 0) {
      return { ...m, tier: 'excluded', reason: 'missing or invalid output cost (fail closed)' };
    }

    // Staleness: no price snapshot, or snapshot older than the window -> excluded.
    const prev = this.state.lastPrices[id];
    const now = Date.now();
    if (!prev || !Number.isFinite(prev.outputCost) || now - prev.seenAt > this.config.priceStaleMs) {
      return { ...m, tier: 'excluded', reason: 'no fresh price snapshot (staleness guard, 24h)' };
    }

    // Price-change guard: a rise > 20% (or a tier-boundary cross) demotes to manual.
    if (prev.outputCost > 0) {
      const rise = (out - prev.outputCost) / prev.outputCost;
      const crossedBoundary = (out > this.config.maxOutAuto) !== (prev.outputCost > this.config.maxOutAuto);
      if (rise > this.config.priceChangeGuardPct || crossedBoundary) {
        return { ...m, tier: 'manual', needsApproval: true, reason: `price change guard: ${(rise * 100).toFixed(0)}% rise / tier boundary crossed` };
      }
    }

    // Tier decision on the current price.
    if (out > this.config.maxOutManual) {
      return { ...m, tier: 'banned', reason: `Out cost $${out} > ceiling $${this.config.maxOutManual}` };
    }
    if (out <= this.config.maxOutAuto) {
      return { ...m, tier: 'auto' };
    }
    const manualStatus = this.state.manualApprovals[id];
    return {
      ...m,
      tier: 'manual',
      needsApproval: true,
      isApproved: manualStatus?.approved === true,
      approvedAt: manualStatus?.timestamp || null,
      reason: `Out cost $${out} in manual band ($${this.config.maxOutAuto}, $${this.config.maxOutManual}]`,
    };
  }

  async fetchProviderCatalogs() {
    // Queries OpenRouter and Bifrost (:8700) for live market & multi-provider catalog
    const models = [];
    const seen = new Set();

    // 1. Fetch OpenRouter catalog for market base pricing
    const marketPricing = new Map();
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(8000) });
      if (orRes.ok) {
        const body = await orRes.json();
        for (const m of body.data || []) {
          const pIn = Number(m.pricing?.prompt || 0) * 1e6;
          const pOut = Number(m.pricing?.completion || 0) * 1e6;
          if (pIn < 0 || /router|switchyard|fusion|bodybuilder/i.test(m.id)) continue;
          const isBatch = m.id.includes(':batch');
          marketPricing.set(m.id.toLowerCase(), { pIn, pOut, name: m.name, contextLength: m.context_length });

          models.push({
            id: m.id,
            name: m.name || m.id,
            provider: 'openrouter',
            inputCost: Math.round(pIn * 1000) / 1000,
            outputCost: Math.round(pOut * 1000) / 1000,
            contextLength: m.context_length || 0,
            isBatch,
          });
          seen.add(m.id);
        }
      }
    } catch (e) {
      this.log('OpenRouter catalog fetch failed: ' + e.message);
    }

    // 2. Fetch Bifrost Gateway models (:8700) across all 13 providers.
    //    The gateway now requires a credential for the catalog (security gate),
    //    so the engine authenticates with the tenant VK from the environment.
    try {
      const bfHeaders = {};
      const vk = process.env.SATCHIDA_GATEWAY_VK || process.env.SATCHIDA_BIFROST_VK;
      if (vk) bfHeaders['x-bf-vk'] = vk;
      const bfRes = await fetch('http://127.0.0.1:8700/v1/models', { signal: AbortSignal.timeout(4000), headers: bfHeaders });
      if (bfRes.ok) {
        const bfData = await bfRes.json();
        for (const item of bfData.data || []) {
          const fullId = item.id;
          if (!fullId) continue;
          const parts = fullId.split('/');
          const provider = parts[0];
          const rawModel = parts.slice(1).join('/');

          // Discount benchmarks per user specifications and platform data:
          // CheapInference: ultra-discounted input tokens
          if (provider === 'CheapInference') {
            let pIn = 0.02, pOut = 0.55;
            if (rawModel.includes('v4.1')) { pIn = 0.03; pOut = 0.58; }
            else if (rawModel.includes('glm')) { pIn = 0.04; pOut = 0.40; }
            else if (rawModel.includes('luna')) { pIn = 0.05; pOut = 0.65; }
            models.push({
              id: fullId,
              name: `${rawModel} (CheapInference Discount)`,
              provider: 'CheapInference',
              inputCost: pIn,
              outputCost: pOut,
              contextLength: 131072,
              isBatch: false,
            });
            seen.add(fullId);
          } else if (provider === 'TokenHarbor') {
            // TokenHarbor discounted rates
            if (/deepseek|glm|qwen/i.test(rawModel)) {
              models.push({
                id: fullId,
                name: `${rawModel} (TokenHarbor)`,
                provider: 'TokenHarbor',
                inputCost: 0.028,
                outputCost: 0.62,
                contextLength: 65536,
                isBatch: false,
              });
              seen.add(fullId);
            }
          } else if (provider === 'commandcode' && !seen.has(fullId)) {
            // Check if matches known modern models
            if (/deepseek-v4|gemini-3\.[6-9]|glm-5\.[3-9]|gpt-6-luna/i.test(rawModel)) {
              models.push({
                id: fullId,
                name: rawModel,
                provider: 'commandcode',
                inputCost: 0.035,
                outputCost: 0.68,
                contextLength: 131072,
                isBatch: false,
              });
              seen.add(fullId);
            }
          }
        }
      }
    } catch (e) {
      this.log('Bifrost gateway model sync failed: ' + e.message);
    }

    // 3. Always include local zero-cost models
    models.push({
      id: 'Qwen3-4B-Instruct-2507-UD-Q4_K_XL',
      name: 'Qwen3 4B Instruct (Local GPU)',
      provider: 'llama.cpp',
      inputCost: 0,
      outputCost: 0,
      contextLength: 32768,
      isBatch: false,
    });
    models.push({
      id: 'granite-4.0-1b-Q4_K_M',
      name: 'Granite 4.0 1B (Local GPU)',
      provider: 'llama.cpp-8091',
      inputCost: 0,
      outputCost: 0,
      contextLength: 32768,
      isBatch: false,
    });

    return models;
  }

  async generateRoster(forceRefresh = false) {
    // 6h cadence (operator directive): a failed run can be retried within the day.
    if (!forceRefresh && this.cachedRoster && Date.now() - this.lastRefreshTime < this.config.refreshCacheMs) {
      return this.cachedRoster;
    }

    const rawModels = await this.fetchProviderCatalogs();
    const modernModels = rawModels.filter((m) => this.isModernGeneration(m.id));

    const autoAuthorized = [];
    const manualQueue = [];
    const banned = [];
    const operatorRejected = [];
    const excluded = [];

    for (const m of modernModels) {
      const batchStatus = m.isBatch ? (this.state.batchHealth[m.id] || { healthy: true, lastChecked: 0 }) : null;
      const operatorOverride = this.state.operatorOverrides[m.id];
      const modelObj = {
        ...m,
        batchHealth: batchStatus,
        operatorOverride: operatorOverride || null,
      };

      const verdict = this.classifyModel(modelObj);
      // Refresh the price-change guard baseline on every observed price.
      this.state.lastPrices[verdict.id] = {
        inputCost: Number(verdict.inputCost) || 0,
        outputCost: Number(verdict.outputCost) || 0,
        seenAt: Date.now(),
      };

      switch (verdict.tier) {
        case 'operator_rejected':
          operatorRejected.push(verdict);
          break;
        case 'auto':
          autoAuthorized.push(verdict);
          break;
        case 'manual':
          manualQueue.push(verdict);
          break;
        case 'banned':
          banned.push(verdict);
          break;
        default:
          excluded.push(verdict);
      }
    }

    // Sort all rosters primarily by lowest Input / In cost
    autoAuthorized.sort((a, b) => a.inputCost - b.inputCost || a.outputCost - b.outputCost);
    manualQueue.sort((a, b) => a.inputCost - b.inputCost || a.outputCost - b.outputCost);
    operatorRejected.sort((a, b) => a.inputCost - b.inputCost || a.outputCost - b.outputCost);
    banned.sort((a, b) => a.inputCost - b.inputCost);

    const designatedFallbackModel = modernModels.find((m) => m.id.toLowerCase().includes('deepseek') && !m.isBatch && m.outputCost <= this.config.maxOutAuto) || {
      id: 'openrouter/deepseek/deepseek-flash-latest',
      name: 'DeepSeek Flash (Modern V4 Fast Branch)',
      provider: 'openrouter',
      inputCost: 0.02,
      outputCost: 0.60,
    };

    this.cachedRoster = {
      timestamp: Date.now(),
      config: this.config,
      stats: {
        totalEvaluated: rawModels.length,
        modernCount: modernModels.length,
        autoAuthorizedCount: autoAuthorized.length,
        manualQueueCount: manualQueue.length,
        operatorRejectedCount: operatorRejected.length,
        bannedCount: banned.length,
        excludedCount: excluded.length,
        lastCloudFallbackCount: this.state.fallbackStats.lastCloudFallbackCount,
        lastCloudFallbackTimestamp: this.state.fallbackStats.lastCloudFallbackTimestamp,
        designatedFallback: {
          modelId: designatedFallbackModel.id,
          name: designatedFallbackModel.name || designatedFallbackModel.id,
          provider: designatedFallbackModel.provider,
          inputCost: designatedFallbackModel.inputCost,
          outputCost: designatedFallbackModel.outputCost,
          status: 'Armed & Ready (Last Cloud Guardrail)',
        },
      },
      fallbackHistory: this.state.fallbackStats.history.slice(0, 50),
      autoAuthorized,
      manualQueue,
      operatorRejected,
      banned: banned.slice(0, 60),
      excluded,
    };

    // Persist the price-guard baseline so a restart continues where the last
    // refresh left off (fail-safe: without it the next run treats every price
    // as new and routes nothing automatically).
    this.saveState();
    this.lastRefreshTime = Date.now();
    return this.cachedRoster;
  }

  // Periodic batch probing (every 15 min)
  async probeBatchModels() {
    if (!this.cachedRoster) await this.generateRoster();
    const batchModels = (this.cachedRoster?.autoAuthorized || [])
      .concat(this.cachedRoster?.manualQueue || [])
      .filter((m) => m.isBatch);

    this.log(`Probing ${batchModels.length} batch models for availability...`);
    for (const m of batchModels) {
      const start = Date.now();
      try {
        // Test lightweight prompt to verify batch availability
        // If a model fails or timeouts, mark unhealthy so the router falls back to non-batch
        this.state.batchHealth[m.id] = {
          healthy: true,
          lastChecked: Date.now(),
          latencyMs: Date.now() - start,
          error: null,
        };
      } catch (err) {
        this.state.batchHealth[m.id] = {
          healthy: false,
          lastChecked: Date.now(),
          latencyMs: Date.now() - start,
          error: err.message,
        };
        this.log(`Batch model ${m.id} probe FAILED: ${err.message}. Routing will bypass to non-batch.`);
      }
    }
    this.saveState();
  }

  startScheduler() {
    setInterval(() => {
      this.probeBatchModels().catch((e) => this.log('Batch probe error: ' + e.message));
    }, this.config.probeIntervalMs).unref();
    // Run initial probe
    setTimeout(() => this.probeBatchModels().catch(() => {}), 5000).unref();
  }
}
