import { describe, expect, it } from 'vitest';
import {
  buildRefreshCookieConfig,
  createAccessToken,
  createSecureRefreshToken,
  hashRefreshToken,
  parseDuration,
  refreshTokenHashMatches,
  verifyAccessToken,
} from '@lms/shared';

describe('authentication token service', () => {
  it('creates access tokens with minimum session claims', () => {
    const token = createAccessToken({
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'STUDENT',
      sessionId: 'session-1',
    });
    const claims = verifyAccessToken(token);

    expect(claims.sub).toBe('user-1');
    expect(claims.userId).toBe('user-1');
    expect(claims.organizationId).toBe('org-1');
    expect(claims.role).toBe('STUDENT');
    expect(claims.sessionId).toBe('session-1');
    expect(claims.emailVerified).toBe(false);
    expect(claims.emailVerificationRequired).toBe(false);
    expect(claims.phoneVerified).toBe(false);
    expect(claims.phoneVerificationRequired).toBe(false);
    expect(claims).not.toHaveProperty('email');
    expect(claims).not.toHaveProperty('phone');
  });

  it('carries organization verification access state without profile data', () => {
    const claims = verifyAccessToken(createAccessToken({
      userId: 'user-2',
      organizationId: 'org-required',
      role: 'STUDENT',
      sessionId: 'session-2',
      emailVerified: false,
      emailVerificationRequired: true,
      phoneVerified: false,
      phoneVerificationRequired: true,
    }));
    expect(claims.emailVerified).toBe(false);
    expect(claims.emailVerificationRequired).toBe(true);
    expect(claims.phoneVerified).toBe(false);
    expect(claims.phoneVerificationRequired).toBe(true);
    expect(claims).not.toHaveProperty('email');
  });

  it('creates random refresh tokens and deterministic hashes', () => {
    const first = createSecureRefreshToken();
    const second = createSecureRefreshToken();
    const hash = hashRefreshToken(first);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toHaveLength(64);
    expect(refreshTokenHashMatches(first, hash)).toBe(true);
    expect(refreshTokenHashMatches(second, hash)).toBe(false);
  });

  it('parses durations and builds scoped HttpOnly cookies', () => {
    expect(parseDuration('15m')).toBe(15 * 60 * 1000);
    const cookie = buildRefreshCookieConfig();
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.path).toBe('/api/v1/auth');
    expect(cookie.options.maxAge).toBe(parseDuration('7d'));
  });
});
