import { AppError, EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from './event-outbox.service';
import { Prisma } from '@prisma/client-academic';
import sanitizeHtml from 'sanitize-html';
import { issueCertificate } from './certificate.service';
import { getBillingAccessStatus } from './billing-access.service';

import { prisma } from '../lib/prisma';
type Actor = { userId: string; role: string };

const editorRoles = ['ORG_ADMIN', 'SUPER_ADMIN'];
const courseInclude = {
  instructors: {
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  },
  prerequisites: {
    include: { prerequisiteCourse: { select: { id: true, code: true, title: true } } },
  },
  modules: {
    orderBy: { order: 'asc' as const },
    include: {
      lessons: {
        orderBy: { order: 'asc' as const },
        include: { attachments: true },
      },
    },
  },
  versions: {
    orderBy: { version: 'desc' as const },
    take: 10,
  },
  _count: { select: { cohorts: true } },
};

export const buildCourseSnapshot = (course: any) => ({
  id: course.id,
  code: course.code,
  title: course.title,
  description: course.description,
  level: course.level,
  durationWeeks: course.durationWeeks,
  price: course.price?.toString?.() || String(course.price || 0),
  currency: course.currency,
  completionRule: course.completionRule,
  completionPercentage: course.completionPercentage,
  modules: (course.modules || []).map((module: any) => ({
    id: module.id,
    title: module.title,
    order: module.order,
    lessons: (module.lessons || []).map((lesson: any) => ({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      contentType: lesson.contentType,
      videoUrl: lesson.videoUrl,
      externalUrl: lesson.externalUrl,
      unlockRule: lesson.unlockRule,
      releaseAt: lesson.releaseAt?.toISOString?.() || lesson.releaseAt || null,
      order: lesson.order,
      attachments: (lesson.attachments || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        fileUrl: file.fileUrl,
        mimeType: file.mimeType,
        size: file.size,
      })),
    })),
  })),
  capturedAt: new Date().toISOString(),
});

const createCourseVersion = async (tx: Prisma.TransactionClient, organizationId: string, course: any, actor: Actor) => {
  const last = await tx.courseVersion.aggregate({
    where: { organizationId, courseId: course.id },
    _max: { version: true },
  });
  return tx.courseVersion.create({
    data: {
      organizationId,
      courseId: course.id,
      version: (last._max.version || 0) + 1,
      title: course.title,
      snapshot: buildCourseSnapshot(course),
      createdByUserId: actor.userId,
    },
  });
};

const canEditWhere = (actor: Actor) =>
  editorRoles.includes(actor.role)
    ? {}
    : { OR: [{ instructorId: actor.userId }, { instructors: { some: { userId: actor.userId } } }] };

export const sanitizeRichText = (html?: string | null) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'pre',
      'code',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
};

const assertInstructor = async (organizationId: string, userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, role: 'INSTRUCTOR' },
  });
  if (!user) throw AppError.badRequest('Instructor does not exist in this organization');
};

const editableCourse = async (organizationId: string, courseId: string, actor: Actor) => {
  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId, deletedAt: null, ...canEditWhere(actor) },
  });
  if (!course) throw AppError.notFound('Course not found');
  return course;
};

export const listCourses = async (
  organizationId: string,
  actor: Actor,
  query: {
    search?: string;
    status?: string;
    departmentId?: string;
    programId?: string;
    level?: string;
    page: number;
    limit: number;
  }
) => {
  const where: Prisma.CourseWhereInput = {
    organizationId,
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status as any } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.programId ? { programId: query.programId } : {}),
    ...(query.level ? { level: query.level } : {}),
  };
  if (actor.role === 'STUDENT') {
    where.status = 'PUBLISHED';
    where.cohorts = { some: { enrollments: { some: { userId: actor.userId } } } };
  } else if (actor.role === 'INSTRUCTOR') Object.assign(where, canEditWhere(actor));
  else if (!['ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'].includes(actor.role)) {
    throw AppError.forbidden('Unauthorized role');
  }
  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        instructors: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { modules: true, cohorts: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
};

