import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  applyHttpSecurity,
  authMiddleware,
  errorHandler,
  signAccessToken,
  tenantMiddleware,
  requireRole,
} from '@lms/shared';

describe('shared HTTP middleware', () => {
  it('authenticates and scopes the tenant from the verified token', async () => {
    const app = express();
    applyHttpSecurity(app);
    app.get('/private', authMiddleware, tenantMiddleware, (req, res) => {
      res.json({ userId: req.user?.userId, organizationId: req.organizationId });
    });
    app.use(errorHandler);
    const token = signAccessToken({
      userId: 'user-1',
      organizationId: 'trusted-org',
      role: 'STUDENT',
      sessionId: 'session-1',
    });
    const response = await request(app)
      .get('/private')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', 'attacker-org');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'user-1', organizationId: 'trusted-org' });
  });

  it('rejects a protected request without a token', async () => {
    const app = express();
    applyHttpSecurity(app);
    app.get('/private', authMiddleware, (_req, res) => res.sendStatus(204));
    app.use(errorHandler);
    const response = await request(app).get('/private');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('blocks vertical privilege escalation from a student token', async () => {
    const app = express();
    applyHttpSecurity(app);
    app.post(
      '/admin-only',
      authMiddleware,
      tenantMiddleware,
      requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
      (_req, res) => res.sendStatus(204),
    );
    app.use(errorHandler);
    const token = signAccessToken({
      userId: 'student-1',
      organizationId: 'org-1',
      role: 'STUDENT',
      sessionId: 'session-1',
    });
    const response = await request(app)
      .post('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('sets Helmet headers and rate limits repeated requests', async () => {
    const app = express();
    applyHttpSecurity(app, { rateLimitMax: 1, windowMs: 60_000 });
    app.get('/health', (_req, res) => res.json({ ok: true }));
    const first = await request(app).get('/health');
    const second = await request(app).get('/health');
    expect(first.headers['x-content-type-options']).toBe('nosniff');
    expect(first.headers['content-security-policy']).toContain("default-src 'none'");
    expect(first.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(first.headers['referrer-policy']).toBe('no-referrer');
    expect(first.headers['permissions-policy']).toContain('camera=()');
    expect(first.headers['x-powered-by']).toBeUndefined();
    expect(first.headers['ratelimit-limit']).toBe('1');
    expect(second.status).toBe(429);
  });

  it('escapes HTML-significant characters in JSON responses', async () => {
    const app = express();
    applyHttpSecurity(app);
    app.get('/echo', (_req, res) => res.json({ value: '<script>alert(1)</script>' }));
    const response = await request(app).get('/echo');
    expect(response.text).not.toContain('<script>');
    expect(response.body.value).toBe('<script>alert(1)</script>');
  });

  it('does not leak Prisma details or stack traces for unhandled errors', async () => {
    const app = express();
    app.get('/boom', () => {
      const error = new Error(
        'PrismaClientKnownRequestError: Unique constraint failed on the fields: (`passwordHash`)',
      );
      error.stack = 'Error: boom\n    at secretFile (/private/app/src/controllers/auth.controller.ts:42:13)';
      throw error;
    });
    app.use(errorHandler);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|passwordHash|secretFile|stack|controllers/);
  });
});
