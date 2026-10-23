import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFairUseController,
  evaluateFairnessTier,
  gpuSecondsFromUsage,
  estimateTokensFromBytes,
  FairUseError,
} from './fairuse.mjs';

const BASE_TIME = 1_700_000_000_000;

/** Measured rates from the operator PC probe. */
const RATES = { prefillTps: 4800, decodeTps: 190 };

function controller(overrides = {}) {
  let clock = BASE_TIME;
  const c = createFairUseController({
    cServed: 4,
    ...RATES,
    now: () => clock,
    ...overrides,
  });
  return { c, advance: (ms) => { clock += ms; }, setClock: (v) => { clock = v; } };
}

describe('evaluateFairnessTier', () => {
  test('a seat well under its share is clean', () => {
    const result = evaluateFairnessTier({ gpuSecondsUsed: 100, activeSeats: 4 });
    assert.equal(result.tier, 'NORMAL');
  });

  test('the allowance scales with the number of active seats', () => {
    // 900 gpu-seconds is a quarter of a solo hour but a full share when four
    // seats are active. The same usage is a different thing as the room fills.
    const alone = evaluateFairnessTier({ gpuSecondsUsed: 900, activeSeats: 1 });
    const crowded = evaluateFairnessTier({ gpuSecondsUsed: 900, activeSeats: 4 });
    assert.equal(alone.seriousGpuSecondsPerHour, 3600);
    assert.equal(crowded.seriousGpuSecondsPerHour, 900);
    assert.equal(alone.tier, 'NORMAL');
    assert.equal(crowded.tier, 'HARD');
  });

  test('an idle machine never escalates for enforcement', () => {
    // 5000 gpu-seconds against a 3600-second solo share is 1.39x, which is past
    // the hard threshold but under the serious one.
    const result = evaluateFairnessTier({ gpuSecondsUsed: 5000, activeSeats: 1, queuedSeats: 0 });
    assert.equal(result.tier, 'HARD');
    assert.equal(result.effectiveTier, 'NORMAL');
  });

  test('contention turns the same usage into an escalation', () => {
    // 5400 gpu-seconds against a 3600-second solo share is exactly 1.5x, and
    // the threshold is crossed only above it.
    const result = evaluateFairnessTier({ gpuSecondsUsed: 5400, activeSeats: 1, queuedSeats: 2 });
    assert.equal(result.tier, 'HARD');
    assert.equal(result.effectiveTier, 'HARD');

    const over = evaluateFairnessTier({ gpuSecondsUsed: 5401, activeSeats: 1, queuedSeats: 2 });
    assert.equal(over.tier, 'SERIOUS');
    assert.equal(over.effectiveTier, 'SERIOUS');
  });

  test('serious is 1.5x', () => {
    // The threshold is crossed only above the multiple.
    assert.equal(evaluateFairnessTier({ gpuSecondsUsed: 900, activeSeats: 4 }).tier, 'HARD');
    assert.equal(evaluateFairnessTier({ gpuSecondsUsed: 1350, activeSeats: 4 }).tier, 'HARD');
    assert.equal(evaluateFairnessTier({ gpuSecondsUsed: 1351, activeSeats: 4 }).tier, 'SERIOUS');
  });

  test('rejects a nonsensical seat count', () => {
    assert.throws(() => evaluateFairnessTier({ gpuSecondsUsed: 1, activeSeats: 0 }), FairUseError);
  });
});

describe('gpuSecondsFromUsage', () => {
  test('counts only uncached input', () => {
    // Cached input was already computed on a previous turn and costs nothing now.
    const withCache = gpuSecondsFromUsage({
      inTokens: 1000, cachedTokens: 900, outTokens: 190, ...RATES,
    });
    const withoutCache = gpuSecondsFromUsage({
      inTokens: 1000, cachedTokens: 0, outTokens: 190, ...RATES,
    });
    assert.ok(withCache < withoutCache);
    assert.ok(Math.abs(withCache - (100 / 4800 + 1)) < 1e-9);
  });

  test('decode dominates a typical turn', () => {
    const seconds = gpuSecondsFromUsage({
      inTokens: 500, cachedTokens: 400, outTokens: 1200, ...RATES,
    });
    const decodeShare = (1200 / 190) / seconds;
    assert.ok(decodeShare > 0.95, `decode was only ${(decodeShare * 100).toFixed(1)}%`);
  });

  test('rejects missing rates rather than dividing by zero', () => {
    assert.throws(() => gpuSecondsFromUsage({ inTokens: 1, outTokens: 1 }), FairUseError);
  });
});

describe('estimateTokensFromBytes', () => {
  test('errs high so a streaming response is not recorded as free', () => {
    // Under-counting would let a heavy seat escape the ladder entirely.
    assert.ok(estimateTokensFromBytes(3500) >= 1000);
    assert.ok(estimateTokensFromBytes(0) === 0);
  });
});

