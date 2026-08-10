import { AppError, EVENTS } from '@lms/shared';
import { getOrganizationGradingScale } from './organization-grading-policy.service';
import { getOrganizationAttendancePolicy } from './organization-attendance-policy.service';
import { enqueueAcademicEvent } from './event-outbox.service';
import { parseCsv, serializeCsv } from './grade-csv.service';
import { computeLatePenalty } from './late-policy.service';

import { prisma } from '../lib/prisma';

export type Actor = { userId: string; role: string };
const isAdmin = (role: string) => ['ORG_ADMIN', 'SUPER_ADMIN'].includes(role);
const editableCourseWhere = (actor: Actor) =>
  isAdmin(actor.role) ? {} : { OR: [{ instructorId: actor.userId }, { instructors: { some: { userId: actor.userId } } }] };

const ensureCourseAccess = async (organizationId: string, actor: Actor, courseId: string) => {
  const course = await prisma.course.findFirst({ where: { id: courseId, organizationId, ...editableCourseWhere(actor) } });
  if (!course) throw AppError.notFound('Course not found');
  return course;
};

// Fallback when the organization has not configured a custom grading scale
// (OrgSettings.gradingScaleJson) — mirrors academic.controller.ts's
// scoreToLetter so letter grades stay consistent across the app.
const DEFAULT_GRADING_SCALE: Record<string, number> = {
  'A+': 97, A: 93, 'A-': 90, 'B+': 87, B: 83, 'B-': 80,
  'C+': 77, C: 73, 'C-': 70, D: 60, F: 0,
};

// Standard 4.0 GPA scale. The org's gradingScaleJson only defines percent
// thresholds per letter, not grade points, so this stays fixed regardless.
const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7, D: 1.0, F: 0.0,
};

export const percentToLetter = (percent: number, scale: Record<string, number>): string => {
  const source = Object.keys(scale).length ? scale : DEFAULT_GRADING_SCALE;
  const entries = Object.entries(source).sort((a, b) => b[1] - a[1]);
  for (const [letter, threshold] of entries) {
    if (percent >= threshold) return letter;
  }
  return entries[entries.length - 1]?.[0] || 'F';
};

export const letterToGradePoints = (letter: string): number => GRADE_POINTS[letter] ?? 0;

export type QuizScoreCandidate = { score: number | null; completedAt: Date | null };

