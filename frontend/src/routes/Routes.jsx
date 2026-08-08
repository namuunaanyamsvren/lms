import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LandingLayout from '../layouts/LandingLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import Landing from '../pages/Landing';
import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import Student from '../pages/Student';
import StudentAssignments from '../pages/Student/Assignments';
import StudentGradebook from '../pages/Student/Gradebook';
import StudentAttendance from '../pages/Student/AttendanceDetail';
import StudentCertificates from '../pages/Student/Certificates';
import StudentPayments from '../pages/Student/Payments';
import CertificateVerify from '../pages/CertificateVerify';
import AdminCertificates from '../pages/Admin/Certificates';
import Notifications from '../pages/Notifications';
import Teacher from '../pages/Teacher';
import TeacherCohorts from '../pages/Teacher/Cohorts';
import TeacherAssignments from '../pages/Teacher/Assignments';
import TeacherGradingWorkspace from '../pages/Teacher/GradingWorkspace';
import TeacherAttendanceRoster from '../pages/Teacher/AttendanceRoster';
import TeacherGradebook from '../pages/Teacher/Gradebook';
import TeacherStudentProgress from '../pages/Teacher/StudentProgress';
import Parent from '../pages/Parent';
import ParentChildGrades from '../pages/Parent/ChildGrades';
import ParentAttendanceDetail from '../pages/Parent/AttendanceDetail';
import Staff from '../pages/Staff';
import StaffWorkflows from '../pages/Staff/Workflows';
import Admin from '../pages/Admin';
import AdminAuditLog from '../pages/Admin/AuditLog';
import AdminReports from '../pages/Admin/Reports';
import AdminCourseOversight from '../pages/Admin/CourseOversight';
import AdminSystemHealth from '../pages/Admin/SystemHealth';
import AdminBilling from '../pages/Admin/Billing';
import Organizations from '../pages/Admin/Organizations';
import Principal from '../pages/Principal';
import CourseCatalog from '../pages/Courses/CourseCatalog';
import CourseDetail from '../pages/Courses/CourseDetail';
import TeacherCourses from '../pages/Courses/TeacherCourses';
import CourseBuilder from '../pages/Courses/CourseBuilder';
import AcademicStructure from '../pages/Admin/AcademicStructure';
import UserManagement from '../pages/Admin/UserManagement';
import StudentAccessRequests from '../pages/Admin/StudentAccessRequests';
import Guardians from '../pages/Guardians';
import ConsentForms from '../pages/ConsentForms';
import Profile from '../pages/Profile';
import StudentQuizzes from '../pages/Quiz/StudentQuizzes';
import ExamRunner from '../pages/Quiz/ExamRunner';
import TeacherQuizzes from '../pages/Quiz/TeacherQuizzes';
import QuizResult from '../pages/Quiz/QuizResult';
import QuizEditor from '../pages/Quiz/QuizEditor';
import QuizAnalytics from '../pages/Quiz/QuizAnalytics';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Forbidden from '../pages/Forbidden';
import NotFound from '../pages/NotFound';
import GoogleOAuthCallback from '../pages/Auth/GoogleOAuthCallback';
import GoogleOAuthRelay from '../pages/Auth/GoogleOAuthRelay';
import OnboardOrganization from '../pages/Auth/OnboardOrganization';
import ResetPassword from '../pages/Auth/ResetPassword';
import VerifyEmail from '../pages/Auth/VerifyEmail';
import VerifyPhone from '../pages/Auth/VerifyPhone';
import PrivacyPolicy from '../pages/Legal/PrivacyPolicy';
import Terms from '../pages/Legal/Terms';
import MinorPrivacy from '../pages/Legal/MinorPrivacy';
import SecuritySettings from '../pages/Settings/SecuritySettings';
import OrganizationSettings from '../pages/Settings/OrganizationSettings';
import ScheduleOverview from '../pages/Schedules/ScheduleOverview';
import ScheduleForm from '../pages/Schedules/ScheduleForm';
import RouteError from '../pages/RouteError';
import HelpCenter from '../pages/HelpCenter';
import DocumentRequests from '../pages/DocumentRequests';
import Scholarships from '../pages/Scholarships';
import PendingAccess from '../pages/User/PendingAccess';

