import { RequestHandler } from 'express';
import { forbidden } from '../errors';

/**
 * The refresh token lives in a cookie, so the browser attaches it automatically.
 * Cross-site forms can't set custom headers, so requiring one is a cheap CSRF
 * defence on top of SameSite=Strict.
 */
export const requireCustomHeader: RequestHandler = (req, _res, next) => {
  if (req.headers['x-requested-with'] !== 'fleet-pulse') throw forbidden('Missing request header');
  next();
};
