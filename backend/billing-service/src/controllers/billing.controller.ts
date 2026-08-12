import { AppError, EVENTS, getPagination, paginatedData } from '@lms/shared';
import { PaymentStatus, PlanType, Prisma } from '@prisma/client-billing';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { enqueueBillingEvent } from '../services/event-outbox.service';
import { createQPayProviderInvoice, verifyQPayWebhookSignature } from '../services/qpay-provider.service';
import {
  createStripeCheckoutSession,
  getStripeCheckoutPrice,
  verifyStripeWebhookEvent,
} from '../services/stripe-provider.service';

import { prisma } from '../lib/prisma';
const PLAN_LABELS: Record<PlanType, string> = {
  FREE: 'Free',
  BASIC: 'Basic',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};
const subscriptionSchema = z
  .object({
    plan: z.nativeEnum(PlanType),
    amount: z.number().nonnegative(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).default('MNT'),
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']),
    isActive: z.boolean().optional(),
    nextBillingAt: z.coerce.date().optional(),
  })
  .strict();
const invoiceSchema = z
  .object({
    amount: z.number().positive(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).default('MNT'),
    studentId: z.string().trim().min(1).max(200).optional(),
    cohortId: z.string().trim().min(1).max(200).optional(),
    enrollmentId: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    dueDate: z.coerce.date().optional(),
    installmentNumber: z.number().int().positive().optional(),
    installmentTotal: z.number().int().positive().optional(),
    installmentIntervalDays: z.number().int().positive().max(365).default(30),
    accessRestricted: z.boolean().optional(),
    pdfR2Url: z.string().url().optional(),
  })
  .strict()
  .refine(
    value => !value.installmentNumber || !value.installmentTotal || value.installmentNumber <= value.installmentTotal,
    { message: 'installmentNumber must be less than or equal to installmentTotal' }
  );
const paymentSchema = z
  .object({
    amount: z.number().positive().optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
    method: z.string().trim().min(2).max(50).default('MANUAL'),
    transactionId: z.string().trim().min(3).max(200).optional(),
  })
  .strict();
const qpayWebhookSchema = z.object({
  invoiceId: z.string().trim().min(1).max(200).optional(),
  invoice_id: z.string().trim().min(1).max(200).optional(),
  providerInvoiceId: z.string().trim().min(1).max(200).optional(),
  paymentId: z.string().trim().min(1).max(200).optional(),
  payment_id: z.string().trim().min(1).max(200).optional(),
  transactionId: z.string().trim().min(1).max(200).optional(),
  payment_status: z.string().trim().max(50).optional(),
  status: z.string().trim().max(50).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
}).passthrough();
const stripeCheckoutSchema = z.object({
  invoiceId: z.string().trim().min(1).max(200).optional(),
  plan: z.nativeEnum(PlanType).default(PlanType.PRO),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
}).strict();
const toJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const isInvoiceTransitionAllowed = (from: PaymentStatus, to: PaymentStatus) =>
  (from === PaymentStatus.PENDING &&
    (to === PaymentStatus.COMPLETED || to === PaymentStatus.FAILED)) ||
  (from === PaymentStatus.COMPLETED && to === PaymentStatus.REFUNDED);

export const getBillingOverview = async (req: Request, res: Response) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: req.organizationId! },
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      },
    },
  });
  return res.json({ success: true, data: subscription });
};

export const listInvoices = async (req: Request, res: Response) => {
  const pagination = getPagination(req, { defaultLimit: 20, maxLimit: 100 });
  const where: Prisma.InvoiceWhereInput = {
    organizationId: req.organizationId!,
    ...(req.query.studentId ? { studentId: String(req.query.studentId) } : {}),
    ...(req.query.enrollmentId ? { enrollmentId: String(req.query.enrollmentId) } : {}),
    ...(req.query.status ? { status: req.query.status as PaymentStatus } : {}),
    ...(req.user!.role === 'STUDENT' ? { studentId: req.user!.userId } : {}),
  };
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { payments: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.invoice.count({ where }),
  ]);
  return res.json({ success: true, data: invoices, pagination: paginatedData(invoices, total, pagination) });
};

