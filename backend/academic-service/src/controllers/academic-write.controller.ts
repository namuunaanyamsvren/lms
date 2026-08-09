import { Request, Response } from 'express';
import { AppError, EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from '../services/event-outbox.service';
import { computeNotificationPayload } from '../services/attendance.service';
import { getOrganizationAttendancePolicy } from '../services/organization-attendance-policy.service';
import { computeLatePenalty } from '../services/late-policy.service';
import { buildCourseSnapshot } from '../services/course.service';
import { validateRepositorySubmission } from '../services/repository-validation.service';

import { prisma } from '../lib/prisma';
const org = (req: Request) => req.organizationId!;

const ensureStudent = async (organizationId: string, userId: string) => {
  const student = await prisma.user.findFirst({
    where: { id: userId, organizationId, role: 'STUDENT' },
    select: { id: true },
  });
  if (!student) throw AppError.badRequest('Student does not exist in this organization');
};

export const createCourse = async (req: Request, res: Response) => {
  const instructor = await prisma.user.findFirst({
    where: { id: req.body.instructorId, organizationId: org(req), role: 'INSTRUCTOR' },
  });
  if (!instructor) throw AppError.badRequest('Instructor does not exist in this organization');
  const course = await prisma.course.create({
    data: { ...req.body, organizationId: org(req) },
  });
  return res.status(201).json({ success: true, data: course });
};

export const updateCourse = async (req: Request, res: Response) => {
  const existing = await prisma.course.findFirst({
    where: {
      id: req.params.id,
      organizationId: org(req),
      deletedAt: null,
      ...(req.user!.role === 'INSTRUCTOR' ? { instructorId: req.user!.userId } : {}),
    },
  });
  if (!existing) throw AppError.notFound('Course not found');
  if (
    req.user!.role === 'INSTRUCTOR' &&
    req.body.instructorId &&
    req.body.instructorId !== req.user!.userId
  ) {
    throw AppError.forbidden('Instructors cannot transfer course ownership');
  }
  if (req.body.instructorId) {
    const instructor = await prisma.user.findFirst({
      where: { id: req.body.instructorId, organizationId: org(req), role: 'INSTRUCTOR' },
    });
    if (!instructor) throw AppError.badRequest('Instructor does not exist in this organization');
  }
  const course = await prisma.course.update({ where: { id: existing.id }, data: req.body });
  return res.json({ success: true, data: course });
};

export const deleteCourse = async (req: Request, res: Response) => {
  const existing = await prisma.course.findFirst({
    where: { id: req.params.id, organizationId: org(req), deletedAt: null },
  });
  if (!existing) throw AppError.notFound('Course not found');
  const deletedAt = new Date();
  await prisma.course.update({
    where: { id: existing.id },
    data: { deletedAt, status: 'ARCHIVED', archivedAt: deletedAt },
  });
  return res.status(204).send();
};

export const createCohort = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const course = await prisma.course.findFirst({
    where: {
      id: req.body.courseId,
      organizationId,
      deletedAt: null,
      ...(req.user!.role === 'INSTRUCTOR' ? { instructorId: req.user!.userId } : {}),
    },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: { lessons: { orderBy: { order: 'asc' }, include: { attachments: true } } },
      },
      instructors: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!course) throw AppError.notFound('Course not found');
  // Cohorts must run off an immutable, point-in-time view of the course.
  // Prefer the latest PUBLISHED CourseVersion's frozen snapshot so later edits
  // to the live course/modules/lessons can never retroactively change what an
  // already-running cohort's students see. Only falls back to building a live
  // snapshot when the course has never been published through that flow.
  const publishedSnapshot = course.versions[0]?.snapshot as Record<string, unknown> | undefined;
  const courseSnapshot = {
    ...(publishedSnapshot || buildCourseSnapshot(course)),
    publishedVersion: course.versions[0]?.version || null,
    publishedAt: course.versions[0]?.publishedAt?.toISOString?.() || course.publishedAt?.toISOString?.() || null,
    instructors: course.instructors.map(link => ({
      id: link.user.id,
      firstName: link.user.firstName,
      lastName: link.user.lastName,
      email: link.user.email,
      role: link.role,
    })),
  };
  const cohort = await prisma.cohort.create({
    data: {
      organizationId,
      courseId: course.id,
      name: req.body.name,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      seatLimit: req.body.seatLimit,
      status: req.body.status || 'ACTIVE',
      scheduleJson: req.body.scheduleJson,
      courseSnapshot,
    },
    include: { course: true, enrollments: true },
  });
  return res.status(201).json({ success: true, data: cohort });
};

