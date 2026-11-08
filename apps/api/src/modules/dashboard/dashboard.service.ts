import { DashboardSummary, VehicleStatus, VehicleType } from '@fleet-pulse/shared';
import { prisma } from '../../common/prisma';
import { addDays, daysUntil } from '../../common/utils/dates';

const WARNING_WINDOW_DAYS = 30;

export const dashboardService = {
  /**
   * One round trip to the database per widget, all fired in parallel.
   * The queries are deliberately kept separate and small so each one can use its own index.
   */
  async summary(): Promise<DashboardSummary> {
    const now = new Date();
    const warnBefore = addDays(now, WARNING_WINDOW_DAYS);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [byStatus, byType, activeDrivers, licences, insurance, busiest, monthly] = await Promise.all([
      prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true } }),

      prisma.vehicle.groupBy({
        by: ['type'],
        where: { status: { not: 'RETIRED' } },
        _count: { _all: true },
        _avg: { odometerKm: true },
        orderBy: { _count: { type: 'desc' } },
      }),

      prisma.driver.count({ where: { status: 'ACTIVE' } }),

      // Licences that are expired or about to be. Suspended drivers aren't worth nagging about.
      prisma.driver.findMany({
        where: { status: { not: 'SUSPENDED' }, licenseExpiry: { lte: warnBefore } },
        orderBy: { licenseExpiry: 'asc' },
        take: 6,
        select: { id: true, firstName: true, lastName: true, licenseExpiry: true },
      }),

      prisma.vehicle.findMany({
        where: { status: { not: 'RETIRED' }, insuranceExpiry: { lte: warnBefore } },
        orderBy: { insuranceExpiry: 'asc' },
        take: 6,
        select: { id: true, plateNumber: true, insuranceExpiry: true },
      }),

      // Drivers with the most assignments in the last six months
      prisma.vehicleAssignment.groupBy({
        by: ['driverId'],
        where: { assignedAt: { gte: sixMonthsAgo } },
        _count: { _all: true },
        orderBy: { _count: { driverId: 'desc' } },
        take: 5,
      }),

      // Prisma can't group by month, so this one is raw SQL. The date is a bound
      // parameter (tagged template), never string-concatenated.
      prisma.$queryRaw<{ month: Date; assignments: number }[]>`
        SELECT date_trunc('month', "assignedAt") AS month, COUNT(*)::int AS assignments
        FROM vehicle_assignments
        WHERE "assignedAt" >= ${sixMonthsAgo}
        GROUP BY 1
        ORDER BY 1`,
    ]);

    // groupBy can't join, so the driver names come from a second small query.
    const busiestNames = await prisma.driver.findMany({
      where: { id: { in: busiest.map((b) => b.driverId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(busiestNames.map((d) => [d.id, `${d.firstName} ${d.lastName}`]));
    const assignmentCountByMonth = new Map(
      monthly.map((m) => [m.month.toISOString().slice(0, 7), m.assignments]),
    );
    const assignmentsByMonth = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + index, 1);
      const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      return { month, assignments: assignmentCountByMonth.get(month) ?? 0 };
    });

    const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<
      Record<VehicleStatus, number>
    >;
    const inUse = counts.IN_USE ?? 0;
    const totalVehicles = byStatus.reduce((sum, s) => sum + s._count._all, 0);
    const fleetInService = totalVehicles - (counts.RETIRED ?? 0);

    return {
      totals: {
        vehicles: totalVehicles,
        activeDrivers,
        inUse,
        utilisationPct: fleetInService ? Math.round((inUse / fleetInService) * 100) : 0,
      },
      vehiclesByStatus: byStatus.map((s) => ({ status: s.status as VehicleStatus, count: s._count._all })),
      vehiclesByType: byType.map((t) => ({
        type: t.type as VehicleType,
        count: t._count._all,
        avgOdometerKm: Math.round(t._avg.odometerKm ?? 0),
      })),
      licencesExpiring: licences.map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        licenseExpiry: d.licenseExpiry.toISOString(),
        daysLeft: daysUntil(d.licenseExpiry, now),
      })),
      insuranceExpiring: insurance.map((v) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        insuranceExpiry: v.insuranceExpiry.toISOString(),
        daysLeft: daysUntil(v.insuranceExpiry, now),
      })),
      busiestDrivers: busiest.map((b) => ({
        id: b.driverId,
        name: nameOf.get(b.driverId) ?? 'Unknown',
        assignments: b._count._all,
      })),
      assignmentsByMonth,
    };
  },
};