export const listPayments = async (req: Request, res: Response) => {
  const pagination = getPagination(req, { defaultLimit: 20, maxLimit: 100 });
  const where: Prisma.PaymentWhereInput = {
    organizationId: req.organizationId!,
    ...(req.user!.role === 'STUDENT' ? { invoice: { studentId: req.user!.userId } } : {}),
  };
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { invoice: { select: { id: true, status: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.payment.count({ where }),
  ]);
  return res.json({ success: true, data: payments, pagination: paginatedData(payments, total, pagination) });
};

export const updateSubscription = async (req: Request, res: Response) => {
  const data = subscriptionSchema.parse(req.body);
  const organizationId = req.organizationId!;
  const subscription = await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...data,
        nextBillingAt: data.nextBillingAt || new Date(Date.now() + 30 * 86_400_000),
      },
      update: data,
    });
    await enqueueBillingEvent(
      tx,
      EVENTS.SUBSCRIPTION_CHANGED,
      organizationId,
      {
        subscriptionId: updated.id,
        plan: updated.plan,
        amount: updated.amount.toFixed(4),
        currency: updated.currency,
        billingCycle: updated.billingCycle,
        isActive: updated.isActive,
        nextBillingAt: updated.nextBillingAt.toISOString(),
      },
      req.headers['x-trace-id'] as string | undefined
    );
    return updated;
  });
  return res.json({ success: true, data: subscription });
};

export const issueInvoice = async (req: Request, res: Response) => {
  const data = invoiceSchema.parse(req.body);
  const organizationId = req.organizationId!;
  const invoices = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan: PlanType.FREE,
        amount: new Prisma.Decimal(0),
        currency: data.currency,
        billingCycle: 'monthly',
        nextBillingAt: new Date(Date.now() + 30 * 86_400_000),
      },
      update: {},
    });
    const total = data.installmentTotal || 1;
    const baseDueDate = data.dueDate || new Date();
    const amount = new Prisma.Decimal(data.amount);
    const baseAmount = amount.div(total).toDecimalPlaces(4);
    const rows: Prisma.InvoiceGetPayload<{}>[] = [];
    for (let index = 1; index <= total; index += 1) {
      const dueDate = data.dueDate
        ? new Date(baseDueDate.getTime() + (index - 1) * data.installmentIntervalDays * 86_400_000)
        : undefined;
      const installmentAmount = index === total
        ? amount.minus(baseAmount.mul(total - 1))
        : baseAmount;
      const created = await tx.invoice.create({
        data: {
          organizationId,
          subscriptionId: subscription.id,
          amount: installmentAmount,
          currency: data.currency,
          studentId: data.studentId,
          cohortId: data.cohortId,
          enrollmentId: data.enrollmentId,
          description: total > 1 ? `${data.description || 'Нэхэмжлэх'} (${index}/${total})` : data.description,
          dueDate,
          installmentNumber: total > 1 ? index : data.installmentNumber,
          installmentTotal: total > 1 ? total : data.installmentTotal,
          accessRestricted: data.accessRestricted,
          pdfR2Url: data.pdfR2Url,
        },
      });
      await enqueueBillingEvent(tx, EVENTS.INVOICE_ISSUED, organizationId, invoicePayload(created));
      await enqueueBillingEvent(tx, EVENTS.INVOICE_CREATED, organizationId, invoicePayload(created));
      rows.push(created);
    }
    return rows;
  });
  return res.status(201).json({ success: true, data: invoices.length === 1 ? invoices[0] : { invoices } });
};

