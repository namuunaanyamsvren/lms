// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CSRF bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    document.cookie = 'lms_csrf=; Max-Age=0; path=/';
  });

  it('shares one request between concurrent unsafe operations', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { token: 'shared-csrf-token' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { ensureCsrfToken } = await import('./csrf');

    const tokens = await Promise.all([
      ensureCsrfToken(),
      ensureCsrfToken(),
      ensureCsrfToken(),
    ]);

    expect(tokens).toEqual([
      'shared-csrf-token',
      'shared-csrf-token',
      'shared-csrf-token',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient CSRF bootstrap failures', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { token: 'retry-csrf-token' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const { ensureCsrfToken } = await import('./csrf');

    const tokenPromise = ensureCsrfToken();
    await vi.advanceTimersByTimeAsync(500);

    await expect(tokenPromise).resolves.toBe('retry-csrf-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry permanent CSRF bootstrap failures', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { ensureCsrfToken } = await import('./csrf');

    await expect(ensureCsrfToken()).rejects.toThrow('CSRF token авахад алдаа гарлаа.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
