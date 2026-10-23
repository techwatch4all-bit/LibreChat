/**
 * Tenant telemetry: emission, and verification of the operator's Policy Bundle.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A tenant harness must report usage counters so the operator can see what a
 * tenant actually consumed, and so a tenant cannot claim it never used a mode it
 * did use. The counters are metadata only: no prompt, no response, no filename, no
 * email address. The operator-facing reconciliation lives in One-API.
 *
 * WHAT THIS DOES NOT CLAIM
 * ------------------------
 * The reporting harness runs on tenant-controlled hardware. A tenant that edits
 * its harness before signing can under-report its own usage. Signing, sequencing
 * and grant binding make under-reporting *detectable* and make fabricated or
 * replayed usage impossible; they do not make under-reporting impossible.
 *
 * The cloud path has no such limitation, because One-API counts those tokens
 * itself. That asymmetry is deliberate and is why the operator's cost centre is
 * the cloud path, not Privacy.
 */
import { createHash, createPublicKey, sign as signBytes, verify as verifyBytes } from 'node:crypto';

/** The batch document format, matching the operator's reconciler. */
export const TELEMETRY_SCHEMA = 'satchida.telemetry.v1';

/** Hard ceilings, matching the operator's limits. */
export const MAX_TELEMETRY_USAGE_ENTRIES = 20000;
export const MAX_TELEMETRY_SEAT_ENTRIES = 5000;

/** Modes the operator recognises. A report of anything else is refused. */
export const TELEMETRY_MODES = ['Chat', 'Work', 'Study', 'Privacy'];

/**
 * A seat's usage of one mode inside a reporting window.
 */
export type TelemetryUsage = {
  alias: string;
  mode: string;
  inTokens: number;
  cachedTokens: number;
  outTokens: number;
  gpuSeconds: number;
  tier?: string;
  requests?: number;
};

/** One seat's presence information. */
export type TelemetrySeat = {
  alias: string;
  lastLogin?: number;
  activeSeats?: number;
};

/** Aggregate, non-identifying usage information. */
export type TelemetryPresence = {
  accountsCreated: number;
  activeNow: number;
};

/** The reporting window a batch covers. */
export type TelemetryWindow = {
  from: number;
  to: number;
};

/** The document a tenant uploads. */
export type TelemetryBatch = {
  schema: string;
  tenantId: string;
  batchSeq: number;
  prevBatchSeq: number;
  window: TelemetryWindow;
  seats: TelemetrySeat[];
  usage: TelemetryUsage[];
  presence?: TelemetryPresence;
  keyId: string;
};

export class TelemetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelemetryError';
  }
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TelemetryError(`${label} is required`);
  }
  return value.trim();
}

function requireNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TelemetryError(`${label} must be a non-negative finite number`);
  }
  return Math.floor(value);
}

/**
 * Build a telemetry batch.
 *
 * The batch sequence is strictly increasing per tenant. A replayed batch is
 * refused by the operator, and a gap in the sequence is reported as possible
 * tampering, so the counter must never be reset or reused.
 */
/** Options accepted when building a batch. */
export type BuildTelemetryBatchOptions = {
  tenantId: string;
  batchSeq: number;
  prevBatchSeq: number;
  window: TelemetryWindow;
  seats?: TelemetrySeat[];
  usage?: TelemetryUsage[];
  presence?: TelemetryPresence;
  keyId?: string;
  now?: number;
};

/**
 * Build a telemetry batch.
 *
 * The batch sequence is strictly increasing per tenant. A replayed batch is
 * refused by the operator, and a gap in the sequence is reported as possible
 * tampering, so the counter must never be reset or reused.
 */
