// Fixture-based tests for the roster engine's directive behavior (2026-10-09).
// No network: classifyModel/isModernGeneration are pure against fixtures.
import { strict as assert } from 'node:assert';
import { ModelRosterEngine } from '../src/roster.mjs';

function engineWithState(extra = {}) {
  const e = new ModelRosterEngine({ log: () => {} });
  // Config is persisted; force directive values regardless of state file.
  Object.assign(e.config, {
    maxOutAuto: 0.60,
    maxOutManual: 1.30,
    priceChangeGuardPct: 0.20,
    priceStaleMs: 24 * 60 * 60 * 1000,
    refreshCacheMs: 6 * 60 * 60 * 1000,
  });
  e.state.lastPrices = {};
  Object.assign(e.state, extra);
  return e;
}

function seed(e, id, outCost, seenAgoMs = 1000) {
  e.state.lastPrices[id] = { inputCost: 0.1, outputCost: outCost, seenAt: Date.now() - seenAgoMs };
}

const fixtures = {
  autoLow: { id: 'openrouter/deepseek/deepseek-v4', provider: 'openrouter', inputCost: 0.05, outputCost: 0.59 },
  autoBoundary: { id: 'openrouter/deepseek/deepseek-v4.1', provider: 'openrouter', inputCost: 0.06, outputCost: 0.60 },
  manualLow: { id: 'openrouter/gemini/gemini-3.6', provider: 'openrouter', inputCost: 0.08, outputCost: 0.61 },
  manualCeiling: { id: 'openrouter/glm/glm-5.3', provider: 'openrouter', inputCost: 0.10, outputCost: 1.30 },
  banned: { id: 'openrouter/gpt/gpt-6-luna', provider: 'openrouter', inputCost: 0.20, outputCost: 1.31 },
};

let tests = 0;
function check(name, cond, detail = '') {
  tests++;
  assert.ok(cond, `FAIL ${name} ${detail}`);
  console.log(`  ok ${name}`);
}

// ---- Tier boundaries -------------------------------------------------------
{
  const e = engineWithState();
  seed(e, fixtures.autoLow.id, 0.59);
  seed(e, fixtures.autoBoundary.id, 0.60);
  seed(e, fixtures.manualLow.id, 0.61);
  seed(e, fixtures.manualCeiling.id, 1.30);
  seed(e, fixtures.banned.id, 1.31);
  const v1 = e.classifyModel(fixtures.autoLow);
  check('0.59 -> auto', v1.tier === 'auto');
  const v2 = e.classifyModel(fixtures.autoBoundary);
  check('0.60 (inclusive) -> auto', v2.tier === 'auto');
  const v3 = e.classifyModel(fixtures.manualLow);
  check('0.61 -> manual', v3.tier === 'manual' && v3.needsApproval);
  const v4 = e.classifyModel(fixtures.manualCeiling);
  check('1.30 (inclusive) -> manual', v4.tier === 'manual');
  const v5 = e.classifyModel(fixtures.banned);
  check('1.31 -> banned (hard)', v5.tier === 'banned');
}

// ---- Generation cutoffs ----------------------------------------------------
{
  const e = engineWithState();
  const cases = [
    ['openrouter/deepseek/deepseek-v3', false],
    ['openrouter/deepseek/deepseek-v4', true],
    ['openrouter/deepseek/deepseek-chat', false],
    ['openrouter/gemini/gemini-3.5', false],
    ['openrouter/gemini/gemini-3.6', true],
    ['openrouter/glm/glm-5.2', false],
    ['openrouter/glm/glm-5.3', true],
    ['openrouter/anthropic/gpt-6-luna-v6', true],
    ['openrouter/anthropic/gpt-6-luna-v5', false],
  ];
  for (const [id, want] of cases) {
    const got = e.isModernGeneration(id);
    check(`cutoff ${id} -> ${want}`, got === want, `got ${got}`);
  }
}

// ---- Price change guard (the "no surprise expensive model" rule) -----------
{
  const e = engineWithState();
  const m = { id: 'openrouter/deepseek/deepseek-v4.2', provider: 'openrouter', inputCost: 0.06, outputCost: 1.10 };
  seed(e, m.id, 0.50); // baseline: 0.50
  const verdict = e.classifyModel(m); // now 1.10 = +120% rise
  check('price doubled -> manual (never auto)', verdict.tier === 'manual', verdict.reason);
  check('price guard names the rise', String(verdict.reason).includes('120%'), verdict.reason);
}
{
  const e = engineWithState();
  const m = { id: 'openrouter/gemini/gemini-3.7', provider: 'openrouter', inputCost: 0.09, outputCost: 0.70 };
  seed(e, m.id, 0.58); // baseline 0.58 auto-band -> now 0.70 manual-band: boundary crossed
  const verdict = e.classifyModel(m);
  check('tier boundary crossed -> manual', verdict.tier === 'manual', verdict.reason);
}
{
  const e = engineWithState();
  const m = { id: 'openrouter/glm/glm-5.4', provider: 'openrouter', inputCost: 0.07, outputCost: 0.55 };
  seed(e, m.id, 0.50); // +10% rise, still inside the auto band -> stays auto
  const verdict = e.classifyModel(m);
  check('small rise stays auto', verdict.tier === 'auto', verdict.reason);
}

// ---- Staleness (fail closed) -----------------------------------------------
{
  const e = engineWithState();
  const m = { id: 'openrouter/deepseek/deepseek-v4.3', provider: 'openrouter', inputCost: 0.05, outputCost: 0.55 };
  const v = e.classifyModel(m); // no snapshot at all
  check('no price snapshot -> excluded (fail closed)', v.tier === 'excluded');
  seed(e, m.id, 0.55, 25 * 60 * 60 * 1000); // 25h old
  const v2 = e.classifyModel(m);
  check('snapshot older than 24h -> excluded', v2.tier === 'excluded');
}

// ---- Operator override wins -------------------------------------------------
{
  const e = engineWithState({ operatorOverrides: { 'openrouter/gpt/gpt-6-luna': { status: 'rejected', reason: 'review', timestamp: Date.now() } } });
  const v = e.classifyModel(fixtures.banned);
  check('operator rejected wins even for cheap model', v.tier === 'operator_rejected');
}
{
  const e = engineWithState({ operatorOverrides: { 'openrouter/glm/glm-5.3': { status: 'approved', reason: 'force', timestamp: Date.now() } } });
  const v = e.classifyModel(fixtures.manualCeiling);
  check('operator approved overrides manual band', v.tier === 'auto' && v.isOperatorApproved);
}

// ---- Ranking: lowest input cost first ---------------------------------------
{
  const e = engineWithState();
  const models = [
    { id: 'openrouter/glm/glm-5.3', provider: 'openrouter', inputCost: 0.10, outputCost: 0.50 },
    { id: 'openrouter/deepseek/deepseek-v4', provider: 'openrouter', inputCost: 0.02, outputCost: 0.55 },
    { id: 'openrouter/gemini/gemini-3.6', provider: 'openrouter', inputCost: 0.08, outputCost: 0.58 },
  ];
  for (const m of models) seed(e, m.id, m.outputCost);
  const auto = models.filter((m) => e.classifyModel(m).tier === 'auto');
  check('3 modern models classified auto', auto.length === 3);
  const sorted = [...auto].sort((a, b) => a.inputCost - b.inputCost);
  check('ranking: lowest input cost first', sorted[0].id.includes('deepseek-v4'), JSON.stringify(sorted.map((x) => x.id)));
}

console.log(`\nALL ROSTER DIRECTIVE TESTS PASSED (${tests} checks)`);
