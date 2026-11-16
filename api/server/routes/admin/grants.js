const express = require('express');
const { createAdminGrantsHandlers, getCachedPrincipals } = require('@librechat/api');
const { SystemCapabilities, runAsSystem } = require('@librechat/data-schemas');
const { PrincipalType } = require('librechat-data-provider');
const { hasCapability, requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const { requireAdminStepUp } = require('~/server/middleware/adminStepUp');
const db = require('~/models');

const router = express.Router();

/**
 * Admin-surface gate. Satisfied by a platform operator (`operator:control`
 * implies every capability) or by a tenant admin holding `access:admin` within
 * their own tenant. `hasCapability` derives the tenant from the caller, so
 * tenant-scoped authority never reaches another tenant's rows; `assignGrant`
 * additionally refuses to grant a capability the caller does not hold, and
 * refuses `operator:control` outright.
 */
const requireAdminSurface = requireCapability(SystemCapabilities.ACCESS_ADMIN);

/** Platform operator only — see the `tenant-admin` route below. */
const requireOperator = requireCapability(SystemCapabilities.OPERATOR_CONTROL, {
  platformOnly: true,
});

const handlers = createAdminGrantsHandlers({
  listGrants: db.listGrants,
  countGrants: db.countGrants,
  getCapabilitiesForPrincipal: db.getCapabilitiesForPrincipal,
  getCapabilitiesForPrincipals: db.getCapabilitiesForPrincipals,
  grantCapability: db.grantCapability,
  revokeCapability: db.revokeCapability,
  getUserPrincipals: db.getUserPrincipals,
  hasCapabilityForPrincipals: db.hasCapabilityForPrincipals,
  getHeldCapabilities: db.getHeldCapabilities,
  getCachedPrincipals,
  checkPrincipalExists: (principalType, principalId) =>
    /**
     * Existence guard only: a grant is always written into the caller's own
     * tenant (or, for an operator, an explicitly named one) and the unique index
     * includes `tenantId`, so a mis-typed id can never widen access. Checked
     * under the system scope so an operator provisioning another tenant's
     * administrator can validate that tenant's principals.
     */
    runAsSystem(async () => {
      if (principalType === PrincipalType.ROLE) {
        return (await db.getRoleByName(principalId)) != null;
      }
      if (principalType === PrincipalType.GROUP) {
        return (await db.findGroupById(principalId)) != null;
      }
      return (await db.getUserById(principalId)) != null;
    }),
  isPlatformOperator: (user) =>
    hasCapability(user, SystemCapabilities.OPERATOR_CONTROL, { platformOnly: true }),
  resolvePrincipalName: async (principalType, principalId) => {
    if (principalType === PrincipalType.GROUP) {
      return (await db.findGroupById(principalId))?.name ?? undefined;
    }
    if (principalType === PrincipalType.USER) {
      const user = await db.getUserById(principalId);
      return user?.name || user?.email || undefined;
    }
    return undefined;
  },
  seedTenantAdmin: db.seedTenantAdmin,
  /** Limited tenant user-admin seed (ACCESS_ADMIN + MANAGE_USERS + reads). */
  seedTenantUserAdmin: db.seedTenantUserAdmin,
  recordAuditEntry: db.recordAuditEntry,
  /** Opt-in: fail the grant request if its audit entry can't be persisted. */
  auditFailClosed: process.env.AUDIT_LOG_FAIL_CLOSED === 'true',
});

router.use(requireJwtAuth, requireAdminSurface);

// Effective capabilities is called by client to determine UI permissions
router.get('/effective', handlers.getEffectiveCapabilities);

/* ─────────────────────────────────────────────────────────────────────
 * TOTP step-up gate for all sensitive grant operations.
 * GET /effective above is exempt (safe, non-mutating, used for UI setup).
 * Everything below (listing, assigning, revoking) requires a valid
 * step-up token minted by POST /api/admin/step-up after TOTP verification.
 * ───────────────────────────────────────────────────────────────────── */
router.use(requireAdminStepUp);

router.get('/', handlers.listGrants);
router.get('/:principalType/:principalId', handlers.getPrincipalGrants);
router.post('/', handlers.assignGrant);
/**
 * Operator-only. Deliberately NOT behind `requireAdminSurface`: a tenant admin
 * must not be able to mint further tenant administrators.
 */
router.post('/tenant-admin', requireOperator, handlers.provisionTenantAdmin);
/**
 * Operator-only. Provisions a LIMITED tenant administrator — create/edit users
 * and assign them to pre-seeded account-type groups, but NOT create/edit groups
 * or roles. Seat caps are enforced upstream by one-api (Group.MaxSeats, HTTP 409).
 */
router.post('/tenant-user-admin', requireOperator, handlers.provisionTenantUserAdmin);
/** Callers should encodeURIComponent the capability for client compatibility (e.g. manage%3Aconfigs%3Aendpoints). */
router.delete('/:principalType/:principalId/:capability', handlers.revokeGrant);

module.exports = router;
