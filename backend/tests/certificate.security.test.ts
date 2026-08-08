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

// See grade.security.test.ts for why DATABASE_URL is transiently stubbed
// only around this dynamic import.
let routes: typeof import('../academic-service/src/routes').default;
let issueCertificate: typeof import('../academic-service/src/services/certificate.service').issueCertificate;
let app: express.Express;

const token = (userId: string, organizationId: string, role: string) =>
  signAccessToken({ userId, organizationId, role, sessionId: `session-${userId}` });

const testId = crypto.randomUUID();
const orgAId = `certificate-test-org-a-${testId}`;
const orgBId = `certificate-test-org-b-${testId}`;

let instructorA: string, instructorOrgB: string;
let studentPass: string, studentFail: string;
let courseA1: string, cohortA1: string, enrollmentPass: string;

describe.sequential('certificate issuance and eligibility', () => {
  beforeAll(async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = academicDatabaseUrl();
    routes = (await import('../academic-service/src/routes')).default;
    ({ issueCertificate } = await import('../academic-service/src/services/certificate.service'));
    process.env.DATABASE_URL = previousDatabaseUrl;

    app = express();
    app.use(express.json());
    app.use('/api', routes);
    app.use(errorHandler);

    await prisma.organization.create({ data: { id: orgAId, organizationId: orgAId, name: 'Org A', slug: orgAId } });
    await prisma.organization.create({ data: { id: orgBId, organizationId: orgBId, name: 'Org B', slug: orgBId } });

    const mkUser = async (organizationId: string, role: string, suffix: string) => {
      const user = await prisma.user.create({
        data: { organizationId, role: role as any, email: `${suffix}@example.test`, firstName: suffix, lastName: 'Test' },
      });
      return user.id;
    };

    instructorA = await mkUser(orgAId, 'INSTRUCTOR', `instructor-a-${testId}`);
    instructorOrgB = await mkUser(orgBId, 'INSTRUCTOR', `instructor-orgb-${testId}`);
    studentPass = await mkUser(orgAId, 'STUDENT', `student-pass-${testId}`);
    studentFail = await mkUser(orgAId, 'STUDENT', `student-fail-${testId}`);

    const course = await prisma.course.create({
      data: { organizationId: orgAId, title: 'Certificate Course', code: `CERT-${testId}`, instructorId: instructorA, credits: 3 },
    });
    courseA1 = course.id;

    const cohort = await prisma.cohort.create({
      data: { organizationId: orgAId, courseId: courseA1, name: 'Cohort 1', startDate: new Date(), status: 'ACTIVE' },
    });
    cohortA1 = cohort.id;

    const enrollA = await prisma.enrollment.create({ data: { organizationId: orgAId, userId: studentPass, cohortId: cohortA1 } });
    enrollmentPass = enrollA.id;
    await prisma.enrollment.create({ data: { organizationId: orgAId, userId: studentFail, cohortId: cohortA1 } });

    // A manual, published grade is enough for computeCourseGrade to resolve a letter.
    await prisma.grade.create({
      data: { organizationId: orgAId, studentId: studentPass, courseId: courseA1, score: 95, status: 'PUBLISHED', source: 'MANUAL' },
    });
    await prisma.grade.create({
      data: { organizationId: orgAId, studentId: studentFail, courseId: courseA1, score: 20, status: 'PUBLISHED', source: 'MANUAL' },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  it('blocks a cross-tenant instructor from completing a cohort they do not own', async () => {
    const res = await request(app)
      .post(`/api/cohorts/${cohortA1}/complete`)
      .set('Authorization', `Bearer ${token(instructorOrgB, orgBId, 'INSTRUCTOR')}`);
    expect(res.status).toBe(404);
  });

  it('marks the cohort COMPLETED and auto-issues a certificate only to the passing student', async () => {
    const res = await request(app)
      .post(`/api/cohorts/${cohortA1}/complete`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ studentId: studentPass, outcome: 'issued' }),
        expect.objectContaining({ studentId: studentFail, outcome: 'not-passing' }),
      ]),
    );

    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortA1 } });
    expect(cohort.status).toBe('COMPLETED');

    const cert = await prisma.certificate.findFirst({ where: { organizationId: orgAId, studentId: studentPass, courseId: courseA1 } });
    expect(cert).toBeTruthy();
    expect(cert!.enrollmentId).toBe(enrollmentPass);

    const failCert = await prisma.certificate.findFirst({ where: { organizationId: orgAId, studentId: studentFail, courseId: courseA1 } });
    expect(failCert).toBeNull();
  });

  it('is idempotent: completing an already-completed cohort again reuses the existing certificate', async () => {
    const res = await request(app)
      .post(`/api/cohorts/${cohortA1}/complete`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ studentId: studentPass, outcome: 'already-issued' })]),
    );

    const count = await prisma.certificate.count({ where: { organizationId: orgAId, studentId: studentPass, courseId: courseA1 } });
    expect(count).toBe(1);
  });

  it('never creates two simultaneously-active certificates for the same student+course under a concurrent race', async () => {
    const raceStudent = (await prisma.user.create({
      data: { organizationId: orgAId, role: 'STUDENT', email: `race-${testId}@example.test`, firstName: 'Race', lastName: 'Test' },
    })).id;

    const [first, second] = await Promise.all([
      issueCertificate(orgAId, raceStudent, courseA1),
      issueCertificate(orgAId, raceStudent, courseA1),
    ]);
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();

    const active = await prisma.certificate.findMany({ where: { organizationId: orgAId, studentId: raceStudent, courseId: courseA1, revokedAt: null } });
    expect(active).toHaveLength(1);
  });
});
