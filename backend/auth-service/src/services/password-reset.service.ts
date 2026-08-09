import crypto from 'crypto';
import { getRedisClient, parseDuration } from '@lms/shared';

const TOKEN_BYTES = 32;
const DEFAULT_TTL = '30m';

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

export const createPasswordResetToken = (): string =>
  crypto.randomBytes(TOKEN_BYTES).toString('base64url');

const resetTokenMacSecret = (): string =>
  process.env.PASSWORD_RESET_TOKEN_HASH_SECRET ||
  process.env.SERVICE_TOKEN_SECRET ||
  process.env.REFRESH_TOKEN_SECRET ||
  'test-only-password-reset-token-hmac-secret';

export const hashPasswordResetToken = (token: string): string =>
  crypto.createHmac('sha256', resetTokenMacSecret()).update(token, 'utf8').digest('hex');

export const getPasswordResetExpiresInMs = (): number =>
  parseDuration(
    process.env.PASSWORD_RESET_EXPIRES_IN || DEFAULT_TTL,
    'PASSWORD_RESET_EXPIRES_IN',
  );

const normalizeIdentifier = (identifier: string): string =>
  identifier.normalize('NFKC').trim().toLocaleLowerCase('en-US');

const fingerprint = (scope: string, value: string): string =>
  crypto.createHash('sha256').update(`${scope}\0${value}`, 'utf8').digest('hex');

export interface PasswordResetRateStore {
  increment(key: string, windowMs: number): Promise<number>;
}

class RedisPasswordResetRateStore implements PasswordResetRateStore {
  async increment(key: string, windowMs: number): Promise<number> {
    const client = getRedisClient();
    if (client.status !== 'ready') throw new Error('Redis password-reset store is not ready');
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

export interface PasswordResetRatePolicy {
  windowMs: number;
  ipMaxRequests: number;
  accountMaxRequests: number;
}

export const getPasswordResetRatePolicy = (): PasswordResetRatePolicy => ({
  windowMs: positiveInteger('PASSWORD_RESET_RATE_WINDOW_SECONDS', 900) * 1000,
  ipMaxRequests: positiveInteger('PASSWORD_RESET_IP_MAX_REQUESTS', 20),
  accountMaxRequests: positiveInteger('PASSWORD_RESET_ACCOUNT_MAX_REQUESTS', 5),
});

export class PasswordResetRateLimiter {
  constructor(
    private readonly store: PasswordResetRateStore = new RedisPasswordResetRateStore(),
    private readonly policy: PasswordResetRatePolicy = getPasswordResetRatePolicy(),
  ) {}

  async consume(identifier: string, ipAddress = 'unknown'): Promise<boolean> {
    try {
      const accountCount = await this.store.increment(
        `auth:password-reset:account:${fingerprint('account', normalizeIdentifier(identifier))}`,
        this.policy.windowMs,
      );
      const ipCount = await this.store.increment(
        `auth:password-reset:ip:${fingerprint('ip', ipAddress)}`,
        this.policy.windowMs,
      );
      return accountCount <= this.policy.accountMaxRequests &&
        ipCount <= this.policy.ipMaxRequests;
    } catch {
      // Fail closed in production without changing the generic endpoint
      // response. Development remains usable when Redis is not running.
      return process.env.NODE_ENV !== 'production';
    }
  }
}

export const passwordResetRateLimiter = new PasswordResetRateLimiter();

export const validatePasswordResetEnvironment = (): void => {
  getPasswordResetExpiresInMs();
  getPasswordResetRatePolicy();
};
