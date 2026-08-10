import { Request, Response } from 'express';
import { AppError } from '@lms/shared';

import { prisma } from '../lib/prisma';

export const provisionOrganization = async (req: Request, res: Response) => {
  const requestedId = String(req.body.id || '');
  const requestedSlug = String(req.body.slug || '');
  const data = {
    organizationId: requestedId,
    name: req.body.name,
    slug: requestedSlug,
    domain: req.body.domain,
    logoUrl: req.body.logoUrl,
    deletedAt: null,
  };

  const existingById = await prisma.organization.findUnique({ where: { id: requestedId } });
  if (existingById) {
    if (existingById.slug !== requestedSlug) {
      const slugConflict = await prisma.organization.findUnique({ where: { slug: requestedSlug } });
      if (slugConflict && slugConflict.id !== requestedId) {
        throw AppError.conflict('Organization slug is already provisioned');
      }
    }
    const organization = await prisma.organization.update({
      where: { id: requestedId },
      data,
    });
    return res.status(201).json({ success: true, data: organization });
  }

  const existingBySlug = await prisma.organization.findUnique({ where: { slug: requestedSlug } });
  if (existingBySlug) {
    if (!existingBySlug.deletedAt) {
      throw AppError.conflict('Organization slug is already provisioned');
    }
    const organization = await prisma.organization.update({
      where: { id: existingBySlug.id },
      data: { id: requestedId, ...data },
    });
    return res.status(201).json({ success: true, data: organization });
  }

  const organization = await prisma.organization.create({
    data: { id: requestedId, ...data },
  });
  return res.status(201).json({ success: true, data: organization });
};

export const removeProvisionedOrganization = async (req: Request, res: Response) => {
  const organizationId = req.params.id;
  const deletedAt = new Date();
  const users = await prisma.user.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true },
  });
  await prisma.$transaction(async tx => {
    await tx.course.updateMany({
      where: { organizationId, deletedAt: null },
      data: { deletedAt, status: 'ARCHIVED', archivedAt: deletedAt },
    });
    for (const user of users) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${user.id}@invalid.local`,
          username: null,
          phone: null,
          firstName: 'Deleted',
          lastName: 'User',
          passwordHash: null,
          isActive: false,
          deletedAt,
        },
      });
    }
    await tx.organization.updateMany({
      where: { id: organizationId, deletedAt: null },
      data: { deletedAt },
    });
  });
  return res.status(204).send();
};
