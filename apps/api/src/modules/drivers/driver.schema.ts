import { z } from 'zod';
import { DRIVER_STATUSES } from '@fleet-pulse/shared';
import { paginationSchema } from '../../common/utils/pagination';

const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number');

export const createDriverSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  licenseNumber: z.string().trim().toUpperCase().min(5).max(30),
  licenseClass: z.string().trim().min(1).max(10),
  licenseExpiry: z.coerce.date(),
  hireDate: z.coerce.date(),
  status: z.enum(DRIVER_STATUSES).default('ACTIVE'),
  // Link to a login account that already has the DRIVER role
  userId: z.string().uuid().optional(),
});

export const updateDriverSchema = createDriverSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listDriversSchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z.enum(DRIVER_STATUSES).optional(),
  // "Licence runs out within N days" (already-expired licences are included)
  licenseExpiringInDays: z.coerce.number().int().min(1).max(365).optional(),
  hasVehicle: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sortBy: z.enum(['lastName', 'licenseExpiry', 'hireDate']).default('lastName'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type ListDriversQuery = z.infer<typeof listDriversSchema>;
