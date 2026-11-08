import { z } from 'zod';
import { FUEL_TYPES, VEHICLE_STATUSES, VEHICLE_TYPES } from '@fleet-pulse/shared';
import { paginationSchema } from '../../common/utils/pagination';

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  plateNumber: z.string().trim().toUpperCase().min(4).max(15),
  vin: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{11,17}$/, 'VIN must be 11 to 17 letters or digits'),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  year: z.coerce.number().int().min(1990).max(currentYear + 1),
  type: z.enum(VEHICLE_TYPES),
  fuelType: z.enum(FUEL_TYPES),
  odometerKm: z.coerce.number().int().min(0).max(5_000_000).default(0),
  insuranceExpiry: z.coerce.date(),
  // IN_USE can only be reached by assigning a driver, never by hand.
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED']).default('AVAILABLE'),
});

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listVehiclesSchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  unassigned: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  insuranceExpiringInDays: z.coerce.number().int().min(1).max(365).optional(),
  sortBy: z.enum(['plateNumber', 'make', 'year', 'odometerKm', 'insuranceExpiry']).default('plateNumber'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const assignSchema = z.object({
  driverId: z.string().uuid(),
  notes: z.string().trim().max(300).optional(),
});

export const unassignSchema = z.object({
  // Optional odometer reading when the vehicle comes back
  odometerKm: z.coerce.number().int().min(0).max(5_000_000).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type UnassignInput = z.infer<typeof unassignSchema>;
