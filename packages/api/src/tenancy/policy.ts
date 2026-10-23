/**
 * Per-tenant extension policy enforcement.
 *
 * WHY THIS FILE EXISTS
 * -------------------
 * `packages/data-provider/src/tenant-policy.ts` decides whether an extension is
 * available; it is pure and had no callers. Without a shared enforcement point
 * each of the three read paths (skills, MCP servers, agents) would re-implement
 * the lookup, and the one that forgot would silently leak every server to every
 * tenant — which is exactly the failure this policy exists to prevent.
 *
 * FAIL-OPEN, DELIBERATELY
 * -----------------------
 * If the policy cannot be loaded (no database, an unreachable store, a malformed
 * document), this returns `undefined` and the caller applies the platform
 * defaults: skills visible, MCP servers and agents denied. That is the same
 * posture `resolveExtension` already documents, and it means a broken policy
 * store narrows access rather than widening it.
 *
 * An operator who has stored nothing for a tenant therefore gets the documented
 * defaults — which is why `GET /api/mcp/servers` stops listing every server the
 * moment this is wired in.
 */
import { filterExtensions, normalizeSemanticMode } from 'librechat-data-provider';
import type { ExtensionKind, TenantPolicy, SemanticMode } from 'librechat-data-provider';
import type { ServerRequest } from '~/types/http';

/**
 * Re-exported so the CJS `api/` layer can require both helpers from one place.
 * The mcp controller does `require('@librechat/api')` and destructures
 * `{ filterExtensions, loadTenantPolicy }`; without this the destructured
 * `filterExtensions` is `undefined` and every MCP list request 500s with
 * "Cannot read properties of undefined". A named import that is not re-exported
 * is the whole failure — the function exists, it is just not on the barrel.
 */
export { filterExtensions };

export type TenantPolicyReader = (tenantId: string) => Promise<TenantPolicy | undefined>;

export type TenantSeatCapability = 'work_tools' | 'mcp' | 'agents' | 'code_execution';
export type TenantSeatPolicy = {
  tenantId: string;
  seatAlias: string;
  accountType: string;
  profileType: 'adult' | 'child';
  allowedModes: SemanticMode[];
  capabilities: TenantSeatCapability[];
  localPrivacyEnabled: boolean;
};
export type TenantSeatPolicyReader = (
  tenantId: string,
  seatAlias: string,
) => Promise<TenantSeatPolicy | undefined>;

const OPAQUE_SEAT_ALIAS = /^[A-Za-z0-9_-]{16,128}$/;

/** Resolves a tenant-bound opaque seat using only authenticated user fields. */
export async function loadUserSeatPolicy(
  user: { tenantId?: string | null; satchidaSeatAlias?: string | null } | undefined,
  readSeat: TenantSeatPolicyReader,
): Promise<TenantSeatPolicy | undefined> {
  const tenantId = user?.tenantId?.trim();
  const seatAlias = user?.satchidaSeatAlias?.trim();
  if (!tenantId || !seatAlias || !OPAQUE_SEAT_ALIAS.test(seatAlias)) return undefined;
  const policy = await readSeat(tenantId, seatAlias);
  if (!policy || policy.tenantId !== tenantId || policy.seatAlias !== seatAlias) return undefined;
  if (policy.profileType !== 'adult' && policy.profileType !== 'child') return undefined;
  if (
    !Array.isArray(policy.allowedModes) ||
    policy.allowedModes.some((mode) => normalizeSemanticMode(mode) == null)
  )
    return undefined;
  if (policy.profileType === 'child' && policy.allowedModes.includes('Work')) return undefined;
  return policy;
}

export function canUseTenantSeatCapability(
  policy: TenantSeatPolicy | undefined,
  capability: TenantSeatCapability,
): boolean {
  if (!policy || policy.profileType === 'child') return false;
  if (policy.accountType === 'family') return false;
  return policy.capabilities.includes(capability);
}

export function applyTenantSeatToUser<
  T extends {
    accountType?: string | null;
    familyRole?: string | null;
    role?: string | null;
    satchidaSeatAlias?: string | null;
    privacyAssertion?: string | null;
    seatToken?: string | null;
  },
>(
  user: T,
  policy: TenantSeatPolicy,
  credentials: { cloudSeatToken?: string | null; privacyAssertion?: string | null },
): T {
  if (!policy.tenantId || policy.tenantId !== (user as T & { tenantId?: string }).tenantId) {
    throw new Error('tenant seat policy owner mismatch');
  }
  const familyRole = user.familyRole == null ? null : user.familyRole;
  let resolvedFamilyRole = 'adult';
  if (policy.profileType === 'child') {
    resolvedFamilyRole = 'minor';
  } else if (familyRole === 'owner') {
    resolvedFamilyRole = 'owner';
  }
  return {
    ...user,
    accountType: policy.accountType,
    familyRole: resolvedFamilyRole,
    satchidaSeatAlias: policy.seatAlias,
    seatToken: credentials.cloudSeatToken ?? undefined,
    privacyAssertion: credentials.privacyAssertion ?? undefined,
  };
}

/**
 * Resolve the tenant that owns a request.
 *
 * `req.user.tenantId` is authoritative; `req.tenantId` is the header/ALS-derived
 * override that `resolveRequestTenantId` prefers. An M2M management request
 * (the agents router) does not pass through `requireJwtAuth`, so ALS is not
 * guaranteed there — hence the user record first.
 */
export function requestTenantId(req: ServerRequest): string | undefined {
  const fromRequest = (req as { tenantId?: string }).tenantId;
  const user = req.user as { tenantId?: string | null } | undefined;
  return (fromRequest ?? user?.tenantId ?? undefined) || undefined;
}

/**
 * Load a tenant's policy, or `undefined` when it cannot be determined.
 *
 * Never throws: a policy read failure must not become a 500 on a list endpoint.
 */
export async function loadTenantPolicy(
  req: ServerRequest,
  readPolicy: TenantPolicyReader,
): Promise<TenantPolicy | undefined> {
  const tenantId = requestTenantId(req);
  if (!tenantId) return undefined;
  try {
    return await readPolicy(tenantId);
  } catch {
    return undefined;
  }
}

/**
 * Filter a named list down to what this tenant's policy allows.
 *
 * Order-preserving, so pagination cursors over the surviving rows stay valid.
 * `nameOf` must return the same identifier the operator used in `rules`.
 */
export function applyTenantPolicy<T>(
  policy: TenantPolicy | undefined,
  kind: ExtensionKind,
  items: T[],
  nameOf: (item: T) => string,
): T[] {
  return filterExtensions(policy, kind, items, nameOf);
}
