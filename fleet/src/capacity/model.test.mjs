import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveCapacity,
  kvPoolBytes,
  memoryConcurrency,
  computeConcurrency,
  seriousGpuSeconds,
  gpuSecondsToTokens,
  seatGpuSeconds,
  evaluateTier,
  cooldownSeconds,
  CapacityError,
  DEFAULT_TARGET_PER_SEAT_TPS,
  DEFAULT_TIERS,
} from './model.mjs';

/**
 * Everything below is anchored to measurements taken on the operator PC
 * (spec section 2). The capacity numbers are asserted literally so that a change
 * in the formula cannot silently alter the concurrency an operator quotes to a
 * customer.
 */
const OPERATOR_PC = {
  vramTotalBytes: 12227 * 1024 * 1024,
  weightsBytes: Math.round(2.68 * 1024 * 1024 * 1024),
  // Production runs q4_0 KV: 135168 bytes/token f16 scaled by 4.5/16 = 38016.
  // The spec's capacity tables are computed against this value, not f16.
  kvBytesPerToken: Math.round(135168 * (4.5 / 16)),
  perSeatTpsByConcurrency: {
    1: 103.7, 2: 96.9, 3: 61.6, 4: 55.0, 5: 37.9, 8: 20.8, 12: 12.1,
  },
};

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

describe('kvPoolBytes', () => {
  test('reproduces the measured pool on the operator PC', () => {
    const pool = kvPoolBytes({
      vramTotalBytes: OPERATOR_PC.vramTotalBytes,
      weightsBytes: OPERATOR_PC.weightsBytes,
    });
    // 12227 - 2744 (2.68 GiB) - 900 (overhead) - 1834 (15% reserve) = 6749 MiB
    assert.ok(Math.abs(pool / MiB - 6749) < 3, `expected ~6749 MiB, got ${pool / MiB}`);
  });

  test('returns 0 when the model cannot fit', () => {
    const pool = kvPoolBytes({
      vramTotalBytes: 4 * GiB,
      weightsBytes: 9 * GiB,   // model larger than the card
    });
    assert.equal(pool, 0);
  });

  test('rejects nonsensical input rather than returning a wrong number', () => {
    assert.throws(() => kvPoolBytes({ vramTotalBytes: 0, weightsBytes: 1 }), CapacityError);
    assert.throws(() => kvPoolBytes({ vramTotalBytes: -5, weightsBytes: 1 }), CapacityError);
    assert.throws(
      () => kvPoolBytes({ vramTotalBytes: 8 * GiB, weightsBytes: 1, safetyFraction: 1.5 }),
      CapacityError,
    );
  });

  test('a higher safety reserve never increases the pool', () => {
    const base = { vramTotalBytes: OPERATOR_PC.vramTotalBytes, weightsBytes: OPERATOR_PC.weightsBytes };
    const low = kvPoolBytes({ ...base, safetyFraction: 0.05 });
    const high = kvPoolBytes({ ...base, safetyFraction: 0.30 });
    assert.ok(high < low);
  });

  test('scales down proportionally on a smaller card', () => {
    const pool12 = kvPoolBytes({
      vramTotalBytes: 12 * GiB, weightsBytes: OPERATOR_PC.weightsBytes,
    });
    const pool6 = kvPoolBytes({
      vramTotalBytes: 6 * GiB, weightsBytes: OPERATOR_PC.weightsBytes,
    });
    assert.ok(pool6 < pool12);
  });
});

describe('computeConcurrency', () => {
  test('finds 8 on the measured machine at the 20 tok/s floor', () => {
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: OPERATOR_PC.perSeatTpsByConcurrency }), 8);
  });

  test('honours a custom target', () => {
    const rates = OPERATOR_PC.perSeatTpsByConcurrency;
    // Returns the highest measured concurrency whose per-seat rate clears the
    // floor. Measured points: 1,2,3,4,5,8 clear 30; 1,2,3,4 clear 50; only 1 clears 200.
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: rates, targetPerSeatTps: 30 }), 5);
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: rates, targetPerSeatTps: 50 }), 4);
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: rates, targetPerSeatTps: 200 }), 0);
  });

  test('never interpolates beyond what was measured', () => {
    // 6 and 7 were not measured. Claiming C=7 would be quoting an unobserved number.
    const rates = { 1: 100, 5: 40, 8: 20.8 };
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: rates }), 8);
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: { 5: 40 } }), 5);
  });

  test('ignores non-positive, non-integer and malformed entries', () => {
    const rates = { 1: 100, 2: -5, 3: 0, 4: Number.NaN, '5.5': 90, 6: 25 };
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: rates }), 6);
  });

  test('returns 0 when the machine cannot meet the floor at any point', () => {
    assert.equal(computeConcurrency({ perSeatTpsByConcurrency: { 1: 5, 2: 4 } }), 0);
  });
});

