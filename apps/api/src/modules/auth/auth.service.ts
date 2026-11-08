import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Prisma, PrismaClient, User } from '@prisma/client';
import { AuthUser } from '@fleet-pulse/shared';
import { env } from '../../config/env';
import { prisma } from '../../common/prisma';
import { audit } from '../../common/audit';
import { badRequest, unauthorized } from '../../common/errors';
import { addDays } from '../../common/utils/dates';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Two browser tabs can refresh at the same moment. Inside this window a replayed
// token is just rejected; outside it we treat the replay as theft.
const REFRESH_REUSE_GRACE_MS = 10_000;

// Compared against when the email doesn't exist, so "unknown user" and "wrong password"
// take about the same time and can't be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('this-is-not-a-real-password', 12);

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

type Db = PrismaClient | Prisma.TransactionClient;

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
});

function signAccessToken(user: User) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

async function issueRefreshToken(db: Db, userId: string, meta: ClientMeta) {
  const expiresAt = addDays(new Date(), env.JWT_REFRESH_TTL_DAYS);
  const row = await db.refreshToken.create({
    data: { userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 255) },
  });
  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    subject: userId,
    jwtid: row.id,
    algorithm: 'HS256',
    expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`,
  });
  return { token, expiresAt };
}

export const authService = {
  async login(email: string, password: string, meta: ClientMeta) {
    const user = await prisma.user.findUnique({ where: { email } });

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    const locked = !!user?.lockedUntil && user.lockedUntil > new Date();

    if (!user || !user.isActive || locked) {
      await audit({ userId: user?.id, action: 'auth.login_rejected', entity: 'User', ip: meta.ip,
        meta: { reason: !user ? 'unknown' : !user.isActive ? 'inactive' : 'locked' } });
      throw unauthorized('Invalid email or password');
    }

    if (!passwordOk) {
      const failed = user.failedLoginCount + 1;
      const shouldLock = failed >= MAX_FAILED_LOGINS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failed,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await audit({ userId: user.id, action: shouldLock ? 'auth.locked' : 'auth.login_failed',
        entity: 'User', entityId: user.id, ip: meta.ip });
      throw unauthorized('Invalid email or password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    const refresh = await issueRefreshToken(prisma, user.id, meta);
    await audit({ userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, ip: meta.ip });

    return {
      accessToken: signAccessToken(user),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: toAuthUser(user),
    };
  },

  async setPassword(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const setup = await prisma.passwordSetupToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !setup ||
      setup.expiresAt <= new Date() ||
      !setup.user.isActive ||
      setup.user.passwordHash !== null
    ) {
      throw badRequest('This password setup link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordSetupToken.deleteMany({
        where: { id: setup.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw badRequest('This password setup link is invalid or has expired');

      await tx.user.update({
        where: { id: setup.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      });
      await tx.refreshToken.updateMany({
        where: { userId: setup.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await audit({
      userId: setup.userId,
      action: 'auth.password_setup',
      entity: 'User',
      entityId: setup.userId,
    });
  },

  // Rotation: every refresh kills the old token and hands out a new one.
  async refresh(token: string | undefined, meta: ClientMeta) {
    if (!token) throw unauthorized();

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    } catch {
      throw unauthorized();
    }

    const row = payload.jti
      ? await prisma.refreshToken.findUnique({ where: { id: payload.jti }, include: { user: true } })
      : null;
    if (!row || row.userId !== payload.sub) throw unauthorized();

    if (row.revokedAt) {
      const justRotated = Date.now() - row.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
      if (!justRotated) {
        // An old token came back after it was rotated: assume it was stolen and sign the user out everywhere.
        await prisma.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await audit({ userId: row.userId, action: 'auth.refresh_reuse', entity: 'User', entityId: row.userId, ip: meta.ip });
      }
      throw unauthorized();
    }

    if (row.expiresAt < new Date() || !row.user.isActive) throw unauthorized();

    const next = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      return issueRefreshToken(tx, row.userId, meta);
    });

    return {
      accessToken: signAccessToken(row.user),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
      user: toAuthUser(row.user),
    };
  },

  async logout(token: string | undefined) {
    if (!token) return;
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (payload.jti) {
        await prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // A bad or expired token on logout isn't worth an error. The cookie gets cleared anyway.
    }
  },
};