const transitionInvoice = async (
  req: Request,
  targetStatus: PaymentStatus,
  allowedFrom: PaymentStatus[],
  eventTypes: string[]
) => {
  const organizationId = req.organizationId!;
  const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) throw AppError.notFound('Invoice not found');
  if (existing.status === targetStatus) return existing;
  if (!isInvoiceTransitionAllowed(existing.status, targetStatus)) {
    throw AppError.conflict(`Invoice cannot transition from ${existing.status} to ${targetStatus}`);
  }
  return prisma.$transaction(async (tx) => {
    const changed = await tx.invoice.updateMany({
      where: { id: existing.id, organizationId, status: { in: allowedFrom } },
      data: {
        status: targetStatus,
        paidAt: targetStatus === PaymentStatus.COMPLETED ? new Date() : existing.paidAt,
      },
    });
    if (changed.count !== 1) {
      const current = await tx.invoice.findUnique({ where: { id: existing.id } });
      if (current?.status === targetStatus) return current;
      throw AppError.conflict(
        `Invoice cannot transition from ${current?.status || existing.status} to ${targetStatus}`
      );
    }
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: existing.id } });
    for (const eventType of eventTypes) {
      await enqueueBillingEvent(tx, eventType, organizationId, invoicePayload(invoice));
    }
    return invoice;
  });
};

export const payInvoice = async (req: Request, res: Response) =>
  res.json({ success: true, data: await completeInvoicePayment(req) });

export const createQPayInvoice = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      organizationId,
      ...(req.user!.role === 'STUDENT' ? { studentId: req.user!.userId } : {}),
    },
  });
  if (!invoice) throw AppError.notFound('Invoice not found');
  if (invoice.status !== PaymentStatus.PENDING) {
    throw AppError.conflict(`Invoice cannot create QPay payment from ${invoice.status}`);
  }
  const providerInvoice = await createQPayProviderInvoice({
    invoiceId: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    description: invoice.description,
  });
  const transactionId = `qpay:${providerInvoice.providerInvoiceId}`;
  const qpayInvoiceUrl = providerInvoice.paymentUrl;
  const payment = await prisma.payment.upsert({
    where: { organizationId_transactionId: { organizationId, transactionId } },
    create: {
      organizationId,
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      method: 'QPAY',
      transactionId,
      status: PaymentStatus.PENDING,
      qpayInvoiceUrl,
      providerPayload: toJson({ provider: 'QPAY', invoiceId: invoice.id, providerInvoiceId: providerInvoice.providerInvoiceId, raw: providerInvoice.raw }),
    },
    update: { qpayInvoiceUrl, providerPayload: toJson({ provider: 'QPAY', invoiceId: invoice.id, providerInvoiceId: providerInvoice.providerInvoiceId, raw: providerInvoice.raw }) },
  });
  return res.status(201).json({ success: true, data: { invoice, payment, qpayInvoiceUrl } });
};

const frontendBaseUrl = () => {
  const explicit = process.env.FRONTEND_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const firstOrigin = (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).find(Boolean);
  return (firstOrigin || 'http://localhost:5173').replace(/\/+$/, '');
};

const redirectUrl = (candidate: string | undefined, fallbackPath: string) => {
  const fallback = `${frontendBaseUrl()}${fallbackPath}`;
  if (!candidate) return fallback;
  const allowedOrigins = new Set([
    frontendBaseUrl(),
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim().replace(/\/+$/, '')).filter(Boolean),
  ]);
  try {
    const parsed = new URL(candidate);
    const origin = `${parsed.protocol}//${parsed.host}`;
    return allowedOrigins.has(origin) ? candidate : fallback;
  } catch {
    return fallback;
  }
};