// Pure so it's unit-testable without a DB. When a quiz allows multiple attempts,
// Quiz.scoringPolicy decides whether the course grade counts the best attempt
// or the most recent one.
export const resolveQuizAttemptScore = (
  attempts: QuizScoreCandidate[],
  policy: 'HIGHEST' | 'LATEST',
): number | null => {
  const scored = attempts.filter((a): a is { score: number; completedAt: Date | null } => a.score != null);
  if (!scored.length) return null;
  if (policy === 'HIGHEST') {
    return Math.max(...scored.map(a => a.score));
  }
  return [...scored].sort(
    (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
  )[0].score;
};

export type CourseGradeResult = {
  courseId: string;
  percent: number | null;
  letter: string | null;
  gradePoints: number | null;
  hasGrades: boolean;
};

/**
 * Aggregates a student's course grade from two disjoint sources — the
 * `Grade` table (assignments + manual entries) and `QuizAttempt` (quiz
 * scores, which intentionally never get written into `Grade` — see
 * things-to-do.md § 2.7 plan). Groups by category and applies
 * GradeCategory.weightPercent when the course has categories defined;
 * categorized and uncategorized items are only mixed via a simple average
 * fallback when the course has no categories at all. When a course has
 * *some* categories, only categorized items count toward the weighted
 * result — uncategorized assignments/quizzes should be tagged with a
 * category for their score to count.
 */
// Present/total across every cohort of this course the student has attendance
// records in. Shared by computeCourseGrade (ATTENDANCE-source categories) and
// the at-risk student list, which both need the same "attendance % for this
// student in this course" number.
export const computeCourseAttendancePercent = async (
  organizationId: string,
  studentId: string,
  courseId: string,
): Promise<number | null> => {
  const [presentCount, totalCount] = await Promise.all([
    prisma.attendance.count({ where: { organizationId, studentId, status: 'PRESENT', cohort: { courseId } } }),
    prisma.attendance.count({ where: { organizationId, studentId, cohort: { courseId } } }),
  ]);
  return totalCount ? (presentCount / totalCount) * 100 : null;
};

export const computeCourseGrade = async (
  organizationId: string,
  studentId: string,
  courseId: string,
  scale?: Record<string, number>,
): Promise<CourseGradeResult> => {
  const gradingScale = scale ?? await getOrganizationGradingScale(organizationId);

  const [grades, quizAttempts, categories] = await Promise.all([
    prisma.grade.findMany({
      where: { organizationId, studentId, courseId, status: 'PUBLISHED' },
      select: {
        score: true,
        categoryId: true,
        submission: { select: { assignment: { select: { maxPoints: true } } } },
      },
    }),
    prisma.quizAttempt.findMany({
      where: { organizationId, studentId, status: 'GRADED', quiz: { module: { courseId } } },
      select: { score: true, quizId: true, completedAt: true, quiz: { select: { categoryId: true, scoringPolicy: true } } },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.gradeCategory.findMany({ where: { organizationId, courseId } }),
  ]);

  type Bucket = { categoryId: string | null; percentSum: number; count: number };
  const buckets = new Map<string, Bucket>();
  const addToBucket = (categoryId: string | null, percent: number) => {
    const key = categoryId || '__uncategorized__';
    const bucket = buckets.get(key) || { categoryId, percentSum: 0, count: 0 };
    bucket.percentSum += percent;
    bucket.count += 1;
    buckets.set(key, bucket);
  };

  for (const grade of grades) {
    const maxPoints = grade.submission?.assignment?.maxPoints;
    // Manual grades (no submission) are entered directly as a 0-100 percent.
    const percent = maxPoints ? (grade.score / maxPoints) * 100 : grade.score;
    addToBucket(grade.categoryId, percent);
  }

  const attemptsByQuiz = new Map<string, { categoryId: string | null; policy: 'HIGHEST' | 'LATEST'; attempts: QuizScoreCandidate[] }>();
  for (const attempt of quizAttempts) {
    const bucket = attemptsByQuiz.get(attempt.quizId) || {
      categoryId: attempt.quiz.categoryId,
      policy: attempt.quiz.scoringPolicy,
      attempts: [],
    };
    bucket.attempts.push({ score: attempt.score, completedAt: attempt.completedAt });
    attemptsByQuiz.set(attempt.quizId, bucket);
  }
  for (const { categoryId, policy, attempts } of attemptsByQuiz.values()) {
    const score = resolveQuizAttemptScore(attempts, policy);
    if (score != null) addToBucket(categoryId, score);
  }

  // Categories with source ATTENDANCE aren't populated by grading anything —
  // they're computed directly from the student's Attendance records, letting a
  // course express a policy like assignment 40% / quiz 40% / attendance 20%.
  const attendanceCategories = categories.filter(c => c.source === 'ATTENDANCE');
  if (attendanceCategories.length) {
    const attendancePercent = await computeCourseAttendancePercent(organizationId, studentId, courseId);
    if (attendancePercent != null) {
      for (const category of attendanceCategories) addToBucket(category.id, attendancePercent);
    }
  }

  if (buckets.size === 0) {
    return { courseId, percent: null, letter: null, gradePoints: null, hasGrades: false };
  }

  const categoryWeight = new Map(categories.map(c => [c.id, c.weightPercent]));
  let weightedSum = 0, weightTotal = 0, simpleSum = 0, simpleCount = 0;
  for (const bucket of buckets.values()) {
    const bucketAverage = bucket.percentSum / bucket.count;
    simpleSum += bucketAverage;
    simpleCount += 1;
    const weight = bucket.categoryId ? categoryWeight.get(bucket.categoryId) : undefined;
    if (weight != null) {
      weightedSum += bucketAverage * weight;
      weightTotal += weight;
    }
  }

  const percent = weightTotal > 0 ? weightedSum / weightTotal : simpleSum / simpleCount;
  const letter = percentToLetter(percent, gradingScale);
  return {
    courseId,
    percent: Math.round(percent * 100) / 100,
    letter,
    gradePoints: letterToGradePoints(letter),
    hasGrades: true,
  };
};

export type TranscriptEntry = CourseGradeResult & {
  courseTitle: string;
  courseCode: string;
  credits: number;
  termId: string | null;
  termName: string | null;
};

export type Transcript = {
  courses: TranscriptEntry[];
  terms: Array<{ termId: string | null; termName: string | null; courses: TranscriptEntry[]; termGpa: number | null }>;
  cumulativeGpa: number | null;
};

const creditWeightedGpa = (entries: TranscriptEntry[]): number | null => {
  const graded = entries.filter(e => e.hasGrades && e.gradePoints != null);
  const creditSum = graded.reduce((sum, e) => sum + (e.credits || 0), 0);
  if (!creditSum) return null;
  const pointSum = graded.reduce((sum, e) => sum + e.gradePoints! * (e.credits || 0), 0);
  return Math.round((pointSum / creditSum) * 100) / 100;
};

export const computeTranscript = async (organizationId: string, studentId: string): Promise<Transcript> => {
  const enrollments = await prisma.enrollment.findMany({
    where: { organizationId, userId: studentId },
    select: {
      cohort: {
        select: {
          courseId: true,
          termId: true,
          term: { select: { name: true } },
          course: { select: { id: true, title: true, code: true, credits: true } },
        },
      },
    },
  });

  const byCourse = new Map<string, (typeof enrollments)[number]['cohort']>();
  for (const enrollment of enrollments) byCourse.set(enrollment.cohort.courseId, enrollment.cohort);

  const gradingScale = await getOrganizationGradingScale(organizationId);
  const courses: TranscriptEntry[] = [];
  for (const cohort of byCourse.values()) {
    const result = await computeCourseGrade(organizationId, studentId, cohort.courseId, gradingScale);
    courses.push({
      ...result,
      courseTitle: cohort.course.title,
      courseCode: cohort.course.code,
      credits: cohort.course.credits,
      termId: cohort.termId,
      termName: cohort.term?.name ?? null,
    });
  }

  const termGroups = new Map<string, TranscriptEntry[]>();
  for (const entry of courses) {
    const key = entry.termId || '__no_term__';
    if (!termGroups.has(key)) termGroups.set(key, []);
    termGroups.get(key)!.push(entry);
  }
  const terms = [...termGroups.entries()].map(([key, list]) => ({
    termId: key === '__no_term__' ? null : key,
    termName: list[0].termName,
    courses: list,
    termGpa: creditWeightedGpa(list),
  }));

  return { courses, terms, cumulativeGpa: creditWeightedGpa(courses) };
};

// ---------------------------------------------------------------------------
// Grade categories
// ---------------------------------------------------------------------------

export const listCategories = async (organizationId: string, actor: Actor, courseId: string) => {
  await ensureCourseAccess(organizationId, actor, courseId);
  return prisma.gradeCategory.findMany({ where: { organizationId, courseId }, orderBy: { createdAt: 'asc' } });
};

export const createCategory = async (
  organizationId: string, actor: Actor, courseId: string,
  data: { name: string; weightPercent: number; source?: 'MANUAL' | 'ATTENDANCE' },
) => {
  await ensureCourseAccess(organizationId, actor, courseId);
  return prisma.gradeCategory.create({ data: { organizationId, courseId, ...data } });
};

export const updateCategory = async (
  organizationId: string, actor: Actor, id: string,
  data: Partial<{ name: string; weightPercent: number; source: 'MANUAL' | 'ATTENDANCE' }>,
) => {
  const category = await prisma.gradeCategory.findFirst({ where: { id, organizationId } });
  if (!category) throw AppError.notFound('Category not found');
  await ensureCourseAccess(organizationId, actor, category.courseId);
  return prisma.gradeCategory.update({ where: { id }, data });
};

export const deleteCategory = async (organizationId: string, actor: Actor, id: string) => {
  const category = await prisma.gradeCategory.findFirst({ where: { id, organizationId } });
  if (!category) throw AppError.notFound('Category not found');
  await ensureCourseAccess(organizationId, actor, category.courseId);
  await prisma.gradeCategory.delete({ where: { id } });
};

// ---------------------------------------------------------------------------
// Manual grades, publishing, history
// ---------------------------------------------------------------------------

export const createManualGrade = async (
  organizationId: string,
  actor: Actor,
  data: { courseId: string; studentId: string; categoryId?: string; score: number; feedback?: string; status: 'DRAFT' | 'PUBLISHED' },
) => {
  await ensureCourseAccess(organizationId, actor, data.courseId);
  const student = await prisma.user.findFirst({ where: { id: data.studentId, organizationId, role: 'STUDENT' } });
  if (!student) throw AppError.badRequest('Student does not exist in this organization');
  if (data.categoryId) {
    const category = await prisma.gradeCategory.findFirst({ where: { id: data.categoryId, organizationId, courseId: data.courseId } });
    if (!category) throw AppError.badRequest('Category does not belong to this course');
  }
  return prisma.$transaction(async tx => {
    const grade = await tx.grade.create({
      data: {
        organizationId,
        studentId: data.studentId,
        courseId: data.courseId,
        categoryId: data.categoryId,
        score: data.score,
        feedback: data.feedback,
        status: data.status,
        source: 'MANUAL',
      },
    });
    await tx.gradeHistory.create({
      data: {
        organizationId, gradeId: grade.id, changedByUserId: actor.userId,
        previousScore: null, newScore: grade.score, reason: 'Initial manual grade',
      },
    });
    if (data.status === 'PUBLISHED') {
      await enqueueAcademicEvent(tx, EVENTS.GRADE_PUBLISHED, organizationId, {
        gradeId: grade.id, studentId: grade.studentId, score: grade.score,
      });
    }
    return grade;
  });
};

export const publishGrade = async (organizationId: string, actor: Actor, id: string) => {
  const grade = await prisma.grade.findFirst({ where: { id, organizationId } });
  if (!grade) throw AppError.notFound('Grade not found');
  await ensureCourseAccess(organizationId, actor, grade.courseId);
  if (grade.status === 'PUBLISHED') return grade;
  return prisma.$transaction(async tx => {
    const updated = await tx.grade.update({ where: { id }, data: { status: 'PUBLISHED' } });
    await enqueueAcademicEvent(tx, EVENTS.GRADE_PUBLISHED, organizationId, {
      gradeId: updated.id, studentId: updated.studentId, score: updated.score,
    });
    return updated;
  });
};

export const getGradeHistory = async (organizationId: string, actor: Actor, gradeId: string) => {
  const grade = await prisma.grade.findFirst({ where: { id: gradeId, organizationId } });
  if (!grade) throw AppError.notFound('Grade not found');
  if (actor.role === 'STUDENT') {
    if (grade.studentId !== actor.userId) throw AppError.forbidden('Not your grade');
  } else if (!isAdmin(actor.role)) {
    await ensureCourseAccess(organizationId, actor, grade.courseId);
  }
  return prisma.gradeHistory.findMany({ where: { organizationId, gradeId }, orderBy: { changedAt: 'desc' } });
};

// ---------------------------------------------------------------------------
// Appeals (track-only — approving does not mutate the score; the instructor
// edits the grade separately through the history-logged update endpoint)
// ---------------------------------------------------------------------------

export const createAppeal = async (organizationId: string, actor: Actor, gradeId: string, reason: string) => {
  const grade = await prisma.grade.findFirst({
    where: { id: gradeId, organizationId, studentId: actor.userId, status: 'PUBLISHED' },
  });
  if (!grade) throw AppError.notFound('Grade not found');
  const existing = await prisma.gradeAppeal.findFirst({ where: { organizationId, gradeId, status: 'PENDING' } });
  if (existing) throw AppError.conflict('An appeal is already pending for this grade');
  return prisma.gradeAppeal.create({ data: { organizationId, gradeId, studentId: actor.userId, reason } });
};

export const listAppeals = async (organizationId: string, actor: Actor) => {
  if (actor.role === 'STUDENT') {
    return prisma.gradeAppeal.findMany({ where: { organizationId, studentId: actor.userId }, orderBy: { createdAt: 'desc' } });
  }
  if (isAdmin(actor.role)) {
    return prisma.gradeAppeal.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }
  return prisma.gradeAppeal.findMany({
    where: { organizationId, grade: { course: editableCourseWhere(actor) } },
    orderBy: { createdAt: 'desc' },
  });
};

export const resolveAppeal = async (
  organizationId: string, actor: Actor, id: string, data: { status: 'APPROVED' | 'REJECTED'; resolutionNote?: string },
) => {
  const appeal = await prisma.gradeAppeal.findFirst({ where: { id, organizationId }, include: { grade: true } });
  if (!appeal) throw AppError.notFound('Appeal not found');
  await ensureCourseAccess(organizationId, actor, appeal.grade.courseId);
  if (appeal.status !== 'PENDING') throw AppError.badRequest('Appeal already resolved');
  return prisma.gradeAppeal.update({
    where: { id },
    data: { status: data.status, resolutionNote: data.resolutionNote, resolvedByUserId: actor.userId, resolvedAt: new Date() },
  });
};

// ---------------------------------------------------------------------------
// Bulk import/export
// ---------------------------------------------------------------------------

export const bulkImportGrades = async (organizationId: string, actor: Actor, assignmentId: string, csvText: string) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, module: { course: editableCourseWhere(actor) } },
    include: { module: true },
  });
  if (!assignment) throw AppError.notFound('Assignment not found');
  const rows = parseCsv(csvText);
  const results: Array<{ rowNumber: number; status: 'created' | 'updated' | 'error'; message?: string }> = [];

  for (const row of rows) {
    try {
      const email = row.value.studentEmail;
      if (!email) throw new Error('studentEmail is required');
      const score = Number(row.value.score);
      if (!Number.isFinite(score) || score < 0) throw new Error('score must be a non-negative number');
      if (score > assignment.maxPoints) throw new Error(`score cannot exceed ${assignment.maxPoints}`);

      const submission = await prisma.submission.findFirst({
        where: { organizationId, assignmentId, isLatest: true, student: { email, organizationId } },
      });
      if (!submission) throw new Error(`No submission found for ${email}`);

      const { latePenaltyPercent, score: finalScore } = computeLatePenalty({
        isLate: submission.isLate,
        daysLate: submission.daysLate,
        latePenaltyPercentPerDay: assignment.latePenaltyPercentPerDay,
        score,
      });

      const existing = await prisma.grade.findFirst({ where: { organizationId, submissionId: submission.id } });
      await prisma.$transaction(async tx => {
        if (existing) {
          const updated = await tx.grade.update({
            where: { id: existing.id },
            data: { score: finalScore, feedback: row.value.feedback, latePenaltyPercent },
          });
          await tx.gradeHistory.create({
            data: {
              organizationId, gradeId: updated.id, changedByUserId: actor.userId,
              previousScore: existing.score, newScore: finalScore, reason: 'Bulk CSV import',
            },
          });
          await enqueueAcademicEvent(tx, EVENTS.GRADE_REVISED, organizationId, {
            gradeId: updated.id, studentId: updated.studentId, score: updated.score,
          });
        } else {
          const created = await tx.grade.create({
            data: {
              organizationId, studentId: submission.studentId, submissionId: submission.id,
              courseId: assignment.module.courseId, categoryId: assignment.categoryId,
              score: finalScore, feedback: row.value.feedback, latePenaltyPercent,
            },
          });
          await tx.gradeHistory.create({
            data: {
              organizationId, gradeId: created.id, changedByUserId: actor.userId,
              previousScore: null, newScore: created.score, reason: 'Bulk CSV import',
            },
          });
          await enqueueAcademicEvent(tx, EVENTS.GRADE_PUBLISHED, organizationId, {
            gradeId: created.id, studentId: created.studentId, score: created.score,
            submissionId: submission.id, assignmentId: assignment.id,
            assignmentTitle: assignment.title, maxPoints: assignment.maxPoints,
          });
        }
      });
      results.push({ rowNumber: row.rowNumber, status: existing ? 'updated' : 'created' });
    } catch (error: any) {
      results.push({ rowNumber: row.rowNumber, status: 'error', message: String(error?.message || error) });
    }
  }
  return results;
};

