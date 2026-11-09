import { Types } from 'mongoose';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import type { IUser, UserDeleteResult } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { AdminUsersDeps } from './users';
import { createAdminUsersHandlers, MAX_BULK_ROWS } from './users';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const validUserId = new Types.ObjectId().toString();

function mockUser(overrides: Partial<IUser> = {}): IUser {
  return {
    _id: new Types.ObjectId(),
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    avatar: 'https://example.com/avatar.png',
    role: 'USER',
    provider: 'local',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    ...overrides,
  } as IUser;
}

function createReqRes(
  overrides: {
    params?: Record<string, string>;
    query?: Record<string, string | string[]>;
    body?: Record<string, unknown>;
    user?: { _id?: Types.ObjectId; id?: string; role?: string; tenantId?: string };
  } = {},
) {
  const req = {
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    user: overrides.user ?? { _id: new Types.ObjectId(), role: 'admin' },
  } as unknown as ServerRequest;

  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  return { req, res, status, json };
}

function createDeps(overrides: Partial<AdminUsersDeps> = {}): AdminUsersDeps {
  return {
    findUsers: jest.fn().mockResolvedValue([]),
    countUsers: jest.fn().mockResolvedValue(0),
    isPlatformOperator: jest.fn().mockResolvedValue(true),
    createUserRecord: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    updateUserRecord: jest.fn().mockResolvedValue(null),
    getUserGroups: jest.fn().mockResolvedValue([]),
    upsertBalanceFields: jest.fn().mockResolvedValue(null),
    hashPassword: jest.fn().mockResolvedValue('hashed-password'),
    generateTempPassword: jest.fn().mockReturnValue('TempPass123!'),
    findGroupByName: jest.fn().mockResolvedValue(null),
    addUserToGroup: jest.fn().mockResolvedValue(undefined),
    findExistingEmails: jest.fn().mockResolvedValue([]),
    insertUserRecords: jest
      .fn()
      .mockImplementation(async (docs: Array<{ email: string }>) =>
        docs.map((doc) => ({ _id: new Types.ObjectId(), email: doc.email })),
      ),
    insertBalanceRecords: jest.fn().mockResolvedValue(undefined),
    addUsersToGroupByName: jest.fn().mockResolvedValue(0),
    beginAgentTriggerUserDeletion: jest.fn().mockResolvedValue('acquired'),
    cancelAgentTriggerUserDeletion: jest.fn().mockResolvedValue(true),
    drainAgentTriggerDeliveriesForUser: jest.fn().mockResolvedValue(undefined),
    prepareAgentTriggerUserPurge: jest.fn().mockResolvedValue(undefined),
    cancelAgentTriggerUserPurge: jest.fn().mockResolvedValue(true),
    purgeAgentTriggerDeliveriesForUser: jest.fn().mockResolvedValue(undefined),
    revokeUserCodeEnvironmentWorkers: jest.fn().mockResolvedValue(0),
    deleteUserById: jest
      .fn()
      .mockResolvedValue({ deletedCount: 1, message: 'User was deleted successfully.' }),
    deleteUserCodeEnvironments: jest.fn().mockResolvedValue(0),
    invalidateCodeEnvironmentConfigCache: jest.fn().mockResolvedValue(undefined),
    deleteConfig: jest.fn().mockResolvedValue(null),
    deleteAclEntries: jest.fn().mockResolvedValue(undefined),
    deleteAllUserSessions: jest.fn().mockResolvedValue(undefined),
    recordAuditEntry: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createAdminUsersHandlers', () => {
  describe('listUsers', () => {
    it('returns paginated users with total count', async () => {
      const users = [
        mockUser({ _id: new Types.ObjectId(validUserId) }),
        mockUser({ name: 'Other' }),
      ];
      const deps = createDeps({
        findUsers: jest.fn().mockResolvedValue(users),
        countUsers: jest.fn().mockResolvedValue(2),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes();

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const response = json.mock.calls[0][0];
      expect(response.users).toHaveLength(2);
      expect(response.total).toBe(2);
      expect(response).toHaveProperty('limit');
      expect(response).toHaveProperty('offset');
      expect(response.users[0]).toHaveProperty('id');
      expect(response.users[0]).toHaveProperty('name');
      expect(response.users[0]).toHaveProperty('email');
      expect(response.users[0]).toHaveProperty('role');
    });

    it('passes pagination params to findUsers and unfiltered count', async () => {
      const findUsers = jest.fn().mockResolvedValue([]);
      const countUsers = jest.fn().mockResolvedValue(0);
      const deps = createDeps({ findUsers, countUsers });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ query: { limit: '10', offset: '20' } });

      await handlers.listUsers(req, res);

      expect(findUsers).toHaveBeenCalledWith({}, expect.any(String), {
        limit: 10,
        offset: 20,
        sort: { createdAt: -1 },
      });
      expect(countUsers).toHaveBeenCalledWith();
    });

    it('returns empty list when no users', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes();

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json.mock.calls[0][0].users).toEqual([]);
      expect(json.mock.calls[0][0].total).toBe(0);
    });

    it('returns 500 when findUsers throws', async () => {
      const deps = createDeps({ findUsers: jest.fn().mockRejectedValue(new Error('db down')) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes();

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to list users' });
    });

    it('returns 500 when countUsers throws', async () => {
      const deps = createDeps({
        countUsers: jest.fn().mockRejectedValue(new Error('count failed')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes();

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to list users' });
    });
  });

  describe('listing scope', () => {
    it('serves a system-scoped listing to a platform operator', async () => {
      const deps = createDeps({ isPlatformOperator: jest.fn().mockResolvedValue(true) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        user: { _id: new Types.ObjectId(), role: 'ADMIN', tenantId: 'satchida-master' },
      });

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });

    it('confines a tenant admin to their own tenant', async () => {
      const deps = createDeps({ isPlatformOperator: jest.fn().mockResolvedValue(false) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        user: { _id: new Types.ObjectId(), role: 'ADMIN', tenantId: 'tenant-a' },
      });

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });

    it('ignores a client-supplied scope=all from a tenant admin', async () => {
      const runAsSystemSpy = jest.spyOn(jest.requireMock('@librechat/data-schemas'), 'runAsSystem');
      const deps = createDeps({ isPlatformOperator: jest.fn().mockResolvedValue(false) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        query: { scope: 'all' },
        user: { _id: new Types.ObjectId(), role: 'ADMIN', tenantId: 'tenant-a' },
      });

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(runAsSystemSpy).not.toHaveBeenCalled();
      runAsSystemSpy.mockRestore();
    });

    it('ignores a client-supplied tenantId from a tenant admin', async () => {
      const runAsSystemSpy = jest.spyOn(jest.requireMock('@librechat/data-schemas'), 'runAsSystem');
      const deps = createDeps({ isPlatformOperator: jest.fn().mockResolvedValue(false) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({
        query: { tenantId: 'tenant-b' },
        user: { _id: new Types.ObjectId(), role: 'ADMIN', tenantId: 'tenant-a' },
      });

      await handlers.listUsers(req, res);

      expect(runAsSystemSpy).not.toHaveBeenCalled();
      runAsSystemSpy.mockRestore();
    });

    it('refuses a caller with neither platform authority nor a tenant', async () => {
      const deps = createDeps({ isPlatformOperator: jest.fn().mockResolvedValue(false) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        user: { _id: new Types.ObjectId(), role: 'ADMIN' },
      });

      await handlers.listUsers(req, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({ error: 'Tenant context required to list users' });
    });

    it('refuses a tenantless non-operator search too', async () => {
      const deps = createDeps({ isPlatformOperator: jest.fn().mockResolvedValue(false) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        query: { q: 'test' },
        user: { _id: new Types.ObjectId(), role: 'ADMIN' },
      });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({ error: 'Tenant context required to search users' });
    });
  });

  describe('searchUsers', () => {
    it('returns matching users with total and capped flag', async () => {
      const users = [mockUser()];
      const deps = createDeps({ findUsers: jest.fn().mockResolvedValue(users) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: 'test' } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const response = json.mock.calls[0][0];
      expect(response.users).toHaveLength(1);
      expect(response.total).toBe(1);
      expect(response.capped).toBe(false);
      expect(response.users[0]).toHaveProperty('id');
      expect(response.users[0]).toHaveProperty('name');
      expect(response.users[0]).toHaveProperty('email');
      expect(response.users[0]).toHaveProperty('username');
    });

    it('sets capped to true when results hit the limit', async () => {
      const users = Array.from({ length: 20 }, () => mockUser());
      const deps = createDeps({ findUsers: jest.fn().mockResolvedValue(users) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, json } = createReqRes({ query: { q: 'test', limit: '20' } });

      await handlers.searchUsers(req, res);

      const response = json.mock.calls[0][0];
      expect(response.total).toBe(20);
      expect(response.capped).toBe(true);
    });

    it('searches name, email, and username with anchored prefix regex', async () => {
      const findUsers = jest.fn().mockResolvedValue([]);
      const deps = createDeps({ findUsers });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ query: { q: 'test' } });

      await handlers.searchUsers(req, res);

      const filter = findUsers.mock.calls[0][0];
      expect(filter.$or).toHaveLength(3);
      expect(filter.$or[0]).toHaveProperty('name');
      expect(filter.$or[1]).toHaveProperty('email');
      expect(filter.$or[2]).toHaveProperty('username');
      expect(filter.$or[0].name.source).toBe('^test');
    });

    it('projects username in the field selection', async () => {
      const findUsers = jest.fn().mockResolvedValue([]);
      const deps = createDeps({ findUsers });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ query: { q: 'test' } });

      await handlers.searchUsers(req, res);

      const projection = findUsers.mock.calls[0][1];
      expect(projection).toContain('username');
    });

    it('escapes regex special characters in query', async () => {
      const findUsers = jest.fn().mockResolvedValue([]);
      const deps = createDeps({ findUsers });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ query: { q: 'test.user+1' } });

      await handlers.searchUsers(req, res);

      const filter = findUsers.mock.calls[0][0];
      expect(filter.$or[0].name).toBeInstanceOf(RegExp);
      expect(filter.$or[0].name.source).toBe('^test\\.user\\+1');
    });

    it('returns 400 when query is missing', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: {} });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Query parameter "q" is required' });
    });

    it('returns 400 when query is empty string', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: '' } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Query parameter "q" is required' });
    });

    it('returns 400 when query is whitespace-only', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: '   ' } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Query parameter "q" is required' });
    });

    it('returns 400 when query is too short', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: 'a' } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Query must be at least 2 characters' });
    });

    it('returns 400 when query exceeds max length', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: 'a'.repeat(201) } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('200') }),
      );
    });

    it('treats array query param as missing', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: ['foo', 'bar'] } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Query parameter "q" is required' });
    });

    it('passes limit to findUsers', async () => {
      const findUsers = jest.fn().mockResolvedValue([mockUser()]);
      const deps = createDeps({ findUsers });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ query: { q: 'User', limit: '3' } });

      await handlers.searchUsers(req, res);

      expect(findUsers).toHaveBeenCalledWith(expect.any(Object), expect.any(String), {
        limit: 3,
        sort: { name: 1 },
      });
    });

    it('caps limit at 50', async () => {
      const findUsers = jest.fn().mockResolvedValue([]);
      const deps = createDeps({ findUsers });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ query: { q: 'User', limit: '100' } });

      await handlers.searchUsers(req, res);

      expect(findUsers).toHaveBeenCalledWith(expect.any(Object), expect.any(String), {
        limit: 50,
        sort: { name: 1 },
      });
    });

    it('returns 500 on error', async () => {
      const deps = createDeps({ findUsers: jest.fn().mockRejectedValue(new Error('db down')) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ query: { q: 'test' } });

      await handlers.searchUsers(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to search users' });
    });
  });

  describe('deleteUser', () => {
    it('deletes user and returns 200', async () => {
      const result: UserDeleteResult = {
        deletedCount: 1,
        message: 'User was deleted successfully.',
      };
      const deps = createDeps({ deleteUserById: jest.fn().mockResolvedValue(result) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ message: 'User was deleted successfully.' });
      expect(deps.beginAgentTriggerUserDeletion).toHaveBeenCalledWith(
        validUserId,
        expect.any(Date),
      );
      expect(deps.drainAgentTriggerDeliveriesForUser).toHaveBeenCalledWith(validUserId);
      expect(deps.prepareAgentTriggerUserPurge).toHaveBeenCalledWith(
        validUserId,
        expect.any(Date),
        undefined,
      );
      expect(deps.purgeAgentTriggerDeliveriesForUser).toHaveBeenCalledWith(validUserId);
      expect(deps.cancelAgentTriggerUserPurge).not.toHaveBeenCalled();
      expect(deps.cancelAgentTriggerUserDeletion).not.toHaveBeenCalled();
    });

    it('returns fallback message when result.message is empty', async () => {
      const result: UserDeleteResult = { deletedCount: 1, message: '' };
      const deps = createDeps({ deleteUserById: jest.fn().mockResolvedValue(result) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ message: 'User deleted successfully' });
    });

    it('returns 403 when deleting own account', async () => {
      const userId = new Types.ObjectId();
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        params: { id: userId.toString() },
        user: { _id: userId, role: 'admin' },
      });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({ error: 'Cannot delete your own account' });
      expect(deps.deleteUserById).not.toHaveBeenCalled();
    });

    it('returns 400 when deleting the last admin', async () => {
      const targetId = new Types.ObjectId().toString();
      const deps = createDeps({
        findUsers: jest.fn().mockResolvedValue([mockUser({ role: SystemRoles.ADMIN })]),
        countUsers: jest.fn().mockResolvedValue(1),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: targetId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Cannot delete the last admin user' });
      expect(deps.deleteUserById).not.toHaveBeenCalled();
      expect(deps.countUsers).toHaveBeenCalledWith({ role: SystemRoles.ADMIN });
    });

    it('allows deleting an admin when other admins exist', async () => {
      const targetId = new Types.ObjectId().toString();
      const deps = createDeps({
        findUsers: jest.fn().mockResolvedValue([mockUser({ role: SystemRoles.ADMIN })]),
        countUsers: jest.fn().mockResolvedValue(3),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({ params: { id: targetId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.deleteUserById).toHaveBeenCalledWith(targetId);
    });

    it('does not check admin count when target is a regular user', async () => {
      const targetId = new Types.ObjectId().toString();
      const deps = createDeps({
        findUsers: jest.fn().mockResolvedValue([mockUser({ role: 'USER' })]),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({ params: { id: targetId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.countUsers).not.toHaveBeenCalled();
    });

    it('cascades cleanup of Config, code environments, and AclEntries', async () => {
      const result: UserDeleteResult = {
        deletedCount: 1,
        message: 'User was deleted successfully.',
      };
      const deps = createDeps({ deleteUserById: jest.fn().mockResolvedValue(result) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.deleteConfig).toHaveBeenCalledWith(PrincipalType.USER, validUserId);
      expect(deps.deleteUserCodeEnvironments).toHaveBeenCalledWith(expect.any(Types.ObjectId));
      expect(deps.invalidateCodeEnvironmentConfigCache).toHaveBeenCalledWith(undefined);
      expect(deps.deleteAclEntries).toHaveBeenCalledWith({
        principalType: PrincipalType.USER,
        principalId: expect.any(Types.ObjectId),
      });
    });

    it('returns success even when cascade cleanup partially fails', async () => {
      const result: UserDeleteResult = {
        deletedCount: 1,
        message: 'User was deleted successfully.',
      };
      const deps = createDeps({
        deleteUserById: jest.fn().mockResolvedValue(result),
        deleteConfig: jest.fn().mockRejectedValue(new Error('cleanup failed')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ message: 'User was deleted successfully.' });
    });

    it('preserves code environment records when revocation marking fails', async () => {
      const deps = createDeps({
        revokeUserCodeEnvironmentWorkers: jest.fn().mockRejectedValue(new Error('mongo down')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(deps.deleteUserById).toHaveBeenCalledWith(validUserId);
      expect(deps.deleteUserCodeEnvironments).not.toHaveBeenCalled();
    });

    it('does not cascade when user is not found', async () => {
      const result: UserDeleteResult = { deletedCount: 0, message: '' };
      const deps = createDeps({ deleteUserById: jest.fn().mockResolvedValue(result) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(deps.deleteConfig).not.toHaveBeenCalled();
      expect(deps.deleteUserCodeEnvironments).not.toHaveBeenCalled();
      expect(deps.deleteAclEntries).not.toHaveBeenCalled();
      expect(deps.purgeAgentTriggerDeliveriesForUser).not.toHaveBeenCalled();
      expect(deps.cancelAgentTriggerUserDeletion).toHaveBeenCalledWith(
        validUserId,
        expect.any(Date),
      );
      expect(deps.cancelAgentTriggerUserPurge).toHaveBeenCalledWith(validUserId, expect.any(Date));
    });

    it('returns 400 for invalid ObjectId', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: 'not-valid' } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid user ID format' });
    });

    it('returns 404 when user not found', async () => {
      const result: UserDeleteResult = { deletedCount: 0, message: '' };
      const deps = createDeps({ deleteUserById: jest.fn().mockResolvedValue(result) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('returns 500 on error', async () => {
      const deps = createDeps({
        deleteUserById: jest.fn().mockRejectedValue(new Error('db crash')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to delete user' });
      expect(deps.cancelAgentTriggerUserDeletion).toHaveBeenCalledWith(
        validUserId,
        expect.any(Date),
      );
      expect(deps.cancelAgentTriggerUserPurge).toHaveBeenCalledWith(validUserId, expect.any(Date));
      expect(deps.purgeAgentTriggerDeliveriesForUser).not.toHaveBeenCalled();
    });

    it('does not delete while another deletion owns the trigger fence', async () => {
      const deps = createDeps({
        beginAgentTriggerUserDeletion: jest.fn().mockResolvedValue('in_progress'),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({ error: 'User deletion is already in progress' });
      expect(deps.drainAgentTriggerDeliveriesForUser).not.toHaveBeenCalled();
      expect(deps.deleteUserById).not.toHaveBeenCalled();
      expect(deps.cancelAgentTriggerUserDeletion).not.toHaveBeenCalled();
    });

    it('returns not found without draining when the trigger fence principal is missing', async () => {
      const deps = createDeps({
        beginAgentTriggerUserDeletion: jest.fn().mockResolvedValue('missing'),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(deps.drainAgentTriggerDeliveriesForUser).not.toHaveBeenCalled();
      expect(deps.deleteUserById).not.toHaveBeenCalled();
      expect(deps.cancelAgentTriggerUserDeletion).not.toHaveBeenCalled();
    });

    it('drains before commit and purges only after the user is deleted', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      const beginOrder = (deps.beginAgentTriggerUserDeletion as jest.Mock).mock
        .invocationCallOrder[0];
      const prepareOrder = (deps.prepareAgentTriggerUserPurge as jest.Mock).mock
        .invocationCallOrder[0];
      const drainOrder = (deps.drainAgentTriggerDeliveriesForUser as jest.Mock).mock
        .invocationCallOrder[0];
      const deleteOrder = (deps.deleteUserById as jest.Mock).mock.invocationCallOrder[0];
      const revokeCodeOrder = (deps.revokeUserCodeEnvironmentWorkers as jest.Mock).mock
        .invocationCallOrder[0];
      const deleteCodeOrder = (deps.deleteUserCodeEnvironments as jest.Mock).mock
        .invocationCallOrder[0];
      const purgeOrder = (deps.purgeAgentTriggerDeliveriesForUser as jest.Mock).mock
        .invocationCallOrder[0];
      expect(beginOrder).toBeLessThan(drainOrder);
      expect(beginOrder).toBeLessThan(prepareOrder);
      expect(prepareOrder).toBeLessThan(drainOrder);
      expect(drainOrder).toBeLessThan(deleteOrder);
      expect(deleteOrder).toBeLessThan(revokeCodeOrder);
      expect(revokeCodeOrder).toBeLessThan(deleteCodeOrder);
      expect(deleteOrder).toBeLessThan(purgeOrder);
    });

    it('leaves durable purge recovery armed when immediate post-commit cleanup fails', async () => {
      const deps = createDeps({
        purgeAgentTriggerDeliveriesForUser: jest.fn().mockRejectedValue(new Error('db down')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.deleteUser(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to delete user' });
      expect(deps.deleteUserById).toHaveBeenCalledWith(validUserId);
      expect(deps.prepareAgentTriggerUserPurge).toHaveBeenCalled();
      expect(deps.cancelAgentTriggerUserPurge).not.toHaveBeenCalled();
      expect(deps.cancelAgentTriggerUserDeletion).not.toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('rejects an invalid email', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ body: { email: 'not-an-email' } });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'A valid email is required' });
      expect(deps.createUserRecord).not.toHaveBeenCalled();
    });

    it('rejects an unknown account type', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        body: { email: 'new@example.com', accountType: 'Platinum' },
      });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json.mock.calls[0][0].error).toContain('accountType must be one of');
      expect(deps.createUserRecord).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email within the tenant', async () => {
      const deps = createDeps({ findUsers: jest.fn().mockResolvedValue([mockUser()]) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ body: { email: 'taken@example.com' } });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        error: 'A user with this email already exists',
        error_code: 'EMAIL_EXISTS',
      });
      expect(deps.createUserRecord).not.toHaveBeenCalled();
    });

    it('provisions the user with hashed password, quota and account type', async () => {
      const createUserRecord = jest
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId(validUserId) });
      const upsertBalanceFields = jest.fn().mockResolvedValue(null);
      const addUserToGroup = jest.fn().mockResolvedValue(undefined);
      const deps = createDeps({
        createUserRecord,
        upsertBalanceFields,
        addUserToGroup,
        findGroupByName: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        body: {
          email: '  New@Example.com ',
          name: 'New Person',
          accountType: 'pro',
          quota: 2500,
          familyRole: 'adult',
        },
        user: { _id: new Types.ObjectId(), role: 'ADMIN', tenantId: 'tenant-a' },
      });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(201);
      expect(createUserRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New Person',
          password: 'hashed-password',
          role: 'USER',
          tenantId: 'tenant-a',
          accountType: 'pro',
          familyRole: 'adult',
          mustChangePassword: true,
        }),
      );
      expect(upsertBalanceFields).toHaveBeenCalledWith(
        validUserId,
        expect.objectContaining({ tokenCredits: 2500, refillAmount: 2500 }),
      );
      expect(addUserToGroup).toHaveBeenCalled();
      const response = json.mock.calls[0][0];
      expect(response.ok).toBe(true);
      expect(response.temporaryPassword).toBe('TempPass123!');
    });

    it('stores the account type even when no matching group exists', async () => {
      const deps = createDeps({ findGroupByName: jest.fn().mockResolvedValue(null) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        body: { email: 'new@example.com', accountType: 'family' },
      });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(201);
      expect(deps.addUserToGroup).not.toHaveBeenCalled();
      expect(deps.createUserRecord).toHaveBeenCalledWith(
        expect.objectContaining({ accountType: 'family' }),
      );
    });

    it('returns 500 when the record insert fails', async () => {
      const deps = createDeps({
        createUserRecord: jest.fn().mockRejectedValue(new Error('duplicate key')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ body: { email: 'new@example.com' } });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to create user' });
    });
  });

  describe('updateUser', () => {
    it('rejects an invalid user id', async () => {
      const handlers = createAdminUsersHandlers(createDeps());
      const { req, res, status, json } = createReqRes({
        params: { id: 'nope' },
        body: { name: 'X' },
      });

      await handlers.updateUser(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid user ID format' });
    });

    it('rejects a body with no supported fields', async () => {
      const handlers = createAdminUsersHandlers(createDeps());
      const { req, res, status, json } = createReqRes({
        params: { id: validUserId },
        body: { tenantId: 'tenant-b' },
      });

      await handlers.updateUser(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'No supported fields to update' });
    });

    it('returns 404 when the user is outside the caller tenant', async () => {
      const deps = createDeps({ updateUserRecord: jest.fn().mockResolvedValue(null) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        params: { id: validUserId },
        body: { name: 'Rename' },
        user: { _id: new Types.ObjectId(), role: 'ADMIN', tenantId: 'tenant-a' },
      });

      await handlers.updateUser(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('updates supported fields and returns the list item', async () => {
      const updateUserRecord = jest
        .fn()
        .mockResolvedValue(mockUser({ accountType: 'pro', familyRole: 'adult' }));
      const deps = createDeps({ updateUserRecord });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({
        params: { id: validUserId },
        body: { name: ' Renamed ', accountType: 'pro', familyRole: 'adult' },
      });

      await handlers.updateUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(updateUserRecord).toHaveBeenCalledWith(validUserId, {
        name: 'Renamed',
        accountType: 'pro',
        familyRole: 'adult',
      });
      const response = json.mock.calls[0][0];
      expect(response.user.accountType).toBe('pro');
    });

    it('accepts null to clear the account type', async () => {
      const updateUserRecord = jest.fn().mockResolvedValue(mockUser());
      const deps = createDeps({ updateUserRecord });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        params: { id: validUserId },
        body: { accountType: null },
      });

      await handlers.updateUser(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(updateUserRecord).toHaveBeenCalledWith(validUserId, { accountType: null });
    });

    it('never returns the raw seat token', async () => {
      const token = 'tk_tenant_a_deadbeefcafe1234';
      const deps = createDeps({
        updateUserRecord: jest.fn().mockResolvedValue(mockUser({ seatToken: token })),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, json } = createReqRes({
        params: { id: validUserId },
        body: { name: 'Renamed' },
      });

      await handlers.updateUser(req, res);

      const serialized = JSON.stringify(json.mock.calls[0][0]);
      expect(serialized).not.toContain('deadbeefcafe');
      expect(serialized).not.toContain(token);
      expect(json.mock.calls[0][0].user.seatAssigned).toBe(true);
      expect(json.mock.calls[0][0].user.seatTokenHint).toBe('…1234');
    });
  });

  describe('getUserGroups', () => {
    it('rejects an invalid user id', async () => {
      const handlers = createAdminUsersHandlers(createDeps());
      const { req, res, status, json } = createReqRes({ params: { id: 'nope' } });

      await handlers.getUserGroups(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid user ID format' });
    });

    it('returns the groups the user belongs to', async () => {
      const groups = [{ id: 'g1', name: 'basic' }];
      const deps = createDeps({ getUserGroups: jest.fn().mockResolvedValue(groups) });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ params: { id: validUserId } });

      await handlers.getUserGroups(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ groups });
    });
  });

  describe('bulkCreateUsers', () => {
    const roster = [
      { name: 'A One', email: 'a.one@school.edu', group: 'Grade-10', account_type: 'basic' },
      { name: 'B Two', email: 'b.two@school.edu', group: 'Grade-10', account_type: 'basic' },
      { name: 'C Three', email: 'c.three@school.edu', group: 'Faculty', account_type: 'pro' },
    ];

    it('rejects an empty roster', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status, json } = createReqRes({ body: { users: [] } });

      await handlers.bulkCreateUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ error_code: 'EMPTY_ROSTER' }));
      expect(deps.insertUserRecords).not.toHaveBeenCalled();
    });

    it('rejects a roster above the batch limit', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const rows = Array.from({ length: MAX_BULK_ROWS + 1 }, (_, i) => ({
        email: `user${i}@school.edu`,
      }));
      const { req, res, status, json } = createReqRes({ body: { users: rows } });

      await handlers.bulkCreateUsers(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ error_code: 'BATCH_TOO_LARGE' }));
      expect(deps.insertUserRecords).not.toHaveBeenCalled();
    });

    /**
     * The regression guard for the batched rewrite: a roster must cost one
     * duplicate query and one insert, not one of each per row.
     */
    it('batches the duplicate check and the insert', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({ body: { users: roster } });

      await handlers.bulkCreateUsers(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.findExistingEmails).toHaveBeenCalledTimes(1);
      expect(deps.findExistingEmails).toHaveBeenCalledWith([
        'a.one@school.edu',
        'b.two@school.edu',
        'c.three@school.edu',
      ]);
      expect(deps.insertUserRecords).toHaveBeenCalledTimes(1);
      expect(deps.insertUserRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ email: 'a.one@school.edu', accountType: 'basic' }),
          expect.objectContaining({ email: 'c.three@school.edu', accountType: 'pro' }),
        ]),
      );
      expect(deps.insertBalanceRecords).toHaveBeenCalledTimes(1);
    });

    it('inserts already-hashed passwords and forces a change on first login', async () => {
      const hashSpy = jest.fn().mockResolvedValue('hashed-password');
      const deps = createDeps({ hashPassword: hashSpy });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ body: { users: roster } });

      await handlers.bulkCreateUsers(req, res);

      expect(hashSpy).toHaveBeenCalledTimes(roster.length);
      const [docs] = (deps.insertUserRecords as jest.Mock).mock.calls[0];
      for (const doc of docs as Array<{ password: string; mustChangePassword: boolean }>) {
        expect(doc.password).toBe('hashed-password');
        expect(doc.mustChangePassword).toBe(true);
      }
    });

    it('skips emails that already exist without failing the batch', async () => {
      const deps = createDeps({
        findExistingEmails: jest.fn().mockResolvedValue(['b.two@school.edu']),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, json } = createReqRes({ body: { users: roster } });

      await handlers.bulkCreateUsers(req, res);

      const [payload] = (json as jest.Mock).mock.calls[0];
      expect(payload.createdCount).toBe(2);
      expect(payload.skipped).toEqual([
        expect.objectContaining({ email: 'b.two@school.edu', reason: 'already exists' }),
      ]);
    });

    it('reports invalid and duplicated rows as skips rather than failing', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, json } = createReqRes({
        body: {
          users: [
            { email: 'not-an-email' },
            { email: 'dup@school.edu' },
            { email: 'DUP@school.edu' },
          ],
        },
      });

      await handlers.bulkCreateUsers(req, res);

      const [payload] = (json as jest.Mock).mock.calls[0];
      expect(payload.createdCount).toBe(1);
      expect(payload.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason: 'invalid email' }),
          expect.objectContaining({ reason: 'duplicate row in this batch' }),
        ]),
      );
    });

    it('updates each distinct group once, not once per row', async () => {
      const addToGroup = jest.fn().mockResolvedValue(2);
      const deps = createDeps({ addUsersToGroupByName: addToGroup });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ body: { users: roster } });

      await handlers.bulkCreateUsers(req, res);

      const groupNames = addToGroup.mock.calls.map((call) => call[0]).sort();
      expect(groupNames).toEqual(['Grade-10', 'Faculty', 'basic', 'pro'].sort());
      for (const call of addToGroup.mock.calls) {
        expect((call[1] as string[]).length).toBeGreaterThan(0);
      }
    });

    it('parses a CSV payload and maps the account_type column', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const csv = [
        'name,email,role,account_type,group,quota',
        'Ada Lovelace,ada@school.edu,USER,basic,Grade-9,250000',
      ].join('\n');
      const { req, res, json } = createReqRes({ body: { csvData: csv } });

      await handlers.bulkCreateUsers(req, res);

      expect(deps.insertUserRecords).toHaveBeenCalledWith([
        expect.objectContaining({
          email: 'ada@school.edu',
          name: 'Ada Lovelace',
          accountType: 'basic',
        }),
      ]);
      const [balDocs] = (deps.insertBalanceRecords as jest.Mock).mock.calls[0];
      expect(balDocs[0]).toEqual(expect.objectContaining({ tokenCredits: 250000 }));
      const [payload] = (json as jest.Mock).mock.calls[0];
      expect(payload.slips[0]).toEqual(expect.objectContaining({ group: 'Grade-9' }));
    });

    it('rejects an unknown account type as a skip', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, json } = createReqRes({
        body: { users: [{ email: 'x@school.edu', account_type: 'Family' }] },
      });

      await handlers.bulkCreateUsers(req, res);

      const [payload] = (json as jest.Mock).mock.calls[0];
      expect(payload.createdCount).toBe(0);
      expect(payload.skipped[0].reason).toMatch(/accountType must be one of/);
    });

    it('returns 500 when the bulk insert fails', async () => {
      const deps = createDeps({
        insertUserRecords: jest.fn().mockRejectedValue(new Error('mongo down')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({ body: { users: roster } });

      await handlers.bulkCreateUsers(req, res);

      expect(status).toHaveBeenCalledWith(500);
    });
  });

  describe('audit', () => {
    const actor = { _id: new Types.ObjectId(), name: 'Operator', email: 'op@example.com' };

    it('emits user.created after a successful provision', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        body: { email: 'new@example.com', name: 'New User' },
        user: actor,
      });

      await handlers.createUser(req, res);

      expect(status).toHaveBeenCalledWith(201);
      const calls = (deps.recordAuditEntry as jest.Mock).mock.calls;
      expect(calls).toHaveLength(1);
      const entry = calls[0][0];
      expect(entry.action).toBe('user.created');
      expect(entry.actor.id).toBe(actor._id.toString());
      expect(entry.target.type).toBe(PrincipalType.USER);
      expect(entry.metadata.accountType).toBeNull();
    });

    it('emits user.password_reset with warning severity and kills sessions', async () => {
      const deps = createDeps({
        updateUserRecord: jest.fn().mockResolvedValue(mockUser()),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        params: { id: validUserId },
        body: { newPassword: 'Sup3rSecure!' },
        user: actor,
      });

      await handlers.resetPassword(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.deleteAllUserSessions).toHaveBeenCalledWith({ userId: validUserId });
      const entry = (deps.recordAuditEntry as jest.Mock).mock.calls[0][0];
      expect(entry.action).toBe('user.password_reset');
      expect(entry.severity).toBe('warning');
      const responseBody = (res as unknown as { json: jest.Mock }).json.mock.calls[0][0];
      expect(JSON.stringify(responseBody)).not.toContain('Sup3rSecure!');
    });

    it('emits user.deleted after a successful delete', async () => {
      const deps = createDeps();
      const handlers = createAdminUsersHandlers(deps);
      const { req, res } = createReqRes({ params: { id: validUserId }, user: actor });

      await handlers.deleteUser(req, res);

      const calls = (deps.recordAuditEntry as jest.Mock).mock.calls;
      const deleted = calls.find(([entry]) => entry.action === 'user.deleted');
      expect(deleted).toBeTruthy();
      expect(deleted[0].target.id).toBe(validUserId);
    });

    it('stays fail-open when the recorder rejects: the mutation still answers', async () => {
      const deps = createDeps({
        updateUserRecord: jest.fn().mockResolvedValue(mockUser()),
        recordAuditEntry: jest.fn().mockRejectedValue(new Error('audit store down')),
      });
      const handlers = createAdminUsersHandlers(deps);
      const { req, res, status } = createReqRes({
        params: { id: validUserId },
        body: { newPassword: 'Sup3rSecure!' },
        user: actor,
      });

      await handlers.resetPassword(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });
  });
});
