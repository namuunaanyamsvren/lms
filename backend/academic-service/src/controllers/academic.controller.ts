import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client-academic';

const prisma = new PrismaClient();

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

// 1. Courses & Modules & Lessons
export const getCourses = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    let where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.cohorts = { some: { enrollments: { some: { userId } } } };
        break;
      case 'INSTRUCTOR':
        where.instructorId = userId;
        break;
      case 'PARENT':
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId },
          select: { studentId: true },
        });
        if (guardian) {
          where.cohorts = { some: { enrollments: { some: { userId: guardian.studentId } } } };
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
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
    const { id } = req.params;
    const course = await prisma.course.findFirst({
      where: { id, organizationId },
      include: {
        modules: {
          include: {
            lessons: true,
            assignments: true,
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Алдаа гарлаа', error: error.message });
  }
};

// 2. Cohorts
export const getCohorts = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const cohorts = await prisma.cohort.findMany({
      where: { organizationId },
      include: {
        course: true,
        enrollments: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: cohorts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Ангиудын жагсаалт авахад алдаа гарлаа', error: error.message });
  }
};

// 3. Assignments & Submissions
export const getAssignments = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    let where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.module = { course: { cohorts: { some: { enrollments: { some: { userId } } } } } };
        break;
      case 'INSTRUCTOR':
        where.module = { course: { instructorId: userId } };
        break;
      case 'PARENT':
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentId: true },
        });
        if (guardian) {
          where.module = { course: { cohorts: { some: { enrollments: { some: { userId: guardian.studentId } } } } } };
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const assignments = await prisma.assignment.findMany({ where });
    return res.json({ success: true, data: assignments });
  } catch (error: any) {
    console.error('[getAssignments Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get assignments' });
  }
};

// 4. Quizzes & Attempts
export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const { organizationId, user } = req;
    const { userId, role } = user!;
    let where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.module = { course: { cohorts: { some: { enrollments: { some: { userId } } } } } };
        break;
      case 'INSTRUCTOR':
        where.module = { course: { instructorId: userId } };
        break;
      case 'PARENT':
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentId: true },
        });
        if (guardian) {
          where.module = { course: { cohorts: { some: { enrollments: { some: { userId: guardian.studentId } } } } } };
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
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
    let where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.studentId = userId;
        break;
      case 'INSTRUCTOR':
        where.cohort = { course: { instructorId: userId } };
        break;
      case 'PARENT':
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentId: true },
        });
        if (guardian) {
          where.studentId = guardian.studentId;
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        break;
      default:
        return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const attendance = await prisma.attendance.findMany({ where });
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
    let where: any = { organizationId };

    switch (role) {
      case 'STUDENT':
        where.studentId = userId;
        break;
      case 'INSTRUCTOR':
        where.submission = { assignment: { module: { course: { instructorId: userId } } } };
        break;
      case 'PARENT':
        const guardian = await prisma.guardian.findFirst({
          where: { parentUserId: userId, organizationId },
          select: { studentId: true },
        });
        if (guardian) {
          where.studentId = guardian.studentId;
        } else {
          return res.json({ success: true, data: [] });
        }
        break;
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
    let where: any = { organizationId };

    switch (role) {
      case 'ORG_ADMIN':
      case 'SUPER_ADMIN':
      case 'PRINCIPAL':
      case 'STAFF':
        const users = await prisma.user.findMany({ where });
        return res.json({ success: true, data: users });
      default:
        // Other roles should not be able to list all users
        return res.json({ success: true, data: [] });
    }
  } catch (error: any) {
    console.error('[getUsers Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to get users' });
  }
};

