import { EVENT_EXCHANGE, EVENTS, publishEvent } from '@lms/shared';
import { randomUUID } from 'crypto';

interface SecurityNotificationUser {
  id: string;
  organizationId: string;
}

export const publishLoginSecurityNotification = async (
  user: SecurityNotificationUser,
  type: 'SUSPICIOUS_ATTEMPTS' | 'ACCOUNT_LOCKED'
) => {
  const locked = type === 'ACCOUNT_LOCKED';
  await publishEvent(EVENT_EXCHANGE, EVENTS.NOTIFICATION_SEND, {
    organizationId: user.organizationId,
    userId: user.id,
    title: locked ? 'Нэвтрэх эрх түр түгжигдлээ' : 'Сэжигтэй нэвтрэх оролдлого',
    body: locked
      ? 'Олон удаагийн амжилтгүй оролдлогын улмаас нэвтрэх эрх түр хугацаанд түгжигдлээ.'
      : 'Таны бүртгэлд хэд хэдэн амжилтгүй нэвтрэх оролдлого бүртгэгдлээ.',
    type: 'IN_APP',
    idempotencyKey: `security:${type.toLowerCase()}:${user.id}:${randomUUID()}`,
  });
};

export const publishPasswordResetSecurityNotification = async (user: SecurityNotificationUser) => {
  await publishEvent(EVENT_EXCHANGE, EVENTS.NOTIFICATION_SEND, {
    organizationId: user.organizationId,
    userId: user.id,
    title: 'Нууц үг шинэчлэгдлээ',
    body: 'Таны нууц үг сэргээх урсгалаар шинэчлэгдэж, бүх идэвхтэй session хаагдлаа.',
    type: 'IN_APP',
    idempotencyKey: `security:password-reset:${user.id}:${randomUUID()}`,
  });
};
