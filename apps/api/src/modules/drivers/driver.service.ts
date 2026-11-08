import { Prisma } from '@prisma/client';
import { DriverDto } from '@fleet-pulse/shared';
import { prisma } from '../../common/prisma';
import { audit } from '../../common/audit';
import { RequestUser } from '../../common/types';
import { badRequest, conflict, notFound } from '../../common/errors';
import { skipTake, toPage } from '../../common/utils/pagination';
import { addDays } from '../../common/utils/dates';
import { CreateDriverInput, ListDriversQuery, UpdateDriverInput } from './driver.schema';

// Every driver response also carries the vehicle they currently have (if any).
const withCurrentVehicle = {
  assignments: {
    where: { unassignedAt: null },
    take: 1,
    select: { vehicle: { select: { id: true, plateNumber: true, make: true, model: true } } },
  },
} satisfies Prisma.DriverInclude;

type DriverRow = Prisma.DriverGetPayload<{ include: typeof withCurrentVehicle }>;

const toDto = (d: DriverRow): DriverDto => ({
  id: d.id,
  firstName: d.firstName,
  lastName: d.lastName,
  email: d.email,
  phone: d.phone,
  licenseNumber: d.licenseNumber,
  licenseClass: d.licenseClass,
  licenseExpiry: d.licenseExpiry.toISOString(),
  status: d.status,
  hireDate: d.hireDate.toISOString(),
  currentVehicle: d.assignments[0]?.vehicle ?? null,
});

async function assertLoginAccountIsFree(userId: string, ignoreDriverId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { driverProfile: true } });
  if (!user) throw notFound('User');
  if (user.role !== 'DRIVER') throw badRequest('That user does not have the DRIVER role');
  if (user.driverProfile && user.driverProfile.id !== ignoreDriverId) {
    throw conflict('That user is already linked to another driver');
  }
}

// Convenience: if a DRIVER login with the same email exists and is still unlinked, link it.
async function findLinkableLogin(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { driverProfile: true } });
  return user && user.role === 'DRIVER' && !user.driverProfile ? user.id : undefined;
}

export const driverService = {
  async list(q: ListDriversQuery) {
    const filters: Prisma.DriverWhereInput[] = [];

    if (q.status) filters.push({ status: q.status });
    if (q.licenseExpiringInDays) {
      filters.push({ licenseExpiry: { lte: addDays(new Date(), q.licenseExpiringInDays) } });
    }
    if (q.hasVehicle !== undefined) {
      filters.push({
        assignments: q.hasVehicle ? { some: { unassignedAt: null } } : { none: { unassignedAt: null } },
      });
    }
    if (q.search) {
      filters.push({
        OR: [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
          { licenseNumber: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.DriverWhereInput = { AND: filters };

    // sortBy is a zod enum, so it's safe to use as a key here.
    const orderBy: Prisma.DriverOrderByWithRelationInput[] = [
      { [q.sortBy]: q.sortDir } as Prisma.DriverOrderByWithRelationInput,
      { id: 'asc' },
    ];

    const [total, rows] = await prisma.$transaction([
      prisma.driver.count({ where }),
      prisma.driver.findMany({ where, orderBy, include: withCurrentVehicle, ...skipTake(q.page, q.pageSize) }),
    ]);
    return toPage(rows.map(toDto), total, q.page, q.pageSize);
  },

  async getById(id: string) {
    const row = await prisma.driver.findUnique({ where: { id }, include: withCurrentVehicle });
    if (!row) throw notFound('Driver');
    return toDto(row);
  },

  // For the DRIVER role: only ever returns the caller's own record.
  async getMine(actor: RequestUser) {
    const row = await prisma.driver.findUnique({ where: { userId: actor.id }, include: withCurrentVehicle });
    if (!row) throw notFound('Driver profile');
    return toDto(row);
  },

  async create(actor: RequestUser, input: CreateDriverInput, ip?: string) {
    if (input.userId) await assertLoginAccountIsFree(input.userId);
    const userId = input.userId ?? (await findLinkableLogin(input.email));
    const row = await prisma.driver.create({ data: { ...input, userId }, include: withCurrentVehicle });
    await audit({ userId: actor.id, action: 'driver.create', entity: 'Driver', entityId: row.id, ip });
    return toDto(row);
  },

  async update(actor: RequestUser, id: string, input: UpdateDriverInput, ip?: string) {
    if (input.userId) await assertLoginAccountIsFree(input.userId, id);
    const row = await prisma.driver.update({ where: { id }, data: input, include: withCurrentVehicle });
    await audit({ userId: actor.id, action: 'driver.update', entity: 'Driver', entityId: id, ip,
      meta: { fields: Object.keys(input) } });
    return toDto(row);
  },

  async remove(actor: RequestUser, id: string, ip?: string) {
    const history = await prisma.vehicleAssignment.count({ where: { driverId: id } });
    if (history > 0) {
      throw conflict('This driver has assignment history. Set them to Suspended instead of deleting.');
    }
    await prisma.driver.delete({ where: { id } });
    await audit({ userId: actor.id, action: 'driver.delete', entity: 'Driver', entityId: id, ip });
  },
};