export const exportGradesCsv = async (organizationId: string, actor: Actor, assignmentId: string) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, organizationId, module: { course: editableCourseWhere(actor) } },
  });
  if (!assignment) throw AppError.notFound('Assignment not found');
  const grades = await prisma.grade.findMany({
    where: { organizationId, submission: { assignmentId } },
    include: { student: true },
  });
  return serializeCsv(grades.map(g => ({ studentEmail: g.student.email, score: g.score, feedback: g.feedback || '' })));
};

// ---------------------------------------------------------------------------
// Course gradebook (roster x categories x grades)
// ---------------------------------------------------------------------------

type RosterStudent = { id: string; firstName: string; lastName: string; email: string };

// Shared by the gradebook and the at-risk list — both need "every student
// enrolled in any cohort of this course," deduped across cohorts.
const listEnrolledStudents = async (organizationId: string, courseId: string): Promise<RosterStudent[]> => {
  const cohorts = await prisma.cohort.findMany({
    where: { organizationId, courseId },
    include: { enrollments: { include: { user: true } } },
  });
  const studentsById = new Map<string, RosterStudent>();
  for (const cohort of cohorts) {
    for (const enrollment of cohort.enrollments) {
      studentsById.set(enrollment.user.id, {
        id: enrollment.user.id, firstName: enrollment.user.firstName,
        lastName: enrollment.user.lastName, email: enrollment.user.email,
      });
    }
  }
  return [...studentsById.values()];
};

