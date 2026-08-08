import crypto from 'crypto';
import { AppError, getRedisClient } from '@lms/shared';

export interface PhoneOtpPolicy {
  length: number;
  expiresInMs: number;
  maxAttempts: number;
  resendCooldownMs: number;
  rateWindowMs: number;
  phoneMaxSends: number;
  ipMaxSends: number;
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

export const getPhoneOtpPolicy = (): PhoneOtpPolicy => {
  const length = positiveInteger('PHONE_OTP_LENGTH', 6);
  if (length < 6 || length > 8) throw new Error('PHONE_OTP_LENGTH must be between 6 and 8');
  return {
    length,
    expiresInMs: positiveInteger('PHONE_OTP_EXPIRES_SECONDS', 300) * 1000,
    maxAttempts: positiveInteger('PHONE_OTP_MAX_ATTEMPTS', 5),
    resendCooldownMs: positiveInteger('PHONE_OTP_RESEND_COOLDOWN_SECONDS', 60) * 1000,
    rateWindowMs: positiveInteger('PHONE_OTP_RATE_WINDOW_SECONDS', 3600) * 1000,
    phoneMaxSends: positiveInteger('PHONE_OTP_PHONE_MAX_SENDS', 5),
    ipMaxSends: positiveInteger('PHONE_OTP_IP_MAX_SENDS', 20),
  };
};

export const normalizePhoneNumber = (input: string): string => {
  let value = input.normalize('NFKC').trim().replace(/[\s().-]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (!value.startsWith('+')) {
    const countryCode = process.env.PHONE_DEFAULT_COUNTRY_CODE?.trim();
    if (!countryCode || !/^\+[1-9]\d{0,3}$/.test(countryCode)) {
      throw AppError.badRequest('Утасны дугаарыг улсын кодтой оруулна уу.');
    }
    value = `${countryCode}${value.replace(/^0+/, '')}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    throw AppError.badRequest('Утасны дугаарын формат буруу байна.');
  }
  return value;
};

export const createPhoneOtp = (length = getPhoneOtpPolicy().length): string => {
  if (!Number.isSafeInteger(length) || length < 6 || length > 8) {
    throw new Error('OTP length must be between 6 and 8');
  }
  const upperBound = 10 ** length;
  return crypto.randomInt(0, upperBound).toString().padStart(length, '0');
};

const getOtpHashSecret = (): string => {
  const secret = process.env.PHONE_OTP_HASH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PHONE_OTP_HASH_SECRET is required in production');
  }
  return 'development-phone-otp-secret';
};

export const hashPhoneOtp = (userId: string, otp: string, nonce = ''): string =>
  crypto.createHmac('sha256', getOtpHashSecret())
    .update(`${userId}\0${otp}\0${nonce}`, 'utf8')
    .digest('hex');

export const phoneOtpMatches = (
  userId: string,
  otp: string,
  expectedHash: string,
  nonce = '',
): boolean => {
  const actual = Buffer.from(hashPhoneOtp(userId, otp, nonce), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const fingerprint = (scope: string, value: string): string =>
  crypto.createHash('sha256').update(`${scope}\0${value}`, 'utf8').digest('hex');

export interface PhoneOtpRateStore {
  increment(key: string, windowMs: number): Promise<number>;
}

class RedisPhoneOtpRateStore implements PhoneOtpRateStore {
  async increment(key: string, windowMs: number): Promise<number> {
    const client = getRedisClient();
    if (client.status !== 'ready') throw new Error('Redis OTP rate-limit store is not ready');
    const result = await client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
       return count`,
      1,
      key,
      windowMs,
    );
    return Number(result);
  }
}

export class PhoneOtpRateLimiter {
  constructor(
    private readonly store: PhoneOtpRateStore = new RedisPhoneOtpRateStore(),
    private readonly policy: PhoneOtpPolicy = getPhoneOtpPolicy(),
  ) {}

  async consume(phone: string, ipAddress = 'unknown'): Promise<void> {
    try {
      const phoneCount = await this.store.increment(
        `auth:phone-otp:phone:${fingerprint('phone', phone)}`,
        this.policy.rateWindowMs,
      );
      const ipCount = await this.store.increment(
        `auth:phone-otp:ip:${fingerprint('ip', ipAddress)}`,
        this.policy.rateWindowMs,
      );
      if (phoneCount > this.policy.phoneMaxSends || ipCount > this.policy.ipMaxSends) {
        throw new AppError('Хэт олон хүсэлт илгээлээ. Дараа дахин оролдоно уу.', 429);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Баталгаажуулалтын үйлчилгээ түр боломжгүй байна.', 503);
      }
    }
  }
}

export const phoneOtpRateLimiter = new PhoneOtpRateLimiter();

export type PhoneOtpDisposition = 'VALID' | 'INVALID' | 'EXPIRED' | 'ATTEMPT_LIMIT';
export const getPhoneOtpDisposition = (
  token: { expiresAt: Date; usedAt: Date | null; attemptCount: number; maxAttempts: number } | null,
  now: Date,
): PhoneOtpDisposition => {
  if (!token || token.usedAt) return 'INVALID';
  if (token.expiresAt <= now) return 'EXPIRED';
  if (token.attemptCount >= token.maxAttempts) return 'ATTEMPT_LIMIT';
  return 'VALID';
};

export const isPhoneVerificationRequired = (
  policyRequired: boolean,
  user: { isPhoneVerified: boolean },
): boolean => policyRequired && !user.isPhoneVerified;

export const validatePhoneOtpEnvironment = (): void => {
  getPhoneOtpPolicy();
  getOtpHashSecret();
};