export const enrollStudent = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const cohort = await prisma.cohort.findFirst({
    where: {
      id: req.params.cohortId,
      organizationId,
      ...(req.user!.role === 'INSTRUCTOR'
        ? { course: { instructorId: req.user!.userId } }
        : {}),
    },
  });
  if (!cohort) throw AppError.notFound('Cohort not found');
  const course = await prisma.course.findFirst({
    where: { id: cohort.courseId, organizationId, deletedAt: null },
    select: { capacity: true, title: true, price: true, currency: true },
  });
  if (!course) throw AppError.notFound('Course not found');
  const seatLimit = cohort.seatLimit || course.capacity;
  if (seatLimit) {
    const enrolled = await prisma.enrollment.count({
      where: { organizationId, cohortId: cohort.id, status: 'ACTIVE' },
    });
    if (enrolled >= seatLimit) throw AppError.conflict('Cohort seat limit has been reached');
  }
  await ensureStudent(organizationId, req.body.userId);
  const existing = await prisma.enrollment.findUnique({
    where: {
      organizationId_userId_cohortId: {
        organizationId,
        userId: req.body.userId,
        cohortId: cohort.id,
      },
    },
  });
  if (existing) throw AppError.conflict('Student is already enrolled in this cohort');
  const enrollment = await prisma.$transaction(async tx=>{const row=await tx.enrollment.create({data:{organizationId,cohortId:cohort.id,userId:req.body.userId}});await enqueueAcademicEvent(tx,EVENTS.ENROLLMENT_CREATED,organizationId,{enrollmentId:row.id,cohortId:row.cohortId,userId:row.userId,courseId:cohort.courseId,courseTitle:course.title,amount:course.price?.toString() || '0',currency:course.currency || 'MNT'});return row;});
  return res.status(201).json({ success: true, data: enrollment });
};

const parseEnrollmentCsv = (csv: string) => {
  const rows = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  if (rows.length < 2) throw AppError.badRequest('CSV must include a header and at least one student row');
  const headers = rows[0].split(',').map(value => value.trim());
  const emailIndex = headers.indexOf('email');
  const studentIdIndex = headers.indexOf('studentId');
  if (emailIndex === -1 && studentIdIndex === -1) {
    throw AppError.badRequest('CSV must include email or studentId column');
  }
  return rows.slice(1).map((row, index) => {
    const cells = row.split(',').map(value => value.trim());
    return {
      row: index + 2,
      email: emailIndex >= 0 ? cells[emailIndex] : '',
      studentId: studentIdIndex >= 0 ? cells[studentIdIndex] : '',
    };
  });
};

