import { ResourceType } from 'librechat-data-provider';
import type { Request, Response } from 'express';
import { createAgentAdminPermissionAccess } from './middleware';

describe('agent permission access', () => {
  it.each([ResourceType.AGENT, ResourceType.PROMPTGROUP])(
    'runs the resource permission check for %s regardless of ADMIN role',
    async (resourceType) => {
      const fallback = jest.fn();
      const middleware = createAgentAdminPermissionAccess(fallback);
      const req = {
        params: { resourceType, resourceId: 'resource-1' },
        user: { role: 'ADMIN', tenantId: 'tenant-a' },
      } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(fallback).toHaveBeenCalledWith(req, res, next);
    },
  );
});
