/**
 * Satchida capacity model.
 *
 * Derives how many concurrent Privacy sessions a tenant PC can serve, and what a
 * fair-use tier means in GPU-seconds. Implements spec sections 3 and 4.
 *
 * Two independent limits apply, and conflating them is the failure mode this
 * module exists to prevent:
 *
 *   C_memory  = kv_pool_bytes / (kv_bytes_per_token * ctx_tokens)
 *
 * How many sessions fit in VRAM at the given context length.
 *
 *   C_compute = max{ N : measured_per_seat_tps(N) >= target_per_seat_tps }
 *
 * How many sessions the GPU can decode for at once at an acceptable per-seat rate.
 * Measured, not modelled: aggregate decode throughput saturates, so adding users
 * past saturation divides the same throughput among more seats instead of adding
 * any.
 *
 *   C_served = min(C_memory, C_compute)
 *
 * Both must hold. A box with plenty of VRAM still cannot serve more sessions than
 * its compute sustains, and a box with a fast GPU still cannot exceed its KV pool.
 */

/** Measured on the operator PC; see spec section 2.3. */
export const DEFAULT_RUNTIME_OVERHEAD_BYTES = 900 * 1024 * 1024;

/** Fraction of VRAM held back so a burst cannot OOM the runtime. */
export const DEFAULT_SAFETY_FRACTION = 0.15;

/**
 * Per-seat decode floor. Locked by operator.
 *
 * 20 tok/s is the rate at which an agentic coding session stays workable: a
 * 1200-token completion lands in about a minute, during which the developer is
 * running tests or reading rather than waiting on the model.
 */
export const DEFAULT_TARGET_PER_SEAT_TPS = 20;

/** Operator-locked tier multiples, expressed against the Serious allowance. */
export const DEFAULT_TIERS = Object.freeze({
  soft: 0.35,
  hard: 0.70,
  serious: 1.5,
});

/**
 * Asymmetric de-escalation thresholds.
 *
 * Entering a tier at one threshold and leaving it at a lower one prevents a seat
 * oscillating between two tiers when its ratio sits near a boundary. Without the
 * gap, a user hovering at 0.70 would be queued and released repeatedly.
 */
export const DEFAULT_HYSTERESIS = Object.freeze({
  soft: 0.30,
  hard: 0.60,
  serious: 1.20,
});

export class CapacityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CapacityError';
  }
}

function assertPositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new CapacityError(`${label} must be a positive finite number, got ${value}`);
  }
  return value;
}

/**
 * VRAM available for the KV cache after weights, runtime overhead and reserve.
 *
 * Returns 0 when the model cannot be loaded at all, which is a valid answer the
 * caller must handle — it means Privacy is unavailable on this machine, not that
 * the arithmetic failed.
 */
export function kvPoolBytes({
  vramTotalBytes,
  weightsBytes,
  overheadBytes = DEFAULT_RUNTIME_OVERHEAD_BYTES,
  safetyFraction = DEFAULT_SAFETY_FRACTION,
}) {
  assertPositive(vramTotalBytes, 'vramTotalBytes');
  if (typeof weightsBytes !== 'number' || weightsBytes < 0) {
    throw new CapacityError(`weightsBytes must be a non-negative number, got ${weightsBytes}`);
  }
  if (typeof safetyFraction !== 'number' || safetyFraction < 0 || safetyFraction >= 1) {
    throw new CapacityError(`safetyFraction must be within [0, 1), got ${safetyFraction}`);
  }
  const reserve = vramTotalBytes * safetyFraction;
  return Math.max(0, vramTotalBytes - weightsBytes - overheadBytes - reserve);
}

/** Sessions that fit in the KV pool at the given per-session context length. */
export function memoryConcurrency({ kvPool, kvBytesPerToken, ctxTokens }) {
  if (typeof kvPool !== 'number' || kvPool < 0) throw new CapacityError('kvPool must be a non-negative number');
  assertPositive(kvBytesPerToken, 'kvBytesPerToken');
  assertPositive(ctxTokens, 'ctxTokens');
  return Math.floor(kvPool / (kvBytesPerToken * ctxTokens));
}