export const getCourseGradebook = async (organizationId: string, actor: Actor, courseId: string) => {
  await ensureCourseAccess(organizationId, actor, courseId);
  const [categories, roster, gradingScale] = await Promise.all([
    prisma.gradeCategory.findMany({ where: { organizationId, courseId } }),
    listEnrolledStudents(organizationId, courseId),
    getOrganizationGradingScale(organizationId),
  ]);

  const students = await Promise.all(roster.map(async student => ({
    student,
    ...(await computeCourseGrade(organizationId, student.id, courseId, gradingScale)),
  })));

  return { categories, students };
};

// ---------------------------------------------------------------------------
// At-risk students
// ---------------------------------------------------------------------------

// Below either threshold flags a student as at-risk for a course. Kept as
// named constants (not yet an org-level setting) so the rule is visible and
// unit-testable; a course/org override can be layered on later without
// touching the evaluation logic itself.
export const RISK_GRADE_THRESHOLD = 60;
export const RISK_ATTENDANCE_THRESHOLD = 80;

export type RiskInput = { percent: number | null; attendancePercent: number | null };
export type RiskEvaluation = { atRisk: boolean; reasons: string[] };
export type RiskPolicy = { gradeThreshold: number; attendanceThreshold: number };

// Pure so it's unit-testable without a DB.
export const evaluateStudentRisk = (
  input: RiskInput,
  policy: RiskPolicy = {
    gradeThreshold: RISK_GRADE_THRESHOLD,
    attendanceThreshold: RISK_ATTENDANCE_THRESHOLD,
  },
): RiskEvaluation => {
  const reasons: string[] = [];
  if (input.percent != null && input.percent < policy.gradeThreshold) {
    reasons.push(`Курсын дүн ${Math.round(input.percent)}% (${policy.gradeThreshold}%-с доош)`);
  }
  if (input.attendancePercent != null && input.attendancePercent < policy.attendanceThreshold) {
    reasons.push(`Ирц ${Math.round(input.attendancePercent)}% (${policy.attendanceThreshold}%-с доош)`);
  }
  return { atRisk: reasons.length > 0, reasons };
};

