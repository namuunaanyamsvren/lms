import { EVENTS } from '@lms/shared';
import { computeReport } from './report-data.service';
import { renderCsv, renderPdf, storeReportFile } from './report-storage.service';
import { recordAuditLog } from './audit.service';
import { enqueueAcademicEvent } from './event-outbox.service';

import { prisma } from '../lib/prisma';

const FREQUENCY_MS: Record<string, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

const generateAndStore = async (job: { id: string; organizationId: string; requestedById: string; reportType: string; format: string; filters: unknown }) => {
  const requester = await prisma.user.findUnique({ where: { id: job.requestedById }, select: { role: true } });
  const table = await computeReport(job.organizationId, { userId: job.requestedById, role: requester?.role || 'STAFF' }, job.reportType, (job.filters as Record<string, string>) || {});
  const generatedAt = new Date();
  const isPdf = job.format === 'PDF';
  const buffer = isPdf ? await renderPdf(job.reportType, generatedAt, table) : Buffer.from(renderCsv(table), 'utf-8');
  const filename = `${job.reportType.toLowerCase()}-${generatedAt.toISOString().slice(0, 10)}.${isPdf ? 'pdf' : 'csv'}`;
  const asset = await storeReportFile(job.organizationId, job.requestedById, filename, buffer, isPdf ? 'application/pdf' : 'text/csv');
  return asset;
};

export async function processDueReportJobs(limit = 5) {
  const pending = await prisma.reportJob.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: limit });
  let processed = 0;
  for (const job of pending) {
    await prisma.reportJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
    try {
      const asset = await generateAndStore(job);
      await prisma.$transaction(async tx => {
        await tx.reportJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', fileAssetId: asset.id, completedAt: new Date() } });
        await recordAuditLog(tx, {
          organizationId: job.organizationId,
          userId: job.requestedById,
          action: 'REPORT_GENERATED',
          entity: job.reportType,
          entityId: job.id,
          details: JSON.stringify({ format: job.format }),
        });
        await enqueueAcademicEvent(tx, EVENTS.REPORT_READY, job.organizationId, {
          reportJobId: job.id,
          reportType: job.reportType,
          recipientIds: [job.requestedById],
        });
      });
      processed += 1;
    } catch (error: any) {
      await prisma.reportJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: String(error?.message || error).slice(0, 1000) } });
    }
  }
  return processed;
}

export async function processDueReportSchedules(limit = 20) {
  const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true }, take: limit });
  const now = Date.now();
  let enqueued = 0;
  for (const schedule of schedules) {
    const intervalMs = FREQUENCY_MS[schedule.frequency] || FREQUENCY_MS.WEEKLY;
    const due = !schedule.lastRunAt || now - schedule.lastRunAt.getTime() >= intervalMs;
    if (!due) continue;
    await prisma.$transaction([
      prisma.reportJob.create({
        data: {
          organizationId: schedule.organizationId,
          requestedById: schedule.userId,
          reportType: schedule.reportType,
          format: schedule.format,
          filters: schedule.filters as any,
          reportScheduleId: schedule.id,
        },
      }),
      prisma.reportSchedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date() } }),
    ]);
    enqueued += 1;
  }
  return enqueued;
}

let jobTimer: NodeJS.Timeout | undefined;
let scheduleTimer: NodeJS.Timeout | undefined;

export const startReportProcessing = () => {
  jobTimer = setInterval(() => {
    processDueReportJobs().catch(error => console.error('[Reports] job processing failed', error));
  }, 60_000);
  jobTimer.unref();
  scheduleTimer = setInterval(() => {
    processDueReportSchedules().catch(error => console.error('[Reports] schedule check failed', error));
  }, 5 * 60_000);
  scheduleTimer.unref();
  void processDueReportJobs();
  void processDueReportSchedules();
};
