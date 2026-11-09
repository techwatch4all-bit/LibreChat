import type { TenantEntitlementSummary } from 'librechat-data-provider';
import type { Response } from 'express';
import type { AdminEntitlementsDeps } from './entitlements';
import type { ServerRequest } from '~/types/http';
import { createAdminEntitlementsHandlers } from './entitlements';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('createAdminEntitlementsHandlers', () => {
  const tenantId = 'satchida-master';
  const actor = { _id: 'operator-1', id: 'operator-1', name: 'Operator' };

  const summary = {
    plan: 'standard',
    status: 'active',
    seatLimit: 10,
    startsAt: null,
    expiresAt: null,
    activeSeats: 2,
    accountTypes: {
      standard: { seatLimit: 10, allowedModes: ['Chat'], activeSeats: 2 },
    },
  } as unknown as TenantEntitlementSummary;

  const validBody = {
    plan: 'standard',
    status: 'active',
    seatLimit: 10,
    accountTypes: {
      standard: { seatLimit: 10, allowedModes: ['Chat'] },
    },
  };

  function createReqRes(
    overrides: {
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      user?: Record<string, unknown>;
    } = {},
  ) {
    const req = {
      params: overrides.params ?? {},
      body: overrides.body ?? {},
      ...(overrides.user !== undefined ? { user: overrides.user } : { user: actor }),
    } as unknown as ServerRequest;

    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;

    return { req, res, status, json };
  }

  function createDeps(overrides: Partial<AdminEntitlementsDeps> = {}): AdminEntitlementsDeps {
    return {
      getTenantEntitlement: jest.fn().mockResolvedValue(undefined),
      listTenantEntitlements: jest.fn().mockResolvedValue([]),
      setTenantEntitlement: jest.fn().mockResolvedValue(summary),
      recordAuditEntry: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  describe('listEntitlements', () => {
    it('returns every entitlement summary', async () => {
      const deps = createDeps({
        listTenantEntitlements: jest.fn().mockResolvedValue([summary]),
      });
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes();

      await handlers.listEntitlements(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.listTenantEntitlements).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEntitlement', () => {
    it('returns 404 when the tenant has no entitlement', async () => {
      const deps = createDeps();
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({ params: { tenantId } });

      await handlers.getEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(404);
    });

    it('returns the entitlement for the requested tenant', async () => {
      const deps = createDeps({
        getTenantEntitlement: jest.fn().mockResolvedValue(summary),
      });
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({ params: { tenantId } });

      await handlers.getEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(deps.getTenantEntitlement).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('setEntitlement', () => {
    it('passes a clean update object (never the raw body) to the data layer', async () => {
      const deps = createDeps();
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({
        params: { tenantId },
        body: { ...validBody, seatAssignments: { attackerKey: 'pro' }, updatedBy: 'forged' },
      });

      await handlers.setEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const [, update] = (deps.setTenantEntitlement as jest.Mock).mock.calls[0];
      expect(update).toEqual(validBody);
      expect(update).not.toHaveProperty('seatAssignments');
      expect(update).not.toHaveProperty('updatedBy');
    });

    it('emits entitlement.set with the operator identity and tenant scope', async () => {
      const deps = createDeps();
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res } = createReqRes({ params: { tenantId }, body: validBody });

      await handlers.setEntitlement(req, res);

      const entry = (deps.recordAuditEntry as jest.Mock).mock.calls[0][0];
      expect(entry.action).toBe('entitlement.set');
      expect(entry.severity).toBe('warning');
      expect(entry.target.id).toBe(tenantId);
      expect(entry.metadata.plan).toBe('standard');
      expect(entry.metadata.seatLimit).toBe(10);
      expect(entry.tenantId).toBe(tenantId);
    });

    it('rejects an unsupported plan with 400 before touching the data layer', async () => {
      const deps = createDeps();
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({
        params: { tenantId },
        body: { ...validBody, plan: 'platinum' },
      });

      await handlers.setEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(deps.setTenantEntitlement).not.toHaveBeenCalled();
    });

    it('maps the data-layer optimistic-concurrency race to 409', async () => {
      const deps = createDeps({
        setTenantEntitlement: jest
          .fn()
          .mockRejectedValue(
            new Error('Tenant entitlement policy update raced with a seat change; retry'),
          ),
      });
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({ params: { tenantId }, body: validBody });

      await handlers.setEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(409);
    });

    it('maps a known validation failure from the data layer to 400', async () => {
      const deps = createDeps({
        setTenantEntitlement: jest
          .fn()
          .mockRejectedValue(new Error('Account-type allocations exceed tenant seat limit')),
      });
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({ params: { tenantId }, body: validBody });

      await handlers.setEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('maps an unrecognized data-layer failure to 500, not 400', async () => {
      const deps = createDeps({
        setTenantEntitlement: jest.fn().mockRejectedValue(new Error('connection destroyed')),
      });
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({ params: { tenantId }, body: validBody });

      await handlers.setEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(500);
    });

    it('stays fail-open when the recorder rejects: the write still answers', async () => {
      const deps = createDeps({
        recordAuditEntry: jest.fn().mockRejectedValue(new Error('audit store down')),
      });
      const handlers = createAdminEntitlementsHandlers(deps);
      const { req, res, status } = createReqRes({ params: { tenantId }, body: validBody });

      await handlers.setEntitlement(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });
  });
});
