import { describe, expect, it } from 'vitest';
import {
  createLoginAttemptKeys,
  FailedLoginResult,
  genericLoginError,
  LoginAttemptKeys,
  LoginAttemptState,
  LoginAttemptStore,
  LoginProtectionPolicy,
  LoginProtectionService,
} from '../auth-service/src/services/login-protection.service';

interface Counter {
  attempts: number;
  firstFailedAt: number;
  lastFailedAt: number;
  expiresAt: number;
}

class MemoryLoginAttemptStore implements LoginAttemptStore {
  private counters = new Map<string, Counter>();
  private locks = new Map<string, number>();

  constructor(private readonly now: () => number) {}

  private counter(key: string): Counter | undefined {
    const value = this.counters.get(key);
    if (value && value.expiresAt <= this.now()) {
      this.counters.delete(key);
      return undefined;
    }
    return value;
  }

  async read(keys: LoginAttemptKeys): Promise<LoginAttemptState> {
    return {
      ipAttempts: this.counter(keys.ip)?.attempts || 0,
      accountAttempts: this.counter(keys.account)?.attempts || 0,
      combinedAttempts: this.counter(keys.combined)?.attempts || 0,
      lockTtlMs: Math.max(0, (this.locks.get(keys.lock) || 0) - this.now()),
    };
  }

  async recordFailure(
    keys: LoginAttemptKeys,
    nowMs: number,
    policy: LoginProtectionPolicy,
  ): Promise<FailedLoginResult> {
    const increment = (key: string) => {
      const current = this.counter(key);
      const next = current
        ? {
            ...current,
            attempts: current.attempts + 1,
            lastFailedAt: nowMs,
            expiresAt: nowMs + policy.windowMs,
          }
        : {
            attempts: 1,
            firstFailedAt: nowMs,
            lastFailedAt: nowMs,
            expiresAt: nowMs + policy.windowMs,
          };
      this.counters.set(key, next);
      return next;
    };
    const ip = increment(keys.ip);
    const account = increment(keys.account);
    const combined = increment(keys.combined);
    const wasLocked = (this.locks.get(keys.lock) || 0) > nowMs;
    const newlyLocked = account.attempts >= policy.lockThreshold && !wasLocked;
    if (newlyLocked) this.locks.set(keys.lock, nowMs + policy.lockDurationMs);
    return {
      ipAttempts: ip.attempts,
      accountAttempts: account.attempts,
      combinedAttempts: combined.attempts,
      lockTtlMs: Math.max(0, (this.locks.get(keys.lock) || 0) - nowMs),
      newlyLocked,
      firstFailedAt: account.firstFailedAt,
      lastFailedAt: account.lastFailedAt,
    };
  }

  async reset(keys: LoginAttemptKeys): Promise<void> {
    this.counters.delete(keys.account);
    this.counters.delete(keys.combined);
    this.locks.delete(keys.lock);
  }
}

const policy: LoginProtectionPolicy = {
  windowMs: 60_000,
  ipMaxAttempts: 50,
  accountMaxAttempts: 10,
  combinedMaxAttempts: 8,
  lockThreshold: 5,
  lockDurationMs: 30_000,
};

const setup = (overrides: Partial<LoginProtectionPolicy> = {}) => {
  let now = 1_000;
  const clock = () => now;
  const store = new MemoryLoginAttemptStore(clock);
  const service = new LoginProtectionService(store, { ...policy, ...overrides }, clock);
  return {
    service,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
};

describe('distributed login protection policy', () => {
  it('tracks repeated failures with first and last timestamps', async () => {
    const { service, advance } = setup();
    const keys = service.keys('org-1', 'User@Example.test', '203.0.113.1');
    const first = await service.recordFailure(keys);
    advance(500);
    const second = await service.recordFailure(keys);

    expect(second.accountAttempts).toBe(2);
    expect(second.firstFailedAt).toBe(first.firstFailedAt);
    expect(second.lastFailedAt).toBe(first.lastFailedAt + 500);
  });

  it('limits an IP across different account identifiers', async () => {
    const { service } = setup({
      ipMaxAttempts: 3,
      accountMaxAttempts: 100,
      combinedMaxAttempts: 100,
      lockThreshold: 100,
    });
    for (const identifier of ['one@example.test', 'two@example.test', 'three@example.test']) {
      await service.recordFailure(service.keys('org-1', identifier, '203.0.113.2'));
    }

    await expect(
      service.check(service.keys('org-1', 'four@example.test', '203.0.113.2')),
    ).resolves.toMatchObject({ allowed: false, reason: 'IP_LIMIT' });
  });

  it('limits one account across different IP addresses', async () => {
    const { service } = setup({
      ipMaxAttempts: 100,
      accountMaxAttempts: 2,
      combinedMaxAttempts: 100,
      lockThreshold: 100,
    });
    await service.recordFailure(service.keys('org-1', 'target@example.test', '203.0.113.3'));
    await service.recordFailure(service.keys('org-1', 'TARGET@example.test', '203.0.113.4'));

    await expect(
      service.check(service.keys('org-1', 'target@example.test', '203.0.113.5')),
    ).resolves.toMatchObject({ allowed: false, reason: 'ACCOUNT_LIMIT' });
  });

  it('limits a combined IP and account key', async () => {
    const { service } = setup({
      ipMaxAttempts: 100,
      accountMaxAttempts: 100,
      combinedMaxAttempts: 2,
      lockThreshold: 100,
    });
    const keys = service.keys('org-1', 'target@example.test', '203.0.113.6');
    await service.recordFailure(keys);
    await service.recordFailure(keys);

    await expect(service.check(keys)).resolves.toMatchObject({
      allowed: false,
      reason: 'COMBINED_LIMIT',
    });
  });

  it('activates a temporary lock once and allows retry after expiry', async () => {
    const { service, advance } = setup({
      accountMaxAttempts: 100,
      combinedMaxAttempts: 100,
      lockThreshold: 3,
    });
    const keys = service.keys('org-1', 'locked@example.test', '203.0.113.7');
    await service.recordFailure(keys);
    await service.recordFailure(keys);
    const locked = await service.recordFailure(keys);

    expect(locked.newlyLocked).toBe(true);
    await expect(service.check(keys)).resolves.toMatchObject({
      allowed: false,
      reason: 'ACCOUNT_LOCKED',
    });
    advance(policy.lockDurationMs + 1);
    await expect(service.check(keys)).resolves.toMatchObject({ allowed: true });
  });

  it('resets account and combined counters after successful authentication', async () => {
    const { service } = setup();
    const keys = service.keys('org-1', 'success@example.test', '203.0.113.8');
    await service.recordFailure(keys);
    await service.reset(keys);

    await expect(service.check(keys)).resolves.toMatchObject({ allowed: true });
  });

  it('uses the same generic response for known and unknown identifiers', () => {
    expect(genericLoginError).not.toContain('unknown@example.test');
    expect(createLoginAttemptKeys('org-1', 'unknown@example.test', '203.0.113.9'))
      .toEqual(createLoginAttemptKeys('org-1', ' UNKNOWN@example.test ', '203.0.113.9'));
  });

  it('keeps concurrent failure increments atomic', async () => {
    const { service } = setup({ lockThreshold: 10 });
    const keys = service.keys('org-1', 'concurrent@example.test', '203.0.113.10');
    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.recordFailure(keys)),
    );

    expect(Math.max(...results.map(result => result.accountAttempts))).toBe(20);
    expect(results.filter(result => result.newlyLocked)).toHaveLength(1);
  });
});
