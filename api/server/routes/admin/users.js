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

/* ---------------------------------------------------------------------------
 * Seat tokens (R1): a per-user One-API tenant credential.
 *
 * Assigning a seat mints an One-API seat-bound tenant token (tk_…) inside the
 * configured tenant + policy group, upserts the seat policy the token needs,
 * and stores the key on the LibreChat user. The endpoint layer already prefers
 * `user.seatToken` over the shared endpoint credential
 * (packages/api/src/endpoints/openai/initialize.ts), so once the token is
 * stored every request from this user reaches One-API as that seat — which is
 * what makes LibreChat user → One-API tenant/group → Bifrost attribution
 * automatic end to end.
 *
 * Config (LibreChat .env):
 *   ONEAPI_BASE_URL            default http://127.0.0.1:4000
 *   ONEAPI_ADMIN_ACCESS_TOKEN  an One-API admin/root user access_token
 *   ONEAPI_DEFAULT_TENANT      default satchida-master
 * ------------------------------------------------------------------------ */

const SEAT_TYPES = ['basic', 'standard', 'family', 'pro', 'pro_family', 'enterprise', 'privacy'];

/** Seat policy per account type — mirrors the satchida-master tenant template groups. */
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

const ONEAPI_BASE_URL = (process.env.ONEAPI_BASE_URL || 'http://127.0.0.1:4000').replace(
  /\/+$/,
  '',
);
const ONEAPI_TENANT = process.env.ONEAPI_DEFAULT_TENANT || 'satchida-master';

function oneApiConfigured() {
  return Boolean(process.env.ONEAPI_ADMIN_ACCESS_TOKEN);
}

function oneApiHeaders() {
  return {
    Authorization: process.env.ONEAPI_ADMIN_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  };
}

async function oneApi(method, path, body) {
  const res = await fetch(ONEAPI_BASE_URL + path, {
    method,
    headers: oneApiHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const detail = json.message || json.error || `HTTP ${res.status}`;
    throw new Error(`One-API ${method} ${path} failed: ${detail}`);
  }
  return json;
}

function seatAliasForUser(user) {
  const prefix = (user.email || user.username || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `lc_${prefix}_${crypto.randomBytes(3).toString('hex')}`;
}

async function disableSeatTokenByAlias(aliasId) {
  const list = await oneApi(
    'GET',
    `/api/tenant/${ONEAPI_TENANT}/token?seat_alias=${encodeURIComponent(aliasId)}`,
  );
  const tokens = (list.data || []).filter((t) => t.seat_alias === aliasId && t.status === 1);
  for (const t of tokens) {
    await oneApi('PUT', `/api/tenant/${ONEAPI_TENANT}/token/${t.id}/disable`);
  }
  return tokens.length;
}

async function assignSeatTokenHandler(req, res) {
  try {
    const { id } = req.params;
    const user = await db.getUserById(
      id,
      'email username seatToken satchidaSeatAlias accountType tenantId',
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!oneApiConfigured()) {
      return res.status(503).json({ error: 'ONEAPI_ADMIN_ACCESS_TOKEN is not configured' });
    }

    /** An explicit, valid seat type wins; otherwise the user's current type
     *  is kept when it is still a known one, falling back to `basic`. */
    const requestedAccountType = req.body?.accountType;
    let accountType = 'basic';
    if (SEAT_TYPES.includes(requestedAccountType)) {
      accountType = requestedAccountType;
    } else if (SEAT_TYPES.includes(user.accountType)) {
      accountType = user.accountType;
    }
    const policy = SEAT_POLICY_BY_TYPE[accountType];
    // A user keeps ONE seat alias across re-assignments so the operator can
    // follow the seat's history in One-API; the previous token is disabled.
    const aliasId = user.satchidaSeatAlias || seatAliasForUser(user);

    // One-API's seat-policy binding uses snake_case (alias_id / seat_tier /
    // account_type); the list fields are pointers on the Go side, so present
    // values replace and absent ones are left alone.
    await oneApi('PUT', `/api/tenant/${ONEAPI_TENANT}/seat-policy`, {
      alias_id: aliasId,
      seat_tier: accountType,
      profile_type: 'adult',
      account_type: accountType,
      allowed_modes: policy.modes.split(','),
      allowed_models: policy.models.split(','),
    });

    // Disable the alias's previous token BEFORE minting: both share the
    // seat_alias, so disabling after creation would kill the new key too.
    if (user.satchidaSeatAlias) {
      await disableSeatTokenByAlias(user.satchidaSeatAlias).catch(() => {});
    }
    const created = await oneApi('POST', `/api/tenant/${ONEAPI_TENANT}/token`, {
      group: accountType,
      seat_alias: aliasId,
      models: policy.models,
      channels: '',
      unlimited_quota: true,
    });
    const key = created?.data?.key;
    if (!key) {
      throw new Error('One-API did not return the seat token key');
    }
    await db.updateUser(id, {
      seatToken: key,
      satchidaSeatAlias: aliasId,
      accountType,
    });

    // Keep the admin panel's Groups view consistent with the seat type.
    const seatGroup = await db.findGroupByQuery({ accountType });
    if (seatGroup?._id) {
      await db.addUserToGroup(id, seatGroup._id.toString()).catch(() => {});
    }

    // 'user.updated' is the catalogued action for seat changes; the seat
    // detail travels as metadata so the audit log stays queryable by action.
    await db
      .recordAuditEntry({
        action: 'user.updated',
        outcome: 'success',
        actor: {
          type: 'user',
          id: req.user?._id?.toString() ?? req.user?.id,
          name: req.user?.name || req.user?.username || req.user?.email || 'admin',
        },
        target: { type: 'user', id, name: user.email || user.username || id },
        metadata: { seat: 'assigned', accountType, seatAlias: aliasId },
      })
      .catch(() => {});

    return res.status(200).json({
      accountType,
      seatAlias: aliasId,
      seatTokenHint: key.slice(0, 6) + '…' + key.slice(-4),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to assign seat' });
  }
}

async function revokeSeatTokenHandler(req, res) {
  try {
    const { id } = req.params;
    const user = await db.getUserById(id, 'email seatToken satchidaSeatAlias');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.satchidaSeatAlias && oneApiConfigured()) {
      await disableSeatTokenByAlias(user.satchidaSeatAlias).catch(() => {});
    }
    await db.updateUser(id, { seatToken: null });
    await db
      .recordAuditEntry({
        action: 'user.updated',
        outcome: 'success',
        actor: {
          type: 'user',
          id: req.user?._id?.toString() ?? req.user?.id,
          name: req.user?.name || req.user?.username || req.user?.email || 'admin',
        },
        target: { type: 'user', id, name: user.email || user.satchidaSeatAlias || id },
        metadata: { seat: 'revoked', seatAlias: user.satchidaSeatAlias ?? null },
      })
      .catch(() => {});
    return res.status(200).json({ revoked: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to revoke seat' });
  }
}

router.post('/:id/seat-token', requireManageUsers, assignSeatTokenHandler);
router.delete('/:id/seat-token', requireManageUsers, revokeSeatTokenHandler);

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
