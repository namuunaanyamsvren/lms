import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

// Maps roles to their default dashboard path
const dashboardPaths = {
  USER: '/user',
  STUDENT: '/student',
  INSTRUCTOR: '/teacher',
  PARENT: '/parent',
  STAFF: '/staff',
  ORG_ADMIN: '/admin',
  PRINCIPAL: '/principal',
  SUPER_ADMIN: '/admin',
  FINANCE: '/profile',
};

const getDefaultPath = role => dashboardPaths[role] || '/';

export default function ProtectedRoute({ children, roles }) {
  const {
    authStatus,
    isAuthenticated,
    user,
  } = useAuth();

  const userHasRequiredRole = useMemo(() => {
    if (!roles || roles.length === 0) return true; // No roles required
    if (!user || !user.role) return false; // User has no role
    return roles.includes(user.role);
  }, [user, roles]);

  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <LoadingSpinner />
        <span className="sr-only">Session сэргээж байна...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user.emailVerificationRequired) {
    return <Navigate to="/verify-email" replace />;
  }
  if (user.phoneVerificationRequired) {
    return <Navigate to="/verify-phone" replace />;
  }
  if (user.verificationRequired) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!userHasRequiredRole) {
    return <Navigate to="/403" replace state={{ returnTo: getDefaultPath(user.role) }} />;
  }

  return children;
}
