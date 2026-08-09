import type { Request, Response } from 'express';
import { Role, UserAccountStatus } from '@prisma/client-auth';
import { z } from 'zod';
import { AppError } from '@lms/shared';
import { prisma } from '../lib/prisma';

const membershipBody = z.object({
  userId: z.string().trim().min(1).max(200),
  role: z.nativeEnum(Role).default(Role.STUDENT),
  source: z.string().trim().min(1).max(100).default('STUDENT_ACCESS_REQUEST'),
  approvedById: z.string().trim().min(1).max(200).optional(),
}).strict();

export const upsertOrganizationMembership = async (req: Request, res: Response) => {
  const organizationId = req.params.organizationId;
  const input = membershipBody.parse(req.body);
  const user = await prisma.userAccount.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw AppError.notFound('User account not found');
  const membership = await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId: input.userId } },
    create: {
      organizationId,
      userId: input.userId,
      role: input.role,
      status: UserAccountStatus.ACTIVE,
      source: input.source,
      approvedById: input.approvedById,
      approvedAt: new Date(),
    },
    update: {
      role: input.role,
      status: UserAccountStatus.ACTIVE,
      source: input.source,
      approvedById: input.approvedById,
      approvedAt: new Date(),
    },
  });
  return res.status(201).json({ success: true, data: membership });
};

export const listUserMemberships = async (req: Request, res: Response) => {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: req.params.userId, status: UserAccountStatus.ACTIVE },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ success: true, data: memberships });
};
