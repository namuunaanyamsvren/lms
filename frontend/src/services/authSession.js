import { authClient, authRequest, refreshAccessToken } from './apiClient';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './tokenStore';

let restorePromise = null;
const SESSION_FLAG_KEY = 'lms_has_refresh_session';

const hasBrowserSessionFlag = () =>
  typeof window !== 'undefined' && window.localStorage.getItem(SESSION_FLAG_KEY) === 'true';

export const markBrowserSessionPresent = () => {
  if (typeof window !== 'undefined') window.localStorage.setItem(SESSION_FLAG_KEY, 'true');
};

export const clearBrowserSessionFlag = () => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_FLAG_KEY);
};

const requireAccessToken = data => {
  const token = data?.data?.token;
  if (!token) throw new Error('Authentication response did not include an access token');
  return token;
};

export const fetchCurrentUser = async (token = getAccessToken()) => {
  if (!token) throw new Error('An access token is required to load the current user');

  const response = await authClient.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = response.data?.data;
  if (!user?.id || !user?.role) {
    throw new Error('Current-user response was invalid');
  }
  return user;
};

export const authenticateWithCredentials = async (endpoint, credentials) => {
  try {
    const data = await authRequest({
      url: endpoint,
      method: 'POST',
      data: credentials,
    });
    const token = requireAccessToken(data);
    setAccessToken(token);
    markBrowserSessionPresent();
    const user = await fetchCurrentUser(token);
    return { token, user };
  } catch (error) {
    clearAccessToken();
    throw error;
  }
};

export const authenticateWithGoogleCode = async code => {
  try {
    const data = await authRequest({
      url: '/auth/google/exchange',
      method: 'POST',
      data: { code },
    });
    const token = requireAccessToken(data);
    setAccessToken(token);
    markBrowserSessionPresent();
    const user = await fetchCurrentUser(token);
    return { token, user };
  } catch (error) {
    clearAccessToken();
    throw error;
  }
};

const restoreSession = async () => {
  if (!hasBrowserSessionFlag()) throw new Error('No browser session to restore');
  try {
    const token = await refreshAccessToken();
    markBrowserSessionPresent();
    const user = await fetchCurrentUser(token);
    return { token, user };
  } catch (error) {
    clearAccessToken();
    clearBrowserSessionFlag();
    throw error;
  }
};

export const restoreSessionOnce = () => {
  if (!restorePromise) {
    restorePromise = restoreSession().finally(() => {
      restorePromise = null;
    });
  }
  return restorePromise;
};

export const resetAuthSessionForTests = () => {
  restorePromise = null;
};
