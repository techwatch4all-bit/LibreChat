const express = require('express');
const { createAdminGroupsHandlers } = require('@librechat/api');
const { SystemCapabilities, runAsSystem } = require('@librechat/data-schemas');
const { hasCapability, requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

// ── One-API seat sync helper (inline, no cross-require from users.js) ─────────
// When a user is manually moved between groups via the Groups UI, we need to
// re-sync their seat policy to One-API so their allowed modes / tier stay correct.
async function syncMemberSeatAfterGroupChange(userId) {
  try {
    const ONEAPI_BASE_URL = (
      process.env.ONEAPI_BASE_URL || 'https://gateway.satchida.com'
    ).replace(/\/+$/, '');
    const ONEAPI_TOKEN = process.env.ONEAPI_ADMIN_ACCESS_TOKEN;
    const ONEAPI_TENANT = process.env.ONEAPI_DEFAULT_TENANT || 'satchida-master';
    const CF_CLIENT_ID = process.env.ONEAPI_CF_CLIENT_ID || '';
    const CF_CLIENT_SECRET = process.env.ONEAPI_CF_CLIENT_SECRET || '';

    if (!ONEAPI_TOKEN) return;

    const user = await runAsSystem(() =>
      db.getUserById(
        userId,
        'name username email satchidaSeatAlias accountType tenantId familyRole suspended',
      ),
    );
    if (!user || user.suspended) return;

    const SEAT_POLICY_BY_TYPE = {
      basic: { modes: 'chat', models: 'Chat' },
      standard: { modes: 'chat,work', models: 'Chat,Work' },
      family: { modes: 'chat,study,work', models: 'Chat,Study,Work' },
      pro: { modes: 'chat,study,work,vibecoding', models: 'Chat,Study,Work,Vibecoding' },
      pro_family: { modes: 'chat,study,work,vibecoding', models: 'Chat,Study,Work,Vibecoding' },
      enterprise: {
        modes: 'chat,study,work,privacy,vibecoding',
        models: 'Chat,Study,Work,Privacy,Vibecoding',
      },
      privacy: { modes: 'chat,study,work,privacy', models: 'Chat,Study,Work,Privacy' },
    };

    const tenantId = (user.tenantId || ONEAPI_TENANT).trim();
    const effectiveType = user.accountType || 'basic';
    const policy = SEAT_POLICY_BY_TYPE[effectiveType] || SEAT_POLICY_BY_TYPE.basic;

    let aliasId = user.satchidaSeatAlias;
    if (!aliasId) {
      const cleanName = (user.name || user.username || user.email?.split('@')[0] || 'user')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 32);
      aliasId = `seat_${cleanName}_${user._id.toString().slice(-6)}`;
      await runAsSystem(() => db.updateUser(userId, { satchidaSeatAlias: aliasId }));
    }

    const headers = {
      Authorization: ONEAPI_TOKEN,
      'Content-Type': 'application/json',
      ...(CF_CLIENT_ID && CF_CLIENT_SECRET
        ? { 'CF-Access-Client-Id': CF_CLIENT_ID, 'CF-Access-Client-Secret': CF_CLIENT_SECRET }
        : {}),
    };

    await fetch(`${ONEAPI_BASE_URL}/api/tenant/${encodeURIComponent(tenantId)}/seat-policy`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        alias_id: aliasId,
        seat_tier: effectiveType,
        profile_type: user.familyRole === 'minor' ? 'child' : 'adult',
        account_type: effectiveType,
        allowed_modes: policy.modes.split(','),
        allowed_models: policy.models.split(','),
      }),
    }).catch((err) =>
      console.warn(`[oneApi/groups] seat-policy sync failed for user ${userId}:`, err.message),
    );
  } catch (err) {
    console.warn(`[oneApi/groups] syncMemberSeatAfterGroupChange error:`, err.message);
  }
}

const router = express.Router();

/**
 * Admin-surface gate. Satisfied by a platform operator (`operator:control`
 * implies every capability) or by a tenant admin holding `access:admin` within
 * their own tenant. `hasCapability` derives the tenant from the caller, so
 * tenant-scoped authority never reaches another tenant's rows; the per-route
 * capabilities below then narrow each action.
 */
const requireAdminSurface = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadGroups = requireCapability(SystemCapabilities.READ_GROUPS);
const requireManageGroups = requireCapability(SystemCapabilities.MANAGE_GROUPS);

