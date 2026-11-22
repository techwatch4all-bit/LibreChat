const express = require('express');
const crypto = require('crypto');
const { calculatePasswordSignature } = require('@librechat/api');
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
const { runAsSystem } = require('@librechat/data-schemas');
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
  findGroupByName: (nameOrQuery) => {
    if (typeof nameOrQuery === 'object' && nameOrQuery !== null) {
      return runAsSystem(() => db.findGroupByQuery(nameOrQuery));
    }
    return runAsSystem(() =>
      db.findGroupByQuery({
        $or: [
          { name: nameOrQuery },
          { name: new RegExp(`^${nameOrQuery}$`, 'i') },
          { accountType: String(nameOrQuery).toLowerCase() },
        ],
      }),
    );
  },
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
  removeUserFromAllGroups: (userId) => runAsSystem(() => db.removeUserFromAllGroups(userId)),
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
 *   ONEAPI_BASE_URL            default https://gateway.satchida.com
 *                              Override to http://127.0.0.1:4000 for local dev
 *                              where One-API runs on the same machine.
 *   ONEAPI_ADMIN_ACCESS_TOKEN  an One-API admin/root user access_token
 *   ONEAPI_DEFAULT_TENANT      default satchida-master
 *   ONEAPI_CF_CLIENT_ID        Cloudflare Access service token client ID
 *                              (required when ONEAPI_BASE_URL is a public CF tunnel)
 *   ONEAPI_CF_CLIENT_SECRET    Cloudflare Access service token secret
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
  privacy: {
    modes: 'chat,study,work,privacy,vibecoding',
    models: 'Chat,Study,Work,Privacy,Vibecoding',
  },
};

// Default to the public Cloudflare tunnel so every tenant deployment works
// out-of-the-box without any extra env var. Local dev (where One-API runs on
// the same machine) overrides this in .env:  ONEAPI_BASE_URL=http://127.0.0.1:4000
const ONEAPI_BASE_URL = (process.env.ONEAPI_BASE_URL || 'https://gateway.satchida.com').replace(
  /\/+$/,
  '',
);

const ONEAPI_TENANT = process.env.ONEAPI_DEFAULT_TENANT || 'satchida-master';

// Tenant-copy deployment mode: this LibreChat instance runs ON a tenant PC and
// authenticates to One-API with THAT tenant's machine virtual key — never with
// operator credentials. Seat minting then goes through One-API's self-service
// route, which resolves the tenant from the key and hardens every field
// server-side (quota/caps/keys cannot be set by the tenant).
const TENANT_COPY_MODE = process.env.SATCHIDA_TENANT_MODE === 'true';
const TENANT_VK = process.env.SATCHIDA_TENANT_VK || '';

// Cloudflare Access service token headers — required when ONEAPI_BASE_URL is
// a public Cloudflare tunnel (gateway.satchida.com). The WAF on that tunnel
// blocks all non-/v1/ paths unless the request carries a valid CF Access
// service token. Set both vars in the tenant .env to enable:
//   ONEAPI_CF_CLIENT_ID=<service-token-client-id>
//   ONEAPI_CF_CLIENT_SECRET=<service-token-secret>
// Leave blank for localhost (127.0.0.1) where no WAF is in the path.
const CF_CLIENT_ID = process.env.ONEAPI_CF_CLIENT_ID || '';
const CF_CLIENT_SECRET = process.env.ONEAPI_CF_CLIENT_SECRET || '';

function oneApiConfigured() {
  return Boolean(process.env.ONEAPI_ADMIN_ACCESS_TOKEN);
}

function oneApiHeaders() {
  const headers = {
    Authorization: process.env.ONEAPI_ADMIN_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  };
  // Attach CF Access service token when talking to the public tunnel
  if (CF_CLIENT_ID && CF_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = CF_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = CF_CLIENT_SECRET;
  }
  return headers;
}