export function buildTelemetryBatch({
  tenantId,
  batchSeq,
  prevBatchSeq,
  window,
  seats = [],
  usage = [],
  presence,
  keyId = 'default',
  now = Math.floor(Date.now() / 1000),
}: BuildTelemetryBatchOptions): TelemetryBatch {
  const tenant = requireNonEmptyString(tenantId, 'tenantId');
  if (!Number.isInteger(batchSeq) || batchSeq < 1) {
    throw new TelemetryError('batchSeq must be a positive integer');
  }
  if (!Number.isInteger(prevBatchSeq) || prevBatchSeq < 0) {
    throw new TelemetryError('prevBatchSeq must be a non-negative integer');
  }
  if (prevBatchSeq !== batchSeq - 1) {
    // The chain is what lets the operator detect a gap. A batch that does not
    // continue the chain would hide the very gap it is meant to reveal.
    throw new TelemetryError('prevBatchSeq must be batchSeq - 1');
  }
  if (!window || typeof window.from !== 'number' || typeof window.to !== 'number') {
    throw new TelemetryError('window is required');
  }
  if (window.to < window.from) {
    throw new TelemetryError('window end precedes window start');
  }
  if (window.to > now + 300) {
    throw new TelemetryError('window end is in the future');
  }
  if (usage.length > MAX_TELEMETRY_USAGE_ENTRIES) {
    throw new TelemetryError(`usage exceeds ${MAX_TELEMETRY_USAGE_ENTRIES} entries`);
  }
  if (seats.length > MAX_TELEMETRY_SEAT_ENTRIES) {
    throw new TelemetryError(`seats exceeds ${MAX_TELEMETRY_SEAT_ENTRIES} entries`);
  }

  const cleanUsage: TelemetryUsage[] = usage.map((row) => {
    const alias = requireNonEmptyString(row.alias, 'usage alias');
    const mode = requireNonEmptyString(row.mode, 'usage mode');
    if (!TELEMETRY_MODES.includes(mode)) {
      throw new TelemetryError(`usage mode ${mode} is not a recognised mode`);
    }
    const inTokens = requireNonNegative(row.inTokens, 'inTokens');
    const cachedTokens = requireNonNegative(row.cachedTokens, 'cachedTokens');
    if (cachedTokens > inTokens) {
      throw new TelemetryError('cachedTokens cannot exceed inTokens');
    }
    const outTokens = requireNonNegative(row.outTokens, 'outTokens');
    const gpuSeconds = requireNonNegative(row.gpuSeconds, 'gpuSeconds');
    const requests = requireNonNegative(row.requests ?? 0, 'requests');
    const entry: TelemetryUsage = {
      alias,
      mode,
      inTokens,
      cachedTokens,
      outTokens,
      gpuSeconds,
      requests,
    };
    if (row.tier) entry.tier = String(row.tier);
    return entry;
  });

  const cleanSeats: TelemetrySeat[] = seats.map((seat) => {
    const alias = requireNonEmptyString(seat.alias, 'seat alias');
    const entry: TelemetrySeat = { alias };
    if (seat.lastLogin !== undefined)
      entry.lastLogin = requireNonNegative(seat.lastLogin, 'lastLogin');
    if (seat.activeSeats !== undefined) {
      entry.activeSeats = requireNonNegative(seat.activeSeats, 'activeSeats');
    }
    return entry;
  });

  const batch: TelemetryBatch = {
    schema: TELEMETRY_SCHEMA,
    tenantId: tenant,
    batchSeq,
    prevBatchSeq,
    window: { from: Math.floor(window.from), to: Math.floor(window.to) },
    seats: cleanSeats,
    usage: cleanUsage,
    keyId,
  };
  if (presence) {
    batch.presence = {
      accountsCreated: requireNonNegative(presence.accountsCreated ?? 0, 'accountsCreated'),
      activeNow: requireNonNegative(presence.activeNow ?? 0, 'activeNow'),
    };
  }
  return batch;
}

/**
 * Sign a batch.
 *
 * The signature is over the exact bytes that will be transmitted, so a batch
 * cannot be re-encoded after signing without invalidating it.
 */
export function signTelemetryBatch(
  batch: TelemetryBatch,
  privateKey: import('node:crypto').KeyObject,
): { payload: Buffer; payloadB64: string; signature: string } {
  if (!privateKey) throw new TelemetryError('telemetry signing key is required');
  const payload = Buffer.from(JSON.stringify(batch), 'utf8');
  const signature = signBytes(null, payload, privateKey).toString('base64url');
  return { payload, payloadB64: payload.toString('base64url'), signature };
}

/**
 * Verify a signed batch. Used by the operator side and by tests.
 */
export function verifyTelemetryBatch(
  payload: string,
  signatureB64: string,
  publicKey: import('node:crypto').KeyObject,
): TelemetryBatch {
  if (!publicKey) throw new TelemetryError('telemetry verification key is required');
  const signature = Buffer.from(signatureB64, 'base64url');
  const ok = verifyBytes(null, Buffer.from(payload, 'utf8'), publicKey, signature);
  if (!ok) throw new TelemetryError('telemetry signature is invalid');
  return JSON.parse(payload);
}