export const importCohortEnrollments = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const cohort = await prisma.cohort.findFirst({
    where: {
      id: req.params.cohortId,
      organizationId,
      ...(req.user!.role === 'INSTRUCTOR'
        ? { course: { instructorId: req.user!.userId } }
        : {}),
    },
    include: { course: { select: { capacity: true, title: true, price: true, currency: true } } },
  });
  if (!cohort) throw AppError.notFound('Cohort not found');
  const rows = parseEnrollmentCsv(req.body.csv || '');
  const seatLimit = cohort.seatLimit || cohort.course.capacity;
  const activeCount = await prisma.enrollment.count({ where: { organizationId, cohortId: cohort.id, status: 'ACTIVE' } });
  let remainingSeats = seatLimit ? Math.max(seatLimit - activeCount, 0) : Number.POSITIVE_INFINITY;

  const results: Array<{ row: number; status: string; message: string; email?: string; studentId?: string; userId?: string }> = [];
  let imported = 0;
  for (const row of rows) {
    if (!row.email && !row.studentId) {
      results.push({ row: row.row, status: 'ERROR', message: 'email or studentId is required', email: row.email, studentId: row.studentId });
      continue;
    }
    if (remainingSeats <= 0) {
      results.push({ row: row.row, status: 'ERROR', message: 'Cohort seat limit has been reached', email: row.email, studentId: row.studentId });
      continue;
    }
    const student = await prisma.user.findFirst({
      where: {
        organizationId,
        role: 'STUDENT',
        deletedAt: null,
        OR: [
          ...(row.email ? [{ email: row.email }] : []),
          ...(row.studentId ? [{ studentId: row.studentId }] : []),
        ],
      },
      select: { id: true },
    });
    if (!student) {
      results.push({ row: row.row, status: 'ERROR', message: 'Student not found', email: row.email, studentId: row.studentId });
      continue;
    }
    try {
      await prisma.$transaction(async tx => {
        const existing = await tx.enrollment.findUnique({
          where: { organizationId_userId_cohortId: { organizationId, userId: student.id, cohortId: cohort.id } },
        });
        if (existing) {
          results.push({ row: row.row, status: 'SKIPPED', message: 'Already enrolled', email: row.email, studentId: row.studentId, userId: student.id });
          return;
        }
        const enrollment = await tx.enrollment.create({ data: { organizationId, cohortId: cohort.id, userId: student.id } });
        await enqueueAcademicEvent(tx, EVENTS.ENROLLMENT_CREATED, organizationId, {
          enrollmentId: enrollment.id,
          cohortId: enrollment.cohortId,
          userId: enrollment.userId,
          courseId: cohort.courseId,
          courseTitle: cohort.course.title,
          amount: cohort.course.price?.toString() || '0',
          currency: cohort.course.currency || 'MNT',
        });
      });
      imported += 1;
      remainingSeats -= 1;
      results.push({ row: row.row, status: 'IMPORTED', message: 'Enrolled', email: row.email, studentId: row.studentId, userId: student.id });
    } catch (error: any) {
      results.push({ row: row.row, status: 'ERROR', message: error?.message || 'Import failed', email: row.email, studentId: row.studentId, userId: student.id });
    }
  }
  return res.json({ success: true, data: { imported, total: rows.length, remainingSeats: Number.isFinite(remainingSeats) ? remainingSeats : null, results } });
};

export const deleteEnrollment = async (req: Request, res: Response) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: req.params.id,
      organizationId: org(req),
      ...(req.user!.role === 'INSTRUCTOR'
        ? { cohort: { course: { instructorId: req.user!.userId } } }
        : {}),
    },
  });
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  await prisma.$transaction(async tx=>{await tx.enrollment.delete({where:{id:enrollment.id}});await enqueueAcademicEvent(tx,EVENTS.ENROLLMENT_DELETED,org(req),{enrollmentId:enrollment.id,cohortId:enrollment.cohortId,userId:enrollment.userId});});
  return res.status(204).send();
};

const elevatedFileRoles = new Set(['SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'STAFF']);

const validateLateDeadline = (dueDate?: Date | null, lateDeadline?: Date | null) => {
  if (dueDate && lateDeadline && lateDeadline < dueDate) {
    throw AppError.badRequest('lateDeadline must be on or after dueDate');
  }
};

export const createAssignment = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const module = await prisma.module.findFirst({
    where: {
      id: req.body.moduleId,
      organizationId,
      ...(req.user!.role === 'INSTRUCTOR' ? { course: { instructorId: req.user!.userId } } : {}),
    },
  });
  if (!module) throw AppError.notFound('Module not found');
  validateLateDeadline(req.body.dueDate, req.body.lateDeadline);
  const status = req.body.status || 'PUBLISHED';
  const data = {
    ...req.body,
    organizationId,
    moduleId: module.id,
    status,
    publishedAt: status === 'PUBLISHED' ? new Date() : null,
  };
  const assignment=await prisma.$transaction(async tx=>{const row=await tx.assignment.create({data});await enqueueAcademicEvent(tx,EVENTS.ASSIGNMENT_CREATED,organizationId,{assignmentId:row.id,moduleId:row.moduleId,title:row.title,dueDate:row.dueDate.toISOString()});return row;});
  return res.status(201).json({ success: true, data: assignment });
};

export const updateAssignment = async (req: Request, res: Response) => {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: req.params.id,
      organizationId: org(req),
      deletedAt: null,
      ...(req.user!.role === 'INSTRUCTOR'
        ? { module: { course: { instructorId: req.user!.userId } } }
        : {}),
    },
  });
  if (!assignment) throw AppError.notFound('Assignment not found');
  validateLateDeadline(req.body.dueDate ?? assignment.dueDate, req.body.lateDeadline ?? assignment.lateDeadline);
  const data: any = { ...req.body };
  let eventType: string = EVENTS.ASSIGNMENT_UPDATED;
  if (data.status && data.status !== assignment.status) {
    data.publishedAt = data.status === 'PUBLISHED' ? assignment.publishedAt || new Date() : null;
    data.archivedAt = data.status === 'ARCHIVED' ? new Date() : null;
    if (data.status === 'PUBLISHED') data.publishAt = null;
    eventType = data.status === 'PUBLISHED'
      ? EVENTS.ASSIGNMENT_PUBLISHED
      : data.status === 'ARCHIVED'
        ? EVENTS.ASSIGNMENT_ARCHIVED
        : EVENTS.ASSIGNMENT_UPDATED;
  }
  const updated=await prisma.$transaction(async tx=>{const row=await tx.assignment.update({where:{id:assignment.id},data});await enqueueAcademicEvent(tx,eventType,org(req),{assignmentId:row.id,moduleId:row.moduleId,title:row.title,status:row.status});return row;});
  return res.json({ success: true, data: updated });
};

