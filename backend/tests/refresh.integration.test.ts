import crypto from 'crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import request, { Response as SupertestResponse } from 'supertest';
import { PrismaClient, Role } from '@prisma/client-auth';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import authRoutes from '../auth-service/src/routes/auth.routes';
import { errorHandler, hashRefreshToken } from '@lms/shared';
import { installCsrfTestClient } from './helpers/csrf';
import { createTestOrganization } from './helpers/organization';

const prisma = new PrismaClient();
const testId = crypto.randomUUID();
const organizationId = `refresh-test-${testId}`;
const email = `refresh-${testId}@example.test`;
const password = 'refresh-integration-password-123';

const app = express();
installCsrfTestClient(app);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const cookieHeader = (response: SupertestResponse) => {
  const setCookie = response.headers['set-cookie']?.[0];
  if (!setCookie) throw new Error('Expected refresh cookie');
  return setCookie.split(';')[0];
};

const rawTokenFromCookie = (cookie: string) =>
  decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));

const login = async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ organizationId, identifier: email, password });
  expect(response.status).toBe(200);
  return cookieHeader(response);
};

describe.sequential('refresh-token rotation integration', () => {
  let cleanupOrganization = async () => {};

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
    cleanupOrganization = await createTestOrganization(organizationId, 'refresh-test');
    await prisma.userAccount.create({
      data: {
        organizationId,
        email,
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
    await cleanupOrganization();
  });

  it('rejects a missing refresh cookie', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('atomically rotates a valid token without returning a refresh token', async () => {
    const originalCookie = await login();
    const originalHash = hashRefreshToken(rawTokenFromCookie(originalCookie));
    const before = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: originalHash },
      include: { session: true },
    });

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');

    const oldToken = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: originalHash },
    });
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: before.sessionId },
    });
    expect(oldToken.usedAt).not.toBeNull();
    expect(oldToken.revokedAt).not.toBeNull();
    expect(oldToken.replacedById).not.toBeNull();
    expect(session.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before.session.lastUsedAt.getTime());
    expect(await prisma.authAuditEvent.count({
      where: { organizationId, eventType: 'TOKEN_REFRESH' },
    })).toBeGreaterThan(0);
  });

  it('rejects an expired token', async () => {
    const cookie = await login();
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(rawTokenFromCookie(cookie)) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);
    expect(response.status).toBe(401);
  });

  it('detects a revoked token and revokes its family', async () => {
    const cookie = await login();
    const token = await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(rawTokenFromCookie(cookie)) },
      data: { revoked: true, revokedAt: new Date() },
    });

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);
    expect(response.status).toBe(401);

    const session = await prisma.session.findUniqueOrThrow({ where: { id: token.sessionId } });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokeReason).toBe('Refresh token reuse detected');
  });

  it('detects rotated-token reuse and invalidates the replacement token family', async () => {
    const originalCookie = await login();
    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);
    const replacementCookie = cookieHeader(firstRefresh);

    const reuse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie);
    expect(reuse.status).toBe(401);

    const original = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(rawTokenFromCookie(originalCookie)) },
    });
    const familyTokens = await prisma.refreshToken.findMany({
      where: { familyId: original.familyId },
    });
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: original.sessionId },
    });
    expect(familyTokens.every(token => token.revoked && token.revokedAt)).toBe(true);
    expect(session.revokeReason).toBe('Refresh token reuse detected');
    expect(await prisma.authAuditEvent.count({
      where: { organizationId, eventType: 'TOKEN_REUSE_DETECTED' },
    })).toBeGreaterThan(0);

    const replacementAttempt = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', replacementCookie);
    expect(replacementAttempt.status).toBe(401);
  });

  it('allows only one concurrent refresh and creates one replacement', async () => {
    const originalCookie = await login();
    const original = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(rawTokenFromCookie(originalCookie)) },
    });

    const responses = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', originalCookie),
      request(app).post('/api/auth/refresh').set('Cookie', originalCookie),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 401]);

    const familyTokens = await prisma.refreshToken.findMany({
      where: { familyId: original.familyId },
    });
    expect(familyTokens).toHaveLength(2);
    expect(familyTokens.filter(token => token.id !== original.id)).toHaveLength(1);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: original.sessionId },
    });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokeReason).toBe('Refresh token reuse detected');
  });
});
