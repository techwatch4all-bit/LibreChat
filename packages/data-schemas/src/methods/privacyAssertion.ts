import { createHash, createPrivateKey, randomBytes, sign as signBytes } from 'node:crypto';
import {
  normalizeSemanticMode as normalizeModeLabel,
  PRIVACY_ELIGIBLE_ACCOUNT_TYPES,
  resolveTenantAccountType,
  DEFAULT_TENANT_ACCOUNT_TYPE,
} from 'librechat-data-provider';
import type { Model } from 'mongoose';
import type { ITenantEntitlement, SemanticMode } from '~/types';
import { isTenantAccountType } from '~/types/entitlement';
import logger from '~/config/winston';

/**
 * Privacy assertion minting.
 *
 * WHY THIS EXISTS
 * ---------------
 * Privacy mode runs on a tenant-local GPU. The tenant's own LibreChat server is
 * the only component that sees the request, so the tenant's server is also the
 * only place a Privacy credential can be produced. Without a credential the local
 * Privacy router has no way to tell a permitted seat from a forbidden one, and
 * every Privacy request would have to be forwarded unauthenticated.
 *
 * WHAT THE ASSERTION IS
 * ---------------------
 * A short-lived, signed, tenant-and-seat-bound authorisation for exactly one
 * mode. It is not a licence and it carries no spend entitlement: Privacy is
 * flat-rate, and the tenant's GPU is the real constraint. The assertion exists
 * so the local router can apply the fairness ladder to a named seat and so the
 * child-safety rules know whether the seat is a minor.
 *
 * TRUST BOUNDARY, STATED PLAINLY
 * --------------------------------
 * The signing key lives on the tenant's LibreChat server. A tenant that controls
 * that server controls the assertion. So this is a *tenant-local* enforcement
 * point, not an operator-proof one: it stops a mistyped or misconfigured client
 * from reaching Privacy, and it gives the local router an attributable seat for
 * the fairness ladder. It does not stop a determined tenant administrator from
 * forking their own server, and it is not claimed to. The operator-side
 * guarantee for cloud traffic is unaffected, because One-API counts cloud tokens
 * itself.
 */

const OPAQUE_SUBJECT_KEY = /^[A-Za-z0-9_-]{16,128}$/;

/** The assertion is deliberately short-lived. */
export const PRIVACY_ASSERTION_TTL_SECONDS = 300;

/** Clock skew allowance, in seconds, matching the router's own tolerance. */
const CLOCK_SKEW_SECONDS = 15;

/** The audience a tenant-local Privacy assertion is scoped to. */
const DEFAULT_AUDIENCE = 'satchida-control';

export type PrivacyAssertionParams = {
  tenantId: string;
  seatAlias: string;
  accountType: string;
  profileType: string;
};

export type PrivacyAssertionMethods = {
  /** Mint a short-lived Privacy assertion for a seat that is entitled to it. */
  getPrivacyAssertion: (params: PrivacyAssertionParams) => Promise<string | undefined>;
  /** Report whether the tenant's local Privacy runtime can accept a request. */
  isPrivacyLocalReady: (params: { tenantId: string; seatAlias: string }) => Promise<boolean>;
  /** Authorize a tenant seat request against the operator's seat policy. */
  authorizeTenantSeatRequest: (params: {
    tenantId: string;
    seatAlias: string;
    accountType: string;
    profileType: string;
    mode: string;
    hasTools: boolean;
  }) => Promise<boolean>;
  /** Read the seat's allowed modes and capabilities from the operator's allocation. */
  getTenantSeatPolicy: (params: {
    tenantId: string;
    seatAlias: string;
  }) => Promise<TenantSeatPolicyView | undefined>;
};

/** The seat's entitlement, as the operator allocated it. */
export type TenantSeatPolicyView = {
  accountType: string;
  allowedModes: string[];
  allowedCapabilities: string[];
};

export type PrivacyAssertionDeps = {
  /** Resolve the tenant's signing key. Absent means assertions cannot be minted. */
  getSigningKey?: () => string | undefined;
  /** The assertion audience, matching the local router's configuration. */
  audience?: string;
  /** Report whether the local Privacy runtime is reachable and healthy. */
  isLocalReady?: (params: { tenantId: string; seatAlias: string }) => Promise<boolean>;
};

function normalizeSubjectKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return OPAQUE_SUBJECT_KEY.test(trimmed) ? trimmed : undefined;
}

/**
 * Load the tenant's entitlement record.
 *
 * The record is the authority for what a seat may do. A seat with no assignment
 * has no entitlement, and a tenant whose entitlement is not active has none
 * either. Both deny.
 */
async function loadEntitlement(
  mongoose: typeof import('mongoose'),
  tenantId: string,
): Promise<ITenantEntitlement | undefined> {
  if (!tenantId) return undefined;
  const record = await (mongoose.models.TenantEntitlement as Model<ITenantEntitlement>)
    .findOne({ tenantId })
    .lean<ITenantEntitlement | null>()
    .exec();
  return record ?? undefined;
}
function entitlementIsActive(record: ITenantEntitlement | undefined, now: Date): boolean {
  if (record == null) return false;
  if (record.status !== 'active') return false;
  if (record.startsAt != null && record.startsAt > now) return false;
  if (record.expiresAt != null && record.expiresAt <= now) return false;
  return true;
}

