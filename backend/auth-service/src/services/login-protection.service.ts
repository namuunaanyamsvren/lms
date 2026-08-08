import crypto from 'crypto';
import { AppError, getRedisClient } from '@lms/shared';

const GENERIC_AUTH_ERROR = 'Нэвтрэх мэдээлэл буруу эсвэл түр хугацаанд нэвтрэх боломжгүй байна.';

export interface LoginProtectionPolicy {
  windowMs: number;
  ipMaxAttempts: number;
  accountMaxAttempts: number;
  combinedMaxAttempts: number;
  lockThreshold: number;
  lockDurationMs: number;
}

export interface LoginAttemptKeys {
  ip: string;
  account: string;
  combined: string;
  lock: string;
}

export interface LoginAttemptState {
  ipAttempts: number;
  accountAttempts: number;
  combinedAttempts: number;
  lockTtlMs: number;
}

export interface FailedLoginResult extends LoginAttemptState {
  newlyLocked: boolean;
  firstFailedAt: number;
  lastFailedAt: number;
}

export interface LoginAttemptStore {
  read(keys: LoginAttemptKeys): Promise<LoginAttemptState>;
  recordFailure(
    keys: LoginAttemptKeys,
    nowMs: number,
    policy: LoginProtectionPolicy,
  ): Promise<FailedLoginResult>;
  reset(keys: LoginAttemptKeys): Promise<void>;
}

const positiveInteger = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

export const getLoginProtectionPolicy = (): LoginProtectionPolicy => ({
  windowMs: positiveInteger('LOGIN_ATTEMPT_WINDOW_SECONDS', 15 * 60) * 1000,
  ipMaxAttempts: positiveInteger('LOGIN_IP_MAX_ATTEMPTS', 50),
  accountMaxAttempts: positiveInteger('LOGIN_ACCOUNT_MAX_ATTEMPTS', 10),
  combinedMaxAttempts: positiveInteger('LOGIN_COMBINED_MAX_ATTEMPTS', 5),
  lockThreshold: positiveInteger('LOGIN_LOCK_THRESHOLD', 5),
  lockDurationMs: positiveInteger('LOGIN_LOCK_DURATION_SECONDS', 15 * 60) * 1000,
});

export const normalizeLoginIdentifier = (identifier: string): string =>
  identifier.normalize('NFKC').trim().toLocaleLowerCase('en-US');

const fingerprint = (scope: string, value: string): string =>
  crypto.createHash('sha256').update(`${scope}\0${value}`, 'utf8').digest('hex');

export const createLoginAttemptKeys = (
  organizationId: string,
  identifier: string,
  ipAddress = 'unknown',
): LoginAttemptKeys => {
  const account = fingerprint(
    'account',
    `${organizationId}\0${normalizeLoginIdentifier(identifier)}`,
  );
  const ip = fingerprint('ip', ipAddress);
  return {
    ip: `auth:login:ip:${ip}`,
    account: `auth:login:account:${account}`,
    combined: `auth:login:combined:${fingerprint('combined', `${ip}\0${account}`)}`,
    lock: `auth:login:lock:${account}`,
  };
};

const READ_SCRIPT = `
local lockTtl = redis.call('PTTL', KEYS[4])
local ip = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
local account = tonumber(redis.call('HGET', KEYS[2], 'attempts') or '0')
local combined = tonumber(redis.call('HGET', KEYS[3], 'attempts') or '0')
return {ip, account, combined, lockTtl}
`;

const RECORD_FAILURE_SCRIPT = `
local now = ARGV[1]
local window = tonumber(ARGV[2])
local lockThreshold = tonumber(ARGV[3])
local lockDuration = tonumber(ARGV[4])
local counts = {}
for index = 1, 3 do
  counts[index] = redis.call('HINCRBY', KEYS[index], 'attempts', 1)
  redis.call('HSETNX', KEYS[index], 'firstFailedAt', now)
  redis.call('HSET', KEYS[index], 'lastFailedAt', now)
  redis.call('PEXPIRE', KEYS[index], window)
end
local newlyLocked = 0
if counts[2] >= lockThreshold and redis.call('EXISTS', KEYS[4]) == 0 then
  redis.call('SET', KEYS[4], now, 'PX', lockDuration)
  newlyLocked = 1
end
local firstFailedAt = tonumber(redis.call('HGET', KEYS[2], 'firstFailedAt') or now)
local lockTtl = redis.call('PTTL', KEYS[4])
return {counts[1], counts[2], counts[3], lockTtl, newlyLocked, firstFailedAt, tonumber(now)}
`;

