import { AppError, EVENTS, getPagination, paginatedData } from '@lms/shared';
import { PaymentStatus, PlanType, Prisma } from '@prisma/client-billing';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { enqueueBillingEvent } from '../services/event-outbox.service';
import { createQPayProviderInvoice, verifyQPayWebhookSignature } from '../services/qpay-provider.service';
import { createStripeCheckoutSession, verifyStripeWebhookSignature } from '../services/stripe-provider.service';
import { activateOrganization, activateOrganizationAdmins } from '../services/organization-lifecycle.service';

import { prisma } from '../lib/prisma';
const onboardingPlans = {
  monthly: {
    plan: PlanType.BASIC,
    amount: 99000,
    currency: 'MNT',
    billingCycle: 'monthly',
    months: 1,
    label: '1 сарын SaaS багц',
  },
  yearly: {
    plan: PlanType.PRO,
    amount: 990000,
    currency: 'MNT',
    billingCycle: 'yearly',
    months: 12,
    label: '1 жилийн SaaS багц',
  },
  four_year: {
    plan: PlanType.ENTERPRISE,
    amount: 2990000,
    currency: 'MNT',
    billingCycle: 'four_year',
    months: 48,
    label: '4 жилийн SaaS багц',
  },
} as const;
const onboardingStripeSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(200),
    planKey: z.enum(['monthly', 'yearly', 'four_year']),
    successUrl: z.string().url().max(2000),
    cancelUrl: z.string().url().max(2000),
    onboardingPaymentToken: z.string().trim().min(20).max(2000),
  })
  .strict();
const subscriptionSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(200).optional(),
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
    organizationId: z.string().trim().min(1).max(200).optional(),
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
const stripeWebhookSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any()),
  }).passthrough(),
}).passthrough();
const toJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const verifyOnboardingPaymentToken = (token: string, organizationId: string) => {
  const secret = process.env.ONBOARDING_PAYMENT_TOKEN_SECRET || process.env.SERVICE_TOKEN_SECRET;
  if (!secret) throw AppError.internal('Onboarding payment token configuration is missing');
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw AppError.unauthorized('Invalid onboarding payment token');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const provided = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  if (provided.length !== calculated.length || !crypto.timingSafeEqual(provided, calculated)) {
    throw AppError.unauthorized('Invalid onboarding payment token');
  }
  let data: { organizationId?: string; expiresAt?: number };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      organizationId?: string;
      expiresAt?: number;
    };
  } catch {
    throw AppError.unauthorized('Invalid onboarding payment token');
  }
  if (data.organizationId !== organizationId || !data.expiresAt || data.expiresAt < Date.now()) {
    throw AppError.unauthorized('Invalid onboarding payment token');
  }
};
const targetOrganizationId = (req: Request, source: Record<string, unknown> = req.query) => {
  const requested = typeof source.organizationId === 'string' ? source.organizationId.trim() : '';
  if (req.user!.role === 'SUPER_ADMIN' && requested) return requested;
  return req.organizationId!;
};
const invoiceActionWhere = (req: Request): Prisma.InvoiceWhereInput => ({
  id: req.params.id,
  ...(req.user!.role === 'SUPER_ADMIN' ? {} : { organizationId: req.organizationId! }),
});
export const isInvoiceTransitionAllowed = (from: PaymentStatus, to: PaymentStatus) =>
  (from === PaymentStatus.PENDING &&
    (to === PaymentStatus.COMPLETED || to === PaymentStatus.FAILED)) ||
  (from === PaymentStatus.COMPLETED && to === PaymentStatus.REFUNDED);

