import { Request, Response } from 'express';
import { serviceAuthorizationHeaders } from '@lms/shared';
import { getOrganizationBillingSummary } from '../services/organization-billing-summary.service';
import { getOrganizationAtRiskSummary } from '../services/grade.service';

import { prisma } from '../lib/prisma';

type NotificationProjection = {
  unreadCount: number;
  items: Array<{ title: string; body: string; createdAt: string }>;
};

const getNotificationProjection = async (
  organizationId: string,
  userId: string,
  limit = 5,
): Promise<NotificationProjection> => {
  const baseUrl = process.env.NOTIFICATION_SERVICE_URL;
  if (!baseUrl) return { unreadCount: 0, items: [] };
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/internal/notifications/${encodeURIComponent(organizationId)}/${encodeURIComponent(userId)}?limit=${limit}`,
      {
        headers: serviceAuthorizationHeaders('academic-service'),
        signal: AbortSignal.timeout(2_000),
      },
    );
    if (!response.ok) throw new Error(`notification projection status ${response.status}`);
    const payload = await response.json() as { data?: NotificationProjection };
    return payload.data || { unreadCount: 0, items: [] };
  } catch (error) {
    console.warn('[Academic] Notification projection unavailable', error);
    return { unreadCount: 0, items: [] };
  }
};

// Converts a 0-100 average score into a US-style letter grade, used everywhere
// the UI expects a letter grade (e.g. "A-") instead of a raw percentage.
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

// Short timeout-guarded liveness check used for the "system status" widgets —
// never hardcode a service as "Online" without actually checking it.
const checkServiceHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
};

const emptyAtRiskSummary = { total: 0, studentCount: 0, courseCount: 0, items: [] };

const getDashboardAtRiskSummary = async (organizationId: string) => {
  try {
    const timeout = new Promise<typeof emptyAtRiskSummary>((resolve) => {
      setTimeout(() => resolve(emptyAtRiskSummary), 2_000);
    });
    return await Promise.race([
      getOrganizationAtRiskSummary(organizationId, 5, 6),
      timeout,
    ]);
  } catch (error) {
    console.warn('[Dashboard] at-risk summary unavailable', error);
    return emptyAtRiskSummary;
  }
};

// 1. Courses & Modules & Lessons
export const getCourses = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    const where: any = { organizationId, deletedAt: null };

    switch (role) {
      case 'STUDENT':
        where.cohorts = { some: { enrollments: { some: { userId } } } };
        break;
      case 'INSTRUCTOR':
        where.instructorId = userId;
        break;
      case 'PARENT': {
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentUserId: true },
        });
        if (guardian) {
          where.cohorts = { some: { enrollments: { some: { userId: guardian.studentUserId } } } };
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
      }
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        // No additional filters needed for these roles
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const courses = await prisma.course.findMany({ where });
    return res.json({ success: true, data: courses });
  } catch (error: any) {
    console.error('[getCourses Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get courses' });
  }
};

export const getCourseById = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const { userId, role } = req.user!;
    const { id } = req.params;
    let accessWhere: any = {};
    if (role === 'STUDENT') {
      accessWhere = { cohorts: { some: { enrollments: { some: { userId } } } } };
    } else if (role === 'INSTRUCTOR') {
      accessWhere = { instructorId: userId };
    } else if (role === 'PARENT') {
      const guardian = await prisma.guardian.findFirst({
        where: { organizationId, parentUserId: userId },
        select: { studentUserId: true },
      });
      if (!guardian) return res.status(404).json({ success: false, message: 'Хичээл олдсонгүй' });
      accessWhere = { cohorts: { some: { enrollments: { some: { userId: guardian.studentUserId } } } } };
    } else if (!['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }
    const course = await prisma.course.findFirst({
      where: { id, organizationId, deletedAt: null, ...accessWhere },
      include: {
        modules: {
          include: {
            lessons: true,
            assignments: {
              where: {
                deletedAt: null,
                ...(['STUDENT', 'PARENT'].includes(role) ? { status: 'PUBLISHED' as const } : {}),
              },
              include: assignmentAttachmentInclude,
            },
            quizzes: true,
          },
          orderBy: { order: 'asc' },
        },
        cohorts: true,
      },
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Хичээл олдсонгүй' });
    }

    return res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error('[getCourseById Error]', error);
    return res.status(500).json({ success: false, message: 'Алдаа гарлаа' });
  }
};

// 2. Cohorts
export const getCohorts = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const { role, userId } = req.user!;
    const where: any = { organizationId };
    if (role === 'INSTRUCTOR') where.course = { instructorId: userId };
    else if (role === 'STUDENT') where.enrollments = { some: { userId } };
    else if (role === 'PARENT') {
      const guardian = await prisma.guardian.findFirst({
        where: { organizationId, parentUserId: userId },
        select: { studentUserId: true },
      });
      if (!guardian) return res.json({ success: true, data: [] });
      where.enrollments = { some: { userId: guardian.studentUserId } };
    } else if (!['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }
    const cohorts = await prisma.cohort.findMany({
      where,
      include: {
        course: true,
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: cohorts });
  } catch (error) {
    console.error('[getCohorts Error]', error);
    return res.status(500).json({ success: false, message: 'Ангиудын жагсаалт авахад алдаа гарлаа' });
  }
};

const attachmentSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  storageKey: true,
  scanStatus: true,
} as const;

const assignmentAttachmentInclude = {
  attachments: {
    include: { fileAsset: { select: attachmentSelect } },
  },
} as const;

// 3. Assignments & Submissions
export const getAssignments = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    const where: any = { organizationId, deletedAt: null };
    const studentFacingRoles = ['STUDENT', 'PARENT'];

    switch (role) {
      case 'STUDENT':
        where.module = { course: { cohorts: { some: { enrollments: { some: { userId } } } } } };
        break;
      case 'INSTRUCTOR':
        where.module = { course: { instructorId: userId } };
        break;
      case 'PARENT': {
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentUserId: true },
        });
        if (guardian) {
          where.module = { course: { cohorts: { some: { enrollments: { some: { userId: guardian.studentUserId } } } } } };
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
      }
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }
    if (studentFacingRoles.includes(role)) where.status = 'PUBLISHED';

    const assignments = await prisma.assignment.findMany({ where, include: assignmentAttachmentInclude });
    return res.json({ success: true, data: assignments });
  } catch (error: any) {
    console.error('[getAssignments Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get assignments' });
  }
};

export const getSubmissions = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const where: any = { organizationId };
    if (user!.role === 'STUDENT') {
      // A student's own history view needs every attempt, including drafts
      // and superseded resubmissions — no isLatest/status filter here.
      where.studentId = user!.userId;
    } else if (user!.role === 'INSTRUCTOR') {
      where.assignment = { module: { course: { instructorId: user!.userId } } };
      where.isLatest = true;
      where.status = 'SUBMITTED';
    } else if (['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'].includes(user!.role)) {
      where.isLatest = true;
      where.status = 'SUBMITTED';
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        assignment: true,
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        grades: true,
        attachments: { include: { fileAsset: { select: attachmentSelect } } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('[getSubmissions Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get submissions' });
  }
};

// 4. Quizzes & Attempts
export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    const where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.module = { course: { cohorts: { some: { enrollments: { some: { userId } } } } } };
        break;
      case 'INSTRUCTOR':
        where.module = { course: { instructorId: userId } };
        break;
      case 'PARENT': {
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentUserId: true },
        });
        if (guardian) {
          where.module = { course: { cohorts: { some: { enrollments: { some: { userId: guardian.studentUserId } } } } } };
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
      }
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const quizzes = await prisma.quiz.findMany({ where });
    return res.json({ success: true, data: quizzes });
  } catch (error: any) {
    console.error('[getQuizzes Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get quizzes' });
  }
};

// 5. Attendance
export const getAttendance = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    const { cohortId, studentId, from, to, status } = req.query as unknown as {
      cohortId?: string; studentId?: string; from?: Date; to?: Date; status?: string;
    };
    const where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.studentId = userId;
        break;
      case 'INSTRUCTOR':
        where.cohort = { course: { instructorId: userId } };
        break;
      case 'PARENT': {
        const guardians = await prisma.guardian.findMany({
          where: { parentUserId: userId, organizationId, status: 'APPROVED' },
          select: { studentUserId: true, permissions: true },
        });
        const allowedStudentIds = guardians
          .filter((guardian) => guardian.permissions.includes('VIEW_ATTENDANCE'))
          .map((guardian) => guardian.studentUserId);
        if (allowedStudentIds.length === 0 || (studentId && !allowedStudentIds.includes(studentId))) {
          return res.json({ success: true, data: [] });
        }
        where.studentId = studentId || { in: allowedStudentIds };
        break;
      }
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    if (cohortId) where.cohortId = cohortId;
    if (studentId && role !== 'PARENT' && role !== 'STUDENT') where.studentId = studentId;
    if (status) where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        cohort: { select: { id: true, name: true, course: { select: { id: true, title: true } } } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });
    return res.json({ success: true, data: attendance });
  } catch (error: any) {
    console.error('[getAttendance Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get attendance' });
  }
};

// 6. Grades
export const getGrades = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    const where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.studentId = userId;
        break;
      case 'INSTRUCTOR':
        where.submission = { assignment: { module: { course: { instructorId: userId } } } };
        break;
      case 'PARENT': {
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentUserId: true },
        });
        if (guardian) {
          where.studentId = guardian.studentUserId;
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
      }
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const grades = await prisma.grade.findMany({ where });
    return res.json({ success: true, data: grades });
  } catch (error: any) {
    console.error('[getGrades Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get grades' });
  }
};

// 7. Users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { role } = user!;
    const where: any = { organizationId };

    switch (role) {
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF': {
        const users = await prisma.user.findMany({
          where,
          select: {
            id: true,
            organizationId: true,
            username: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return res.json({ success: true, data: users });
      }
      default:
        // Other roles should not be able to list all users
        return res.json({ success: true, data: [] });
    }
  } catch (error: any) {
    console.error('[getUsers Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get users' });
  }
};

export const getTeacherStudents = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const { role, userId } = req.user!;
    const where: any = { organizationId, role: 'STUDENT' };

    if (role === 'INSTRUCTOR') {
      where.enrollments = {
        some: {
          cohort: {
            course: { instructorId: userId },
          },
        },
      };
    } else if (!['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const students = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        enrollments: {
          where: role === 'INSTRUCTOR'
            ? { cohort: { course: { instructorId: userId } } }
            : undefined,
          select: {
            cohort: {
              select: {
                id: true,
                name: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return res.json({ success: true, data: students });
  } catch (error) {
    console.error('[getTeacherStudents Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get enrolled students' });
  }
};

export const getAvailableStudents = async (req: Request, res: Response) => {
  try {
    const students = await prisma.user.findMany({
      where: { organizationId: req.organizationId!, role: 'STUDENT' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: req.user!.role === 'INSTRUCTOR'
            ? { cohort: { course: { instructorId: req.user!.userId } } }
            : undefined,
          select: {
            id: true,
            cohortId: true,
            cohort: {
              select: {
                name: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return res.json({ success: true, data: students });
  } catch (error) {
    console.error('[getAvailableStudents Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get students' });
  }
};

// 8. Student dashboard
export const getStudentDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const studentId = req.user!.userId;
    const enrolledCourseWhere = {
      organizationId,
      deletedAt: null,
      cohorts: { some: { enrollments: { some: { userId: studentId } } } },
    };

    const [coursesCount, assignmentsCount, examsCount] = await Promise.all([
      prisma.course.count({ where: enrolledCourseWhere }),
      prisma.assignment.count({
        where: { organizationId, module: { course: enrolledCourseWhere } },
      }),
      prisma.quiz.count({
        where: { organizationId, module: { course: enrolledCourseWhere } },
      }),
    ]);

    // No lesson-completion model exists, so do not manufacture progress values.
    const courseProgress: { label: string; progress: number }[] = [];

    const upcomingAssignmentsRaw = await prisma.assignment.findMany({
      where: {
        organizationId,
        dueDate: { gte: new Date() },
        module: { course: enrolledCourseWhere },
      },
      include: { module: { include: { course: true } } },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });
    const upcomingAssignments = upcomingAssignmentsRaw.map(a => ({
      title: a.title,
      subtitle: a.dueDate.toISOString(),
    }));

    const dayByIndex = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
    const todayClasses = await prisma.schedule.findMany({
      where: {
        organizationId,
        dayOfWeek: dayByIndex[new Date().getDay()],
        course: enrolledCourseWhere,
      },
      include: { course: { select: { id: true, title: true } } },
      orderBy: { startTime: 'asc' },
    });

    const recentGradesRaw = await prisma.grade.findMany({
      where: { organizationId, studentId },
      include: { submission: { include: { assignment: true } } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
    });
    const recentGrades = recentGradesRaw.map(grade => ({
      label: grade.submission?.assignment?.title || 'Даалгавар',
      subtitle: new Date(grade.gradedAt).toLocaleDateString('mn-MN'),
      value: grade.score,
    }));

    const notificationProjection = await getNotificationProjection(organizationId, studentId);
    const notifications = notificationProjection.items.map(n => ({
      title: n.title,
      subtitle: n.body,
    }));

    const [presentCount, totalAttendance] = await Promise.all([
      prisma.attendance.count({ where: { organizationId, studentId, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { organizationId, studentId } }),
    ]);
    const engagementRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
    const engagement = { value: `${engagementRate}%` };

    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId, userId: studentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const activityFeed = auditLogs.map((log, index) => ({
      title: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
      active: index === 0,
    }));

    const dashboardData = {
      stats: {
        courses: coursesCount,
        assignments: assignmentsCount,
        exams: examsCount,
      },
      courseProgress,
      upcomingAssignments,
      todayClasses,
      recentGrades,
      notifications,
      engagement,
      activityFeed,
    };

    return res.json({ success: true, data: dashboardData });
  } catch (error: any) {
    console.error('Error fetching student dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Оюутны хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};

// 9. Admin dashboard
export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Stats: real DB counts
    const [studentsCount, instructorsCount, staffCount, coursesCount, activeCohortsCount, presentCount, totalAttendanceCount, billingSummary, atRiskSummary] = await Promise.all([
      prisma.user.count({ where: { organizationId, role: 'STUDENT' } }),
      prisma.user.count({ where: { organizationId, role: 'INSTRUCTOR' } }),
      prisma.user.count({ where: { organizationId, role: { notIn: ['STUDENT', 'INSTRUCTOR'] } } }),
      prisma.course.count({ where: { organizationId, deletedAt: null } }),
      prisma.cohort.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.attendance.count({ where: { organizationId, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { organizationId } }),
      getOrganizationBillingSummary(organizationId),
      getDashboardAtRiskSummary(organizationId),
    ]);
    const averageAttendancePct = totalAttendanceCount > 0 ? Math.round((presentCount / totalAttendanceCount) * 100) : null;

    // 2. Recent Users: last 5 users
    const recentUsersRaw = await prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const recentUsers = recentUsersRaw.map(user => ({
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      email: user.email,
    }));

    // 3. Activity overview: real % change computations
    const [newUsersLast30, usersBefore30] = await Promise.all([
      prisma.user.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { organizationId, createdAt: { lt: thirtyDaysAgo } } }),
    ]);
    const userGrowthPct = usersBefore30 > 0
      ? Math.round((newUsersLast30 / usersBefore30) * 100)
      : (newUsersLast30 > 0 ? 100 : 0);

    const coursesWithRecentSubmission = await prisma.course.count({
      where: {
        organizationId,
        deletedAt: null,
        modules: { some: { assignments: { some: { submissions: { some: { submittedAt: { gte: thirtyDaysAgo } } } } } } },
      },
    });
    const courseEngagementPct = coursesCount > 0 ? Math.round((coursesWithRecentSubmission / coursesCount) * 100) : 0;

    const activityOverview = {
      userGrowth: {
        label: 'Хэрэглэгчийн өсөлт (сүүлийн 30 хоног)',
        value: `${userGrowthPct >= 0 ? '+' : ''}${userGrowthPct}%`,
      },
      courseEngagement: {
        label: 'Хичээлийн идэвх (сүүлийн 30 хоног)',
        value: `${courseEngagementPct}%`,
      },
    };

    // 4. System logs: real recent audit log entries
    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const systemLogs = auditLogs.map(log => ({ message: `${log.action} • ${log.entity}` }));

    // 5. System status: real for this service/DB (the query above already succeeded);
    // real timeout-guarded health checks for the others, never a hardcoded "Online".
    const authOnline = await checkServiceHealth(process.env.AUTH_SERVICE_URL || 'http://localhost:8001');
    const systemStatus = [
      { label: 'Academic Service', value: 'Online', status: 'OK' },
      { label: 'Auth Service', value: authOnline ? 'Online' : 'Тодорхойгүй', status: authOnline ? 'OK' : 'UNKNOWN' },
      { label: 'Database (PostgreSQL)', value: 'Connected', status: 'OK' },
    ];

    const dashboardData = {
      stats: {
        students: studentsCount,
        instructors: instructorsCount,
        staff: staffCount,
        courses: coursesCount,
        activeCohorts: activeCohortsCount,
        averageAttendancePct,
        revenue: billingSummary?.revenue ?? null,
        receivable: billingSummary?.receivable ?? null,
        billingCurrency: billingSummary?.currency ?? null,
      },
      activityOverview,
      activityMetrics: [
        { label: 'Шинэ хэрэглэгчид', value: newUsersLast30, max: Math.max(newUsersLast30, usersBefore30, 1) },
        { label: 'Өмнөх 30 хоногийн хэрэглэгчид', value: usersBefore30, max: Math.max(newUsersLast30, usersBefore30, 1) },
        { label: 'Идэвхтэй хичээлүүд', value: coursesWithRecentSubmission, max: Math.max(coursesCount, 1) },
        { label: 'Нийт хичээл', value: coursesCount, max: Math.max(coursesCount, 1) },
      ],
      recentUsers,
      atRiskSummary,
      systemLogs,
      systemStatus,
    };

    return res.json({ success: true, data: dashboardData });
  } catch (error: any) {
    console.error('Error fetching admin dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Админы хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};

// 10. Teacher dashboard
export const getTeacherDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const instructorId = req.user!.userId;

    const instructorCourses = await prisma.course.findMany({
      where: { organizationId, instructorId, deletedAt: null },
      include: {
        modules: {
          include: {
            assignments: { include: { submissions: { include: { grades: true } } } },
          },
        },
        cohorts: { include: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const studentIdSet = new Set<string>();
    let pendingReviews = 0;
    const courseList: { title: string; students: number; progress: number }[] = [];
    const reviewList: { title: string; pending: number }[] = [];

    for (const course of instructorCourses) {
      const courseStudentIds = new Set<string>();
      course.cohorts.forEach(cohort =>
        cohort.enrollments.forEach(e => {
          courseStudentIds.add(e.userId);
          studentIdSet.add(e.userId);
        })
      );

      let courseAssignmentsCount = 0;
      let courseActualSubmissions = 0;

      course.modules.forEach(module => {
        module.assignments.forEach(assignment => {
          courseAssignmentsCount += 1;
          courseActualSubmissions += assignment.submissions.length;

          const ungraded = assignment.submissions.filter(s => s.grades.length === 0).length;
          pendingReviews += ungraded;
          if (ungraded > 0) {
            reviewList.push({ title: assignment.title, pending: ungraded });
          }
        });
      });

      const expectedSubmissions = courseStudentIds.size * courseAssignmentsCount;
      const progress = expectedSubmissions > 0
        ? Math.min(100, Math.round((courseActualSubmissions / expectedSubmissions) * 100))
        : 0;

      courseList.push({ title: course.title, students: courseStudentIds.size, progress });
    }

    // Average grade + top performers across this instructor's students
    const gradesForInstructor = await prisma.grade.findMany({
      where: { organizationId, submission: { assignment: { module: { course: { instructorId } } } } },
      include: { student: true },
      orderBy: { gradedAt: 'desc' },
    });
    const averageGrade = gradesForInstructor.length > 0
      ? Math.round(gradesForInstructor.reduce((sum, g) => sum + g.score, 0) / gradesForInstructor.length)
      : 0;
    const perfList = gradesForInstructor.slice(0, 5).map(g => ({
      student: `${g.student.lastName} ${g.student.firstName}`.trim(),
      score: `${g.score} оноо`,
    }));

    const upcomingClasses = await prisma.schedule.findMany({
      where: { organizationId, teacherId: instructorId },
      include: { course: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      take: 5,
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId, userId: instructorId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const activityFeed = auditLogs.map(log => ({
      message: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
    }));

    return res.json({
      success: true,
      data: {
        stats: {
          courses: instructorCourses.length,
          students: studentIdSet.size,
          averageGrade: scoreToLetter(averageGrade),
          pendingReviews,
          gradesCount: gradesForInstructor.length,
        },
        courseList,
        reviewList,
        upcomingClasses,
        perfList,
        activityFeed,
      },
    });
  } catch (error: any) {
    console.error('Error fetching teacher dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Багшийн хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};

// 11. Parent dashboard
export const getParentDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const parentUserId = req.user!.userId;
    const now = new Date();

    const guardianLinks = await prisma.guardian.findMany({
      where: { organizationId, parentUserId, status: 'APPROVED' },
      include: { studentUser: true },
      orderBy: { createdAt: 'asc' },
    });

    if (guardianLinks.length === 0) {
      return res.json({
        success: true,
        data: {
          hasChild: false,
          stats: [],
          child: null,
          children: [],
          assignmentProgress: [],
          upcomingEvents: [],
          teacherMessages: [],
          attendanceBreakdown: [],
          recentGrades: [],
          schoolNotices: [],
          courseContacts: [],
          academicProgress: { value: null },
          activityFeed: [],
        },
      });
    }

    const requestedChildId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    const guardianLink = guardianLinks.find(g => g.studentUserId === requestedChildId) || guardianLinks[0];
    const children = guardianLinks.map(g => ({
      id: g.studentUser.id,
      name: `${g.studentUser.lastName} ${g.studentUser.firstName}`.trim(),
      studentId: g.studentUser.studentId,
    }));

    const child = guardianLink.studentUser;
    const childId = child.id;
    const permissions = guardianLink.permissions;

    const [presentCount, absentCount, lateCount, excusedCount, totalAttendance] = await Promise.all([
      prisma.attendance.count({ where: { organizationId, studentId: childId, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { organizationId, studentId: childId, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { organizationId, studentId: childId, status: 'LATE' } }),
      prisma.attendance.count({ where: { organizationId, studentId: childId, status: 'EXCUSED' } }),
      prisma.attendance.count({ where: { organizationId, studentId: childId } }),
    ]);
    const attendancePct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    const childGrades = await prisma.grade.findMany({
      where: { organizationId, studentId: childId },
      include: { submission: { include: { assignment: true } } },
      orderBy: { gradedAt: 'desc' },
    });
    const avgGrade = childGrades.length > 0
      ? Math.round(childGrades.reduce((s, g) => s + g.score, 0) / childGrades.length)
      : 0;

    const childEnrollments = await prisma.enrollment.findMany({
      where: { organizationId, userId: childId },
      include: { cohort: { include: { course: { include: { modules: { include: { assignments: true } } } } } } },
    });

    const childAssignments: { id: string; title: string; dueDate: Date }[] = [];
    childEnrollments.forEach(e => {
      e.cohort.course.modules.forEach(m => {
        m.assignments.forEach(a => childAssignments.push({ id: a.id, title: a.title, dueDate: a.dueDate }));
      });
    });

    const enrolledCourses = new Map(
      childEnrollments.map(e => [e.cohort.course.id, e.cohort.course]),
    );
    const instructorIds = [...new Set([...enrolledCourses.values()].map(c => c.instructorId))];
    const instructors = instructorIds.length
      ? await prisma.user.findMany({
        where: { id: { in: instructorIds }, organizationId },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
      : [];
    const instructorById = new Map(instructors.map(i => [i.id, i]));
    const courseContacts = [...enrolledCourses.values()].map(course => {
      const instructor = instructorById.get(course.instructorId);
      return {
        courseId: course.id,
        courseTitle: course.title,
        courseCode: course.code,
        instructorName: instructor ? `${instructor.lastName} ${instructor.firstName}`.trim() : null,
        instructorEmail: instructor?.email || null,
      };
    });

    const childSubmissions = await prisma.submission.findMany({
      where: { organizationId, studentId: childId },
      include: { grades: true },
    });
    const submissionByAssignment = new Map(childSubmissions.map(s => [s.assignmentId, s]));

    const assignmentProgress = childAssignments.slice(0, 6).map(a => {
      const submission = submissionByAssignment.get(a.id);
      const progress = submission ? (submission.grades.length > 0 ? 100 : 50) : 0;
      return { label: a.title, progress };
    });

    const gradedCount = childSubmissions.filter(s => s.grades.length > 0).length;
    const totalAssignmentsForHomework = childAssignments.length;
    const homeworkPct = totalAssignmentsForHomework > 0
      ? Math.round((gradedCount / totalAssignmentsForHomework) * 100)
      : 0;

    const upcomingEvents = childAssignments
      .filter(a => a.dueDate >= now)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 3)
      .map(a => ({ title: a.title, subtitle: new Date(a.dueDate).toLocaleDateString('mn-MN') }));

    const parentNotifications = await getNotificationProjection(organizationId, parentUserId);
    const unreadNotifications = parentNotifications.unreadCount;
    const teacherMessages = parentNotifications.items.map(n => ({
      subject: n.title,
      sender: 'Мэдэгдэл',
      body: n.body,
    }));

    const attendanceBreakdown = [
      { label: 'Ирсэн', value: attendancePct },
      { label: 'Тасалсан', value: totalAttendance > 0 ? Math.round(((absentCount + excusedCount) / totalAttendance) * 100) : 0 },
      { label: 'Хоцорсон', value: totalAttendance > 0 ? Math.round((lateCount / totalAttendance) * 100) : 0 },
    ];

    const recentGrades = childGrades.slice(0, 5).map(g => ({
      label: g.submission?.assignment?.title || 'Даалгавар',
      value: scoreToLetter(g.score),
      subtitle: new Date(g.gradedAt).toLocaleDateString('mn-MN'),
    }));

    const announcementsRaw = await prisma.announcement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const schoolNotices = announcementsRaw.map(a => ({ title: a.title, body: a.body }));

    const latestCohort = childEnrollments[0]?.cohort;
    const meta = latestCohort ? latestCohort.name : 'Бүртгэлгүй анги';

    const childAuditLogs = await prisma.auditLog.findMany({
      where: { organizationId, userId: childId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const activityFeed = childAuditLogs.map((log, index) => ({
      title: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
      active: index === 0,
    }));

    const canViewGrades = permissions.includes('VIEW_GRADES');
    const canViewAttendance = permissions.includes('VIEW_ATTENDANCE');

    return res.json({
      success: true,
      data: {
        hasChild: true,
        children,
        stats: [
          { title: 'Ирц', value: canViewAttendance ? `${attendancePct}%` : '—', delta: '' },
          { title: 'Дундаж дүн', value: canViewGrades ? scoreToLetter(avgGrade) : '—', delta: '' },
          { title: 'Дaалгавар', value: `${gradedCount}/${totalAssignmentsForHomework}`, delta: `${homeworkPct}%` },
          { title: 'Мэдэгдэл', value: unreadNotifications, delta: unreadNotifications > 0 ? `Шинэ ${unreadNotifications}` : '' },
        ],
        child: {
          id: child.id,
          name: `${child.lastName} ${child.firstName}`.trim(),
          badge: 'Оюутан',
          meta,
          profileStat: {
            label: 'Ирцийн хувь',
            value: canViewAttendance ? `${attendancePct}%` : '—',
            progress: canViewAttendance ? attendancePct : 0,
            hint: canViewAttendance ? `Энэ семестрт ${absentCount + excusedCount} удаа тасалсан` : 'Ирцийн мэдээлэл харах эрхгүй',
          },
        },
        assignmentProgress,
        upcomingEvents,
        teacherMessages,
        attendanceBreakdown: canViewAttendance ? attendanceBreakdown : [],
        recentGrades: canViewGrades ? recentGrades : [],
        schoolNotices,
        courseContacts,
        academicProgress: { value: canViewGrades ? scoreToLetter(avgGrade) : null },
        activityFeed,
      },
    });
  } catch (error: any) {
    console.error('Error fetching parent dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Эцэг эхийн хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};

// 12. Staff dashboard
const documentStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const scholarshipStatusLabel: Record<string, string> = {
  NEW: 'New',
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const getStaffDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      documentsCount,
      scholarshipsCount,
      announcementsCount,
      reportsCount,
      pendingDocumentsRaw,
      scholarshipRequestsRaw,
      announcementsRaw,
      auditLogs,
      openDocumentApplications,
      openScholarshipApplications,
      todaysAnnouncements,
    ] = await Promise.all([
      prisma.documentRequest.count({ where: { organizationId } }),
      prisma.scholarshipRequest.count({ where: { organizationId } }),
      prisma.announcement.count({ where: { organizationId } }),
      // "Reports" has no dedicated model — proxied to certificates issued in the
      // last 30 days, the closest real completion/output signal that exists.
      prisma.certificate.count({ where: { organizationId, issuedAt: { gte: thirtyDaysAgo } } }),
      prisma.documentRequest.findMany({
        where: { organizationId, status: { in: ['PENDING', 'IN_REVIEW'] } },
        include: { student: true },
        orderBy: { requestedAt: 'desc' },
        take: 10,
      }),
      prisma.scholarshipRequest.findMany({
        where: { organizationId },
        include: { student: true },
        orderBy: { requestedAt: 'desc' },
        take: 10,
      }),
      prisma.announcement.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.documentRequest.count({ where: { organizationId, status: { in: ['PENDING', 'IN_REVIEW'] } } }),
      prisma.scholarshipRequest.count({ where: { organizationId, status: 'NEW' } }),
      prisma.announcement.count({ where: { organizationId, createdAt: { gte: startOfToday } } }),
    ]);

    const pendingDocuments = pendingDocumentsRaw.map(d => ({
      title: d.title,
      student: `${d.student.lastName} ${d.student.firstName}`.trim(),
      status: documentStatusLabel[d.status] || d.status,
    }));

    const scholarshipRequests = scholarshipRequestsRaw.map(s => ({
      student: `${s.student.lastName} ${s.student.firstName}`.trim(),
      program: s.program,
      status: scholarshipStatusLabel[s.status] || s.status,
    }));

    const announcements = announcementsRaw.map(a => ({
      title: a.title,
      time: new Date(a.createdAt).toLocaleString('mn-MN'),
    }));

    const recentActivities = auditLogs.map(log => `${log.action} • ${log.entity}`);

    return res.json({
      success: true,
      data: {
        stats: [
          { key: 'documents', label: 'Бичиг баримт', value: documentsCount },
          { key: 'scholarships', label: 'Тэтгэлэг', value: scholarshipsCount },
          { key: 'announcements', label: 'Зарлал', value: announcementsCount },
          { key: 'reports', label: 'Тайлан', value: reportsCount },
        ],
        pendingDocuments,
        scholarshipRequests,
        announcements,
        recentActivities,
        quickStats: {
          openApplications: openDocumentApplications + openScholarshipApplications,
          todaysNotices: todaysAnnouncements,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching staff dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Ажилтны хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};

// 13. Principal dashboard
export const getPrincipalDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const now = new Date();
    const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalStudents,
      distinctEnrolledUsers,
      distinctCertifiedStudents,
      presentCount,
      totalAttendance,
      coursesForDept,
      enrollmentsForTrend,
      attendanceForTrend,
    ] = await Promise.all([
      prisma.user.count({ where: { organizationId, role: 'STUDENT' } }),
      prisma.enrollment.findMany({ where: { organizationId }, select: { userId: true }, distinct: ['userId'] }),
      prisma.certificate.findMany({ where: { organizationId }, select: { studentId: true }, distinct: ['studentId'] }),
      prisma.attendance.count({ where: { organizationId, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { organizationId } }),
      prisma.course.findMany({
        where: { organizationId, deletedAt: null },
        select: { title: true, department: true },
      }),
      prisma.enrollment.findMany({ where: { organizationId, enrolledAt: { gte: sixMonthsAgoStart } }, select: { enrolledAt: true } }),
      prisma.attendance.findMany({ where: { organizationId, date: { gte: sixMonthsAgoStart } }, select: { date: true, status: true, studentId: true } }),
    ]);

    const totalEnrollment = distinctEnrolledUsers.length;
    const graduationRatePct = totalStudents > 0 ? Math.round((distinctCertifiedStudents.length / totalStudents) * 100) : 0;
    const attendancePct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
    const departmentCount = new Set(coursesForDept.map(c => c.department || c.title)).size;

    // Monthly grouping (last 6 months) — no historical snapshot table needed,
    // Enrollment.enrolledAt / Attendance.date already carry real timestamps.
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = (d: Date) => d.toLocaleDateString('mn-MN', { month: 'short', year: 'numeric' });
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: monthKey(d), label: monthLabel(d) };
    });

    const enrollmentByMonth = new Map<string, number>();
    enrollmentsForTrend.forEach(e => {
      const key = monthKey(new Date(e.enrolledAt));
      enrollmentByMonth.set(key, (enrollmentByMonth.get(key) || 0) + 1);
    });
    const enrollmentSeries = months.map(m => ({ label: m.label, value: enrollmentByMonth.get(m.key) || 0 }));

    const attendanceByMonth = new Map<string, { present: number; total: number }>();
    attendanceForTrend.forEach(a => {
      const key = monthKey(new Date(a.date));
      const bucket = attendanceByMonth.get(key) || { present: 0, total: 0 };
      bucket.total += 1;
      if (a.status === 'PRESENT') bucket.present += 1;
      attendanceByMonth.set(key, bucket);
    });
    const attendanceSeries = months.map(m => {
      const bucket = attendanceByMonth.get(m.key);
      return { label: m.label, value: bucket && bucket.total > 0 ? Math.round((bucket.present / bucket.total) * 100) : 0 };
    });

    const latestEnrollment = enrollmentSeries[enrollmentSeries.length - 1];
    const priorEnrollment = enrollmentSeries[enrollmentSeries.length - 2];
    const enrollmentTrendValue = !priorEnrollment
      ? 'Тодорхойгүй'
      : latestEnrollment.value > priorEnrollment.value
      ? 'Өсөлттэй'
      : latestEnrollment.value < priorEnrollment.value
      ? 'Буурсан'
      : 'Тогтвортой';
    const enrollmentDeltaPct = priorEnrollment && priorEnrollment.value > 0
      ? Math.round(((latestEnrollment.value - priorEnrollment.value) / priorEnrollment.value) * 100)
      : (latestEnrollment.value > 0 ? 100 : 0);

    const activeStudentsThisMonth = new Set(
      attendanceForTrend
        .filter(a => monthKey(new Date(a.date)) === months[months.length - 1].key)
        .map(a => a.studentId)
    ).size;

    const latestAttendance = attendanceSeries[attendanceSeries.length - 1];

    // Department performance: real Course.department (fallback to course title), avg real grade
    const gradesWithCourse = await prisma.grade.findMany({
      where: { organizationId },
      include: { submission: { include: { assignment: { include: { module: { include: { course: true } } } } } } },
    });
    const deptScores = new Map<string, { total: number; count: number }>();
    gradesWithCourse.forEach(g => {
      const course = g.submission?.assignment?.module?.course;
      if (!course) return;
      const key = course.department || course.title;
      const bucket = deptScores.get(key) || { total: 0, count: 0 };
      bucket.total += g.score;
      bucket.count += 1;
      deptScores.set(key, bucket);
    });
    const departmentPerformance = Array.from(deptScores.entries()).map(([label, { total, count }]) => ({
      label,
      value: count > 0 ? scoreToLetter(total / count) : 'N/A',
    }));

    const authOnline = await checkServiceHealth(process.env.AUTH_SERVICE_URL || 'http://localhost:8001');
    const systemStatusValue = authOnline ? 'Хэвийн' : 'Анхаарах шаардлагатай';

    const auditLogs = await prisma.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 });
    const activityFeed = auditLogs.map((log, index) => ({
      title: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
      active: index === 0,
    }));

    return res.json({
      success: true,
      data: {
        stats: [
          { title: 'Элсэлт', value: totalEnrollment },
          { title: 'Төгсөлт', value: `${graduationRatePct}%` },
          { title: 'Ирц', value: `${attendancePct}%` },
          { title: 'Тэнхим', value: departmentCount },
        ],
        enrollmentTrend: { value: enrollmentTrendValue },
        enrollmentSeries,
        // Note: the second slot originally read "Гарсан оюутан" (dropout count), a metric
        // with no real backing model — replaced with a genuinely trackable metric instead
        // of fabricating attrition data.
        enrollmentDeltas: [
          { label: 'Шинэ элсэлт', value: `${enrollmentDeltaPct >= 0 ? '+' : ''}${enrollmentDeltaPct}% энэ сард` },
          { label: 'Идэвхтэй суралцагчид', value: `${activeStudentsThisMonth} сурагч энэ сард` },
        ],
        attendanceTrend: { value: `${latestAttendance.value}%` },
        attendanceSeries,
        departmentPerformance,
        graduationRate: { value: `${graduationRatePct}%` },
        // No real reports/document-generation model exists — honestly empty.
        managementReports: [] as { title: string; date: string }[],
        systemStatus: { value: systemStatusValue },
        activityFeed,
      },
    });
  } catch (error: any) {
    console.error('Error fetching principal dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Захирлын хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};

// 14. Finance dashboard
export const getFinanceDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;

    const [totalStudentsCount, totalCourses, auditLogs] = await Promise.all([
      prisma.user.count({ where: { organizationId, role: 'STUDENT', deletedAt: null } }),
      prisma.course.count({ where: { organizationId, deletedAt: null } }),
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Per-student tuition invoicing has no backing data model yet (billing-service's
    // Invoice/Payment models are scoped to the organization's own SaaS subscription,
    // not individual students) — so invoice/transaction/trend figures are intentionally
    // left empty rather than fabricated. Only real, queryable data is returned.
    const activityFeed = auditLogs.map(log => ({
      title: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
    }));

    return res.json({
      success: true,
      data: {
        stats: {
          totalCollected: '0 ₮',
          pendingAmount: '0 ₮',
          overdueAmount: '0 ₮',
          coverageRate: '0%',
          totalStudents: totalStudentsCount,
          totalCourses,
        },
        invoices: [],
        recentTransactions: [],
        monthlyTrends: [],
        activityFeed,
      },
    });
  } catch (error: any) {
    console.error('Error fetching finance dashboard data:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Санхүүгийн хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
    });
  }
};
