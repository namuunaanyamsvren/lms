import { z } from 'zod';

export const registerSchema = z.object({
  organizationId: z.string().default('org_main'),
  email: z.string().email('Хүчинтэй имэйл хаяг оруулна уу'),
  username: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(1, 'Нууц үг оруулна уу').max(128, 'Нууц үг хэт урт байна'),
  firstName: z.string().min(1, 'Нэр оруулна уу'),
  lastName: z.string().min(1, 'Овог оруулна уу'),
  // Privileged roles are provisioned by onboarding/admin flows, never by a
  // public self-registration request.
  role: z.enum(['USER', 'PARENT', 'user', 'parent']).default('USER'),
  invitationCode:z.string().min(8).max(100).optional(),
});

export const loginSchema = z.object({
  organizationId: z.string().default('org_main'),
  identifier: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(1, 'Нууц үг оруулна уу'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken шаардлагатай'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken шаардлагатай'),
});

export const forgotPasswordSchema = z.object({
  organizationId: z.string().default('org_main'),
  email: z.string().email('Хүчинтэй имэйл хаяг оруулна уу'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token шаардлагатай'),
  newPassword: z.string().min(1, 'Нууц үг оруулна уу').max(128, 'Нууц үг хэт урт байна'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Одоогийн нууц үг оруулна уу').max(128),
  newPassword: z.string().min(1, 'Шинэ нууц үг оруулна уу').max(128, 'Нууц үг хэт урт байна'),
});

export const sendVerificationSchema = z.object({
  type: z.enum(['EMAIL', 'PHONE']).default('EMAIL'),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'token шаардлагатай'),
});

export const verifyPhoneSchema = z.object({
  otp: z.string().regex(/^\d{6,8}$/, 'Баталгаажуулах кодын формат буруу байна.'),
});
