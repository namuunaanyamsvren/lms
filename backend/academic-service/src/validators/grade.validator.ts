import { z } from 'zod';

export const courseIdParams = z.object({ courseId: z.string().uuid() }).strict();
export const assignmentIdParams = z.object({ assignmentId: z.string().uuid() }).strict();
export const gradeIdParams = z.object({ id: z.string().uuid() }).strict();
export const appealIdParams = z.object({ id: z.string().uuid() }).strict();
// "me" resolves to the authenticated user's own id in the controller.
export const studentIdParams = z.object({ studentId: z.string().min(1).max(100) }).strict();

export const categoryBody = z.object({
  name: z.string().trim().min(1).max(200),
  weightPercent: z.number().min(0).max(100),
  source: z.enum(['MANUAL', 'ATTENDANCE']).default('MANUAL'),
}).strict();
export const categoryUpdateBody = categoryBody.partial()
  .refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const manualGradeBody = z.object({
  courseId: z.string().uuid(),
  studentId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  score: z.number().finite().min(0).max(100),
  feedback: z.string().trim().max(5000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
}).strict();

export const appealBody = z.object({
  reason: z.string().trim().min(1).max(2000),
}).strict();

export const appealResolutionBody = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  resolutionNote: z.string().trim().max(2000).optional(),
}).strict();

export const bulkImportBody = z.object({
  csv: z.string().min(1),
}).strict();