export const getCourse = async (organizationId: string, courseId: string, actor: Actor) => {
  const access: Prisma.CourseWhereInput = {};
  if (actor.role === 'STUDENT') {
    access.status = 'PUBLISHED';
    access.cohorts = { some: { enrollments: { some: { userId: actor.userId } } } };
  } else if (actor.role === 'INSTRUCTOR') Object.assign(access, canEditWhere(actor));
  const course = await prisma.course.findFirst({
    where: { id: courseId, organizationId, deletedAt: null, ...access },
    include: courseInclude,
  });
  if (!course) throw AppError.notFound('Course not found');
  if (actor.role === 'STUDENT') {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        organizationId,
        userId: actor.userId,
        cohort: { courseId: course.id },
        status: 'ACTIVE',
      },
      select: { id: true, cohortId: true },
      orderBy: { enrolledAt: 'desc' },
    });
    if (enrollment) {
      const billing = await getBillingAccessStatus({
        organizationId,
        userId: actor.userId,
        enrollmentId: enrollment.id,
        cohortId: enrollment.cohortId,
      });
      if (billing.restricted) {
        return {
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description,
          status: course.status,
          billingRestricted: true,
          blockingInvoices: billing.blockingInvoices,
          modules: [],
          progress: 0,
          isCompleted: false,
          completedLessons: 0,
          totalLessons: 0,
        };
      }
    }
    const now = new Date();
    const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
    const completedRows = await prisma.lessonProgress.findMany({
      where: { organizationId, userId: actor.userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    });
    const completedIds = new Set(completedRows.map((row) => row.lessonId));
    course.modules.forEach((module) => {
      module.lessons = module.lessons.map((lesson, index) => {
        const previousLesson = module.lessons[index - 1];
        const previousCompleted = !previousLesson || completedIds.has(previousLesson.id);
        const scheduleLocked = Boolean(lesson.releaseAt && lesson.releaseAt > now);
        const sequenceLocked = lesson.unlockRule === 'SEQUENTIAL' && !previousCompleted;
        return Object.assign(lesson, {
          completed: completedIds.has(lesson.id),
          locked: scheduleLocked || sequenceLocked,
          lockReason: scheduleLocked ? 'SCHEDULED' : sequenceLocked ? 'SEQUENTIAL' : null,
        });
      });
    });
    const progress = lessonIds.length
      ? Math.round((completedRows.length * 100) / lessonIds.length)
      : 0;
    const isCompleted =
      course.completionRule === 'ALL_LESSONS'
        ? lessonIds.length > 0 && completedRows.length === lessonIds.length
        : progress >= course.completionPercentage;
    return {
      ...course,
      progress,
      isCompleted,
      completedLessons: completedRows.length,
      totalLessons: lessonIds.length,
    };
  }
  return course;
};

export const createCourse = async (organizationId: string, actor: Actor, input: any) => {
  await assertInstructor(organizationId, input.instructorId);
  const { prerequisiteIds = [], ...data } = input;
  if (prerequisiteIds.length) {
    const count = await prisma.course.count({
      where: { organizationId, deletedAt: null, id: { in: prerequisiteIds } },
    });
    if (count !== prerequisiteIds.length) throw AppError.badRequest('Invalid prerequisite course');
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          ...data,
          organizationId,
          publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
          instructors: { create: { organizationId, userId: input.instructorId, role: 'OWNER' } },
          prerequisites: {
            create: prerequisiteIds.map((id: string) => ({
              organizationId,
              prerequisiteCourseId: id,
            })),
          },
        },
        include: courseInclude,
      });
      await enqueueAcademicEvent(tx, EVENTS.COURSE_CREATED, organizationId, {
        courseId: course.id,
        code: course.code,
        title: course.title,
        status: course.status,
      });
      const version = course.status === 'PUBLISHED' ? await createCourseVersion(tx, organizationId, course, actor) : null;
      return { ...course, latestVersion: version };
    });
  } catch (error: any) {
    if (error.code === 'P2002') throw AppError.conflict('Course code already exists');
    throw error;
  }
};

