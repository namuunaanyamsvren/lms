import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, tenantMiddleware } from '@lms/shared';
import { Request, Response as ExpressResponse } from 'express';
import {
  createPhoneOtp,
  getPhoneOtpDisposition,
  hashPhoneOtp,
  isPhoneVerificationRequired,
  normalizePhoneNumber,
  PhoneOtpRateLimiter,
  phoneOtpMatches,
} from '../auth-service/src/services/phone-verification.service';
import {
  DevelopmentSmsProvider,
  SmsDeliveryError,
  TwilioSmsProvider,
} from '../auth-service/src/services/sms-provider.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('phone OTP security', () => {
  it('normalizes configured local and international phone numbers', () => {
    vi.stubEnv('PHONE_DEFAULT_COUNTRY_CODE', '+976');
    expect(normalizePhoneNumber('9911-2233')).toBe('+97699112233');
    expect(normalizePhoneNumber('00976 9911 2233')).toBe('+97699112233');
  });

  it('creates a cryptographically random numeric OTP and stores only an HMAC', () => {
    vi.stubEnv('PHONE_OTP_HASH_SECRET', 'test-only-secret');
    const otp = createPhoneOtp(6);
    const hash = hashPhoneOtp('user-1', otp);
    expect(otp).toMatch(/^\d{6}$/);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(otp);
    expect(phoneOtpMatches('user-1', otp, hash)).toBe(true);
    expect(phoneOtpMatches('user-1', '000000', hash)).toBe(otp === '000000');
  });

  it('classifies expired, used, and attempt-limited OTPs', () => {
    const now = new Date('2026-07-28T00:00:00Z');
    expect(getPhoneOtpDisposition({
      usedAt: null,
      expiresAt: new Date(now.getTime() + 1_000),
      attemptCount: 0,
      maxAttempts: 5,
    }, now)).toBe('VALID');
    expect(getPhoneOtpDisposition({
      usedAt: null,
      expiresAt: new Date(now.getTime() - 1),
      attemptCount: 0,
      maxAttempts: 5,
    }, now)).toBe('EXPIRED');
    expect(getPhoneOtpDisposition({
      usedAt: null,
      expiresAt: new Date(now.getTime() + 1_000),
      attemptCount: 5,
      maxAttempts: 5,
    }, now)).toBe('ATTEMPT_LIMIT');
    expect(getPhoneOtpDisposition({
      usedAt: now,
      expiresAt: new Date(now.getTime() + 1_000),
      attemptCount: 0,
      maxAttempts: 5,
    }, now)).toBe('INVALID');
  });

  it('enforces per-phone and per-IP send limits', async () => {
    const counts = new Map<string, number>();
    const limiter = new PhoneOtpRateLimiter({
      async increment(key) {
        const count = (counts.get(key) || 0) + 1;
        counts.set(key, count);
        return count;
      },
    }, {
      length: 6,
      expiresInMs: 300_000,
      maxAttempts: 5,
      resendCooldownMs: 60_000,
      rateWindowMs: 3_600_000,
      phoneMaxSends: 1,
      ipMaxSends: 2,
    });
    await limiter.consume('+97699112233', '127.0.0.1');
    await expect(limiter.consume('+97699112233', '127.0.0.2'))
      .rejects.toMatchObject<AppError>({ statusCode: 429 });
  });

  it('enforces organization phone policy in tenant middleware', () => {
    expect(isPhoneVerificationRequired(true, { isPhoneVerified: false })).toBe(true);
    expect(isPhoneVerificationRequired(false, { isPhoneVerified: false })).toBe(false);
    const request = {
      user: {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'STUDENT',
        sessionId: 'session-1',
        emailVerified: true,
        emailVerificationRequired: false,
        phoneVerified: false,
        phoneVerificationRequired: true,
      },
    } as Request;
    const next = vi.fn();
    tenantMiddleware(request, {} as ExpressResponse, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining<AppError>({
      statusCode: 403,
      message: 'PHONE_VERIFICATION_REQUIRED',
    }));
  });
});

describe('SMS provider abstraction', () => {
  it('development adapter neither logs nor exposes the OTP', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await new DevelopmentSmsProvider().sendVerificationSms({
      to: '+97699112233',
      code: '123456',
      expiresInMinutes: 5,
    });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('maps provider failures safely and does not retry', async () => {
    const request = vi.fn(async () => new globalThis.Response('', { status: 500 }));
    const provider = new TwilioSmsProvider('AC-test', 'secret', '+15551234567', 1000, request);
    await expect(provider.sendVerificationSms({
      to: '+97699112233',
      code: '123456',
      expiresInMinutes: 5,
    })).rejects.toBeInstanceOf(SmsDeliveryError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('sends the expected form request without logging provider data', async () => {
    const request = vi.fn(async () => new globalThis.Response('{}', { status: 201 }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const provider = new TwilioSmsProvider('AC-test', 'secret', '+15551234567', 1000, request);
    await provider.sendVerificationSms({
      to: '+97699112233',
      code: '654321',
      expiresInMinutes: 5,
    });
    expect(request).toHaveBeenCalledTimes(1);
    const [, options] = request.mock.calls[0];
    expect(String(options?.body)).toContain('To=%2B97699112233');
    expect(log).not.toHaveBeenCalled();
  });
});
