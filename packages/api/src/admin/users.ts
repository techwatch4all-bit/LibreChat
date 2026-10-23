import { Types } from 'mongoose';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import { ACCOUNT_TYPES, logger, isValidObjectIdString, runAsSystem } from '@librechat/data-schemas';
import type {
  IUser,
  IConfig,
  AdminUserListItem,
  AdminUserSearchResult,
  UserDeleteResult,
  AccountType,
  AdminUserGroup,
  CreateUserRequest,
} from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

const MAX_SEARCH_LENGTH = 200;
const MAX_NAME_LENGTH = 200;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const DEFAULT_QUOTA = 100000;
const FAMILY_ROLES = ['owner', 'adult', 'minor'] as const;

/**
 * Rows accepted in a single bulk request.
 *
 * This is deliberately below the old 5,000 ceiling: the panel splits a larger
 * roster into chunks and posts them in sequence, so one request never has to
 * hash thousands of passwords inside a single HTTP timeout.
 */
export const MAX_BULK_ROWS = 500;

/**
 * bcrypt hashing concurrency for bulk rows.
 *
 * bcryptjs is pure JavaScript and CPU-bound, so this bounds peak memory per
 * password without letting a batch of thousands monopolise the event loop.
 */
const BULK_HASH_CONCURRENCY = 8;

export interface BulkUserDocument {
  email: string;
  name: string;
  username: string;
  password: string;
  role: string;
  provider: string;
  emailVerified: boolean;
  mustChangePassword: boolean;
  termsAccepted: boolean;
  accountType: AccountType | null;
  familyRole: IUser['familyRole'];
  familyAccountId: Types.ObjectId | null;
  tenantId?: string;
}

export interface BulkBalanceDocument {
  userId: string;
  tokenCredits: number;
  autoRefillEnabled: boolean;
  refillIntervalValue: number;
  refillIntervalUnit: string;
  refillAmount: number;
  tenantId?: string;
}

interface BulkCandidate {
  email: string;
  name: string;
  username: string;
  role: string;
  accountType: AccountType | null;
  group: string | null;
  quota: number;
}

/**
 * Runs `fn` over `items` with at most `limit` in flight, preserving order.
 * Used for password hashing, where serial execution would block the loop for
 * the whole batch and unbounded parallelism would spike memory.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Accepts a pre-parsed `users` array, or parses `csvData` / `csvContent`. */
function normalizeRosterRows(body: Record<string, unknown>): Array<Record<string, unknown>> | null {
  if (Array.isArray(body.users)) {
    return (body.users as unknown[]).filter(
      (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
    );
  }
  let rawCsv: string | null = null;
  if (typeof body.csvData === 'string') {
    rawCsv = body.csvData;
  } else if (typeof body.csvContent === 'string') {
    rawCsv = body.csvContent;
  }
  if (!rawCsv) {
    return null;
  }
  const lines = rawCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 2 || !cols[1]) {
      continue;
    }
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

const USER_LIST_FIELDS =
  '_id name username email avatar role provider createdAt updatedAt ' +
  'tenantId accountType familyAccountId familyRole mustChangePassword seatToken';

/**
 * Last four characters only. The seat token is a bearer credential for the
 * one-api relay, so the raw value must never leave the server.
 */
function maskSeatToken(token?: string | null): string | null {
  if (!token) {
    return null;
  }
  return token.length <= 4 ? '****' : `…${token.slice(-4)}`;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** `undefined`/`null`/`''` clears the account type; anything else must be a known tier. */
function parseAccountType(raw: unknown): Parsed<AccountType | null> {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string' || !(ACCOUNT_TYPES as readonly string[]).includes(raw)) {
    return { ok: false, error: `accountType must be one of: ${ACCOUNT_TYPES.join(', ')}` };
  }
  return { ok: true, value: raw as AccountType };
}

function parseFamilyRole(raw: unknown): Parsed<IUser['familyRole']> {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string' || !(FAMILY_ROLES as readonly string[]).includes(raw)) {
    return { ok: false, error: `familyRole must be one of: ${FAMILY_ROLES.join(', ')}` };
  }
  return { ok: true, value: raw as NonNullable<IUser['familyRole']> };
}

function parseFamilyAccountId(raw: unknown): Parsed<string | null> {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string' || !isValidObjectIdString(raw)) {
    return { ok: false, error: 'Invalid familyAccountId format' };
  }
  return { ok: true, value: raw };
}