const ensureStripeCheckoutInvoice = async (
  organizationId: string,
  plan: PlanType,
) => {
  const price = await getStripeCheckoutPrice();
  const description = `LMS ${PLAN_LABELS[plan] || plan} subscription`;
  const now = new Date();
  const nextBillingAt = new Date(now.getTime() + (price.interval === 'yearly' ? 365 : 30) * 86_400_000);
  return prisma.$transaction(async tx => {
    const subscription = await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan,
        amount: price.amount,
        currency: price.currency,
        billingCycle: price.interval,
        isActive: false,
        nextBillingAt,
      },
      update: {
        plan,
        amount: price.amount,
        currency: price.currency,
        billingCycle: price.interval,
        nextBillingAt,
      },
    });
    const existing = await tx.invoice.findFirst({
      where: {
        organizationId,
        subscriptionId: subscription.id,
        status: PaymentStatus.PENDING,
        studentId: null,
        cohortId: null,
        enrollmentId: null,
        description,
      },
      orderBy: { createdAt: 'desc' },
    });
    const invoice = existing || await tx.invoice.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
        amount: price.amount,
        currency: price.currency,
        description,
        dueDate: now,
        accessRestricted: true,
      },
    });
    return { subscription, invoice, price };
  });
};

export const createStripeCheckout = async (req: Request, res: Response) => {
  const input = stripeCheckoutSchema.parse(req.body || {});
  const organizationId = req.organizationId!;
  const target = input.invoiceId
    ? {
        invoice: await prisma.invoice.findFirst({
          where: { id: input.invoiceId, organizationId, status: PaymentStatus.PENDING },
        }),
        subscription: null,
        price: null,
      }
    : await ensureStripeCheckoutInvoice(organizationId, input.plan);
  if (!target.invoice) throw AppError.notFound('Pending invoice not found');

  const session = await createStripeCheckoutSession({
    invoiceId: target.invoice.id,
    organizationId,
    userId: req.user?.userId,
    amount: target.invoice.amount,
    currency: target.invoice.currency,
    description: target.invoice.description,
    successUrl: redirectUrl(input.successUrl, '/admin/billing?billing=stripe-success'),
    cancelUrl: redirectUrl(input.cancelUrl, '/admin/billing?billing=stripe-cancelled'),
    priceId: target.price?.priceId,
    mode: target.price?.mode || 'payment',
  });
  if (!session.url) throw AppError.internal('Stripe did not return a checkout URL');
  return res.status(201).json({
    success: true,
    data: {
      url: session.url,
      sessionId: session.id,
      invoice: target.invoice,
      subscription: target.subscription,
    },
  });
};

