import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';

export const provisionOrganization = async (req: Request, res: Response) => {
  const organization = await prisma.organization.create({
    data: { ...req.body, organizationId: req.body.id },
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
