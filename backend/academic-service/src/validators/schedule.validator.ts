import { z } from 'zod';

const entityId = z.string().trim().min(1).max(200);

export const scheduleIdParams = z.object({
  id: entityId,
}).strict();

export const scheduleQuery = z.object({
  courseId: entityId.optional(),
  semester: z.string().trim().min(1).max(100).optional(),
  termId: entityId.optional(),
  teacherId: entityId.optional(),
  studentId: entityId.optional(),
}).strict();

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format');

const scheduleFields = z.object({
  courseId: entityId,
  title: z.string().trim().min(1).max(200),
  dayOfWeek: z.enum([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ]),
  startTime: time,
  endTime: time,
  room: z.string().trim().max(100).optional(),
  semester: z.string().trim().min(1).max(100).optional(),
  termId: entityId.optional(),
  roomId: entityId.optional(),
}).strict();

export const scheduleBody = scheduleFields
  .refine(value => value.startTime < value.endTime, { message: 'endTime must be later than startTime', path: ['endTime'] })
  .refine(value => value.termId || value.semester, { message: 'termId is required', path: ['termId'] });

export const scheduleUpdateBody = scheduleFields.partial()
  .refine(value => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .refine(value => !value.startTime || !value.endTime || value.startTime < value.endTime, {
    message: 'endTime must be later than startTime',
    path: ['endTime'],
  });

export type ScheduleInput = z.infer<typeof scheduleBody>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateBody>;