export const deleteAssignment = async (req: Request, res: Response) => {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: req.params.id,
      organizationId: org(req),
      deletedAt: null,
      ...(req.user!.role === 'INSTRUCTOR'
        ? { module: { course: { instructorId: req.user!.userId } } }
        : {}),
    },
  });
  if (!assignment) throw AppError.notFound('Assignment not found');
  const deletedAt = new Date();
  await prisma.$transaction(async tx=>{await tx.assignment.update({where:{id:assignment.id},data:{deletedAt,status:'ARCHIVED',archivedAt:deletedAt}});await enqueueAcademicEvent(tx,EVENTS.ASSIGNMENT_DELETED,org(req),{assignmentId:assignment.id,moduleId:assignment.moduleId,title:assignment.title});});
  return res.status(204).send();
};

const attachmentSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  storageKey: true,
  scanStatus: true,
} as const;

// Shared ownership/malware-scan gate for linking an already-uploaded FileAsset
// to a content entity (assignment or submission attachments).
const assertOwnedCleanFileAssets = async (
  organizationId: string,
  ids: string[],
  ownerUserId: string,
  elevated: boolean,
) => {
  if (!ids.length) return [];
  const assets = await prisma.fileAsset.findMany({ where: { id: { in: ids }, organizationId } });
  if (assets.length !== ids.length) throw AppError.notFound('File asset not found');
  for (const asset of assets) {
    if (asset.ownerUserId !== ownerUserId && !elevated) throw AppError.notFound('File asset not found');
    if (asset.scanStatus !== 'CLEAN' && process.env.NODE_ENV === 'production') {
      throw AppError.forbidden('File has not passed malware scanning');
    }
  }
  return assets;
};

export const addAssignmentAttachment = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: req.params.id,
      organizationId,
      deletedAt: null,
      ...(req.user!.role === 'INSTRUCTOR'
        ? { module: { course: { instructorId: req.user!.userId } } }
        : {}),
    },
  });
  if (!assignment) throw AppError.notFound('Assignment not found');
  const [fileAsset] = await assertOwnedCleanFileAssets(
    organizationId,
    [req.body.fileAssetId],
    req.user!.userId,
    elevatedFileRoles.has(req.user!.role),
  );
  try {
    const attachment = await prisma.assignmentAttachment.create({
      data: { organizationId, assignmentId: assignment.id, fileAssetId: fileAsset.id },
      include: { fileAsset: { select: attachmentSelect } },
    });
    return res.status(201).json({ success: true, data: attachment });
  } catch (error: any) {
    if (error.code === 'P2002') throw AppError.conflict('File is already attached to this assignment');
    throw error;
  }
};

export const removeAssignmentAttachment = async (req: Request, res: Response) => {
  const attachment = await prisma.assignmentAttachment.findFirst({
    where: {
      id: req.params.attachmentId,
      assignmentId: req.params.id,
      organizationId: org(req),
      ...(req.user!.role === 'INSTRUCTOR'
        ? { assignment: { module: { course: { instructorId: req.user!.userId } } } }
        : {}),
    },
  });
  if (!attachment) throw AppError.notFound('Attachment not found');
  await prisma.assignmentAttachment.delete({ where: { id: attachment.id } });
  return res.status(204).send();
};

type LatenessAssignment = { dueDate: Date; lateDeadline: Date | null; allowLateSubmission: boolean };

