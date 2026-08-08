import { z } from 'zod';

const entityId = z.string().trim().min(1).max(200);

export const consentFormIdParams = z.object({
  id: entityId,
}).strict();

export const consentFormListQuery = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
}).strict();

export const consentFormBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  requiresSignature: z.boolean().optional(),
  dueAt: z.string().datetime().optional(),
}).strict();

export const consentFormUpdateBody = consentFormBody.partial()
  .refine(value => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const acknowledgeConsentBody = z.object({
  studentUserId: entityId,
  status: z.enum(['ACKNOWLEDGED', 'DECLINED']),
  signatureName: z.string().trim().min(1).max(200).optional(),
}).strict();

export type ConsentFormInput = z.infer<typeof consentFormBody>;
export type ConsentFormUpdateInput = z.infer<typeof consentFormUpdateBody>;
export type AcknowledgeConsentInput = z.infer<typeof acknowledgeConsentBody>;
