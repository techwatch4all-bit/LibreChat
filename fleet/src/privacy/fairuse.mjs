/**
 * Per-seat fair-use control for tenant-local Privacy inference.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Privacy is flat-rate. The tenant pays a subscription and the operator earns
 * nothing per token, so there is no theft vector. There IS a fairness vector: one
 * seat can monopolise the tenant's single GPU and starve everybody else, and a
 * seat that is interrupted mid-task is a customer who never renews.
 *
 * So the control is deliberately not a cutoff. It is:
 *
 *   - a share of the machine, recomputed from how many seats are active
 *   - a queue, so a heavy seat waits rather than being cut off
 *   - a priority, so other seats are served first while it waits
 *
 * WHAT IT IS NOT
 * --------------
 * This measures GPU-seconds, not tokens. Token counters are misleading once
 * prefix caching is active: a repeating conversation re-sends tens of thousands
 * of tokens per turn while the GPU only processes the delta, so a long-context
 * user looks enormous and costs almost nothing. Decode is ~98% of a typical
 * turn's cost, so the unit that matters is time on the machine.
 *
 * The tier arithmetic is duplicated from `packages/api/src/tenancy/telemetry.ts`
 * rather than imported. The two live in different packages with different build
 * targets, and the fleet runtime is a standalone Node service that must not
 * depend on the LibreChat API bundle.
 */

export const DEFAULT_TIERS = Object.freeze({ soft: 0.35, hard: 0.7, serious: 1.5 });

/**
 * Evaluate a fairness tier from GPU-second consumption.
 *
 * The allowance is a share of a 3600-second hour divided by the number of seats
 * that are actually active, so it moves with the room. A seat that is alone on
 * an idle machine is never penalised, because there is nobody for it to take
 * anything from.
 */
export function evaluateFairnessTier({
  gpuSecondsUsed,
  activeSeats,
  queuedSeats = 0,
  soft = DEFAULT_TIERS.soft,
  hard = DEFAULT_TIERS.hard,
  serious = DEFAULT_TIERS.serious,
  packGpuSeconds = 0,
}) {
  if (!Number.isInteger(activeSeats) || activeSeats < 1) {
    throw new FairUseError('activeSeats must be a positive integer');
  }
  // The pack's remaining GPU-seconds are ADDED to the share of the hour, so a
  // seat that bought a pack may use more than its fair share of the machine
  // before the tiers bite. The pack is the operator's money, so it widens the
  // allowance; it does not change the machine's capacity, which is cServed.
  const pack = Number.isFinite(packGpuSeconds) && packGpuSeconds > 0 ? packGpuSeconds : 0;
  const seriousAllowance = 3600 / activeSeats + pack;
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
    baseGpuSecondsPerHour: 3600 / activeSeats,
    packGpuSeconds: pack,
    activeSeats,
    queuedSeats,
  };
}

/** The width of one accounting bucket, in milliseconds. */
const BUCKET_MS = 60_000;

/** How many buckets make up the rolling window. */
const WINDOW_BUCKETS = 60;

/**
 * The priority order of the tiers. A lower number is served first.
 *
 * NORMAL and SOFT seats are served before HARD seats, which are served before
 * SERIOUS seats. A demoted seat is not starved: it is still admitted, just
 * behind whoever else is waiting.
 */
const TIER_PRIORITY = Object.freeze({ NORMAL: 0, SOFT: 1, HARD: 2, SERIOUS: 3 });

export class FairUseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FairUseError';
  }
}

/**
 * Convert a response's token usage into GPU-seconds.
 *
 * Only *uncached* input counts. The cached portion was already computed on a
 * previous turn and costs the machine nothing now.
 */
export function gpuSecondsFromUsage({
  inTokens = 0,
  cachedTokens = 0,
  outTokens = 0,
  prefillTps,
  decodeTps,
}) {
  if (!(prefillTps > 0) || !(decodeTps > 0)) {
    throw new FairUseError('prefillTps and decodeTps must be positive to measure GPU-seconds');
  }
  const uncached = Math.max(0, inTokens - cachedTokens);
  return uncached / prefillTps + outTokens / decodeTps;
}

/**
 * Estimate token counts when the runtime did not report usage.
 *
 * A streaming response may omit usage entirely. Under-counting would let a heavy
 * seat escape the ladder, so the estimate errs high: roughly 3.5 characters per
 * token, which is conservative for English and for code.
 */
export function estimateTokensFromBytes(byteLength) {
  return Math.ceil(byteLength / 3.5);
}

/**
 * A rolling window of GPU-seconds per seat.
 *
 * Sixty one-minute buckets. The window is genuinely rolling rather than fixed,
 * so a seat that was heavy an hour ago and is idle now is not still penalised,
 * and a seat that becomes heavy is not given a fresh allowance by the clock
 * turning over.
 */
