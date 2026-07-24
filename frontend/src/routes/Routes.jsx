import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LandingLayout from '../layouts/LandingLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import RoleSectionPage from '../components/dashboard/RoleSectionPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Landing from '../pages/Landing';
import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import Student from '../pages/Student';
import Teacher from '../pages/Teacher';
import Parent from '../pages/Parent';
import Staff from '../pages/Staff';
import Admin from '../pages/Admin';
import Principal from '../pages/Principal';
import Profile from '../pages/Profile';
import {
  fetchCourses,
  fetchAssignments,
  fetchQuizzes,
  fetchAttendance,
  fetchGrades,
  fetchUsers,
} from '../services/api';

const resourcePages = [
  {
    path: 'courses',
    title: 'Courses',
    subtitle: 'Browse and manage all available courses.',
    fetcher: fetchCourses,
  },
  {
    path: 'assignments',
    title: 'Assignments',
    subtitle: 'View and grade all assignments.',
    fetcher: fetchAssignments,
  },
  {
    path: 'quizzes',
    title: 'Quizzes',
    subtitle: 'Review all quizzes and student attempts.',
    fetcher: fetchQuizzes,
  },
  {
    path: 'attendance',
    title: 'Attendance',
    subtitle: "Track student attendance records.",
    fetcher: fetchAttendance,
  },
  {
    path: 'grades',
    title: 'Grades',
    subtitle: 'Manage and view all student grades.',
    fetcher: fetchGrades,
  },
  {
    path: 'users',
    title: 'Users',
    subtitle: 'Manage all users in the organization.',
    fetcher: fetchUsers,
  },
];

const roleRoutes = [
  {
    path: '/student',
    element: <Student />,
    roles: ['STUDENT'],
  },
  {
    path: '/teacher',
    element: <Teacher />,
    roles: ['INSTRUCTOR'],
  },
  {
    path: '/parent',
    element: <Parent />,
    roles: ['PARENT'],
  },
  {
    path: '/staff',
    element: <Staff />,
    roles: ['STAFF'],
  },
  {
    path: '/admin',
    element: <Admin />,
    roles: ['ORG_ADMIN', 'SUPER_ADMIN'],
  },
  {
    path: '/principal',
    element: <Principal />,
    roles: ['PRINCIPAL'],
  },
];

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingLayout />,
    children: [{ index: true, element: <Landing /> }],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ],
  },
  { path: '/login', element: <AuthLayout />, children: [{ index: true, element: <Login /> }] },
  { path: '/register', element: <AuthLayout />, children: [{ index: true, element: <Register /> }] },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <Profile /> }],
  },
  ...roleRoutes.map(({ path, element, roles }) => ({
    path,
    element: (
      <ProtectedRoute roles={roles}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element },
      ...resourcePages.map(p => ({
        path: p.path,
        element: <RoleSectionPage title={p.title} subtitle={p.subtitle} fetcher={p.fetcher} />,
      })),
    ],
  })),
]);

export default function Routes() {
  return <RouterProvider router={router} />;
}
