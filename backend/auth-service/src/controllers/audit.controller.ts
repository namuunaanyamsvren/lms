import { Request, Response } from 'express';
import { maskIp } from '@lms/shared';
import { sanitizeAuthAuditMetadata } from '../services/auth-audit.service';
import { AuthAuditEventType } from '@prisma/client-auth';
import { AppError } from '@lms/shared';
import { z } from 'zod';

import { prisma } from '../lib/prisma';

export const getOrganizationAuthAuditEvents = async (
  req: Request,
  res: Response,
) => {
  const query = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
    format: z.enum(['json', 'csv']).optional().default('json'),
    after: z.string().datetime().optional(),
    before: z.string().datetime().optional(),
    eventType: z.nativeEnum(AuthAuditEventType).optional(),
  }).strict().safeParse(req.query);
  if (!query.success) throw AppError.badRequest('Invalid audit export query', query.error.flatten());
  const { limit, format, after, before, eventType } = query.data;
  const events = await prisma.authAuditEvent.findMany({
    where: {
      organizationId: req.organizationId!,
      ...(eventType ? { eventType } : {}),
      ...(after || before ? {
        createdAt: {
          ...(after ? { gte: new Date(after) } : {}),
          ...(before ? { lte: new Date(before) } : {}),
        },
      } : {}),
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      eventType: true,
      ipAddress: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const sanitized = events.map(event => ({
      ...event,
      ipAddress: maskIp(event.ipAddress || undefined) || null,
      metadata:
        event.metadata &&
        typeof event.metadata === 'object' &&
        !Array.isArray(event.metadata)
          ? sanitizeAuthAuditMetadata(event.metadata as Record<string, unknown>)
          : {},
    }));
  res.setHeader('Cache-Control', 'no-store');
  if (format === 'csv') {
    const csvCell = (value: unknown) => {
      let stringValue = value == null
        ? ''
        : typeof value === 'string'
          ? value
          : JSON.stringify(value);
      if (/^[=+\-@]/.test(stringValue)) stringValue = `'${stringValue}`;
      return `"${stringValue.replace(/"/g, '""')}"`;
    };
    const columns = [
      'id',
      'userId',
      'organizationId',
      'eventType',
      'ipAddress',
      'userAgent',
      'metadata',
      'createdAt',
    ] as const;
    const csv = [
      columns.join(','),
      ...sanitized.map(event => columns.map(column => csvCell(event[column])).join(',')),
    ].join('\r\n');
    res.type('text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="auth-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(csv);
  }
  return res.json({ success: true, data: sanitized });
};