class RedisLoginAttemptStore implements LoginAttemptStore {
  private client() {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      throw new Error('Redis login-protection store is not ready');
    }
    return client;
  }

  async read(keys: LoginAttemptKeys): Promise<LoginAttemptState> {
    const result = await this.client().eval(
      READ_SCRIPT,
      4,
      keys.ip,
      keys.account,
      keys.combined,
      keys.lock,
    ) as number[];
    return {
      ipAttempts: Number(result[0]),
      accountAttempts: Number(result[1]),
      combinedAttempts: Number(result[2]),
      lockTtlMs: Math.max(0, Number(result[3])),
    };
  }

  async recordFailure(
    keys: LoginAttemptKeys,
    nowMs: number,
    policy: LoginProtectionPolicy,
  ): Promise<FailedLoginResult> {
    const result = await this.client().eval(
      RECORD_FAILURE_SCRIPT,
      4,
      keys.ip,
      keys.account,
      keys.combined,
      keys.lock,
      nowMs,
      policy.windowMs,
      policy.lockThreshold,
      policy.lockDurationMs,
    ) as number[];
    return {
      ipAttempts: Number(result[0]),
      accountAttempts: Number(result[1]),
      combinedAttempts: Number(result[2]),
      lockTtlMs: Math.max(0, Number(result[3])),
      newlyLocked: Number(result[4]) === 1,
      firstFailedAt: Number(result[5]),
      lastFailedAt: Number(result[6]),
    };
  }

  async reset(keys: LoginAttemptKeys): Promise<void> {
    await this.client().del(keys.account, keys.combined, keys.lock);
  }
}

export interface LoginProtectionDecision {
  allowed: boolean;
  reason?: 'IP_LIMIT' | 'ACCOUNT_LIMIT' | 'COMBINED_LIMIT' | 'ACCOUNT_LOCKED';
  retryAfterMs?: number;
}

export class LoginProtectionService {
  constructor(
    private readonly store: LoginAttemptStore = new RedisLoginAttemptStore(),
    private readonly policy: LoginProtectionPolicy = getLoginProtectionPolicy(),
    private readonly now: () => number = Date.now,
  ) {}

  keys(organizationId: string, identifier: string, ipAddress?: string): LoginAttemptKeys {
    return createLoginAttemptKeys(organizationId, identifier, ipAddress);
  }

  async check(keys: LoginAttemptKeys): Promise<LoginProtectionDecision> {
    let state: LoginAttemptState;
    try {
      state = await this.store.read(keys);
    } catch {
      if (this.storeFailureMode() === 'allow') return { allowed: true };
      throw new AppError('Нэвтрэх хамгаалалт түр хугацаанд боломжгүй байна.', 503);
    }
    if (state.lockTtlMs > 0) {
      return { allowed: false, reason: 'ACCOUNT_LOCKED', retryAfterMs: state.lockTtlMs };
    }
    if (state.ipAttempts >= this.policy.ipMaxAttempts) {
      return { allowed: false, reason: 'IP_LIMIT', retryAfterMs: this.policy.windowMs };
    }
    if (state.accountAttempts >= this.policy.accountMaxAttempts) {
      return { allowed: false, reason: 'ACCOUNT_LIMIT', retryAfterMs: this.policy.windowMs };
    }
    if (state.combinedAttempts >= this.policy.combinedMaxAttempts) {
      return { allowed: false, reason: 'COMBINED_LIMIT', retryAfterMs: this.policy.windowMs };
    }
    return { allowed: true };
  }

  async recordFailure(keys: LoginAttemptKeys): Promise<FailedLoginResult> {
    const now = this.now();
    try {
      return await this.store.recordFailure(keys, now, this.policy);
    } catch {
      if (this.storeFailureMode() === 'deny') {
        throw new AppError('Нэвтрэх хамгаалалт түр хугацаанд боломжгүй байна.', 503);
      }
      return {
        ipAttempts: 0,
        accountAttempts: 0,
        combinedAttempts: 0,
        lockTtlMs: 0,
        newlyLocked: false,
        firstFailedAt: now,
        lastFailedAt: now,
      };
    }
  }

  async reset(keys: LoginAttemptKeys): Promise<void> {
    try {
      await this.store.reset(keys);
    } catch {
      if (this.storeFailureMode() === 'deny') {
        throw new AppError('Нэвтрэх хамгаалалт түр хугацаанд боломжгүй байна.', 503);
      }
    }
  }

  private storeFailureMode(): 'allow' | 'deny' {
    const configured = process.env.BRUTE_FORCE_STORE_FAILURE_MODE;
    if (configured === 'allow' || configured === 'deny') return configured;
    return process.env.NODE_ENV === 'production' ? 'deny' : 'allow';
  }
}

export const loginProtection = new LoginProtectionService();
export const genericLoginError = GENERIC_AUTH_ERROR;
