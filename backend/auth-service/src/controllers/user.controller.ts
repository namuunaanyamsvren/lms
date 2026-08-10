import crypto from 'crypto';
import { Request, Response } from 'express';
import { AppError } from '@lms/shared';
import { Prisma } from '@prisma/client-auth';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import {
  enqueueUserCreated,
  enqueueUserDeactivated,
  enqueueGuardianInviteRequested,
  enqueueUserInvited,
  enqueueUserUpdated,
} from '../services/auth-outbox.service';
import {
  createPasswordResetToken,
  getPasswordResetExpiresInMs,
  hashPasswordResetToken,
} from '../services/password-reset.service';
import { parseCsv, serializeCsv, USER_CSV_COLUMNS } from '../services/user-csv.service';

import { prisma } from '../lib/prisma';
const safeUserSelect = {
  id: true,
  organizationId: true,
  username: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  isActive: true,
  studentId: true,
  guardianLinkCode: true,
  employeeId: true,
  profileImageKey: true,
  language: true,
  timezone: true,
  notificationPreferences: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

const roleEnum = z.enum([
  'USER',
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'PRINCIPAL',
  'STAFF',
  'INSTRUCTOR',
  'STUDENT',
  'PARENT',
  'FINANCE',
]);
const statusEnum = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']);

const listUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: roleEnum.optional(),
  status: statusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.enum(['createdAt_asc', 'createdAt_desc', 'name_asc', 'name_desc']).default('createdAt_desc'),
});

const buildUserListWhere = (organizationId: string, query: z.infer<typeof listUsersQuerySchema>): Prisma.UserAccountWhereInput => ({
  organizationId,
  deletedAt: null,
  ...(query.role ? { role: query.role } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.search
    ? {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { username: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { studentId: { contains: query.search, mode: 'insensitive' } },
          { employeeId: { contains: query.search, mode: 'insensitive' } },
        ],
      }
    : {}),
});

const sortToOrderBy: Record<string, Prisma.UserAccountOrderByWithRelationInput> = {
  createdAt_asc: { createdAt: 'asc' },
  createdAt_desc: { createdAt: 'desc' },
  name_asc: { firstName: 'asc' },
  name_desc: { firstName: 'desc' },
};

export const getUsers = async (req: Request, res: Response) => {
  const query = listUsersQuerySchema.parse(req.query);
  const where = buildUserListWhere(req.organizationId!, query);
  const [items, total] = await Promise.all([
    prisma.userAccount.findMany({
      where,
      select: safeUserSelect,
      orderBy: sortToOrderBy[query.sort],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.userAccount.count({ where }),
  ]);
  return res.json({
    success: true,
    data: items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  });
};

export const getUserById = async (req: Request, res: Response) => {
  const user = await prisma.userAccount.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
    select: safeUserSelect,
  });
  if (!user) throw AppError.notFound('User not found');
  return res.json({ success: true, data: user });
};

export const getMyMemberships = async (req: Request, res: Response) => {
  const data = await prisma.organizationMembership.findMany({
    where: { userId: req.user!.userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ success: true, data });
};

const updateUserSchema = z
  .object({
    username: z.string().trim().min(2).max(50).nullable().optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(4).max(30).nullable().optional(),
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    role: roleEnum.optional(),
    status: statusEnum.optional(),
    isActive: z.boolean().optional(),
    studentId: z.string().trim().max(50).nullable().optional(),
    guardianLinkCode: z.string().trim().max(50).nullable().optional(),
    employeeId: z.string().trim().max(50).nullable().optional(),
  })
  .strict();

export const updateUser = async (req: Request, res: Response) => {
  const body = updateUserSchema.parse(req.body);
  const existing = await prisma.userAccount.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('User not found');
  const actorRole = req.user!.role;
  const isSelf = existing.id === req.user!.userId;
  if (actorRole !== 'SUPER_ADMIN' && existing.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Only super administrators can modify super administrators');
  }
  if (actorRole !== 'SUPER_ADMIN' && body.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Only super administrators can grant the super administrator role');
  }
  if (isSelf && body.role && body.role !== existing.role) {
    throw AppError.badRequest('You cannot change your own role');
  }
  if (isSelf && (body.isActive === false || body.status === 'SUSPENDED' || body.status === 'DEACTIVATED')) {
    throw AppError.badRequest('You cannot deactivate your own account');
  }

  const data: Prisma.UserAccountUpdateInput = { ...body };
  if (body.status) {
    data.isActive = body.status === 'ACTIVE' || body.status === 'INVITED';
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.userAccount.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(existing.isActive && data.isActive === false
          ? {
              sessions: {
                updateMany: {
                  where: { revokedAt: null },
                  data: { revokedAt: new Date(), revokeReason: 'USER_STATUS_CHANGED' },
                },
              },
            }
          : {}),
      },
    });
    await enqueueUserUpdated(tx, updated);
    if (existing.isActive && !updated.isActive) await enqueueUserDeactivated(tx, updated);
    return updated;
  });
  return res.json({
    success: true,
    data: Object.fromEntries(Object.entries(user).filter(([key]) => key !== 'passwordHash')),
  });
};

