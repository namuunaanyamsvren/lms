import { Request, Response } from 'express';
import { AppError } from '@lms/shared';

import { prisma } from '../lib/prisma';
const org = (req: Request) => req.organizationId!;

export const GUARDIAN_PERMISSIONS = ['VIEW_SCHEDULE', 'VIEW_GRADES', 'VIEW_ATTENDANCE'] as const;

const guardianSelect = {
  id: true,
  organizationId: true,
  parentUserId: true,
  studentUserId: true,
  relationship: true,
  status: true,
  permissions: true,
  invitedById: true,
  invitedAt: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
  parentUser: { select: { id: true, firstName: true, lastName: true, email: true } },
  studentUser: { select: { id: true, firstName: true, lastName: true, email: true, studentId: true } },
} as const;

export const listGuardianLinks = async (req: Request, res: Response) => {
  const { role, userId } = req.user!;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where: any = { organizationId: org(req), ...(status ? { status } : {}) };
  if (role === 'PARENT') {
    where.parentUserId = userId;
  } else if (!['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'].includes(role)) {
    throw AppError.forbidden('You are not allowed to view guardian links');
  }
  const data = await prisma.guardian.findMany({
    where,
    select: guardianSelect,
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ success: true, data });
};

export const createGuardianLink = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const parentUserId = req.user!.userId;
  const studentCode = String(req.body.studentCode || req.body.studentIdentifier || '').trim();
  const guardianLinkCode = String(req.body.guardianLinkCode || '').trim();
  if (!studentCode) throw AppError.badRequest('studentCode is required');

  const student = await prisma.user.findFirst({
    where: {
      organizationId,
      role: 'STUDENT',
      deletedAt: null,
      studentId: studentCode,
    },
    select: { id: true, guardianLinkCode: true },
  });
  if (!student) throw AppError.notFound('Student/link code not found');
  if (guardianLinkCode && student.guardianLinkCode !== guardianLinkCode) {
    throw AppError.notFound('Student/link code not found');
  }

  const existing = await prisma.guardian.findUnique({
    where: {
      organizationId_parentUserId_studentUserId: {
        organizationId,
        parentUserId,
        studentUserId: student.id,
      },
    },
  });
  if (existing) {
    if (guardianLinkCode && existing.status === 'PENDING') {
      const approved = await prisma.guardian.update({
        where: { id: existing.id },
        data: { status: 'APPROVED', respondedAt: new Date() },
        select: guardianSelect,
      });
      return res.json({ success: true, data: approved });
    }
    throw AppError.conflict('A guardian link already exists for this student');
  }

  const link = await prisma.guardian.create({
    data: {
      organizationId,
      parentUserId,
      studentUserId: student.id,
      status: guardianLinkCode ? 'APPROVED' : 'PENDING',
      invitedById: parentUserId,
      respondedAt: guardianLinkCode ? new Date() : null,
    },
    select: guardianSelect,
  });
  return res.status(201).json({ success: true, data: link });
};

const findGuardianLink = async (req: Request) => {
  const link = await prisma.guardian.findFirst({
    where: { id: req.params.id, organizationId: org(req) },
  });
  if (!link) throw AppError.notFound('Guardian link not found');
  return link;
};

export const respondToGuardianLink = async (req: Request, res: Response) => {
  const link = await findGuardianLink(req);
  const status = req.body.status;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw AppError.badRequest('status must be APPROVED or REJECTED');
  }
  const updated = await prisma.guardian.update({
    where: { id: link.id },
    data: { status, respondedAt: new Date() },
    select: guardianSelect,
  });
  return res.json({ success: true, data: updated });
};

export const updateGuardianLink = async (req: Request, res: Response) => {
  const link = await findGuardianLink(req);
  const data: Record<string, unknown> = {};
  if (req.body.relationship) data.relationship = req.body.relationship;
  if (req.body.permissions) {
    const invalid = (req.body.permissions as string[]).filter(
      p => !GUARDIAN_PERMISSIONS.includes(p as typeof GUARDIAN_PERMISSIONS[number]),
    );
    if (invalid.length) throw AppError.badRequest(`Unknown permissions: ${invalid.join(', ')}`);
    data.permissions = req.body.permissions;
  }
  const updated = await prisma.guardian.update({
    where: { id: link.id },
    data,
    select: guardianSelect,
  });
  return res.json({ success: true, data: updated });
};

export const revokeGuardianLink = async (req: Request, res: Response) => {
  const link = await findGuardianLink(req);
  const { role, userId } = req.user!;
  const isElevated = ['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'].includes(role);
  if (!isElevated && link.parentUserId !== userId) {
    throw AppError.forbidden('You are not allowed to revoke this guardian link');
  }
  await prisma.guardian.update({ where: { id: link.id }, data: { status: 'REVOKED' } });
  return res.status(204).send();
};
