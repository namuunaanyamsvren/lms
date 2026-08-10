// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { authClient, resetApiClientForTests } from '../services/apiClient';
import {
  markBrowserSessionPresent,
  resetAuthSessionForTests,
} from '../services/authSession';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '../services/tokenStore';
import {
  AuthProvider,
  getRoleRedirectPath,
  useAuth,
} from './AuthContext';

const axiosResponse = (config, data, status = 200) => ({
  config,
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
});

const accessToken = (expiresInSeconds = 900) => {
  const encode = value => btoa(JSON.stringify(value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  })}.signature`;
};

let auth;

function AuthProbe() {
  const value = useAuth();
  useEffect(() => {
    auth = value;
  }, [value]);
  return (
    <div>
      <span data-testid="status">{value.authStatus}</span>
      <span data-testid="user">{value.user?.email || 'none'}</span>
    </div>
  );
}

const renderProvider = children => render(
  <AuthProvider>{children || <AuthProbe />}</AuthProvider>,
);

describe('authoritative authentication state', () => {
  beforeEach(() => {
    resetApiClientForTests();
    resetAuthSessionForTests();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    document.cookie = 'lms_csrf=test-csrf-token; path=/';
    auth = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('uses /me as authority after login and returns the role route', async () => {
    const calls = [];
    authClient.defaults.adapter = async config => {
      calls.push(config.url);
      if (config.url === '/auth/refresh') throw new Error('No reload session');
      if (config.url === '/auth/login') {
        return axiosResponse(config, {
          data: { token: accessToken(), user: { role: 'STUDENT', email: 'stale@example.com' } },
        });
      }
      return axiosResponse(config, {
        data: { id: 'user-1', role: 'INSTRUCTOR', email: 'teacher@example.com' },
      });
    };
    renderProvider();
    await waitFor(() => expect(auth.authStatus).toBe('unauthenticated'));

    let result;
    await act(async () => {
      result = await auth.login({
        identifier: 'teacher@example.com',
        password: 'password',
        organizationId: 'org_main',
      });
    });

    expect(calls.slice(-2)).toEqual(['/auth/login', '/auth/me']);
    expect(auth.user.email).toBe('teacher@example.com');
    expect(result.redirectPath).toBe('/teacher');
  });

  it('uses /me as authority after registration', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') throw new Error('No reload session');
      if (config.url === '/auth/register') {
        return axiosResponse(config, {
          data: { token: accessToken(), user: { role: 'PARENT', email: 'stale@example.com' } },
        }, 201);
      }
      return axiosResponse(config, {
        data: { id: 'user-2', role: 'USER', email: 'registered@example.com' },
      });
    };
    renderProvider();
    await waitFor(() => expect(auth.authStatus).toBe('unauthenticated'));

    let result;
    await act(async () => {
      result = await auth.register({
        email: 'registered@example.com',
        password: 'password',
        organizationId: 'org_main',
      });
    });

    expect(auth.user.email).toBe('registered@example.com');
    expect(result.redirectPath).toBe('/user');
  });

  it('routes a policy-required unverified login to email verification', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') throw new Error('No reload session');
      if (config.url === '/auth/login') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      return axiosResponse(config, {
        data: {
          id: 'user-required',
          role: 'STUDENT',
          email: 'verify@example.com',
          verificationRequired: true,
        },
      });
    };
    renderProvider();
    await waitFor(() => expect(auth.authStatus).toBe('unauthenticated'));

    let result;
    await act(async () => {
      result = await auth.login({
        identifier: 'verify@example.com',
        password: 'password',
        organizationId: 'org-required',
      });
    });

    expect(result.redirectPath).toBe('/verify-email');
    expect(auth.user.verificationRequired).toBe(true);
  });

  it('routes a policy-required unverified phone to phone verification', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') throw new Error('No reload session');
      if (config.url === '/auth/login') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      return axiosResponse(config, {
        data: {
          id: 'user-phone-required',
          role: 'STUDENT',
          phone: '+97699112233',
          phoneVerificationRequired: true,
          emailVerificationRequired: false,
        },
      });
    };
    renderProvider();
    await waitFor(() => expect(auth.authStatus).toBe('unauthenticated'));

    let result;
    await act(async () => {
      result = await auth.login({
        identifier: '+97699112233',
        password: 'password',
        organizationId: 'org-phone-required',
      });
    });

    expect(result.redirectPath).toBe('/verify-phone');
  });

  it('restores a reload session through refresh and /me', async () => {
    const calls = [];
    authClient.defaults.adapter = async config => {
      calls.push(config.url);
      if (config.url === '/auth/refresh') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      return axiosResponse(config, {
        data: { id: 'user-3', role: 'ORG_ADMIN', email: 'admin@example.com' },
      });
    };
    markBrowserSessionPresent();

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(calls).toEqual(['/auth/refresh', '/auth/me']);
    expect(getAccessToken()).toEqual(expect.any(String));
    expect(screen.getByTestId('user').textContent).toBe('admin@example.com');
  });

  it('does not call refresh when the browser has no known session', async () => {
    const calls = [];
    authClient.defaults.adapter = async config => {
      calls.push(config.url);
      return axiosResponse(config, { data: { token: accessToken() } });
    };

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(calls).toEqual([]);
    expect(getAccessToken()).toBeNull();
  });

  it('does not restore a previous session during the Google OAuth callback', async () => {
    const calls = [];
    authClient.defaults.adapter = async config => {
      calls.push(config.url);
      return axiosResponse(config, { data: { token: accessToken() } });
    };
    markBrowserSessionPresent();
    window.history.replaceState({}, '', '/auth/google/callback?code=exchange-code');

    renderProvider();

    await waitFor(() => expect(auth.authStatus).toBe('unauthenticated'));
    expect(calls).toEqual([]);
  });

  it('finishes bootstrap logged out when refresh fails', async () => {
    setAccessToken(accessToken());
    authClient.defaults.adapter = async () => {
      throw new Error('Refresh failed');
    };

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(getAccessToken()).toBeNull();
    expect(auth.user).toBeNull();
  });

  it('clears a refreshed token when /me fails', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      throw new Error('Current user failed');
    };
    markBrowserSessionPresent();

    renderProvider();

    await waitFor(() => expect(auth.authStatus).toBe('unauthenticated'));
    expect(getAccessToken()).toBeNull();
    expect(auth.user).toBeNull();
  });

  it('clears user state whenever the memory token is removed', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      return axiosResponse(config, {
        data: { id: 'user-4', role: 'STUDENT', email: 'student@example.com' },
      });
    };
    markBrowserSessionPresent();
    renderProvider();
    await waitFor(() => expect(auth.authStatus).toBe('authenticated'));

    act(() => clearAccessToken());

    expect(auth.authStatus).toBe('unauthenticated');
    expect(auth.user).toBeNull();
  });

  it('revokes the server session before completing a user logout', async () => {
    const calls = [];
    authClient.defaults.adapter = async config => {
      calls.push(config.url);
      if (config.url === '/auth/refresh') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      if (config.url === '/auth/logout') {
        return axiosResponse(config, { success: true });
      }
      return axiosResponse(config, {
        data: { id: 'user-logout', role: 'STUDENT', email: 'logout@example.com' },
      });
    };
    markBrowserSessionPresent();
    renderProvider();
    await waitFor(() => expect(auth.authStatus).toBe('authenticated'));

    await act(async () => {
      await auth.logout();
    });

    expect(calls).toContain('/auth/logout');
    expect(getAccessToken()).toBeNull();
    expect(auth.authStatus).toBe('unauthenticated');
    expect(auth.user).toBeNull();
  });
});

describe('protected routing states', () => {
  beforeEach(() => {
    resetApiClientForTests();
    resetAuthSessionForTests();
    localStorage.clear();
    document.cookie = 'lms_csrf=test-csrf-token; path=/';
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading state before bootstrap resolves', () => {
    authClient.defaults.adapter = () => new Promise(() => {});

    renderProvider(
      <MemoryRouter>
        <ProtectedRoute><div>Protected content</div></ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('redirects an unauthenticated user to login', async () => {
    authClient.defaults.adapter = async () => {
      throw new Error('No session');
    };

    renderProvider(
      <MemoryRouter initialEntries={['/student']}>
        <Routes>
          <Route
            path="/student"
            element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>}
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Login page')).toBeTruthy());
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('redirects an authenticated unverified user away from organization pages', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      return axiosResponse(config, {
        data: {
          id: 'user-required',
          role: 'STUDENT',
          email: 'verify@example.com',
          verificationRequired: true,
        },
      });
    };
    markBrowserSessionPresent();

    renderProvider(
      <MemoryRouter initialEntries={['/student']}>
        <Routes>
          <Route
            path="/student"
            element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>}
          />
          <Route path="/verify-email" element={<div>Verification required</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Verification required')).toBeTruthy());
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('redirects an authenticated user away from routes for another role', async () => {
    authClient.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') {
        return axiosResponse(config, { data: { token: accessToken() } });
      }
      return axiosResponse(config, {
        data: { id: 'student-1', role: 'STUDENT', email: 'student@example.com' },
      });
    };
    markBrowserSessionPresent();

    renderProvider(
      <MemoryRouter initialEntries={['/teacher']}>
        <Routes>
          <Route
            path="/teacher"
            element={<ProtectedRoute roles={['INSTRUCTOR']}><div>Teacher content</div></ProtectedRoute>}
          />
          <Route path="/403" element={<div>Forbidden page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Forbidden page')).toBeTruthy());
    expect(screen.queryByText('Teacher content')).toBeNull();
  });

  it('preserves the existing route convention for every supported role', () => {
    expect(getRoleRedirectPath('USER')).toBe('/user');
    expect(getRoleRedirectPath('STUDENT')).toBe('/student');
    expect(getRoleRedirectPath('INSTRUCTOR')).toBe('/teacher');
    expect(getRoleRedirectPath('PARENT')).toBe('/parent');
    expect(getRoleRedirectPath('STAFF')).toBe('/staff');
    expect(getRoleRedirectPath('PRINCIPAL')).toBe('/principal');
    expect(getRoleRedirectPath('FINANCE')).toBe('/profile');
    expect(getRoleRedirectPath('ORG_ADMIN')).toBe('/admin');
    expect(getRoleRedirectPath('SUPER_ADMIN')).toBe('/admin');
  });
});
