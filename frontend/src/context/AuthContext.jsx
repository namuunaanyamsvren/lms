import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  apiClient,
  authRequest,
  resetAuthFailureState,
  requestAccessTokenRefresh,
  setAuthFailureHandler,
} from '../services/apiClient';
import {
  authenticateWithCredentials,
  authenticateWithGoogleCode,
  clearBrowserSessionFlag,
  fetchCurrentUser,
  restoreSessionOnce,
} from '../services/authSession';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  subscribeAccessToken,
} from '../services/tokenStore';
import {
  clearSilentRefreshTimer,
  startSilentRefreshScheduler,
  stopSilentRefreshScheduler,
} from '../services/silentRefreshScheduler';

const AuthContext = createContext(null);
const getRequestErrorMessage = error =>
  error.response?.data?.message || error.message || 'Authentication failed';

export const getRoleRedirectPath = (roleStr) => {
  if (!roleStr) return '/user';
  const role = roleStr.toLowerCase();
  if (role === 'user') return '/user';
  if (role === 'student') return '/student';
  if (role === 'teacher' || role === 'instructor') return '/teacher';
  if (role === 'admin' || role === 'org_admin' || role === 'super_admin') return '/admin';
  if (role === 'parent') return '/parent';
  if (role === 'staff') return '/staff';
  if (role === 'principal') return '/principal';
  // Finance/billing is outside the MVP; keep the role compatible but expose no placeholder UI.
  if (role === 'finance') return '/profile';
  return '/user';
};
const getAuthenticatedRedirectPath = user =>
  user?.emailVerificationRequired
    ? '/verify-email'
    : user?.phoneVerificationRequired
      ? '/verify-phone'
      : user?.verificationRequired
        ? '/verify-email'
        : getRoleRedirectPath(user?.role);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getAccessToken());
  const [authStatus, setAuthStatus] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname === '/auth/google/callback'
      ? 'unauthenticated'
      : 'loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    return subscribeAccessToken(nextToken => {
      setTokenState(nextToken);
      if (!nextToken) {
        setUser(null);
        setAuthStatus(current =>
          current === 'loading' ? current : 'unauthenticated');
      }
    });
  }, []);

  useEffect(() => {
    startSilentRefreshScheduler();
    return stopSilentRefreshScheduler;
  }, []);

  useEffect(() => {
    let active = true;
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/google/callback') {
      return () => {
        active = false;
      };
    }
    restoreSessionOnce()
      .then(session => {
        if (!active) return;
        setUser(session.user);
        setAuthStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        clearAccessToken();
        setUser(null);
        setAuthStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async ({ identifier, email, password, organizationId }) => {
    setLoading(true);
    setError(null);
    const loginIdentifier = identifier || email;
    try {
      const session = await authenticateWithCredentials('/auth/login', {
        identifier: loginIdentifier,
        email: loginIdentifier,
        password,
        organizationId,
      });

      resetAuthFailureState();
      setUser(session.user);
      setAuthStatus('authenticated');
      return {
        success: true,
        user: session.user,
        redirectPath: getAuthenticatedRedirectPath(session.user),
      };
    } catch (err) {
      clearAccessToken();
      setUser(null);
      setAuthStatus('unauthenticated');
      const message = getRequestErrorMessage(err);
      setError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async ({ email, username, phone, password, firstName, lastName, role = 'user', organizationId }) => {
    setLoading(true);
    setError(null);
    try {
      const session = await authenticateWithCredentials('/auth/register', {
        email,
        username,
        phone,
        password,
        firstName,
        lastName,
        role,
        organizationId,
      });

      resetAuthFailureState();
      setUser(session.user);
      setAuthStatus('authenticated');
      return {
        success: true,
        user: session.user,
        redirectPath: getAuthenticatedRedirectPath(session.user),
      };
    } catch (err) {
      clearAccessToken();
      setUser(null);
      setAuthStatus('unauthenticated');
      const message = getRequestErrorMessage(err);
      setError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleLogin = useCallback(async code => {
    setLoading(true);
    setError(null);
    try {
      const session = await authenticateWithGoogleCode(code);
      resetAuthFailureState();
      setUser(session.user);
      setAuthStatus('authenticated');
      return {
        success: true,
        user: session.user,
        redirectPath: getAuthenticatedRedirectPath(session.user),
      };
    } catch (err) {
      clearAccessToken();
      setUser(null);
      setAuthStatus('unauthenticated');
      const message = getRequestErrorMessage(err);
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLocalSession = useCallback(() => {
    clearSilentRefreshTimer();
    clearAccessToken();
    clearBrowserSessionFlag();
    setUser(null);
    setAuthStatus('unauthenticated');
    localStorage.removeItem('lms_user');
  }, []);

  const logout = useCallback(() => {
    const revokeRequest = authRequest({
      url: '/auth/logout',
      method: 'POST',
    }).catch(() => undefined);
    clearLocalSession();
    return revokeRequest;
  }, [clearLocalSession]);

  const completeEmailVerification = useCallback(async () => {
    const refreshedToken = await requestAccessTokenRefresh();
    const authoritativeUser = await fetchCurrentUser(refreshedToken);
    setUser(authoritativeUser);
    setAuthStatus('authenticated');
    return {
      user: authoritativeUser,
      redirectPath: getAuthenticatedRedirectPath(authoritativeUser),
    };
  }, []);
  const completePhoneVerification = completeEmailVerification;

  const refreshUser = useCallback(async () => {
    const authoritativeUser = await fetchCurrentUser(token);
    setUser(authoritativeUser);
    return authoritativeUser;
  }, [token]);

  const switchOrganization = useCallback(async (organizationId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.request({
        url: '/auth/switch-organization',
        method: 'POST',
        data: { organizationId },
      });
      const nextToken = response?.data?.token;
      if (!nextToken) throw new Error('Organization switch response did not include an access token');
      setAccessToken(nextToken);
      const nextUser = response.data.user || await fetchCurrentUser(nextToken);
      setUser(nextUser);
      setAuthStatus('authenticated');
      return {
        success: true,
        user: nextUser,
        redirectPath: getAuthenticatedRedirectPath(nextUser),
      };
    } catch (err) {
      const message = getRequestErrorMessage(err);
      setError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearLocalSession();
      if (window.location.pathname !== '/login') window.location.assign('/login?reason=session-expired');
    };
    setAuthFailureHandler(handleUnauthorized);
    return () => {
      setAuthFailureHandler(null);
    };
  }, [clearLocalSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        authStatus,
        isBootstrapping: authStatus === 'loading',
        isAuthenticated: authStatus === 'authenticated' && Boolean(token && user),
        loading,
        error,
        login,
        register,
        completeGoogleLogin,
        logout,
        completeEmailVerification,
        completePhoneVerification,
        getRoleRedirectPath,
        refreshUser,
        switchOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