// Only called when a submission is actually finalized (created or moved out of
// DRAFT), so editing a draft never locks in lateness before the student is done.
const computeLateness = (assignment: LatenessAssignment) => {
  const now = new Date();
  if (now <= assignment.dueDate) return { isLate: false, daysLate: 0 };
  if (!assignment.allowLateSubmission) {
    throw AppError.badRequest('Late submissions are not allowed for this assignment');
  }
  if (assignment.lateDeadline && now > assignment.lateDeadline) {
    throw AppError.badRequest('Submission deadline has passed');
  }
  return { isLate: true, daysLate: Math.ceil((now.getTime() - assignment.dueDate.getTime()) / 86_400_000) };
};

export const submitAssignment = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const studentId = req.user!.userId;
  await validateRepositorySubmission(req.body.repoUrl, req.body.commitHash);
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: req.params.assignmentId,
      organizationId,
      status: 'PUBLISHED',
      deletedAt: null,
      module: { course: { cohorts: { some: { enrollments: { some: { userId: studentId } } } } } },
    },
  });
  if (!assignment) throw AppError.notFound('Assignment not found or student is not enrolled');

  const status = req.body.status || 'SUBMITTED';
  const { isLate, daysLate } = status === 'SUBMITTED'
    ? computeLateness(assignment)
    : { isLate: false, daysLate: 0 };

  const fileAssets = await assertOwnedCleanFileAssets(
    organizationId,
    req.body.fileAssetIds || [],
    studentId,
    false,
  );

  const previous = await prisma.submission.findMany({
    where: { organizationId, assignmentId: assignment.id, studentId, isLatest: true },
    select: { id: true, attemptNumber: true },
  });
  const attemptNumber = (previous[0]?.attemptNumber || 0) + 1;

  const submission=await prisma.$transaction(async tx=>{
    if (previous.length) {
      await tx.submission.updateMany({ where: { id: { in: previous.map(p => p.id) } }, data: { isLatest: false } });
    }
    const row = await tx.submission.create({
      data: {
        organizationId,
        assignmentId: assignment.id,
        studentId,
        content: req.body.content,
        fileUrl: req.body.fileUrl,
        repoUrl: req.body.repoUrl,
        commitHash: req.body.commitHash,
        status,
        isLate,
        daysLate,
        attemptNumber,
        isLatest: true,
        attachments: { create: fileAssets.map(fa => ({ organizationId, fileAssetId: fa.id })) },
      },
      include: { attachments: { include: { fileAsset: { select: attachmentSelect } } } },
    });
    if (status === 'SUBMITTED') {
      await enqueueAcademicEvent(tx,EVENTS.ASSIGNMENT_SUBMITTED,organizationId,{submissionId:row.id,assignmentId:row.assignmentId,studentId,isLate,attemptNumber});
    }
    return row;
  });
  return res.status(201).json({ success: true, data: submission });
};

export const updateSubmission = async (req: Request, res: Response) => {
  const organizationId = org(req);
  await validateRepositorySubmission(req.body.repoUrl, req.body.commitHash);
  const submission = await prisma.submission.findFirst({
    where: { id: req.params.submissionId, organizationId, studentId: req.user!.userId, isLatest: true },
    include: { assignment: true },
  });
  if (!submission) throw AppError.notFound('Submission not found');
  if (submission.status !== 'DRAFT') throw AppError.badRequest('Only draft submissions can be edited');

  const nextStatus = req.body.status || submission.status;
  const { isLate, daysLate } = nextStatus === 'SUBMITTED'
    ? computeLateness(submission.assignment)
    : { isLate: submission.isLate, daysLate: submission.daysLate };

  const updated=await prisma.$transaction(async tx=>{
    const row = await tx.submission.update({
      where: { id: submission.id },
      data: {
        ...(req.body.content !== undefined ? { content: req.body.content } : {}),
        ...(req.body.fileUrl !== undefined ? { fileUrl: req.body.fileUrl } : {}),
        ...(req.body.repoUrl !== undefined ? { repoUrl: req.body.repoUrl } : {}),
        ...(req.body.commitHash !== undefined ? { commitHash: req.body.commitHash } : {}),
        status: nextStatus,
        isLate,
        daysLate,
        submittedAt: nextStatus === 'SUBMITTED' ? new Date() : submission.submittedAt,
      },
      include: { attachments: { include: { fileAsset: { select: attachmentSelect } } } },
    });
    if (nextStatus === 'SUBMITTED' && submission.status !== 'SUBMITTED') {
      await enqueueAcademicEvent(tx,EVENTS.ASSIGNMENT_SUBMITTED,organizationId,{submissionId:row.id,assignmentId:row.assignmentId,studentId:row.studentId,isLate,attemptNumber:row.attemptNumber});
    }
    return row;
  });
  return res.json({ success: true, data: updated });
};