export const updateCourse = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  input: any
) => {
  const existing = await editableCourse(organizationId, courseId, actor);
  if (input.instructorId && input.instructorId !== existing.instructorId) {
    if (!editorRoles.includes(actor.role))
      throw AppError.forbidden('Only administrators can transfer ownership');
    await assertInstructor(organizationId, input.instructorId);
  }
  const { prerequisiteIds, ...data } = input;
  if (data.status) {
    data.publishedAt = data.status === 'PUBLISHED' ? existing.publishedAt || new Date() : null;
    data.archivedAt = data.status === 'ARCHIVED' ? new Date() : null;
  }
  return prisma.$transaction(async (tx) => {
    if (prerequisiteIds) {
      if (prerequisiteIds.includes(courseId))
        throw AppError.badRequest('Course cannot require itself');
      await tx.coursePrerequisite.deleteMany({ where: { organizationId, courseId } });
      await tx.coursePrerequisite.createMany({
        data: prerequisiteIds.map((id: string) => ({
          organizationId,
          courseId,
          prerequisiteCourseId: id,
        })),
      });
    }
    if (data.instructorId && data.instructorId !== existing.instructorId) {
      await tx.courseInstructor.updateMany({
        where: { organizationId, courseId, role: 'OWNER' },
        data: { role: 'CO_TEACHER' },
      });
      await tx.courseInstructor.upsert({
        where: {
          organizationId_courseId_userId: { organizationId, courseId, userId: data.instructorId },
        },
        create: { organizationId, courseId, userId: data.instructorId, role: 'OWNER' },
        update: { role: 'OWNER' },
      });
    }
    const course = await tx.course.update({
      where: { id: courseId },
      data,
      include: courseInclude,
    });
    const version = data.status === 'PUBLISHED' ? await createCourseVersion(tx, organizationId, course, actor) : null;
    await enqueueAcademicEvent(
      tx,
      data.status === 'ARCHIVED' ? EVENTS.COURSE_ARCHIVED : EVENTS.COURSE_UPDATED,
      organizationId,
      { courseId: course.id, code: course.code, title: course.title, status: course.status, version: version?.version }
    );
    return { ...course, latestVersion: version };
  });
};

export const listCourseVersions = async (organizationId: string, courseId: string, actor: Actor) => {
  await editableCourse(organizationId, courseId, actor);
  return prisma.courseVersion.findMany({
    where: { organizationId, courseId },
    orderBy: { version: 'desc' },
  });
};

const snapshotSummary = (snapshot: any) => ({
  title: snapshot?.title || '',
  moduleCount: (snapshot?.modules || []).length,
  lessonCount: (snapshot?.modules || []).reduce((sum: number, module: any) => sum + (module.lessons || []).length, 0),
  moduleTitles: (snapshot?.modules || []).map((module: any) => module.title),
});

export const compareCourseVersions = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  fromVersion: number,
  toVersion: number,
) => {
  await editableCourse(organizationId, courseId, actor);
  const versions = await prisma.courseVersion.findMany({
    where: { organizationId, courseId, version: { in: [fromVersion, toVersion] } },
  });
  const from = versions.find(v => v.version === fromVersion);
  const to = versions.find(v => v.version === toVersion);
  if (!from || !to) throw AppError.notFound('Course version not found');
  const fromSummary = snapshotSummary(from.snapshot);
  const toSummary = snapshotSummary(to.snapshot);
  return {
    from,
    to,
    summary: {
      titleChanged: fromSummary.title !== toSummary.title,
      moduleCountDelta: toSummary.moduleCount - fromSummary.moduleCount,
      lessonCountDelta: toSummary.lessonCount - fromSummary.lessonCount,
      addedModules: toSummary.moduleTitles.filter((title: string) => !fromSummary.moduleTitles.includes(title)),
      removedModules: fromSummary.moduleTitles.filter((title: string) => !toSummary.moduleTitles.includes(title)),
    },
  };
};

export const restoreCourseVersion = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  versionNumber: number,
) => {
  await editableCourse(organizationId, courseId, actor);
  const version = await prisma.courseVersion.findFirst({
    where: { organizationId, courseId, version: versionNumber },
  });
  if (!version) throw AppError.notFound('Course version not found');
  const snapshot = version.snapshot as any;
  return prisma.$transaction(async tx => {
    const course = await tx.course.update({
      where: { id: courseId },
      data: {
        title: snapshot.title,
        description: snapshot.description,
        level: snapshot.level,
        durationWeeks: snapshot.durationWeeks,
        price: new Prisma.Decimal(snapshot.price || 0),
        currency: snapshot.currency || 'MNT',
        completionRule: snapshot.completionRule,
        completionPercentage: snapshot.completionPercentage,
        status: 'DRAFT',
        publishedAt: null,
      },
      include: courseInclude,
    });
    await enqueueAcademicEvent(tx, EVENTS.COURSE_UPDATED, organizationId, {
      courseId: course.id,
      code: course.code,
      title: course.title,
      status: course.status,
      restoredFromVersion: version.version,
    });
    return { ...course, restoredFromVersion: version };
  });
};

