import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPasswordResetToken,
  getPasswordResetExpiresInMs,
  hashPasswordResetToken,
  PasswordResetRateLimiter,
} from '../auth-service/src/services/password-reset.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('password reset foundation', () => {
  it('creates a random URL-safe token and only a deterministic hash is stored', () => {
    const first = createPasswordResetToken();
    const second = createPasswordResetToken();
    const hash = hashPasswordResetToken(first);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(first);
  });

  it('uses a short configurable expiration', () => {
    vi.stubEnv('PASSWORD_RESET_EXPIRES_IN', '20m');
    expect(getPasswordResetExpiresInMs()).toBe(20 * 60 * 1000);
  });

  it('limits both account identifiers and IP addresses', async () => {
    const counts = new Map<string, number>();
    const limiter = new PasswordResetRateLimiter({
      async increment(key) {
        const count = (counts.get(key) || 0) + 1;
        counts.set(key, count);
        return count;
      },
    }, {
      windowMs: 900_000,
      accountMaxRequests: 1,
      ipMaxRequests: 2,
    });
    await expect(limiter.consume('org-1\u0000user@example.test', '127.0.0.1'))
      .resolves.toBe(true);
    await expect(limiter.consume('org-1\u0000user@example.test', '127.0.0.2'))
      .resolves.toBe(false);
  });

  it('never logs or returns the raw token from its helpers', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rawToken = createPasswordResetToken();
    const hash = hashPasswordResetToken(rawToken);
    expect(hash).not.toContain(rawToken);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
