// @vitest-environment jsdom

import { AxiosError } from 'axios';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  apiClient,
  authClient,
  resetApiClientForTests,
  setAuthFailureHandler,
} from './apiClient';
import {
  resetSilentRefreshSchedulerForTests,
  startSilentRefreshScheduler,
} from './silentRefreshScheduler';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './tokenStore';

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

const tokenExpiringIn = seconds => {
  const encode = value => btoa(JSON.stringify(value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    exp: Math.floor(Date.now() / 1000) + seconds,
  })}.signature`;
};

describe('silent refresh scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T00:00:00.000Z'));
    resetSilentRefreshSchedulerForTests();
    resetApiClientForTests();
    setAuthFailureHandler(vi.fn());
    document.cookie = 'lms_csrf=test-csrf-token; path=/';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    resetSilentRefreshSchedulerForTests();
    resetApiClientForTests();
    vi.useRealTimers();
  });

  it('refreshes 90 seconds before access-token expiry', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: tokenExpiringIn(900) } });
    };
    startSilentRefreshScheduler();
    setAccessToken(tokenExpiringIn(300));

    await vi.advanceTimersByTimeAsync(209_999);
    expect(refreshCount).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshCount).toBe(1);
  });

  it('resets the existing timer when login stores a new token', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: tokenExpiringIn(900) } });
    };
    startSilentRefreshScheduler();
    setAccessToken(tokenExpiringIn(300));
    await vi.advanceTimersByTimeAsync(100_000);

    setAccessToken(tokenExpiringIn(600));
    await vi.advanceTimersByTimeAsync(110_000);
    expect(refreshCount).toBe(0);
    await vi.advanceTimersByTimeAsync(400_000);
    expect(refreshCount).toBe(1);
  });

  it('clears the pending timer on logout', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: tokenExpiringIn(900) } });
    };
    startSilentRefreshScheduler();
    setAccessToken(tokenExpiringIn(300));

    clearAccessToken();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(refreshCount).toBe(0);
  });

  it('refreshes an already expired token immediately without looping', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: tokenExpiringIn(900) } });
    };
    startSilentRefreshScheduler();

    setAccessToken(tokenExpiringIn(-1));
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshCount).toBe(1);
    expect(getAccessToken()).not.toBeNull();
  });

  it('rechecks expiration when a hidden tab becomes visible', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: tokenExpiringIn(900) } });
    };
    startSilentRefreshScheduler();
    setAccessToken(tokenExpiringIn(300));

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    vi.setSystemTime(new Date('2026-07-28T00:04:00.000Z'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshCount).toBe(1);
  });

  it('rechecks expiration when the browser window regains focus', async () => {
    let refreshCount = 0;
    authClient.defaults.adapter = async config => {
      refreshCount += 1;
      return response(config, { data: { token: tokenExpiringIn(900) } });
    };
    startSilentRefreshScheduler();
    setAccessToken(tokenExpiringIn(300));

    vi.setSystemTime(new Date('2026-07-28T00:04:00.000Z'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshCount).toBe(1);
  });

  it('shares one refresh between the scheduler and a 401 interceptor', async () => {
    let refreshCount = 0;
    let resolveRefresh;
    authClient.defaults.adapter = config => {
      refreshCount += 1;
      return new Promise(resolve => {
        resolveRefresh = () => resolve(
          response(config, { data: { token: tokenExpiringIn(900) } }),
        );
      });
    };
    apiClient.defaults.adapter = async config => {
      if (!config._retry) throw unauthorized(config);
      return response(config, { success: true });
    };
    startSilentRefreshScheduler();
    setAccessToken(tokenExpiringIn(-1));
    await vi.advanceTimersByTimeAsync(0);

    const interceptedRequest = apiClient.get('/courses');
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshCount).toBe(1);

    resolveRefresh();
    await expect(interceptedRequest).resolves.toMatchObject({
      data: { success: true },
    });
    expect(refreshCount).toBe(1);
  });
});