export const deleteCourse = async (organizationId: string, courseId: string, actor: Actor) => {
  await editableCourse(organizationId, courseId, actor);
  await prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    await tx.course.update({
      where: { id: courseId },
      data: { deletedAt, status: 'ARCHIVED', archivedAt: deletedAt },
    });
    await enqueueAcademicEvent(tx, EVENTS.COURSE_DELETED, organizationId, { courseId });
  });
};

export const duplicateCourse = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  input: { code: string; title?: string }
) => {
  const source = await prisma.course.findFirst({
    where: { id: courseId, organizationId, deletedAt: null, ...canEditWhere(actor) },
    include: courseInclude,
  });
  if (!source) throw AppError.notFound('Course not found');
  return prisma.course.create({
    data: {
      organizationId,
      code: input.code,
      title: input.title || `${source.title} (Copy)`,
      description: source.description,
      credits: source.credits,
      level: source.level,
      durationWeeks: source.durationWeeks,
      price: source.price,
      currency: source.currency,
      capacity: source.capacity,
      departmentId: source.departmentId,
      programId: source.programId,
      prerequisiteText: source.prerequisiteText,
      coverImageUrl: source.coverImageUrl,
      instructorId: actor.role === 'INSTRUCTOR' ? actor.userId : source.instructorId,
      status: 'DRAFT',
      completionRule: source.completionRule,
      completionPercentage: source.completionPercentage,
      instructors: {
        create: {
          organizationId,
          userId: actor.role === 'INSTRUCTOR' ? actor.userId : source.instructorId,
          role: 'OWNER',
        },
      },
      modules: {
        create: source.modules.map((module) => ({
          organizationId,
          title: module.title,
          order: module.order,
          lessons: {
            create: module.lessons.map((lesson) => ({
              organizationId,
              title: lesson.title,
              content: lesson.content,
              contentType: lesson.contentType,
              videoUrl: lesson.videoUrl,
              externalUrl: lesson.externalUrl,
              order: lesson.order,
              attachments: {
                create: lesson.attachments.map((file) => ({
                  organizationId,
                  name: file.name,
                  fileUrl: file.fileUrl,
                  mimeType: file.mimeType,
                  size: file.size,
                })),
              },
            })),
          },
        })),
      },
    },
    include: courseInclude,
  });
};

export const addInstructor = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  userId: string
) => {
  await editableCourse(organizationId, courseId, actor);
  await assertInstructor(organizationId, userId);
  return prisma.courseInstructor.upsert({
    where: { organizationId_courseId_userId: { organizationId, courseId, userId } },
    create: { organizationId, courseId, userId, role: 'CO_TEACHER' },
    update: {},
  });
};

export const removeInstructor = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  userId: string
) => {
  await editableCourse(organizationId, courseId, actor);
  const link = await prisma.courseInstructor.findFirst({
    where: { organizationId, courseId, userId, role: 'CO_TEACHER' },
  });
  if (!link) throw AppError.notFound('Co-teacher not found');
  await prisma.courseInstructor.delete({ where: { id: link.id } });
};

export const createModule = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  title: string
) => {
  await editableCourse(organizationId, courseId, actor);
  const last = await prisma.module.aggregate({
    where: { organizationId, courseId },
    _max: { order: true },
  });
  return prisma.module.create({
    data: { organizationId, courseId, title, order: (last._max.order || 0) + 1 },
  });
};

export const updateModule = async (
  organizationId: string,
  moduleId: string,
  actor: Actor,
  data: any
) => {
  const module = await prisma.module.findFirst({
    where: { id: moduleId, organizationId, course: canEditWhere(actor) },
  });
  if (!module) throw AppError.notFound('Module not found');
  return prisma.module.update({ where: { id: moduleId }, data });
};

export const deleteModule = async (organizationId: string, moduleId: string, actor: Actor) => {
  await updateModule(organizationId, moduleId, actor, {});
  await prisma.module.delete({ where: { id: moduleId } });
};

export const reorderModules = async (
  organizationId: string,
  courseId: string,
  actor: Actor,
  ids: string[]
) => {
  await editableCourse(organizationId, courseId, actor);
  const count = await prisma.module.count({ where: { organizationId, courseId, id: { in: ids } } });
  if (count !== ids.length) throw AppError.badRequest('Module order contains invalid IDs');
  await prisma.$transaction(
    ids.map((id, index) => prisma.module.update({ where: { id }, data: { order: index + 1 } }))
  );
};

