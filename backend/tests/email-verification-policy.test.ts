import { describe, expect, it, vi } from 'vitest';
import { AppError, tenantMiddleware } from '@lms/shared';
import { Request, Response } from 'express';
import {
  getVerificationTokenDisposition,
  hashVerificationToken,
  isEmailVerificationRequired,
  isVerificationResendThrottled,
} from '../auth-service/src/services/verification-policy.service';

const now = new Date('2026-07-28T00:00:00.000Z');

describe('organization email-verification policy', () => {
  it('requires verification only when policy is enabled and the user is unverified', () => {
    expect(isEmailVerificationRequired(true, { isEmailVerified: false })).toBe(true);
    expect(isEmailVerificationRequired(false, { isEmailVerified: false })).toBe(false);
    expect(isEmailVerificationRequired(true, { isEmailVerified: true })).toBe(false);
  });

  it('blocks protected tenant access for a required unverified claim', () => {
    const request = {
      user: {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'STUDENT',
        sessionId: 'session-1',
        emailVerified: false,
        emailVerificationRequired: true,
      },
    } as Request;
    const next = vi.fn();

    tenantMiddleware(request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining<AppError>({
      statusCode: 403,
      message: 'EMAIL_VERIFICATION_REQUIRED',
    }));
  });

  it('preserves access when the organization policy is disabled', () => {
    const request = {
      user: {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'STUDENT',
        sessionId: 'session-1',
        emailVerified: false,
        emailVerificationRequired: false,
      },
    } as Request;
    const next = vi.fn();

    tenantMiddleware(request, {} as Response, next);

    expect(request.organizationId).toBe('org-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts a valid one-time token and safely classifies expired or reused tokens', () => {
    expect(getVerificationTokenDisposition({
      usedAt: null,
      expiresAt: new Date(now.getTime() + 1_000),
      alreadyVerified: false,
    }, now)).toBe('CLAIM');
    expect(getVerificationTokenDisposition({
      usedAt: null,
      expiresAt: new Date(now.getTime() - 1),
      alreadyVerified: false,
    }, now)).toBe('INVALID');
    expect(getVerificationTokenDisposition({
      usedAt: new Date(now.getTime() - 100),
      expiresAt: new Date(now.getTime() + 1_000),
      alreadyVerified: true,
    }, now)).toBe('IDEMPOTENT');
  });

  it('throttles resend requests inside the configured cooldown', () => {
    expect(isVerificationResendThrottled(
      new Date(now.getTime() - 30_000),
      now,
      60_000,
    )).toBe(true);
    expect(isVerificationResendThrottled(
      new Date(now.getTime() - 60_001),
      now,
      60_000,
    )).toBe(false);
  });

  it('stores only a deterministic hash rather than the raw token', () => {
    const rawToken = 'raw-email-verification-token';
    const hash = hashVerificationToken(rawToken);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(rawToken);
  });

  it('applies policy independently to organization-scoped accounts', () => {
    const sameEmailAccounts = [
      { organizationId: 'org-required', isEmailVerified: false, policy: true },
      { organizationId: 'org-optional', isEmailVerified: false, policy: false },
    ];
    expect(sameEmailAccounts.map(account => ({
      organizationId: account.organizationId,
      blocked: isEmailVerificationRequired(account.policy, account),
    }))).toEqual([
      { organizationId: 'org-required', blocked: true },
      { organizationId: 'org-optional', blocked: false },
    ]);
  });
});