describe('solveCapacity', () => {
  test('compute binds on the operator PC at 16k context', () => {
    const result = solveCapacity({ ...OPERATOR_PC, ctxTokens: 16384 });
    assert.equal(result.c_compute, 8);
    assert.equal(result.c_served, 8);
    assert.equal(result.binding_limit, 'compute');
    assert.ok(result.fits);
  });

  test('memory binds once context grows past the KV pool', () => {
    const result = solveCapacity({ ...OPERATOR_PC, ctxTokens: 32768 });
    assert.equal(result.c_memory, 5);
    assert.equal(result.c_compute, 8);
    assert.equal(result.c_served, 5);
    assert.equal(result.binding_limit, 'memory');
  });

  test('served concurrency is always the minimum of the two limits', () => {
    for (const ctx of [1024, 4096, 8192, 16384, 24576, 32768, 36864]) {
      const r = solveCapacity({ ...OPERATOR_PC, ctxTokens: ctx });
      assert.equal(r.c_served, Math.min(r.c_memory, r.c_compute), `mismatch at ctx=${ctx}`);
    }
  });

  test('longer context never raises served concurrency', () => {
    let previous = Infinity;
    for (const ctx of [2048, 8192, 16384, 32768]) {
      const { c_served: served } = solveCapacity({ ...OPERATOR_PC, ctxTokens: ctx });
      assert.ok(served <= previous, `ctx=${ctx} raised concurrency above the previous point`);
      previous = served;
    }
  });

  test('scales down on a small card', () => {
    const result = solveCapacity({
      ...OPERATOR_PC,
      vramTotalBytes: 6144 * MiB,
      ctxTokens: 16384,
    });
    assert.equal(result.c_memory, 2);
    assert.equal(result.c_served, 2);
    assert.equal(result.binding_limit, 'memory');
  });

  test('a model larger than the card reports no capacity rather than throwing', () => {
    const result = solveCapacity({
      ...OPERATOR_PC,
      vramTotalBytes: 4 * GiB,
      ctxTokens: 8192,
    });
    assert.equal(result.c_served, 0);
    assert.equal(result.fits, false);
    assert.equal(result.binding_limit, 'none');
  });

  test('VRAM beyond the compute ceiling does not raise concurrency', () => {
    const at12 = solveCapacity({ ...OPERATOR_PC, vramTotalBytes: 12 * GiB, ctxTokens: 16384 });
    const at24 = solveCapacity({ ...OPERATOR_PC, vramTotalBytes: 24 * GiB, ctxTokens: 16384 });
    assert.equal(at12.c_served, at24.c_served);
    // Extra VRAM buys context headroom, not seats.
    assert.ok(at24.c_memory > at12.c_memory);
  });
});

describe('seriousGpuSeconds', () => {
  test('divides a 3600-second hour across active seats', () => {
    assert.equal(seriousGpuSeconds({ activeSeats: 1 }).serious_gpu_seconds_per_hour, 3600);
    assert.equal(seriousGpuSeconds({ activeSeats: 4 }).serious_gpu_seconds_per_hour, 900);
    assert.equal(seriousGpuSeconds({ activeSeats: 10 }).serious_gpu_seconds_per_hour, 360);
  });

  test('a lone seat is allowed the whole machine', () => {
    assert.equal(seriousGpuSeconds({ activeSeats: 1 }).serious_gpu_seconds_per_hour, 3600);
  });

  test('rejects a non-positive or fractional seat count', () => {
    assert.throws(() => seriousGpuSeconds({ activeSeats: 0 }), CapacityError);
    assert.throws(() => seriousGpuSeconds({ activeSeats: -1 }), CapacityError);
    assert.throws(() => seriousGpuSeconds({ activeSeats: 2.5 }), CapacityError);
  });
});

