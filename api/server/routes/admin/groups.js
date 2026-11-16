const express = require('express');
const { createAdminGroupsHandlers } = require('@librechat/api');
const { SystemCapabilities, runAsSystem } = require('@librechat/data-schemas');
const { hasCapability, requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

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
  handlers.addGroupMember,
);
router.delete('/:id/members/:userId', requireManageGroups, handlers.removeGroupMember);

module.exports = router;
