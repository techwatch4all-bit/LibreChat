import { Types } from 'mongoose';
import { PrincipalType } from 'librechat-data-provider';
import type { IGroup, IUser } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { AdminGroupsDeps } from './groups';
import { createAdminGroupsHandlers } from './groups';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('admin groups - commercial entitlement', () => {
  let validId: string;

  beforeEach(() => {
    validId = new Types.ObjectId().toString();
  });

  function createReqRes(
    overrides: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    const req = {
      params: overrides.params ?? {},
      query: overrides.query ?? {},
      body: overrides.body ?? {},
    } as unknown as ServerRequest;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { req, res, status, json };
  }

  function createDeps(overrides: Partial<AdminGroupsDeps> = {}): AdminGroupsDeps {
    return {
      listGroups: jest.fn().mockResolvedValue([]),
      countGroups: jest.fn().mockResolvedValue(0),
      findGroupById: jest.fn().mockResolvedValue(null),
      createGroup: jest
        .fn()
        .mockImplementation(async (data) => ({ _id: new Types.ObjectId(), ...data }) as IGroup),
      updateGroupById: jest.fn().mockResolvedValue(null),
      deleteGroup: jest.fn().mockResolvedValue(null),
      addUserToGroup: jest.fn().mockResolvedValue({ user: {} as IUser, group: null }),
      removeUserFromGroup: jest.fn().mockResolvedValue({ user: {} as IUser, group: null }),
      removeMemberById: jest.fn().mockResolvedValue(null),
      findUsers: jest.fn().mockResolvedValue([]),
      deleteConfig: jest.fn().mockResolvedValue(null),
      deleteAclEntries: jest.fn().mockResolvedValue({ deletedCount: 0 } as never),
      ...overrides,
    };
  }

  describe('create', () => {
    it('persists the account type so the group maps onto a One-API group', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status, json } = createReqRes({
        body: { name: 'Pro', accountType: 'pro' } as never,
      });

      await handlers.createGroup(req, res);

      expect(status).toHaveBeenCalledWith(201);
      expect(deps.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pro', accountType: 'pro' }),
      );
      expect(json).toHaveBeenCalled();
    });

    it('persists the family seat model', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res } = createReqRes({
        body: {
          name: 'Family',
          accountType: 'family',
          shared: true,
          familySeats: { maxAdults: 2, maxChildren: 2 },
        } as never,
      });

      await handlers.createGroup(req, res);

      expect(deps.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: 'family',
          shared: true,
          familySeats: { maxAdults: 2, maxChildren: 2 },
        }),
      );
    });

    it('rejects an account type outside the catalog', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status, json } = createReqRes({
        body: { name: 'Nope', accountType: 'not-a-type' } as never,
      });

      await handlers.createGroup(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('accountType') }),
      );
      expect(deps.createGroup).not.toHaveBeenCalled();
    });

    it('rejects a family seat model with more than two children', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status } = createReqRes({
        body: {
          name: 'Family',
          accountType: 'family',
          familySeats: { maxAdults: 2, maxChildren: 3 },
        } as never,
      });

      await handlers.createGroup(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(deps.createGroup).not.toHaveBeenCalled();
    });

    it('rejects an unsupported capability', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status } = createReqRes({
        body: {
          name: 'Pro',
          accountType: 'pro',
          allowedCapabilities: ['not_a_capability'],
        } as never,
      });

      await handlers.createGroup(req, res);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('rejects an unsupported mode', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status } = createReqRes({
        body: { name: 'Pro', accountType: 'pro', allowedModes: ['Godmode'] } as never,
      });

      await handlers.createGroup(req, res);

      expect(status).toHaveBeenCalledWith(400);
    });
  });

  describe('update', () => {
    it('updates the account type', async () => {
      const deps = createDeps({
        updateGroupById: jest
          .fn()
          .mockResolvedValue({ _id: new Types.ObjectId(validId) } as IGroup),
      });
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res } = createReqRes({
        params: { id: validId },
        body: { accountType: 'privacy' } as never,
      });

      await handlers.updateGroup(req, res);

      expect(deps.updateGroupById).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({ accountType: 'privacy' }),
      );
    });

    it('rejects an invalid account type on update', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status } = createReqRes({
        params: { id: validId },
        body: { accountType: 'nope' } as never,
      });

      await handlers.updateGroup(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(deps.updateGroupById).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('filters by account type', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res } = createReqRes({ query: { accountType: 'family' } });

      await handlers.listGroups(req, res);

      expect(deps.listGroups).toHaveBeenCalledWith(
        expect.objectContaining({ accountType: 'family' }),
      );
    });

    it('rejects an unknown account type filter', async () => {
      const deps = createDeps();
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res, status } = createReqRes({ query: { accountType: 'nope' } });

      await handlers.listGroups(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(deps.listGroups).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('cleans up the principal grants for the group', async () => {
      const deps = createDeps({
        deleteGroup: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(validId) } as IGroup),
      });
      const handlers = createAdminGroupsHandlers(deps);
      const { req, res } = createReqRes({ params: { id: validId } });

      await handlers.deleteGroup(req, res);

      expect(deps.deleteConfig).toHaveBeenCalledWith(PrincipalType.GROUP, validId);
      expect(deps.deleteAclEntries).toHaveBeenCalledWith(
        expect.objectContaining({ principalType: PrincipalType.GROUP }),
      );
    });
  });
});
