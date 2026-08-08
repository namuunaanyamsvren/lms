import { z } from 'zod';

export const managedRole = z.enum([
  'USER',
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'PRINCIPAL',
  'STAFF',
  'FINANCE',
  'INSTRUCTOR',
  'STUDENT',
  'PARENT',
]);

export const userStatus = z.enum([
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
]);

const optionalIdentifier = z.string().trim().min(1).max(100).nullable().optional();
const timezone = z.string().trim().min(3).max(100).refine(value => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Invalid IANA timezone');

export const notificationPreferenceSchema = z.object({
  email: z.boolean().optional(),
  inApp: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
}).strict();

export const managedUserFields = z.object({
  email: z.string().trim().email().max(320),
  username: optionalIdentifier,
  phone: z.string().trim().min(4).max(30).nullable().optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: managedRole,
  studentId: optionalIdentifier,
  employeeId: optionalIdentifier,
  profileImageKey: z.string().trim().min(3).max(1000).nullable().optional(),
  language: z.enum(['mn', 'en']).optional().default('mn'),
  timezone: timezone.optional().default('Asia/Ulaanbaatar'),
  notificationPreferences: notificationPreferenceSchema.optional().default({}),
}).strict();

export const createUserSchema = managedUserFields.extend({
  sendInvite: z.boolean().optional().default(true),
  password: z.string().min(12).max(128).optional(),
}).strict().superRefine((value, context) => {
  if (!value.sendInvite && !value.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['password'],
      message: 'password is required when sendInvite is false',
    });
  }
});

export const updateUserSchema = managedUserFields.partial().strict()
  .refine(value => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
}).strict();

export const userListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: managedRole.optional(),
  status: userStatus.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'role', 'status'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
}).strict();

export const userIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(200),
}).strict();

export const importUsersSchema = z.object({
  rows: z.array(managedUserFields).min(1).max(1000),
  sendInvites: z.boolean().optional().default(true),
}).strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ManagedUserInput = z.infer<typeof managedUserFields>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
