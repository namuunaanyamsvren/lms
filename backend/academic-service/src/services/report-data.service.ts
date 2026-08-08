import { AppError, serviceAuthorizationHeaders } from '@lms/shared';
import type { ReportTable } from './report-storage.service';
import { computeCourseGrade } from './grade.service';
import { getOrganizationGradingScale } from './organization-grading-policy.service';

import { prisma } from '../lib/prisma';

export type Actor = { userId: string; role: string };
export type ReportFilters = { from?: string; to?: string; courseId?: string; cohortId?: string };

export type ReportCatalogEntry = {
  type: string;
  label: string;
  description: string;
  roles: string[];
};

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { type: 'ENROLLMENT', label: 'Элсэлтийн тайлан', description: 'Тухайн хугацаанд бүртгүүлсэн сурагчдын жагсаалт', roles: ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'COURSE_PROGRESS', label: 'Хичээл дүүргэлтийн тайлан', description: 'Хичээл тус бүрийн дундаж гүйцэтгэлийн хувь', roles: ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'ASSIGNMENT_QUIZ_PERFORMANCE', label: 'Даалгавар, шалгалтын гүйцэтгэл', description: 'Хичээл тус бүрийн даалгавар, шалгалтын дундаж дүн', roles: ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'GRADE_DISTRIBUTION', label: 'Дүнгийн тархалт', description: 'Дүнгийн тархалт болон дундаж голч дүн', roles: ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'ATTENDANCE', label: 'Ирцийн тайлан', description: 'Ангийн ирцийн нэгтгэл', roles: ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'COHORT_PERFORMANCE', label: 'Ангийн гүйцэтгэлийн тайлан', description: 'Анги тус бүрийн ирц, даалгаврын дүүргэлт, шалгалтын дундаж, тэнцсэн хувь', roles: ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'TEACHER_WORKLOAD', label: 'Багшийн ачааллын тайлан', description: 'Багш тус бүрийн хичээл, сурагч, дүгнэх ачаалал', roles: ['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'PARENT_ENGAGEMENT', label: 'Эцэг эхийн оролцооны тайлан', description: 'Эцэг эхийн зөвшөөрөл, мэдэгдэлд хариу өгсөн байдал', roles: ['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'ORG_USAGE_ADOPTION', label: 'Байгууллагын хэрэглээний тайлан', description: 'Сарын шинэ хэрэглэгчийн өсөлт', roles: ['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'] },
  { type: 'BILLING_REVENUE', label: 'Төлбөр, орлогын тайлан', description: 'Байгууллагын захиалгын төлбөрийн түүх', roles: ['FINANCE', 'ORG_ADMIN', 'SUPER_ADMIN'] },
];

export const catalogFor = (role: string) => REPORT_CATALOG.filter(entry => entry.roles.includes(role));

const assertAccess = (type: string, role: string) => {
  const entry = REPORT_CATALOG.find(e => e.type === type);
  if (!entry) throw AppError.notFound('Тайлангийн төрөл олдсонгүй');
  if (!entry.roles.includes(role)) throw AppError.forbidden('Энэ тайланг харах эрхгүй байна');
  return entry;
};

const instructorCourseFilter = (actor: Actor) =>
  actor.role === 'INSTRUCTOR'
    ? { OR: [{ instructorId: actor.userId }, { instructors: { some: { userId: actor.userId } } }] }
    : {};

const dateRange = (filters: ReportFilters, defaultDays = 90) => {
  const to = filters.to ? new Date(filters.to) : new Date();
  const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { from, to };
};

const scoreToLetter = (avg: number): string => {
  if (avg >= 97) return 'A+';
  if (avg >= 93) return 'A';
  if (avg >= 90) return 'A-';
  if (avg >= 87) return 'B+';
  if (avg >= 83) return 'B';
  if (avg >= 80) return 'B-';
  if (avg >= 77) return 'C+';
  if (avg >= 73) return 'C';
  if (avg >= 70) return 'C-';
  if (avg >= 60) return 'D';
  return 'F';
};