export const getBillingOverview = async (req: Request, res: Response) => {
  const organizationId = targetOrganizationId(req);
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
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
  const organizationId = targetOrganizationId(req);
  const where: Prisma.InvoiceWhereInput = {
    organizationId,
    ...(req.query.studentId ? { studentId: String(req.query.studentId) } : {}),
    ...(req.query.enrollmentId ? { enrollmentId: String(req.query.enrollmentId) } : {}),
    ...(req.query.status ? { status: req.query.status as PaymentStatus } : {}),
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
  const organizationId = targetOrganizationId(req);
  const where: Prisma.PaymentWhereInput = {
    organizationId,
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
  const organizationId = targetOrganizationId(req, data);
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
  const organizationId = targetOrganizationId(req, data);
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
  const existing = await prisma.invoice.findFirst({ where: invoiceActionWhere(req) });
  if (!existing) throw AppError.notFound('Invoice not found');
  const organizationId = existing.organizationId;
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
  const invoice = await prisma.invoice.findFirst({
    where: invoiceActionWhere(req),
  });
  if (!invoice) throw AppError.notFound('Invoice not found');
  const organizationId = invoice.organizationId;
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

export const createOnboardingStripeCheckout = async (req: Request, res: Response) => {
  const input = onboardingStripeSchema.parse(req.body);
  verifyOnboardingPaymentToken(input.onboardingPaymentToken, input.organizationId);
  if (!process.env.STRIPE_SECRET_KEY) {
    throw AppError.badRequest('Stripe тохиргоо хийгдээгүй байна. STRIPE_SECRET_KEY env утгаа тохируулна уу.', undefined, 'STRIPE_NOT_CONFIGURED');
  }
  const plan = onboardingPlans[input.planKey];
  const amount = new Prisma.Decimal(plan.amount);
  const currency = plan.currency;
  const description = `LMS ${plan.label}`;
  const result = await prisma.$transaction(async (tx) => {
    await tx.invoice.updateMany({
      where: {
        organizationId: input.organizationId,
        status: PaymentStatus.PENDING,
        payments: { none: { status: PaymentStatus.COMPLETED } },
      },
      data: { status: PaymentStatus.FAILED },
    });
    const subscription = await tx.subscription.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        plan: plan.plan,
        amount,
        currency,
        billingCycle: plan.billingCycle,
        isActive: false,
        nextBillingAt: new Date(Date.now() + plan.months * 30 * 86_400_000),
      },
      update: {
        plan: plan.plan,
        amount,
        currency,
        billingCycle: plan.billingCycle,
        isActive: false,
        nextBillingAt: new Date(Date.now() + plan.months * 30 * 86_400_000),
      },
    });
    const invoice = await tx.invoice.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: subscription.id,
        amount,
        currency,
        description,
        dueDate: new Date(),
      },
    });
    return { subscription, invoice };
  });
  const checkout = await createStripeCheckoutSession({
    invoiceId: result.invoice.id,
    organizationId: input.organizationId,
    planKey: input.planKey,
    amount: result.invoice.amount,
    currency: result.invoice.currency,
    description,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
  const payment = await prisma.payment.upsert({
    where: {
      organizationId_transactionId: {
        organizationId: input.organizationId,
        transactionId: `stripe:${checkout.providerSessionId}`,
      },
    },
    create: {
      organizationId: input.organizationId,
      invoiceId: result.invoice.id,
      amount: result.invoice.amount,
      currency: result.invoice.currency,
      method: 'STRIPE',
      transactionId: `stripe:${checkout.providerSessionId}`,
      status: PaymentStatus.PENDING,
      providerPayload: toJson({ provider: 'STRIPE', sessionId: checkout.providerSessionId, planKey: input.planKey, raw: checkout.raw }),
    },
    update: {
      providerPayload: toJson({ provider: 'STRIPE', sessionId: checkout.providerSessionId, planKey: input.planKey, raw: checkout.raw }),
    },
  });
  return res.status(201).json({
    success: true,
    data: {
      invoice: result.invoice,
      payment,
      checkoutUrl: checkout.checkoutUrl,
      providerSessionId: checkout.providerSessionId,
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
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
  if (!verifyStripeWebhookSignature(rawBody, req.get('stripe-signature'))) {
    throw AppError.unauthorized('Invalid Stripe webhook signature');
  }
  const event = stripeWebhookSchema.parse(JSON.parse(rawBody || '{}'));
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    return res.status(202).json({ success: true, data: { ignored: true, type: event.type } });
  }
  const session = event.data.object as Record<string, any>;
  const invoiceId = String(session.metadata?.invoiceId || session.client_reference_id || '');
  const providerSessionId = String(session.id || '');
  if (!invoiceId || !providerSessionId) throw AppError.badRequest('Stripe webhook missing invoice reference');
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw AppError.notFound('Invoice not found for Stripe webhook');

  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const transactionId = `stripe:${providerSessionId}`;
  const result = paid
    ? await completeInvoicePaymentById(invoice.organizationId, invoice.id, {
        amount: invoice.amount,
        currency: invoice.currency,
        method: 'STRIPE',
        transactionId,
        providerPayload: toJson({ provider: 'STRIPE', webhook: event }),
      })
    : await markInvoiceFailedById(invoice.organizationId, invoice.id, transactionId, toJson(event));
  if (paid) {
    const payment = await prisma.payment.findFirst({ where: { organizationId: invoice.organizationId, transactionId } });
    await prisma.subscription.updateMany({
      where: { id: invoice.subscriptionId, organizationId: invoice.organizationId },
      data: {
        isActive: true,
        status: String(session.subscription ? 'ACTIVE' : 'PAID'),
        stripeCustomerId: session.customer ? String(session.customer) : undefined,
        stripeSubscriptionId: session.subscription ? String(session.subscription) : undefined,
        stripePriceId: session.metadata?.stripePriceId ? String(session.metadata.stripePriceId) : undefined,
        currentPeriodEnd: session.expires_at ? new Date(Number(session.expires_at) * 1000) : invoice.dueDate,
        paymentFailure: null,
      },
    });
    await activateOrganization(invoice.organizationId);
    await activateOrganizationAdmins(invoice.organizationId);
    return res.json({ success: true, data: { result, payment } });
  }
  await prisma.subscription.updateMany({
    where: { id: invoice.subscriptionId, organizationId: invoice.organizationId },
    data: {
      status: event.type === 'checkout.session.expired' ? 'EXPIRED' : 'PAYMENT_FAILED',
      paymentFailure: event.type,
      isActive: false,
    },
  });
  return res.json({ success: true, data: result });
};

export const listOutstandingInvoices = async (req: Request, res: Response) => {
  const organizationId = targetOrganizationId(req);
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
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
  const organizationId = targetOrganizationId(req);
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
  const existing = await prisma.invoice.findFirst({
    where: invoiceActionWhere(req),
  });
  if (!existing) throw AppError.notFound('Invoice not found');
  const organizationId = existing.organizationId;
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
  const input = paymentSchema.parse(req.body || {});
  const existing = await prisma.invoice.findFirst({
    where: invoiceActionWhere(req),
  });
  if (!existing) throw AppError.notFound('Invoice not found');
  const organizationId = existing.organizationId;
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
      method: 'QPAY',
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
