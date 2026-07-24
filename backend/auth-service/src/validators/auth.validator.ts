import { z } from 'zod';

export const registerSchema = z.object({
  organizationId: z.string().default('org_main'),
  email: z.string().email('Хүчинтэй имэйл хаяг оруулна уу'),
  username: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'),
  firstName: z.string().min(1, 'Нэр оруулна уу'),
  lastName: z.string().min(1, 'Овог оруулна уу'),
  role: z.enum([
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'INSTRUCTOR',
    'STUDENT',
    'PARENT',
    'STAFF',
    'PRINCIPAL',
    'teacher',
    'student',
    'admin',
    'parent',
    'staff',
    'principal',
  ]).default('STUDENT'),
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
  newPassword: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой'),
});

export const sendVerificationSchema = z.object({
  type: z.enum(['EMAIL', 'PHONE']).default('EMAIL'),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'token шаардлагатай'),
});
