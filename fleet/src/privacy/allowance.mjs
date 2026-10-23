/**
 * The Privacy pack allowance, read from the operator.
 *
 * A Privacy pack is denominated in GPU-SECONDS and is spent on the TENANT's
 * own GPU, so the balance lives in the operator's ledger and the tenant's
 * router is the thing that spends it. The router therefore needs the balance,
 * and the only trustworthy source of it is the operator.
 *
 * It cannot ride in the assertion: the assertion is TENANT-signed (the
 * signing key lives on the tenant's own server, and the tenant controls it),
 * so the tenant could write any balance into it. The operator's ledger is
 * served over the network instead, behind a tenant-scoped key that can read
 * the tenant's own allowances and spend nothing.
 *
 * The fetch FAILS OPEN, and that is deliberate: a balance the router could
 * not read leaves the seat on its base fair share of the machine, which is
 * the tenant's own hardware and the tenant's own policy. Refusing the seat
 * because the operator was unreachable would punish the tenant for the
 * operator's outage, and the product's rule is that a seat is never cut off.
 * The overrun the operator carries in that case is bounded by the pack.
 */

const DEFAULT_CACHE_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * A reader for the operator's Privacy allowances.
 *
 * It is created with the operator's base URL, the tenant id and the tenant's
 * key. Without all three it reads nothing, and the router runs on the base
 * fair share alone.
 */
export function createAllowanceReader({
  operatorUrl,
  tenantId,
  tenantKey,
  cacheMs = DEFAULT_CACHE_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  now = () => Date.now(),
  log = (message) => console.error(`[privacy-router] ${message}`),
} = {}) {
  if (!operatorUrl || !tenantId || !tenantKey) {
    return {
      enabled: false,
      async refresh() {
        return { ok: false, reason: 'the operator is not configured' };
      },
      allowanceFor: () => 0,
      snapshot: () => ({ enabled: false, seats: 0 }),
    };
  }

  const base = String(operatorUrl).replace(/\/+$/, '');
  let cache = { at: 0, bySeat: new Map() };
  let lastError = null;

  async function refresh() {
    const url = `${base}/api/tenant/${encodeURIComponent(tenantId)}/privacy-allowance`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${tenantKey}`,
          accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        lastError = `the operator answered ${response.status}`;
        return { ok: false, reason: lastError };
      }
      const body = await response.json();
      const allowances = body?.data?.allowances || [];
      const bySeat = new Map();
      for (const entry of allowances) {
        const alias = entry?.seat_alias;
        if (!alias) continue;
        // An unlimited pack is not a number the arithmetic can use, so it is
        // treated as "no pack": the seat is then held to the base fair share,
        // which is the safe direction (it cannot overrun the operator).
        const remaining = Number.isFinite(entry?.remaining) ? Number(entry.remaining) : 0;
        bySeat.set(alias, remaining > 0 ? remaining : 0);
      }
      cache = { at: now(), bySeat };
      lastError = null;
      return { ok: true, seats: bySeat.size };
    } catch (error) {
      lastError = error?.message || 'the operator could not be reached';
      return { ok: false, reason: lastError };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled: true,
    refresh,
    /**
     * The seat's pack allowance in GPU-seconds, or zero when it is unknown.
     */
    allowanceFor(alias) {
      const value = cache.bySeat.get(alias);
      return Number.isFinite(value) ? value : 0;
    },
    /**
     * Refresh the balances when the cache is older than the window.
     */
    async ensureFresh() {
      if (now() - cache.at < cacheMs) {
        return { ok: true, cached: true, seats: cache.bySeat.size };
      }
      const result = await refresh();
      if (!result.ok) {
        log(`the pack balance could not be read: ${result.reason}`);
      }
      return result;
    },
    snapshot() {
      return {
        enabled: true,
        seats: cache.bySeat.size,
        ageMs: now() - cache.at,
        lastError,
      };
    },
  };
}