describe('seatGpuSeconds', () => {
  const rates = { prefillTps: 5656, decodeTps: 190 };

  test('matches the measured heavy coding hour', () => {
    // 150 turns x (500 uncached input + 1200 output).
    const perTurn = seatGpuSeconds({ uncachedInputTokens: 500, outputTokens: 1200, ...rates });
    assert.ok(Math.abs(perTurn - (500 / 5656 + 1200 / 190)) < 1e-9);
    const hourly = 150 * perTurn;
    assert.ok(hourly > 900 && hourly < 1050, `expected ~961 gpu-sec, got ${hourly}`);
  });

  test('decode dominates a typical turn', () => {
    const perTurn = seatGpuSeconds({ uncachedInputTokens: 500, outputTokens: 1200, ...rates });
    const decodeShare = (1200 / 190) / perTurn;
    assert.ok(decodeShare > 0.95, `decode was only ${(decodeShare * 100).toFixed(1)}% of the turn`);
  });

  test('ignores cached input, which the GPU does not reprocess', () => {
    // A repeating conversation re-sends 15k tokens per turn but only ~500 are
    // prefilled. Charging the full prompt would make a long-context user look
    // enormous while costing almost nothing.
    const cheap = seatGpuSeconds({ uncachedInputTokens: 500, outputTokens: 1200, ...rates });
    assert.ok(Math.abs(cheap - seatGpuSeconds({ uncachedInputTokens: 0, outputTokens: 1200, ...rates }) - 500 / 5656) < 1e-9);
  });

  test('treats missing counters as zero rather than failing a turn', () => {
    const value = seatGpuSeconds({ outputTokens: 190, ...rates });
    assert.equal(value, 1);
  });
});

describe('gpuSecondsToTokens', () => {
  test('converts an allowance into per-mode token ceilings', () => {
    const t = gpuSecondsToTokens(360, { prefillTps: 5656, decodeTps: 190 });
    assert.equal(t.output_tokens, 68400);
    assert.ok(Math.abs(t.uncached_input_tokens - 2036160) < 10);
  });

  test('rejects missing rates instead of producing Infinity', () => {
    assert.throws(() => gpuSecondsToTokens(360, { prefillTps: 0, decodeTps: 190 }), CapacityError);
  });
});

describe('evaluateTier', () => {
  const base = { prefillTps: 5656, decodeTps: 190, activeSeats: 8, queuedSeats: 4 };

  test('a heavy seat alone on the machine is CLEAN', () => {
    const heavy = 150 * seatGpuSeconds({ uncachedInputTokens: 500, outputTokens: 1200, ...base });
    const r = evaluateTier({ gpuSecondsUsed: heavy, ...base, queuedSeats: 0 });
    assert.equal(r.effective_tier, 'NORMAL');
    assert.equal(r.enforced, false);
  });

  test('idle machine never enforces, whatever the ratio', () => {
    const r = evaluateTier({ gpuSecondsUsed: 3000, ...base, queuedSeats: 0 });
    assert.equal(r.enforced, false);
    assert.equal(r.effective_tier, 'NORMAL');
  });

  test('escalates as seats join and the same usage becomes over-share', () => {
    const heavy = 150 * seatGpuSeconds({ uncachedInputTokens: 500, outputTokens: 1200, ...base });
    // Ratios against the moving fair share: 0.53, 1.07, 1.60, 2.13.
    // Serious sits at 1.5x, so the heavy seat crosses it at six concurrent seats.
    const tiers = [2, 4, 6, 8].map((activeSeats) =>
      evaluateTier({ gpuSecondsUsed: heavy, ...base, activeSeats, queuedSeats: 2 }).tier);
    assert.deepEqual(tiers, ['SOFT', 'HARD', 'SERIOUS', 'SERIOUS']);
  });

  test('serious is 1.5x, not 1.0x', () => {
    assert.equal(DEFAULT_TIERS.serious, 1.5);
    const perTurn = seatGpuSeconds({ uncachedInputTokens: 500, outputTokens: 1200, ...base });
    // 4 active seats: fair share is 900, serious threshold is 1350.
    const heavy = 150 * perTurn; // ~961
    const r = evaluateTier({ gpuSecondsUsed: heavy, ...base, activeSeats: 4, queuedSeats: 3 });
    assert.equal(r.tier, 'HARD');
    assert.ok(r.ratio < 1.5, `ratio ${r.ratio} should sit below the 1.5x serious threshold`);
  });

  test('escalates into SERIOUS only when actually over 1.5x', () => {
    const fair = 3600 / 8;                       // 450 gpu-sec
    const r = evaluateTier({ gpuSecondsUsed: fair * 1.6, ...base });
    assert.equal(r.tier, 'SERIOUS');
    const below = evaluateTier({ gpuSecondsUsed: fair * 1.4, ...base });
    assert.equal(below.tier, 'HARD');
  });

  test('hysteresis prevents oscillation at a boundary', () => {
    const fair = 3600 / 8;
    // Enter HARD above 0.70. A seat does not leave HARD until its ratio falls below
    // the SOFT exit floor (0.60), so a value hovering at 0.65 does not thrash.
    const atHard = evaluateTier({ gpuSecondsUsed: fair * 0.71, ...base, currentTier: 'NORMAL' });
    assert.equal(atHard.tier, 'HARD');
    const held = evaluateTier({ gpuSecondsUsed: fair * 0.65, ...base, currentTier: 'HARD' });
    assert.equal(held.tier, 'HARD', '0.65 sits above the 0.60 exit floor and must hold HARD');
    const released = evaluateTier({ gpuSecondsUsed: fair * 0.55, ...base, currentTier: 'HARD' });
    assert.equal(released.tier, 'SOFT');
  });

  test('de-escalates at most one level per evaluation', () => {
    const r = evaluateTier({ gpuSecondsUsed: 1, ...base, currentTier: 'SERIOUS' });
    assert.equal(r.tier, 'HARD', 'a single quiet interval must not unlock a long-held seat');
  });

  test('never returns a tier above the seat current level on an idle machine', () => {
    const r = evaluateTier({ gpuSecondsUsed: 0, ...base, queuedSeats: 0, currentTier: 'SERIOUS' });
    assert.equal(r.effective_tier, 'NORMAL');
  });

  test('rejects an unknown current tier', () => {
    assert.throws(() => evaluateTier({ gpuSecondsUsed: 1, ...base, currentTier: 'NOPE' }), CapacityError);
  });
});

