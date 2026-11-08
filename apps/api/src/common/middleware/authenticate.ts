import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ROLES, Role } from '@fleet-pulse/shared';
import { env } from '../../config/env';
import { unauthorized } from '../errors';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'], // pin the algorithm, never trust the token header
    }) as jwt.JwtPayload;

    if (!payload.sub || !ROLES.includes(payload.role as Role)) throw new Error('bad payload');
    req.user = { id: payload.sub, role: payload.role as Role };
    next();
  } catch {
    throw unauthorized('Your session has expired');
  }
};
