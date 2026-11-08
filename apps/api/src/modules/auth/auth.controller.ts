import { CookieOptions, Request, RequestHandler, Response } from 'express';
import { isProd } from '../../config/env';
import { authService, ClientMeta, toAuthUser } from './auth.service';
import { prisma } from '../../common/prisma';
import { unauthorized } from '../../common/errors';

const COOKIE_NAME = 'fp_refresh';

const cookieBase: CookieOptions = {
  httpOnly: true, // JavaScript in the page can never read it
  secure: isProd, // https only in production
  sameSite: 'strict',
  path: '/api/auth', // the browser only sends it to the auth endpoints
};

const metaFrom = (req: Request): ClientMeta => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

function sendSession(res: Response, result: Awaited<ReturnType<typeof authService.login>>) {
  res.cookie(COOKIE_NAME, result.refreshToken, { ...cookieBase, expires: result.refreshExpiresAt });
  // The refresh token stays in the cookie. The browser only gets the short-lived access token.
  res.json({ accessToken: result.accessToken, user: result.user });
}

export const authController: Record<string, RequestHandler> = {
  async login(req, res) {
    const { email, password } = req.body;
    sendSession(res, await authService.login(email, password, metaFrom(req)));
  },

  async setPassword(req, res) {
    await authService.setPassword(req.body.token, req.body.password);
    res.status(204).end();
  },

  async refresh(req, res) {
    sendSession(res, await authService.refresh(req.cookies?.[COOKIE_NAME], metaFrom(req)));
  },

  async logout(req, res) {
    await authService.logout(req.cookies?.[COOKIE_NAME]);
    res.clearCookie(COOKIE_NAME, cookieBase);
    res.status(204).end();
  },

  async me(req, res) {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.isActive) throw unauthorized();
    res.json(toAuthUser(user));
  },
};
