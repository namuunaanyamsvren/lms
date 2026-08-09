import { createPrismaInbox, EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { Prisma } from '@prisma/client-billing';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { enqueueBillingEvent } from '../services/event-outbox.service';

const schema = z.object({
  organizationId: z.string().min(1),
  enrollmentId: z.string().min(1),
  cohortId: z.string().min(1),
  userId: z.string().min(1),
  courseTitle: z.string().min(1).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
}).passthrough();

export const startEnrollmentCreatedConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'billing-service.enrollment-created.v1',
    EVENTS.ENROLLMENT_CREATED,
    async raw => {
      const event = schema.parse(raw);
      const amount = new Prisma.Decimal(event.amount || 0);
      if (amount.lte(0)) return;

      await prisma.$transaction(async tx => {
        const existing = await tx.invoice.findFirst({
          where: { organizationId: event.organizationId, enrollmentId: event.enrollmentId },
        });
        if (existing) return;

        const subscription = await tx.subscription.upsert({
          where: { organizationId: event.organizationId },
          create: {
            organizationId: event.organizationId,
            plan: 'FREE',
            amount: new Prisma.Decimal(0),
            currency: event.currency || 'MNT',
            billingCycle: 'monthly',
            nextBillingAt: new Date(Date.now() + 30 * 86_400_000),
          },
          update: {},
        });
        const invoice = await tx.invoice.create({
          data: {
            organizationId: event.organizationId,
            subscriptionId: subscription.id,
            studentId: event.userId,
            cohortId: event.cohortId,
            enrollmentId: event.enrollmentId,
            amount,
            currency: event.currency || 'MNT',
            description: `${event.courseTitle || 'Сургалт'} ангийн төлбөр`,
            dueDate: new Date(Date.now() + 7 * 86_400_000),
            accessRestricted: true,
          },
        });
        const payload = {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscriptionId,
          amount: invoice.amount.toFixed(4),
          currency: invoice.currency,
          status: invoice.status,
          studentId: invoice.studentId,
          cohortId: invoice.cohortId,
          enrollmentId: invoice.enrollmentId,
          dueDate: invoice.dueDate?.toISOString() || null,
          paidAt: invoice.paidAt?.toISOString() || null,
          createdAt: invoice.createdAt.toISOString(),
        };
        await enqueueBillingEvent(tx, EVENTS.INVOICE_CREATED, event.organizationId, payload);
        await enqueueBillingEvent(tx, EVENTS.INVOICE_ISSUED, event.organizationId, payload);
      });
    },
    { deadLetter: true, inbox: createPrismaInbox(prisma.eventInbox) },
  );
