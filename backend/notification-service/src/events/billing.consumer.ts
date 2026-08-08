import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const invoiceEventSchema = z.object({
  organizationId: z.string().min(1),
  invoiceId: z.string().min(1),
  studentId: z.string().min(1).nullable().optional(),
  enrollmentId: z.string().min(1).nullable().optional(),
  amount: z.string().min(1),
  currency: z.string().min(3).max(3),
  status: z.string().min(1),
  reminder: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
}).passthrough();

const paymentEventSchema = invoiceEventSchema.extend({
  paymentId: z.string().min(1).optional(),
  transactionId: z.string().min(1).optional(),
}).passthrough();

export async function deliverInvoiceNotification(raw: unknown) {
  const event = invoiceEventSchema.parse(raw);
  if (!event.studentId) return;
  await deliverNotification({
    organizationId: event.organizationId,
    userId: event.studentId,
    eventType: event.reminder ? 'BILLING_PAYMENT_REMINDER' : 'BILLING_INVOICE_ISSUED',
    idempotencyKey: `${event.reminder ? 'billing-reminder' : 'billing-invoice'}:${event.invoiceId}:${event.reminder ? new Date().toISOString().slice(0, 10) : 'issued'}`,
    title: event.reminder ? 'Төлбөрийн сануулга' : 'Шинэ нэхэмжлэх',
    body: event.reminder
      ? `Таны ${event.amount} ${event.currency} төлбөр хүлээгдэж байна.`
      : `Танд ${event.amount} ${event.currency} нэхэмжлэх үүслээ.`,
    channels: ['IN_APP', 'EMAIL'],
    digestEligible: false,
    metadata: {
      invoiceId: event.invoiceId,
      enrollmentId: event.enrollmentId || null,
      amount: event.amount,
      currency: event.currency,
      dueDate: event.dueDate || null,
      actionUrl: '/student/payments',
      targetType: 'payment',
      targetId: event.invoiceId,
    },
  });
}

export async function deliverPaymentNotification(kind: 'succeeded' | 'failed' | 'refunded', raw: unknown) {
  const event = paymentEventSchema.parse(raw);
  if (!event.studentId) return;
  const title = kind === 'succeeded' ? 'Төлбөр амжилттай' : kind === 'failed' ? 'Төлбөр амжилтгүй' : 'Төлбөр буцаагдлаа';
  const body = `${event.amount} ${event.currency} төлбөрийн төлөв: ${event.status}.`;
  await deliverNotification({
    organizationId: event.organizationId,
    userId: event.studentId,
    eventType: `BILLING_PAYMENT_${kind.toUpperCase()}`,
    idempotencyKey: `billing-payment-${kind}:${event.invoiceId}:${event.paymentId || event.transactionId || event.status}`,
    title,
    body,
    channels: ['IN_APP', 'EMAIL'],
    digestEligible: false,
    metadata: {
      invoiceId: event.invoiceId,
      paymentId: event.paymentId || null,
      transactionId: event.transactionId || null,
      actionUrl: '/student/payments',
      targetType: 'payment',
      targetId: event.invoiceId,
    },
  });
}

export const startBillingConsumers = () => Promise.all([
  subscribeToEvent(EVENT_EXCHANGE, 'notification-service.billing-invoice-issued.v1', EVENTS.INVOICE_ISSUED, deliverInvoiceNotification, { deadLetter: true, inbox: notificationInbox }),
  subscribeToEvent(EVENT_EXCHANGE, 'notification-service.billing-payment-succeeded.v1', EVENTS.PAYMENT_SUCCEEDED, raw => deliverPaymentNotification('succeeded', raw), { deadLetter: true, inbox: notificationInbox }),
  subscribeToEvent(EVENT_EXCHANGE, 'notification-service.billing-payment-failed.v1', EVENTS.PAYMENT_FAILED, raw => deliverPaymentNotification('failed', raw), { deadLetter: true, inbox: notificationInbox }),
  subscribeToEvent(EVENT_EXCHANGE, 'notification-service.billing-payment-refunded.v1', EVENTS.PAYMENT_REFUNDED, raw => deliverPaymentNotification('refunded', raw), { deadLetter: true, inbox: notificationInbox }),
]);
