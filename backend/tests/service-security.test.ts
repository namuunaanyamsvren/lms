import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createServiceToken,
  applyHttpSecurity,
  internalServiceAuth,
  requireInternalService,
  validateServiceEnvironment,
} from '@lms/shared';

afterEach(() => vi.unstubAllEnvs());

describe('service authentication', () => {
  it('accepts signed short-lived service tokens and rejects access tokens', async () => {
    vi.stubEnv('SERVICE_TOKEN_SECRET', 's'.repeat(43));
    vi.stubEnv('ACCESS_TOKEN_SECRET', 'a'.repeat(43));
    const app = express();
    applyHttpSecurity(app);
    app.get(
      '/internal',
      internalServiceAuth,
      requireInternalService('authorized-service'),
      (_req, res) => res.sendStatus(204),
    );

    const accepted = await request(app)
      .get('/internal')
      .set('authorization', `Bearer ${createServiceToken('authorized-service')}`);
    const wrongService = await request(app)
      .get('/internal')
      .set('authorization', `Bearer ${createServiceToken('other-service')}`);
    const rejected = await request(app)
      .get('/internal')
      .set('authorization', 'Bearer not-a-service-token');

    expect(accepted.status).toBe(204);
    expect(wrongService.status).toBe(403);
    expect(rejected.status).toBe(401);
  });
});

describe('environment validation', () => {
  it('fails fast for wildcard CORS and short secrets', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PORT', '8000');
    vi.stubEnv('ACCESS_TOKEN_SECRET', 'short');
    vi.stubEnv('REDIS_URL', 'redis://redis:6379');
    vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8001');
    vi.stubEnv('ORGANIZATION_SERVICE_URL', 'http://organization-service:8002');
    vi.stubEnv('ACADEMIC_SERVICE_URL', 'http://academic-service:8003');
    vi.stubEnv('BILLING_SERVICE_URL', 'http://billing-service:8004');
    vi.stubEnv('NOTIFICATION_SERVICE_URL', 'http://notification-service:8005');
    vi.stubEnv('ALLOWED_ORIGINS', '*');
    expect(() => validateServiceEnvironment('gateway')).toThrow('Invalid environment');
  });
});