export const addSubmissionAttachment = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const submission = await prisma.submission.findFirst({
    where: { id: req.params.submissionId, organizationId, studentId: req.user!.userId, isLatest: true },
  });
  if (!submission) throw AppError.notFound('Submission not found');
  if (submission.status !== 'DRAFT') throw AppError.badRequest('Only draft submissions can be edited');
  const [fileAsset] = await assertOwnedCleanFileAssets(
    organizationId,
    [req.body.fileAssetId],
    req.user!.userId,
    false,
  );
  try {
    const attachment = await prisma.submissionAttachment.create({
      data: { organizationId, submissionId: submission.id, fileAssetId: fileAsset.id },
      include: { fileAsset: { select: attachmentSelect } },
    });
    return res.status(201).json({ success: true, data: attachment });
  } catch (error: any) {
    if (error.code === 'P2002') throw AppError.conflict('File is already attached to this submission');
    throw error;
  }
};

export const removeSubmissionAttachment = async (req: Request, res: Response) => {
  const attachment = await prisma.submissionAttachment.findFirst({
    where: {
      id: req.params.attachmentId,
      submissionId: req.params.submissionId,
      organizationId: org(req),
      submission: { studentId: req.user!.userId },
    },
    include: { submission: { select: { status: true } } },
  });
  if (!attachment) throw AppError.notFound('Attachment not found');
  if (attachment.submission.status !== 'DRAFT') throw AppError.badRequest('Only draft submissions can be edited');
  await prisma.submissionAttachment.delete({ where: { id: attachment.id } });
  return res.status(204).send();
};

export const gradeSubmission = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const instructorId = req.user!.userId;
  const submission = await prisma.submission.findFirst({
    where: {
      id: req.params.submissionId,
      organizationId,
      ...(req.user!.role === 'INSTRUCTOR'
        ? { assignment: { module: { course: { instructorId } } } }
        : {}),
    },
    include: { assignment: { include: { module: true } } },
  });
  if (!submission) throw AppError.notFound('Submission not found');
  if (req.body.score > submission.assignment.maxPoints) {
    throw AppError.badRequest(`score cannot exceed ${submission.assignment.maxPoints}`);
  }
  const { latePenaltyPercent, score } = computeLatePenalty({
    isLate: submission.isLate,
    daysLate: submission.daysLate,
    latePenaltyPercentPerDay: submission.assignment.latePenaltyPercentPerDay,
    score: req.body.score,
  });
  const { status, reason: _reason, requestResubmit, resubmitReason, ...rest } = req.body;
  const grade = await prisma.$transaction(async tx => {
    const row = await tx.grade.create({
      data: {
        ...rest,
        score,
        latePenaltyPercent,
        organizationId,
        submissionId: submission.id,
        studentId: submission.studentId,
        courseId: submission.assignment.module.courseId,
        categoryId: submission.assignment.categoryId,
        status: status || 'PUBLISHED',
      },
    });
    await tx.gradeHistory.create({
      data: {
        organizationId, gradeId: row.id, changedByUserId: instructorId,
        previousScore: null, newScore: row.score, reason: 'Initial grade',
      },
    });
    if (row.status === 'PUBLISHED') {
      await enqueueAcademicEvent(tx, EVENTS.GRADE_PUBLISHED, organizationId, {
        gradeId: row.id,
        submissionId: submission.id,
        studentId: row.studentId,
        score: row.score,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignment.title,
        maxPoints: submission.assignment.maxPoints,
      });
    }
    if (requestResubmit) {
      await tx.submission.update({
        where: { id: submission.id },
        data: {
          resubmitRequested: true,
          resubmitReason: resubmitReason || rest.feedback || 'Resubmission requested',
        },
      });
      // Dedicated, schema-validated event (see notification-service/src/events/assignment.consumer.ts)
      // rather than the generic NOTIFICATION_SEND passthrough, so this delivery path has
      // its own consumer/queue and can't silently drift from the announcement/attendance pattern.
      await enqueueAcademicEvent(tx, EVENTS.ASSIGNMENT_RESUBMIT_REQUESTED, organizationId, {
        studentId: submission.studentId,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignment.title,
        submissionId: submission.id,
        courseId: submission.assignment.module.courseId,
        reason: resubmitReason || rest.feedback || null,
      });
    }
    return row;
  });
  return res.status(201).json({ success: true, data: grade });
};