class RollingWindow {
  constructor(buckets = WINDOW_BUCKETS) {
    // Each slot holds [epoch, seconds]. The epoch is stored alongside the value
    // because the index cycles: without it a slot written an hour ago would be
    // indistinguishable from one written a minute ago, and the window would
    // never actually roll.
    //
    // The clock is in milliseconds, so the bucket width is in milliseconds too.
    this.slots = new Array(buckets).fill(null).map(() => [0, 0]);
    this.bucketMs = BUCKET_MS;
  }

  add(seconds, nowMs) {
    const epoch = Math.floor(nowMs / this.bucketMs);
    const index = epoch % this.slots.length;
    const slot = this.slots[index];
    if (slot[0] !== epoch) {
      // The slot belongs to an earlier epoch, so it starts fresh.
      slot[0] = epoch;
      slot[1] = 0;
    }
    slot[1] += seconds;
  }

  total(nowMs) {
    const current = Math.floor(nowMs / this.bucketMs);
    const oldest = current - this.slots.length + 1;
    let sum = 0;
    for (const [epoch, seconds] of this.slots) {
      if (epoch >= oldest && epoch <= current) sum += seconds;
    }
    return sum;
  }
}

/** The state the controller keeps for one seat. */
class SeatState {
  constructor(alias) {
    this.alias = alias;
    this.window = new RollingWindow();
    this.tier = 'NORMAL';
    this.nextAdmissibleAt = 0;
    this.backoffStep = 0;
    this.lastActivityAt = 0;
    this.requests = 0;
    // The seat's purchased pack allowance, in GPU-seconds. Zero means the
    // seat has no pack headroom and is held to the base fair share.
    this.packGpuSeconds = 0;
  }
}

/**
 * The fair-use controller.
 *
 * It answers two questions for the router: may this seat be admitted right now,
 * and if not, why not and when may it try again.
 */
