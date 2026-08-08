import { PrismaClient } from '@prisma/client-organization';
import { attachPrismaSlowQueryLogger } from '@lms/shared';

export const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
attachPrismaSlowQueryLogger(prisma, 'organization-service');
