import 'dotenv/config';
import { z } from 'zod';

// We validate the environment once at startup so a missing secret crashes the
// server immediately instead of failing weirdly on the first login.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  WEB_APP_URL: z.string().url().default('http://localhost:4200'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
});

const parsed = schema.superRefine((value, ctx) => {
  const mailSettings = [value.SMTP_HOST, value.SMTP_USER, value.SMTP_PASSWORD, value.SMTP_FROM];
  if (mailSettings.some(Boolean) && mailSettings.some((setting) => !setting)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM must be configured together',
      path: ['SMTP_HOST'],
    });
  }
}).safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
