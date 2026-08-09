import type { Request, Response } from 'express';
import { PaymentStatus } from '@prisma/client-billing';

import { prisma } from '../lib/prisma';

// Financial records are retained for audit/accounting. Deprovisioning only
// stops future billing; it never cascades through invoices or payments.
export const deactivateOrganizationBilling = async (req: Request, res: Response) => {
  await prisma.subscription.updateMany({
    where: { organizationId: req.params.organizationId },
    data: { isActive: false },
  });
  return res.status(204).send();
};

// Read-only revenue rollup for the academic-service reporting catalog. Kept
// deliberately simple (no pagination) — this is a summary report, not a raw
// ledger export.
export const getRevenueSummary = async (req: Request, res: Response) => {
  const organizationId = req.params.organizationId;
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(0);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  const [subscription, invoices, payments, outstandingInvoices] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId } }),
    prisma.invoice.findMany({
      where: { organizationId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { organizationId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    }),
    // Receivable is a current-state snapshot ("how much is owed right now"),
    // not bounded by the report's [from, to] window — mirrors
    // listOutstandingInvoices' definition of "outstanding" (billing.controller.ts).
    prisma.invoice.findMany({
      where: {
        organizationId,
        status: PaymentStatus.PENDING,
        OR: [{ dueDate: null }, { dueDate: { lte: new Date() } }],
      },
      select: { amount: true },
    }),
  ]);
  const totalOutstanding = outstandingInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  const totalRevenue = payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const failedCount = payments.filter(p => p.status === 'FAILED').length;
  const refundedCount = payments.filter(p => p.status === 'REFUNDED').length;

  const monthly = new Map<string, number>();
  payments.filter(p => p.status === 'COMPLETED').forEach(p => {
    const key = p.createdAt.toISOString().slice(0, 7);
    monthly.set(key, (monthly.get(key) || 0) + Number(p.amount));
  });

  return res.json({
    success: true,
    data: {
      plan: subscription?.plan || null,
      currency: subscription?.currency || 'MNT',
      totalRevenue,
      totalOutstanding,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      failedPaymentCount: failedCount,
      refundedPaymentCount: refundedCount,
      monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })),
      rows: payments.map(p => ({
        date: p.createdAt.toISOString().slice(0, 10),
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        status: p.status,
        transactionId: p.transactionId,
      })),
    },
  });
};

export const getAccessStatus = async (req: Request, res: Response) => {
  const organizationId = req.params.organizationId;
  const userId = String(req.query.userId || '');
  const enrollmentId = req.query.enrollmentId ? String(req.query.enrollmentId) : undefined;
  const cohortId = req.query.cohortId ? String(req.query.cohortId) : undefined;
  if (!userId && !enrollmentId) {
    return res.status(400).json({ success: false, message: 'userId or enrollmentId is required' });
  }
  const blockingInvoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: PaymentStatus.PENDING,
      accessRestricted: true,
      OR: [
        ...(enrollmentId ? [{ enrollmentId }] : []),
        ...(userId ? [{ studentId: userId }] : []),
        ...(userId && cohortId ? [{ studentId: userId, cohortId }] : []),
      ],
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      studentId: true,
      cohortId: true,
      enrollmentId: true,
      amount: true,
      currency: true,
      dueDate: true,
      status: true,
    },
  });
  return res.json({
    success: true,
    data: {
      restricted: blockingInvoices.length > 0,
      blockingInvoices: blockingInvoices.map(invoice => ({
        ...invoice,
        amount: invoice.amount.toFixed(4),
      })),
    },
  });
};
