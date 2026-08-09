import { z } from 'zod';

const entityId = z.string().trim().min(1).max(100);

export const idParams = z.object({ id: entityId }).strict();
export const versionParams = z.object({ id: entityId, version: z.coerce.number().int().positive() }).strict();
export const versionCompareQuery = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
}).strict();
export const moduleParams = z.object({ moduleId: entityId }).strict();
export const lessonParams = z.object({ lessonId: entityId }).strict();
export const instructorParams = z.object({ id: entityId, userId: entityId }).strict();
export const courseListQuery = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  departmentId: z.string().trim().max(100).optional(),
  programId: z.string().trim().max(100).optional(),
  level: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
}).strict();
export const courseBody = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9._-]+$/),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional().nullable(),
  credits: z.number().finite().min(0).max(100).default(0),
  level: z.string().trim().max(100).optional().nullable(),
  durationWeeks: z.number().int().positive().max(520).optional().nullable(),
  price: z.number().finite().nonnegative().max(1_000_000_000).default(0),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default('MNT'),
  capacity: z.number().int().positive().max(100000).optional().nullable(),
  departmentId: z.string().trim().max(100).optional().nullable(),
  programId: z.string().trim().max(100).optional().nullable(),
  subjectId: entityId.optional().nullable(),
  prerequisiteText: z.string().trim().max(2000).optional().nullable(),
  prerequisiteIds: z.array(entityId).max(50).default([]),
  coverImageUrl: z.string().url().max(2000).optional().nullable(),
  instructorId: entityId,
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  completionRule: z.enum(['ALL_LESSONS', 'PERCENTAGE']).default('ALL_LESSONS'),
  completionPercentage: z.number().int().min(1).max(100).default(100),
}).strict();
export const courseUpdateBody = courseBody.partial().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const duplicateBody = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9._-]+$/),
  title: z.string().trim().min(1).max(200).optional(),
}).strict();
export const orderBody = z.object({ ids: z.array(entityId).min(1).max(500) }).strict();
export const moduleBody = z.object({ title: z.string().trim().min(1).max(200) }).strict();
export const attachment = z.object({
  name: z.string().trim().min(1).max(255),
  fileUrl: z.string().url().max(2000),
  mimeType: z.string().trim().max(150).optional(),
  size: z.number().int().nonnegative().max(1024 * 1024 * 1024).optional(),
}).strict();
export const lessonBody = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100000).optional().nullable(),
  contentType: z.enum(['RICH_TEXT', 'VIDEO', 'EXTERNAL_LINK']).default('RICH_TEXT'),
  videoUrl: z.string().url().max(2000).optional().nullable(),
  externalUrl: z.string().url().max(2000).optional().nullable(),
  unlockRule: z.enum(['SCHEDULED', 'SEQUENTIAL', 'MANUAL']).default('SCHEDULED'),
  releaseAt: z.coerce.date().optional().nullable(),
  attachments: z.array(attachment).max(20).default([]),
}).strict();
export const lessonUpdateBody = lessonBody.partial().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
