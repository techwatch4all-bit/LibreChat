import { generateKeyPairSync } from 'node:crypto';
import {
  buildTelemetryBatch,
  signTelemetryBatch,
  verifyTelemetryBatch,
  TelemetryQueue,
  UsageAccumulator,
  deriveTier,
  telemetryFingerprint,
  TELEMETRY_SCHEMA,
  TelemetryError,
} from './telemetry';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const now = 1_700_000_000;

function baseBatch(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tnt_x',
    batchSeq: 1,
    prevBatchSeq: 0,
    window: { from: now - 3600, to: now },
    seats: [{ alias: 'usr_anon_0000000001', lastLogin: now - 60 }],
    usage: [
      {
        alias: 'usr_anon_0000000001',
        mode: 'Privacy',
        inTokens: 1000,
        cachedTokens: 900,
        outTokens: 200,
        gpuSeconds: 42,
        requests: 5,
      },
    ],
    presence: { accountsCreated: 12, activeNow: 3 },
    ...overrides,
  };
}

describe('buildTelemetryBatch', () => {
  test('builds a well formed batch', () => {
    const batch = buildTelemetryBatch(baseBatch() as never);
    expect(batch.schema).toBe(TELEMETRY_SCHEMA);
    expect(batch.tenantId).toBe('tnt_x');
    expect(batch.batchSeq).toBe(1);
    expect(batch.usage).toHaveLength(1);
    expect(batch.usage[0].mode).toBe('Privacy');
  });

  test('carries no prompt, response, filename or email', () => {
    const batch = buildTelemetryBatch(baseBatch() as never);
    const serialised = JSON.stringify(batch);
    expect(serialised).not.toMatch(/prompt|response|filename|email|content/i);
  });

  test('rejects a broken sequence chain', () => {
    // A chain that does not continue would hide the very gap it should reveal.
    expect(() => buildTelemetryBatch(baseBatch({ batchSeq: 5, prevBatchSeq: 2 }) as never)).toThrow(
      TelemetryError,
    );
  });

  test('rejects a non-positive sequence', () => {
    expect(() =>
      buildTelemetryBatch(baseBatch({ batchSeq: 0, prevBatchSeq: -1 }) as never),
    ).toThrow(TelemetryError);
  });

  test('rejects a reversed window', () => {
    expect(() =>
      buildTelemetryBatch(baseBatch({ window: { from: now, to: now - 10 } }) as never),
    ).toThrow(TelemetryError);
  });

  test('rejects a window in the future', () => {
    expect(() =>
      buildTelemetryBatch(baseBatch({ window: { from: now, to: now + 86400 }, now } as never)),
    ).toThrow(TelemetryError);
  });

  test('rejects an unrecognised mode', () => {
    expect(() =>
      buildTelemetryBatch(
        baseBatch({
          usage: [
            {
              alias: 'usr_anon_0000000001',
              mode: 'Godmode',
              inTokens: 1,
              cachedTokens: 0,
              outTokens: 1,
              gpuSeconds: 1,
            },
          ],
        }) as never,
      ),
    ).toThrow(TelemetryError);
  });

  test('rejects negative counters', () => {
    expect(() =>
      buildTelemetryBatch(
        baseBatch({
          usage: [
            {
              alias: 'usr_anon_0000000001',
              mode: 'Chat',
              inTokens: -1,
              cachedTokens: 0,
              outTokens: 1,
              gpuSeconds: 1,
            },
          ],
        }) as never,
      ),
    ).toThrow(TelemetryError);
  });

  test('rejects cached tokens exceeding input tokens', () => {
    expect(() =>
      buildTelemetryBatch(
        baseBatch({
          usage: [
            {
              alias: 'usr_anon_0000000001',
              mode: 'Chat',
              inTokens: 10,
              cachedTokens: 99,
              outTokens: 1,
              gpuSeconds: 1,
            },
          ],
        }) as never,
      ),
    ).toThrow(TelemetryError);
  });

  test('rejects an oversized batch', () => {
    const usage = Array.from({ length: 20001 }, () => ({
      alias: 'usr_anon_0000000001',
      mode: 'Chat',
      inTokens: 1,
      cachedTokens: 0,
      outTokens: 1,
      gpuSeconds: 1,
    }));
    expect(() => buildTelemetryBatch(baseBatch({ usage }) as never)).toThrow(TelemetryError);
  });
});