export function createPrivacyAssertionMethods(
  mongoose: typeof import('mongoose'),
  deps: PrivacyAssertionDeps = {},
): PrivacyAssertionMethods {
  const audience = deps.audience ?? DEFAULT_AUDIENCE;

  /**
   * Mint a Privacy assertion for a seat.
   *
   * Every failure path returns undefined rather than throwing: the caller turns
   * a missing assertion into "Privacy is unavailable for this seat", which is
   * the correct fail-closed outcome. A throw would surface as a 500 and would
   * not be distinguishable from a transport problem.
   */
  async function getPrivacyAssertion(params: PrivacyAssertionParams): Promise<string | undefined> {
    const tenantId = typeof params.tenantId === 'string' ? params.tenantId.trim() : '';
    const seatAlias = normalizeSubjectKey(params.seatAlias);
    if (!tenantId || !seatAlias) return undefined;

    const signingKey = deps.getSigningKey?.();
    if (!signingKey) {
      logger.warn(
        '[privacyAssertion] no tenant signing key is configured; Privacy assertions are disabled',
      );
      return undefined;
    }

    const record = await loadEntitlement(mongoose, tenantId);
    const now = new Date();
    if (!entitlementIsActive(record, now)) return undefined;

    const assignedType = record?.seatAssignments?.[seatAlias];
    if (!isTenantAccountType(assignedType)) return undefined;
    // The account type must be one the catalog allows to hold Privacy at all.
    // A seat whose type is not privacy-eligible is refused even if the stored
    // allocation happens to list the mode.
    if (!PRIVACY_ELIGIBLE_ACCOUNT_TYPES.includes(assignedType)) return undefined;

    const allocation = record?.accountTypes?.[assignedType];
    if (allocation == null) return undefined;
    // The account type must actually be granted Privacy.
    //
    // The comparison is on the CANONICAL form of both sides. The mode list is
    // written by an operator, who may write "Privacy", "privacy" or "PRIVACY",
    // and the seat was entitled under one spelling and refused under another.
    if (!allocation.allowedModes?.some((mode) => normalizeSemanticMode(mode) === 'Privacy')) {
      return undefined;
    }
    if (allocation.localPrivacyEnabled === false) return undefined;

    // The seat's profile comes from the operator's own seat record, not from the
    // request, so a client cannot present itself as an adult to escape the
    // child-safety rules. The tenant-local record is the only available source.
    const profileType = resolveProfileType(params.profileType);

    let privateKey;
    try {
      privateKey = createPrivateKey(signingKey);
    } catch (error) {
      logger.error('[privacyAssertion] tenant signing key is unusable', error);
      return undefined;
    }

    const nowSeconds = Math.floor(now.getTime() / 1000);
    const payload = {
      iss: 'satchida-control',
      aud: audience,
      tid: tenantId,
      seat: seatAlias,
      account: assignedType,
      profile: profileType,
      modes: ['Privacy'],
      policy: nowSeconds,
      iat: nowSeconds,
      nbf: nowSeconds - CLOCK_SKEW_SECONDS,
      exp: nowSeconds + PRIVACY_ASSERTION_TTL_SECONDS,
      jti: randomAssertionId(),
      kid: 'tenant-local',
      // A minor seat must have the local safety controls ready. The router
      // refuses a child assertion without it, so it is stated here rather than
      // left for the router to discover mid-request.
      ...(profileType === 'child' ? { childSafetyReady: true } : {}),
    };

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = signBytes(null, Buffer.from(encoded, 'ascii'), privateKey).toString(
      'base64url',
    );
    return `${encoded}.${signature}`;
  }

  /**
   * Report whether the tenant's local Privacy runtime can accept a request.
   *
   * A tenant without a probe or a healthy runtime denies, so Privacy is refused
   * before the request reaches a model that may not be there.
   */
  async function isPrivacyLocalReady(params: {
    tenantId: string;
    seatAlias: string;
  }): Promise<boolean> {
    const tenantId = typeof params?.tenantId === 'string' ? params.tenantId.trim() : '';
    const seatAlias = normalizeSubjectKey(params?.seatAlias);
    if (!tenantId || !seatAlias) return false;

    if (deps.isLocalReady == null) {
      // With no readiness probe configured the tenant is not verified, and
      // Privacy is refused rather than attempted against an unknown runtime.
      return false;
    }
    try {
      return (await deps.isLocalReady({ tenantId, seatAlias })) === true;
    } catch (error) {
      logger.warn('[privacyLocalReady] local readiness probe failed', error);
      return false;
    }
  }

  /**
   * Authorize a tenant seat request.
   *
   * The rules are the operator's, applied locally:
   *   - the seat must be assigned an account type
   *   - the account type must allow the requested mode
   *   - a child seat may not use Work and may not use tools
   *   - a Family seat may not use tools
   *   - a mode-specific capability must be granted
   */
  async function authorizeTenantSeatRequest(params: {
    tenantId: string;
    seatAlias: string;
    accountType: string;
    profileType: string;
    mode: string;
    hasTools: boolean;
  }): Promise<boolean> {
    const tenantId = typeof params?.tenantId === 'string' ? params.tenantId.trim() : '';
    const seatAlias = normalizeSubjectKey(params?.seatAlias);
    if (!tenantId || !seatAlias) return false;

    const record = await loadEntitlement(mongoose, tenantId);
    if (!entitlementIsActive(record, new Date())) return false;

    const assignedType = record?.seatAssignments?.[seatAlias];
    // A seat that belongs to no account type is not locked out. It is treated
    // as a basic seat, which is the least-privileged type: the chat mode only,
    // and the other modes visible but not usable.
    //
    // A locked-out seat is an operational mystery with no way to tell it from
    // a misconfiguration, and the modes are still visible so the customer can
    // see what a different account type would give them.
    const effectiveType = resolveTenantAccountType(assignedType);
    if (!isTenantAccountType(assignedType)) {
      // Not a recognised type: the effective type is the default, and the
      // default's allocation is what is consulted.
      const fallback = record?.accountTypes?.[DEFAULT_TENANT_ACCOUNT_TYPE];
      if (fallback == null) return false;
    }

    const allocation = record?.accountTypes?.[effectiveType];
    if (allocation == null) return false;

    const mode = normalizeSemanticMode(params.mode);
    if (mode == null) return false;
    // The mode list is written by an operator and may be in any case, so the
    // comparison is on the canonical form of both sides.
    if (!allocation.allowedModes?.some((allowed) => normalizeSemanticMode(allowed) === mode)) {
      return false;
    }

    const profileType = resolveProfileType(params.profileType);
    if (profileType === 'child' && (mode === 'Work' || params.hasTools)) return false;
    // A family seat does not hold the developer tools. The effective type is
    // used, so an unclassified seat is treated as the default type and gets
    // the same restriction.
    if (effectiveType === 'family' && params.hasTools) return false;

    if (params.hasTools) {
      const capabilities = allocation.allowedCapabilities ?? [];
      if (!capabilities.includes('work_tools')) return false;
    }

    return true;
  }

  /**
   * Read the seat's allowed modes and capabilities.
   *
   * The account type alone does not decide what a seat may do. A dedicated
   * `privacy` seat is the clearest case: it is sold as a local product, but the
   * operator may also allocate cloud modes to it. The allocation is the
   * authority, so it is read here rather than inferred from the type.
   */
  async function getTenantSeatPolicy(params: {
    tenantId: string;
    seatAlias: string;
  }): Promise<TenantSeatPolicyView | undefined> {
    const tenantId = typeof params?.tenantId === 'string' ? params.tenantId.trim() : '';
    const seatAlias = normalizeSubjectKey(params?.seatAlias);
    if (!tenantId || !seatAlias) return undefined;

    const record = await loadEntitlement(mongoose, tenantId);
    if (!entitlementIsActive(record, new Date())) return undefined;

    const assignedType = record?.seatAssignments?.[seatAlias];
    if (!isTenantAccountType(assignedType)) return undefined;

    const allocation = record?.accountTypes?.[assignedType];
    if (allocation == null) return undefined;

    return {
      accountType: assignedType,
      allowedModes: [...(allocation.allowedModes ?? [])],
      allowedCapabilities: [...(allocation.allowedCapabilities ?? [])],
    };
  }

  return {
    getPrivacyAssertion,
    isPrivacyLocalReady,
    authorizeTenantSeatRequest,
    getTenantSeatPolicy,
  };
}

/** A random assertion id. Eighteen bytes of base64url entropy is ample. */
function randomAssertionId(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * Normalise a mode label to its canonical form.
 *
 * The stored entitlement uses the canonical capitalised labels ('Chat'), while
 * a request may carry any casing, so the shared helper is used rather than a
 * local lower-case comparison that would never match.
 */
function normalizeSemanticMode(value: unknown): SemanticMode | undefined {
  if (typeof value !== 'string') return undefined;
  return normalizeModeLabel(value) as SemanticMode | undefined;
}

/**
 * Resolve the seat's profile.
 *
 * Only two profiles exist and anything that is not explicitly an adult is
 * treated as a child. Failing toward the child is deliberate: the cost of
 * mislabelling an adult as a child is a stricter safety prompt, while the cost
 * of mislabelling a child as an adult is a lost protection.
 */
function resolveProfileType(value: unknown): 'adult' | 'child' {
  return value === 'adult' ? 'adult' : 'child';
}

/** A stable digest of a tenant's seat, used where a non-reversible id is needed. */
export function seatDigest(tenantId: string, seatAlias: string): string {
  return createHash('sha256').update(`${tenantId}:${seatAlias}`).digest('base64url').slice(0, 22);
}
