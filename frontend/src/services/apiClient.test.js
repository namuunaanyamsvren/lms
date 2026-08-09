import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiClient,
  authClient,
  refreshAccessToken,
  resetApiClientForTests,
  setAuthFailureHandler,
} from './apiClient';
import { getAccessToken, setAccessToken } from './tokenStore';

const response = (config, data, status = 200) => ({
  config,
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
});

const unauthorized = config => new AxiosError(
  'Unauthorized',
  AxiosError.ERR_BAD_REQUEST,
  config,
  null,
  response(config, { success: false }, 401),
);

const invalidCsrf = config => new AxiosError(
  'Forbidden',
  AxiosError.ERR_BAD_REQUEST,
  config,
  null,
  response(config, { success: false, message: 'Invalid CSRF token' }, 403),
);

describe('Axios single-flight refresh queue', () => {
  beforeEach(() => {
    resetApiClientForTests();
    globalThis.document = { cookie: 'lms_csrf=test-csrf-token' };
  });

  it('refreshes and retries one 401 request once', async () => {
    let requestCount = 0;
    let refreshCount = 0;
    apiClient.defaults.adapter = async config => {
      requestCount += 1;
      if (!config._retry) throw unauthorized(config);
      return response(config, { authorization: config.headers.get('Authorization') });
    };
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      expect(config.withCredentials).toBe(true);
      expect(config.headers.get('x-csrf-token')).toBe('test-csrf-token');
      return response(config, { data: { token: 'new-access-token' } });
    };

    const result = await apiClient.get('/courses');
    expect(result.data.authorization).toBe('Bearer new-access-token');
    expect(requestCount).toBe(2);
    expect(refreshCount).toBe(1);
  });

  it('uses one refresh for simultaneous 401s and retries every queued request', async () => {
    let refreshCount = 0;
    const retriedUrls = [];
    apiClient.defaults.adapter = async config => {
      if (!config._retry) throw unauthorized(config);
      retriedUrls.push(config.url);
      return response(config, {
        authorization: config.headers.get('Authorization'),
        url: config.url,
      });
    };
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return response(config, { data: { token: 'shared-access-token' } });
    };

    const results = await Promise.all([
      apiClient.get('/courses'),
      apiClient.get('/users'),
      apiClient.get('/notifications'),
    ]);

    expect(refreshCount).toBe(1);
    expect(retriedUrls.sort()).toEqual(['/courses', '/notifications', '/users']);
    expect(results.every(result =>
      result.data.authorization === 'Bearer shared-access-token')).toBe(true);
  });

  it('rejects the queue, clears auth, and signals redirect once when refresh fails', async () => {
    const onFailure = vi.fn();
    setAuthFailureHandler(onFailure);
    setAccessToken('expired-access-token');
    apiClient.defaults.adapter = async config => {
      throw unauthorized(config);
    };
    authClient.defaults.adapter = async config => {
      throw unauthorized(config);
    };

    const results = await Promise.allSettled([
      apiClient.get('/courses'),
      apiClient.get('/users'),
      apiClient.get('/notifications'),
    ]);

    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('does not retry an original request more than once', async () => {
    let requestCount = 0;
    let refreshCount = 0;
    apiClient.defaults.adapter = async config => {
      requestCount += 1;
      throw unauthorized(config);
    };
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: 'new-token' } });
    };

    await expect(apiClient.get('/courses')).rejects.toBeInstanceOf(ApiError);
    expect(requestCount).toBe(2);
    expect(refreshCount).toBe(1);
  });

  it('does not recursively intercept a refresh endpoint failure', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      throw unauthorized(config);
    };

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(ApiError);
    expect(refreshCount).toBe(1);
  });

  it('refreshes a stale CSRF cookie and retries an auth request once', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      document.cookie = 'lms_csrf=fresh-csrf-token';
      return { ok: true };
    });
    let requestCount = 0;
    authClient.defaults.adapter = async config => {
      requestCount += 1;
      if (!config._csrfRetry) throw invalidCsrf(config);
      expect(config.headers.get('x-csrf-token')).toBe('fresh-csrf-token');
      return response(config, { success: true });
    };

    try {
      const result = await authClient.post('/auth/register', null, {
        headers: { 'x-csrf-token': 'stale-csrf-token' },
      });
      expect(result.data.success).toBe(true);
      expect(requestCount).toBe(2);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
