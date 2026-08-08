import crypto from 'crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import request, { Response as SupertestResponse } from 'supertest';
import { PrismaClient, Role } from '@prisma/client-auth';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import authRoutes from '../auth-service/src/routes/auth.routes';
import { errorHandler, verifyAccessToken } from '@lms/shared';
import { installCsrfTestClient } from './helpers/csrf';
import { createTestOrganization } from './helpers/organization';

const prisma = new PrismaClient();
const testId = crypto.randomUUID();
const organizationId = `sessions-test-${testId}`;
const email = `sessions-${testId}@example.test`;
const otherEmail = `sessions-other-${testId}@example.test`;
const password = 'session-management-password-123';

const app = express();
installCsrfTestClient(app);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const cookieHeader = (response: SupertestResponse) => {
  const cookie = response.headers['set-cookie']?.[0];
  if (!cookie) throw new Error('Expected refresh cookie');
  return cookie.split(';')[0];
};

const login = async (identifier = email, deviceName = 'Session test device') => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('X-Device-Name', deviceName)
    .send({ organizationId, identifier, password });
  expect(response.status).toBe(200);
  const accessToken = response.body.data.token as string;
  return {
    accessToken,
    cookie: cookieHeader(response),
    sessionId: verifyAccessToken(accessToken).sessionId,
  };
};

type LoginResult = Awaited<ReturnType<typeof login>>;
let otherUserSession: LoginResult;
let logoutAllCurrentSession: LoginResult;

describe.sequential('session-management HTTP integration', () => {
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
    cleanupOrganization = await createTestOrganization(organizationId, 'sessions-test');
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.userAccount.createMany({
      data: [
        { organizationId, email, passwordHash, role: Role.STUDENT },
        { organizationId, email: otherEmail, passwordHash, role: Role.STUDENT },
      ],
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.userAccount.deleteMany({ where: { organizationId } });
    await prisma.authAuditEvent.deleteMany({ where: { organizationId } });
    await prisma.$disconnect();
    await cleanupOrganization();
  });

  it('lists only safe active-session metadata and marks the current session', async () => {
    await login(email, 'Older laptop');
    const current = await login(email, 'Current phone');

    const response = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    const currentDto = response.body.data.find(
      (session: { id: string }) => session.id === current.sessionId,
    );
    expect(currentDto.current).toBe(true);
    expect(currentDto.deviceName).toBe('Current phone');
    for (const session of response.body.data) {
      expect(Object.keys(session).sort()).toEqual([
        'createdAt',
        'current',
        'deviceName',
        'expiresAt',
        'id',
        'ipAddress',
        'lastUsedAt',
        'userAgent',
      ]);
      expect(session).not.toHaveProperty('tokenFamilyId');
      expect(session).not.toHaveProperty('refreshTokens');
      expect(session).not.toHaveProperty('tokenHash');
    }
  });

  it('does not allow revoking another user session', async () => {
    const owner = await login();
    const other = await login(otherEmail);
    otherUserSession = other;

    const response = await request(app)
      .delete(`/api/auth/sessions/${other.sessionId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(response.status).toBe(404);
    expect((await prisma.session.findUniqueOrThrow({
      where: { id: other.sessionId },
    })).revokedAt).toBeNull();
  });

  it('revokes a non-current owned session without clearing the current cookie', async () => {
    const oldSession = await login(email, 'Old browser');
    const current = await login(email, 'Current browser');

    const response = await request(app)
      .delete(`/api/auth/sessions/${oldSession.sessionId}`)
      .set('Authorization', `Bearer ${current.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await prisma.session.findUniqueOrThrow({
      where: { id: oldSession.sessionId },
    })).revokedAt).not.toBeNull();
    expect((await prisma.session.findUniqueOrThrow({
      where: { id: current.sessionId },
    })).revokedAt).toBeNull();
  });

  it('revokes the current session and clears its cookie', async () => {
    const current = await login();
    const response = await request(app)
      .delete(`/api/auth/sessions/${current.sessionId}`)
      .set('Authorization', `Bearer ${current.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']?.[0]).toContain('lms_refresh=;');
    expect((await prisma.session.findUniqueOrThrow({
      where: { id: current.sessionId },
    })).revokedAt).not.toBeNull();

    const repeated = await request(app)
      .delete(`/api/auth/sessions/${current.sessionId}`)
      .set('Authorization', `Bearer ${current.accessToken}`);
    expect(repeated.status).toBe(200);
    expect(repeated.body.message).toBe('Session аль хэдийн цуцлагдсан.');
  });

  it('returns 400 for an invalid session ID and 404 for a missing session', async () => {
    const current = await login();
    logoutAllCurrentSession = current;
    const invalid = await request(app)
      .delete('/api/auth/sessions/not-a-uuid')
      .set('Authorization', `Bearer ${current.accessToken}`);
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .delete(`/api/auth/sessions/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${current.accessToken}`);
    expect(missing.status).toBe(404);
  });

  it('logs out the cookie session and remains idempotent', async () => {
    const current = await login();
    const first = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', current.cookie);
    const second = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', current.cookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers['set-cookie']?.[0]).toContain('lms_refresh=;');
    expect((await prisma.session.findUniqueOrThrow({
      where: { id: current.sessionId },
    })).revokeReason).toBe('User logout');
    expect(await prisma.authAuditEvent.count({
      where: {
        organizationId,
        userId: verifyAccessToken(current.accessToken).userId,
        eventType: 'LOGOUT',
      },
    })).toBe(1);
  });

  it('logs out all current-user sessions without affecting another user', async () => {
    const currentUserId = verifyAccessToken(logoutAllCurrentSession.accessToken).userId;

    const response = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${logoutAllCurrentSession.accessToken}`)
      .set('Cookie', logoutAllCurrentSession.cookie);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']?.[0]).toContain('lms_refresh=;');
    expect(await prisma.session.count({
      where: { userId: currentUserId, revokedAt: null },
    })).toBe(0);
    expect((await prisma.session.findUniqueOrThrow({
      where: { id: otherUserSession.sessionId },
    })).revokedAt).toBeNull();
    expect(await prisma.authAuditEvent.count({
      where: { userId: currentUserId, eventType: 'LOGOUT_ALL' },
    })).toBe(1);
  });
});