export const deactivateUser = async (req: Request, res: Response) => {
  if (req.params.id === req.user!.userId)
    throw AppError.badRequest('You cannot deactivate your own account');
  const existing = await prisma.userAccount.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId!, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('User not found');
  if (req.user!.role !== 'SUPER_ADMIN' && existing.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Only super administrators can deactivate super administrators');
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.userAccount.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        status: 'DEACTIVATED',
        sessions: {
          updateMany: {
            where: { revokedAt: null },
            data: { revokedAt: new Date(), revokeReason: 'USER_DEACTIVATED' },
          },
        },
      },
    });
    if (existing.isActive) await enqueueUserDeactivated(tx, updated);
    return updated;
  });
  return res.json({ success: true, data: { id: user.id, isActive: user.isActive } });
};

const createUserSchema = z
  .object({
    email: z.string().trim().email(),
    username: z.string().trim().min(2).max(50).optional(),
    phone: z.string().trim().min(4).max(30).optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    role: roleEnum,
    studentId: z.string().trim().max(50).optional(),
    guardianLinkCode: z.string().trim().max(50).optional(),
    employeeId: z.string().trim().max(50).optional(),
    language: z.string().trim().max(10).optional(),
    timezone: z.string().trim().max(50).optional(),
  })
  .strict();

const buildSetPasswordUrl = (rawToken: string) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

