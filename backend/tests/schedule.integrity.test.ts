import { describe, expect, it } from 'vitest';
import { scheduleEventSchema } from '../notification-service/src/events/schedule.consumer';
import { SCHEDULE_TIMEZONE, timesOverlap } from '../academic-service/src/services/schedule.service';
import { scheduleQuery } from '../academic-service/src/validators/schedule.validator';

describe('schedule integrity contract', () => {
  it('accepts organization filters and rejects unknown query fields', () => {
    expect(scheduleQuery.safeParse({
      courseId: '11111111-1111-4111-8111-111111111111',
      termId: '22222222-2222-4222-8222-222222222222',
      teacherId: '33333333-3333-4333-8333-333333333333',
      studentId: '44444444-4444-4444-8444-444444444444',
    }).success).toBe(true);
    expect(scheduleQuery.safeParse({ organizationId: 'attacker-org' }).success).toBe(false);
  });

  it('detects intersecting teacher and room time ranges while allowing adjacent classes', () => {
    expect(timesOverlap('09:00', '10:30', '10:00', '11:00')).toBe(true);
    expect(timesOverlap('09:00', '10:30', '10:30', '12:00')).toBe(false);
    expect(timesOverlap('14:00', '15:00', '09:00', '10:00')).toBe(false);
  });

  it('publishes an idempotent, recipient-scoped Mongolia-timezone event', () => {
    expect(SCHEDULE_TIMEZONE).toBe('Asia/Ulaanbaatar');
    expect(scheduleEventSchema.safeParse({
      organizationId: 'org_1',
      scheduleId: '11111111-1111-4111-8111-111111111111',
      courseId: '22222222-2222-4222-8222-222222222222',
      termId: null,
      title: 'Лекц',
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '10:30',
      room: '201',
      timezone: 'Asia/Ulaanbaatar',
      recipientIds: ['student-1', 'parent-1'],
      changeId: '2026-07-30T12:00:00.000Z',
    }).success).toBe(true);
  });
});