const getOrganizationRiskPolicy = async (organizationId: string): Promise<RiskPolicy> => {
  const policy = await getOrganizationAttendancePolicy(organizationId);
  return {
    gradeThreshold: policy.riskGradeThreshold ?? RISK_GRADE_THRESHOLD,
    attendanceThreshold: policy.riskAttendanceThreshold ?? RISK_ATTENDANCE_THRESHOLD,
  };
};

export const getAtRiskStudents = async (organizationId: string, actor: Actor, courseId: string) => {
  const course = await ensureCourseAccess(organizationId, actor, courseId);
  const [roster, gradingScale, riskPolicy] = await Promise.all([
    listEnrolledStudents(organizationId, courseId),
    getOrganizationGradingScale(organizationId),
    getOrganizationRiskPolicy(organizationId),
  ]);

  const evaluated = await Promise.all(roster.map(async student => {
    const [grade, attendancePercent] = await Promise.all([
      computeCourseGrade(organizationId, student.id, courseId, gradingScale),
      computeCourseAttendancePercent(organizationId, student.id, courseId),
    ]);
    const risk = evaluateStudentRisk({ percent: grade.percent, attendancePercent }, riskPolicy);
    return {
      student, courseId, courseTitle: course.title,
      percent: grade.percent, letter: grade.letter, attendancePercent,
      ...risk,
    };
  }));

  return evaluated
    .filter(row => row.atRisk)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));
};