/**
 * A queue of telemetry batches that have not yet been accepted.
 *
 * A tenant whose link to the operator is down must not lose its records, and
 * must not be able to reorder them. The queue is append-only and preserves the
 * sequence chain, so a flushed backlog stays consistent with the sequence the
 * operator has already seen.
 */
export class TelemetryQueue {
  batches: TelemetryBatch[];
  maxBatches: number;
  now: () => number;
  nextSeq: number;

  constructor({ maxBatches = 512, now = () => Math.floor(Date.now() / 1000) }: QueueOptions = {}) {
    this.batches = [];
    this.maxBatches = maxBatches;
    this.now = now;
    this.nextSeq = 1;
  }

  /** The sequence the next batch will carry. */
  get pendingSequence() {
    return this.nextSeq;
  }

  /** How many batches are waiting. */
  get length() {
    return this.batches.length;
  }

  /**
   * Enqueue a batch for later delivery.
   *
   * When the queue is full the oldest batch is dropped, because an unbounded
   * backlog would eventually exhaust the tenant's disk. The dropped batch's
   * sequence is remembered so the next batch continues the chain rather than
   * reusing a sequence number the operator has already seen.
   */
  enqueue(batch: TelemetryBatch): TelemetryBatch {
    if (!batch || batch.schema !== TELEMETRY_SCHEMA) {
      throw new TelemetryError('batch has an unexpected schema');
    }
    this.batches.push(batch);
    if (this.batches.length > this.maxBatches) {
      const dropped = this.batches.shift();
      if (dropped) {
        this.nextSeq = Math.max(this.nextSeq, dropped.batchSeq + 1);
      }
    }
    this.nextSeq = Math.max(this.nextSeq, batch.batchSeq + 1);
    return batch;
  }

  /**
   * Take the next batch for delivery.
   *
   * The batch is not removed until `ack` is called, so a failed upload is
   * retried rather than lost.
   */
  peek(): TelemetryBatch | null {
    return this.batches[0] ?? null;
  }

  /** Remove the first batch after the operator accepted it. */
  ack(): TelemetryBatch | null {
    return this.batches.shift() ?? null;
  }

  /** Put a batch back at the front, for a failed upload. */
  requeue(batch: TelemetryBatch | null): void {
    // The batch is still in the queue until it is acknowledged, so requeueing it
    // must not duplicate it.
    if (batch && this.batches[0]?.batchSeq !== batch.batchSeq) {
      this.batches.unshift(batch);
    }
  }
}

/**
 * A minimal, privacy-preserving seat usage accumulator.
 *
 * It holds counters only. Nothing it records can identify a person: the seat
 * alias is already an opaque pseudonym, and no prompt, response, filename or
 * email address is ever passed to it.
 */
/** One completed request, as recorded by the accumulator. */
export type UsageRecord = {
  mode: string;
  inTokens: number;
  cachedTokens?: number;
  outTokens: number;
  gpuSeconds?: number;
  tier?: string;
};

/** Options for the accumulator and the queue. */
export type AccumulatorOptions = {
  alias: string;
  now?: () => number;
};

export type QueueOptions = {
  maxBatches?: number;
  now?: () => number;
};

/** Options for deriving a fairness tier. */
export type DeriveTierOptions = {
  gpuSecondsUsed: number;
  activeSeats: number;
  queuedSeats?: number;
  soft?: number;
  hard?: number;
  serious?: number;
};

/** The result of a tier evaluation. */
export type TierEvaluation = {
  tier: string;
  effectiveTier: string;
  ratio: number;
  seriousGpuSecondsPerHour: number;
  activeSeats: number;
  queuedSeats: number;
};

export class UsageAccumulator {
  alias: string;
  now: () => number;
  byMode: Map<
    string,
    {
      inTokens: number;
      cachedTokens: number;
      outTokens: number;
      gpuSeconds: number;
      requests: number;
      tier?: string;
    }
  >;

  constructor({ alias, now = () => Math.floor(Date.now() / 1000) }: AccumulatorOptions) {
    this.alias = requireNonEmptyString(alias, 'alias');
    this.now = now;
    this.byMode = new Map();
  }

