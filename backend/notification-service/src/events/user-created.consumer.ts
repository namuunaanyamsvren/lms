import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox, notificationPrisma } from '../services/notification.service';

const payloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.string().min(1).optional(),
  occurredAt: z.string().datetime(),
}).passthrough();

export const startUserCreatedConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.user-created.v2',
    EVENTS.USER_CREATED,
    async raw => {
      const event = payloadSchema.parse(raw);
      await notificationPrisma.notificationRecipient.upsert({
        where:{organizationId_userId:{organizationId:event.organizationId,userId:event.userId}},
        create:{organizationId:event.organizationId,userId:event.userId,email:event.email,phone:event.phone,firstName:event.firstName,role:event.role},
        update:{email:event.email,phone:event.phone,firstName:event.firstName,role:event.role},
      });
      await deliverNotification({
        organizationId: event.organizationId,
        userId: event.userId,
        eventType:'WELCOME',idempotencyKey:`welcome:${event.userId}`,title:'LMS-д тавтай морил',
        body:`${event.firstName || 'Хэрэглэгч'} таны бүртгэл амжилттай үүслээ.`,channels:['IN_APP','EMAIL'],recipientEmail:event.email,
        variables:{firstName:event.firstName||'Хэрэглэгч'},
      });
      if (event.role === 'USER') {
        const managers = await notificationPrisma.notificationRecipient.findMany({
          where: { organizationId: event.organizationId, role: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] } },
          select: { userId: true, email: true },
        });
        await Promise.all(managers.map(manager => deliverNotification({
          organizationId: event.organizationId,
          userId: manager.userId,
          eventType: 'USER_PENDING_ACCESS',
          idempotencyKey: `user-pending-access:${event.userId}:${manager.userId}`,
          title: 'Шинэ хэрэглэгч бүртгэгдлээ',
          body: `${event.lastName || ''} ${event.firstName || ''}`.trim() || event.email,
          channels: ['IN_APP'],
          recipientEmail: manager.email || undefined,
          variables: { userId: event.userId, email: event.email, role: event.role || 'USER' },
        })));
      }
    },
    { deadLetter: true, inbox: notificationInbox },
  );
