import { AttendanceStatus, CourseInstructorRole, CourseStatus, GradeCategorySource, GradeSource, GradeStatus, Prisma, Role, UserAccountStatus, type PrismaClient } from '@prisma/client-academic';
import { prisma } from '../lib/prisma';

type Logger = {
  info: (message: string, meta?: unknown) => void;
  warn?: (message: string, meta?: unknown) => void;
};

type DemoUser = {
  key: string;
  email: string;
  username: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: Role;
  studentId?: string;
  guardianLinkCode?: string;
};

type ResolvedOrganization = {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
};

const DEFAULT_DEMO_SLUG = 'mongol-erdem';

export const isDeployDemoAcademicSeedEnabled = (env: NodeJS.ProcessEnv = process.env) => {
  if (env.ENABLE_DEMO_ACADEMIC_SEED !== undefined) return env.ENABLE_DEMO_ACADEMIC_SEED === 'true';
  return env.NODE_ENV === 'staging';
};

const demoUserDefinitions = (): DemoUser[] => [
  { key: 'admin', email: 'admin@lms.mn', username: 'admin', phone: '99112233', firstName: 'Demo', lastName: 'Admin', role: Role.ORG_ADMIN },
  { key: 'teacher', email: 'teacher@lms.mn', username: 'teacher', phone: '99223344', firstName: 'Demo', lastName: 'Teacher', role: Role.INSTRUCTOR },
  { key: 'student', email: 'student@lms.mn', username: 'student', phone: '99334455', firstName: 'Demo', lastName: 'Student', role: Role.STUDENT, studentId: 'STU-DEMO-0001', guardianLinkCode: 'PARENT-DEMO-0001' },
  { key: 'parent', email: 'parent@lms.mn', username: 'parent', phone: '99445566', firstName: 'Demo', lastName: 'Parent', role: Role.PARENT },
  { key: 'principal', email: 'principal@lms.mn', username: 'principal', phone: '99556677', firstName: 'Demo', lastName: 'Principal', role: Role.PRINCIPAL },
  { key: 'user', email: 'user@lms.mn', username: 'user', phone: '99667788', firstName: 'Demo', lastName: 'User', role: Role.USER },
];

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');
const demoId = (slug: string, key: string) => `demo-${slug}-${key}`;
const dateOnly = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const recentSchoolDays = (count: number) => {
  const days: Date[] = [];
  let cursor = dateOnly(new Date());
  while (days.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor);
    cursor = addDays(cursor, -1);
  }
  return days.reverse();
};

export const resolveDemoOrganization = async (
  slug = process.env.DEMO_ORGANIZATION_SLUG || DEFAULT_DEMO_SLUG,
  organizationServiceUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:8002',
): Promise<ResolvedOrganization> => {
  const url = new URL('/api/organizations/resolve', normalizeBaseUrl(organizationServiceUrl));
  url.searchParams.set('host', slug);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(Number(process.env.DEMO_ACADEMIC_SEED_FETCH_TIMEOUT_MS || 5000)),
  });
  if (!response.ok) throw new Error(`Demo organization resolve failed with ${response.status}`);
  const body = await response.json() as { data?: Partial<ResolvedOrganization> };
  const data = body?.data;
  if (!data?.id) throw new Error('Demo organization resolve response did not include an id');
  return {
    id: data.id,
    name: data.name || 'Монгол Эрдэм Их Сургууль',
    slug: data.slug || slug,
    domain: data.domain,
    logoUrl: data.logoUrl,
  };
};

const seedUsers = async (tx: Prisma.TransactionClient, organization: ResolvedOrganization) => {
  const users = new Map<string, Awaited<ReturnType<typeof tx.user.upsert>>>();
  for (const user of demoUserDefinitions()) {
    const row = await tx.user.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: user.email } },
      create: {
        id: demoId(organization.slug, user.key),
        organizationId: organization.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: UserAccountStatus.ACTIVE,
        isActive: true,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
        passwordHash: null,
        deletedAt: null,
      },
      update: {
        username: user.username,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: UserAccountStatus.ACTIVE,
        isActive: true,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
        deletedAt: null,
      },
    });
    users.set(user.key, row);
  }
  return users;
};

