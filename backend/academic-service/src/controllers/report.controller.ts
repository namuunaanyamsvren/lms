import { Request, Response } from 'express';
import { AppError, getPagination, paginatedData } from '@lms/shared';
import { catalogFor, computeReport } from '../services/report-data.service';
import { renderCsv, renderPdf } from '../services/report-storage.service';
import { recordAuditLog } from '../services/audit.service';

import { prisma } from '../lib/prisma';
const org = (req: Request) => req.organizationId!;
const actorFrom = (req: Request) => ({ userId: req.user!.userId, role: req.user!.role });

export const getReportCatalog = async (req: Request, res: Response) => {
  return res.json({ success: true, data: catalogFor(req.user!.role) });
};

const filtersFrom = (req: Request) => ({
  from: typeof req.query.from === 'string' ? req.query.from : undefined,
  to: typeof req.query.to === 'string' ? req.query.to : undefined,
  courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
  cohortId: typeof req.query.cohortId === 'string' ? req.query.cohortId : undefined,
});

export const getReportData = async (req: Request, res: Response) => {
  const table = await computeReport(org(req), actorFrom(req), req.params.type, filtersFrom(req));
  return res.json({ success: true, data: table });
};

export const exportReport = async (req: Request, res: Response) => {
  const format = req.query.format === 'pdf' ? 'PDF' : 'CSV';
  const table = await computeReport(org(req), actorFrom(req), req.params.type, filtersFrom(req));
  const generatedAt = new Date();
  const filename = `${req.params.type.toLowerCase()}-${generatedAt.toISOString().slice(0, 10)}.${format === 'PDF' ? 'pdf' : 'csv'}`;

  await recordAuditLog(prisma, {
    organizationId: org(req),
    userId: req.user!.userId,
    action: 'REPORT_EXPORTED',
    entity: req.params.type,
    details: JSON.stringify({ format, filters: filtersFrom(req) }),
  });

  if (format === 'PDF') {
    const buffer = await renderPdf(req.params.type, generatedAt, table);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
  const csv = renderCsv(table);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
};

export const createReportJob = async (req: Request, res: Response) => {
  if (!catalogFor(req.user!.role).some(e => e.type === req.params.type)) {
    throw AppError.forbidden('Энэ тайланг харах эрхгүй байна');
  }
  const job = await prisma.reportJob.create({
    data: {
      organizationId: org(req),
      requestedById: req.user!.userId,
      reportType: req.params.type as any,
      format: (req.body.format || 'CSV') as any,
      filters: req.body.filters || {},
    },
  });
  return res.status(201).json({ success: true, data: job });
};

export const listReportJobs = async (req: Request, res: Response) => {
  const pagination = getPagination(req, { defaultLimit: 20, maxLimit: 100 });
  const where = { organizationId: org(req), requestedById: req.user!.userId };
  const [jobs, total] = await Promise.all([
    prisma.reportJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.reportJob.count({ where }),
  ]);
  return res.json({ success: true, data: jobs, pagination: paginatedData(jobs, total, pagination) });
};

export const getReportJobDownload = async (req: Request, res: Response) => {
  const job = await prisma.reportJob.findFirst({ where: { id: req.params.id, organizationId: org(req), requestedById: req.user!.userId } });
  if (!job) throw AppError.notFound('Тайлангийн ажил олдсонгүй');
  if (job.status !== 'COMPLETED' || !job.fileAssetId) throw AppError.badRequest('Тайлан бэлэн болоогүй байна');
  const asset = await prisma.fileAsset.findUnique({ where: { id: job.fileAssetId } });
  if (!asset) throw AppError.notFound('Файл олдсонгүй');
  return res.json({ success: true, data: { storageKey: asset.storageKey, fileName: asset.originalName } });
};

export const createReportSchedule = async (req: Request, res: Response) => {
  if (!catalogFor(req.user!.role).some(e => e.type === req.body.reportType)) {
    throw AppError.forbidden('Энэ тайланг харах эрхгүй байна');
  }
  const schedule = await prisma.reportSchedule.create({
    data: {
      organizationId: org(req),
      userId: req.user!.userId,
      reportType: req.body.reportType,
      format: req.body.format || 'CSV',
      frequency: req.body.frequency,
      filters: req.body.filters || {},
    },
  });
  return res.status(201).json({ success: true, data: schedule });
};

export const listReportSchedules = async (req: Request, res: Response) => {
  const pagination = getPagination(req, { defaultLimit: 20, maxLimit: 100 });
  const where = { organizationId: org(req), userId: req.user!.userId };
  const [schedules, total] = await Promise.all([
    prisma.reportSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.reportSchedule.count({ where }),
  ]);
  return res.json({ success: true, data: schedules, pagination: paginatedData(schedules, total, pagination) });
};

export const updateReportSchedule = async (req: Request, res: Response) => {
  const existing = await prisma.reportSchedule.findFirst({ where: { id: req.params.id, organizationId: org(req), userId: req.user!.userId } });
  if (!existing) throw AppError.notFound('Тохиргоо олдсонгүй');
  const updated = await prisma.reportSchedule.update({
    where: { id: existing.id },
    data: { isActive: req.body.isActive !== undefined ? req.body.isActive : existing.isActive },
  });
  return res.json({ success: true, data: updated });
};

export const deleteReportSchedule = async (req: Request, res: Response) => {
  const existing = await prisma.reportSchedule.findFirst({ where: { id: req.params.id, organizationId: org(req), userId: req.user!.userId } });
  if (!existing) throw AppError.notFound('Тохиргоо олдсонгүй');
  await prisma.reportSchedule.delete({ where: { id: existing.id } });
  return res.status(204).send();
};