async function buildEnrollmentReport(organizationId: string, actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const { from, to } = dateRange(filters);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId,
      enrolledAt: { gte: from, lte: to },
      cohort: {
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
        course: instructorCourseFilter(actor),
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      cohort: { select: { name: true, course: { select: { title: true, code: true } } } },
    },
    orderBy: { enrolledAt: 'desc' },
    take: 1000,
  });
  return {
    columns: [
      { key: 'date', label: 'Огноо' },
      { key: 'student', label: 'Сурагч' },
      { key: 'email', label: 'И-мэйл' },
      { key: 'course', label: 'Хичээл' },
      { key: 'cohort', label: 'Анги' },
    ],
    rows: enrollments.map(e => ({
      date: e.enrolledAt.toISOString().slice(0, 10),
      student: `${e.user.lastName} ${e.user.firstName}`.trim(),
      email: e.user.email,
      course: `${e.cohort.course.title} (${e.cohort.course.code})`,
      cohort: e.cohort.name,
    })),
  };
}

async function buildCourseProgressReport(organizationId: string, actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const courses = await prisma.course.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(filters.courseId ? { id: filters.courseId } : {}),
      ...instructorCourseFilter(actor),
    },
    include: {
      modules: { include: { lessons: { select: { id: true } } } },
      cohorts: { include: { enrollments: { select: { userId: true } } } },
    },
    take: 200,
  });

  const rows = await Promise.all(courses.map(async course => {
    const lessonIds = course.modules.flatMap(m => m.lessons.map(l => l.id));
    const studentIds = [...new Set(course.cohorts.flatMap(c => c.enrollments.map(e => e.userId)))];
    const completedCount = lessonIds.length && studentIds.length
      ? await prisma.lessonProgress.count({ where: { organizationId, lessonId: { in: lessonIds }, userId: { in: studentIds } } })
      : 0;
    const denominator = lessonIds.length * studentIds.length;
    const completionPct = denominator > 0 ? Math.round((completedCount / denominator) * 100) : 0;
    return {
      course: `${course.title} (${course.code})`,
      students: studentIds.length,
      totalLessons: lessonIds.length,
      completionPct,
    };
  }));

  return {
    columns: [
      { key: 'course', label: 'Хичээл' },
      { key: 'students', label: 'Сурагчийн тоо' },
      { key: 'totalLessons', label: 'Нийт хичээл' },
      { key: 'completionPct', label: 'Дүүргэлт (%)' },
    ],
    rows,
  };
}

async function buildAssignmentQuizPerformanceReport(organizationId: string, actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const { from, to } = dateRange(filters);
  const courses = await prisma.course.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(filters.courseId ? { id: filters.courseId } : {}),
      ...instructorCourseFilter(actor),
    },
    select: { id: true, title: true, code: true },
    take: 200,
  });
  const courseIds = courses.map(c => c.id);

  const [grades, attempts] = await Promise.all([
    prisma.grade.groupBy({
      by: ['courseId'],
      where: { organizationId, courseId: { in: courseIds }, source: 'ASSIGNMENT', gradedAt: { gte: from, lte: to } },
      _avg: { score: true },
      _count: { _all: true },
    }),
    prisma.quizAttempt.findMany({
      where: {
        organizationId,
        status: 'GRADED',
        submittedAt: { gte: from, lte: to },
        quiz: { module: { courseId: { in: courseIds } } },
      },
      select: { score: true, passed: true, quiz: { select: { module: { select: { courseId: true } } } } },
      take: 5000,
    }),
  ]);

  const gradeByCourse = new Map(grades.map(g => [g.courseId, g]));
  const quizAgg = new Map<string, { total: number; passed: number; sum: number }>();
  attempts.forEach(a => {
    const courseId = a.quiz.module.courseId;
    const entry = quizAgg.get(courseId) || { total: 0, passed: 0, sum: 0 };
    entry.total += 1;
    if (a.passed) entry.passed += 1;
    entry.sum += a.score || 0;
    quizAgg.set(courseId, entry);
  });

  const rows = courses.map(course => {
    const g = gradeByCourse.get(course.id);
    const q = quizAgg.get(course.id);
    return {
      course: `${course.title} (${course.code})`,
      avgAssignmentScore: g?._avg.score != null ? Math.round(g._avg.score) : null,
      assignmentCount: g?._count._all || 0,
      avgQuizScore: q ? Math.round(q.sum / q.total) : null,
      quizAttemptCount: q?.total || 0,
      quizPassRatePct: q && q.total > 0 ? Math.round((q.passed / q.total) * 100) : null,
    };
  });

  return {
    columns: [
      { key: 'course', label: 'Хичээл' },
      { key: 'avgAssignmentScore', label: 'Даалгаврын дундаж оноо' },
      { key: 'assignmentCount', label: 'Дүгнэсэн даалгавар' },
      { key: 'avgQuizScore', label: 'Шалгалтын дундаж оноо' },
      { key: 'quizAttemptCount', label: 'Шалгалтын оролдлого' },
      { key: 'quizPassRatePct', label: 'Тэнцсэн хувь (%)' },
    ],
    rows,
  };
}