async function oneApi(method, path, body) {
  const useTenantKey = TENANT_COPY_MODE && TENANT_VK;
  const res = await fetch(ONEAPI_BASE_URL + path, {
    method,
    headers: useTenantKey
      ? { Authorization: TENANT_VK, 'Content-Type': 'application/json' }
      : oneApiHeaders(),
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
    // Operator minting runs as system scope: the seat may target ANY tenant
    // deployment (that is the whole point of copied-instance tenancy), and
    // the user row lives in that tenant, which the isolation plugin would
    // otherwise hide from this request's own tenant context.
    const user = await runAsSystem(() =>
      db.getUserById(id, 'email username seatToken satchidaSeatAlias accountType tenantId'),
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
    // Tenant resolution — the security boundary of seat minting.
    // SATCHIDA_TENANT_MODE=true (a LibreChat copy deployed on a tenant PC):
    // everything mints into THIS instance's tenant through the self-service
    // route with the tenant's own machine key — operator credentials do not
    // exist on that box, and the seat policy must be pre-provisioned by the
    // operator (the self-service route refuses unknown aliases).
    // Otherwise (the operator's own instance): a platform operator
    // (OPERATOR_CONTROL, platform-only grant) may mint into any tenant via
    // body.tenantId; everyone else is bound to their own tenant.
    let callerIsOperator = false;
    if (!TENANT_COPY_MODE) {
      callerIsOperator = await hasCapability(req.user, SystemCapabilities.OPERATOR_CONTROL, {
        platformOnly: true,
      }).catch(() => false);
    }
    let tenantId;
    if (TENANT_COPY_MODE) {
      tenantId = ONEAPI_TENANT;
    } else if (callerIsOperator && req.body?.tenantId) {
      tenantId = String(req.body.tenantId).trim();
    } else if (user.tenantId) {
      tenantId = user.tenantId;
    } else {
      tenantId = ONEAPI_TENANT;
    }
    await oneApi('GET', `/api/tenant/${encodeURIComponent(tenantId)}`);
    // A user keeps ONE seat alias across re-assignments so the operator can
    // follow the seat's history in One-API; the previous token is disabled.
    const aliasId = user.satchidaSeatAlias || seatAliasForUser(user);

    // One-API's seat-policy binding uses snake_case (alias_id / seat_tier /
    // account_type); the list fields are pointers on the Go side, so present
    // values replace and absent ones are left alone.
    await oneApi('PUT', `/api/tenant/${tenantId}/seat-policy`, {
      alias_id: aliasId,
      seat_tier: accountType,
      profile_type: 'adult',
      account_type: accountType,
      allowed_modes: policy.modes.split(','),
      allowed_models: policy.models.split(','),
    });

    let mintedKey;
    // Disable the alias's previous token BEFORE minting: both share the
    // seat_alias, so disabling after creation would kill the new key too.
    // Tenant-copy mode revokes through the self-service disable route using
    // the token id stored on the user at the previous assignment.
    if (TENANT_COPY_MODE) {
      if (user.satchidaSeatTokenId) {
        await oneApi(
          'PUT',
          `/api/tenant/${tenantId}/seat/${user.satchidaSeatTokenId}/disable`,
        ).catch(() => {});
      }
      const created = await oneApi('POST', `/api/tenant/${tenantId}/seat`, {
        group: accountType,
        seat_alias: aliasId,
        models: policy.models,
        channels: '',
        unlimited_quota: true,
      });
      mintedKey = created?.data?.key;
      if (mintedKey) {
        await runAsSystem(() =>
          db.updateUser(id, {
            seatToken: mintedKey,
            satchidaSeatTokenId: created?.data?.id ?? null,
            satchidaSeatAlias: aliasId,
            accountType,
          }),
        );
      }
    } else {
      if (user.satchidaSeatAlias) {
        await disableSeatTokenByAlias(user.satchidaSeatAlias).catch(() => {});
      }
      const created = await oneApi('POST', `/api/tenant/${tenantId}/token`, {
        group: accountType,
        seat_alias: aliasId,
        models: policy.models,
        channels: '',
        unlimited_quota: true,
      });
      mintedKey = created?.data?.key;
      if (mintedKey) {
        await runAsSystem(() =>
          db.updateUser(id, {
            seatToken: mintedKey,
            satchidaSeatTokenId: created?.data?.id ?? null,
            satchidaSeatAlias: aliasId,
            accountType,
          }),
        );
      }
    }
    const key = mintedKey;
    if (!key) {
      throw new Error('One-API did not return the seat token key');
    }

    // Remove user from any other licence tier group first, to prevent multi-tier group drift.
    if (user.accountType && user.accountType !== accountType) {
      const oldGroup = await runAsSystem(() =>
        db.findGroupByQuery({ accountType: user.accountType, tenantId }).catch(() => null),
      );
      if (oldGroup?._id) {
        await runAsSystem(() => db.removeMemberById(oldGroup._id.toString(), id).catch(() => {}));
      }
    }

    // Keep the admin panel's Groups view consistent with the seat type: the
    // seat group is scoped to the SAME tenant as the user (a copied tenant
    // deployment has its own groups), falling back to the operator instance's
    // group when no tenant-scoped one exists.
    let seatGroup = await runAsSystem(() =>
      db.findGroupByQuery({ accountType, tenantId }).catch(() => null),
    );
    if (!seatGroup) {
      seatGroup = await runAsSystem(() => db.findGroupByQuery({ accountType }).catch(() => null));
    }
    if (seatGroup?._id) {
      await runAsSystem(() => db.addUserToGroup(id, seatGroup._id.toString()).catch(() => {}));
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
        metadata: { seat: 'assigned', accountType, seatAlias: aliasId, oneapiTenant: tenantId },
      })
      .catch(() => {});

    return res.status(200).json({
      accountType,
      seatAlias: aliasId,
      oneapiTenant: tenantId,
      seatTokenHint: key.slice(0, 6) + '…' + key.slice(-4),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to assign seat' });
  }
}

async function revokeSeatTokenHandler(req, res) {
  try {
    const { id } = req.params;
    const user = await runAsSystem(() => db.getUserById(id, 'email seatToken satchidaSeatAlias'));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.satchidaSeatAlias && oneApiConfigured()) {
      const revokeTenant = (user.tenantId || ONEAPI_TENANT).trim();
      const list = await oneApi(
        'GET',
        `/api/tenant/${encodeURIComponent(revokeTenant)}/token?seat_alias=${encodeURIComponent(user.satchidaSeatAlias)}`,
      ).catch(() => ({ data: [] }));
      for (const t of (list.data || []).filter(
        (t) => t.seat_alias === user.satchidaSeatAlias && t.status === 1,
      )) {
        await oneApi(
          'PUT',
          `/api/tenant/${encodeURIComponent(revokeTenant)}/token/${t.id}/disable`,
        ).catch(() => {});
      }
    }
    await runAsSystem(() => db.updateUser(id, { seatToken: null }));
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

/**
 * Admin-initiated 2FA reset for a user.
 * Clears totpSecret, backupCodes, and twoFactorEnabled so the user re-enrolls.
 * Tenant admins cannot reset ADMIN-role user 2FA (enforced in handler).
 *
 * DELETE /api/admin/users/:id/2fa
 */
router.delete('/:id/2fa', requireManageUsers, handlers.reset2FA);

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
 * Syncs user tier and seat policy to One-API asynchronously.
 * Uses the user's display name or username as the human-readable alias in One-API,
 * so the operator can tally and discuss usage directly by user name without exposing sensitive PII.
 */
// ─── One-API Seat Token helpers ───────────────────────────────────────────────

/**
 * Find all active One-API seat tokens for a given alias and return their IDs.
 */
async function listActiveTokensForAlias(tenantId, aliasId) {
  const list = await oneApi(
    'GET',
    `/api/tenant/${encodeURIComponent(tenantId)}/token?seat_alias=${encodeURIComponent(aliasId)}`,
  ).catch(() => ({ data: [] }));
  return (list.data || []).filter((t) => t.seat_alias === aliasId && t.status === 1);
}

/**
 * Disable all active One-API seat tokens for a given alias (suspend/delete path).
 */
async function disableTokensForAlias(tenantId, aliasId) {
  const active = await listActiveTokensForAlias(tenantId, aliasId);
  await Promise.all(
    active.map((t) =>
      oneApi('PUT', `/api/tenant/${encodeURIComponent(tenantId)}/token/${t.id}/disable`).catch(
        () => {},
      ),
    ),
  );
  return active.length;
}

// ─── Full lifecycle sync functions ────────────────────────────────────────────

/**
 * Upsert the seat policy on One-API for a user.
 * Fires on: create, tier change, familyRole change, group membership change, name change.
 * Also called after unsuspend to restore the policy entry.
 */
async function syncUserSeatToOneApi(userId, accountType, familyRole) {
  try {
    if (!oneApiConfigured()) return;
    const user = await runAsSystem(() =>
      db.getUserById(
        userId,
        'email username name seatToken satchidaSeatTokenId satchidaSeatAlias accountType tenantId familyRole suspended',
      ),
    );
    if (!user) return;

    // Don't upsert policy for suspended users — their tokens are already disabled.
    // The unsuspend path calls this explicitly after re-enabling tokens.
    if (user.suspended) return;

    const tenantId = (user.tenantId || ONEAPI_TENANT).trim();
    const effectiveType = accountType || user.accountType || 'basic';
    const tierChanged = Boolean(accountType && user.accountType && accountType !== user.accountType);
    const policy = SEAT_POLICY_BY_TYPE[effectiveType] || SEAT_POLICY_BY_TYPE.basic;

    // Build / reuse seat alias — human-readable, zero PII.
    let aliasId = user.satchidaSeatAlias;
    if (!aliasId) {
      const cleanName = (user.name || user.username || user.email?.split('@')[0] || 'user')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 32);
      aliasId = `seat_${cleanName}_${user._id.toString().slice(-6)}`;
      await runAsSystem(() => db.updateUser(userId, { satchidaSeatAlias: aliasId }));
    }

    const isChild = (familyRole || user.familyRole) === 'minor';

    await oneApi('PUT', `/api/tenant/${encodeURIComponent(tenantId)}/seat-policy`, {
      alias_id: aliasId,
      seat_tier: effectiveType,
      profile_type: isChild ? 'child' : 'adult',
      account_type: effectiveType,
      allowed_modes: policy.modes.split(','),
      allowed_models: policy.models.split(','),
    }).catch((err) => {
      console.warn(
        `[oneApi] seat-policy upsert failed for user ${userId} (tenant ${tenantId}):`,
        err.message,
      );
    });

    // Auto-mint or rotate the tenant-scoped seat token (tk_<tenant>_...) so the user
    // immediately follows tenant_account_plans & tenant_quota_rules instead of falling back.
    if (!user.seatToken || tierChanged) {
      let mintedKey;
      let mintedId = null;
      if (TENANT_COPY_MODE) {
        if (user.satchidaSeatTokenId) {
          await oneApi(
            'PUT',
            `/api/tenant/${encodeURIComponent(tenantId)}/seat/${user.satchidaSeatTokenId}/disable`,
          ).catch(() => {});
        }
        const created = await oneApi('POST', `/api/tenant/${encodeURIComponent(tenantId)}/seat`, {
          group: effectiveType,
          seat_alias: aliasId,
          models: policy.models,
          channels: '',
          unlimited_quota: true,
        });
        mintedKey = created?.data?.key;
        mintedId = created?.data?.id ?? null;
      } else {
        if (user.satchidaSeatAlias) {
          await disableSeatTokenByAlias(user.satchidaSeatAlias).catch(() => {});
        }
        const created = await oneApi('POST', `/api/tenant/${encodeURIComponent(tenantId)}/token`, {
          group: effectiveType,
          seat_alias: aliasId,
          models: policy.models,
          channels: '',
          unlimited_quota: true,
        });
        mintedKey = created?.data?.key;
        mintedId = created?.data?.id ?? null;
      }
      if (mintedKey) {
        await runAsSystem(() =>
          db.updateUser(userId, {
            seatToken: mintedKey,
            satchidaSeatTokenId: mintedId,
            satchidaSeatAlias: aliasId,
            accountType: effectiveType,
          }),
        );
        if (typeof invalidateUserDocCache === 'function') {
          invalidateUserDocCache(userId);
        }
      }
    }
  } catch (err) {
    console.warn(`[oneApi] syncUserSeatToOneApi error for user ${userId}:`, err.message);
  }
}

/**
 * Suspend a seat on One-API: disables all active tokens for the alias.
 * Fires on: admin sets suspended=true on a user.
 */
async function suspendSeatOnOneApi(userId) {
  try {
    if (!oneApiConfigured()) return;
    const user = await runAsSystem(() => db.getUserById(userId, 'satchidaSeatAlias tenantId'));
    if (!user?.satchidaSeatAlias) return;
    const tenantId = (user.tenantId || ONEAPI_TENANT).trim();
    const disabled = await disableTokensForAlias(tenantId, user.satchidaSeatAlias);
    console.info(
      `[oneApi] Suspended seat ${user.satchidaSeatAlias} for user ${userId}: ${disabled} token(s) disabled`,
    );
  } catch (err) {
    console.warn(`[oneApi] suspendSeatOnOneApi error for user ${userId}:`, err.message);
  }
}

/**
 * Restore a seat on One-API after unsuspend: re-upserts the seat policy so the
 * user can mint a new token on next login. The old token was disabled on suspend
 * so this effectively issues a fresh capability grant.
 * Fires on: admin sets suspended=false on a previously suspended user.
 */
async function restoreSeatOnOneApi(userId) {
  try {
    if (!oneApiConfigured()) return;
    const user = await runAsSystem(() =>
      db.getUserById(
        userId,
        'email username name satchidaSeatAlias accountType tenantId familyRole',
      ),
    );
    if (!user) return;
    // Re-upsert policy directly (bypass the suspended guard in syncUserSeatToOneApi)
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
    await oneApi('PUT', `/api/tenant/${encodeURIComponent(tenantId)}/seat-policy`, {
      alias_id: aliasId,
      seat_tier: effectiveType,
      profile_type: user.familyRole === 'minor' ? 'child' : 'adult',
      account_type: effectiveType,
      allowed_modes: policy.modes.split(','),
      allowed_models: policy.models.split(','),
    }).catch((err) => {
      console.warn(`[oneApi] restore seat-policy failed for user ${userId}:`, err.message);
    });
    console.info(`[oneApi] Restored seat ${aliasId} for user ${userId}`);
  } catch (err) {
    console.warn(`[oneApi] restoreSeatOnOneApi error for user ${userId}:`, err.message);
  }
}

/**
 * Delete a seat from One-API: disables all tokens AND removes the alias row.
 * Fires on: admin deletes a user account.
 */
async function deleteSeatOnOneApi(userId) {
  try {
    if (!oneApiConfigured()) return;
    const user = await runAsSystem(() => db.getUserById(userId, 'satchidaSeatAlias tenantId'));
    if (!user?.satchidaSeatAlias) return;
    const tenantId = (user.tenantId || ONEAPI_TENANT).trim();
    // 1. Disable all active tokens first
    await disableTokensForAlias(tenantId, user.satchidaSeatAlias).catch(() => {});
    // 2. Delete the seat-policy alias row
    await oneApi(
      'DELETE',
      `/api/tenant/${encodeURIComponent(tenantId)}/seat-policy/${encodeURIComponent(user.satchidaSeatAlias)}`,
    ).catch((err) => {
      // 404 is fine — alias may already be gone
      if (!err.message?.includes('404')) {
        console.warn(
          `[oneApi] seat-policy delete failed for ${user.satchidaSeatAlias}:`,
          err.message,
        );
      }
    });
    console.info(`[oneApi] Deleted seat ${user.satchidaSeatAlias} for user ${userId}`);
  } catch (err) {
    console.warn(`[oneApi] deleteSeatOnOneApi error for user ${userId}:`, err.message);
  }
}

// ─── LibreChat Group Membership Sync ─────────────────────────────────────────

/**
 * Move a user to the LibreChat group that matches their new accountType.
 *
 * Rules:
 *  - Remove the user from every OTHER accountType-based group they currently belong to.
 *  - Add the user to the group whose `accountType` field matches `newAccountType`.
 *  - Non-accountType groups (admin, custom) are left untouched.
 *
 * This fires synchronously (awaited) in the PATCH response wrapper so the
 * admin panel Groups page reflects the change immediately on next load.
 */
async function moveUserToAccountTypeGroup(userId, newAccountType) {
  try {
    // 1. Get all groups the user is currently a member of
    const currentGroups = await runAsSystem(() => db.getUserGroups(userId)).catch(() => []);

    // 2. Remove from every DIFFERENT accountType-based group
    for (const g of currentGroups) {
      const gType = g.accountType || g.seatType;
      if (gType && SEAT_TYPES.includes(gType) && gType !== newAccountType) {
        await runAsSystem(() => db.removeUserFromGroup(userId, g._id.toString()).catch(() => {}));
      }
    }

    if (!newAccountType || !SEAT_TYPES.includes(newAccountType)) return;

    // 3. Find the target group for the new accountType (tenant-scoped first, then global)
    const user = await runAsSystem(() => db.getUserById(userId, 'tenantId').catch(() => null));
    const tenantId = user?.tenantId;

    let targetGroup = null;
    if (tenantId) {
      targetGroup = await runAsSystem(() =>
        db.findGroupByQuery({ accountType: newAccountType, tenantId }).catch(() => null),
      );
    }
    if (!targetGroup) {
      targetGroup = await runAsSystem(() =>
        db.findGroupByQuery({ accountType: newAccountType }).catch(() => null),
      );
    }

    // 4. Add to the matching group if not already a member
    if (targetGroup?._id) {
      const alreadyMember = currentGroups.some(
        (g) => g._id.toString() === targetGroup._id.toString(),
      );
      if (!alreadyMember) {
        await runAsSystem(() =>
          db.addUserToGroup(userId, targetGroup._id.toString()).catch(() => {}),
        );
        console.info(
          `[groups] Moved user ${userId} to group "${targetGroup.name}" (accountType=${newAccountType})`,
        );
      }
    } else {
      console.warn(
        `[groups] No group found for accountType="${newAccountType}" — user ${userId} not added to any group`,
      );
    }
  } catch (err) {
    console.warn(`[groups] moveUserToAccountTypeGroup error for user ${userId}:`, err.message);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/users
 * Provision a single account. Delegates to the admin users handler so tenant
 * stamping, account type, quota and group membership share one implementation.
 */
router.post('/', requireManageUsers, async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && data?.user?._id) {
      const uid = data.user._id.toString();
      const newType = req.body?.accountType;
      // Sync One-API seat policy
      syncUserSeatToOneApi(uid, newType, req.body?.familyRole).catch(() => {});
      // Sync LibreChat group membership (createUser in users.ts already calls
      // addUserToGroup via findGroupByName — this is a belt-and-braces guard).
      if (newType) moveUserToAccountTypeGroup(uid, newType).catch(() => {});
    }
    return originalJson(data);
  };
  return handlers.createUser(req, res, next);
});

/**
 * PATCH /api/admin/users/:id
 * Partial update — accountType change triggers both group re-assignment AND
 * One-API seat-policy upsert, suspension change triggers seat enable/disable.
 */
router.patch('/:id', requireManageUsers, async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const { id } = req.params;
      const newType = req.body?.accountType;
      const newFamilyRole = req.body?.familyRole;
      const suspendedField = req.body?.suspended;

      // ── Group membership ────────────────────────────────────────────────────
      // Move to the right LibreChat group immediately when accountType changes.
      if (newType !== undefined) {
        moveUserToAccountTypeGroup(id, newType).catch(() => {});
      }

      // ── One-API seat lifecycle ──────────────────────────────────────────────
      if (suspendedField === true) {
        // Admin suspended the account — disable all active seat tokens
        suspendSeatOnOneApi(id).catch(() => {});
      } else if (suspendedField === false) {
        // Admin un-suspended — restore seat policy so user can get a new token
        restoreSeatOnOneApi(id).catch(() => {});
      } else {
        // Tier / name / familyRole change — upsert seat policy
        syncUserSeatToOneApi(id, newType, newFamilyRole).catch(() => {});
      }
    }
    return originalJson(data);
  };
  return handlers.updateUser(req, res, next);
});

