import { z } from 'zod';
import { ROLES } from '@fleet-pulse/shared';
import { paginationSchema } from '../../common/utils/pagination';
import { passwordSchema } from '../../common/password';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  role: z.enum(ROLES),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    password: passwordSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