export const getOrganizationAtRiskSummary = async (organizationId: string, limit = 5, maxCourses = 8) => {
  const courses = await prisma.course.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: Math.max(limit, maxCourses),
  });
  const [gradingScale, riskPolicy] = await Promise.all([
    getOrganizationGradingScale(organizationId),
    getOrganizationRiskPolicy(organizationId),
  ]);
  const evaluated = await Promise.all(courses.map(async course => {
    const roster = await listEnrolledStudents(organizationId, course.id);
    const students = await Promise.all(roster.map(async student => {
      const [grade, attendancePercent] = await Promise.all([
        computeCourseGrade(organizationId, student.id, course.id, gradingScale),
        computeCourseAttendancePercent(organizationId, student.id, course.id),
      ]);
      const risk = evaluateStudentRisk({ percent: grade.percent, attendancePercent }, riskPolicy);
      return {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
        },
        courseId: course.id,
        courseTitle: course.title,
        percent: grade.percent,
        letter: grade.letter,
        attendancePercent,
        ...risk,
      };
    }));
    return students.filter(row => row.atRisk);
  }));
  const rows = evaluated
    .flat()
    .sort((a, b) => {
      const aScore = Math.min(a.percent ?? 100, a.attendancePercent ?? 100);
      const bScore = Math.min(b.percent ?? 100, b.attendancePercent ?? 100);
      return aScore - bScore;
    });
  const courseCount = new Set(rows.map(row => row.courseId)).size;
  const studentCount = new Set(rows.map(row => row.student.id)).size;
  return {
    total: rows.length,
    studentCount,
    courseCount,
    items: rows.slice(0, limit),
  };
};

