import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client-academic';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler, signAccessToken } from '@lms/shared';

const academicDatabaseUrl = () => {
  if (process.env.ACADEMIC_DATABASE_URL) return process.env.ACADEMIC_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lms_db');
  url.searchParams.set('schema', 'academic');
  return url.toString();
};

const prisma = new PrismaClient({ datasources: { db: { url: academicDatabaseUrl() } } });

let routes: typeof import('../academic-service/src/routes').default;
let app: express.Express;

const token = (userId: string, organizationId: string, role: string) =>
  signAccessToken({ userId, organizationId, role, sessionId: `session-${userId}` });

const testId = crypto.randomUUID();
const orgId = `guardian-test-org-${testId}`;
let parentId: string;
let secondParentId: string;

const createUser = async (role: 'PARENT' | 'STUDENT', suffix: string, extra = {}) => {
  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      role,
      email: `${suffix}@example.test`,
      firstName: suffix,
      lastName: 'Test',
      ...extra,
    },
  });
  return user.id;
};

describe.sequential('guardian self-service linking', () => {
  beforeAll(async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = academicDatabaseUrl();
    routes = (await import('../academic-service/src/routes')).default;
    process.env.DATABASE_URL = previousDatabaseUrl;

    app = express();
    app.use(express.json());
    app.use('/api', routes);
    app.use(errorHandler);

    await prisma.organization.create({ data: { id: orgId, organizationId: orgId, name: 'Guardian Test Org', slug: orgId } });
    parentId = await createUser('PARENT', `parent-${testId}`);
    secondParentId = await createUser('PARENT', `second-parent-${testId}`);
    await createUser('STUDENT', `student-${testId}`, {
      studentId: `STU-${testId}`,
      guardianLinkCode: `LINK-${testId}`,
    });
    await createUser('STUDENT', `pending-student-${testId}`, {
      studentId: `PENDING-${testId}`,
      guardianLinkCode: `PENDING-LINK-${testId}`,
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('keeps a student-code-only parent request pending for staff approval', async () => {
    const res = await request(app)
      .post('/api/guardians')
      .set('Authorization', `Bearer ${token(parentId, orgId, 'PARENT')}`)
      .send({ studentCode: `PENDING-${testId}` });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.studentUser.studentId).toBe(`PENDING-${testId}`);
  });

  it('does not link or reveal a child when the guardian link code is wrong', async () => {
    const res = await request(app)
      .post('/api/guardians')
      .set('Authorization', `Bearer ${token(parentId, orgId, 'PARENT')}`)
      .send({ studentCode: `STU-${testId}`, guardianLinkCode: 'WRONG-CODE' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Student/link code not found');
  });

  it('approves the guardian link immediately when both codes match', async () => {
    const res = await request(app)
      .post('/api/guardians')
      .set('Authorization', `Bearer ${token(parentId, orgId, 'PARENT')}`)
      .send({ studentCode: `STU-${testId}`, guardianLinkCode: `LINK-${testId}` });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.respondedAt).toBeTruthy();
  });

  it('upgrades an existing pending link when the parent later enters the correct code', async () => {
    const pending = await request(app)
      .post('/api/guardians')
      .set('Authorization', `Bearer ${token(secondParentId, orgId, 'PARENT')}`)
      .send({ studentCode: `STU-${testId}` });
    expect(pending.status).toBe(201);
    expect(pending.body.data.status).toBe('PENDING');

    const approved = await request(app)
      .post('/api/guardians')
      .set('Authorization', `Bearer ${token(secondParentId, orgId, 'PARENT')}`)
      .send({ studentCode: `STU-${testId}`, guardianLinkCode: `LINK-${testId}` });

    expect(approved.status).toBe(200);
    expect(approved.body.data.id).toBe(pending.body.data.id);
    expect(approved.body.data.status).toBe('APPROVED');
  });
});
