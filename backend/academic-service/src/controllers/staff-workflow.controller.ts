import { Request, Response } from 'express';
import { AppError, EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from '../services/event-outbox.service';

import { prisma } from '../lib/prisma';
const org = (req: Request) => req.organizationId!;
const studentSelect = { select: { id: true, firstName: true, lastName: true, email: true } } as const;
const STAFF_ROLES = ['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'];

const resolveStaffRecipientIds = async (organizationId: string) => {
  const staff = await prisma.user.findMany({
    where: { organizationId, deletedAt: null, role: { in: STAFF_ROLES as any } },
    select: { id: true },
    take: 500,
  });
  return staff.map(u => u.id);
};

// Parents may only see requests for children they have an approved guardian
// link to; students only their own. Staff/admin see everything (optionally
// filtered by studentId).
const applyRequesterScope = async (req: Request, where: any) => {
  const { userId, role } = req.user!;
  if (role === 'STUDENT') {
    where.studentId = userId;
    return;
  }
  if (role === 'PARENT') {
    const guardians = await prisma.guardian.findMany({
      where: { organizationId: org(req), parentUserId: userId, status: 'APPROVED' },
      select: { studentUserId: true },
    });
    const allowedStudentIds = guardians.map(g => g.studentUserId);
    const requestedStudentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    if (requestedStudentId && !allowedStudentIds.includes(requestedStudentId)) {
      where.studentId = '__none__';
      return;
    }
    where.studentId = requestedStudentId || { in: allowedStudentIds.length ? allowedStudentIds : ['__none__'] };
    return;
  }
  if (typeof req.query.studentId === 'string') where.studentId = req.query.studentId;
};

// Document Request endpoints
export const listDocumentRequests = async (req: Request, res: Response) => {
  const { status } = req.query;

  const where: any = { organizationId: org(req) };
  await applyRequesterScope(req, where);
  if (status) where.status = status as string;

  const requests = await prisma.documentRequest.findMany({
    where,
    include: { student: studentSelect, history: true },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  });
  return res.json({ success: true, data: requests });
};

export const getDocumentRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  const request = await prisma.documentRequest.findUnique({
    where: { id },
    include: { student: studentSelect, history: true },
  });

  if (!request || request.organizationId !== org(req)) {
    throw AppError.notFound('Document request not found');
  }

  // Students can only access their own requests
  if (userRole === 'STUDENT' && request.studentId !== userId) {
    throw AppError.forbidden('Access denied');
  }
  if (userRole === 'PARENT') {
    const link = await prisma.guardian.findFirst({
      where: { organizationId: org(req), parentUserId: userId, studentUserId: request.studentId, status: 'APPROVED' },
    });
    if (!link) throw AppError.forbidden('Access denied');
  }

  return res.json({ success: true, data: request });
};

export const createDocumentRequest = async (req: Request, res: Response) => {
  const { title, description, documentType, fileUrl, fileName, fileSize, mimeType } = req.body;
  const organizationId = org(req);
  const recipientIds = await resolveStaffRecipientIds(organizationId);

  const request = await prisma.$transaction(async tx => {
    const created = await tx.documentRequest.create({
      data: {
        organizationId,
        studentId: req.user!.userId,
        title,
        description,
        documentType,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      },
      include: { student: studentSelect },
    });
    await tx.documentRequestHistory.create({
      data: {
        organizationId,
        requestId: created.id,
        changedBy: req.user!.userId,
        newStatus: 'PENDING',
        note: 'Request created',
      },
    });
    await enqueueAcademicEvent(tx, EVENTS.DOCUMENT_REQUEST_CREATED, organizationId, {
      requestId: created.id,
      title: created.title,
      documentType: created.documentType,
      studentId: created.studentId,
      studentName: `${created.student.firstName} ${created.student.lastName}`.trim(),
      recipientIds,
    });
    return created;
  });

  return res.status(201).json({ success: true, data: request });
};

export const updateDocumentRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, fileUrl, fileName, fileSize, mimeType } = req.body;

  const existing = await prisma.documentRequest.findFirst({
    where: { id, organizationId: org(req) },
  });

  if (!existing) throw AppError.notFound('Document request not found');

  // Students can only update their own pending requests
  if (req.user?.role === 'STUDENT') {
    if (existing.studentId !== req.user.userId) {
      throw AppError.forbidden('Access denied');
    }
    if (existing.status !== 'PENDING') {
      throw AppError.badRequest('Cannot update non-pending requests');
    }
  }

  const request = await prisma.documentRequest.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(fileName !== undefined && { fileName }),
      ...(fileSize !== undefined && { fileSize }),
      ...(mimeType !== undefined && { mimeType }),
    },
    include: { student: studentSelect },
  });

  return res.json({ success: true, data: request });
};

export const updateDocumentRequestStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const organizationId = org(req);

  const existing = await prisma.documentRequest.findFirst({
    where: { id, organizationId },
  });

  if (!existing) throw AppError.notFound('Document request not found');

  const updated = await prisma.$transaction(async tx => {
    const saved = await tx.documentRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
      include: { student: studentSelect },
    });
    await tx.documentRequestHistory.create({
      data: {
        organizationId,
        requestId: id,
        changedBy: req.user!.userId,
        previousStatus: existing.status,
        newStatus: status,
        note: rejectionReason || `Status changed to ${status}`,
      },
    });
    await enqueueAcademicEvent(tx, EVENTS.DOCUMENT_REQUEST_STATUS_UPDATED, organizationId, {
      requestId: id,
      status,
      rejectionReason: rejectionReason || null,
      studentId: existing.studentId,
      recipientIds: [existing.studentId],
    });
    return saved;
  });

  return res.json({ success: true, data: updated });
};