function parseQuota(raw: unknown): number {
  const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUOTA;
}

/** The identity a capability check is resolved against. */
export interface AdminCapabilityUser {
  id?: string;
  role?: string;
  tenantId?: string;
  idOnTheSource?: string;
}

export interface AdminUsersDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  /**
   * True when the caller holds platform-level `operator:control`, i.e. has
   * cross-tenant authority. Only such a caller is served a system-scoped
   * (all-tenant) listing; everyone else is confined to their own tenant by the
   * tenant-isolation plugin. Scope is derived from authority and never from the
   * request, so a client cannot widen a query with `?scope` or `?tenantId`.
   */
  isPlatformOperator: (user: AdminCapabilityUser) => Promise<boolean>;
  /** Inserts the user document. `password` must already be hashed. */
  createUserRecord: (data: CreateUserRequest) => Promise<{ _id: Types.ObjectId | string }>;
  updateUserRecord: (userId: string, data: Partial<IUser>) => Promise<IUser | null>;
  getUserGroups: (userId: string) => Promise<AdminUserGroup[]>;
  /** Upsert rather than insert, so a re-provision cannot duplicate a Balance row. */
  upsertBalanceFields: (
    userId: string,
    fields: {
      tokenCredits?: number;
      autoRefillEnabled?: boolean;
      refillIntervalValue?: number;
      refillIntervalUnit?: string;
      refillAmount?: number;
    },
  ) => Promise<unknown>;
  hashPassword: (plain: string) => Promise<string>;
  generateTempPassword: () => string;
  /** Resolves a group by exact name within the caller's tenant scope. */
  findGroupByName: (name: string) => Promise<{ _id: Types.ObjectId | string } | null>;
  addUserToGroup: (userId: string, groupId: string) => Promise<unknown>;
  /**
   * Emails from `emails` that already exist in the caller's tenant — one query,
   * replacing the per-row duplicate check a roster import used to do.
   */
  findExistingEmails: (emails: string[]) => Promise<string[]>;
  /** Bulk insert of pre-validated, pre-hashed users; returns the ids that landed. */
  insertUserRecords: (
    docs: BulkUserDocument[],
  ) => Promise<Array<{ _id: Types.ObjectId | string; email: string }>>;
  insertBalanceRecords: (docs: BulkBalanceDocument[]) => Promise<void>;
  /** Adds many users to a group by exact name; returns how many rows changed. */
  addUsersToGroupByName: (name: string, userIds: string[]) => Promise<number>;
  beginAgentTriggerUserDeletion: (
    userId: string,
    startedAt: Date,
  ) => Promise<'acquired' | 'in_progress' | 'missing'>;
  cancelAgentTriggerUserDeletion: (userId: string, startedAt: Date) => Promise<boolean>;
  drainAgentTriggerDeliveriesForUser: (userId: string) => Promise<void>;
  prepareAgentTriggerUserPurge: (
    userId: string,
    fenceStartedAt: Date,
    tenantId?: string,
  ) => Promise<void>;
  cancelAgentTriggerUserPurge: (userId: string, fenceStartedAt: Date) => Promise<boolean>;
  purgeAgentTriggerDeliveriesForUser: (userId: string) => Promise<void>;
  revokeUserCodeEnvironmentWorkers?: (userId: string) => Promise<number>;
  /**
   * Thin data-layer delete — removes the User document only.
   * Full cascade of user-owned resources (conversations, messages, files, tokens, etc.)
   * is handled by `UserController.deleteUserController` in the self-delete flow.
   * This admin endpoint fences durable triggers around the user commit and currently
   * cascades Config and AclEntries.
   * A future iteration should consolidate the full cascade into a shared service function.
   */
  deleteUserById: (userId: string) => Promise<UserDeleteResult>;
  deleteUserCodeEnvironments: (userId: string | Types.ObjectId) => Promise<number>;
  invalidateCodeEnvironmentConfigCache: (tenantId?: string) => Promise<void>;
  deleteConfig: (
    principalType: PrincipalType,
    principalId: string | Types.ObjectId,
  ) => Promise<IConfig | null>;
  deleteAclEntries: (filter: {
    principalType: PrincipalType;
    principalId: string | Types.ObjectId;
  }) => Promise<void>;
}

