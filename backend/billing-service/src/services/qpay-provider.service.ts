import crypto from 'crypto';
import { Prisma } from '@prisma/client-billing';

export type QPayInvoiceRequest = {
  invoiceId: string;
  amount: Prisma.Decimal;
  currency: string;
  description?: string | null;
};

export type QPayInvoiceResponse = {
  providerInvoiceId: string;
  paymentUrl: string;
  raw: Record<string, unknown>;
};

const isProduction = () => process.env.NODE_ENV === 'production';

export function validateQPayConfiguration() {
  if (!isProduction()) return;
  const missing = ['QPAY_API_URL', 'QPAY_CLIENT_ID', 'QPAY_CLIENT_SECRET', 'QPAY_WEBHOOK_SECRET']
    .filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`QPay production configuration missing: ${missing.join(', ')}`);
  }
}

export function verifyQPayWebhookSignature(rawBody: string, signature: string | undefined) {
  const secret = process.env.QPAY_WEBHOOK_SECRET;
  if (!secret) {
    if (isProduction()) throw new Error('QPAY_WEBHOOK_SECRET is required');
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createQPayProviderInvoice(input: QPayInvoiceRequest): Promise<QPayInvoiceResponse> {
  const baseUrl = process.env.QPAY_API_URL;
  if (!baseUrl) {
    if (isProduction()) throw new Error('QPAY_API_URL is required');
    return {
      providerInvoiceId: `demo-${input.invoiceId}`,
      paymentUrl: `https://qpay.mn/payment/${input.invoiceId}`,
      raw: { provider: 'QPAY', mode: 'development-demo' },
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/invoices`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(`${process.env.QPAY_CLIENT_ID || ''}:${process.env.QPAY_CLIENT_SECRET || ''}`).toString('base64')}`,
    },
    body: JSON.stringify({
      sender_invoice_no: input.invoiceId,
      invoice_receiver_code: input.invoiceId,
      invoice_description: input.description || `Invoice ${input.invoiceId}`,
      amount: Number(input.amount.toFixed(2)),
      callback_url: process.env.QPAY_CALLBACK_URL,
    }),
  });
  if (!response.ok) throw new Error(`QPay invoice create failed: HTTP ${response.status}`);
  const data = await response.json() as Record<string, any>;
  const providerInvoiceId = String(data.invoice_id || data.qpay_invoice_id || data.id || input.invoiceId);
  const paymentUrl = String(data.invoice_url || data.qr_text || data.payment_url || '');
  if (!paymentUrl) throw new Error('QPay response did not include a payment URL');
  return { providerInvoiceId, paymentUrl, raw: data };
}
