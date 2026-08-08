import { Prisma } from '@prisma/client-academic';
import { AppError, EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from './event-outbox.service';
import { ScheduleInput, ScheduleUpdateInput } from '../validators/schedule.validator';

import { prisma } from '../lib/prisma';
const WRITE_ROLES = ['INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'];
const READ_ALL_ROLES = ['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'];

type Actor = {
  userId: string;
  role: string;
  organizationId: string;
};

type ScheduleFilters = {
  courseId?: string;
  semester?: string;
  termId?: string;
  teacherId?: string;
  studentId?: string;
};

export const SCHEDULE_TIMEZONE = 'Asia/Ulaanbaatar';

const includeRelations = {
  course: { select: { id: true, title: true, department: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
  term: { select: { id: true, code: true, name: true, startDate: true, endDate: true } },
  roomRelation: { include: { building: { include: { campus: true } } } },
} satisfies Prisma.ScheduleInclude;

async function readableWhere(
  actor: Actor,
  requestedStudentId?: string,
): Promise<Prisma.ScheduleWhereInput> {
  const where: Prisma.ScheduleWhereInput = {
    organizationId: actor.organizationId,
    course: { deletedAt: null },
  };

  if (READ_ALL_ROLES.includes(actor.role)) return where;
  if (actor.role === 'INSTRUCTOR') return { ...where, teacherId: actor.userId };
  if (actor.role === 'STUDENT') {
    if (requestedStudentId && requestedStudentId !== actor.userId) {
      throw AppError.forbidden('Students can only view their own schedule');
    }
    return {
      ...where,
      course: {
        deletedAt: null,
        cohorts: { some: { enrollments: { some: { userId: actor.userId } } } },
      },
    };
  }
  if (actor.role === 'PARENT') {
    const links = await prisma.guardian.findMany({
      where: { organizationId: actor.organizationId, parentUserId: actor.userId },
      select: { studentUserId: true },
    });
    const studentIds = links.map((link) => link.studentUserId);
    if (studentIds.length === 0) return { ...where, id: { in: [] } };
    if (requestedStudentId && !studentIds.includes(requestedStudentId)) {
      throw AppError.forbidden('This child is not linked to your account');
    }
    const visibleStudentIds = requestedStudentId ? [requestedStudentId] : studentIds;
    return {
      ...where,
      course: {
        deletedAt: null,
        cohorts: { some: { enrollments: { some: { userId: { in: visibleStudentIds } } } } },
      },
    };
  }

  throw AppError.forbidden('You cannot view course schedules');
}

async function resolveCourse(actor: Actor, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, instructorId: true },
  });
  if (!course) throw AppError.notFound('Course not found');
  if (actor.role === 'INSTRUCTOR' && course.instructorId !== actor.userId) {
    throw AppError.forbidden('Teachers can only manage schedules for courses they teach');
  }
  return course;
}

async function assertWritable(actor: Actor, scheduleId?: string) {
  if (!WRITE_ROLES.includes(actor.role)) {
    throw AppError.forbidden('Only teachers, admins, and principals can manage schedules');
  }
  if (!scheduleId) return;
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, organizationId: actor.organizationId },
  });
  if (!schedule) throw AppError.notFound('Schedule not found');
  if (actor.role === 'INSTRUCTOR' && schedule.teacherId !== actor.userId) {
    throw AppError.forbidden('Teachers can only manage their own course schedules');
  }
  return schedule;
}

function handleConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw AppError.conflict('A schedule already exists for this course, day, time, and semester');
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
    throw AppError.conflict('Schedule changed concurrently. Please review and try again');
  }
  throw error;
}

export const timesOverlap = (
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) => firstStart < secondEnd && firstEnd > secondStart;

type ScheduleConflictInput = {
  organizationId: string;
  dayOfWeek: ScheduleInput['dayOfWeek'];
  semester: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  roomId?: string | null;
  room?: string | null;
  excludeId?: string;
};

async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  input: ScheduleConflictInput,
) {
  const roomMatch = input.roomId
    ? { roomId: input.roomId }
    : input.room
      ? { roomId: null, room: input.room }
      : null;
  const conflicts = await tx.schedule.findMany({
    where: {
      organizationId: input.organizationId,
      dayOfWeek: input.dayOfWeek,
      semester: input.semester,
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        { teacherId: input.teacherId },
        ...(roomMatch ? [roomMatch] : []),
      ],
    },
    select: {
      id: true,
      title: true,
      teacherId: true,
      roomId: true,
      room: true,
      startTime: true,
      endTime: true,
    },
  });
  const teacherConflict = conflicts.find(row => row.teacherId === input.teacherId);
  if (teacherConflict) {
    throw AppError.conflict(
      `Teacher already has "${teacherConflict.title}" at ${teacherConflict.startTime}-${teacherConflict.endTime}`,
    );
  }
  const roomConflict = conflicts[0];
  if (roomConflict) {
    throw AppError.conflict(
      `Room already has "${roomConflict.title}" at ${roomConflict.startTime}-${roomConflict.endTime}`,
    );
  }
}

