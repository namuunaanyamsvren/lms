import { z } from 'zod';

export const resourceParams = z.object({ resource: z.enum([
  'years', 'terms', 'departments', 'programs', 'grade-levels', 'subjects',
  'credit-policies', 'campuses', 'buildings', 'rooms', 'holidays',
]) }).strict();
export const resourceIdParams = resourceParams.extend({ id: z.string().uuid() }).strict();
export const listQuery = z.object({ parentId: z.string().uuid().optional() }).strict();
const code = z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9._-]+$/);
const named = { name: z.string().trim().min(1).max(200) };
export const payload = z.union([
  z.object({ ...named, startDate: z.coerce.date(), endDate: z.coerce.date(), status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED']).default('PLANNED') }).strict(),
  z.object({ ...named, code, academicYearId: z.string().uuid(), startDate: z.coerce.date(), endDate: z.coerce.date(), status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED']).default('PLANNED') }).strict(),
  z.object({ ...named, code, description: z.string().trim().max(2000).optional().nullable() }).strict(),
  z.object({ ...named, code, departmentId: z.string().uuid(), degreeType: z.string().trim().max(100).optional().nullable(), requiredCredits: z.number().nonnegative().optional().nullable() }).strict(),
  z.object({ ...named, code, order: z.number().int().min(0).max(1000) }).strict(),
  z.object({ ...named, contactHoursPerCredit: z.number().positive().max(1000), minCredits: z.number().nonnegative().optional().nullable(), maxCredits: z.number().nonnegative().optional().nullable(), isDefault: z.boolean().default(false) }).strict(),
  z.object({ ...named, code, address: z.string().trim().max(500).optional().nullable() }).strict(),
  z.object({ ...named, code, campusId: z.string().uuid() }).strict(),
  z.object({ ...named, code, buildingId: z.string().uuid(), capacity: z.number().int().positive().optional().nullable(), type: z.string().trim().max(100).optional().nullable() }).strict(),
  z.object({ ...named, termId: z.string().uuid().optional().nullable(), startDate: z.coerce.date(), endDate: z.coerce.date(), isTeachingDay: z.boolean().default(false) }).strict(),
]);
const forbiddenUpdateKeys = new Set(['id', 'organizationId', 'createdAt', 'updatedAt']);
export const updatePayload = z.record(z.unknown())
  .refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' })
  .refine(value => Object.keys(value).every(key => !forbiddenUpdateKeys.has(key)), { message: 'Protected fields cannot be updated' });
export const rolloverParams = z.object({ id: z.string().uuid() }).strict();
export const rolloverBody = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  codePrefix: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9._-]+$/),
  cloneSchedules: z.boolean().default(true),
}).strict();
