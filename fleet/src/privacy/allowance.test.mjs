import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateFairnessTier, createFairUseController } from './fairuse.mjs';
import { createAllowanceReader } from './allowance.mjs';

test('a purchased pack widens the seat allowance', () => {
  const base = evaluateFairnessTier({ gpuSecondsUsed: 400, activeSeats: 1 });
  assert.equal(base.tier, 'NORMAL');

  const withPack = evaluateFairnessTier({ gpuSecondsUsed: 400, activeSeats: 1, packGpuSeconds: 2000 });
  assert.equal(withPack.packGpuSeconds, 2000);
  assert.equal(withPack.baseGpuSecondsPerHour, 3600);
  assert.equal(withPack.seriousGpuSecondsPerHour, 5600);
  // The same consumption is a smaller share of a larger allowance.
  assert.ok(withPack.ratio < base.ratio);
  assert.equal(withPack.tier, 'NORMAL');
});

test('a pack lowers the tier of a seat the base allowance would have penalised', () => {
  // 3000 GPU-seconds against a 3600-second share is HARD (0.83 > 0.70).
  const heavy = evaluateFairnessTier({ gpuSecondsUsed: 3000, activeSeats: 1 });
  assert.equal(heavy.tier, 'HARD');
  // With a 2000-second pack the same use is 3000/5600 = 0.54, which is SOFT.
  const heavyWithPack = evaluateFairnessTier({
    gpuSecondsUsed: 3000,
    activeSeats: 1,
    packGpuSeconds: 2000,
  });
  assert.equal(heavyWithPack.tier, 'SOFT');
});

test('a pack does not rescue a seat that is far past even the widened allowance', () => {
  const severe = evaluateFairnessTier({
    gpuSecondsUsed: 20000,
    activeSeats: 1,
    packGpuSeconds: 2000,
  });
  assert.equal(severe.tier, 'SERIOUS');
});

test('the controller applies the pack allowance to the seat', () => {
  const controller = createFairUseController({ cServed: 1, prefillTps: 1000, decodeTps: 50 });
  controller.setPackAllowance('seat-a', 1800);
  const assessment = controller.evaluate('seat-a', { activeSeats: 1 });
  assert.equal(assessment.packGpuSeconds, 1800);
  assert.equal(assessment.seriousGpuSecondsPerHour, 3600 + 1800);
});

test('the allowance reader reads the operator and maps seats to balances', async () => {
  const calls = [];
  const reader = createAllowanceReader({
    operatorUrl: 'http://operator.test:4000/',
    tenantId: 'tenant-a',
    tenantKey: 'tk_tenant_a_key',
    now: () => 1_000_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            unit: 'gpu_second',
            allowances: [
              { seat_alias: 'seat-a', remaining: 900 },
              { seat_alias: 'seat-b', remaining: 0 },
            ],
          },
        }),
      };
    },
  });

  const result = await reader.refresh();
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://operator.test:4000/api/tenant/tenant-a/privacy-allowance');
  assert.equal(calls[0].options.headers.authorization, 'Bearer tk_tenant_a_key');
  assert.equal(reader.allowanceFor('seat-a'), 900);
  assert.equal(reader.allowanceFor('seat-b'), 0);
  assert.equal(reader.allowanceFor('seat-unknown'), 0);
});

test('the allowance reader fails open when the operator cannot be reached', async () => {
  const reader = createAllowanceReader({
    operatorUrl: 'http://operator.test:4000',
    tenantId: 'tenant-a',
    tenantKey: 'tk_tenant_a_key',
    fetchImpl: async () => {
      throw new Error('connection refused');
    },
  });
  const result = await reader.refresh();
  assert.equal(result.ok, false);
  // The seat is held to its base fair share: the pack only widens.
  assert.equal(reader.allowanceFor('seat-a'), 0);
});

test('a reader without the operator is disabled and reads nothing', async () => {
  const reader = createAllowanceReader({});
  assert.equal(reader.enabled, false);
  assert.equal(reader.allowanceFor('seat-a'), 0);
  const result = await reader.refresh();
  assert.equal(result.ok, false);
});