export const updateGrade = async (req: Request, res: Response) => {
  const instructorId = req.user!.userId;
  const grade = await prisma.grade.findFirst({
    where: {
      id: req.params.id,
      organizationId: org(req),
      ...(req.user!.role === 'INSTRUCTOR'
        ? { course: { OR: [{ instructorId }, { instructors: { some: { userId: instructorId } } }] } }
        : {}),
    },
    include: { submission: { include: { assignment: true } } },
  });
  if (!grade) throw AppError.notFound('Grade not found');
  const maxPoints = grade.submission?.assignment.maxPoints;
  if (req.body.score != null && maxPoints != null && req.body.score > maxPoints) {
    throw AppError.badRequest(`score cannot exceed ${maxPoints}`);
  }
  const { reason, ...changes } = req.body;
  const updated = await prisma.$transaction(async tx => {
    const row = await tx.grade.update({ where: { id: grade.id }, data: changes });
    if (changes.score != null && changes.score !== grade.score) {
      await tx.gradeHistory.create({
        data: {
          organizationId: org(req), gradeId: row.id, changedByUserId: instructorId,
          previousScore: grade.score, newScore: row.score, reason,
        },
      });
    }
    await enqueueAcademicEvent(tx, EVENTS.GRADE_REVISED, org(req), { gradeId: row.id, studentId: row.studentId, score: row.score });
    return row;
  });
  return res.json({ success: true, data: updated });
};

export const recordAttendance = async (req: Request, res: Response) => {
  const organizationId = org(req);
  const cohort = await prisma.cohort.findFirst({
    where: {
      id: req.body.cohortId,
      organizationId,
      ...(req.user!.role === 'INSTRUCTOR' ? { course: { instructorId: req.user!.userId } } : {}),
      enrollments: { some: { userId: req.body.studentId } },
    },
  });
  if (!cohort) throw AppError.badRequest('Student is not enrolled in this cohort');
  const { absenceThreshold } = await getOrganizationAttendancePolicy(organizationId);
  const attendance = await prisma.$transaction(async tx => {
    const row = await tx.attendance.create({ data: { ...req.body, organizationId } });
    const notify = await computeNotificationPayload(tx, organizationId, row.cohortId, row.studentId, row.status, absenceThreshold);
    await enqueueAcademicEvent(tx, EVENTS.ATTENDANCE_RECORDED, organizationId, {
      attendanceId: row.id, cohortId: row.cohortId, studentId: row.studentId, status: row.status,
      date: row.date.toISOString(), changeId: row.updatedAt.toISOString(), ...notify,
    });
    return row;
  });
  return res.status(201).json({ success: true, data: attendance });
};

export const updateAttendance = async (req: Request, res: Response) => {
  const attendance = await prisma.attendance.findFirst({
    where: {
      id: req.params.id,
      organizationId: org(req),
      ...(req.user!.role === 'INSTRUCTOR'
        ? { cohort: { course: { instructorId: req.user!.userId } } }
        : {}),
    },
  });
  if (!attendance) throw AppError.notFound('Attendance record not found');
  const { reason, ...changes } = req.body;
  const { absenceThreshold } = await getOrganizationAttendancePolicy(org(req));
  const updated = await prisma.$transaction(async tx => {
    const row = await tx.attendance.update({ where: { id: attendance.id }, data: changes });
    if (changes.status && changes.status !== attendance.status) {
      await tx.attendanceHistory.create({
        data: {
          organizationId: org(req), attendanceId: row.id, changedByUserId: req.user!.userId,
          previousStatus: attendance.status, newStatus: row.status, reason,
        },
      });
    }
    const notify = await computeNotificationPayload(tx, org(req), row.cohortId, row.studentId, row.status, absenceThreshold);
    await enqueueAcademicEvent(tx, EVENTS.ATTENDANCE_UPDATED, org(req), {
      attendanceId: row.id, studentId: row.studentId, status: row.status,
      date: row.date.toISOString(), changeId: row.updatedAt.toISOString(), ...notify,
    });
    return row;
  });
  return res.json({ success: true, data: updated });
};
