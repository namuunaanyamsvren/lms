import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createEventEnvelope,
  createPrismaInbox,
  EVENTS,
  InboxClaimResult,
  registerEventContract,
  supportedEventVersions,
  validateEventEnvelope,
} from '@lms/shared';

describe('event contract envelope', () => {
  it('creates the complete versioned envelope and validates its payload', () => {
    const envelope = createEventEnvelope(
      EVENTS.USER_UPDATED,
      {
        organizationId: 'org-1',
        userId: 'user-1',
        email: 'user@example.test',
        role: 'STUDENT',
      },
      { traceId: 'trace-1' }
    );
    expect(envelope).toMatchObject({
      eventType: EVENTS.USER_UPDATED,
      version: 1,
      traceId: 'trace-1',
      organizationId: 'org-1',
    });
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => validateEventEnvelope(envelope)).not.toThrow();
  });

  it('rejects unsupported versions and malformed envelopes', () => {
    const envelope = createEventEnvelope(EVENTS.COURSE_CREATED, {
      organizationId: 'org-1',
      courseId: 'course-1',
    });
    expect(() => validateEventEnvelope({ ...envelope, version: 99 })).toThrow(
      'Unsupported event contract'
    );
    expect(() => validateEventEnvelope({ ...envelope, unexpected: true })).toThrow();
    expect(() => validateEventEnvelope({ ...envelope, organizationId: 'different-org' })).toThrow(
      'does not match'
    );
  });

  it('allows independently registered backward-compatible versions', () => {
    registerEventContract('test.compatible', 1, z.object({ organizationId: z.string() }));
    registerEventContract(
      'test.compatible',
      2,
      z.object({ organizationId: z.string(), label: z.string().default('') })
    );
    expect(supportedEventVersions('test.compatible')).toEqual([1, 2]);
    expect(
      createEventEnvelope(
        'test.compatible',
        { organizationId: 'org-1', label: 'v2' },
        { version: 2 }
      ).version
    ).toBe(2);
  });
});

describe('consumer inbox idempotency adapter', () => {
  it('claims once and treats Prisma unique conflicts as duplicate delivery', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 'P2002' }));
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue({
      status: 'PROCESSED',
      receivedAt: new Date(),
    });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const inbox = createPrismaInbox({ create, update, updateMany, findUnique, deleteMany });
    const envelope = createEventEnvelope(EVENTS.ENROLLMENT_CREATED, {
      organizationId: 'org-1',
      enrollmentId: 'enrollment-1',
    });
    await expect(inbox.claim(envelope, 'consumer-a')).resolves.toBe(InboxClaimResult.CLAIMED);
    await expect(inbox.claim(envelope, 'consumer-a')).resolves.toBe(InboxClaimResult.PROCESSED);
    await inbox.complete?.(envelope.eventId, 'consumer-a');
    await inbox.fail?.(envelope.eventId, 'consumer-a', 'retry');
    expect(update).toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalled();
  });

  it('atomically reclaims only stale processing rows', async () => {
    const delegate = {
      create: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' })),
      findUnique: vi.fn().mockResolvedValue({
        status: 'PROCESSING',
        receivedAt: new Date(0),
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const inbox = createPrismaInbox(delegate);
    const envelope = createEventEnvelope(EVENTS.ENROLLMENT_CREATED, {
      organizationId: 'org-1',
      enrollmentId: 'enrollment-1',
    });
    await expect(inbox.claim(envelope, 'consumer-a')).resolves.toBe(InboxClaimResult.CLAIMED);
    expect(delegate.updateMany).toHaveBeenCalled();
  });
});
