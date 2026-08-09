import axios from 'axios';
import { ensureCsrfToken, getCsrfHeaderName } from './csrf';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './tokenStore';
import { t, translateErrorCode } from '../i18n';

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/csrf-token',
  '/auth/google/exchange',
];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
const RETRY_DELAY_MS = 400;

export class ApiError extends Error {
  constructor({ status, code, message, details, isNetworkError = false, cause }) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.details = details ?? null;
    this.isNetworkError = isNetworkError;
    this.cause = cause;
    // Preserved for existing call sites that read `err.response?.data?.message` (axios shape).
    this.response = cause?.response ?? null;
    this.config = cause?.config ?? null;
  }
}

const toApiError = error => {
  if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') {
    return new ApiError({ code: 'CANCELED', message: t('errors.canceled'), isNetworkError: false, cause: error });
  }
  if (!error.response) {
    return new ApiError({
      code: error.code || 'NETWORK_ERROR',
      message: t('errors.network'),
      isNetworkError: true,
      cause: error,
    });
  }
  const { status, data } = error.response;
  return new ApiError({
    status,
    code: data?.code || null,
    message: translateErrorCode(data?.code, data?.message || error.message),
    details: data?.errors || data?.details || null,
    cause: error,
  });
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const apiClient = axios.create({
  baseURL: BASE_API_URL,
  withCredentials: true,
  timeout: 10_000,
});

export const authClient = axios.create({
  baseURL: BASE_API_URL,
  withCredentials: true,
  timeout: 10_000,
});

let refreshPromise = null;
let authFailureHandled = false;
let authFailureHandler = null;

const isExcludedAuthEndpoint = url =>
  AUTH_ENDPOINTS_WITHOUT_REFRESH.some(endpoint => url?.endsWith(endpoint));

const isInvalidCsrfError = error =>
  error.response?.status === 403 &&
  error.response?.data?.message === 'Invalid CSRF token';

const csrfHeaders = async method => {
  if (SAFE_METHODS.has((method || 'GET').toUpperCase())) return {};
  const token = await ensureCsrfToken();
  return { [getCsrfHeaderName()]: token };
};

const defaultAuthFailureHandler = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('lms:unauthorized'));
  if (window.location.pathname !== '/login') window.location.assign('/login?reason=session-expired');
};

export const handleAuthFailure = error => {
  clearAccessToken();
  if (!authFailureHandled) {
    authFailureHandled = true;
    (authFailureHandler || defaultAuthFailureHandler)(error);
  }
};

export const resetAuthFailureState = () => {
  authFailureHandled = false;
};

export const setAuthFailureHandler = handler => {
  authFailureHandler = handler;
};

authClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (!isInvalidCsrfError(error) || !originalRequest || originalRequest._csrfRetry) {
      return Promise.reject(error);
    }

    originalRequest._csrfRetry = true;
    const token = await ensureCsrfToken(true);
    originalRequest.headers.set(getCsrfHeaderName(), token);
    return authClient(originalRequest);
  },
);

export const refreshAccessToken = async () => {
  const response = await authClient.post('/auth/refresh', null, {
    headers: await csrfHeaders('POST'),
  });
  const token = response.data?.data?.token;
  if (!token) throw new Error('Refresh response did not include an access token');
  setAccessToken(token);
  resetAuthFailureState();
  return token;
};

export const requestAccessTokenRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch(error => {
        handleAuthFailure(error);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

apiClient.interceptors.request.use(async config => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  const headers = await csrfHeaders(config.method);
  Object.entries(headers).forEach(([name, value]) => config.headers.set(name, value));
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const status = error.response?.status;
    const originalRequest = error.config;
    if (isInvalidCsrfError(error) && originalRequest && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      const token = await ensureCsrfToken(true);
      originalRequest.headers.set(getCsrfHeaderName(), token);
      return apiClient(originalRequest);
    }
    if (status === 403 && !isInvalidCsrfError(error) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lms:forbidden', { detail: error.response?.data }));
      if (window.location.pathname !== '/403') window.location.assign('/403');
      return Promise.reject(error);
    }
    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isExcludedAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const token = await requestAccessTokenRefresh();
      originalRequest.headers.set('Authorization', `Bearer ${token}`);
      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

// Final interceptor: retry idempotent GET/HEAD requests once on network error or 5xx,
// then normalize whatever remains into an ApiError so callers get a consistent shape.
const attachRetryAndErrorNormalization = client =>
  client.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;
      const method = (originalRequest?.method || 'GET').toUpperCase();
      const status = error.response?.status;
      const canRetry =
        originalRequest &&
        !originalRequest._retriedOnce &&
        RETRYABLE_METHODS.has(method) &&
        (!error.response || status >= 500) &&
        !(axios.isCancel?.(error) || error.code === 'ERR_CANCELED');
      if (canRetry) {
        originalRequest._retriedOnce = true;
        await delay(RETRY_DELAY_MS);
        return client(originalRequest);
      }
      return Promise.reject(toApiError(error));
    },
  );

attachRetryAndErrorNormalization(apiClient);
attachRetryAndErrorNormalization(authClient);

export const authRequest = async ({ url, method = 'GET', data, headers, ...config }) => {
  const response = await authClient.request({
    ...config,
    url,
    method,
    data,
    headers: {
      ...headers,
      ...await csrfHeaders(method),
    },
  });
  return response.data;
};

export const resetApiClientForTests = () => {
  refreshPromise = null;
  authFailureHandled = false;
  authFailureHandler = null;
  clearAccessToken();
};