/**
 * DELETE /api/admin/users/:id
 * On user deletion: revoke seat tokens and remove alias from One-API before
 * the handler purges the MongoDB document.
 */
router.delete('/:id', requireManageUsers, async (req, res, next) => {
  // Fire seat cleanup BEFORE the handler deletes the user (we still need the alias field)
  const { id } = req.params;
  deleteSeatOnOneApi(id).catch(() => {});
  return handlers.deleteUser(req, res, next);
});

/** GET /api/admin/users/:id/groups - groups the user belongs to. */
router.get('/:id/groups', requireReadUsers, handlers.getUserGroups);

/**
 * POST /api/admin/users/bulk
 * Ingest a CSV or JSON roster. Delegates to the batched handler: one duplicate
 * query, bounded-concurrency password hashing, one insert per collection, and
 * one group update per distinct group.
 */
router.post('/bulk', requireManageUsers, async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && Array.isArray(data?.users)) {
      for (const u of data.users) {
        if (u._id) {
          const uid = u._id.toString();
          syncUserSeatToOneApi(uid, u.accountType, u.familyRole).catch(() => {});
          if (u.accountType) moveUserToAccountTypeGroup(uid, u.accountType).catch(() => {});
        }
      }
    }
    return originalJson(data);
  };
  return handlers.bulkCreateUsers(req, res, next);
});

module.exports = router;
