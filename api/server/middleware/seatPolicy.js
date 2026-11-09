const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

/**
 * Seat-policy projection: resolves the commercial policy a request's user holds
 * through LibreChat group membership and attaches it to `req.user`.
 *
 * Why this exists: the Group schema carries `accountType`, `allowedCapabilities`
 * and `allowedModes` ("the commercial account type every member of this group
 * holds"), and the admin surface can create such groups and add members. But no
 * request-time layer projected that policy onto `req.user`, so every consumer —
 * the `/api/ide` VS Code Server gate first among them — saw `undefined` for
 * members of a Pro group and denied them. Entitlement-driven seat assignments
 * already write `accountType` onto the user document; group membership is the
 * operator-side path that must also work.
 *
 * Merge rules:
 * - `accountType`: the user document's value always wins (it is the commercial
 *   seat of record). Group `accountType` fills the gap only when the document
 *   carries none.
 * - `allowedCapabilities`: union of the user document's value and every group's
 *   list. This is what makes "member of the Pro group => vscode_server" true.
 * - `allowedModes`: only non-empty group lists narrow. An empty group list means
 *   "the operator's One-API group decides" per the schema contract, so it is
 *   skipped; multiple narrowing lists intersect.
 *
 * Fail-open on lookup errors: a projection failure must not turn every
 * authenticated request into a 500. Consumers keep their own fail-closed gates
 * (a user without the projected capability is denied by the gate itself).
 *
 * Membership changes take effect within `CACHE_TTL_MS`; the admin membership
 * endpoints do not yet invalidate this cache.
 */
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 2000;
const policyCache = new Map();

async function resolveGroupSeatPolicy(userId) {
  const groups = await mongoose.connection.db
    .collection('groups')
    .find({ memberIds: String(userId) })
    .project({ name: 1, accountType: 1, allowedCapabilities: 1, allowedModes: 1 })
    .toArray();

  if (!groups.length) {
    return null;
  }

  let accountType;
  for (const group of groups) {
    if (group.accountType) {
      accountType = group.accountType;
      break;
    }
  }

  const capabilities = new Set();
  for (const group of groups) {
    for (const capability of group.allowedCapabilities ?? []) {
      capabilities.add(capability);
    }
  }

  let allowedModes;
  for (const group of groups) {
    const modes = Array.isArray(group.allowedModes) ? group.allowedModes.filter(Boolean) : [];
    if (modes.length === 0) {
      continue;
    }
    const narrowed = allowedModes ?? modes;
    allowedModes = narrowed.filter((mode) => modes.includes(mode));
  }

  const policy = {};
  if (accountType) {
    policy.accountType = accountType;
  }
  if (capabilities.size > 0) {
    policy.allowedCapabilities = [...capabilities].sort();
  }
  if (allowedModes && allowedModes.length > 0) {
    policy.allowedModes = allowedModes;
  }
  return Object.keys(policy).length > 0 ? policy : null;
}

async function attachSeatPolicy(req, _res, next) {
  const user = req.user;
  const userId = user?.id?.toString?.() ?? user?._id?.toString?.();
  if (!userId) {
    return next();
  }
  try {
    let entry = policyCache.get(userId);
    if (!entry || entry.expires < Date.now()) {
      const policy = await resolveGroupSeatPolicy(userId);
      entry = { policy, expires: Date.now() + CACHE_TTL_MS };
      if (policyCache.size > MAX_CACHE_ENTRIES) {
        policyCache.clear();
      }
      policyCache.set(userId, entry);
    }
    if (entry.policy) {
      if (!user.accountType && entry.policy.accountType) {
        user.accountType = entry.policy.accountType;
      }
      if (entry.policy.allowedCapabilities?.length) {
        user.allowedCapabilities = [
          ...new Set([...(user.allowedCapabilities ?? []), ...entry.policy.allowedCapabilities]),
        ];
      }
      if (entry.policy.allowedModes?.length) {
        user.allowedModes = entry.policy.allowedModes;
      }
    }
    return next();
  } catch (err) {
    logger.warn(
      `[seatPolicy] group policy resolution failed for user; continuing without seat projection: ${err.message}`,
    );
    return next();
  }
}

/** Test/admin hook: drop the in-process policy cache. */
function clearSeatPolicyCache() {
  policyCache.clear();
}

module.exports = { attachSeatPolicy, resolveGroupSeatPolicy, clearSeatPolicyCache };
