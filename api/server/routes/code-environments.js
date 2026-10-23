const express = require('express');
const {
  GenerationJobManager,
  createCodeEnvironmentHttpHandlers,
  codeEnvironmentPairingLimiter,
  codeEnvironmentStatusIpLimiter,
  codeEnvironmentStatusLimiter,
} = require('@librechat/api');
const { hasOperatorControl } = require('~/server/middleware/roles/capabilities');
const { getAppConfig, getCodeEnvironmentRegistry } = require('~/server/services/Config');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();
let handlers;
function getHandlers() {
  if (handlers == null) {
    handlers = createCodeEnvironmentHttpHandlers({
      getAppConfig,
      registry: getCodeEnvironmentRegistry(),
      principalIsActive: db.isAgentTriggerPrincipalActive,
      conversations: {
        get: db.getConvoCodeEnvironmentDecision,
        replaceDecision: db.replaceConvoCodeEnvironmentDecision,
      },
      generations: GenerationJobManager,
    });
  }
  return handlers;
}
router.use(requireJwtAuth);

const requireOperatorForEnvironmentRegistration = async (req, res, next) => {
  try {
    const allowed = await hasOperatorControl({
      id: req.user?.id ?? req.user?._id?.toString(),
      role: req.user?.role ?? '',
      tenantId: req.user?.tenantId,
      idOnTheSource: req.user?.idOnTheSource ?? null,
    });
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  } catch {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
router.get('/', (req, res, next) => getHandlers().list(req, res, next));
router.post('/pairings', codeEnvironmentPairingLimiter, (req, res, next) =>
  getHandlers().pair(req, res, next),
);
router.post('/', requireOperatorForEnvironmentRegistration, (req, res, next) =>
  getHandlers().register(req, res, next),
);
router.get(
  '/:environmentId/status',
  codeEnvironmentStatusIpLimiter,
  codeEnvironmentStatusLimiter,
  (req, res, next) => getHandlers().status(req, res, next),
);
router.patch('/:environmentId/settings', (req, res, next) =>
  getHandlers().updateSettings(req, res, next),
);
router.delete('/:environmentId', (req, res, next) => getHandlers().remove(req, res, next));
router.patch(
  '/conversations/:conversationId/decision',
  codeEnvironmentStatusIpLimiter,
  codeEnvironmentStatusLimiter,
  (req, res, next) => getHandlers().moveConversationDecision(req, res, next),
);

module.exports = router;
