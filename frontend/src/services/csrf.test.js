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
});
