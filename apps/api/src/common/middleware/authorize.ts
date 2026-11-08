import { RequestHandler } from 'express';
import { can, Permission } from '@fleet-pulse/shared';
import { forbidden, unauthorized } from '../errors';

// Usage: router.post('/', requirePermission('vehicle:write'), controller.create)
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!can(req.user.role, permission)) throw forbidden();
    next();
  };