/** Platform operator only — for group creation and deletion */
const requireOperatorForGroupMutations = async (req, res, next) => {
  const isOperator = await hasCapability(req.user, SystemCapabilities.OPERATOR_CONTROL, {
    platformOnly: true,
  }).catch(() => false);
  if (!isOperator) {
    return res.status(403).json({
      error:
        'Tenant admins may not create, edit, or delete groups. Only operators can manage group definitions.',
    });
  }
  return next();
};

/**
 * Middleware: block adding a user to the 'admin' group unless the caller is an
 * operator. The admin group is operator-only by definition — tenant admins must
 * never be able to escalate a user into it.
 */
const blockAdminGroupMembership = async (req, res, next) => {
  const isOperator = await hasCapability(req.user, SystemCapabilities.OPERATOR_CONTROL, {
    platformOnly: true,
  }).catch(() => false);
  if (!isOperator) {
    const { id } = req.params;
    const group = await runAsSystem(() => db.findGroupById(id)).catch(() => null);
    if (group && (group.name || '').toLowerCase() === 'admin') {
      return res.status(403).json({
        error: 'Only operators may add members to the admin group.',
      });
    }
  }
  return next();
};

/**
 * Middleware: block adding an ADMIN-role user to any group if the caller is a
 * tenant admin. Tenant admins have no authority over operator-managed accounts.
 */
const blockAdminUserGroupMembership = async (req, res, next) => {
  const isOperator = await hasCapability(req.user, SystemCapabilities.OPERATOR_CONTROL, {
    platformOnly: true,
  }).catch(() => false);
  if (!isOperator) {
    const { userId } = req.body || {};
    if (userId) {
      const user = await runAsSystem(() => db.getUserById(userId, 'role')).catch(() => null);
      if (user && user.role === 'ADMIN') {
        return res.status(403).json({
          error: 'Tenant admins may not add ADMIN-role users to groups.',
        });
      }
    }
  }
  return next();
};

const handlers = createAdminGroupsHandlers({
  listGroups: db.listGroups,
  countGroups: db.countGroups,
  findGroupById: db.findGroupById,
  createGroup: db.createGroup,
  updateGroupById: db.updateGroupById,
  deleteGroup: db.deleteGroup,
  addUserToGroup: db.addUserToGroup,
  removeUserFromGroup: db.removeUserFromGroup,
  removeMemberById: db.removeMemberById,
  findUsers: db.findUsers,
  updateUser: (userId, data) => runAsSystem(() => db.updateUser(userId, data)),
  deleteConfig: db.deleteConfig,
  deleteAclEntries: db.deleteAclEntries,
  recordAuditEntry: db.recordAuditEntry,
});

router.use(requireJwtAuth, requireAdminSurface);

router.get('/', requireReadGroups, handlers.listGroups);
/** Only operators may create new groups */
router.post('/', requireManageGroups, requireOperatorForGroupMutations, handlers.createGroup);
router.get('/:id', requireReadGroups, handlers.getGroup);
/** Only operators may edit group definitions */
router.patch('/:id', requireManageGroups, requireOperatorForGroupMutations, handlers.updateGroup);
/** Only operators may delete groups */
router.delete('/:id', requireManageGroups, requireOperatorForGroupMutations, handlers.deleteGroup);
router.get('/:id/members', requireReadGroups, handlers.getGroupMembers);

/** Tenant admins may add members but NOT to the admin group and NOT ADMIN-role users */
router.post(
  '/:id/members',
  requireManageGroups,
  blockAdminGroupMembership,
  blockAdminUserGroupMembership,
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // After member successfully added to group, re-sync their seat policy
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.body?.userId;
        if (userId) syncMemberSeatAfterGroupChange(userId).catch(() => {});
      }
      return originalJson(data);
    };
    return handlers.addGroupMember(req, res, next);
  },
);

router.delete(
  '/:id/members/:userId',
  requireManageGroups,
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // After member removed from group, re-sync their seat policy (uses remaining accountType)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const { userId } = req.params;
        if (userId) syncMemberSeatAfterGroupChange(userId).catch(() => {});
      }
      return originalJson(data);
    };
    return handlers.removeGroupMember(req, res, next);
  },
);

module.exports = router;