describe('cooldownSeconds', () => {
  test('normal and soft impose no wait', () => {
    assert.equal(cooldownSeconds('NORMAL'), 0);
    assert.equal(cooldownSeconds('SOFT'), 0);
  });

  test('hard is the configured flat pause', () => {
    assert.equal(cooldownSeconds('HARD'), 30);
    assert.equal(cooldownSeconds('HARD', { hardSeconds: 45 }), 45);
  });

  test('serious backs off geometrically so throughput collapses', () => {
    assert.equal(cooldownSeconds('SERIOUS', { stepIndex: 0 }), 60);
    assert.equal(cooldownSeconds('SERIOUS', { stepIndex: 1 }), 120);
    assert.equal(cooldownSeconds('SERIOUS', { stepIndex: 2 }), 240);
    assert.equal(cooldownSeconds('SERIOUS', { stepIndex: 3 }), 480);
  });

  test('serious backoff is capped', () => {
    // Without a ceiling an active-but-abusive seat could hold the machine by
    // feeding its own cooldown timer.
    assert.equal(cooldownSeconds('SERIOUS', { stepIndex: 20 }), 900);
  });

  test('negative step indices are treated as the first rung', () => {
    assert.equal(cooldownSeconds('SERIOUS', { stepIndex: -5 }), 60);
  });
});

describe('memoryConcurrency', () => {
  test('reproduces the spec table at 16k and 32k context', () => {
    const pool = kvPoolBytes({
      vramTotalBytes: OPERATOR_PC.vramTotalBytes,
      weightsBytes: OPERATOR_PC.weightsBytes,
    });
    const kv = OPERATOR_PC.kvBytesPerToken;
    assert.equal(memoryConcurrency({ kvPool: pool, kvBytesPerToken: kv, ctxTokens: 16384 }), 11);
    assert.equal(memoryConcurrency({ kvPool: pool, kvBytesPerToken: kv, ctxTokens: 32768 }), 5);
    assert.equal(memoryConcurrency({ kvPool: pool, kvBytesPerToken: kv, ctxTokens: 2048 }), 90);
  });

  test('q4_0 KV roughly doubles the memory ceiling over f16', () => {
    const pool = kvPoolBytes({
      vramTotalBytes: OPERATOR_PC.vramTotalBytes,
      weightsBytes: OPERATOR_PC.weightsBytes,
    });
    const f16 = memoryConcurrency({ kvPool: pool, kvBytesPerToken: 135168, ctxTokens: 16384 });
    const q4 = memoryConcurrency({ kvPool: pool, kvBytesPerToken: 135168 * (4.5 / 16), ctxTokens: 16384 });
    assert.equal(f16, 3);
    assert.equal(q4, 11);
    assert.ok(q4 > f16 * 3, 'q4_0 KV must more than triple the memory ceiling at this context');
  });

  test('rejects zero context and zero KV size', () => {
    assert.throws(() => memoryConcurrency({ kvPool: 1, kvBytesPerToken: 1, ctxTokens: 0 }), CapacityError);
    assert.throws(() => memoryConcurrency({ kvPool: 1, kvBytesPerToken: 0, ctxTokens: 8192 }), CapacityError);
  });
});

describe('target floor', () => {
  test('the locked default is 20 tok/s per seat', () => {
    assert.equal(DEFAULT_TARGET_PER_SEAT_TPS, 20);
  });
});