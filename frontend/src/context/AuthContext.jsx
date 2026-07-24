import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const API_URL = 'http://localhost:8001/api/auth';

export const getRoleRedirectPath = (roleStr) => {
  if (!roleStr) return '/student';
  const role = roleStr.toLowerCase();
  if (role === 'teacher' || role === 'instructor') return '/teacher';
  if (role === 'admin' || role === 'org_admin' || role === 'super_admin') return '/admin';
  if (role === 'parent') return '/parent';
  if (role === 'staff') return '/staff';
  if (role === 'principal') return '/principal';
  return '/student';
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lms_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('lms_token') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('lms_token', token);
    } else {
      localStorage.removeItem('lms_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('lms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lms_user');
    }
  }, [user]);

  const safeFetchJsonWithTimeout = async (url, options, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.slice(0, 100)}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data?.message || `Серверийн алдаа (${response.status})`);
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Backend сервертэй холбогдоход хугацаа хэтэрлээ');
      }
      throw err;
    }
  };

  const login = async ({ identifier, email, password, organizationId }) => {
    setLoading(true);
    setError(null);
    const loginIdentifier = identifier || email;
    try {
      const data = await safeFetchJsonWithTimeout(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier,
          email: loginIdentifier,
          password,
          organizationId,
        }),
      });

      setToken(data.data.token);
      setUser(data.data.user);
      setLoading(false);
      return {
        success: true,
        user: data.data.user,
        redirectPath: getRoleRedirectPath(data.data.user.role),
      };
    } catch (err) {
      setLoading(false);
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    }
  };

  const register = async ({ email, username, phone, password, firstName, lastName, role = 'student', organizationId }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetchJsonWithTimeout(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, phone, password, firstName, lastName, role, organizationId }),
      });

      setToken(data.data.token);
      setUser(data.data.user);
      setLoading(false);
      return { success: true, user: data.data.user, redirectPath: getRoleRedirectPath(data.data.user.role) };
    } catch (err) {
      setLoading(false);
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        loading,
        error,
        login,
        register,
        logout,
        getRoleRedirectPath,
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
