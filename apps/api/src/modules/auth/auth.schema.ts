import { z } from 'zod';
import { passwordSchema } from '../../common/password';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // We only check the length here. Strength rules apply when a password is created, not on login.
  password: z.string().min(1).max(128),
});

export const setPasswordSchema = z.object({
  token: z.string().min(32).max(100),
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