export const cancelDocumentRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.documentRequest.findFirst({
    where: { id, organizationId: org(req) },
  });

  if (!existing) throw AppError.notFound('Document request not found');

  if (existing.studentId !== req.user!.userId) {
    throw AppError.forbidden('Access denied');
  }

  if (existing.status !== 'PENDING') {
    throw AppError.badRequest('Can only cancel pending requests');
  }

  const updated = await prisma.documentRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: { student: studentSelect },
  });

  // Create history entry
  await prisma.documentRequestHistory.create({
    data: {
      organizationId: org(req),
      requestId: id,
      changedBy: req.user!.userId,
      previousStatus: existing.status,
      newStatus: 'CANCELLED',
      note: 'Request cancelled by student',
    },
  });

  return res.json({ success: true, data: updated });
};

// Scholarship Request endpoints
export const listScholarshipRequests = async (req: Request, res: Response) => {
  const { status } = req.query;

  const where: any = { organizationId: org(req) };
  await applyRequesterScope(req, where);
  if (status) where.status = status as string;

  const requests = await prisma.scholarshipRequest.findMany({
    where,
    include: { student: studentSelect, history: true },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  });
  return res.json({ success: true, data: requests });
};

export const getScholarshipRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  const request = await prisma.scholarshipRequest.findUnique({
    where: { id },
    include: { student: studentSelect, history: true },
  });

  if (!request || request.organizationId !== org(req)) {
    throw AppError.notFound('Scholarship request not found');
  }

  // Students can only access their own requests
  if (userRole === 'STUDENT' && request.studentId !== userId) {
    throw AppError.forbidden('Access denied');
  }
  if (userRole === 'PARENT') {
    const link = await prisma.guardian.findFirst({
      where: { organizationId: org(req), parentUserId: userId, studentUserId: request.studentId, status: 'APPROVED' },
    });
    if (!link) throw AppError.forbidden('Access denied');
  }

  return res.json({ success: true, data: request });
};

export const createScholarshipRequest = async (req: Request, res: Response) => {
  const { program, applicationData } = req.body;
  const organizationId = org(req);
  const recipientIds = await resolveStaffRecipientIds(organizationId);

  const request = await prisma.$transaction(async tx => {
    const created = await tx.scholarshipRequest.create({
      data: {
        organizationId,
        studentId: req.user!.userId,
        program,
        applicationData: applicationData || {},
      },
      include: { student: studentSelect },
    });
    await tx.scholarshipRequestHistory.create({
      data: {
        organizationId,
        requestId: created.id,
        changedBy: req.user!.userId,
        newStatus: 'NEW',
        note: 'Application submitted',
      },
    });
    await enqueueAcademicEvent(tx, EVENTS.SCHOLARSHIP_REQUEST_CREATED, organizationId, {
      requestId: created.id,
      program: created.program,
      studentId: created.studentId,
      studentName: `${created.student.firstName} ${created.student.lastName}`.trim(),
      recipientIds,
    });
    return created;
  });

  return res.status(201).json({ success: true, data: request });
};

export const updateScholarshipRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { applicationData } = req.body;

  const existing = await prisma.scholarshipRequest.findFirst({
    where: { id, organizationId: org(req) },
  });

  if (!existing) throw AppError.notFound('Scholarship request not found');

  // Students can only update their own NEW or UNDER_REVIEW requests
  if (req.user?.role === 'STUDENT') {
    if (existing.studentId !== req.user.userId) {
      throw AppError.forbidden('Access denied');
    }
    if (existing.status !== 'NEW' && existing.status !== 'UNDER_REVIEW') {
      throw AppError.badRequest('Cannot update requests in this status');
    }
  }

  const request = await prisma.scholarshipRequest.update({
    where: { id },
    data: {
      ...(applicationData !== undefined && { applicationData }),
    },
    include: { student: studentSelect },
  });

  return res.json({ success: true, data: request });
};

export const updateScholarshipRequestStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const organizationId = org(req);

  const existing = await prisma.scholarshipRequest.findFirst({
    where: { id, organizationId },
  });

  if (!existing) throw AppError.notFound('Scholarship request not found');

  const updated = await prisma.$transaction(async tx => {
    const saved = await tx.scholarshipRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
      include: { student: studentSelect },
    });
    await tx.scholarshipRequestHistory.create({
      data: {
        organizationId,
        requestId: id,
        changedBy: req.user!.userId,
        previousStatus: existing.status,
        newStatus: status,
        note: rejectionReason || `Status changed to ${status}`,
      },
    });
    await enqueueAcademicEvent(tx, EVENTS.SCHOLARSHIP_REQUEST_STATUS_UPDATED, organizationId, {
      requestId: id,
      status,
      rejectionReason: rejectionReason || null,
      studentId: existing.studentId,
      recipientIds: [existing.studentId],
    });
    return saved;
  });

  return res.json({ success: true, data: updated });
};

export const cancelScholarshipRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.scholarshipRequest.findFirst({
    where: { id, organizationId: org(req) },
  });

  if (!existing) throw AppError.notFound('Scholarship request not found');

  if (existing.studentId !== req.user!.userId) {
    throw AppError.forbidden('Access denied');
  }

  if (existing.status !== 'NEW' && existing.status !== 'UNDER_REVIEW') {
    throw AppError.badRequest('Can only cancel new or under review requests');
  }

  const updated = await prisma.scholarshipRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: { student: studentSelect },
  });

  // Create history entry
  await prisma.scholarshipRequestHistory.create({
    data: {
      organizationId: org(req),
      requestId: id,
      changedBy: req.user!.userId,
      previousStatus: existing.status,
      newStatus: 'CANCELLED',
      note: 'Application cancelled by student',
    },
  });

  return res.json({ success: true, data: updated });
};
