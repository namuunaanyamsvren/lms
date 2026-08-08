import { Prisma } from '@prisma/client-academic';
import { AppError, EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from './event-outbox.service';
import { serializeCsv } from './attendance-csv.service';
import { getOrganizationAttendancePolicy } from './organization-attendance-policy.service';

import { prisma } from '../lib/prisma';

export type Actor = { userId: string; role: string };
const isAdmin = (role: string) => ['ORG_ADMIN', 'SUPER_ADMIN'].includes(role);
const isStaffLike = (role: string) => ['ORG_ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(role);
const editableCourseWhere = (actor: Actor) =>
  isAdmin(actor.role) ? {} : { OR: [{ instructorId: actor.userId }, { instructors: { some: { userId: actor.userId } } }] };

/**
 * Resolves who should be notified for an ABSENT/LATE record, and whether the
 * student has crossed the organization's configured unexcused-absence
 * threshold for their current term (or the trailing 90 days if the cohort
 * has no term). Returns empty/false for any other status so callers can
 * unconditionally merge the result into an outbox payload.
 */
export const computeNotificationPayload = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  cohortId: string,
  studentId: string,
  status: string,
  absenceThreshold: number,
): Promise<{
  recipientIds: string[]; thresholdCrossed: boolean; absenceCount: number; threshold: number;
  instructorId: string | null; managerIds: string[];
}> => {
  if (status !== 'ABSENT' && status !== 'LATE') {
    return { recipientIds: [], thresholdCrossed: false, absenceCount: 0, threshold: absenceThreshold, instructorId: null, managerIds: [] };
  }
  const guardians = await tx.guardian.findMany({
    where: { organizationId, studentUserId: studentId, status: 'APPROVED' },
    select: { parentUserId: true, permissions: true },
  });
  const recipientIds = guardians
    .filter(guardian => guardian.permissions.includes('VIEW_ATTENDANCE'))
    .map(guardian => guardian.parentUserId);

  const cohort = await tx.cohort.findUnique({
    where: { id: cohortId },
    select: { term: { select: { startDate: true } }, course: { select: { instructorId: true } } },
  });
  const windowStart = cohort?.term?.startDate ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const absenceCount = await tx.attendance.count({
    where: { organizationId, studentId, status: 'ABSENT', date: { gte: windowStart } },
  });
  const thresholdCrossed = absenceCount >= absenceThreshold;
  // Notification-service has no DB access to academic-service's schema, so the
  // instructor/manager ids have to travel in the event payload — only resolved
  // when actually needed (the alert-recipient list) to avoid unnecessary
  // joins/queries on every ordinary ABSENT/LATE record.
  const managerIds = thresholdCrossed
    ? (await tx.user.findMany({
        where: { organizationId, role: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: { id: true },
      })).map(u => u.id)
    : [];
  return {
    recipientIds,
    thresholdCrossed,
    absenceCount,
    threshold: absenceThreshold,
    instructorId: thresholdCrossed ? cohort?.course.instructorId ?? null : null,
    managerIds,
  };
};

const ensureCourseAccess = async (organizationId: string, actor: Actor, courseId: string) => {
  const course = await prisma.course.findFirst({ where: { id: courseId, organizationId, ...editableCourseWhere(actor) } });
  if (!course) throw AppError.notFound('Course not found');
  return course;
};

const ensureCohortAccess = async (organizationId: string, actor: Actor, cohortId: string) => {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, organizationId, course: editableCourseWhere(actor) },
  });
  if (!cohort) throw AppError.notFound('Cohort not found');
  return cohort;
};

export type BatchRecord = { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; note?: string };

export const recordBatch = async (
  organizationId: string,
  actor: Actor,
  input: { cohortId: string; date: string; records: BatchRecord[] },
) => {
  await ensureCohortAccess(organizationId, actor, input.cohortId);
  const date = new Date(input.date);
  const { absenceThreshold } = await getOrganizationAttendancePolicy(organizationId);

  const enrolledStudentIds = new Set(
    (await prisma.enrollment.findMany({ where: { organizationId, cohortId: input.cohortId }, select: { userId: true } }))
      .map(e => e.userId),
  );
  const unknownStudents = input.records.filter(r => !enrolledStudentIds.has(r.studentId));
  if (unknownStudents.length) {
    throw AppError.badRequest(`Students not enrolled in this cohort: ${unknownStudents.map(r => r.studentId).join(', ')}`);
  }

  const results = await prisma.$transaction(async tx => {
    const rows: Awaited<ReturnType<typeof tx.attendance.upsert>>[] = [];
    for (const record of input.records) {
      const existing = await tx.attendance.findUnique({
        where: { organizationId_cohortId_studentId_date: { organizationId, cohortId: input.cohortId, studentId: record.studentId, date } },
      });
      const row = await tx.attendance.upsert({
        where: { organizationId_cohortId_studentId_date: { organizationId, cohortId: input.cohortId, studentId: record.studentId, date } },
        create: { organizationId, cohortId: input.cohortId, studentId: record.studentId, date, status: record.status, note: record.note },
        update: { status: record.status, note: record.note },
      });
      if (existing && existing.status !== row.status) {
        await tx.attendanceHistory.create({
          data: {
            organizationId, attendanceId: row.id, changedByUserId: actor.userId,
            previousStatus: existing.status, newStatus: row.status,
          },
        });
      }
      const notify = await computeNotificationPayload(tx, organizationId, input.cohortId, record.studentId, row.status, absenceThreshold);
      await enqueueAcademicEvent(tx, existing ? EVENTS.ATTENDANCE_UPDATED : EVENTS.ATTENDANCE_RECORDED, organizationId, {
        attendanceId: row.id, cohortId: row.cohortId, studentId: row.studentId, status: row.status,
        date: row.date.toISOString(), changeId: row.updatedAt.toISOString(), ...notify,
      });
      rows.push(row);
    }
    return rows;
  });

  return results;
};

export const getHistory = async (organizationId: string, actor: Actor, attendanceId: string) => {
  const attendance = await prisma.attendance.findFirst({ where: { id: attendanceId, organizationId }, include: { cohort: true } });
  if (!attendance) throw AppError.notFound('Attendance record not found');
  if (actor.role === 'STUDENT') {
    if (attendance.studentId !== actor.userId) throw AppError.forbidden('Not your attendance record');
  } else if (!isAdmin(actor.role) && !['PRINCIPAL', 'STAFF'].includes(actor.role)) {
    await ensureCourseAccess(organizationId, actor, attendance.cohort.courseId);
  }
  return prisma.attendanceHistory.findMany({ where: { organizationId, attendanceId }, orderBy: { changedAt: 'desc' } });
};

export const exportCsv = async (
  organizationId: string,
  actor: Actor,
  query: { cohortId?: string; from?: Date; to?: Date },
) => {
  if (!isStaffLike(actor.role) && actor.role !== 'INSTRUCTOR') throw AppError.forbidden('Not authorized');
  const where: Prisma.AttendanceWhereInput = {
    organizationId,
    ...(query.cohortId ? { cohortId: query.cohortId } : {}),
    ...(actor.role === 'INSTRUCTOR' ? { cohort: { course: editableCourseWhere(actor) } } : {}),
    ...(query.from || query.to ? { date: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
  };
  const records = await prisma.attendance.findMany({ where, include: { student: true }, orderBy: { date: 'desc' } });
  return serializeCsv(records.map(r => ({
    studentEmail: r.student.email,
    date: r.date.toISOString().slice(0, 10),
    status: r.status,
    note: r.note || '',
  })));
};