// 8. Student dashboard
export const getStudentDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;

    // 1. Stats: Fetch real data from the database
    const [coursesCount, assignmentsCount, examsCount] = await Promise.all([
      prisma.course.count({ where: { organizationId } }),
      prisma.assignment.count({ where: { organizationId } }),
      prisma.quiz.count({ where: { organizationId } }),
    ]);

    // 2. Course progress: real course titles, no completion-tracking model yet
    // TODO: replace mocked progress once lesson-completion tracking exists
    const courses = await prisma.course.findMany({
      where: { organizationId },
      take: 4,
      orderBy: { createdAt: 'desc' },
    });
    const courseProgress = courses.map((course, index) => ({
      label: course.title,
      progress: Math.max(20, 90 - index * 15),
    }));

    // 3. Upcoming assignments: real data, ordered by due date
    const upcomingAssignmentsRaw = await prisma.assignment.findMany({
      where: { organizationId, dueDate: { gte: new Date() } },
      include: { module: { include: { course: true } } },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });
    const upcomingAssignments = upcomingAssignmentsRaw.map(a => ({
      title: a.title,
      subtitle: a.dueDate.toISOString(),
    }));

    // 4. Today's classes: derived from active cohorts, no class-schedule model yet
    // TODO: replace with real schedule data when a timetable model exists
    const activeCohorts = await prisma.cohort.findMany({
      where: { organizationId },
      include: { course: true },
      orderBy: { startDate: 'desc' },
      take: 3,
    });
    const todayClasses = activeCohorts.map(cohort => ({
      title: cohort.course.title,
    }));

    // 5. Recent grades: real data
    const recentGradesRaw = await prisma.grade.findMany({
      where: { organizationId },
      include: { submission: { include: { assignment: true } } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
    });
    const recentGrades = recentGradesRaw.map(grade => ({
      label: grade.submission?.assignment?.title || 'Даалгавар',
      subtitle: new Date(grade.gradedAt).toLocaleDateString('mn-MN'),
      value: grade.score,
    }));

    // 6. Notifications: real data
    const notificationsRaw = await prisma.notification.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const notifications = notificationsRaw.map(n => ({
      title: n.title,
      subtitle: n.body,
    }));

    // 7. Engagement: derived from real attendance records
    const [presentCount, totalAttendance] = await Promise.all([
      prisma.attendance.count({ where: { organizationId, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { organizationId } }),
    ]);
    const engagementRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
    const engagement = { value: `${engagementRate}%` };

    // 8. Activity feed: real audit log data
    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const activityFeed = auditLogs.map((log, index) => ({
      title: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
      active: index === 0,
    }));

    // 9. Study hours: no time-tracking model yet
    // TODO: replace mocked study hours once a study-session model exists
    const dashboardData = {
      stats: {
        courses: coursesCount,
        assignments: assignmentsCount,
        exams: examsCount,
        studyHours: 12,
        studyHoursDelta: 2,
      },
      courseProgress,
      upcomingAssignments,
      todayClasses,
      recentGrades,
      notifications,
      engagement,
      activityFeed,
    };

    return res.json(dashboardData);
  } catch (error: any) {
    console.error('Error fetching student dashboard data:', error);
    return res.status(500).json({
      message: 'Оюутны хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
      error: error.message,
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
    const [studentsCount, instructorsCount, staffCount, coursesCount] = await Promise.all([
      prisma.user.count({ where: { organizationId, role: 'STUDENT' } }),
      prisma.user.count({ where: { organizationId, role: 'INSTRUCTOR' } }),
      prisma.user.count({ where: { organizationId, role: { notIn: ['STUDENT', 'INSTRUCTOR'] } } }),
      prisma.course.count({ where: { organizationId } }),
    ]);

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
    const [authOnline, billingOnline] = await Promise.all([
      checkServiceHealth(process.env.AUTH_SERVICE_URL || 'http://localhost:8001'),
      checkServiceHealth(process.env.BILLING_SERVICE_URL || 'http://localhost:8004'),
    ]);
    const systemStatus = [
      { label: 'Academic Service', value: 'Online', status: 'OK' },
      { label: 'Auth Service', value: authOnline ? 'Online' : 'Тодорхойгүй', status: authOnline ? 'OK' : 'UNKNOWN' },
      { label: 'Billing Service', value: billingOnline ? 'Online' : 'Тодорхойгүй', status: billingOnline ? 'OK' : 'UNKNOWN' },
      { label: 'Database (PostgreSQL)', value: 'Connected', status: 'OK' },
    ];

    const dashboardData = {
      stats: {
        students: studentsCount,
        instructors: instructorsCount,
        staff: staffCount,
        courses: coursesCount,
      },
      activityOverview,
      recentUsers,
      systemLogs,
      systemStatus,
    };

    return res.json(dashboardData);
  } catch (error: any) {
    console.error('Error fetching admin dashboard data:', error);
    return res.status(500).json({
      message: 'Админы хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
      error: error.message,
    });
  }
};

// 10. Teacher dashboard
export const getTeacherDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const instructorId = req.user!.userId;

    const instructorCourses = await prisma.course.findMany({
      where: { organizationId, instructorId },
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

    // Upcoming classes: instructor's own active cohorts (title only)
    // TODO: replace with real schedule data when a timetable model exists
    const instructorCohorts = await prisma.cohort.findMany({
      where: { organizationId, course: { instructorId } },
      include: { course: true },
      orderBy: { startDate: 'desc' },
      take: 3,
    });
    const upcomingClasses = instructorCohorts.map(cohort => ({ title: cohort.course.title }));

    // Activity feed: org-wide recent audit log (documented fallback — true per-instructor
    // scoping isn't feasible without typed entity linkage on AuditLog).
    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const activityFeed = auditLogs.map(log => ({
      message: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
    }));

    return res.json({
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
    });
  } catch (error: any) {
    console.error('Error fetching teacher dashboard data:', error);
    return res.status(500).json({
      message: 'Багшийн хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
      error: error.message,
    });
  }
};

// 11. Parent dashboard
export const getParentDashboard = async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId!;
    const parentUserId = req.user!.userId;
    const now = new Date();

    const guardianLink = await prisma.guardian.findFirst({
      where: { organizationId, parentUserId },
      include: { studentUser: true },
    });

    if (!guardianLink) {
      return res.json({
        hasChild: false,
        stats: [],
        child: null,
        assignmentProgress: [],
        upcomingEvents: [],
        teacherMessages: [],
        attendanceBreakdown: [],
        recentGrades: [],
        schoolNotices: [],
        academicProgress: { value: null },
        activityFeed: [],
      });
    }

    const child = guardianLink.studentUser;
    const childId = child.id;

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

    const unreadNotifications = await prisma.notification.count({
      where: { organizationId, userId: parentUserId, isRead: false },
    });

    // Reuses the per-recipient Notification model as a messaging proxy — no
    // dedicated parent-teacher messaging model exists.
    const parentNotifications = await prisma.notification.findMany({
      where: { organizationId, userId: parentUserId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const teacherMessages = parentNotifications.map(n => ({ subject: n.title, sender: 'Мэдэгдэл', body: n.body }));

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

    return res.json({
      hasChild: true,
      stats: [
        { title: 'Ирц', value: `${attendancePct}%`, delta: '' },
        { title: 'Дундаж дүн', value: scoreToLetter(avgGrade), delta: '' },
        { title: 'Дaалгавар', value: `${gradedCount}/${totalAssignmentsForHomework}`, delta: `${homeworkPct}%` },
        { title: 'Мэдэгдэл', value: unreadNotifications, delta: unreadNotifications > 0 ? `Шинэ ${unreadNotifications}` : '' },
      ],
      child: {
        name: `${child.lastName} ${child.firstName}`.trim(),
        badge: 'Оюутан',
        meta,
        profileStat: {
          label: 'Ирцийн хувь',
          value: `${attendancePct}%`,
          progress: attendancePct,
          hint: `Энэ семестрт ${absentCount + excusedCount} удаа тасалсан`,
        },
      },
      assignmentProgress,
      upcomingEvents,
      teacherMessages,
      attendanceBreakdown,
      recentGrades,
      schoolNotices,
      academicProgress: { value: scoreToLetter(avgGrade) },
      activityFeed,
    });
  } catch (error: any) {
    console.error('Error fetching parent dashboard data:', error);
    return res.status(500).json({
      message: 'Эцэг эхийн хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
      error: error.message,
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
      stats: [
        { label: 'Documents', value: documentsCount },
        { label: 'Scholarships', value: scholarshipsCount },
        { label: 'Announcements', value: announcementsCount },
        { label: 'Reports', value: reportsCount },
      ],
      pendingDocuments,
      scholarshipRequests,
      announcements,
      recentActivities,
      quickStats: {
        openApplications: openDocumentApplications + openScholarshipApplications,
        todaysNotices: todaysAnnouncements,
      },
    });
  } catch (error: any) {
    console.error('Error fetching staff dashboard data:', error);
    return res.status(500).json({
      message: 'Ажилтны хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
      error: error.message,
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
      prisma.course.findMany({ where: { organizationId }, select: { title: true, department: true } }),
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

    const [authOnline, billingOnline] = await Promise.all([
      checkServiceHealth(process.env.AUTH_SERVICE_URL || 'http://localhost:8001'),
      checkServiceHealth(process.env.BILLING_SERVICE_URL || 'http://localhost:8004'),
    ]);
    const systemStatusValue = authOnline && billingOnline ? 'Хэвийн' : 'Анхаарах шаардлагатай';

    const auditLogs = await prisma.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 });
    const activityFeed = auditLogs.map((log, index) => ({
      title: `${log.action} • ${log.entity}`,
      time: new Date(log.createdAt).toLocaleString('mn-MN'),
      active: index === 0,
    }));

    return res.json({
      stats: [
        { title: 'Элсэлт', value: totalEnrollment },
        { title: 'Төгсөлт', value: `${graduationRatePct}%` },
        { title: 'Ирц', value: `${attendancePct}%` },
        { title: 'Тэнхим', value: departmentCount },
      ],
      enrollmentTrend: { value: enrollmentTrendValue },
      // Note: the second slot originally read "Гарсан оюутан" (dropout count), a metric
      // with no real backing model — replaced with a genuinely trackable metric instead
      // of fabricating attrition data.
      enrollmentDeltas: [
        { label: 'Шинэ элсэлт', value: `${enrollmentDeltaPct >= 0 ? '+' : ''}${enrollmentDeltaPct}% энэ сард` },
        { label: 'Идэвхтэй суралцагчид', value: `${activeStudentsThisMonth} сурагч энэ сард` },
      ],
      attendanceTrend: { value: `${latestAttendance.value}%` },
      departmentPerformance,
      graduationRate: { value: `${graduationRatePct}%` },
      // No real reports/document-generation model exists — honestly empty.
      managementReports: [] as { title: string; date: string }[],
      systemStatus: { value: systemStatusValue },
      activityFeed,
    });
  } catch (error: any) {
    console.error('Error fetching principal dashboard data:', error);
    return res.status(500).json({
      message: 'Захирлын хяналтын самбарын мэдээлэл авахад алдаа гарлаа.',
      error: error.message,
    });
  }
};
