import { describe, expect, it } from 'vitest';
import {
  scheduleBody,
  scheduleIdParams,
  scheduleUpdateBody,
} from '../academic-service/src/validators/schedule.validator';

const validSchedule = {
  courseId: '11111111-1111-4111-8111-111111111111',
  title: 'Calculus lecture',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:30',
  room: 'A-205',
  semester: '2026 Fall',
};

describe('schedule validation', () => {
  it('accepts a valid recurring course schedule', () => {
    expect(scheduleBody.safeParse(validSchedule).success).toBe(true);
  });

  it('rejects a student or organization field in the request body', () => {
    expect(scheduleBody.safeParse({
      ...validSchedule,
      organizationId: 'attacker-org',
      studentId: '22222222-2222-4222-8222-222222222222',
    }).success).toBe(false);
  });

  it('rejects invalid time ranges and formats', () => {
    expect(scheduleBody.safeParse({ ...validSchedule, startTime: '11:00', endTime: '10:00' }).success).toBe(false);
    expect(scheduleBody.safeParse({ ...validSchedule, startTime: '9 AM' }).success).toBe(false);
  });

  it('requires at least one update field', () => {
    expect(scheduleUpdateBody.safeParse({}).success).toBe(false);
    expect(scheduleUpdateBody.safeParse({ room: 'B-101' }).success).toBe(true);
  });

  it('accepts opaque service ids while rejecting blank ids', () => {
    expect(scheduleIdParams.safeParse({ id: validSchedule.courseId }).success).toBe(true);
    expect(scheduleIdParams.safeParse({ id: 'legacy_schedule_1' }).success).toBe(true);
    expect(scheduleIdParams.safeParse({ id: '   ' }).success).toBe(false);
  });
});
