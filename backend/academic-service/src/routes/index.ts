import { Router } from 'express';
import { authMiddleware, tenantMiddleware, requireRole } from '@lms/shared';
import {
  getCourses,
  getCourseById,
  getCohorts,
  getAssignments,
  getQuizzes,
  getAttendance,
  getGrades,
  getUsers,
  getStudentDashboard,
  getAdminDashboard,
  getTeacherDashboard,
  getParentDashboard,
  getStaffDashboard,
  getPrincipalDashboard,
} from '../controllers/academic.controller';

const router = Router();

// Health check endpoint stays public (liveness probe, used by other services' dashboards)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'academic-service' });
});

// Everything below requires a valid JWT; tenantMiddleware resolves the real organizationId from it.
router.use(authMiddleware, tenantMiddleware);

// Courses & Modules
router.get('/courses', getCourses);
router.get('/courses/:id', getCourseById);

// Cohorts
router.get('/cohorts', getCohorts);

// Assignments
router.get('/assignments', getAssignments);

// Quizzes
router.get('/quizzes', getQuizzes);

// Attendance
router.get('/attendance', getAttendance);

// Grades
router.get('/grades', getGrades);

// Users
router.get('/users', getUsers);

// Dashboards — each scoped to its matching role
router.get('/dashboards/student', requireRole('STUDENT'), getStudentDashboard);
router.get('/dashboards/teacher', requireRole('INSTRUCTOR'), getTeacherDashboard);
router.get('/dashboards/admin', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), getAdminDashboard);
router.get('/dashboards/parent', requireRole('PARENT'), getParentDashboard);
router.get('/dashboards/staff', requireRole('STAFF'), getStaffDashboard);
router.get('/dashboards/principal', requireRole('PRINCIPAL'), getPrincipalDashboard);

export default router;