export function createAdminUsersHandlers(deps: AdminUsersDeps): {
  listUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  searchUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  createUser: (req: ServerRequest, res: Response) => Promise<Response>;
  bulkCreateUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  updateUser: (req: ServerRequest, res: Response) => Promise<Response>;
  getUserGroups: (req: ServerRequest, res: Response) => Promise<Response>;
  deleteUser: (req: ServerRequest, res: Response) => Promise<Response>;
} {
  const {
    findUsers,
    countUsers,
    isPlatformOperator,
    createUserRecord,
    updateUserRecord,
    getUserGroups,
    upsertBalanceFields,
    hashPassword,
    generateTempPassword,
    findGroupByName,
    addUserToGroup,
    findExistingEmails,
    insertUserRecords,
    insertBalanceRecords,
    addUsersToGroupByName,
    beginAgentTriggerUserDeletion,
    cancelAgentTriggerUserDeletion,
    drainAgentTriggerDeliveriesForUser,
    prepareAgentTriggerUserPurge,
    cancelAgentTriggerUserPurge,
    purgeAgentTriggerDeliveriesForUser,
    revokeUserCodeEnvironmentWorkers,
    deleteUserCodeEnvironments,
    deleteUserById,
    invalidateCodeEnvironmentConfigCache,
    deleteConfig,
    deleteAclEntries,
  } = deps;

  /** Builds the capability-check identity from the authenticated request. */
  function callerIdentity(req: ServerRequest): AdminCapabilityUser {
    const user = req.user as
      | (AdminCapabilityUser & { _id?: { toString: () => string } })
      | undefined;
    if (!user) {
      return {};
    }
    return {
      id: user._id?.toString() ?? user.id,
      role: user.role,
      tenantId: user.tenantId,
      idOnTheSource: user.idOnTheSource,
    };
  }

  /**
   * Resolves the listing scope from the caller's authority, never from the
   * request. A caller who is neither a platform operator nor attached to a
   * tenant is refused rather than falling through to an unscoped query, which
   * would return every tenant's rows.
   */
  async function resolveListingScope(
    req: ServerRequest,
  ): Promise<'system' | 'tenant' | 'forbidden'> {
    const identity = callerIdentity(req);
    if (await isPlatformOperator(identity)) {
      return 'system';
    }
    return identity.tenantId ? 'tenant' : 'forbidden';
  }

  /** Projects a user document into the admin list shape. */
  function toListItem(u: IUser): AdminUserListItem {
    return {
      id: u._id?.toString() ?? '',
      name: u.name ?? '',
      username: u.username ?? '',
      email: u.email ?? '',
      avatar: u.avatar ?? '',
      role: u.role ?? SystemRoles.USER,
      provider: u.provider ?? 'local',
      createdAt: u.createdAt?.toISOString(),
      updatedAt: u.updatedAt?.toISOString(),
      tenantId: u.tenantId ?? undefined,
      accountType: u.accountType ?? null,
      familyAccountId: u.familyAccountId?.toString() ?? null,
      familyRole: u.familyRole ?? null,
      mustChangePassword: u.mustChangePassword ?? false,
      seatAssigned: Boolean(u.seatToken),
      seatTokenHint: maskSeatToken(u.seatToken),
    };
  }

  async function listUsersHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query);
      const scope = await resolveListingScope(req);
      if (scope === 'forbidden') {
        return res.status(403).json({ error: 'Tenant context required to list users' });
      }

      const executeQuery = () =>
        Promise.all([
          findUsers({}, USER_LIST_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
          countUsers(),
        ]);

      const [users, total] =
        scope === 'system' ? await runAsSystem(executeQuery) : await executeQuery();

      const mapped: AdminUserListItem[] = users.map(toListItem);

      return res.status(200).json({ users: mapped, total, limit, offset });
    } catch (error) {
      logger.error('[adminUsers] listUsers error:', error);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }

  async function searchUsersHandler(req: ServerRequest, res: Response) {
    try {
      const rawQ = req.query.q;
      const rawLimit = req.query.limit;
      const query = typeof rawQ === 'string' ? rawQ : undefined;
      const limitStr = typeof rawLimit === 'string' ? rawLimit : '20';
      const trimmed = query?.trim() ?? '';

      if (!trimmed) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      if (trimmed.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
      }

      if (trimmed.length > MAX_SEARCH_LENGTH) {
        return res
          .status(400)
          .json({ error: `Query must not exceed ${MAX_SEARCH_LENGTH} characters` });
      }

      const searchLimit = Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 50);
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}`, 'i');
      const scope = await resolveListingScope(req);
      if (scope === 'forbidden') {
        return res.status(403).json({ error: 'Tenant context required to search users' });
      }

      const executeSearch = () =>
        findUsers(
          { $or: [{ name: regex }, { email: regex }, { username: regex }] },
          '_id name email username avatar',
          { limit: searchLimit, sort: { name: 1 } },
        );

      const users = scope === 'system' ? await runAsSystem(executeSearch) : await executeSearch();

      const results: AdminUserSearchResult[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        name: u.name ?? '',
        email: u.email ?? '',
        username: u.username,
        avatarUrl: u.avatar,
      }));

      return res
        .status(200)
        .json({ users: results, total: results.length, capped: results.length >= searchLimit });
    } catch (error) {
      logger.error('[adminUsers] searchUsers error:', error);
      return res.status(500).json({ error: 'Failed to search users' });
    }
  }

  async function deleteUserHandler(req: ServerRequest, res: Response) {
    let targetUserId: string | undefined;
    let triggerDeletionFence: Date | undefined;
    let userDeleted = false;

    try {
      const { id } = req.params as { id: string };
      targetUserId = id;

      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const callerId = req.user?._id?.toString() ?? req.user?.id;
      if (callerId === id) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
      }

      const [targetUser] = await findUsers({ _id: id }, 'role tenantId', { limit: 1 });
      if (targetUser?.role === SystemRoles.ADMIN) {
        const adminCount = await countUsers({ role: SystemRoles.ADMIN });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      triggerDeletionFence = new Date();
      const fenceState = await beginAgentTriggerUserDeletion(id, triggerDeletionFence);
      if (fenceState === 'in_progress') {
        triggerDeletionFence = undefined;
        return res.status(409).json({ error: 'User deletion is already in progress' });
      }
      if (fenceState === 'missing') {
        triggerDeletionFence = undefined;
        return res.status(404).json({ error: 'User not found' });
      }
      await prepareAgentTriggerUserPurge(id, triggerDeletionFence, targetUser?.tenantId);
      await drainAgentTriggerDeliveriesForUser(id);

      const result = await deleteUserById(id);

      if (result.deletedCount === 0) {
        await cancelAgentTriggerUserPurge(id, triggerDeletionFence);
        await cancelAgentTriggerUserDeletion(id, triggerDeletionFence);
        triggerDeletionFence = undefined;
        return res.status(404).json({ error: 'User not found' });
      }
      userDeleted = true;
      let codeEnvironmentCleanupSafe = true;
      try {
        await revokeUserCodeEnvironmentWorkers?.(id);
      } catch (error) {
        codeEnvironmentCleanupSafe = false;
        logger.error('[adminUsers] failed to revoke code environment workers:', id, error);
      }
      await purgeAgentTriggerDeliveriesForUser(id);

      if (targetUser?.role === SystemRoles.ADMIN) {
        const remaining = await countUsers({ role: SystemRoles.ADMIN });
        if (remaining === 0) {
          logger.error(
            `[adminUsers] CRITICAL: last admin deleted via race condition, user: ${id}. ` +
              'Manual DB intervention required to restore an ADMIN user.',
          );
        }
      }

      const objectId = new Types.ObjectId(id);
      const cleanupResults = await Promise.allSettled([
        deleteConfig(PrincipalType.USER, id),
        ...(codeEnvironmentCleanupSafe ? [deleteUserCodeEnvironments(objectId)] : []),
        deleteAclEntries({ principalType: PrincipalType.USER, principalId: objectId }),
      ]);
      for (const r of cleanupResults) {
        if (r.status === 'rejected') {
          logger.error('[adminUsers] cascade cleanup failed for user:', id, r.reason);
        }
      }
      await invalidateCodeEnvironmentConfigCache(targetUser?.tenantId).catch((error: unknown) => {
        logger.error('[adminUsers] code environment cache invalidation failed:', id, error);
      });

      return res.status(200).json({ message: result.message || 'User deleted successfully' });
    } catch (error) {
      if (targetUserId != null && triggerDeletionFence != null && !userDeleted) {
        try {
          await cancelAgentTriggerUserPurge(targetUserId, triggerDeletionFence);
        } catch (purgeFenceError) {
          logger.error('[adminUsers] failed to disarm trigger purge recovery:', purgeFenceError);
        }
        try {
          await cancelAgentTriggerUserDeletion(targetUserId, triggerDeletionFence);
        } catch (fenceError) {
          logger.error('[adminUsers] failed to release trigger deletion fence:', fenceError);
        }
      }
      logger.error('[adminUsers] deleteUser error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  /**
   * Provision a user inside the caller's tenant.
   *
   * The tenant comes from the caller (and is stamped by the tenant plugin), so a
   * tenant admin cannot create a user in another tenant. The returned temporary
   * password is a deliberate credential handoff — the same contract the CSV
   * roster flow already uses — not an error disclosure.
   */
  async function createUserHandler(req: ServerRequest, res: Response) {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) {
        return res.status(400).json({ error: 'A valid email is required' });
      }
      const email = body.email.trim().toLowerCase();

      if (body.name !== undefined && typeof body.name !== 'string') {
        return res.status(400).json({ error: 'Invalid name' });
      }
      if (typeof body.name === 'string' && body.name.trim().length > MAX_NAME_LENGTH) {
        return res
          .status(400)
          .json({ error: `Name must not exceed ${MAX_NAME_LENGTH} characters` });
      }
      if (body.username !== undefined && typeof body.username !== 'string') {
        return res.status(400).json({ error: 'Invalid username' });
      }
      if (body.role !== undefined && (typeof body.role !== 'string' || !body.role.trim())) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const accountType = parseAccountType(body.accountType);
      if (!accountType.ok) {
        return res.status(400).json({ error: accountType.error });
      }
      const familyRole = parseFamilyRole(body.familyRole);
      if (!familyRole.ok) {
        return res.status(400).json({ error: familyRole.error });
      }
      const familyAccountId = parseFamilyAccountId(body.familyAccountId);
      if (!familyAccountId.ok) {
        return res.status(400).json({ error: familyAccountId.error });
      }

      const existing = await findUsers({ email }, '_id', { limit: 1 });
      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: 'A user with this email already exists', error_code: 'EMAIL_EXISTS' });
      }

      const caller = callerIdentity(req);
      const plainPassword =
        typeof body.password === 'string' && body.password.length >= 8
          ? body.password
          : generateTempPassword();
      const password = await hashPassword(plainPassword);
      const name =
        typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email.split('@')[0];
      const username =
        typeof body.username === 'string' && body.username.trim()
          ? body.username.trim().toLowerCase()
          : email.split('@')[0];
      const role =
        typeof body.role === 'string' && body.role.trim() ? body.role.trim() : SystemRoles.USER;

      const created = await createUserRecord({
        email,
        name,
        username,
        password,
        emailVerified: true,
        provider: 'local',
        role,
        tenantId: caller.tenantId,
        mustChangePassword: true,
        termsAccepted: false,
        accountType: accountType.value,
        familyRole: familyRole.value,
        familyAccountId: familyAccountId.value ? new Types.ObjectId(familyAccountId.value) : null,
      } as CreateUserRequest);

      const userId = created._id?.toString() ?? '';
      const initialCredits = parseQuota(body.quota);
      await upsertBalanceFields(userId, {
        tokenCredits: initialCredits,
        autoRefillEnabled: true,
        refillIntervalValue: 30,
        refillIntervalUnit: 'days',
        refillAmount: initialCredits,
      });

      if (accountType.value) {
        const group = await findGroupByName(accountType.value);
        if (group) {
          await addUserToGroup(userId, group._id.toString());
        } else {
          logger.warn(
            `[adminUsers] createUser: no '${accountType.value}' group for tenant ` +
              `${caller.tenantId ?? '(platform)'}; account type stored without membership`,
          );
        }
      }

      logger.info(
        `[adminUsers] provisioned user [Id: ${userId}] [Email: ${email}] [Role: ${role}]`,
      );

      return res.status(201).json({
        ok: true,
        temporaryPassword: plainPassword,
        user: {
          id: userId,
          name,
          username,
          email,
          role,
          accountType: accountType.value,
          familyRole: familyRole.value,
          mustChangePassword: true,
          tempPassword: plainPassword,
        },
      });
    } catch (error) {
      logger.error('[adminUsers] createUser error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  /**
   * Provision a roster in bulk.
   *
   * Batched deliberately. The previous implementation awaited a duplicate check,
   * a user insert, a balance insert and a group update *per row*, and hashed each
   * password with the synchronous `bcrypt.hashSync`. A 4,000-row roster was
   * therefore ~16,000 sequential round-trips plus roughly ten minutes of blocked
   * event loop — the whole server stopped answering, not just this request.
   *
   * Here it is one duplicate query, bounded-concurrency async hashing, one insert
   * per collection, and one group update per distinct group. Rows are validated
   * before any write, and a bad row is reported rather than failing the batch.
   */
  async function bulkCreateUsersHandler(req: ServerRequest, res: Response) {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rows = normalizeRosterRows(body);
      if (rows === null) {
        return res.status(400).json({
          error: 'No user records provided in CSV or JSON format',
          error_code: 'EMPTY_ROSTER',
        });
      }
      if (rows.length === 0) {
        return res
          .status(400)
          .json({ error: 'Roster contains no data rows', error_code: 'EMPTY_ROSTER' });
      }
      if (rows.length > MAX_BULK_ROWS) {
        return res.status(400).json({
          error: `Roster exceeds the ${MAX_BULK_ROWS}-row batch limit; the panel splits larger rosters automatically`,
          error_code: 'BATCH_TOO_LARGE',
        });
      }

      const caller = callerIdentity(req);
      const skipped: Array<{ email: string; reason: string }> = [];
      const candidates: BulkCandidate[] = [];
      const seen = new Set<string>();

      for (const row of rows) {
        const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
        if (!email || !EMAIL_RE.test(email)) {
          skipped.push({ email: email || '(blank)', reason: 'invalid email' });
          continue;
        }
        if (seen.has(email)) {
          skipped.push({ email, reason: 'duplicate row in this batch' });
          continue;
        }
        seen.add(email);

        /**
         * `account_type` selects the seat tier; `group` is class/section
         * membership, which is a different thing — a school roster usually has
         * both, and conflating them would seat a whole class on one tier.
         */
        const accountTypeRaw = firstString(row.accountType, row.account_type, row.accounttype);
        const accountTypeResult = parseAccountType(accountTypeRaw ?? undefined);
        if (!accountTypeResult.ok) {
          skipped.push({ email, reason: accountTypeResult.error });
          continue;
        }

        const roleRaw = firstString(row.role);
        if (roleRaw && roleRaw.length > 64) {
          skipped.push({ email, reason: 'invalid role' });
          continue;
        }

        candidates.push({
          email,
          name: firstString(row.name) ?? email.split('@')[0],
          username: (firstString(row.username) ?? email.split('@')[0]).toLowerCase(),
          role: roleRaw ?? SystemRoles.USER,
          accountType: accountTypeResult.value,
          group: firstString(row.group),
          quota: parseQuota(row.quota),
        });
      }

      /* One query instead of one per row. Tenant-scoped by the tenant plugin. */
      const existing = new Set(await findExistingEmails(candidates.map((c) => c.email)));
      const fresh = candidates.filter((candidate) => {
        if (existing.has(candidate.email)) {
          skipped.push({ email: candidate.email, reason: 'already exists' });
          return false;
        }
        return true;
      });

      if (fresh.length === 0) {
        return res.status(200).json({
          ok: true,
          createdCount: 0,
          skippedCount: skipped.length,
          skipped,
          slips: [],
          credentialSlips: [],
        });
      }

      const startedAt = Date.now();
      const prepared = await mapWithConcurrency(fresh, BULK_HASH_CONCURRENCY, async (candidate) => {
        const tempPassword = generateTempPassword();
        return { candidate, tempPassword, password: await hashPassword(tempPassword) };
      });

      const inserted = await insertUserRecords(
        prepared.map(({ candidate, password }) => ({
          email: candidate.email,
          name: candidate.name,
          username: candidate.username,
          password,
          role: candidate.role,
          provider: 'local',
          emailVerified: true,
          mustChangePassword: true,
          termsAccepted: false,
          accountType: candidate.accountType,
          familyRole: null,
          familyAccountId: null,
          tenantId: caller.tenantId,
        })),
      );

      const idByEmail = new Map(inserted.map((doc) => [doc.email, doc._id.toString()]));

      const balances: BulkBalanceDocument[] = prepared
        .filter(({ candidate }) => idByEmail.has(candidate.email))
        .map(({ candidate }) => ({
          userId: idByEmail.get(candidate.email) as string,
          tokenCredits: candidate.quota,
          autoRefillEnabled: true,
          refillIntervalValue: 30,
          refillIntervalUnit: 'days',
          refillAmount: candidate.quota,
          tenantId: caller.tenantId,
        }));
      if (balances.length > 0) {
        await insertBalanceRecords(balances);
      }

      /* One update per distinct group, not per row. */
      const groupMembers = new Map<string, string[]>();
      for (const { candidate } of prepared) {
        const userId = idByEmail.get(candidate.email);
        if (!userId) {
          continue;
        }
        const names = new Set<string>();
        if (candidate.group) {
          names.add(candidate.group);
        }
        if (candidate.accountType) {
          names.add(candidate.accountType);
        }
        for (const name of names) {
          const bucket = groupMembers.get(name) ?? [];
          bucket.push(userId);
          groupMembers.set(name, bucket);
        }
      }
      await Promise.all(
        [...groupMembers.entries()].map(([name, userIds]) => addUsersToGroupByName(name, userIds)),
      );

      const slips = prepared
        .map(({ candidate, tempPassword }) => ({
          id: idByEmail.get(candidate.email) ?? null,
          name: candidate.name,
          email: candidate.email,
          role: candidate.role,
          accountType: candidate.accountType,
          group: candidate.group ?? '',
          tempPassword,
        }))
        .filter((slip) => slip.id !== null);

      logger.info(
        `[adminUsers] bulk provisioned ${slips.length} seat(s), skipped ${skipped.length} ` +
          `in ${Date.now() - startedAt}ms [By: ${caller.id}]`,
      );

      return res.status(200).json({
        ok: true,
        createdCount: slips.length,
        skippedCount: skipped.length,
        skipped,
        slips,
        credentialSlips: slips,
      });
    } catch (error) {
      logger.error('[adminUsers] bulkCreateUsers error:', error);
      return res
        .status(500)
        .json({ error: 'Bulk provisioning failed', error_code: 'INTERNAL_ERROR' });
    }
  }

  /**
   * Partial update of a user in the caller's tenant. Tenant isolation makes a
   * cross-tenant id a not-found rather than an edit.
   */
  async function updateUserHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const update: Partial<IUser> = {};

      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return res.status(400).json({ error: 'Invalid name' });
        }
        if (body.name.trim().length > MAX_NAME_LENGTH) {
          return res
            .status(400)
            .json({ error: `Name must not exceed ${MAX_NAME_LENGTH} characters` });
        }
        update.name = body.name.trim();
      }
      if (body.email !== undefined) {
        if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) {
          return res.status(400).json({ error: 'A valid email is required' });
        }
        update.email = body.email.trim().toLowerCase();
      }
      if (body.username !== undefined) {
        if (typeof body.username !== 'string' || !body.username.trim()) {
          return res.status(400).json({ error: 'Invalid username' });
        }
        update.username = body.username.trim().toLowerCase();
      }
      if (body.role !== undefined) {
        if (typeof body.role !== 'string' || !body.role.trim()) {
          return res.status(400).json({ error: 'Invalid role' });
        }
        update.role = body.role.trim();
      }
      if (body.mustChangePassword !== undefined) {
        if (typeof body.mustChangePassword !== 'boolean') {
          return res.status(400).json({ error: 'Invalid mustChangePassword' });
        }
        update.mustChangePassword = body.mustChangePassword;
      }
      if (body.accountType !== undefined) {
        const parsed = parseAccountType(body.accountType);
        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }
        update.accountType = parsed.value;
      }
      if (body.familyRole !== undefined) {
        const parsed = parseFamilyRole(body.familyRole);
        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }
        update.familyRole = parsed.value;
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No supported fields to update' });
      }

      const updated = await updateUserRecord(id, update);
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({ user: toListItem(updated) });
    } catch (error) {
      logger.error('[adminUsers] updateUser error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  /** Groups the user belongs to, within the caller's tenant. */
  async function getUserGroupsHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      const groups = await getUserGroups(id);
      return res.status(200).json({ groups });
    } catch (error) {
      logger.error('[adminUsers] getUserGroups error:', error);
      return res.status(500).json({ error: 'Failed to get user groups' });
    }
  }

  return {
    listUsers: listUsersHandler,
    searchUsers: searchUsersHandler,
    createUser: createUserHandler,
    bulkCreateUsers: bulkCreateUsersHandler,
    updateUser: updateUserHandler,
    getUserGroups: getUserGroupsHandler,
    deleteUser: deleteUserHandler,
  };
}
