const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { createAdminUsersHandlers, revokeUserCodeEnvironmentWorkers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { hasCapability, requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const {
  drainAgentTriggerDeliveriesForUser,
  prepareAgentTriggerUserPurge,
  cancelAgentTriggerUserPurge,
  purgeAgentTriggerDeliveriesForUser,
} = require('~/server/services/Agents/triggers');
const db = require('~/models');
const { getAppConfig, invalidateCodeEnvironmentConfigCache } = require('~/server/services/Config');

const router = express.Router();

/**
 * Admin-surface gate. Satisfied by a platform operator (`operator:control`
 * implies every capability) or by a tenant admin holding `access:admin` within
 * their own tenant. `hasCapability` derives the tenant from the caller, so
 * tenant-scoped authority never reaches another tenant's rows; the per-route
 * capabilities below then narrow each action.
 */
const requireAdminSurface = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);
const requireManageUsers = requireCapability(SystemCapabilities.MANAGE_USERS);

const handlers = createAdminUsersHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
  isPlatformOperator: (user) =>
    hasCapability(user, SystemCapabilities.OPERATOR_CONTROL, { platformOnly: true }),
  createUserRecord: async (data) => {
    /** `returnUser=true` yields the document, so the id is always available. */
    const created = await db.createUser(data, undefined, true, true);
    return { _id: created?._id ?? created };
  },
  updateUserRecord: db.updateUser,
  getUserGroups: async (userId) => {
    const groups = await db.getUserGroups(userId);
    return (groups ?? []).map((g) => ({
      id: g._id.toString(),
      name: g.name,
      description: g.description ?? undefined,
    }));
  },
  upsertBalanceFields: db.upsertBalanceFields,
  hashPassword: (plain) => bcrypt.hash(plain, 10),
  generateTempPassword: () => generateSecureTempPassword(12),
  findGroupByName: (name) => db.findGroupByQuery({ name }),
  addUserToGroup: db.addUserToGroup,
  /**
   * Bulk deps, batched on purpose.
   *
   * `insertMany` is tenant-safe here for two verified reasons: the tenant plugin
   * has an explicit `pre('insertMany')` hook that stamps `tenantId` on every
   * document, and the User schema declares no `pre('save')` hook that batching
   * would skip.
   */
  findExistingEmails: async (emails) => {
    const existing = await mongoose.models.User.find({ email: { $in: emails } }, 'email').lean();
    return existing.map((u) => u.email);
  },
  insertUserRecords: async (docs) => {
    const created = await mongoose.models.User.insertMany(docs, { ordered: false });
    return created.map((d) => ({ _id: d._id, email: d.email }));
  },
  insertBalanceRecords: async (docs) => {
    await mongoose.models.Balance.insertMany(
      docs.map((d) => ({
        user: d.userId,
        tokenCredits: d.tokenCredits,
        tenantId: d.tenantId,
        autoRefillEnabled: d.autoRefillEnabled,
        refillIntervalValue: d.refillIntervalValue,
        refillIntervalUnit: d.refillIntervalUnit,
        refillAmount: d.refillAmount,
      })),
      { ordered: false },
    );
  },
  addUsersToGroupByName: async (name, userIds) => {
    /** One update per distinct group instead of one per roster row. */
    const result = await mongoose.models.Group.updateOne(
      { name },
      { $addToSet: { memberIds: { $each: userIds } } },
    );
    return result.modifiedCount ?? 0;
  },
  beginAgentTriggerUserDeletion: db.beginAgentTriggerUserDeletion,
  cancelAgentTriggerUserDeletion: db.cancelAgentTriggerUserDeletion,
  drainAgentTriggerDeliveriesForUser,
  prepareAgentTriggerUserPurge,
  cancelAgentTriggerUserPurge,
  purgeAgentTriggerDeliveriesForUser,
  revokeUserCodeEnvironmentWorkers: async (userId) =>
    revokeUserCodeEnvironmentWorkers({
      mongoose,
      userId,
      appConfig: await getAppConfig({ baseOnly: true }),
    }),
  deleteUserById: db.deleteUserById,
  deleteUserCodeEnvironments: db.deleteUserCodeEnvironments,
  invalidateCodeEnvironmentConfigCache,
  deleteConfig: db.deleteConfig,
  deleteAclEntries: db.deleteAclEntries,
  deleteAllUserSessions: (params) => db.deleteAllUserSessions(params),
  reserveTenantSeat: db.reserveTenantSeat,
  releaseTenantSeat: db.releaseTenantSeat,
  recordAuditEntry: db.recordAuditEntry,
});

router.use(requireJwtAuth, requireAdminSurface);

router.get('/', requireReadUsers, handlers.listUsers);
router.get('/search', requireReadUsers, handlers.searchUsers);
router.delete('/:id', requireManageUsers, handlers.deleteUser);

/**
 * Admin-initiated password reset for a user.
 *
 * Unlike the unauthenticated /api/admin/forgot-password flow (gated by the
 * env challenge question), this endpoint is authorized by capability only —
 * `requireManageUsers`, which the operator JWT satisfies via OPERATOR_CONTROL
 * (and `MANAGE_USERS` is implied). The new password is bcrypt-hashed and the
 * user's active sessions/JWTs are invalidated so the next login uses the new
 * credential. Audited as `user.password_reset` by the handler.
 *
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword: string }
 */
router.post('/:id/reset-password', requireManageUsers, handlers.resetPassword);

function generateSecureTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * GET /api/admin/users/csv-template
 * Download standard CSV template for roster bulk upload
 */
router.get('/csv-template', requireReadUsers, (req, res) => {
  /**
   * `account_type` selects the seat tier (and must match one-api's seeded group
   * names, which are lowercase). `group` is class/section membership and is a
   * separate thing — a school roster normally carries both.
   */
  const template =
    'name,email,role,account_type,group,quota\n' +
    'John Doe,john.doe@school.edu,USER,basic,Grade-10,100000\n' +
    'Jane Smith,jane.smith@school.edu,USER,pro,Faculty,500000\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="satchida_user_roster_template.csv"');
  return res.status(200).send(template);
});

/**
 * POST /api/admin/users
 * Provision a single account. Delegates to the admin users handler so tenant
 * stamping, account type, quota and group membership share one implementation.
 */
router.post('/', requireManageUsers, handlers.createUser);

/** PATCH /api/admin/users/:id - partial update of a user in the caller's tenant. */
router.patch('/:id', requireManageUsers, handlers.updateUser);

/** GET /api/admin/users/:id/groups - groups the user belongs to. */
router.get('/:id/groups', requireReadUsers, handlers.getUserGroups);

/**
 * POST /api/admin/users/bulk
 * Ingest a CSV or JSON roster. Delegates to the batched handler: one duplicate
 * query, bounded-concurrency password hashing, one insert per collection, and
 * one group update per distinct group.
 */
router.post('/bulk', requireManageUsers, handlers.bulkCreateUsers);

module.exports = router;
