const express = require('express');
const { createAdminEntitlementsHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

/**
 * Operator-only. Entitlements are cross-tenant budget data (seat limits, plan
 * terms and per-account allocations), so unlike grants these routes are never
 * reachable by a tenant admin — only a platform operator
 * (`operator:control`, platformOnly) may read or set them.
 */
const requireOperator = requireCapability(SystemCapabilities.OPERATOR_CONTROL, {
  platformOnly: true,
});

const handlers = createAdminEntitlementsHandlers({
  getTenantEntitlement: db.getTenantEntitlement,
  listTenantEntitlements: db.listTenantEntitlements,
  setTenantEntitlement: db.setTenantEntitlement,
  recordAuditEntry: db.recordAuditEntry,
});

router.use(requireJwtAuth, requireOperator);

router.get('/', handlers.listEntitlements);
router.get('/:tenantId', handlers.getEntitlement);
router.put('/:tenantId', handlers.setEntitlement);

module.exports = router;
