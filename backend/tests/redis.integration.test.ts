import { randomUUID } from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeRedisClient, getRedisClient } from '@lms/shared';

describe.sequential('Redis integration', () => {
  afterAll(async () => {
    await closeRedisClient();
  });

  it('connects to a live Redis instance and round-trips a value with a TTL', async () => {
    const client = getRedisClient();
    expect(await client.ping()).toBe('PONG');

    const key = `ci-integration:${randomUUID()}`;
    await client.set(key, 'ok', 'EX', 5);
    expect(await client.get(key)).toBe('ok');
    expect(await client.ttl(key)).toBeGreaterThan(0);

    await client.del(key);
    expect(await client.get(key)).toBeNull();
  });
});
