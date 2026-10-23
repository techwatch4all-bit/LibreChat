const express = require('express');
const { createAdminGroupsHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
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
  deleteConfig: db.deleteConfig,
  deleteAclEntries: db.deleteAclEntries,
});

router.use(requireJwtAuth, requireAdminSurface);

router.get('/', requireReadGroups, handlers.listGroups);
router.post('/', requireManageGroups, handlers.createGroup);
router.get('/:id', requireReadGroups, handlers.getGroup);
router.patch('/:id', requireManageGroups, handlers.updateGroup);
router.delete('/:id', requireManageGroups, handlers.deleteGroup);
router.get('/:id/members', requireReadGroups, handlers.getGroupMembers);
router.post('/:id/members', requireManageGroups, handlers.addGroupMember);
router.delete('/:id/members/:userId', requireManageGroups, handlers.removeGroupMember);

module.exports = router;