export const handleQPayWebhook = async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body || {});
  if (!verifyQPayWebhookSignature(rawBody, req.get('x-qpay-signature') || req.get('x-signature'))) {
    throw AppError.unauthorized('Invalid QPay webhook signature');
  }
  const event = qpayWebhookSchema.parse(req.body || {});
  const providerInvoiceId = event.providerInvoiceId || event.invoice_id;
  const invoiceId = event.invoiceId;
  const providerPaymentId = event.paymentId || event.payment_id || event.transactionId || providerInvoiceId || invoiceId;
  const status = String(event.payment_status || event.status || '').toUpperCase();
  const paid = ['PAID', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(status);
  const failed = ['FAILED', 'CANCELLED', 'CANCELED', 'EXPIRED'].includes(status);
  if (!paid && !failed) return res.status(202).json({ success: true, data: { ignored: true, status } });

  const payment = providerInvoiceId
    ? await prisma.payment.findFirst({
        where: {
          method: 'QPAY',
          transactionId: `qpay:${providerInvoiceId}`,
        },
        include: { invoice: true },
      })
    : null;
  const invoice = payment?.invoice || (invoiceId ? await prisma.invoice.findUnique({ where: { id: invoiceId } }) : null);
  if (!invoice) throw AppError.notFound('Invoice not found for QPay webhook');

  const amount = event.amount !== undefined ? new Prisma.Decimal(event.amount) : invoice.amount;
  const currency = event.currency || invoice.currency;
  if (!amount.equals(invoice.amount) || currency !== invoice.currency) {
    throw AppError.badRequest('Webhook amount and currency do not match invoice');
  }

  const transactionId = `qpay-payment:${providerPaymentId}`;
  const result = paid
    ? await completeInvoicePaymentById(invoice.organizationId, invoice.id, {
        amount,
        currency,
        method: 'QPAY',
        transactionId,
        providerPayload: toJson({ provider: 'QPAY', webhook: event }),
      })
    : await markInvoiceFailedById(invoice.organizationId, invoice.id, transactionId, toJson(event));
  return res.json({ success: true, data: result });
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const event = verifyStripeWebhookEvent(
    Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {})),
    req.get('stripe-signature') || undefined,
  );
  const session = event?.data?.object || {};
  const organizationId = session.metadata?.organizationId;
  const invoiceId = session.metadata?.invoiceId;

  if (event.type === 'checkout.session.completed') {
    if (!organizationId || !invoiceId) throw AppError.badRequest('Stripe session metadata is missing');
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
    if (!invoice) throw AppError.notFound('Invoice not found for Stripe session');
    if (session.amount_total != null) {
      const paidAmount = new Prisma.Decimal(session.amount_total).div(100);
      if (!paidAmount.equals(invoice.amount)) throw AppError.badRequest('Stripe amount does not match invoice');
    }
    if (session.currency && String(session.currency).toUpperCase() !== invoice.currency) {
      throw AppError.badRequest('Stripe currency does not match invoice');
    }
    const transactionId = `stripe:${session.payment_intent || session.subscription || session.id}`;
    const result = await completeInvoicePaymentById(organizationId, invoice.id, {
      amount: invoice.amount,
      currency: invoice.currency,
      method: 'STRIPE',
      transactionId,
      providerPayload: toJson({
        provider: 'STRIPE',
        eventId: event.id,
        sessionId: session.id,
        mode: session.mode,
        paymentIntent: session.payment_intent,
        subscription: session.subscription,
      }),
    });
    const subscription = await prisma.subscription.findUnique({ where: { id: result.invoice.subscriptionId } });
    const nextBillingDays = subscription?.billingCycle === 'yearly' ? 365 : 30;
    await prisma.subscription.update({
      where: { id: result.invoice.subscriptionId },
      data: {
        isActive: true,
        nextBillingAt: new Date(Date.now() + nextBillingDays * 86_400_000),
      },
    });
    return res.json({ success: true, data: { processed: true } });
  }

  if (event.type === 'checkout.session.expired' && organizationId && invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
    if (!invoice || invoice.status !== PaymentStatus.PENDING) {
      return res.json({ success: true, data: { ignored: true, type: event.type } });
    }
    await markInvoiceFailedById(
      organizationId,
      invoiceId,
      `stripe:${session.id}`,
      toJson({ provider: 'STRIPE', eventId: event.id, sessionId: session.id, type: event.type }),
      'STRIPE',
    );
    return res.json({ success: true, data: { processed: true } });
  }

  return res.status(202).json({ success: true, data: { ignored: true, type: event.type } });
};

export const listOutstandingInvoices = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      ...(req.user!.role === 'STUDENT' ? { studentId: req.user!.userId } : {}),
      status: PaymentStatus.PENDING,
      OR: [{ dueDate: null }, { dueDate: { lte: now } }],
    },
    include: { payments: { orderBy: { createdAt: 'desc' } } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  const totalOutstanding = invoices.reduce((sum, invoice) => sum.plus(invoice.amount), new Prisma.Decimal(0));
  return res.json({
    success: true,
    data: {
      invoices,
      totalOutstanding: totalOutstanding.toFixed(4),
      currency: invoices[0]?.currency || 'MNT',
    },
  });
};

export const sendOutstandingReminders = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const invoices = await sendOutstandingReminderEvents(organizationId);
  return res.json({ success: true, data: { reminderCount: invoices.length } });
};

