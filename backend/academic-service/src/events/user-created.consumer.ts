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
    isActive: z.boolean().optional().default(true),
    studentId: z.string().nullable().optional(),
    employeeId: z.string().nullable().optional(),
    guardianLinkCode: z.string().nullable().optional(),
  })
  .passthrough();

export const startUserCreatedConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'academic-service.user-created',
    EVENTS.USER_CREATED,
    async (raw) => {
      const event = payloadSchema.parse(raw);
      await prisma.user.upsert({
        where: {
          organizationId_email: {
            organizationId: event.organizationId,
            email: event.email,
          },
        },
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
        },
        update: {
          username: event.username,
          phone: event.phone,
          firstName: event.firstName || '',
          lastName: event.lastName || '',
          role: event.role,
          isActive: event.isActive,
          studentId: event.studentId,
          employeeId: event.employeeId,
          guardianLinkCode: event.guardianLinkCode,
        },
      });
    },
    { deadLetter: true, inbox: createPrismaInbox(prisma.eventInbox) }
  );