/**
 * Largest measured concurrency whose per-seat rate still meets the target.
 *
 * Only points that were actually measured are considered. Interpolating between
 * samples would produce a number that was never observed on real hardware, and a
 * concurrency figure is exactly the sort of thing an operator will quote to a
 * customer.
 */
export function computeConcurrency({
  perSeatTpsByConcurrency,
  targetPerSeatTps = DEFAULT_TARGET_PER_SEAT_TPS,
}) {
  if (!perSeatTpsByConcurrency || typeof perSeatTpsByConcurrency !== 'object') {
    throw new CapacityError('perSeatTpsByConcurrency must be an object keyed by concurrency');
  }
  let best = 0;
  for (const [key, rate] of Object.entries(perSeatTpsByConcurrency)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1) continue;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) continue;
    if (rate >= targetPerSeatTps && n > best) best = n;
  }
  return best;
}

/**
 * Full capacity solve.
 *
 * `ctxTokens` is deliberately a live input rather than a fixed constant. A room of
 * 2k-context sessions holds far more concurrent KV than a room of 36k-context ones,
 * so serving capacity has to track the rolling context or the router will
 * overcommit and start evicting or failing to allocate.
 */
export function solveCapacity({
  vramTotalBytes,
  weightsBytes,
  kvBytesPerToken,
  ctxTokens,
  perSeatTpsByConcurrency,
  targetPerSeatTps = DEFAULT_TARGET_PER_SEAT_TPS,
  overheadBytes = DEFAULT_RUNTIME_OVERHEAD_BYTES,
  safetyFraction = DEFAULT_SAFETY_FRACTION,
}) {
  const kvPool = kvPoolBytes({ vramTotalBytes, weightsBytes, overheadBytes, safetyFraction });
  const cMemory = kvPool > 0
    ? memoryConcurrency({ kvPool, kvBytesPerToken, ctxTokens })
    : 0;
  const cCompute = computeConcurrency({ perSeatTpsByConcurrency, targetPerSeatTps });
  const cServed = Math.min(cMemory, cCompute);

  return {
    kv_pool_bytes: kvPool,
    c_memory: cMemory,
    c_compute: cCompute,
    c_served: cServed,
    binding_limit: cServed === 0 ? 'none' : (cCompute <= cMemory ? 'compute' : 'memory'),
    fits: cServed > 0,
    target_per_seat_tps: targetPerSeatTps,
  };
}

/**
 * GPU-seconds one seat may consume per hour before reaching `tier`.
 *
 * The denominator is *currently active* seats, not licensed seats and not peak
 * capacity. That is what makes the allowance move with the room: when the machine
 * is half empty each occupant genuinely has more machine per person, and the
 * threshold should reflect that rather than punish a user for a room that is not
 * there.
 */
export function seriousGpuSeconds({ activeSeats, tiers = DEFAULT_TIERS }) {
  const seats = Number(activeSeats);
  if (!Number.isInteger(seats) || seats < 1) {
    throw new CapacityError(`activeSeats must be a positive integer, got ${activeSeats}`);
  }
  return { serious_gpu_seconds_per_hour: 3600 / seats, active_seats: seats, tiers };
}

/** Convert a GPU-second allowance into a token allowance using measured rates. */
export function gpuSecondsToTokens(gpuSeconds, { prefillTps, decodeTps }) {
  assertPositive(gpuSeconds, 'gpuSeconds');
  assertPositive(prefillTps, 'prefillTps');
  assertPositive(decodeTps, 'decodeTps');
  return {
    uncached_input_tokens: Math.floor(gpuSeconds * prefillTps),
    output_tokens: Math.floor(gpuSeconds * decodeTps),
  };
}

