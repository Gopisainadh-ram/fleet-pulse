import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, User } from '@prisma/client';
import { canManageRole, UserDto } from '@fleet-pulse/shared';
import { prisma } from '../../common/prisma';
import { audit } from '../../common/audit';
import { RequestUser } from '../../common/types';
import { AppError, conflict, forbidden, notFound } from '../../common/errors';
import { isMailConfigured, sendPasswordSetupEmail } from '../../common/mailer';
import { env, isProd } from '../../config/env';
import { skipTake, toPage } from '../../common/utils/pagination';
import { CreateUserInput, ListUsersQuery, UpdateUserInput } from './user.schema';

const toDto = (u: User): UserDto => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  isActive: u.isActive,
  setupComplete: u.passwordHash !== null,
  createdAt: u.createdAt.toISOString(),
});

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const invitationExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const invitationLink = (token: string) =>
  `${env.WEB_APP_URL.replace(/\/+$/, '')}/set-password?token=${encodeURIComponent(token)}`;

function assertInvitationDeliveryAvailable() {
  if (!isMailConfigured() && isProd) {
    throw new AppError(503, 'Email delivery is not configured. Contact your administrator.');
  }
}

async function deliverInvitation(email: string, name: string, token: string) {
  const link = invitationLink(token);
  const sent = await sendPasswordSetupEmail(email, name, link);
  return { invitationSent: sent, invitationLink: sent ? null : link };
}

export const userService = {
  async list(actor: RequestUser, q: ListUsersQuery) {
    const filters: Prisma.UserWhereInput[] = [];

    // Only a super admin gets to see other super admins.
    if (actor.role !== 'SUPER_ADMIN') filters.push({ role: { not: 'SUPER_ADMIN' } });
    if (q.role) filters.push({ role: q.role });
    if (q.isActive !== undefined) filters.push({ isActive: q.isActive });
    if (q.search) {
      filters.push({
        OR: [
          { email: { contains: q.search, mode: 'insensitive' } },
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.UserWhereInput = { AND: filters };

    const [total, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }],
        ...skipTake(q.page, q.pageSize),
      }),
    ]);
    return toPage(rows.map(toDto), total, q.page, q.pageSize);
  },

  async create(actor: RequestUser, input: CreateUserInput, ip?: string) {
    if (!canManageRole(actor.role, input.role)) throw forbidden('You cannot create a user with that role');
    assertInvitationDeliveryAvailable();

    const token = randomBytes(32).toString('base64url');
    const user = await prisma.user.create({
      data: {
        ...input,
        passwordHash: null,
        passwordSetupToken: {
          create: { tokenHash: tokenHash(token), expiresAt: invitationExpiry() },
        },
      },
    });
    await audit({ userId: actor.id, action: 'user.create', entity: 'User', entityId: user.id, ip,
      meta: { role: user.role } });
    const invitation = await deliverInvitation(user.email, `${user.firstName} ${user.lastName}`, token);
    return { user: toDto(user), ...invitation };
  },

  async resendInvitation(actor: RequestUser, id: string, ip?: string) {
    assertInvitationDeliveryAvailable();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || (user.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN')) throw notFound('User');
    if (!canManageRole(actor.role, user.role)) throw forbidden('You cannot change this user');
    if (user.passwordHash !== null) throw conflict('This user has already set a password');

    const token = randomBytes(32).toString('base64url');
    await prisma.passwordSetupToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash: tokenHash(token), expiresAt: invitationExpiry() },
      update: { tokenHash: tokenHash(token), expiresAt: invitationExpiry(), createdAt: new Date() },
    });

    const invitation = await deliverInvitation(user.email, `${user.firstName} ${user.lastName}`, token);
    await audit({
      userId: actor.id,
      action: 'user.invitation_resent',
      entity: 'User',
      entityId: user.id,
      ip,
    });
    return { user: toDto(user), ...invitation };
  },

  async update(actor: RequestUser, id: string, input: UpdateUserInput, ip?: string) {
    const target = await prisma.user.findUnique({ where: { id } });
    // Pretend hidden accounts don't exist rather than admitting they do
    if (!target || (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN')) throw notFound('User');

    if (!canManageRole(actor.role, target.role)) throw forbidden('You cannot change this user');
    if (input.role && !canManageRole(actor.role, input.role)) throw forbidden('You cannot assign that role');
    if (id === actor.id && (input.role || input.isActive === false)) {
      throw forbidden('You cannot change your own role or deactivate yourself');
    }

    const { password, ...rest } = input;
    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const needsSignOut = input.isActive === false || !!password || (!!input.role && input.role !== target.role);

    const [user] = await prisma.$transaction([
      prisma.user.update({ where: { id }, data }),
      ...(password
        ? [prisma.passwordSetupToken.deleteMany({ where: { userId: id } })]
        : []),
      // Deactivated, re-roled or re-passworded users must log in again.
      ...(needsSignOut
        ? [prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })]
        : []),
    ]);

    await audit({ userId: actor.id, action: 'user.update', entity: 'User', entityId: id, ip,
      meta: { fields: Object.keys(input).filter((k) => k !== 'password') } });
    return toDto(user);
  },
};