  /**
   * Record one completed request.
   *
   * `inTokens` is the full prompt size and `cachedTokens` the part the local
   * runtime served from its prefix cache. Only the difference was real GPU work,
   * so the accumulator keeps both: the operator reports the total for
   * transparency, and the fairness ladder uses the uncached part.
   */
  record({ mode, inTokens, cachedTokens = 0, outTokens, gpuSeconds = 0, tier }: UsageRecord) {
    const modeName = requireNonEmptyString(mode, 'mode');
    const inTotal = requireNonNegative(inTokens, 'inTokens');
    const cached = requireNonNegative(cachedTokens, 'cachedTokens');
    if (cached > inTotal) {
      throw new TelemetryError('cachedTokens cannot exceed inTokens');
    }
    const out = requireNonNegative(outTokens, 'outTokens');
    const gpu = requireNonNegative(gpuSeconds, 'gpuSeconds');

    const current = this.byMode.get(modeName) ?? {
      inTokens: 0,
      cachedTokens: 0,
      outTokens: 0,
      gpuSeconds: 0,
      requests: 0,
    };
    current.inTokens += inTotal;
    current.cachedTokens += cached;
    current.outTokens += out;
    current.gpuSeconds += gpu;
    current.requests += 1;
    this.byMode.set(modeName, current);
    if (tier) current.tier = String(tier);
    return current;
  }

  /** The accumulated usage as telemetry rows. */
  rows(): TelemetryUsage[] {
    const out: TelemetryUsage[] = [];
    for (const [mode, counts] of this.byMode.entries()) {
      const row: TelemetryUsage = {
        alias: this.alias,
        mode,
        inTokens: counts.inTokens,
        cachedTokens: counts.cachedTokens,
        outTokens: counts.outTokens,
        gpuSeconds: counts.gpuSeconds,
        requests: counts.requests,
      };
      if (counts.tier) row.tier = counts.tier;
      out.push(row);
    }
    return out;
  }

  /** Discard the accumulated counters, for a window that has been reported. */
  reset() {
    this.byMode.clear();
  }
}

/**
 * Derive the fairness tier for a seat from its GPU-second consumption.
 *
 * This mirrors the operator's model: the allowance is a share of a
 * 3600-second hour divided by the number of active seats, and the tiers are
 * fractions of that share. The idle-machine rule is enforced here so a lone
 * user on an otherwise idle machine is never throttled.
 */
export function deriveTier({
  gpuSecondsUsed,
  activeSeats,
  queuedSeats = 0,
  soft = 0.35,
  hard = 0.7,
  serious = 1.5,
}: DeriveTierOptions): TierEvaluation {
  if (!Number.isInteger(activeSeats) || activeSeats < 1) {
    throw new TelemetryError('activeSeats must be a positive integer');
  }
  const seriousAllowance = 3600 / activeSeats;
  const ratio = gpuSecondsUsed / seriousAllowance;
  const contended = queuedSeats > 0;

  let tier = 'NORMAL';
  if (ratio > serious) tier = 'SERIOUS';
  else if (ratio > hard) tier = 'HARD';
  else if (ratio > soft) tier = 'SOFT';

  return {
    tier,
    // An idle machine never escalates for enforcement, though the banner may show.
    effectiveTier: contended ? tier : 'NORMAL',
    ratio,
    seriousGpuSecondsPerHour: seriousAllowance,
    activeSeats,
    queuedSeats,
  };
}

/**
 * A stable fingerprint of a batch, for deduplication on the operator side.
 *
 * Derived from the content rather than a counter, so two identical batches have
 * the same fingerprint even if they arrive out of order.
 */
export function telemetryFingerprint(batch: TelemetryBatch): string {
  const canonical = JSON.stringify({
    tenantId: batch.tenantId,
    batchSeq: batch.batchSeq,
    window: batch.window,
    // Both the row order and the field order inside each row are normalised, so
    // two batches carrying the same facts fingerprint identically no matter how
    // they were assembled.
    usage: [...(batch.usage ?? [])]
      .map((row) => ({
        alias: row.alias,
        mode: row.mode,
        inTokens: row.inTokens,
        cachedTokens: row.cachedTokens,
        outTokens: row.outTokens,
        gpuSeconds: row.gpuSeconds,
        requests: row.requests ?? 0,
        tier: row.tier ?? '',
      }))
      .sort((a, b) => `${a.alias}|${a.mode}`.localeCompare(`${b.alias}|${b.mode}`)),
  });
  return createHash('sha256').update(canonical).digest('base64url');
}

/**
 * Load a PEM public key for verifying operator documents.
 */
export function loadPublicKey(pem: string): import('node:crypto').KeyObject {
  try {
    return createPublicKey(pem);
  } catch (error) {
    throw new TelemetryError(`cannot load public key: ${(error as Error).message}`);
  }
}