export function createFairUseController({
  cServed = 1,
  prefillTps = 0,
  decodeTps = 0,
  tiers = DEFAULT_TIERS,
  hardCooldownSeconds = 30,
  seriousCooldownSeconds = 60,
  escalationCapSeconds = 900,
  maxSeats = 5000,
  now = () => Date.now(),
} = {}) {
  if (!Number.isInteger(cServed) || cServed < 1) {
    throw new FairUseError('cServed must be a positive integer');
  }
  if (!(prefillTps > 0) || !(decodeTps > 0)) {
    throw new FairUseError('prefillTps and decodeTps must be positive');
  }

  const seats = new Map();
  let activeSlots = 0;

  function seatState(alias) {
    let state = seats.get(alias);
    if (!state) {
      if (seats.size >= maxSeats) {
        throw new FairUseError('too many seats are being tracked');
      }
      state = new SeatState(alias);
      seats.set(alias, state);
    }
    return state;
  }

  /**
   * Evaluate a seat's current tier.
   *
   * The allowance is a share of a 3600-second hour divided by the number of
   * seats that are actually active, so it moves with the room. A seat that is
   * alone on an idle machine is never penalised, because there is nobody for it
   * to take anything from.
   */
  function evaluate(alias, { activeSeats = activeSlots, queuedSeats = 0 } = {}) {
    const state = seatState(alias);
    const gpuSecondsUsed = state.window.total(now());
    const effective = evaluateFairnessTier({
      gpuSecondsUsed,
      activeSeats: Math.max(1, activeSeats),
      queuedSeats,
      soft: tiers.soft,
      hard: tiers.hard,
      serious: tiers.serious,
      packGpuSeconds: state.packGpuSeconds,
    });
    state.tier = effective.tier;
    return { ...effective, gpuSecondsUsed, seat: state };
  }

  /**
   * Record the seat's purchased pack allowance, in GPU-seconds.
   *
   * The balance lives in the operator's ledger, and the tenant's router reads
   * it from there: the assertion the router already verifies is TENANT-signed
   * (the signing key lives on the tenant's own server), so it cannot carry the
   * operator's balance. The pack therefore WIDENS the seat's allowance and
   * never narrows it, so a stale or missing balance costs the tenant its
   * purchased headroom for a moment and never more than the base allowance.
   */
  function setPackAllowance(alias, gpuSeconds) {
    const state = seatState(alias);
    const value = Number.isFinite(gpuSeconds) && gpuSeconds > 0 ? gpuSeconds : 0;
    state.packGpuSeconds = value;
    return value;
  }

  /**
   * The queue position a seat would see.
   *
   * Position counts the slots in use plus the seats waiting ahead of this one.
   * A demoted seat is counted behind every non-demoted waiter, so the number it
   * sees reflects the wait it will actually experience.
   */
  function queuePosition(alias) {
    const priority = TIER_PRIORITY[seats.get(alias)?.tier ?? 'NORMAL'];
    const waiting = [...seats.values()].filter((state) => state !== seats.get(alias) && state.requests > 0);
    const ahead = waiting.filter((state) => TIER_PRIORITY[state.tier] < priority).length;
    return activeSlots + ahead + 1;
  }

  /**
   * Try to admit a seat.
   *
   * The gate is checked at admission only. A request already in flight is never
   * interrupted, truncated, or refused, which is what guarantees an interrupted
   * session is not cut mid-cycle.
   */
  function admit(alias, { activeSeats, queuedSeats = 0 } = {}) {
    const timestamp = now();
    const state = seatState(alias);
    const assessment = evaluate(alias, { activeSeats, queuedSeats });

    // A seat in cooldown waits. The wait is visible, bounded, and never fatal:
    // the seat can always try again.
    if (timestamp < state.nextAdmissibleAt) {
      const retryAfterMs = Math.ceil(state.nextAdmissibleAt - timestamp);
      return {
        admitted: false,
        reason: 'cooldown',
        tier: assessment.tier,
        retryAfterMs,
        position: queuePosition(alias),
        assessment,
      };
    }

    if (activeSlots >= cServed) {
      // The machine is full. The seat queues rather than being cut off.
      return {
        admitted: false,
        reason: 'machine_full',
        tier: assessment.tier,
        retryAfterMs: 5000,
        position: queuePosition(alias),
        assessment,
      };
    }

    activeSlots += 1;
    state.requests += 1;
    state.lastActivityAt = timestamp;
    return { admitted: true, tier: assessment.tier, assessment };
  }

  /**
   * Release a slot and record what the request consumed.
   *
   * The tier is re-evaluated afterwards so the next admission reflects the
   * usage. An active seat's backoff decays, because a user who is actively
   * working must not be held at Serious for being busy.
   */
  function release(alias, usage = {}) {
    if (activeSlots > 0) activeSlots -= 1;
    const state = seatState(alias);
    let gpuSeconds = 0;
    if (usage && (usage.outTokens || usage.inTokens)) {
      try {
        gpuSeconds = gpuSecondsFromUsage({
          inTokens: usage.inTokens ?? 0,
          cachedTokens: usage.cachedTokens ?? 0,
          outTokens: usage.outTokens ?? 0,
          prefillTps,
          decodeTps,
        });
      } catch {
        gpuSeconds = 0;
      }
    }
    if (gpuSeconds > 0) state.window.add(gpuSeconds, now());

    // A seat that is still working keeps its tier; a seat that has gone quiet
    // steps back down so the backoff does not outlive the reason for it.
    const timestamp = now();
    const idleForMs = timestamp - state.lastActivityAt;
    if (idleForMs > 60_000 && state.tier !== 'NORMAL') {
      state.tier = 'NORMAL';
      state.backoffStep = 0;
      state.nextAdmissibleAt = 0;
    }
    return { gpuSeconds, tier: state.tier };
  }

  /**
   * Apply a cooldown to a seat that crossed a tier.
   *
   * The backoff grows while the seat stays hot, so a sustained hog's throughput
   * collapses toward zero and the queue drains. It is capped, so an active but
   * abusive seat cannot hold the machine by feeding its own cooldown.
   */
  function applyCooldown(alias, tier) {
    const state = seatState(alias);
    if (tier === 'HARD') {
      state.nextAdmissibleAt = Math.max(state.nextAdmissibleAt, now() + hardCooldownSeconds * 1000);
      return hardCooldownSeconds;
    }
    if (tier === 'SERIOUS') {
      const backoff = Math.min(
        seriousCooldownSeconds * (2 ** state.backoffStep),
        escalationCapSeconds,
      );
      state.backoffStep += 1;
      state.nextAdmissibleAt = Math.max(state.nextAdmissibleAt, now() + backoff * 1000);
      return backoff;
    }
    return 0;
  }

  /** A snapshot for health and metrics endpoints. */
  function snapshot() {
    const timestamp = now();
    const perSeat = [...seats.values()].map((state) => ({
      alias: state.alias,
      tier: state.tier,
      gpuSeconds: Math.round(state.window.total(timestamp)),
      requests: state.requests,
      cooldownRemainingMs: Math.max(0, Math.ceil(state.nextAdmissibleAt - timestamp)),
    }));
    return {
      cServed,
      activeSlots,
      trackedSeats: seats.size,
      seats: perSeat,
    };
  }

  return {
    admit,
    release,
    evaluate,
    applyCooldown,
    queuePosition,
    setPackAllowance,
    snapshot,
    get activeSlots() {
      return activeSlots;
    },
    get cServed() {
      return cServed;
    },
  };
}
