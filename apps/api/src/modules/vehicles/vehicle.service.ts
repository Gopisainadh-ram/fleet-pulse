import { Prisma } from '@prisma/client';
import { AssignmentDto, VehicleDto } from '@fleet-pulse/shared';
import { prisma } from '../../common/prisma';
import { audit } from '../../common/audit';
import { RequestUser } from '../../common/types';
import { conflict, notFound } from '../../common/errors';
import { skipTake, toPage } from '../../common/utils/pagination';
import { addDays } from '../../common/utils/dates';
import {
  AssignInput,
  CreateVehicleInput,
  ListVehiclesQuery,
  UnassignInput,
  UpdateVehicleInput,
} from './vehicle.schema';

const withCurrentDriver = {
  assignments: {
    where: { unassignedAt: null },
    take: 1,
    select: { driver: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.VehicleInclude;

type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof withCurrentDriver }>;

const toDto = (v: VehicleRow): VehicleDto => ({
  id: v.id,
  plateNumber: v.plateNumber,
  vin: v.vin,
  make: v.make,
  model: v.model,
  year: v.year,
  type: v.type,
  fuelType: v.fuelType,
  status: v.status,
  odometerKm: v.odometerKm,
  insuranceExpiry: v.insuranceExpiry.toISOString(),
  currentDriver: v.assignments[0]?.driver ?? null,
});

export const vehicleService = {
  async list(q: ListVehiclesQuery) {
    const filters: Prisma.VehicleWhereInput[] = [];

    if (q.status) filters.push({ status: q.status });
    if (q.type) filters.push({ type: q.type });
    if (q.unassigned) filters.push({ assignments: { none: { unassignedAt: null } } });
    if (q.insuranceExpiringInDays) {
      filters.push({ insuranceExpiry: { lte: addDays(new Date(), q.insuranceExpiringInDays) } });
    }
    if (q.search) {
      filters.push({
        OR: [
          { plateNumber: { contains: q.search, mode: 'insensitive' } },
          { vin: { contains: q.search, mode: 'insensitive' } },
          { make: { contains: q.search, mode: 'insensitive' } },
          { model: { contains: q.search, mode: 'insensitive' } },
          // also match on whoever is driving it right now
          {
            assignments: {
              some: {
                unassignedAt: null,
                driver: {
                  OR: [
                    { firstName: { contains: q.search, mode: 'insensitive' } },
                    { lastName: { contains: q.search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
    const where: Prisma.VehicleWhereInput = { AND: filters };
    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [
      { [q.sortBy]: q.sortDir } as Prisma.VehicleOrderByWithRelationInput,
      { id: 'asc' },
    ];

    const [total, rows] = await prisma.$transaction([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({ where, orderBy, include: withCurrentDriver, ...skipTake(q.page, q.pageSize) }),
    ]);
    return toPage(rows.map(toDto), total, q.page, q.pageSize);
  },

  async getById(id: string) {
    const row = await prisma.vehicle.findUnique({ where: { id }, include: withCurrentDriver });
    if (!row) throw notFound('Vehicle');
    return toDto(row);
  },

  async history(id: string): Promise<AssignmentDto[]> {
    const rows = await prisma.vehicleAssignment.findMany({
      where: { vehicleId: id },
      orderBy: { assignedAt: 'desc' },
      take: 50,
      include: { driver: { select: { id: true, firstName: true, lastName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      assignedAt: r.assignedAt.toISOString(),
      unassignedAt: r.unassignedAt?.toISOString() ?? null,
      notes: r.notes,
      driver: r.driver,
    }));
  },

  // The vehicle the signed-in DRIVER has right now (or null).
  async getMine(actor: RequestUser) {
    const row = await prisma.vehicle.findFirst({
      where: { assignments: { some: { unassignedAt: null, driver: { userId: actor.id } } } },
      include: withCurrentDriver,
    });
    return row ? toDto(row) : null;
  },

  async create(actor: RequestUser, input: CreateVehicleInput, ip?: string) {
    const row = await prisma.vehicle.create({ data: input, include: withCurrentDriver });
    await audit({ userId: actor.id, action: 'vehicle.create', entity: 'Vehicle', entityId: row.id, ip });
    return toDto(row);
  },

  async update(actor: RequestUser, id: string, input: UpdateVehicleInput, ip?: string) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) throw notFound('Vehicle');
    if (input.status && existing.status === 'IN_USE') {
      throw conflict('Unassign the driver before changing the status of a vehicle in use');
    }
    // Odometers don't run backwards
    if (input.odometerKm !== undefined && input.odometerKm < existing.odometerKm) {
      throw conflict('Odometer cannot be lower than the last recorded reading');
    }
    const row = await prisma.vehicle.update({ where: { id }, data: input, include: withCurrentDriver });
    await audit({ userId: actor.id, action: 'vehicle.update', entity: 'Vehicle', entityId: id, ip,
      meta: { fields: Object.keys(input) } });
    return toDto(row);
  },

  async remove(actor: RequestUser, id: string, ip?: string) {
    const history = await prisma.vehicleAssignment.count({ where: { vehicleId: id } });
    if (history > 0) throw conflict('This vehicle has assignment history. Mark it Retired instead of deleting.');
    await prisma.vehicle.delete({ where: { id } });
    await audit({ userId: actor.id, action: 'vehicle.delete', entity: 'Vehicle', entityId: id, ip });
  },

  /**
   * Hand a vehicle to a driver. All the checks and both writes happen in one
   * Serializable transaction, so two managers clicking "assign" at the same time
   * can't give one vehicle to two drivers (or one driver two vehicles).
   */
  async assign(actor: RequestUser, vehicleId: string, input: AssignInput, ip?: string) {
    const assignment = await prisma.$transaction(
      async (tx) => {
        const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle) throw notFound('Vehicle');
        if (vehicle.status !== 'AVAILABLE') {
          throw conflict(`This vehicle is ${vehicle.status.toLowerCase().replace('_', ' ')} and cannot be assigned`);
        }

        const driver = await tx.driver.findUnique({ where: { id: input.driverId } });
        if (!driver) throw notFound('Driver');
        if (driver.status !== 'ACTIVE') throw conflict('Only active drivers can be assigned a vehicle');
        if (driver.licenseExpiry < new Date()) throw conflict("This driver's licence has expired");

        const alreadyDriving = await tx.vehicleAssignment.findFirst({
          where: { driverId: driver.id, unassignedAt: null },
        });
        if (alreadyDriving) throw conflict('This driver already has a vehicle');

        const created = await tx.vehicleAssignment.create({
          data: { vehicleId, driverId: driver.id, assignedById: actor.id, notes: input.notes },
        });
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'IN_USE' } });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await audit({ userId: actor.id, action: 'vehicle.assign', entity: 'Vehicle', entityId: vehicleId, ip,
      meta: { driverId: input.driverId } });
    return assignment;
  },

  async unassign(actor: RequestUser, vehicleId: string, input: UnassignInput, ip?: string) {
    await prisma.$transaction(
      async (tx) => {
        const open = await tx.vehicleAssignment.findFirst({ where: { vehicleId, unassignedAt: null } });
        if (!open) throw conflict('This vehicle is not assigned to anyone');

        const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
        if (input.odometerKm !== undefined && input.odometerKm < vehicle.odometerKm) {
          throw conflict('Odometer cannot be lower than the last recorded reading');
        }

        await tx.vehicleAssignment.update({ where: { id: open.id }, data: { unassignedAt: new Date() } });
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: 'AVAILABLE', ...(input.odometerKm !== undefined && { odometerKm: input.odometerKm }) },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await audit({ userId: actor.id, action: 'vehicle.unassign', entity: 'Vehicle', entityId: vehicleId, ip });
  },
};