const buildAuthUrl = (path: string) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendUrl}${path}`;
};

async function createInvitedUser(
  organizationId: string,
  invitedById: string,
  input: z.infer<typeof createUserSchema>,
) {
  if (input.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Cannot invite a super administrator');
  }
  const existing = await prisma.userAccount.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        { email: input.email },
        ...(input.username ? [{ username: input.username }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
        ...(input.studentId ? [{ studentId: input.studentId }] : []),
        ...(input.guardianLinkCode ? [{ guardianLinkCode: input.guardianLinkCode }] : []),
        ...(input.employeeId ? [{ employeeId: input.employeeId }] : []),
      ],
    },
  });
  if (existing) throw AppError.conflict('A user with this email, username, phone or ID already exists');

  const randomPassword = crypto.randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  const rawToken = createPasswordResetToken();

  return prisma.$transaction(async (tx) => {
    const user = await tx.userAccount.create({
      data: {
        organizationId,
        email: input.email,
        username: input.username || null,
        phone: input.phone || null,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        role: input.role,
        status: 'INVITED',
        passwordHash,
        studentId: input.studentId || null,
        guardianLinkCode: input.role === 'STUDENT' ? input.guardianLinkCode || null : null,
        employeeId: input.employeeId || null,
        language: input.language || undefined,
        timezone: input.timezone || undefined,
        invitedAt: new Date(),
        invitedById,
      },
    });
    await tx.passwordResetToken.create({
      data: {
        organizationId,
        userId: user.id,
        tokenHash: hashPasswordResetToken(rawToken),
        expiresAt: new Date(Date.now() + getPasswordResetExpiresInMs()),
      },
    });
    await enqueueUserCreated(tx, user);
    await enqueueUserInvited(tx, user, buildSetPasswordUrl(rawToken));
    return user;
  });
}

export const createUser = async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await createInvitedUser(req.organizationId!, req.user!.userId, input);
  return res.status(201).json({
    success: true,
    data: Object.fromEntries(Object.entries(user).filter(([key]) => key !== 'passwordHash')),
  });
};

const guardianInviteEmailSchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict();

export const sendGuardianInviteEmail = async (req: Request, res: Response) => {
  const input = guardianInviteEmailSchema.parse(req.body);
  const student = await prisma.userAccount.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organizationId!,
      role: 'STUDENT',
      deletedAt: null,
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      studentId: true,
      guardianLinkCode: true,
    },
  });
  if (!student) throw AppError.notFound('Student not found');
  if (!student.guardianLinkCode) throw AppError.badRequest('Эцэг эх холбох код бүртгэгдээгүй байна.');

  const studentName = [student.lastName, student.firstName].filter(Boolean).join(' ') || student.email;
  await prisma.$transaction(async tx => {
    await enqueueGuardianInviteRequested(tx, {
      organizationId: req.organizationId!,
      studentUserId: req.params.id,
      recipientEmail: input.email,
      studentName,
      studentId: student.studentId,
      guardianLinkCode: student.guardianLinkCode!,
      registerUrl: buildAuthUrl('/register'),
      loginUrl: buildAuthUrl('/login'),
    });
  });

  return res.json({ success: true, data: { email: input.email } });
};

const updateMeSchema = z
  .object({
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    phone: z.string().trim().min(4).max(30).nullable().optional(),
    language: z.string().trim().max(10).optional(),
    timezone: z.string().trim().max(50).optional(),
    notificationPreferences: z.record(z.string(), z.unknown()).optional(),
    profileImageKey: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateMe = async (req: Request, res: Response) => {
  const data = updateMeSchema.parse(req.body);
  const existing = await prisma.userAccount.findFirst({
    where: { id: req.user!.userId, organizationId: req.organizationId!, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('User not found');

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.userAccount.update({
      where: { id: existing.id },
      data: data as Prisma.UserAccountUpdateInput,
    });
    await enqueueUserUpdated(tx, updated);
    return updated;
  });
  return res.json({
    success: true,
    data: Object.fromEntries(Object.entries(user).filter(([key]) => key !== 'passwordHash')),
  });
};

export const importUsers = async (req: Request, res: Response) => {
  const { csv } = z.object({ csv: z.string().min(1) }).parse(req.body);
  const rows = parseCsv(csv);
  const errors: Array<{ row: number; message: string }> = [];
  let imported = 0;

  for (const row of rows) {
    const parsed = createUserSchema.safeParse(row.value);
    if (!parsed.success) {
      errors.push({ row: row.rowNumber, message: parsed.error.errors[0]?.message || 'Invalid row' });
      continue;
    }
    try {
      await createInvitedUser(req.organizationId!, req.user!.userId, parsed.data);
      imported += 1;
    } catch (error: any) {
      errors.push({ row: row.rowNumber, message: error?.message || 'Failed to create user' });
    }
  }

  return res.json({ success: true, data: { imported, errors } });
};

export const getUserCsvTemplate = async (_req: Request, res: Response) => {
  const csv = serializeCsv([
    {
      email: 'student@example.com',
      username: '',
      phone: '',
      firstName: 'Бат',
      lastName: 'Болд',
      role: 'STUDENT',
      studentId: '',
      employeeId: '',
      language: 'mn',
      timezone: 'Asia/Ulaanbaatar',
    },
  ], USER_CSV_COLUMNS);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.csv"');
  return res.send(csv);
};

export const exportUsers = async (req: Request, res: Response) => {
  const query = listUsersQuerySchema
    .omit({ page: true, pageSize: true })
    .parse(req.query);
  const where = buildUserListWhere(req.organizationId!, { ...query, page: 1, pageSize: 1 });
  const users = await prisma.userAccount.findMany({
    where,
    orderBy: sortToOrderBy[query.sort],
    select: safeUserSelect,
  });
  const csv = serializeCsv(users, USER_CSV_COLUMNS);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
};
