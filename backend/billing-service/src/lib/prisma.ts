import { PrismaClient } from '@prisma/client-billing';
import { attachPrismaSlowQueryLogger } from '@lms/shared';

// Single shared client for the whole service. Every controller/service
// imports this instead of instantiating its own PrismaClient — each
// instance opens its own connection pool, so multiplying them per-file
// was silently multiplying the service's total DB connections.
export const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
attachPrismaSlowQueryLogger(prisma, 'billing-service');
