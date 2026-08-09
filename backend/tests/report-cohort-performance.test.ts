import crypto from 'crypto';
import { PrismaClient } from '@prisma/client-academic';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const academicDatabaseUrl = () => {
  if (process.env.ACADEMIC_DATABASE_URL) return process.env.ACADEMIC_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lms_db');
  url.searchParams.set('schema', 'academic');
  return url.toString();
};
const prisma = new PrismaClient({ datasources: { db: { url: academicDatabaseUrl() } } });

// See grade.security.test.ts for why DATABASE_URL is transiently stubbed
// only around this dynamic import.
let computeReport: typeof import('../academic-service/src/services/report-data.service').computeReport;

const testId = crypto.randomUUID();
const orgId = `report-cohort-test-org-${testId}`;

let instructorId: string, studentPass: string, studentFail: string;
let courseId: string, moduleId: string, cohortId: string;

describe.sequential('COHORT_PERFORMANCE report', () => {
  beforeAll(async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = academicDatabaseUrl();
    ({ computeReport } = await import('../academic-service/src/services/report-data.service'));
    process.env.DATABASE_URL = previousDatabaseUrl;

    await prisma.organization.create({ data: { id: orgId, organizationId: orgId, name: 'Org', slug: orgId } });

    const mkUser = async (role: string, suffix: string) => (await prisma.user.create({
      data: { organizationId: orgId, role: role as any, email: `${suffix}@example.test`, firstName: suffix, lastName: 'Test' },
    })).id;

    instructorId = await mkUser('INSTRUCTOR', `instructor-${testId}`);
    studentPass = await mkUser('STUDENT', `student-pass-${testId}`);
    studentFail = await mkUser('STUDENT', `student-fail-${testId}`);

    const course = await prisma.course.create({
      data: { organizationId: orgId, title: 'Report Course', code: `REPCRS-${testId}`, instructorId, credits: 3 },
    });
    courseId = course.id;
    const mod = await prisma.module.create({ data: { organizationId: orgId, courseId, title: 'Module 1' } });
    moduleId = mod.id;

    const cohort = await prisma.cohort.create({ data: { organizationId: orgId, courseId, name: 'Cohort 1', startDate: new Date(), status: 'ACTIVE' } });
    cohortId = cohort.id;
    await prisma.enrollment.create({ data: { organizationId: orgId, userId: studentPass, cohortId } });
    await prisma.enrollment.create({ data: { organizationId: orgId, userId: studentFail, cohortId } });

    // Attendance: studentPass 3/4 present (75%), studentFail 1/4 present (25%).
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'];
    const passStatuses = ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT'];
    const failStatuses = ['PRESENT', 'ABSENT', 'ABSENT', 'ABSENT'];
    for (let i = 0; i < dates.length; i += 1) {
      await prisma.attendance.create({ data: { organizationId: orgId, cohortId, studentId: studentPass, date: new Date(dates[i]), status: passStatuses[i] as any } });
      await prisma.attendance.create({ data: { organizationId: orgId, cohortId, studentId: studentFail, date: new Date(dates[i]), status: failStatuses[i] as any } });
    }

    // One assignment; only studentPass submits it.
    const assignment = await prisma.assignment.create({
      data: { organizationId: orgId, moduleId, title: 'HW 1', description: 'x', dueDate: new Date(), maxPoints: 100 },
    });
    const submission = await prisma.submission.create({
      data: { organizationId: orgId, assignmentId: assignment.id, studentId: studentPass, status: 'SUBMITTED' },
    });
    await prisma.grade.create({
      data: { organizationId: orgId, studentId: studentPass, submissionId: submission.id, courseId, score: 90, status: 'PUBLISHED' },
    });
    // studentFail gets a low manual grade so their course grade resolves to 'F'.
    await prisma.grade.create({
      data: { organizationId: orgId, studentId: studentFail, courseId, score: 20, status: 'PUBLISHED', source: 'MANUAL' },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it('scopes attendance, assignment completion, and pass rate to exactly this cohort\'s roster', async () => {
    const table = await computeReport(orgId, { userId: instructorId, role: 'INSTRUCTOR' }, 'COHORT_PERFORMANCE', { cohortId });
    expect(table.rows).toHaveLength(1);
    const row = table.rows[0] as any;

    expect(row.students).toBe(2);
    // (3 present + 1 present) / 8 total attendance records = 50%.
    expect(row.attendancePct).toBe(50);
    // 1 submission out of (1 assignment * 2 students) = 50%.
    expect(row.assignmentCompletionPct).toBe(50);
    // studentPass (90, passing) + studentFail (20, failing) = 50% pass rate.
    expect(row.passRatePct).toBe(50);
  });

  it('filters to a single cohort when cohortId is provided, excluding other cohorts of the same course', async () => {
    const otherCohort = await prisma.cohort.create({ data: { organizationId: orgId, courseId, name: 'Cohort 2', startDate: new Date(), status: 'ACTIVE' } });
    const table = await computeReport(orgId, { userId: instructorId, role: 'INSTRUCTOR' }, 'COHORT_PERFORMANCE', { cohortId: otherCohort.id });
    expect(table.rows).toHaveLength(1);
    expect((table.rows[0] as any).students).toBe(0);
  });
});