export async function sendOutstandingReminderEvents(organizationId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const rows = await tx.invoice.findMany({
      where: {
        organizationId,
        status: PaymentStatus.PENDING,
        dueDate: { lte: now },
        OR: [
          { reminderSentAt: null },
          { reminderSentAt: { lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: { dueDate: 'asc' },
    });
    for (const invoice of rows) {
      await tx.invoice.update({ where: { id: invoice.id }, data: { reminderSentAt: now } });
      await enqueueBillingEvent(tx, EVENTS.INVOICE_ISSUED, organizationId, {
        ...invoicePayload(invoice),
        reminder: true,
        studentId: invoice.studentId,
        enrollmentId: invoice.enrollmentId,
      });
    }
    return rows;
  });
}
export const failInvoice = async (req: Request, res: Response) =>
  res.json({
    success: true,
    data: await transitionInvoice(
      req,
      PaymentStatus.FAILED,
      [PaymentStatus.PENDING],
      [EVENTS.PAYMENT_FAILED]
    ),
  });
export const refundInvoice = async (req: Request, res: Response) =>
  res.json({
    success: true,
    data: await refundInvoicePayment(req),
  });

const refundInvoicePayment = async (req: Request) => {
  const organizationId = req.organizationId!;
  const existing = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      organizationId,
      ...(req.user!.role === 'STUDENT' ? { studentId: req.user!.userId } : {}),
    },
  });
  if (!existing) throw AppError.notFound('Invoice not found');
  if (existing.status === PaymentStatus.REFUNDED) return existing;
  if (existing.status !== PaymentStatus.COMPLETED) {
    throw AppError.conflict(`Invoice cannot transition from ${existing.status} to REFUNDED`);
  }
  return prisma.$transaction(async tx => {
    const changed = await tx.invoice.updateMany({
      where: { id: existing.id, organizationId, status: PaymentStatus.COMPLETED },
      data: { status: PaymentStatus.REFUNDED },
    });
    if (changed.count !== 1) {
      const current = await tx.invoice.findFirst({ where: { id: existing.id, organizationId } });
      if (current?.status === PaymentStatus.REFUNDED) return current;
      throw AppError.conflict(
        `Invoice cannot transition from ${current?.status || existing.status} to REFUNDED`,
      );
    }
    await tx.payment.updateMany({
      where: {
        organizationId,
        invoiceId: existing.id,
        status: PaymentStatus.COMPLETED,
      },
      data: { status: PaymentStatus.REFUNDED },
    });
    const invoice = await tx.invoice.findFirstOrThrow({
      where: { id: existing.id, organizationId },
    });
    await enqueueBillingEvent(
      tx,
      EVENTS.PAYMENT_REFUNDED,
      organizationId,
      invoicePayload(invoice),
    );
    return invoice;
  });
};

const completeInvoicePayment = async (req: Request) => {
  const organizationId = req.organizationId!;
  const input = paymentSchema.parse(req.body || {});
  const existing = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      organizationId,
      ...(req.user!.role === 'STUDENT' ? { studentId: req.user!.userId } : {}),
    },
  });
  if (!existing) throw AppError.notFound('Invoice not found');
  if (
    existing.status !== PaymentStatus.PENDING &&
    existing.status !== PaymentStatus.COMPLETED
  ) {
    throw AppError.conflict(`Invoice cannot transition from ${existing.status} to COMPLETED`);
  }
  const amount = new Prisma.Decimal(input.amount ?? existing.amount);
  const currency = input.currency || existing.currency;
  if (!amount.equals(existing.amount) || currency !== existing.currency) {
    throw AppError.badRequest('Payment amount and currency must match the invoice');
  }
  const transactionId = input.transactionId || `invoice:${existing.id}`;

  return completeInvoicePaymentById(organizationId, existing.id, {
    amount,
    currency,
    method: input.method,
    transactionId,
  });
};

