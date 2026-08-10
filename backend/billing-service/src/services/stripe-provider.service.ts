import crypto from 'crypto';
import { Prisma } from '@prisma/client-billing';

export type StripeCheckoutRequest = {
  invoiceId: string;
  organizationId: string;
  planKey: string;
  amount: Prisma.Decimal;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
};

export type StripeCheckoutResponse = {
  providerSessionId: string;
  checkoutUrl: string;
  raw: Record<string, unknown>;
};

const ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const isProduction = () => process.env.NODE_ENV === 'production';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export const stripeAmountToMinorUnit = (amount: Prisma.Decimal, currency: string) => {
  const multiplier = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
  return Number(amount.mul(multiplier).toDecimalPlaces(0).toString());
};

export function validateStripeConfiguration() {
  if (!isProduction()) return;
  const missing = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
    .filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Stripe production configuration missing: ${missing.join(', ')}`);
  }
}

export function verifyStripeWebhookSignature(rawBody: string, signature: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    if (isProduction()) throw new Error('STRIPE_WEBHOOK_SECRET is required');
    return true;
  }
  if (!signature) return false;
  const timestamp = signature.split(',').find(part => part.startsWith('t='))?.slice(2);
  const signatures = signature
    .split(',')
    .filter(part => part.startsWith('v1='))
    .map(part => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return signatures.some(value => {
    const a = Buffer.from(expected);
    const b = Buffer.from(value);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export async function createStripeCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required to create Stripe checkout sessions');
  }

  const body = new URLSearchParams({
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.invoiceId,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': input.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(stripeAmountToMinorUnit(input.amount, input.currency)),
    'line_items[0][price_data][product_data][name]': input.description,
    'metadata[invoiceId]': input.invoiceId,
    'metadata[organizationId]': input.organizationId,
    'metadata[planKey]': input.planKey,
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await response.json() as Record<string, any>;
  if (!response.ok) {
    throw new Error(`Stripe checkout create failed: ${String(data.error?.message || `HTTP ${response.status}`)}`);
  }
  const providerSessionId = String(data.id || '');
  const checkoutUrl = String(data.url || '');
  if (!providerSessionId || !checkoutUrl) throw new Error('Stripe response did not include a checkout URL');
  return { providerSessionId, checkoutUrl, raw: data };
}
