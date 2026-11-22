const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const { runAsSystem } = require('@librechat/data-schemas');
const {
  generateCheckAccess,
  createOpenCodeHttpHandlers,
  createOpenCodePtyRegistry,
  createOpenCodePreviewManager,
} = require('@librechat/api');
const { PermissionTypes, Permissions } = require('librechat-data-provider');
const { promptUsageLimiter } = require('~/server/middleware/limiters');
const { getAppConfig } = require('~/server/services/Config');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const db = require('~/models');

const router = express.Router();
const ptyRegistry = createOpenCodePtyRegistry();
const previewManager = createOpenCodePreviewManager();
let handlers;

function getHandlers() {
  if (handlers == null) {
    handlers = createOpenCodeHttpHandlers({
      getAppConfig,
      getChatProject: db.getChatProject,
      updateChatProject: db.updateChatProject,
      ptyRegistry,
      previewManager,
      createUpstreamWebSocket: (wsUrl, opts) => new WebSocket(wsUrl, opts),
      verifyJwt: (token) => {
        const secrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET].filter(Boolean);
        for (const secret of secrets) {
          try {
            const decoded = jwt.verify(token, secret);
            if (decoded && typeof decoded === 'object' && typeof decoded.id === 'string') {
              return { id: decoded.id, tenantId: decoded.tenantId };
            }
          } catch {
            /* try next secret */
          }
        }
        return null;
      },
      enforcePlatformAdminForPty: true,
      getUserSeatCredential: (userId) =>
        runAsSystem(async () => {
          const User = mongoose.models.User;
          if (!User) {
            return null;
          }
          return User.findById(userId)
            .select('+seatToken accountType tenantId role familyRole')
            .lean();
        }),
    });
  }
  return handlers;
}

const checkOpenCodeAccess = generateCheckAccess({
  permissionType: PermissionTypes.OPENCODE,
  permissions: [Permissions.USE],
  getRoleByName: db.getRoleByName,
});

/* Internal seat-attributing LLM proxy for opencode-serve -> Satchida Gateway (one-api :4000 -> Bifrost :8700) */
router.use('/llm-proxy/v1', (req, res) => getHandlers().proxyLlmToGateway(req, res));

/* Same-origin preview iframe proxy (enforces owner-scoped HttpOnly preview cookie or Bearer JWT) */
router.use('/:projectId/preview/proxy', (req, res) => getHandlers().proxyPreview(req, res));

/* Built-in Satchida Headless Reader endpoint for loopback vibecoded apps & authenticated users */
router.get('/reader', (req, res) => getHandlers().readUrlContent(req, res));

router.use(requireJwtAuth);
router.use(checkOpenCodeAccess);

router.get('/status', (req, res) => getHandlers().getStatus(req, res));

/* Workspace files & 1-click export */
router.post('/:projectId/workspace', (req, res) => getHandlers().provisionWorkspace(req, res));
router.get('/:projectId/export-zip', (req, res) => getHandlers().exportProjectZip(req, res));
router.get('/:projectId/tree', (req, res) => getHandlers().getTree(req, res));
router.get('/:projectId/file', (req, res) => getHandlers().readFile(req, res));
router.post('/:projectId/file', (req, res) => getHandlers().writeFile(req, res));

/* PTY sessions */
router.post('/:projectId/pty', (req, res) => getHandlers().createPty(req, res));
router.put('/:projectId/pty/:ptyId/resize', (req, res) => getHandlers().resizePty(req, res));
router.post('/:projectId/pty/:ptyId/connect-token', (req, res) =>
  getHandlers().createPtyConnectToken(req, res),
);

/* Chat loop & sessions */
router.get('/:projectId/sessions', (req, res) => getHandlers().listSessions(req, res));
router.post('/:projectId/sessions', (req, res) => getHandlers().createSession(req, res));
router.post('/:projectId/sessions/:sessionId/prompt', promptUsageLimiter, (req, res) =>
  getHandlers().sendPrompt(req, res),
);
router.post('/:projectId/sessions/:sessionId/abort', (req, res) =>
  getHandlers().abortSession(req, res),
);
router.get('/:projectId/sessions/:sessionId/messages', (req, res) =>
  getHandlers().getSessionMessages(req, res),
);
router.get('/:projectId/sessions/:sessionId/diff', (req, res) =>
  getHandlers().getSessionDiff(req, res),
);
router.post('/:projectId/sessions/:sessionId/revert', (req, res) =>
  getHandlers().revertSession(req, res),
);
router.post('/:projectId/sessions/:sessionId/unrevert', (req, res) =>
  getHandlers().unrevertSession(req, res),
);

/* Live SSE event relay */
router.get('/:projectId/events', (req, res) => getHandlers().streamEvents(req, res));

/* Models, agents, permissions & questions */
router.get('/:projectId/providers', (req, res) => getHandlers().getProviders(req, res));
router.get('/:projectId/agents', (req, res) => getHandlers().listAgents(req, res));
router.get('/:projectId/permissions', (req, res) => getHandlers().listPermissions(req, res));
router.post('/:projectId/permissions/:requestId', (req, res) =>
  getHandlers().replyPermission(req, res),
);
router.get('/:projectId/questions', (req, res) => getHandlers().listQuestions(req, res));
router.post('/:projectId/questions/:requestId/reply', (req, res) =>
  getHandlers().replyQuestion(req, res),
);
router.post('/:projectId/questions/:requestId/reject', (req, res) =>
  getHandlers().rejectQuestion(req, res),
);

/* Phase 4: VCS (Git Changes) & Preview lifecycle */
router.get('/:projectId/vcs', (req, res) => getHandlers().getVcs(req, res));
router.get('/:projectId/preview/status', (req, res) => getHandlers().getPreviewStatus(req, res));
router.post('/:projectId/preview/start', (req, res) => getHandlers().startPreview(req, res));
router.post('/:projectId/preview/stop', (req, res) => getHandlers().stopPreview(req, res));

/* Legacy one-shot prompt creation */
router.post('/:projectId/prompt', promptUsageLimiter, (req, res) =>
  getHandlers().createSessionPrompt(req, res),
);

router.ptyRegistry = ptyRegistry;

module.exports = router;