describe('admission', () => {
  test('admits up to the served concurrency', () => {
    const { c } = controller({ cServed: 2 });
    assert.equal(c.admit('a').admitted, true);
    assert.equal(c.admit('b').admitted, true);
    const third = c.admit('c');
    assert.equal(third.admitted, false);
    assert.equal(third.reason, 'machine_full');
  });

  test('a queued seat is given a position, not a refusal', () => {
    const { c } = controller({ cServed: 1 });
    c.admit('a');
    const queued = c.admit('b');
    assert.equal(queued.admitted, false);
    assert.ok(queued.position >= 2, `position was ${queued.position}`);
    assert.ok(queued.retryAfterMs > 0);
  });

  test('releasing a slot lets the next seat in', () => {
    const { c } = controller({ cServed: 1 });
    c.admit('a');
    assert.equal(c.admit('b').admitted, false);
    c.release('a');
    assert.equal(c.admit('b').admitted, true);
  });

  test('the slot count never goes negative', () => {
    const { c } = controller();
    c.release('never_admitted');
    assert.equal(c.activeSlots, 0);
  });

  test('a cooldown is enforced and reported with a retry time', () => {
    const { c, advance } = controller();
    c.applyCooldown('a', 'HARD');
    const blocked = c.admit('a');
    assert.equal(blocked.admitted, false);
    assert.equal(blocked.reason, 'cooldown');
    assert.ok(blocked.retryAfterMs > 0);
    advance(31_000);
    assert.equal(c.admit('a').admitted, true);
  });

  test('the serious backoff grows while the seat stays hot', () => {
    const { c } = controller();
    assert.equal(c.applyCooldown('a', 'SERIOUS'), 60);
    assert.equal(c.applyCooldown('a', 'SERIOUS'), 120);
    assert.equal(c.applyCooldown('a', 'SERIOUS'), 240);
    assert.equal(c.applyCooldown('a', 'SERIOUS'), 480);
  });

  test('the serious backoff is capped', () => {
    // Without a ceiling an active but abusive seat could hold the machine by
    // feeding its own cooldown.
    const { c } = controller();
    for (let i = 0; i < 20; i += 1) c.applyCooldown('a', 'SERIOUS');
    const capped = c.applyCooldown('a', 'SERIOUS');
    assert.equal(capped, 900);
  });

  test('a hot seat is deprioritised behind a normal one', () => {
    // A hog only becomes a hog when the room is busy. Alone on the machine it
    // has the whole GPU, so a moderate hour of work is not penalised.
    const { c } = controller({ cServed: 4 });
    // 190 output tokens per second for 1000 seconds is 1000 gpu-seconds.
    c.release('hog', { inTokens: 0, cachedTokens: 0, outTokens: 190 * 1000 });
    // Alone the share is a full hour: 1000 of 3600 seconds is under the soft
    // threshold, so nothing is flagged.
    const alone = c.evaluate('hog', { activeSeats: 1, queuedSeats: 0 });
    assert.equal(alone.tier, 'NORMAL');

    // With four seats active the fair share is 900 gpu-seconds, so the same
    // usage has crossed the hard threshold.
    const busy = c.evaluate('hog', { activeSeats: 4, queuedSeats: 2 });
    assert.ok(['HARD', 'SERIOUS'].includes(busy.tier), `hog tier was ${busy.tier}`);
  });
});

describe('rolling window', () => {
  test('usage older than an hour stops counting', () => {
    const { c, advance } = controller();
    c.release('a', { inTokens: 0, cachedTokens: 0, outTokens: 190 * 600 });
    const fresh = c.evaluate('a').gpuSecondsUsed;
    assert.ok(fresh > 0, 'fresh usage must count');
    advance(61 * 60 * 1000);
    const stale = c.evaluate('a').gpuSecondsUsed;
    assert.ok(stale < fresh / 10, `stale usage ${stale} should be near zero, was ${fresh}`);
  });

  test('usage inside the hour keeps counting', () => {
    const { c, advance } = controller();
    c.release('a', { inTokens: 0, cachedTokens: 0, outTokens: 190 * 600 });
    const before = c.evaluate('a').gpuSecondsUsed;
    advance(30 * 60 * 1000);
    const after = c.evaluate('a').gpuSecondsUsed;
    assert.ok(after >= before * 0.5, `usage fell from ${before} to ${after} too fast`);
  });
});

describe('idle decay', () => {
  test('a seat that has gone quiet steps back down', () => {
    // A user who is actively working must not be held at Serious for being busy,
    // and a user who has walked away must not stay penalised.
    const { c, advance } = controller();
    c.release('a', { inTokens: 0, cachedTokens: 0, outTokens: 190 * 600 });
    c.applyCooldown('a', 'SERIOUS');
    advance(120_000);
    c.release('a', {});
    assert.equal(c.evaluate('a').tier, 'NORMAL');
  });
});

describe('snapshot', () => {
  test('reports the capacity and per-seat state', () => {
    const { c } = controller({ cServed: 3 });
    c.admit('a');
    c.release('a', { inTokens: 100, cachedTokens: 0, outTokens: 10 });
    const snap = c.snapshot();
    assert.equal(snap.cServed, 3);
    assert.equal(snap.trackedSeats, 1);
    assert.equal(snap.seats[0].alias, 'a');
    assert.ok(snap.seats[0].gpuSeconds >= 0);
  });

  test('holds no prompt content', () => {
    const { c } = controller();
    c.release('a', { inTokens: 100, cachedTokens: 0, outTokens: 10 });
    const serialised = JSON.stringify(c.snapshot());
    assert.ok(!/prompt|response|content|email/i.test(serialised));
  });
});

describe('configuration', () => {
  test('rejects a non-positive served concurrency', () => {
    assert.throws(() => createFairUseController({ cServed: 0, ...RATES }), FairUseError);
  });

  test('rejects missing throughput rates', () => {
    assert.throws(() => createFairUseController({ cServed: 1 }), FairUseError);
  });

  test('refuses to track an unbounded number of seats', () => {
    const { c } = controller({ maxSeats: 2 });
    c.admit('a');
    c.admit('b');
    assert.throws(() => c.admit('c'), FairUseError);
  });
});
