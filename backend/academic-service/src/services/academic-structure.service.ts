import { AppError } from '@lms/shared';
import { Prisma } from '@prisma/client-academic';

import { prisma } from '../lib/prisma';
const modelNames: Record<string, string> = {
  years: 'academicYear', terms: 'academicTerm', departments: 'department', programs: 'program',
  'grade-levels': 'gradeLevel', subjects: 'subject', 'credit-policies': 'creditPolicy',
  campuses: 'campus', buildings: 'building', rooms: 'room', holidays: 'holiday',
};
const parentFields: Record<string, string> = {
  terms: 'academicYearId', programs: 'departmentId', buildings: 'campusId', rooms: 'buildingId', holidays: 'termId',
};
const includes: Record<string, object> = {
  years: { terms: { orderBy: { startDate: 'asc' } } },
  departments: { programs: { orderBy: { name: 'asc' } } },
  campuses: { buildings: { include: { rooms: true }, orderBy: { name: 'asc' } } },
  terms: { academicYear: { select: { id: true, name: true } } },
  programs: { department: { select: { id: true, name: true } } },
  buildings: { campus: { select: { id: true, name: true } } },
  rooms: { building: { include: { campus: { select: { id: true, name: true } } } } },
};
const dbModel = (resource: string) => {
  const name = modelNames[resource];
  if (!name) throw AppError.badRequest('Unknown academic structure resource');
  return (prisma as any)[name];
};
const normalizeDates = (data: any) => {
  if (data.startDate && data.endDate && data.startDate >= data.endDate) throw AppError.badRequest('endDate must be later than startDate');
  if (data.minCredits != null && data.maxCredits != null && data.minCredits > data.maxCredits) throw AppError.badRequest('minCredits cannot exceed maxCredits');
};
const handle = (error: any): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw AppError.conflict('Code, name, or order already exists');
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw AppError.badRequest('Referenced parent does not exist');
  throw error;
};

export const overview = async (organizationId: string) => {
  const [years, departments, gradeLevels, subjects, policies, campuses, holidays] = await Promise.all([
    prisma.academicYear.findMany({ where: { organizationId }, include: includes.years, orderBy: { startDate: 'desc' } }),
    prisma.department.findMany({ where: { organizationId }, include: includes.departments, orderBy: { name: 'asc' } }),
    prisma.gradeLevel.findMany({ where: { organizationId }, orderBy: { order: 'asc' } }),
    prisma.subject.findMany({ where: { organizationId }, orderBy: { code: 'asc' } }),
    prisma.creditPolicy.findMany({ where: { organizationId }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.campus.findMany({ where: { organizationId }, include: includes.campuses, orderBy: { name: 'asc' } }),
    prisma.holiday.findMany({ where: { organizationId }, include: { term: true }, orderBy: { startDate: 'asc' } }),
  ]);
  return { years, departments, gradeLevels, subjects, policies, campuses, holidays };
};

export const list = async (organizationId: string, resource: string, parentId?: string) => {
  const where: any = { organizationId };
  if (parentId && parentFields[resource]) where[parentFields[resource]] = parentId;
  return dbModel(resource).findMany({ where, include: includes[resource], orderBy: resource === 'grade-levels' ? { order: 'asc' } : { createdAt: 'desc' } });
};
export const create = async (organizationId: string, resource: string, data: any) => {
  normalizeDates(data);
  try {
    if (resource === 'credit-policies' && data.isDefault) await prisma.creditPolicy.updateMany({ where: { organizationId }, data: { isDefault: false } });
    return await dbModel(resource).create({ data: { ...data, organizationId } });
  } catch (error) { handle(error); }
};
export const update = async (organizationId: string, resource: string, id: string, data: any) => {
  normalizeDates(data);
  const existing = await dbModel(resource).findFirst({ where: { id, organizationId } });
  if (!existing) throw AppError.notFound('Academic structure item not found');
  try {
    if (resource === 'credit-policies' && data.isDefault) await prisma.creditPolicy.updateMany({ where: { organizationId, id: { not: id } }, data: { isDefault: false } });
    return await dbModel(resource).update({ where: { id }, data });
  } catch (error) { handle(error); }
};
export const remove = async (organizationId: string, resource: string, id: string) => {
  const existing = await dbModel(resource).findFirst({ where: { id, organizationId } });
  if (!existing) throw AppError.notFound('Academic structure item not found');
  try { await dbModel(resource).delete({ where: { id } }); } catch (error) { handle(error); }
};

export const rollover = async (organizationId: string, sourceId: string, input: any) => {
  const source = await prisma.academicYear.findFirst({
    where: { id: sourceId, organizationId },
    include: { terms: { include: { holidays: true, schedules: true }, orderBy: { startDate: 'asc' } } },
  });
  if (!source) throw AppError.notFound('Academic year not found');
  const offset = input.startDate.getTime() - source.startDate.getTime();
  const shift = (date: Date) => new Date(date.getTime() + offset);
  return prisma.$transaction(async tx => {
    const year = await tx.academicYear.create({ data: { organizationId, name: input.name, startDate: input.startDate, endDate: input.endDate, status: 'PLANNED' } });
    for (const [index, term] of source.terms.entries()) {
      const nextTerm = await tx.academicTerm.create({ data: { organizationId, academicYearId: year.id, name: term.name, code: `${input.codePrefix}-${index + 1}`, startDate: shift(term.startDate), endDate: shift(term.endDate), status: 'PLANNED' } });
      if (term.holidays.length) await tx.holiday.createMany({ data: term.holidays.map(h => ({ organizationId, termId: nextTerm.id, name: h.name, startDate: shift(h.startDate), endDate: shift(h.endDate), isTeachingDay: h.isTeachingDay })) });
      if (input.cloneSchedules && term.schedules.length) await tx.schedule.createMany({ data: term.schedules.map(s => ({ organizationId, courseId: s.courseId, teacherId: s.teacherId, title: s.title, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, room: s.room, semester: nextTerm.code, termId: nextTerm.id, roomId: s.roomId })) });
    }
    return tx.academicYear.findUnique({ where: { id: year.id }, include: { terms: true } });
  });
};
