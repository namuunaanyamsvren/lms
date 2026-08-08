import crypto from 'crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client-auth';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import authRoutes from '../auth-service/src/routes/auth.routes';
import { clearUserAccessRevocation, errorHandler } from '@lms/shared';
import { installCsrfTestClient } from './helpers/csrf';
import { hashPasswordResetToken } from '../auth-service/src/services/password-reset.service';

const prisma = new PrismaClient();
const testId = crypto.randomUUID();
const organizationId = `auth-test-${testId}`;
const loginEmail = `login-${testId}@example.test`;
const registerEmail = `register-${testId}@example.test`;
const password = 'orbit-meadow-copper-47';

const app = express();
installCsrfTestClient(app);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

describe.sequential('authentication HTTP integration', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          active: true,
          allowRegister: true,
          maxUsers: 100,
          requireEmailVerification: false,
          requirePhoneVerification: false,
        },
      }),
    })));

    await prisma.userAccount.create({
      data: {
        organizationId,
        email: loginEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: Role.STUDENT,
      },
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.userAccount.deleteMany({ where: { organizationId } });
    await prisma.authAuditEvent.deleteMany({ where: { organizationId } });
    await prisma.$disconnect();
  });

  it('logs in with valid credentials without exposing the refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Auth integration test')
      .set('X-Device-Name', 'Integration browser')
      .send({ organizationId, identifier: loginEmail, password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']?.[0]).toContain('lms_refresh=');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('returns one generic response for invalid credentials and audits the failure', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ organizationId, identifier: 'missing@example.test', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Нэвтрэх мэдээлэл буруу эсвэл түр хугацаанд нэвтрэх боломжгүй байна.',
    });
    expect(await prisma.authAuditEvent.count({
      where: { organizationId, eventType: 'LOGIN_FAILURE' },
    })).toBe(1);
  });

  it('registers a user, creates a session, and sets the refresh cookie', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('X-Device-Name', 'Registration browser')
      .send({
        organizationId,
        email: registerEmail,
        password,
        firstName: 'Integration',
        lastName: 'User',
        role: 'student',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']?.[0]).toContain('lms_refresh=');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');

    const registered = await prisma.userAccount.findFirstOrThrow({
      where: { organizationId, email: registerEmail },
      include: { sessions: { include: { refreshTokens: true } } },
    });
    expect(registered.sessions).toHaveLength(1);
    expect(registered.sessions[0].refreshTokens[0].tokenHash).toHaveLength(64);
  });

  it('returns authoritative user state from /me for a valid access token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ organizationId, identifier: loginEmail, password });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(loginEmail);
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('refreshTokens');
    expect(response.body.data).not.toHaveProperty('sessions');
  });

  it('rejects /me with an invalid access token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('returns the same forgot-password response without exposing the raw token', async () => {
    const existing = await request(app)
      .post('/api/auth/forgot-password')
      .send({ organizationId, email: loginEmail });
    const missing = await request(app)
      .post('/api/auth/forgot-password')
      .send({ organizationId, email: `missing-${testId}@example.test` });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body).toEqual(missing.body);
    expect(JSON.stringify(existing.body)).not.toMatch(/resetToken|tokenHash/i);
    expect(await prisma.authAuditEvent.count({
      where: { organizationId, eventType: 'PASSWORD_RESET_REQUESTED' },
    })).toBeGreaterThanOrEqual(2);
  });

  it('atomically consumes a reset token, changes the password, and revokes sessions', async () => {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const user = await prisma.userAccount.findFirstOrThrow({
      where: { organizationId, email: loginEmail },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ organizationId, identifier: loginEmail, password });
    expect(login.status).toBe(200);

    const reset = await prisma.passwordResetToken.create({
      data: {
        organizationId,
        userId: user.id,
        tokenHash: hashPasswordResetToken(rawToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const newPassword = 'granite meadow lantern harbor 47';
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']?.[0]).toContain('lms_refresh=');
    expect(await prisma.passwordResetToken.findUnique({ where: { id: reset.id } }))
      .toMatchObject({ usedAt: expect.any(Date) });
    expect(await prisma.session.count({
      where: { userId: user.id, revokedAt: null },
    })).toBe(0);
    expect(await prisma.authAuditEvent.count({
      where: { userId: user.id, eventType: 'PASSWORD_RESET_COMPLETED' },
    })).toBe(1);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'another secure meadow lantern 48' });
    expect(reuse.status).toBe(400);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ organizationId, identifier: loginEmail, password: newPassword });
    expect(relogin.status).toBe(200);
  });

  it('rejects expired reset tokens and weak replacement passwords', async () => {
    const user = await prisma.userAccount.findFirstOrThrow({
      where: { organizationId, email: loginEmail },
    });
    const expiredRaw = crypto.randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({
      data: {
        organizationId,
        userId: user.id,
        tokenHash: hashPasswordResetToken(expiredRaw),
        expiresAt: new Date(Date.now() - 1),
      },
    });
    const expired = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: expiredRaw, newPassword: 'another secure meadow lantern 49' });
    expect(expired.status).toBe(400);

    const weakRaw = crypto.randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({
      data: {
        organizationId,
        userId: user.id,
        tokenHash: hashPasswordResetToken(weakRaw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const weak = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: weakRaw, newPassword: 'short' });
    expect(weak.status).toBe(400);
  });

  it('anonymizes an account, removes credentials/sessions, and enqueues a non-PII event', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ organizationId, identifier: registerEmail, password });
    expect(login.status).toBe(200);
    const userId = login.body.data.user.id;

    const response = await request(app)
      .delete('/api/auth/privacy/account')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ confirmation: 'DELETE' });
    expect(response.status).toBe(200);
    expect(response.headers['clear-site-data']).toContain('cookies');

    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { id: userId },
      include: {
        sessions: true,
        oauthAccounts: true,
        resetTokens: true,
        verificationTokens: true,
      },
    });
    expect(account).toMatchObject({
      email: `deleted+${userId}@invalid.local`,
      username: null,
      phone: null,
      firstName: null,
      lastName: null,
      isActive: false,
    });
    expect(account.sessions).toEqual([]);
    expect(account.oauthAccounts).toEqual([]);
    expect(account.resetTokens).toEqual([]);
    expect(account.verificationTokens).toEqual([]);

    const outbox = await prisma.authOutboxEvent.findFirstOrThrow({
      where: { eventType: 'user.anonymized' },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox.payload).toEqual(expect.objectContaining({ userId, organizationId }));
    expect(JSON.stringify(outbox.payload)).not.toMatch(new RegExp(registerEmail, 'i'));
    const audit = await prisma.authAuditEvent.findFirstOrThrow({
      where: { organizationId, eventType: 'ACCOUNT_ANONYMIZED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.userId).toBeNull();
    expect(audit.ipAddress).toBeNull();
    await prisma.authOutboxEvent.delete({ where: { id: outbox.id } });
    await clearUserAccessRevocation(organizationId, userId);
  });
});