async function buildGradeDistributionReport(organizationId: string, actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const { from, to } = dateRange(filters, 365);
  const grades = await prisma.grade.findMany({
    where: {
      organizationId,
      gradedAt: { gte: from, lte: to },
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(actor.role === 'INSTRUCTOR' ? { course: instructorCourseFilter(actor) } : {}),
    },
    select: { score: true },
    take: 20000,
  });

  const buckets = [
    { label: '90-100', min: 90, max: 100 },
    { label: '80-89', min: 80, max: 89.999 },
    { label: '70-79', min: 70, max: 79.999 },
    { label: '60-69', min: 60, max: 69.999 },
    { label: '0-59', min: 0, max: 59.999 },
  ];
  const total = grades.length;
  const avg = total > 0 ? grades.reduce((s, g) => s + g.score, 0) / total : 0;

  const rows = buckets.map(b => {
    const count = grades.filter(g => g.score >= b.min && g.score <= b.max).length;
    return {
      range: b.label,
      count,
      percentOfTotal: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
  rows.push({ range: `Дундаж (${scoreToLetter(avg)})`, count: total, percentOfTotal: Math.round(avg) });

  return {
    columns: [
      { key: 'range', label: 'Оноогийн муж' },
      { key: 'count', label: 'Тоо' },
      { key: 'percentOfTotal', label: 'Нийт хувь (%)' },
    ],
    rows,
  };
}

async function buildAttendanceReport(organizationId: string, actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const { from, to } = dateRange(filters);
  const records = await prisma.attendance.findMany({
    where: {
      organizationId,
      date: { gte: from, lte: to },
      ...(filters.courseId ? { cohort: { courseId: filters.courseId } } : {}),
      ...(actor.role === 'INSTRUCTOR' ? { cohort: { course: instructorCourseFilter(actor) } } : {}),
    },
    include: { cohort: { select: { name: true, course: { select: { title: true, code: true } } } } },
    take: 20000,
  });

  const byCohort = new Map<string, { label: string; present: number; absent: number; late: number; excused: number; total: number }>();
  records.forEach(r => {
    const key = r.cohortId;
    const entry = byCohort.get(key) || { label: `${r.cohort.course.title} (${r.cohort.course.code}) — ${r.cohort.name}`, present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    entry.total += 1;
    if (r.status === 'PRESENT') entry.present += 1;
    else if (r.status === 'ABSENT') entry.absent += 1;
    else if (r.status === 'LATE') entry.late += 1;
    else if (r.status === 'EXCUSED') entry.excused += 1;
    byCohort.set(key, entry);
  });

  return {
    columns: [
      { key: 'cohort', label: 'Анги' },
      { key: 'present', label: 'Ирсэн' },
      { key: 'absent', label: 'Тасалсан' },
      { key: 'late', label: 'Хоцорсон' },
      { key: 'excused', label: 'Чөлөөтэй' },
      { key: 'presentPct', label: 'Ирцийн хувь (%)' },
    ],
    rows: [...byCohort.values()].map(e => ({
      cohort: e.label,
      present: e.present,
      absent: e.absent,
      late: e.late,
      excused: e.excused,
      presentPct: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
    })),
  };
}

// Per-cohort rollup (not just per-course like the other reports): attendance
// average, assignment completion, quiz average, and pass ("graduation") rate
// scoped to exactly that cohort's roster — closes the gap where a course-wide
// report couldn't answer "how is THIS specific class doing."
async function buildCohortPerformanceReport(organizationId: string, actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const columns = [
    { key: 'cohort', label: 'Анги' },
    { key: 'status', label: 'Төлөв' },
    { key: 'students', label: 'Сурагчийн тоо' },
    { key: 'attendancePct', label: 'Ирцийн дундаж (%)' },
    { key: 'assignmentCompletionPct', label: 'Даалгаврын дүүргэлт (%)' },
    { key: 'avgQuizScore', label: 'Шалгалтын дундаж оноо' },
    { key: 'passRatePct', label: 'Тэнцсэн хувь (%)' },
  ];

  const cohorts = await prisma.cohort.findMany({
    where: {
      organizationId,
      ...(filters.cohortId ? { id: filters.cohortId } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      course: instructorCourseFilter(actor),
    },
    select: {
      id: true, name: true, status: true, courseId: true,
      course: { select: { title: true, code: true } },
      enrollments: { select: { userId: true } },
    },
    take: 200,
  });
  if (!cohorts.length) return { columns, rows: [] };

  const gradingScale = await getOrganizationGradingScale(organizationId);

  const rows = await Promise.all(cohorts.map(async cohort => {
    const studentIds = cohort.enrollments.map(e => e.userId);
    const rosterSize = studentIds.length;

    const [presentCount, totalAttendance, assignmentCount] = await Promise.all([
      prisma.attendance.count({ where: { organizationId, cohortId: cohort.id, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { organizationId, cohortId: cohort.id } }),
      prisma.assignment.count({ where: { organizationId, deletedAt: null, module: { courseId: cohort.courseId } } }),
    ]);
    const attendancePct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null;

    const submittedCount = rosterSize && assignmentCount
      ? await prisma.submission.count({
          where: {
            organizationId, studentId: { in: studentIds }, isLatest: true, status: 'SUBMITTED',
            assignment: { module: { courseId: cohort.courseId } },
          },
        })
      : 0;
    const assignmentCompletionPct = assignmentCount > 0 && rosterSize > 0
      ? Math.round((submittedCount / (assignmentCount * rosterSize)) * 100)
      : null;

    const quizAttempts = rosterSize
      ? await prisma.quizAttempt.findMany({
          where: { organizationId, studentId: { in: studentIds }, status: 'GRADED', quiz: { module: { courseId: cohort.courseId } } },
          select: { score: true },
        })
      : [];
    const avgQuizScore = quizAttempts.length
      ? Math.round(quizAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / quizAttempts.length)
      : null;

    const grades = await Promise.all(
      studentIds.map(studentId => computeCourseGrade(organizationId, studentId, cohort.courseId, gradingScale)),
    );
    const passingCount = grades.filter(g => g.hasGrades && g.letter !== 'F').length;
    const passRatePct = rosterSize > 0 ? Math.round((passingCount / rosterSize) * 100) : null;

    return {
      // cohortId isn't in `columns` above, so the generic report table never
      // renders it as a column — it rides along on each row purely so the
      // frontend can build a drill-down link into the cohort's own page.
      cohortId: cohort.id,
      cohort: `${cohort.course.title} (${cohort.course.code}) — ${cohort.name}`,
      status: cohort.status,
      students: rosterSize,
      attendancePct,
      assignmentCompletionPct,
      avgQuizScore,
      passRatePct,
    };
  }));

  return { columns, rows };
}

async function buildTeacherWorkloadReport(organizationId: string, _actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const teachers = await prisma.user.findMany({
    where: { organizationId, role: 'INSTRUCTOR', deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 500,
  });
  const teacherIds = teachers.map(t => t.id);
  const courses = await prisma.course.findMany({
    where: { organizationId, deletedAt: null, instructorId: { in: teacherIds }, ...(filters.courseId ? { id: filters.courseId } : {}) },
    select: {
      instructorId: true,
      cohorts: { select: { enrollments: { select: { userId: true } } } },
      modules: { select: { assignments: { select: { submissions: { select: { grades: { select: { id: true } } } } } } } },
    },
    take: 2000,
  });

  type Workload = { courseCount: number; studentIds: Set<string>; assignmentCount: number; pendingGrading: number };
  const byTeacher = new Map<string, Workload>();
  courses.forEach(course => {
    const entry: Workload = byTeacher.get(course.instructorId) || { courseCount: 0, studentIds: new Set(), assignmentCount: 0, pendingGrading: 0 };
    entry.courseCount += 1;
    course.cohorts.forEach(c => c.enrollments.forEach(e => entry.studentIds.add(e.userId)));
    course.modules.forEach(m => m.assignments.forEach(a => {
      entry.assignmentCount += 1;
      a.submissions.forEach(s => { if (s.grades.length === 0) entry.pendingGrading += 1; });
    }));
    byTeacher.set(course.instructorId, entry);
  });

  const rows = teachers.map(teacher => {
    const workload = byTeacher.get(teacher.id);
    return {
      teacher: `${teacher.lastName} ${teacher.firstName}`.trim(),
      email: teacher.email,
      courses: workload?.courseCount || 0,
      students: workload?.studentIds.size || 0,
      assignments: workload?.assignmentCount || 0,
      pendingGrading: workload?.pendingGrading || 0,
    };
  });

  return {
    columns: [
      { key: 'teacher', label: 'Багш' },
      { key: 'email', label: 'И-мэйл' },
      { key: 'courses', label: 'Хичээл' },
      { key: 'students', label: 'Сурагч' },
      { key: 'assignments', label: 'Даалгавар' },
      { key: 'pendingGrading', label: 'Дүгнээгүй ажил' },
    ],
    rows,
  };
}

async function buildParentEngagementReport(organizationId: string, _actor: Actor, _filters: ReportFilters): Promise<ReportTable> {
  const guardians = await prisma.guardian.findMany({
    where: { organizationId, status: 'APPROVED' },
    select: { parentUserId: true, studentUserId: true },
  });
  const byParent = new Map<string, string[]>();
  guardians.forEach(g => {
    const list = byParent.get(g.parentUserId) || [];
    list.push(g.studentUserId);
    byParent.set(g.parentUserId, list);
  });

  const parentIds = [...byParent.keys()];
  const [parents, acknowledgements, readReceipts, publishedAnnouncements] = await Promise.all([
    prisma.user.findMany({ where: { organizationId, id: { in: parentIds } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.consentAcknowledgement.findMany({ where: { organizationId, parentUserId: { in: parentIds } }, select: { parentUserId: true, status: true } }),
    prisma.announcementReadReceipt.findMany({ where: { organizationId, userId: { in: parentIds } }, select: { userId: true } }),
    prisma.announcement.count({ where: { organizationId, status: 'PUBLISHED', targetRoles: { has: 'PARENT' } } }),
  ]);

  const ackByParent = new Map<string, { total: number; responded: number }>();
  acknowledgements.forEach(a => {
    const entry = ackByParent.get(a.parentUserId) || { total: 0, responded: 0 };
    entry.total += 1;
    if (a.status !== 'PENDING') entry.responded += 1;
    ackByParent.set(a.parentUserId, entry);
  });
  const readCountByParent = new Map<string, number>();
  readReceipts.forEach(r => readCountByParent.set(r.userId, (readCountByParent.get(r.userId) || 0) + 1));

  const rows = parents.map(parent => {
    const ack = ackByParent.get(parent.id);
    const readCount = readCountByParent.get(parent.id) || 0;
    return {
      parent: `${parent.lastName} ${parent.firstName}`.trim(),
      email: parent.email,
      children: byParent.get(parent.id)?.length || 0,
      consentResponseRatePct: ack && ack.total > 0 ? Math.round((ack.responded / ack.total) * 100) : null,
      announcementReadRatePct: publishedAnnouncements > 0 ? Math.round((readCount / publishedAnnouncements) * 100) : null,
    };
  });

  return {
    columns: [
      { key: 'parent', label: 'Эцэг эх' },
      { key: 'email', label: 'И-мэйл' },
      { key: 'children', label: 'Хүүхдийн тоо' },
      { key: 'consentResponseRatePct', label: 'Зөвшөөрлийн хариу (%)' },
      { key: 'announcementReadRatePct', label: 'Мэдэгдэл уншсан (%)' },
    ],
    rows,
  };
}

async function buildOrgUsageAdoptionReport(organizationId: string, _actor: Actor, filters: ReportFilters): Promise<ReportTable> {
  const { from, to } = dateRange(filters, 180);
  const users = await prisma.user.findMany({
    where: { organizationId, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, role: true },
  });

  const monthly = new Map<string, number>();
  users.forEach(u => {
    const key = u.createdAt.toISOString().slice(0, 7);
    monthly.set(key, (monthly.get(key) || 0) + 1);
  });

  return {
    columns: [
      { key: 'month', label: 'Сар' },
      { key: 'newUsers', label: 'Шинэ хэрэглэгч' },
    ],
    rows: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, newUsers: count })),
  };
}

async function buildBillingRevenueReport(organizationId: string, filters: ReportFilters): Promise<ReportTable> {
  const baseUrl = process.env.BILLING_SERVICE_URL;
  if (!baseUrl || process.env.FEATURE_BILLING_ENABLED !== 'true') {
    return { columns: [{ key: 'message', label: 'Мэдээлэл' }], rows: [{ message: 'Төлбөрийн систем идэвхгүй байна.' }] };
  }
  const { from, to } = dateRange(filters, 365);
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/internal/organizations/${encodeURIComponent(organizationId)}/revenue-summary?from=${from.toISOString()}&to=${to.toISOString()}`,
      { headers: serviceAuthorizationHeaders('academic-service'), signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) throw new Error(`billing-service status ${response.status}`);
    const payload = await response.json() as { data: { rows: Array<Record<string, unknown>> } };
    return {
      columns: [
        { key: 'date', label: 'Огноо' },
        { key: 'amount', label: 'Дүн' },
        { key: 'currency', label: 'Валют' },
        { key: 'method', label: 'Арга' },
        { key: 'status', label: 'Төлөв' },
        { key: 'transactionId', label: 'Гүйлгээний дугаар' },
      ],
      rows: payload.data.rows,
    };
  } catch (error) {
    console.warn('[Reports] billing-service revenue summary unavailable', error);
    return { columns: [{ key: 'message', label: 'Мэдээлэл' }], rows: [{ message: 'Төлбөрийн мэдээлэл авах боломжгүй байна.' }] };
  }
}

export const computeReport = async (
  organizationId: string,
  actor: Actor,
  reportType: string,
  filters: ReportFilters,
): Promise<ReportTable> => {
  assertAccess(reportType, actor.role);
  switch (reportType) {
    case 'ENROLLMENT': return buildEnrollmentReport(organizationId, actor, filters);
    case 'COURSE_PROGRESS': return buildCourseProgressReport(organizationId, actor, filters);
    case 'ASSIGNMENT_QUIZ_PERFORMANCE': return buildAssignmentQuizPerformanceReport(organizationId, actor, filters);
    case 'GRADE_DISTRIBUTION': return buildGradeDistributionReport(organizationId, actor, filters);
    case 'ATTENDANCE': return buildAttendanceReport(organizationId, actor, filters);
    case 'COHORT_PERFORMANCE': return buildCohortPerformanceReport(organizationId, actor, filters);
    case 'TEACHER_WORKLOAD': return buildTeacherWorkloadReport(organizationId, actor, filters);
    case 'PARENT_ENGAGEMENT': return buildParentEngagementReport(organizationId, actor, filters);
    case 'ORG_USAGE_ADOPTION': return buildOrgUsageAdoptionReport(organizationId, actor, filters);
    case 'BILLING_REVENUE': return buildBillingRevenueReport(organizationId, filters);
    default: throw AppError.badRequest('Тодорхойгүй тайлангийн төрөл');
  }
};
