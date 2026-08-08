import { createPrismaInbox, EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { Role } from '@prisma/client-academic';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
const payloadSchema = z
  .object({
    userId: z.string().min(1),
    organizationId: z.string().min(1),
    email: z.string().email(),
    username: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    role: z.nativeEnum(Role),
    isActive: z.boolean(),
    studentId: z.string().nullable().optional(),
    employeeId: z.string().nullable().optional(),
    guardianLinkCode: z.string().nullable().optional(),
  })
  .passthrough();

const syncUser = async (raw: unknown) => {
  const event = payloadSchema.parse(raw);
  await prisma.user.upsert({
    where: { id: event.userId },
    create: {
      id: event.userId,
      organizationId: event.organizationId,
      email: event.email,
      username: event.username,
      phone: event.phone,
      firstName: event.firstName || '',
      lastName: event.lastName || '',
      role: event.role,
      isActive: event.isActive,
      studentId: event.studentId,
      employeeId: event.employeeId,
      guardianLinkCode: event.guardianLinkCode,
      deletedAt: null,
    },
    update: {
      email: event.email,
      username: event.username,
      phone: event.phone,
      firstName: event.firstName || '',
      lastName: event.lastName || '',
      role: event.role,
      isActive: event.isActive,
      studentId: event.studentId,
      employeeId: event.employeeId,
      guardianLinkCode: event.guardianLinkCode,
      deletedAt: null,
    },
  });
};

const anonymizedPayloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
}).passthrough();

const anonymizeUser = async (raw: unknown) => {
  const event = anonymizedPayloadSchema.parse(raw);
  await prisma.user.updateMany({
    where: { id: event.userId, organizationId: event.organizationId },
    data: {
      email: `deleted+${event.userId}@invalid.local`,
      username: null,
      phone: null,
      firstName: 'Deleted',
      lastName: 'User',
      passwordHash: null,
      isActive: false,
      deletedAt: new Date(),
    },
  });
};

export const startUserLifecycleConsumers = async () => {
  const inbox = createPrismaInbox(prisma.eventInbox);
  await Promise.all([
    subscribeToEvent(
      EVENT_EXCHANGE,
      'academic-service.user-updated',
      EVENTS.USER_UPDATED,
      syncUser,
      { deadLetter: true, inbox }
    ),
    subscribeToEvent(
      EVENT_EXCHANGE,
      'academic-service.user-deactivated',
      EVENTS.USER_DEACTIVATED,
      syncUser,
      { deadLetter: true, inbox }
    ),
    subscribeToEvent(
      EVENT_EXCHANGE,
      'academic-service.user-anonymized',
      EVENTS.USER_ANONYMIZED,
      anonymizeUser,
      { deadLetter: true, inbox },
    ),
  ]);
};