export const createLesson = async (
  organizationId: string,
  moduleId: string,
  actor: Actor,
  input: any
) => {
  const module = await prisma.module.findFirst({
    where: { id: moduleId, organizationId, course: canEditWhere(actor) },
  });
  if (!module) throw AppError.notFound('Module not found');
  const last = await prisma.lesson.aggregate({
    where: { organizationId, moduleId },
    _max: { order: true },
  });
  const { attachments = [], ...data } = input;
  return prisma.lesson.create({
    data: {
      ...data,
      content: sanitizeRichText(data.content),
      organizationId,
      moduleId,
      order: (last._max.order || 0) + 1,
      attachments: { create: attachments.map((file: any) => ({ ...file, organizationId })) },
    },
    include: { attachments: true },
  });
};

export const updateLesson = async (
  organizationId: string,
  lessonId: string,
  actor: Actor,
  input: any
) => {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, organizationId, module: { course: canEditWhere(actor) } },
  });
  if (!lesson) throw AppError.notFound('Lesson not found');
  const { attachments, ...data } = input;
  if (data.content !== undefined) data.content = sanitizeRichText(data.content);
  return prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...data,
      ...(attachments
        ? {
            attachments: {
              deleteMany: {},
              create: attachments.map((file: any) => ({ ...file, organizationId })),
            },
          }
        : {}),
    },
    include: { attachments: true },
  });
};

export const deleteLesson = async (organizationId: string, lessonId: string, actor: Actor) => {
  await updateLesson(organizationId, lessonId, actor, {});
  await prisma.lesson.delete({ where: { id: lessonId } });
};

export const reorderLessons = async (
  organizationId: string,
  moduleId: string,
  actor: Actor,
  ids: string[]
) => {
  const module = await prisma.module.findFirst({
    where: { id: moduleId, organizationId, course: canEditWhere(actor) },
  });
  if (!module) throw AppError.notFound('Module not found');
  const count = await prisma.lesson.count({ where: { organizationId, moduleId, id: { in: ids } } });
  if (count !== ids.length) throw AppError.badRequest('Lesson order contains invalid IDs');
  await prisma.$transaction(
    ids.map((id, index) => prisma.lesson.update({ where: { id }, data: { order: index + 1 } }))
  );
};

export const completeLesson = async (organizationId: string, lessonId: string, userId: string) => {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      organizationId,
      module: {
        course: { status: 'PUBLISHED', cohorts: { some: { enrollments: { some: { userId } } } } },
      },
    },
  });
  if (!lesson || (lesson.releaseAt && lesson.releaseAt > new Date()))
    throw AppError.notFound('Lesson not available');
  if (lesson.unlockRule === 'SEQUENTIAL') {
    const previous = await prisma.lesson.findFirst({
      where: { organizationId, moduleId: lesson.moduleId, order: { lt: lesson.order } },
      orderBy: { order: 'desc' },
      select: { id: true },
    });
    if (previous) {
      const completed = await prisma.lessonProgress.findUnique({
        where: { organizationId_lessonId_userId: { organizationId, lessonId: previous.id, userId } },
      });
      if (!completed) throw AppError.forbidden('Previous lesson must be completed first');
    }
  }
  const progress = await prisma.lessonProgress.upsert({
    where: { organizationId_lessonId_userId: { organizationId, lessonId, userId } },
    create: { organizationId, lessonId, userId },
    update: { completedAt: new Date() },
  });
  const course = await prisma.course.findFirst({
    where: { organizationId, modules: { some: { lessons: { some: { id: lessonId } } } } },
    select: { id: true, completionRule: true, completionPercentage: true, modules: { select: { lessons: { select: { id: true } } } } },
  });
  if (course) {
    const lessonIds = course.modules.flatMap(module => module.lessons.map(item => item.id));
    const completed = await prisma.lessonProgress.count({ where: { organizationId, userId, lessonId: { in: lessonIds } } });
    const percentage = lessonIds.length ? Math.round(completed * 100 / lessonIds.length) : 0;
    const qualifies = course.completionRule === 'ALL_LESSONS' ? lessonIds.length > 0 && completed === lessonIds.length : percentage >= course.completionPercentage;
    if (qualifies) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { organizationId, userId, cohort: { courseId: course.id } },
        select: { id: true },
      });
      await issueCertificate(organizationId, userId, course.id, undefined, undefined, enrollment?.id);
    }
  }
  return progress;
};
