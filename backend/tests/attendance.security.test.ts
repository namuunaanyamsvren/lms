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
let computeNotificationPayload: typeof import('../academic-service/src/services/attendance.service').computeNotificationPayload;
let app: express.Express;

const token = (userId: string, organizationId: string, role: string) =>
  signAccessToken({ userId, organizationId, role, sessionId: `session-${userId}` });

const testId = crypto.randomUUID();
const orgAId = `attendance-test-org-a-${testId}`;
const orgBId = `attendance-test-org-b-${testId}`;

let instructorA: string, instructorB2: string, instructorOrgB: string;
let studentA1: string, studentA2: string, parentA: string;
let courseA1: string, cohortA1: string;

describe.sequential('attendance authorization and ownership', () => {
  beforeAll(async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = academicDatabaseUrl();
    routes = (await import('../academic-service/src/routes')).default;
    ({ computeNotificationPayload } = await import('../academic-service/src/services/attendance.service'));
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
    instructorB2 = await mkUser(orgAId, 'INSTRUCTOR', `instructor-b2-${testId}`);
    instructorOrgB = await mkUser(orgBId, 'INSTRUCTOR', `instructor-orgb-${testId}`);
    studentA1 = await mkUser(orgAId, 'STUDENT', `student-a1-${testId}`);
    studentA2 = await mkUser(orgAId, 'STUDENT', `student-a2-${testId}`);
    parentA = await mkUser(orgAId, 'PARENT', `parent-a-${testId}`);

    const course1 = await prisma.course.create({
      data: { organizationId: orgAId, title: 'Math', code: `MATH-${testId}`, instructorId: instructorA },
    });
    courseA1 = course1.id;
    // A second course owned by a different instructor, same org — used to prove ownership scoping.
    await prisma.course.create({
      data: { organizationId: orgAId, title: 'Science', code: `SCI-${testId}`, instructorId: instructorB2 },
    });

    const cohort = await prisma.cohort.create({ data: { organizationId: orgAId, courseId: courseA1, name: 'Cohort 1', startDate: new Date() } });
    cohortA1 = cohort.id;
    await prisma.enrollment.create({ data: { organizationId: orgAId, userId: studentA1, cohortId: cohortA1 } });
    await prisma.enrollment.create({ data: { organizationId: orgAId, userId: studentA2, cohortId: cohortA1 } });

    await prisma.guardian.create({
      data: { organizationId: orgAId, parentUserId: parentA, studentUserId: studentA1, status: 'APPROVED' },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  it('blocks a cross-tenant instructor from batch-recording attendance', async () => {
    const res = await request(app)
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${token(instructorOrgB, orgBId, 'INSTRUCTOR')}`)
      .send({ cohortId: cohortA1, date: '2026-08-01', records: [{ studentId: studentA1, status: 'PRESENT' }] });
    expect(res.status).toBe(404);
  });

  it('blocks an instructor from recording attendance for a cohort they do not own', async () => {
    const res = await request(app)
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${token(instructorB2, orgAId, 'INSTRUCTOR')}`)
      .send({ cohortId: cohortA1, date: '2026-08-01', records: [{ studentId: studentA1, status: 'PRESENT' }] });
    expect(res.status).toBe(404);
  });

  it('upserts on a duplicate (cohort, student, date) instead of creating a second row', async () => {
    const day = '2026-08-02';
    const first = await request(app)
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ cohortId: cohortA1, date: day, records: [{ studentId: studentA1, status: 'ABSENT', note: 'sick' }] });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ cohortId: cohortA1, date: day, records: [{ studentId: studentA1, status: 'LATE' }] });
    expect(second.status).toBe(201);
    expect(second.body.data[0].id).toBe(first.body.data[0].id);
    expect(second.body.data[0].status).toBe('LATE');

    const rows = await prisma.attendance.findMany({ where: { organizationId: orgAId, cohortId: cohortA1, studentId: studentA1, date: new Date(day) } });
    expect(rows).toHaveLength(1);

    const history = await prisma.attendanceHistory.findMany({ where: { organizationId: orgAId, attendanceId: first.body.data[0].id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ previousStatus: 'ABSENT', newStatus: 'LATE' });
  });

  it('records history on a direct PUT status change with a reason', async () => {
    const created = await request(app)
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ cohortId: cohortA1, date: '2026-08-03', records: [{ studentId: studentA2, status: 'PRESENT' }] });
    const attendanceId = created.body.data[0].id;

    const updated = await request(app)
      .put(`/api/attendance/${attendanceId}`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ status: 'EXCUSED', reason: 'Doctor note provided' });
    expect(updated.status).toBe(200);

    const history = await request(app)
      .get(`/api/attendance/${attendanceId}/history`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`);
    expect(history.status).toBe(200);
    expect(history.body.data[0]).toMatchObject({ previousStatus: 'PRESENT', newStatus: 'EXCUSED', reason: 'Doctor note provided' });
  });

  it('lets an approved guardian see their linked child\'s attendance but not an unlinked student\'s', async () => {
    const linked = await request(app)
      .get(`/api/attendance?studentId=${studentA1}`)
      .set('Authorization', `Bearer ${token(parentA, orgAId, 'PARENT')}`);
    expect(linked.status).toBe(200);
    expect(linked.body.data.every((row: any) => row.studentId === studentA1)).toBe(true);
    expect(linked.body.data.length).toBeGreaterThan(0);

    const unlinked = await request(app)
      .get(`/api/attendance?studentId=${studentA2}`)
      .set('Authorization', `Bearer ${token(parentA, orgAId, 'PARENT')}`);
    expect(unlinked.status).toBe(200);
    expect(unlinked.body.data).toEqual([]);
  });

  it('flags thresholdCrossed once a student passes 3 unexcused absences', async () => {
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await request(app)
        .post('/api/attendance/batch')
        .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
        .send({ cohortId: cohortA1, date: day, records: [{ studentId: studentA2, status: 'ABSENT' }] });
    }

    const result = await prisma.$transaction(tx => computeNotificationPayload(tx, orgAId, cohortA1, studentA2, 'ABSENT', 3));
    expect(result.absenceCount).toBeGreaterThanOrEqual(3);
    expect(result.thresholdCrossed).toBe(true);
    expect(result.instructorId).toBe(instructorA);

    const belowThreshold = await prisma.$transaction(tx => computeNotificationPayload(tx, orgAId, cohortA1, studentA1, 'ABSENT', 3));
    expect(belowThreshold.thresholdCrossed).toBe(false);
    expect(belowThreshold.instructorId).toBeNull();

    // A configurable, higher threshold on the same absence history should not fire yet.
    const withHigherThreshold = await prisma.$transaction(tx => computeNotificationPayload(tx, orgAId, cohortA1, studentA2, 'ABSENT', 5));
    expect(withHigherThreshold.thresholdCrossed).toBe(false);
    expect(withHigherThreshold.instructorId).toBeNull();
  });
});