const router = createBrowserRouter([
  { path: '/verify/certificate', element: <CertificateVerify /> },
  { path: '/verify/certificate/:code', element: <CertificateVerify /> },
  {
    path: '/',
    element: <LandingLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Landing />,
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'register',
        element: <Register />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPassword />,
      },
      {
        path: 'reset-password',
        element: <ResetPassword />,
      },
      {
        path: 'google/callback',
        element: <GoogleOAuthCallback />,
      },
      {
        path: 'callback',
        element: <GoogleOAuthRelay />,
      },
    ],
  },
  {
    path: '/login',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Login />,
      },
    ],
  },
  {
    path: '/forgot-password',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <ForgotPassword />,
      },
    ],
  },
  {
    path: '/reset-password',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <ResetPassword />,
      },
    ],
  },
  {
    path: '/verify-email',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <VerifyEmail />,
      },
    ],
  },
  {
    path: '/verify-phone',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <VerifyPhone />,
      },
    ],
  },
  {
    path: '/register',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Register />,
      },
    ],
  },
  {
    path: '/onboard',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <OnboardOrganization />,
      },
    ],
  },
  {
    path: '/user',
    element: <ProtectedRoute roles={['USER']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <PendingAccess /> },
    ],
  },
  {
    path: '/student',
    element: <ProtectedRoute roles={['STUDENT']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Student />,
      },
      { path: 'courses', element: <CourseCatalog /> },
      { path: 'courses/:id', element: <CourseDetail /> },
      { path: 'quizzes', element: <StudentQuizzes /> },
      { path: 'exams/:attemptId', element: <ExamRunner /> },
      { path: 'exams/:attemptId/result', element: <QuizResult /> },
      { path: 'schedules', element: <ScheduleOverview audience="student" /> },
      { path: 'assignments', element: <StudentAssignments /> },
      { path: 'grades', element: <StudentGradebook /> },
      { path: 'attendance', element: <StudentAttendance /> },
      { path: 'certificates', element: <StudentCertificates /> },
      { path: 'payments', element: <StudentPayments /> },
      { path: 'document-requests', element: <DocumentRequests /> },
      { path: 'scholarships', element: <Scholarships /> },
    ],
  },
  {
    path: '/teacher',
    element: <ProtectedRoute roles={['INSTRUCTOR']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Teacher />,
      },
      { path: 'courses', element: <TeacherCourses /> },
      { path: 'courses/:id/builder', element: <CourseBuilder /> },
      { path: 'quizzes', element: <TeacherQuizzes /> },
      { path: 'quizzes/:id', element: <QuizEditor /> },
      { path: 'quizzes/:id/analytics', element: <QuizAnalytics /> },
      { path: 'schedules', element: <ScheduleOverview audience="teacher" /> },
      { path: 'schedules/new', element: <ScheduleForm /> },
      { path: 'schedules/:id/edit', element: <ScheduleForm /> },
      { path: 'cohorts', element: <TeacherCohorts /> },
      { path: 'assignments', element: <TeacherAssignments /> },
      { path: 'grading', element: <TeacherGradingWorkspace /> },
      { path: 'attendance', element: <TeacherAttendanceRoster /> },
      { path: 'gradebook', element: <TeacherGradebook /> },
      { path: 'students', element: <TeacherStudentProgress /> },
      { path: 'document-requests', element: <DocumentRequests /> },
      { path: 'scholarships', element: <Scholarships /> },
    ],
  },
  {
    path: '/parent',
    element: <ProtectedRoute roles={['PARENT']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Parent />,
      },
      { path: 'schedules', element: <ScheduleOverview audience="parent" /> },
      { path: 'grades', element: <ParentChildGrades /> },
      { path: 'attendance', element: <ParentAttendanceDetail /> },
      { path: 'document-requests', element: <DocumentRequests /> },
      { path: 'scholarships', element: <Scholarships /> },
    ],
  },
  {
    path: '/staff',
    element: <ProtectedRoute roles={['STAFF']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Staff />,
      },
      { path: 'workflows', element: <StaffWorkflows /> },
      { path: 'document-requests', element: <DocumentRequests /> },
      { path: 'scholarships', element: <Scholarships /> },
    ],
  },
  {
    path: '/platform',
    element: <ProtectedRoute roles={['SUPER_ADMIN']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children:[{index:true,element:<Organizations/>}],
  },
  {
    path: '/admin',
    element: <ProtectedRoute roles={['ORG_ADMIN','SUPER_ADMIN']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Admin />,
      },
      { path: 'academic-structure', element: <AcademicStructure /> },
      { path: 'certificates', element: <AdminCertificates /> },
      { path: 'users', element: <UserManagement /> },
      { path: 'student-access-requests', element: <StudentAccessRequests /> },
      { path: 'course-oversight', element: <AdminCourseOversight /> },
      { path: 'audit-log', element: <AdminAuditLog /> },
      { path: 'reports', element: <AdminReports /> },
      { path: 'billing', element: <AdminBilling /> },
      { path: 'system-health', element: <AdminSystemHealth /> },
      { path: 'settings', element: <OrganizationSettings /> },
      { path: 'document-requests', element: <DocumentRequests /> },
      { path: 'scholarships', element: <Scholarships /> },
    ],
  },
  {
    path: '/guardians',
    element: <ProtectedRoute roles={['PARENT', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Guardians /> },
    ],
  },
  {
    path: '/consent-forms',
    element: <ProtectedRoute roles={['PARENT', 'INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <ConsentForms /> },
    ],
  },
  {
    path: '/reports',
    element: <ProtectedRoute roles={['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'FINANCE']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <AdminReports /> },
    ],
  },
  {
    path: '/principal',
    element: <ProtectedRoute roles={['PRINCIPAL']}><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Principal />,
      },
      { path: 'schedules', element: <ScheduleOverview audience="organization" /> },
      { path: 'course-oversight', element: <AdminCourseOversight /> },
      { path: 'audit-log', element: <AdminAuditLog /> },
      { path: 'document-requests', element: <DocumentRequests /> },
      { path: 'scholarships', element: <Scholarships /> },
    ],
  },
  { path: '/privacy', element: <PrivacyPolicy /> },
  { path: '/terms', element: <Terms /> },
  { path: '/minor-privacy', element: <MinorPrivacy /> },
  {
    path: '/settings',
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { path: 'security', element: <SecuritySettings /> },
    ],
  },
  {
    path: '/profile',
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Profile /> },
    ],
  },
  {
    path: '/notifications',
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Notifications /> },
    ],
  },
  {
    path: '/help',
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HelpCenter /> },
    ],
  },
  { path: '/403', element: <Forbidden /> },
  { path: '*', element: <NotFound /> },
]);

export default function Routes() {
  return <RouterProvider router={router} />;
}
