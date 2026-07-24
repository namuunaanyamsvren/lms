import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';

// Maps roles to their default dashboard path
const dashboardPaths = {
  STUDENT: '/student',
  INSTRUCTOR: '/teacher',
  PARENT: '/parent',
  STAFF: '/staff',
  ORG_ADMIN: '/admin',
  PRINCIPAL: '/principal',
  SUPER_ADMIN: '/admin',
};

const getDefaultPath = role => dashboardPaths[role] || '/';

export default function ProtectedRoute({ children, roles }) {
  const { user, token } = useAuth();

  const userHasRequiredRole = useMemo(() => {
    if (!roles || roles.length === 0) return true; // No roles required
    if (!user || !user.role) return false; // User has no role
    return roles.includes(user.role);
  }, [user, roles]);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!userHasRequiredRole) {
    const defaultPath = getDefaultPath(user.role);
    return <Navigate to={defaultPath} replace />;
  }

  return children;
}