async function recipientIdsForCourse(
  tx: Prisma.TransactionClient,
  organizationId: string,
  courseId: string,
) {
  const enrollments = await tx.enrollment.findMany({
    where: { organizationId, cohort: { courseId, organizationId } },
    select: {
      userId: true,
      user: {
        select: {
          guardianAsStudent: {
            select: { parentUserId: true },
          },
        },
      },
    },
  });
  return [...new Set(enrollments.flatMap(enrollment => [
    enrollment.userId,
    ...enrollment.user.guardianAsStudent.map(link => link.parentUserId),
  ]))];
}

const scheduleEventPayload = (
  schedule: {
    id: string;
    courseId: string;
    termId: string | null;
    title: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string | null;
    updatedAt: Date;
  },
  recipientIds: string[],
) => ({
  scheduleId: schedule.id,
  courseId: schedule.courseId,
  termId: schedule.termId,
  title: schedule.title,
  dayOfWeek: schedule.dayOfWeek,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  room: schedule.room,
  timezone: SCHEDULE_TIMEZONE,
  recipientIds,
  changeId: schedule.updatedAt.toISOString(),
});

export async function listSchedules(actor: Actor, filters: ScheduleFilters = {}) {
  const access = await readableWhere(actor, filters.studentId);
  return prisma.schedule.findMany({
    where: {
      AND: [
        access,
        filters.courseId ? { courseId: filters.courseId } : {},
        filters.semester ? { semester: filters.semester } : {},
        filters.termId ? { termId: filters.termId } : {},
        filters.teacherId ? { teacherId: filters.teacherId } : {},
      ],
    },
    include: includeRelations,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

export async function getSchedule(actor: Actor, id: string) {
  const access = await readableWhere(actor);
  const schedule = await prisma.schedule.findFirst({
    where: { AND: [{ id }, access] },
    include: includeRelations,
  });
  if (!schedule) throw AppError.notFound('Schedule not found');
  return schedule;
}

export async function getScheduleOptions(actor: Actor) {
  const courseWhere: Prisma.CourseWhereInput = {
    organizationId: actor.organizationId,
    deletedAt: null,
  };
  if (actor.role === 'INSTRUCTOR') courseWhere.instructorId = actor.userId;
  else if (actor.role === 'STUDENT') {
    courseWhere.cohorts = { some: { enrollments: { some: { userId: actor.userId } } } };
  } else if (actor.role === 'PARENT') {
    const childIds = await prisma.guardian.findMany({
      where: { organizationId: actor.organizationId, parentUserId: actor.userId },
      select: { studentUserId: true },
    });
    courseWhere.cohorts = {
      some: { enrollments: { some: { userId: { in: childIds.map(x => x.studentUserId) } } } },
    };
  } else if (!READ_ALL_ROLES.includes(actor.role)) {
    throw AppError.forbidden('You cannot view schedule options');
  }

  const [courses, terms, rooms, teachers, children] = await Promise.all([
    prisma.course.findMany({
      where: courseWhere,
      select: { id: true, code: true, title: true, instructorId: true },
      orderBy: { title: 'asc' },
    }),
    prisma.academicTerm.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, code: true, name: true, startDate: true, endDate: true, status: true },
      orderBy: { startDate: 'desc' },
    }),
    WRITE_ROLES.includes(actor.role)
      ? prisma.room.findMany({
          where: { organizationId: actor.organizationId },
          include: { building: { include: { campus: true } } },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    READ_ALL_ROLES.includes(actor.role)
      ? prisma.user.findMany({
          where: {
            organizationId: actor.organizationId,
            role: 'INSTRUCTOR',
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, firstName: true, lastName: true, email: true },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        })
      : Promise.resolve([]),
    actor.role === 'PARENT'
      ? prisma.guardian.findMany({
          where: { organizationId: actor.organizationId, parentUserId: actor.userId },
          select: {
            studentUser: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { studentUser: { firstName: 'asc' } },
        })
      : Promise.resolve([]),
  ]);

  return {
    timezone: SCHEDULE_TIMEZONE,
    courses,
    terms,
    rooms,
    teachers,
    children: children.map(link => link.studentUser),
  };
}

export async function createSchedule(actor: Actor, input: ScheduleInput) {
  await assertWritable(actor);
  const course = await resolveCourse(actor, input.courseId);
  const term = input.termId
    ? await prisma.academicTerm.findFirst({
        where: { id: input.termId, organizationId: actor.organizationId },
      })
    : null;
  if (input.termId && !term) throw AppError.badRequest('Term does not exist in this organization');
  const room = input.roomId
    ? await prisma.room.findFirst({
        where: { id: input.roomId, organizationId: actor.organizationId },
      })
    : null;
  if (input.roomId && !room) throw AppError.badRequest('Room does not exist in this organization');
  try {
    return await prisma.$transaction(async (tx) => {
      const semester = term?.code || input.semester!;
      const roomName = room?.name || input.room || null;
      await assertNoOverlap(tx, {
        organizationId: actor.organizationId,
        dayOfWeek: input.dayOfWeek,
        semester,
        startTime: input.startTime,
        endTime: input.endTime,
        teacherId: course.instructorId,
        roomId: input.roomId,
        room: roomName,
      });
      const schedule = await tx.schedule.create({
        data: {
          ...input,
          semester,
          room: roomName,
          organizationId: actor.organizationId,
          teacherId: course.instructorId,
        },
        include: includeRelations,
      });
      const recipientIds = await recipientIdsForCourse(tx, actor.organizationId, schedule.courseId);
      await enqueueAcademicEvent(tx, EVENTS.SCHEDULE_CREATED, actor.organizationId, {
        ...scheduleEventPayload(schedule, recipientIds),
      });
      return schedule;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    handleConflict(error);
  }
}

export async function updateSchedule(actor: Actor, id: string, input: ScheduleUpdateInput) {
  const existing = await assertWritable(actor, id);
  const course = await resolveCourse(actor, input.courseId || existing!.courseId);
  const startTime = input.startTime || existing!.startTime;
  const endTime = input.endTime || existing!.endTime;
  if (startTime >= endTime) throw AppError.badRequest('endTime must be later than startTime');
  const term = input.termId
    ? await prisma.academicTerm.findFirst({
        where: { id: input.termId, organizationId: actor.organizationId },
      })
    : null;
  if (input.termId && !term) throw AppError.badRequest('Term does not exist in this organization');
  const room = input.roomId
    ? await prisma.room.findFirst({
        where: { id: input.roomId, organizationId: actor.organizationId },
      })
    : null;
  if (input.roomId && !room) throw AppError.badRequest('Room does not exist in this organization');

  try {
    return await prisma.$transaction(async (tx) => {
      const semester = term?.code || input.semester || existing!.semester;
      const roomId = input.roomId !== undefined ? input.roomId : existing!.roomId;
      const roomName = room
        ? room.name
        : input.room !== undefined
          ? input.room || null
          : existing!.room;
      await assertNoOverlap(tx, {
        organizationId: actor.organizationId,
        dayOfWeek: input.dayOfWeek || existing!.dayOfWeek,
        semester,
        startTime,
        endTime,
        teacherId: course.instructorId,
        roomId,
        room: roomName,
        excludeId: id,
      });
      const schedule = await tx.schedule.update({
        where: { id },
        data: {
          ...input,
          semester,
          ...(room
            ? { room: room.name }
            : input.room !== undefined
              ? { room: input.room || null }
              : {}),
          teacherId: course.instructorId,
        },
        include: includeRelations,
      });
      const recipientIds = [...new Set([
        ...await recipientIdsForCourse(tx, actor.organizationId, existing!.courseId),
        ...await recipientIdsForCourse(tx, actor.organizationId, schedule.courseId),
      ])];
      await enqueueAcademicEvent(tx, EVENTS.SCHEDULE_UPDATED, actor.organizationId, {
        ...scheduleEventPayload(schedule, recipientIds),
      });
      return schedule;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    handleConflict(error);
  }
}

export async function deleteSchedule(actor: Actor, id: string) {
  const existing = await assertWritable(actor, id);
  await prisma.$transaction(async (tx) => {
    const recipientIds = await recipientIdsForCourse(tx, actor.organizationId, existing!.courseId);
    await tx.schedule.delete({ where: { id } });
    await enqueueAcademicEvent(tx, EVENTS.SCHEDULE_DELETED, actor.organizationId, {
      ...scheduleEventPayload(
        { ...existing!, updatedAt: new Date() },
        recipientIds,
      ),
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