/**
 * GPU-seconds a seat actually consumed.
 *
 * Only *uncached* input counts. With prefix cache reuse active, a repeating
 * conversation re-sends tens of thousands of tokens per turn while the GPU only
 * processes the delta — charging the full prompt would make a long-context user look
 * enormous while costing almost nothing.
 */
export function seatGpuSeconds({ uncachedInputTokens, outputTokens, prefillTps, decodeTps }) {
  const input = Number.isFinite(uncachedInputTokens) ? Math.max(0, uncachedInputTokens) : 0;
  const output = Number.isFinite(outputTokens) ? Math.max(0, outputTokens) : 0;
  return input / prefillTps + output / decodeTps;
}

/**
 * Evaluate a seat's tier.
 *
 * `contended` is the enforcement gate from spec section 4.4: an idle machine must
 * never throttle anyone. When nobody is queued the seat is reported as idle no
 * matter how large its ratio, so a lone user on a fast box is never penalised.
 */
export function evaluateTier({
  gpuSecondsUsed,
  activeSeats,
  queuedSeats = 0,
  tiers = DEFAULT_TIERS,
  hysteresis = DEFAULT_HYSTERESIS,
  currentTier = 'NORMAL',
}) {
  const { serious_gpu_seconds_per_hour: serious, active_seats: seats } = seriousGpuSeconds({
    activeSeats,
    tiers,
  });
  const ratio = gpuSecondsUsed / serious;
  const contended = queuedSeats > 0;

  const order = ['NORMAL', 'SOFT', 'HARD', 'SERIOUS'];
  const currentIndex = order.indexOf(currentTier);
  if (currentIndex < 0) throw new CapacityError(`unknown tier ${currentTier}`);

  // Entry: the lowest tier a ratio of this size warrants.
  const entryFloor = ratio > tiers.serious ? 3
    : ratio > tiers.hard ? 2
      : ratio > tiers.soft ? 1
        : 0;

  // Exit: the tier a seat may drop to. A seat holds its current tier until the
  // ratio falls below that tier's exit threshold, so a value hovering just under
  // the entry line does not oscillate.
  const exitCeiling = ratio <= hysteresis.soft ? 0
    : ratio <= hysteresis.hard ? 1
      : ratio <= hysteresis.serious ? 2
        : 3;

  // Escalate at once. De-escalate at most one step per evaluation, and never past
  // the exit ceiling, so a single quiet interval cannot unlock a seat that has
  // been held at Serious for hours.
  let tierIndex;
  if (entryFloor >= currentIndex) {
    tierIndex = entryFloor;
  } else {
    tierIndex = Math.max(currentIndex - 1, exitCeiling);
  }

  const tier = order[tierIndex];

  return {
    tier,
    enforced: contended,
    ratio,
    serious_gpu_seconds_per_hour: serious,
    active_seats: seats,
    queued_seats: queuedSeats,
    // An idle machine never escalates for enforcement, though the banner may show.
    effective_tier: contended ? tier : 'NORMAL',
  };
}

/**
 * Cooldown ladder for Hard and Serious.
 *
 * Serious backs off geometrically so a sustained hog's throughput collapses toward
 * zero, which is what actually lets a queue drain. The sequence is capped: without
 * a ceiling an active-but-abusive seat could push its own wait past any reasonable
 * bound while still holding the machine.
 */
export function cooldownSeconds(tier, options = {}) {
  const {
    hardSeconds = 30,
    seriousSeconds = 60,
    escalationCapSeconds = 900,
    stepIndex = 0,
  } = options;
  if (tier === 'HARD') return hardSeconds;
  if (tier !== 'SERIOUS') return 0;
  const backoff = seriousSeconds * (2 ** Math.max(0, stepIndex));
  return Math.min(backoff, escalationCapSeconds);
}

export { DEFAULT_TIERS as TIERS, DEFAULT_HYSTERESIS as HYSTERESIS };