// ---------------------------------------------------------------------------
// Transcript with authorization (self / linked parent / course instructor / admin)
// ---------------------------------------------------------------------------

export const getTranscript = async (organizationId: string, actor: Actor, studentIdParam: string) => {
  const studentId = studentIdParam === 'me' ? actor.userId : studentIdParam;

  if (actor.role === 'STUDENT') {
    if (studentId !== actor.userId) throw AppError.forbidden('You can only view your own transcript');
  } else if (actor.role === 'PARENT') {
    const link = await prisma.guardian.findFirst({
      where: { organizationId, parentUserId: actor.userId, studentUserId: studentId, status: 'APPROVED' },
    });
    if (!link || !link.permissions.includes('VIEW_GRADES')) {
      throw AppError.forbidden("You do not have access to this student's grades");
    }
  } else if (actor.role === 'INSTRUCTOR') {
    const shared = await prisma.enrollment.findFirst({
      where: { organizationId, userId: studentId, cohort: { course: editableCourseWhere(actor) } },
    });
    if (!shared) throw AppError.forbidden('This student is not enrolled in any of your courses');
  } else if (!isAdmin(actor.role) && !['PRINCIPAL', 'STAFF'].includes(actor.role)) {
    throw AppError.forbidden('Not authorized');
  }

  const student = await prisma.user.findFirst({ where: { id: studentId, organizationId, role: 'STUDENT' } });
  if (!student) throw AppError.notFound('Student not found');
  return computeTranscript(organizationId, studentId);
};