export const seedDeployDemoAcademicData = async (
  client: PrismaClient = prisma,
  organizationResolver = resolveDemoOrganization,
) => {
  if (!isDeployDemoAcademicSeedEnabled()) return { seeded: false, reason: 'disabled' };

  const organization = await organizationResolver();
  const ids = {
    course: demoId(organization.slug, 'course-programming'),
    module: demoId(organization.slug, 'module-foundations'),
    lessonIntro: demoId(organization.slug, 'lesson-intro'),
    lessonLoop: demoId(organization.slug, 'lesson-loop'),
    cohort: demoId(organization.slug, 'cohort-2026-a'),
    categoryAssignment: demoId(organization.slug, 'category-assignment'),
    categoryAttendance: demoId(organization.slug, 'category-attendance'),
    assignment: demoId(organization.slug, 'assignment-algorithm'),
    submission: demoId(organization.slug, 'submission-algorithm'),
    grade: demoId(organization.slug, 'grade-algorithm'),
    gradeHistory: demoId(organization.slug, 'grade-history-algorithm'),
  };
  const schoolDays = recentSchoolDays(5);
  const today = dateOnly(new Date());

  await client.$transaction(async tx => {
    await tx.organization.upsert({
      where: { slug: organization.slug },
      create: {
        id: organization.id,
        organizationId: organization.id,
        name: organization.name,
        slug: organization.slug,
        domain: organization.domain,
        logoUrl: organization.logoUrl,
      },
      update: {
        organizationId: organization.id,
        name: organization.name,
        domain: organization.domain,
        logoUrl: organization.logoUrl,
        deletedAt: null,
      },
    });

    const users = await seedUsers(tx, organization);
    const admin = users.get('admin');
    const teacher = users.get('teacher');
    const student = users.get('student');
    const parent = users.get('parent');
    if (!admin || !teacher || !student || !parent) throw new Error('Demo users were not seeded');

    await tx.guardian.upsert({
      where: { organizationId_parentUserId_studentUserId: { organizationId: organization.id, parentUserId: parent.id, studentUserId: student.id } },
      create: {
        organizationId: organization.id,
        parentUserId: parent.id,
        studentUserId: student.id,
        relationship: 'LEGAL_GUARDIAN',
        status: 'APPROVED',
        invitedById: admin.id,
        respondedAt: today,
      },
      update: {
        relationship: 'LEGAL_GUARDIAN',
        status: 'APPROVED',
        invitedById: admin.id,
        respondedAt: today,
      },
    });

    const course = await tx.course.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'DEMO-CS101' } },
      create: {
        id: ids.course,
        organizationId: organization.id,
        title: 'Програмчлалын үндэс',
        code: 'DEMO-CS101',
        description: 'Demo accounts хооронд харагдах course, assignment, grade, attendance data.',
        credits: 3,
        level: 'Beginner',
        durationWeeks: 12,
        price: new Prisma.Decimal(0),
        currency: 'MNT',
        capacity: 30,
        department: 'Мэдээллийн технологи',
        instructorId: teacher.id,
        status: CourseStatus.PUBLISHED,
        publishedAt: today,
      },
      update: {
        title: 'Програмчлалын үндэс',
        description: 'Demo accounts хооронд харагдах course, assignment, grade, attendance data.',
        credits: 3,
        level: 'Beginner',
        durationWeeks: 12,
        capacity: 30,
        department: 'Мэдээллийн технологи',
        instructorId: teacher.id,
        status: CourseStatus.PUBLISHED,
        publishedAt: today,
        deletedAt: null,
      },
    });

    await tx.courseInstructor.upsert({
      where: { organizationId_courseId_userId: { organizationId: organization.id, courseId: course.id, userId: teacher.id } },
      create: { organizationId: organization.id, courseId: course.id, userId: teacher.id, role: CourseInstructorRole.OWNER },
      update: { role: CourseInstructorRole.OWNER },
    });

    const module = await tx.module.upsert({
      where: { id: ids.module },
      create: { id: ids.module, organizationId: organization.id, courseId: course.id, title: 'Алгоритм ба өгөгдлийн үндэс', order: 1 },
      update: { organizationId: organization.id, courseId: course.id, title: 'Алгоритм ба өгөгдлийн үндэс', order: 1 },
    });

    for (const lesson of [
      { id: ids.lessonIntro, title: 'Хичээлийн танилцуулга', order: 1 },
      { id: ids.lessonLoop, title: 'Давталт ба нөхцөл', order: 2 },
    ]) {
      await tx.lesson.upsert({
        where: { id: lesson.id },
        create: {
          id: lesson.id,
          organizationId: organization.id,
          moduleId: module.id,
          title: lesson.title,
          content: `${lesson.title} demo lesson content.`,
          order: lesson.order,
          releaseAt: addDays(today, -7 + lesson.order),
        },
        update: {
          organizationId: organization.id,
          moduleId: module.id,
          title: lesson.title,
          content: `${lesson.title} demo lesson content.`,
          order: lesson.order,
          releaseAt: addDays(today, -7 + lesson.order),
        },
      });
      await tx.lessonProgress.upsert({
        where: { organizationId_lessonId_userId: { organizationId: organization.id, lessonId: lesson.id, userId: student.id } },
        create: { organizationId: organization.id, lessonId: lesson.id, userId: student.id, completedAt: addDays(today, -3 + lesson.order) },
        update: { completedAt: addDays(today, -3 + lesson.order) },
      });
    }

    const cohort = await tx.cohort.upsert({
      where: { id: ids.cohort },
      create: {
        id: ids.cohort,
        organizationId: organization.id,
        courseId: course.id,
        name: '2026 Demo A бүлэг',
        startDate: addDays(today, -14),
        endDate: addDays(today, 70),
        seatLimit: 30,
        status: 'ACTIVE',
        scheduleJson: { days: ['MONDAY', 'WEDNESDAY'], room: 'A-204' },
        courseSnapshot: { title: course.title, code: course.code },
      },
      update: {
        organizationId: organization.id,
        courseId: course.id,
        name: '2026 Demo A бүлэг',
        startDate: addDays(today, -14),
        endDate: addDays(today, 70),
        seatLimit: 30,
        status: 'ACTIVE',
        scheduleJson: { days: ['MONDAY', 'WEDNESDAY'], room: 'A-204' },
        courseSnapshot: { title: course.title, code: course.code },
      },
    });

    await tx.enrollment.upsert({
      where: { organizationId_userId_cohortId: { organizationId: organization.id, userId: student.id, cohortId: cohort.id } },
      create: { organizationId: organization.id, userId: student.id, cohortId: cohort.id, enrolledAt: addDays(today, -13), status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    for (const schedule of [
      { dayOfWeek: 'MONDAY' as const, startTime: '09:00', endTime: '10:30' },
      { dayOfWeek: 'WEDNESDAY' as const, startTime: '11:00', endTime: '12:30' },
    ]) {
      await tx.schedule.upsert({
        where: { organizationId_courseId_dayOfWeek_startTime_semester: { organizationId: organization.id, courseId: course.id, dayOfWeek: schedule.dayOfWeek, startTime: schedule.startTime, semester: '2026-H1' } },
        create: {
          organizationId: organization.id,
          courseId: course.id,
          teacherId: teacher.id,
          title: `${course.title} - ${schedule.dayOfWeek}`,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          room: 'A-204',
          semester: '2026-H1',
        },
        update: { teacherId: teacher.id, title: `${course.title} - ${schedule.dayOfWeek}`, endTime: schedule.endTime, room: 'A-204' },
      });
    }

    const assignmentCategory = await tx.gradeCategory.upsert({
      where: { id: ids.categoryAssignment },
      create: { id: ids.categoryAssignment, organizationId: organization.id, courseId: course.id, name: 'Даалгавар', weightPercent: 70, source: GradeCategorySource.MANUAL },
      update: { courseId: course.id, name: 'Даалгавар', weightPercent: 70, source: GradeCategorySource.MANUAL },
    });
    await tx.gradeCategory.upsert({
      where: { id: ids.categoryAttendance },
      create: { id: ids.categoryAttendance, organizationId: organization.id, courseId: course.id, name: 'Ирц', weightPercent: 30, source: GradeCategorySource.ATTENDANCE },
      update: { courseId: course.id, name: 'Ирц', weightPercent: 30, source: GradeCategorySource.ATTENDANCE },
    });

    const assignment = await tx.assignment.upsert({
      where: { id: ids.assignment },
      create: {
        id: ids.assignment,
        organizationId: organization.id,
        moduleId: module.id,
        title: 'Алгоритмын бодлого #1',
        description: 'Demo student шийдэл илгээсэн, teacher үнэлгээ өгсөн assignment.',
        dueDate: addDays(today, 5),
        maxPoints: 100,
        status: 'PUBLISHED',
        publishedAt: addDays(today, -5),
        categoryId: assignmentCategory.id,
      },
      update: {
        moduleId: module.id,
        title: 'Алгоритмын бодлого #1',
        description: 'Demo student шийдэл илгээсэн, teacher үнэлгээ өгсөн assignment.',
        dueDate: addDays(today, 5),
        maxPoints: 100,
        status: 'PUBLISHED',
        publishedAt: addDays(today, -5),
        categoryId: assignmentCategory.id,
        deletedAt: null,
      },
    });

    const submission = await tx.submission.upsert({
      where: { id: ids.submission },
      create: {
        id: ids.submission,
        organizationId: organization.id,
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Алгоритмын бодлогын demo шийдэл: оролт шалгах, давталт ашиглах, үр дүн буцаах.',
        repoUrl: 'https://github.com/demo-school/algorithm-demo',
        commitHash: 'demo123',
        status: 'SUBMITTED',
        submittedAt: addDays(today, -1),
      },
      update: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Алгоритмын бодлогын demo шийдэл: оролт шалгах, давталт ашиглах, үр дүн буцаах.',
        repoUrl: 'https://github.com/demo-school/algorithm-demo',
        commitHash: 'demo123',
        status: 'SUBMITTED',
        submittedAt: addDays(today, -1),
        isLatest: true,
      },
    });

    const grade = await tx.grade.upsert({
      where: { id: ids.grade },
      create: {
        id: ids.grade,
        organizationId: organization.id,
        studentId: student.id,
        submissionId: submission.id,
        courseId: course.id,
        categoryId: assignmentCategory.id,
        status: GradeStatus.PUBLISHED,
        source: GradeSource.ASSIGNMENT,
        score: 88,
        feedback: 'Сайн ажилласан. Давталтын edge case-үүдийг нэмж шалгаарай.',
        gradedAt: today,
      },
      update: {
        studentId: student.id,
        submissionId: submission.id,
        courseId: course.id,
        categoryId: assignmentCategory.id,
        status: GradeStatus.PUBLISHED,
        source: GradeSource.ASSIGNMENT,
        score: 88,
        feedback: 'Сайн ажилласан. Давталтын edge case-үүдийг нэмж шалгаарай.',
        gradedAt: today,
      },
    });

    await tx.gradeHistory.upsert({
      where: { id: ids.gradeHistory },
      create: { id: ids.gradeHistory, organizationId: organization.id, gradeId: grade.id, changedByUserId: teacher.id, previousScore: 82, newScore: 88, reason: 'Demo rubric review', changedAt: today },
      update: { gradeId: grade.id, changedByUserId: teacher.id, previousScore: 82, newScore: 88, reason: 'Demo rubric review', changedAt: today },
    });

    await tx.attendance.deleteMany({
      where: { organizationId: organization.id, cohortId: cohort.id, studentId: student.id, date: { lt: addDays(today, -21) } },
    });

    const statuses = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT, AttendanceStatus.PRESENT];
    for (const [index, date] of schoolDays.entries()) {
      await tx.attendance.upsert({
        where: { organizationId_cohortId_studentId_date: { organizationId: organization.id, cohortId: cohort.id, studentId: student.id, date } },
        create: {
          id: demoId(organization.slug, `attendance-${date.toISOString().slice(0, 10)}`),
          organizationId: organization.id,
          cohortId: cohort.id,
          studentId: student.id,
          date,
          status: statuses[index],
          note: statuses[index] === AttendanceStatus.ABSENT ? 'Demo absent record' : null,
        },
        update: {
          status: statuses[index],
          note: statuses[index] === AttendanceStatus.ABSENT ? 'Demo absent record' : null,
        },
      });
    }
  });

  return { seeded: true, organizationId: organization.id, slug: organization.slug };
};

export const startDeployDemoAcademicSeed = (logger: Logger) => {
  if (!isDeployDemoAcademicSeedEnabled()) return;
  const maxAttempts = Number(process.env.DEMO_ACADEMIC_SEED_MAX_ATTEMPTS || 12);
  const intervalMs = Number(process.env.DEMO_ACADEMIC_SEED_RETRY_MS || 10000);
  let attempts = 0;
  let timer: NodeJS.Timeout | undefined;

  const run = async () => {
    attempts += 1;
    try {
      const result = await seedDeployDemoAcademicData();
      logger.info('Deploy demo academic data seeded', { organizationId: result.organizationId, slug: result.slug });
      if (timer) clearInterval(timer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn?.('Deploy demo academic data seed attempt failed', { attempts, maxAttempts, error: message });
      if (attempts >= maxAttempts && timer) clearInterval(timer);
    }
  };

  timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
};