describe('signing', () => {
  test('a signed batch verifies', () => {
    const batch = buildTelemetryBatch(baseBatch() as never);
    const { payload, signature } = signTelemetryBatch(batch, privateKey);
    const verified = verifyTelemetryBatch(payload.toString('utf8'), signature, publicKey);
    expect(verified.tenantId).toBe('tnt_x');
    expect(verified.batchSeq).toBe(1);
  });

  test('a tampered payload fails verification', () => {
    const batch = buildTelemetryBatch(baseBatch() as never);
    const { payload, signature } = signTelemetryBatch(batch, privateKey);
    const tampered = `${payload.toString('utf8')} `;
    expect(() => verifyTelemetryBatch(tampered, signature, publicKey)).toThrow(TelemetryError);
  });

  test('a batch signed by another key fails verification', () => {
    const other = generateKeyPairSync('ed25519');
    const batch = buildTelemetryBatch(baseBatch() as never);
    const { payload, signature } = signTelemetryBatch(batch, other.privateKey);
    expect(() => verifyTelemetryBatch(payload.toString('utf8'), signature, publicKey)).toThrow(
      TelemetryError,
    );
  });

  test('the signature is base64url so it can travel in a header', () => {
    const batch = buildTelemetryBatch(baseBatch() as never);
    const { signature } = signTelemetryBatch(batch, privateKey);
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('TelemetryQueue', () => {
  test('preserves order and the sequence chain', () => {
    const queue = new TelemetryQueue();
    const first = buildTelemetryBatch(baseBatch({ batchSeq: 1, prevBatchSeq: 0 }) as never);
    const second = buildTelemetryBatch(baseBatch({ batchSeq: 2, prevBatchSeq: 1 }) as never);
    queue.enqueue(first);
    queue.enqueue(second);
    expect(queue.length).toBe(2);
    expect(queue.peek()?.batchSeq).toBe(1);
    queue.ack();
    expect(queue.peek()?.batchSeq).toBe(2);
  });

  test('a batch is not removed until it is acknowledged', () => {
    // A failed upload must be retried, not lost.
    const queue = new TelemetryQueue();
    const batch = buildTelemetryBatch(baseBatch() as never);
    queue.enqueue(batch);
    expect(queue.length).toBe(1);
    queue.ack();
    expect(queue.length).toBe(0);
  });

  test('a requeued batch returns to the front', () => {
    const queue = new TelemetryQueue();
    const batch = buildTelemetryBatch(baseBatch() as never);
    queue.enqueue(batch);
    const taken = queue.peek();
    queue.requeue(taken);
    expect(queue.length).toBe(1);
    expect(queue.peek()?.batchSeq).toBe(1);
  });

  test('the queue is bounded and the sequence keeps moving forward', () => {
    // An unbounded backlog would eventually exhaust the tenant's disk. The
    // dropped batch's sequence must not be reused, or the operator would see a
    // replay rather than a gap.
    const queue = new TelemetryQueue({ maxBatches: 3 });
    for (let seq = 1; seq <= 5; seq += 1) {
      queue.enqueue(
        buildTelemetryBatch(baseBatch({ batchSeq: seq, prevBatchSeq: seq - 1 }) as never),
      );
    }
    expect(queue.length).toBe(3);
    expect(queue.pendingSequence).toBe(6);
  });

  test('rejects a batch with the wrong schema', () => {
    const queue = new TelemetryQueue();
    expect(() => queue.enqueue({ schema: 'nope' } as never)).toThrow(TelemetryError);
  });
});

describe('UsageAccumulator', () => {
  test('sums counters per mode', () => {
    const acc = new UsageAccumulator({ alias: 'usr_anon_0000000001' });
    acc.record({
      mode: 'Privacy',
      inTokens: 1000,
      cachedTokens: 900,
      outTokens: 200,
      gpuSeconds: 10,
    });
    acc.record({
      mode: 'Privacy',
      inTokens: 500,
      cachedTokens: 400,
      outTokens: 100,
      gpuSeconds: 5,
    });
    const rows = acc.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0].inTokens).toBe(1500);
    expect(rows[0].cachedTokens).toBe(1300);
    expect(rows[0].outTokens).toBe(300);
    expect(rows[0].gpuSeconds).toBe(15);
    expect(rows[0].requests).toBe(2);
  });

  test('keeps modes apart', () => {
    const acc = new UsageAccumulator({ alias: 'usr_anon_0000000001' });
    acc.record({ mode: 'Privacy', inTokens: 100, cachedTokens: 0, outTokens: 10, gpuSeconds: 1 });
    acc.record({ mode: 'Work', inTokens: 200, cachedTokens: 0, outTokens: 20, gpuSeconds: 2 });
    expect(acc.rows()).toHaveLength(2);
  });

  test('reset clears the counters for a reported window', () => {
    const acc = new UsageAccumulator({ alias: 'usr_anon_0000000001' });
    acc.record({ mode: 'Privacy', inTokens: 100, cachedTokens: 0, outTokens: 10, gpuSeconds: 1 });
    acc.reset();
    expect(acc.rows()).toHaveLength(0);
  });

  test('rejects impossible counters', () => {
    const acc = new UsageAccumulator({ alias: 'usr_anon_0000000001' });
    expect(() =>
      acc.record({ mode: 'Privacy', inTokens: 10, cachedTokens: 99, outTokens: 1, gpuSeconds: 1 }),
    ).toThrow(TelemetryError);
  });

  test('holds no identifying content', () => {
    const acc = new UsageAccumulator({ alias: 'usr_anon_0000000001' });
    acc.record({ mode: 'Privacy', inTokens: 100, cachedTokens: 0, outTokens: 10, gpuSeconds: 1 });
    const serialised = JSON.stringify(acc.rows());
    expect(serialised).not.toMatch(/prompt|response|email|filename/i);
  });
});

describe('deriveTier', () => {
  test('a lone seat with a third of the machine is clean', () => {
    // 900 gpu-seconds against a 3600-second fair share is 0.25x, under the soft
    // threshold, so even a contended machine does not flag it.
    const result = deriveTier({ gpuSecondsUsed: 900, activeSeats: 1, queuedSeats: 0 });
    expect(result.tier).toBe('NORMAL');
    expect(result.effectiveTier).toBe('NORMAL');
  });

  test('the same seat escalates once there is contention', () => {
    // 1400 gpu-seconds at one active seat is 0.39x: over the soft threshold.
    const result = deriveTier({ gpuSecondsUsed: 1400, activeSeats: 1, queuedSeats: 3 });
    expect(result.tier).toBe('SOFT');
    expect(result.effectiveTier).toBe('SOFT');
  });

  test('an idle machine never escalates for enforcement', () => {
    const result = deriveTier({ gpuSecondsUsed: 3000, activeSeats: 1, queuedSeats: 0 });
    expect(result.effectiveTier).toBe('NORMAL');
  });

  test('a heavy seat reaches HARD at four concurrent seats', () => {
    // 900 gpu-seconds against a 900-second fair share is exactly 1.0x.
    const result = deriveTier({ gpuSecondsUsed: 900, activeSeats: 4, queuedSeats: 2 });
    expect(result.tier).toBe('HARD');
  });

  test('serious is 1.5x, not 1.0x', () => {
    const at1x = deriveTier({ gpuSecondsUsed: 900, activeSeats: 4, queuedSeats: 2 });
    expect(at1x.tier).toBe('HARD');
    const at1x6 = deriveTier({ gpuSecondsUsed: 1440, activeSeats: 4, queuedSeats: 2 });
    expect(at1x6.tier).toBe('SERIOUS');
  });

  test('rejects a nonsensical seat count', () => {
    expect(() => deriveTier({ gpuSecondsUsed: 1, activeSeats: 0 })).toThrow(TelemetryError);
  });
});

describe('telemetryFingerprint', () => {
  test('is stable for the same content', () => {
    const a = buildTelemetryBatch(baseBatch() as never);
    const b = buildTelemetryBatch(baseBatch() as never);
    expect(telemetryFingerprint(a)).toBe(telemetryFingerprint(b));
  });

  test('does not depend on the order of usage rows', () => {
    const a = buildTelemetryBatch(baseBatch() as never);
    const twoRows = [
      {
        alias: 'usr_anon_0000000001',
        mode: 'Privacy',
        inTokens: 1000,
        cachedTokens: 900,
        outTokens: 200,
        gpuSeconds: 42,
        requests: 5,
      },
      {
        alias: 'usr_anon_0000000002',
        mode: 'Chat',
        inTokens: 10,
        cachedTokens: 0,
        outTokens: 1,
        gpuSeconds: 1,
        requests: 1,
      },
    ];
    const forward = buildTelemetryBatch(baseBatch({ usage: twoRows }) as never);
    const reversed = buildTelemetryBatch(baseBatch({ usage: [...twoRows].reverse() }) as never);
    expect(telemetryFingerprint(forward)).toBe(telemetryFingerprint(reversed));
    expect(telemetryFingerprint(a)).not.toBe(telemetryFingerprint(forward));
  });

  test('differs when the content differs', () => {
    const a = buildTelemetryBatch(baseBatch() as never);
    const b = buildTelemetryBatch(
      baseBatch({
        usage: [
          {
            alias: 'usr_anon_0000000001',
            mode: 'Privacy',
            inTokens: 2000,
            cachedTokens: 900,
            outTokens: 200,
            gpuSeconds: 42,
            requests: 5,
          },
        ],
      }) as never,
    );
    expect(telemetryFingerprint(a)).not.toBe(telemetryFingerprint(b));
  });
});
