import express from 'express';
import request from 'supertest';
import { PaymentStatus } from '@prisma/client-billing';
import { describe, expect, it } from 'vitest';
import { errorHandler, signAccessToken } from '@lms/shared';
import userRoutes from '../auth-service/src/routes/user.routes';
import { isInvoiceTransitionAllowed } from '../billing-service/src/controllers/billing.controller';

const userId = '11111111-1111-4111-8111-111111111111';

const accessToken = (role: string) =>
  signAccessToken({
    userId,
    organizationId: 'org-1',
    role,
    sessionId: 'session-1',
  });

describe('user administration authorization', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use(errorHandler);

  it('does not let staff or principals mutate user accounts', async () => {
    const target = '22222222-2222-4222-8222-222222222222';
    const promote = await request(app)
      .patch(`/api/users/${target}`)
      .set('Authorization', `Bearer ${accessToken('STAFF')}`)
      .send({ role: 'SUPER_ADMIN' });
    const deactivate = await request(app)
      .delete(`/api/users/${target}`)
      .set('Authorization', `Bearer ${accessToken('PRINCIPAL')}`);

    expect(promote.status).toBe(403);
    expect(deactivate.status).toBe(403);
  });
});

describe('billing state machine', () => {
  it('allows only pending payment/failure and completed refund transitions', () => {
    expect(isInvoiceTransitionAllowed(PaymentStatus.PENDING, PaymentStatus.COMPLETED)).toBe(true);
    expect(isInvoiceTransitionAllowed(PaymentStatus.PENDING, PaymentStatus.FAILED)).toBe(true);
    expect(isInvoiceTransitionAllowed(PaymentStatus.COMPLETED, PaymentStatus.REFUNDED)).toBe(true);
    expect(isInvoiceTransitionAllowed(PaymentStatus.PENDING, PaymentStatus.REFUNDED)).toBe(false);
    expect(isInvoiceTransitionAllowed(PaymentStatus.REFUNDED, PaymentStatus.COMPLETED)).toBe(false);
  });
});
