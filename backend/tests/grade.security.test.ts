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

// academic-service's own controllers/services construct `new PrismaClient()`
// with no arguments, so they read process.env.DATABASE_URL at import time.
// vitest.config.ts defaults that to the auth schema. Flip it to the academic
// schema only for the moment these modules are first (dynamically) imported,
// then restore it immediately — the modules keep the client they built, and
// every other test file's ambient DATABASE_URL is unaffected.
let routes: typeof import('../academic-service/src/routes').default;
let computeCourseGrade: typeof import('../academic-service/src/services/grade.service').computeCourseGrade;
let letterToGradePoints: typeof import('../academic-service/src/services/grade.service').letterToGradePoints;
let percentToLetter: typeof import('../academic-service/src/services/grade.service').percentToLetter;
let app: express.Express;

const token = (userId: string, organizationId: string, role: string) =>
  signAccessToken({ userId, organizationId, role, sessionId: `session-${userId}` });

const testId = crypto.randomUUID();
const orgAId = `grade-test-org-a-${testId}`;
const orgBId = `grade-test-org-b-${testId}`;

let instructorA: string, instructorB2: string, instructorOrgB: string;
let studentA1: string, studentA2: string, parentA: string, orgAdminA: string;
let courseA1: string, courseA2: string, moduleA1: string;
let categoryHomework: string, categoryExam: string;
let assignmentA1: string, submissionA1: string, gradeA1: string;

