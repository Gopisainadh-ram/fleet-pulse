import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';

interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}

// Writes an audit row. A failed audit write is logged but never breaks the request.
export async function audit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    logger.error({ err, entry }, 'could not write audit log');
  }
}
