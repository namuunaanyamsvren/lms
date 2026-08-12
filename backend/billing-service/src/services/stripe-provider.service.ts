import crypto from 'node:crypto';
import { AppError } from '@lms/shared';
import { Prisma } from '@prisma/client-billing';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const DEFAULT_CHECKOUT_CURRENCY = 'USD';

type StripeRequestPair = [string, string | number | boolean | null | undefined];

type StripePriceDetails = {
  amount: Prisma.Decimal;
  currency: string;
  mode: 'payment' | 'subscription';
  interval: 'monthly' | 'yearly';
  priceId?: string;
};

const configured = (key: string) => {
  const value = process.env[key]?.trim();
  return value && value !== 'null' && value !== 'undefined' ? value : undefined;
};

const stripeSecretKey = () => {
  const value = configured('STRIPE_SECRET_KEY');
  if (!value) throw AppError.internal('STRIPE_SECRET_KEY is not configured');
  return value;
};

const appendPairs = (params: URLSearchParams, pairs: StripeRequestPair[]) => {
  for (const [key, value] of pairs) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
};

async function stripeRequest<T>(
  path: string,
  pairs: StripeRequestPair[] = [],
  method: 'GET' | 'POST' = 'POST',
): Promise<T> {
  const params = new URLSearchParams();
  appendPairs(params, pairs);
  const url = method === 'GET' && params.toString()
    ? `${STRIPE_API_BASE}/${path}?${params.toString()}`
    : `${STRIPE_API_BASE}/${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${stripeSecretKey()}`,
      ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? params.toString() : undefined,
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok) {
    throw AppError.badRequest(body?.error?.message || `Stripe request failed (${response.status})`);
  }
  return body as T;
}

const toUnitAmount = (amount: Prisma.Decimal) => {
  const cents = amount.mul(100).toDecimalPlaces(0);
  const value = cents.toNumber();
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw AppError.badRequest('Stripe checkout amount must be positive');
  }
  return value;
};

const billingInterval = (interval?: string) => interval === 'year' ? 'yearly' : 'monthly';

export async function getStripeCheckoutPrice(): Promise<StripePriceDetails> {
  const priceId = configured('STRIPE_PRICE_ID');
  if (priceId) {
    const price = await stripeRequest<any>(`prices/${encodeURIComponent(priceId)}`, [], 'GET');
    const unitAmount = price.unit_amount;
    if (!unitAmount || unitAmount <= 0 || !price.currency) {
      throw AppError.badRequest('Configured Stripe price must have a positive unit amount and currency');
    }
    return {
      amount: new Prisma.Decimal(unitAmount).div(100),
      currency: String(price.currency).toUpperCase(),
      mode: price.recurring ? 'subscription' : 'payment',
      interval: billingInterval(price.recurring?.interval),
      priceId,
    };
  }

  const unitAmount = Number(configured('STRIPE_CHECKOUT_UNIT_AMOUNT'));
  if (!Number.isSafeInteger(unitAmount) || unitAmount <= 0) {
    throw AppError.internal('STRIPE_PRICE_ID or STRIPE_CHECKOUT_UNIT_AMOUNT is required for Stripe Checkout');
  }
  return {
    amount: new Prisma.Decimal(unitAmount).div(100),
    currency: (configured('STRIPE_CHECKOUT_CURRENCY') || DEFAULT_CHECKOUT_CURRENCY).toUpperCase(),
    mode: 'payment',
    interval: 'monthly',
  };
}

export async function createStripeCheckoutSession(input: {
  invoiceId: string;
  organizationId: string;
  userId?: string;
  amount: Prisma.Decimal;
  currency: string;
  description?: string | null;
  successUrl: string;
  cancelUrl: string;
  priceId?: string;
  mode: 'payment' | 'subscription';
}) {
  const metadata: StripeRequestPair[] = [
    ['metadata[invoiceId]', input.invoiceId],
    ['metadata[organizationId]', input.organizationId],
    ['metadata[userId]', input.userId],
  ];
  const pairs: StripeRequestPair[] = [
    ['mode', input.mode],
    ['success_url', input.successUrl],
    ['cancel_url', input.cancelUrl],
    ['client_reference_id', input.organizationId],
    ['billing_address_collection', 'auto'],
    ['line_items[0][quantity]', 1],
    ...metadata,
  ];

  if (input.mode === 'subscription') {
    pairs.push(
      ['subscription_data[metadata][invoiceId]', input.invoiceId],
      ['subscription_data[metadata][organizationId]', input.organizationId],
      ['subscription_data[metadata][userId]', input.userId],
    );
  } else {
    pairs.push(
      ['payment_intent_data[metadata][invoiceId]', input.invoiceId],
      ['payment_intent_data[metadata][organizationId]', input.organizationId],
      ['payment_intent_data[metadata][userId]', input.userId],
    );
  }

  if (input.priceId) {
    pairs.push(['line_items[0][price]', input.priceId]);
  } else {
    pairs.push(
      ['line_items[0][price_data][currency]', input.currency.toLowerCase()],
      ['line_items[0][price_data][unit_amount]', toUnitAmount(input.amount)],
      ['line_items[0][price_data][product_data][name]', input.description || 'LMS subscription'],
    );
  }

  return stripeRequest<{ id: string; url: string | null }>('checkout/sessions', pairs);
}

export function verifyStripeWebhookEvent(rawBody: Buffer | string, signatureHeader?: string) {
  const secret = configured('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw AppError.internal('STRIPE_WEBHOOK_SECRET is not configured');
  if (!signatureHeader) throw AppError.unauthorized('Missing Stripe signature');

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => {
      const [key, ...rest] = part.split('=');
      return [key, rest.join('=')];
    }),
  );
  const timestamp = parts.t;
  const expectedSignatures = signatureHeader
    .split(',')
    .filter(part => part.startsWith('v1='))
    .map(part => part.slice(3));
  if (!timestamp || !expectedSignatures.length) throw AppError.unauthorized('Invalid Stripe signature header');

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    throw AppError.unauthorized('Expired Stripe signature');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  const matches = expectedSignatures.some(signature => {
    const actual = Buffer.from(signature, 'hex');
    const target = Buffer.from(expected, 'hex');
    return actual.length === target.length && crypto.timingSafeEqual(actual, target);
  });
  if (!matches) throw AppError.unauthorized('Invalid Stripe signature');
  return JSON.parse(payload);
}
