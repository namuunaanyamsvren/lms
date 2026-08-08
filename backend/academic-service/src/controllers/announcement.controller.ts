import { Request, Response } from 'express';
import { AppError, EVENTS, getPagination, paginatedData } from '@lms/shared';
import { enqueueAcademicEvent } from '../services/event-outbox.service';

import { prisma } from '../lib/prisma';

const ANNOUNCEMENT_MANAGER_ROLES = ['INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'];

const resolveAnnouncementRecipientIds = async (
  organizationId: string,
  targetRoles: string[],
  targetUserIds: string[],
) => {
  if (targetUserIds.length > 0) return [...new Set(targetUserIds)];
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(targetRoles.length > 0 ? { role: { in: targetRoles as any } } : {}),
    },
    select: { id: true },
    take: 2000,
  });
  return users.map(u => u.id);
};

export const listAnnouncements = async (req: Request, res: Response) => {
  const { status, priority } = req.query;
  const userRole = req.user?.role;
  const userId = req.user?.userId;
  const pagination = getPagination(req, { defaultLimit: 20, maxLimit: 100 });

  const where: any = { organizationId: req.organizationId! };
  const isManager = ANNOUNCEMENT_MANAGER_ROLES.includes(userRole as string);

  // Non-managers (students/parents/finance/etc.) only ever see published
  // announcements — draft/scheduled ones are only visible to the staff who
  // manage them.
  if (status) {
    where.status = isManager ? status : (status === 'PUBLISHED' ? 'PUBLISHED' : '__none__');
  } else if (!isManager) {
    where.status = 'PUBLISHED';
  }
  if (priority) where.priority = priority;

  // Filter by audience - show only announcements targeting user's role or specific user
  where.OR = [
    { targetRoles: { isEmpty: true } }, // Public announcements
    { targetRoles: { has: userRole } },
    { targetUserIds: { has: userId } },
  ];

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        attachments: true,
        _count: { select: { readReceipts: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.announcement.count({ where }),
  ]);

  const readReceipts = await prisma.announcementReadReceipt.findMany({
    where: {
      organizationId: req.organizationId!,
      userId: userId!,
      announcementId: { in: announcements.map(announcement => announcement.id) },
    },
    select: { announcementId: true },
  });
  const readIds = new Set(readReceipts.map(receipt => receipt.announcementId));
  const announcementsWithReadStatus = announcements.map(announcement => ({
    ...announcement,
    isRead: readIds.has(announcement.id),
  }));

  return res.json({
    success: true,
    data: announcementsWithReadStatus,
    pagination: paginatedData(announcementsWithReadStatus, total, pagination),
  });
};

export const getAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { 
      author: { select: { id: true, firstName: true, lastName: true, role: true } },
      attachments: true,
      readReceipts: true
    },
  });

  if (!announcement || announcement.organizationId !== req.organizationId) {
    throw AppError.notFound('Announcement not found');
  }

  // Check if user has access
  const userRole = req.user?.role;
  const isManager = ANNOUNCEMENT_MANAGER_ROLES.includes(userRole as string);
  const hasAccess =
    isManager ||
    (announcement.status === 'PUBLISHED' && (
      announcement.targetRoles.length === 0 ||
      announcement.targetRoles.includes(userRole as any) ||
      announcement.targetUserIds.includes(userId!)
    ));

  if (!hasAccess) {
    throw AppError.forbidden('Access denied');
  }

  // Mark as read
  await prisma.announcementReadReceipt.upsert({
    where: {
      organizationId_announcementId_userId: {
        organizationId: req.organizationId!,
        announcementId: announcement.id,
        userId: userId!,
      }
    },
    create: {
      organizationId: req.organizationId!,
      announcementId: announcement.id,
      userId: userId!,
      readAt: new Date(),
    },
    update: {},
  });

  return res.json({ success: true, data: { ...announcement, isRead: true } });
};

export const createAnnouncement = async (req: Request, res: Response) => {
  const { title, body, priority = 'NORMAL', scheduledAt, targetRoles = [], targetUserIds = [] } = req.body;

  const status = scheduledAt ? 'SCHEDULED' : 'DRAFT';

  const announcement = await prisma.announcement.create({
    data: {
      organizationId: req.organizationId!,
      title,
      body,
      authorId: req.user!.userId,
      status,
      priority,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      targetRoles,
      targetUserIds,
    },
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  return res.status(201).json({ success: true, data: announcement });
};

export const updateAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, body, priority, scheduledAt, targetRoles, targetUserIds, status } = req.body;

  const existing = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existing || existing.organizationId !== req.organizationId) {
    throw AppError.notFound('Announcement not found');
  }

  // Cannot modify published announcements
  if (existing.status === 'PUBLISHED') {
    throw AppError.badRequest('Cannot modify published announcements');
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(body !== undefined && { body }),
      ...(priority !== undefined && { priority }),
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
      ...(targetRoles !== undefined && { targetRoles }),
      ...(targetUserIds !== undefined && { targetUserIds }),
      ...(status !== undefined && { status }),
    },
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  return res.json({ success: true, data: announcement });
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existing || existing.organizationId !== req.organizationId) {
    throw AppError.notFound('Announcement not found');
  }

  await prisma.announcement.delete({
    where: { id },
  });

  return res.json({ success: true, message: 'Announcement deleted' });
};

export const publishAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existing || existing.organizationId !== req.organizationId) {
    throw AppError.notFound('Announcement not found');
  }

  if (existing.status === 'PUBLISHED') {
    throw AppError.badRequest('Announcement already published');
  }

  const recipientIds = await resolveAnnouncementRecipientIds(
    req.organizationId!,
    existing.targetRoles,
    existing.targetUserIds,
  );

  const announcement = await prisma.$transaction(async tx => {
    const updated = await tx.announcement.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    await enqueueAcademicEvent(tx, EVENTS.ANNOUNCEMENT_PUBLISHED, req.organizationId!, {
      announcementId: updated.id,
      title: updated.title,
      priority: updated.priority,
      recipientIds,
    });
    return updated;
  });

  return res.json({ success: true, data: announcement });
};

export const archiveAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existing || existing.organizationId !== req.organizationId) {
    throw AppError.notFound('Announcement not found');
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
  });

  return res.json({ success: true, data: announcement });
};

export const addAttachment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { fileName, fileUrl, fileSize, mimeType } = req.body;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!announcement || announcement.organizationId !== req.organizationId) {
    throw AppError.notFound('Announcement not found');
  }

  const attachment = await prisma.announcementAttachment.create({
    data: {
      organizationId: req.organizationId!,
      announcementId: id,
      fileName,
      fileUrl,
      fileSize,
      mimeType,
    },
  });

  return res.status(201).json({ success: true, data: attachment });
};

export const removeAttachment = async (req: Request, res: Response) => {
  const { id, attachmentId } = req.params;

  const attachment = await prisma.announcementAttachment.findUnique({
    where: { id: attachmentId },
    include: { announcement: true },
  });

  if (!attachment || attachment.announcement.organizationId !== req.organizationId) {
    throw AppError.notFound('Attachment not found');
  }

  await prisma.announcementAttachment.delete({
    where: { id: attachmentId },
  });

  return res.json({ success: true, message: 'Attachment removed' });
};
