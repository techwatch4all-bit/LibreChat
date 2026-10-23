import type { NextFunction, Request, Response } from 'express';

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;

export function createAgentAdminPermissionAccess(fallback: Middleware): Middleware {
  return (req, res, next) => fallback(req, res, next);
}
