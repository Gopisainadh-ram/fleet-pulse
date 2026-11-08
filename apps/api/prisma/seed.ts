// Bootstrap the initial super-admin account. This script does not add demo data.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { z } from 'zod';
import { passwordSchema } from '../src/common/password';

const prisma = new PrismaClient();

const bootstrapConfigSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  resetPassword: z.enum(['true', 'false']).default('false'),
});

async function main() {
  const config = bootstrapConfigSchema.parse({
    email: process.env.SUPER_ADMIN_EMAIL,
    firstName: process.env.SUPER_ADMIN_FIRST_NAME,
    lastName: process.env.SUPER_ADMIN_LAST_NAME,
    resetPassword: process.env.SUPER_ADMIN_RESET_PASSWORD,
  });
  const { email, firstName, lastName } = config;
  const resetPassword = config.resetPassword === 'true';
  const password = process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'SUPER_ADMIN') {
    throw new Error('The configured super-admin email is already used by a non-super-admin account.');
  }

  if (!existing || resetPassword || existing.passwordHash === null) {
    if (!password) {
      throw new Error('Set SUPER_ADMIN_BOOTSTRAP_PASSWORD before creating or resetting the super-admin password.');
    }
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      throw new Error(
        'SUPER_ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters with upper case, lower case and a number.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: existing.id },
          data: { firstName, lastName, passwordHash },
        }),
        prisma.refreshToken.updateMany({
          where: { userId: existing.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      console.log('Super-admin profile and password updated.');
    } else {
      await prisma.user.create({
        data: { email, firstName, lastName, role: 'SUPER_ADMIN', passwordHash },
      });
      console.log('Super-admin account created.');
    }
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { firstName, lastName },
    });
    console.log('Super-admin profile updated; existing password was preserved.');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
