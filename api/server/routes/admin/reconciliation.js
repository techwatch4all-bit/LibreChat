const express = require('express');
const { createAdminReconciliationHandlers, BillingService } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.OPERATOR_CONTROL, {
  platformOnly: true,
});

const billingService = new BillingService({
  billingMethods: db,
  getUserById: db.getUserById,
  updateUser: db.updateUser,
  upsertBalanceFields: db.upsertBalanceFields,
});

const handlers = createAdminReconciliationHandlers({
  billingMethods: db,
  billingService,
});

router.use(requireJwtAuth, requireAdminAccess);

router.get('/', handlers.listLedger);
router.get('/export.csv', handlers.exportCsv);
router.post('/:id/approve', handlers.approvePayment);
router.post('/:id/reject', handlers.rejectPayment);

module.exports = router;
