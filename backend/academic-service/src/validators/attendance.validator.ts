import { z } from 'zod';

const entityId = z.string().trim().min(1).max(100);

export const listQuery = z.object({
  cohortId: entityId.optional(),
  studentId: entityId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
}).strict();

export const batchBody = z.object({
  cohortId: entityId,
  date: z.coerce.date(),
  records: z.array(z.object({
    studentId: entityId,
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    note: z.string().trim().max(2000).optional(),
  }).strict()).min(1).max(500),
}).strict();

export const attendanceIdParams = z.object({ id: entityId }).strict();

export const exportQuery = z.object({
  cohortId: entityId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict();
