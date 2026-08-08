import { Prisma, PrismaClient } from '@prisma/client-academic';
import { prisma } from '../lib/prisma';

export type AuditLogInput = {
  organizationId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
};

export const recordAuditLog = (client: Prisma.TransactionClient | PrismaClient, input: AuditLogInput) =>
  client.auditLog.create({ data: input });

export { prisma as auditPrisma };