const completeInvoicePaymentById = async (
  organizationId: string,
  invoiceId: string,
  input: {
    amount: Prisma.Decimal;
    currency: string;
    method: string;
    transactionId: string;
    providerPayload?: Prisma.InputJsonValue;
  },
) => {
  const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } });
  if (!existing) throw AppError.notFound('Invoice not found');
  if (existing.status !== PaymentStatus.PENDING && existing.status !== PaymentStatus.COMPLETED) {
    throw AppError.conflict(`Invoice cannot transition from ${existing.status} to COMPLETED`);
  }
  if (!input.amount.equals(existing.amount) || input.currency !== existing.currency) {
    throw AppError.badRequest('Payment amount and currency must match the invoice');
  }
  return prisma.$transaction(async tx => {
    const duplicate = await tx.payment.findUnique({
      where: {
        organizationId_transactionId: { organizationId, transactionId: input.transactionId },
      },
    });
    if (duplicate && duplicate.invoiceId !== existing.id) {
      throw AppError.conflict('Transaction id is already assigned to another invoice');
    }
    const changed = existing.status === PaymentStatus.PENDING
      ? await tx.invoice.updateMany({
          where: { id: existing.id, organizationId, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
        })
      : { count: 0 };
    const invoice = await tx.invoice.findFirstOrThrow({
      where: { id: existing.id, organizationId },
    });
    if (invoice.status !== PaymentStatus.COMPLETED) {
      throw AppError.conflict(`Invoice cannot transition from ${invoice.status} to COMPLETED`);
    }
    const payment = duplicate || await tx.payment.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        amount: input.amount,
        currency: input.currency,
        method: input.method,
        transactionId: input.transactionId,
        status: PaymentStatus.COMPLETED,
        providerPayload: input.providerPayload,
      },
    });
    if (changed.count === 1) {
      await enqueueBillingEvent(tx, EVENTS.INVOICE_PAID, organizationId, invoicePayload(invoice));
      await enqueueBillingEvent(tx, EVENTS.PAYMENT_SUCCEEDED, organizationId, {
        ...invoicePayload(invoice),
        paymentId: payment.id,
        transactionId: payment.transactionId,
      });
    }
    return { invoice, payment };
  });
};

const markInvoiceFailedById = async (
  organizationId: string,
  invoiceId: string,
  transactionId: string,
  providerPayload: Prisma.InputJsonValue,
  method = 'QPAY',
) => prisma.$transaction(async tx => {
  const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId } });
  if (!invoice) throw AppError.notFound('Invoice not found');
  if (invoice.status !== PaymentStatus.PENDING && invoice.status !== PaymentStatus.FAILED) {
    throw AppError.conflict(`Invoice cannot transition from ${invoice.status} to FAILED`);
  }
  await tx.payment.upsert({
    where: { organizationId_transactionId: { organizationId, transactionId } },
    create: {
      organizationId,
      invoiceId,
      amount: invoice.amount,
      currency: invoice.currency,
      method,
      transactionId,
      status: PaymentStatus.FAILED,
      providerPayload,
    },
    update: { status: PaymentStatus.FAILED, providerPayload },
  });
  if (invoice.status === PaymentStatus.PENDING) {
    const failed = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: PaymentStatus.FAILED },
    });
    await enqueueBillingEvent(tx, EVENTS.PAYMENT_FAILED, organizationId, invoicePayload(failed));
    return failed;
  }
  return invoice;
});

const invoicePayload = (invoice: {
  id: string;
  subscriptionId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
}) => ({
  invoiceId: invoice.id,
  subscriptionId: invoice.subscriptionId,
  amount: invoice.amount.toFixed(4),
  currency: invoice.currency,
  status: invoice.status,
  paidAt: invoice.paidAt?.toISOString() || null,
  createdAt: invoice.createdAt.toISOString(),
});
