import { createPrismaInbox, EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
const schema = z.object({ organizationId: z.string().min(1) }).passthrough();

export const startOrganizationCreatedConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'billing-service.organization-created',
    EVENTS.ORGANIZATION_CREATED,
    async raw => {
      const event = schema.parse(raw);
      await prisma.subscription.upsert({
        where: { organizationId: event.organizationId },
        create: {
          organizationId: event.organizationId,
          plan: 'FREE',
          amount: 0,
          billingCycle: 'monthly',
          nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {},
      });
    },
    {deadLetter:true,inbox:createPrismaInbox(prisma.eventInbox)},
  );