describe.sequential('grade authorization and ownership', () => {
  beforeAll(async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = academicDatabaseUrl();
    routes = (await import('../academic-service/src/routes')).default;
    ({ computeCourseGrade, letterToGradePoints, percentToLetter } = await import('../academic-service/src/services/grade.service'));
    process.env.DATABASE_URL = previousDatabaseUrl;

    app = express();
    app.use(express.json());
    app.use('/api', routes);
    app.use(errorHandler);

    await prisma.organization.create({ data: { id: orgAId, organizationId: orgAId, name: 'Org A', slug: orgAId } });
    await prisma.organization.create({ data: { id: orgBId, organizationId: orgBId, name: 'Org B', slug: orgBId } });

    const mkUser = async (organizationId: string, role: string, suffix: string) => {
      const user = await prisma.user.create({
        data: {
          organizationId, role: role as any, email: `${suffix}@example.test`,
          firstName: suffix, lastName: 'Test',
        },
      });
      return user.id;
    };

    instructorA = await mkUser(orgAId, 'INSTRUCTOR', `instructor-a-${testId}`);
    instructorB2 = await mkUser(orgAId, 'INSTRUCTOR', `instructor-b2-${testId}`);
    instructorOrgB = await mkUser(orgBId, 'INSTRUCTOR', `instructor-orgb-${testId}`);
    studentA1 = await mkUser(orgAId, 'STUDENT', `student-a1-${testId}`);
    studentA2 = await mkUser(orgAId, 'STUDENT', `student-a2-${testId}`);
    parentA = await mkUser(orgAId, 'PARENT', `parent-a-${testId}`);
    orgAdminA = await mkUser(orgAId, 'ORG_ADMIN', `org-admin-a-${testId}`);

    const course1 = await prisma.course.create({
      data: { organizationId: orgAId, title: 'Math', code: `MATH-${testId}`, instructorId: instructorA, credits: 3 },
    });
    courseA1 = course1.id;
    const course2 = await prisma.course.create({
      data: { organizationId: orgAId, title: 'Science', code: `SCI-${testId}`, instructorId: instructorB2, credits: 3 },
    });
    courseA2 = course2.id;

    const module1 = await prisma.module.create({ data: { organizationId: orgAId, courseId: courseA1, title: 'Module 1' } });
    moduleA1 = module1.id;

    const homework = await prisma.gradeCategory.create({ data: { organizationId: orgAId, courseId: courseA1, name: 'Homework', weightPercent: 40 } });
    categoryHomework = homework.id;
    const exam = await prisma.gradeCategory.create({ data: { organizationId: orgAId, courseId: courseA1, name: 'Exam', weightPercent: 60 } });
    categoryExam = exam.id;

    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgAId, moduleId: moduleA1, title: 'HW 1', description: 'x',
        dueDate: new Date(), maxPoints: 100, categoryId: categoryHomework,
      },
    });
    assignmentA1 = assignment.id;

    const submission = await prisma.submission.create({
      data: { organizationId: orgAId, assignmentId: assignmentA1, studentId: studentA1, status: 'SUBMITTED' },
    });
    submissionA1 = submission.id;

    const cohort = await prisma.cohort.create({ data: { organizationId: orgAId, courseId: courseA1, name: 'Cohort 1', startDate: new Date() } });
    await prisma.enrollment.create({ data: { organizationId: orgAId, userId: studentA1, cohortId: cohort.id } });

    await prisma.guardian.create({
      data: { organizationId: orgAId, parentUserId: parentA, studentUserId: studentA1, status: 'APPROVED' },
    });

    const grade = await prisma.grade.create({
      data: {
        organizationId: orgAId, studentId: studentA1, submissionId: submissionA1, courseId: courseA1,
        categoryId: categoryHomework, score: 80, status: 'PUBLISHED',
      },
    });
    gradeA1 = grade.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  it('hides another organization\'s grade categories from a cross-tenant instructor', async () => {
    const res = await request(app)
      .get(`/api/courses/${courseA1}/grade-categories`)
      .set('Authorization', `Bearer ${token(instructorOrgB, orgBId, 'INSTRUCTOR')}`);
    expect(res.status).toBe(404);
  });

  it('blocks an instructor from managing categories on a course they do not own', async () => {
    const res = await request(app)
      .post(`/api/courses/${courseA1}/grade-categories`)
      .set('Authorization', `Bearer ${token(instructorB2, orgAId, 'INSTRUCTOR')}`)
      .send({ name: 'Sneaky', weightPercent: 10 });
    expect(res.status).toBe(404);
  });

  it('lets the owning instructor manage categories on their own course', async () => {
    const res = await request(app)
      .get(`/api/courses/${courseA1}/grade-categories`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects a student trying to create a manual grade', async () => {
    const res = await request(app)
      .post('/api/grades/manual')
      .set('Authorization', `Bearer ${token(studentA1, orgAId, 'STUDENT')}`)
      .send({ courseId: courseA1, studentId: studentA1, score: 90, status: 'DRAFT' });
    expect(res.status).toBe(403);
  });

  it('keeps a draft manual grade out of the aggregated course grade until published', async () => {
    const created = await request(app)
      .post('/api/grades/manual')
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ courseId: courseA1, studentId: studentA2, categoryId: categoryExam, score: 95, status: 'DRAFT' });
    expect(created.status).toBe(201);
    const gradeId = created.body.data.id;

    const before = await computeCourseGrade(orgAId, studentA2, courseA1);
    expect(before.hasGrades).toBe(false);

    const published = await request(app)
      .post(`/api/grades/${gradeId}/publish`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`);
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('PUBLISHED');

    const after = await computeCourseGrade(orgAId, studentA2, courseA1);
    expect(after.hasGrades).toBe(true);
    expect(after.percent).toBe(95);
  });

  it('records grade history with a reason when an instructor edits a score', async () => {
    const update = await request(app)
      .put(`/api/grades/${gradeA1}`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ score: 85, reason: 'Regrade after appeal' });
    expect(update.status).toBe(200);

    const history = await request(app)
      .get(`/api/grades/${gradeA1}/history`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`);
    expect(history.status).toBe(200);
    expect(history.body.data[0]).toMatchObject({ previousScore: 80, newScore: 85, reason: 'Regrade after appeal' });
  });

  it('lets a student appeal only their own published grade, and approval does not auto-change the score', async () => {
    const foreignAppeal = await request(app)
      .post(`/api/grades/${gradeA1}/appeals`)
      .set('Authorization', `Bearer ${token(studentA2, orgAId, 'STUDENT')}`)
      .send({ reason: 'Not mine' });
    expect(foreignAppeal.status).toBe(404);

    const ownAppeal = await request(app)
      .post(`/api/grades/${gradeA1}/appeals`)
      .set('Authorization', `Bearer ${token(studentA1, orgAId, 'STUDENT')}`)
      .send({ reason: 'I deserve more points' });
    expect(ownAppeal.status).toBe(201);
    const appealId = ownAppeal.body.data.id;

    const resolved = await request(app)
      .put(`/api/grades/appeals/${appealId}`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ status: 'APPROVED', resolutionNote: 'Will regrade manually' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('APPROVED');

    const gradeAfter = await prisma.grade.findUnique({ where: { id: gradeA1 } });
    expect(gradeAfter?.score).toBe(85);
  });

  it('lets an approved guardian view a linked child\'s transcript but not an unlinked student\'s', async () => {
    const linked = await request(app)
      .get(`/api/students/${studentA1}/transcript`)
      .set('Authorization', `Bearer ${token(parentA, orgAId, 'PARENT')}`);
    expect(linked.status).toBe(200);
    expect(linked.body.data.courses.some((c: any) => c.courseId === courseA1)).toBe(true);

    const unlinked = await request(app)
      .get(`/api/students/${studentA2}/transcript`)
      .set('Authorization', `Bearer ${token(parentA, orgAId, 'PARENT')}`);
    expect(unlinked.status).toBe(403);
  });

  it('rejects unknown students and over-max scores row by row on bulk import, without failing the whole file', async () => {
    const csv = [
      'studentEmail,score,feedback',
      `student-a1-${testId}@example.test,999,too high`,
      `nobody-${testId}@example.test,50,unknown student`,
    ].join('\n');
    const res = await request(app)
      .post(`/api/assignments/${assignmentA1}/grades/bulk-import`)
      .set('Authorization', `Bearer ${token(instructorA, orgAId, 'INSTRUCTOR')}`)
      .send({ csv });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ rowNumber: 2, status: 'error' }),
      expect.objectContaining({ rowNumber: 3, status: 'error' }),
    ]);
  });

  it('applies weighted category math when computing a course grade', async () => {
    // gradeA1 (Homework, weight 40) is now 85%. Add an Exam-category grade at 60%.
    const examSubmission = await prisma.submission.create({
      data: { organizationId: orgAId, assignmentId: assignmentA1, studentId: studentA1, status: 'SUBMITTED', attemptNumber: 2 },
    });
    await prisma.grade.create({
      data: {
        organizationId: orgAId, studentId: studentA1, submissionId: examSubmission.id, courseId: courseA1,
        categoryId: categoryExam, score: 60, status: 'PUBLISHED',
      },
    });

    const result = await computeCourseGrade(orgAId, studentA1, courseA1);
    // (85 * 40 + 60 * 60) / 100 = 70
    expect(result.percent).toBe(70);
  });

  it('folds an ATTENDANCE-source category into the weighted course grade', async () => {
    const cohort = await prisma.cohort.findFirstOrThrow({ where: { organizationId: orgAId, courseId: courseA1 } });
    const attendanceCategory = await prisma.gradeCategory.create({
      data: { organizationId: orgAId, courseId: courseA1, name: 'Attendance', weightPercent: 20, source: 'ATTENDANCE' },
    });
    // 3 PRESENT out of 4 records for studentA1 in courseA1's cohort => 75% attendance.
    const records: Array<[string, 'PRESENT' | 'ABSENT']> = [
      ['2026-01-01', 'PRESENT'], ['2026-01-02', 'PRESENT'], ['2026-01-03', 'PRESENT'], ['2026-01-04', 'ABSENT'],
    ];
    for (const [date, status] of records) {
      await prisma.attendance.create({
        data: { organizationId: orgAId, cohortId: cohort.id, studentId: studentA1, date: new Date(date), status },
      });
    }

    const result = await computeCourseGrade(orgAId, studentA1, courseA1);
    // Homework 85%*40 + Exam 60%*60 + Attendance 75%*20, over weight 120.
    expect(result.percent).toBeCloseTo((85 * 40 + 60 * 60 + 75 * 20) / 120, 2);

    await prisma.gradeCategory.delete({ where: { id: attendanceCategory.id } });
  });

  it('maps percent to letter and grade points using the fallback scale', () => {
    expect(percentToLetter(98, {})).toBe('A+');
    expect(percentToLetter(70, {})).toBe('C-');
    expect(percentToLetter(0, {})).toBe('F');
    expect(letterToGradePoints('A+')).toBe(4.0);
    expect(letterToGradePoints('C-')).toBe(1.7);
    expect(letterToGradePoints('F')).toBe(0);
  });

  it('honors an organization-specific grading scale over the default', () => {
    const strictScale = { HIGH_PASS: 85, PASS: 60, FAIL: 0 };
    expect(percentToLetter(90, strictScale)).toBe('HIGH_PASS');
    expect(percentToLetter(70, strictScale)).toBe('PASS');
    expect(percentToLetter(30, strictScale)).toBe('FAIL');
  });
});
