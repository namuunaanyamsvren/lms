import { Router } from 'express';
import { asyncHandler, authMiddleware, createPrincipalRateLimiter, idempotencyMiddleware, tenantMiddleware, requireRole } from '@lms/shared';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import {
  getCohorts,
  getAssignments,
  getSubmissions,
  getAttendance,
  getGrades,
  getUsers,
  getTeacherStudents,
  getAvailableStudents,
  getStudentDashboard,
  getAdminDashboard,
  getTeacherDashboard,
  getParentDashboard,
  getStaffDashboard,
  getPrincipalDashboard,
  getFinanceDashboard,
} from '../controllers/academic.controller';
import {
  addAssignmentAttachment,
  addSubmissionAttachment,
  createAssignment,
  createCohort,
  deleteAssignment,
  deleteEnrollment,
  importCohortEnrollments,
  enrollStudent,
  gradeSubmission,
  recordAttendance,
  removeAssignmentAttachment,
  removeSubmissionAttachment,
  submitAssignment,
  updateAssignment,
  updateAttendance,
  updateGrade,
  updateSubmission,
} from '../controllers/academic-write.controller';
import {
  createAnnouncement,
  listAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  addAttachment,
  removeAttachment
} from '../controllers/announcement.controller';
import * as courseController from '../controllers/course.controller';
import * as courseSchemas from '../validators/course.validator';
import * as academicStructureController from '../controllers/academic-structure.controller';
import * as academicStructureSchemas from '../validators/academic-structure.validator';
import * as quizController from '../controllers/quiz.controller';
import * as quizSchemas from '../validators/quiz.validator';
import * as gradeController from '../controllers/grade.controller';
import * as gradeSchemas from '../validators/grade.validator';
import * as attendanceController from '../controllers/attendance.controller';
import * as attendanceSchemas from '../validators/attendance.validator';
import {
  getAuditLogs,
  getCertificates,
  getSystemHealth,
} from '../controllers/resource.controller';
import {
  createGuardianLink,
  listGuardianLinks,
  respondToGuardianLink,
  revokeGuardianLink,
  updateGuardianLink,
} from '../controllers/guardian.controller';
import {
  listDocumentRequests,
  getDocumentRequest,
  createDocumentRequest,
  updateDocumentRequest,
  updateDocumentRequestStatus,
  cancelDocumentRequest,
  listScholarshipRequests,
  getScholarshipRequest,
  createScholarshipRequest,
  updateScholarshipRequest,
  updateScholarshipRequestStatus,
  cancelScholarshipRequest,
} from '../controllers/staff-workflow.controller';
import {
  acknowledgeConsentForm,
  createConsentForm,
  listConsentAcknowledgements,
  listConsentForms,
  publishConsentForm,
  updateConsentForm,
} from '../controllers/consent.controller';
import {
  getReportCatalog,
  getReportData,
  exportReport,
  createReportJob,
  listReportJobs,
  getReportJobDownload,
  createReportSchedule,
  listReportSchedules,
  updateReportSchedule,
  deleteReportSchedule,
} from '../controllers/report.controller';
import {
  acknowledgeConsentBody,
  consentFormBody,
  consentFormIdParams,
  consentFormListQuery,
  consentFormUpdateBody,
} from '../validators/consent.validator';
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  getScheduleOptions,
  listMySchedules,
  listSchedules,
  updateSchedule,
} from '../controllers/schedule.controller';
import {
  scheduleBody,
  scheduleIdParams,
  scheduleQuery,
  scheduleUpdateBody,
} from '../validators/schedule.validator';
import { downloadFile, inspectFile, signFile } from '../controllers/upload.controller';
import express from 'express';
import * as certificateController from '../controllers/certificate.controller';

const router = Router();
const entityId = z.string().trim().min(1).max(200);
const idParams = z.object({ id: entityId }).strict();
const cohortParams = z.object({ cohortId: entityId }).strict();
const assignmentParams = z.object({ assignmentId: entityId }).strict();
const attachmentParams = z.object({ id: entityId, attachmentId: entityId }).strict();
const submissionParams = z.object({ submissionId: entityId }).strict();
const submissionAttachmentParams = z.object({ submissionId: entityId, attachmentId: entityId }).strict();
const noQuery = z.object({}).strict();

const assignmentBody = z.object({
  moduleId: entityId,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  dueDate: z.coerce.date(),
  maxPoints: z.number().finite().positive().max(10000),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  publishAt: z.coerce.date().optional(),
  allowLateSubmission: z.boolean().default(true),
  lateDeadline: z.coerce.date().optional(),
  latePenaltyPercentPerDay: z.number().min(0).max(100).default(0),
}).strict();
const assignmentUpdateBody = assignmentBody.omit({ moduleId: true }).partial()
  .refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
const assignmentAttachmentBody = z.object({ fileAssetId: z.string().uuid() }).strict();
const commitHashSchema = z.string().trim().regex(/^[0-9a-f]{7,40}$/i, 'commitHash must be a hex git commit SHA').optional();
const submissionBody = z.object({
  content: z.string().trim().max(20000).optional(),
  fileUrl: z.string().url().max(2000).optional(),
  repoUrl: z.string().url().max(2000).optional(),
  commitHash: commitHashSchema,
  fileAssetIds: z.array(z.string().uuid()).max(10).default([]),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('SUBMITTED'),
}).strict().refine(value => value.status === 'DRAFT' || value.content || value.fileUrl || value.repoUrl || value.fileAssetIds.length, {
  message: 'content, fileUrl, repoUrl, or a file attachment is required to submit',
});
const submissionUpdateBody = z.object({
  content: z.string().trim().max(20000).optional(),
  fileUrl: z.string().url().max(2000).optional(),
  repoUrl: z.string().url().max(2000).optional(),
  commitHash: commitHashSchema,
  status: z.enum(['DRAFT', 'SUBMITTED']).optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
const submissionAttachmentBody = z.object({ fileAssetId: z.string().uuid() }).strict();
const gradeBody = z.object({
  score: z.number().finite().min(0),
  feedback: z.string().trim().max(5000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  reason: z.string().trim().max(2000).optional(),
  requestResubmit: z.boolean().optional(),
  resubmitReason: z.string().trim().max(2000).optional(),
}).strict();
const cohortBody = z.object({
  courseId: entityId,
  name: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  seatLimit: z.number().int().positive().max(10000).optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  scheduleJson: z.record(z.any()).optional(),
}).strict();
const announcementBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  scheduledAt: z.coerce.date().optional(),
  targetRoles: z.array(z.enum(['STUDENT', 'INSTRUCTOR', 'PARENT', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'FINANCE'])).optional(),
  targetUserIds: z.array(z.string().uuid()).optional(),
}).strict();
const announcementUpdateBody = announcementBody.partial().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
// `fileUrl` stores a private FileAsset storage key (signed on demand via
// POST /uploads/sign), not a public URL — mirrors profileImageKey elsewhere.
const announcementAttachmentBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().min(1).max(2000),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().trim().max(100).optional(),
}).strict();

const documentRequestBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  documentType: z.string().trim().min(1).max(100),
  fileUrl: z.string().trim().min(1).max(2000).optional(),
  fileName: z.string().trim().max(255).optional(),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().trim().max(100).optional(),
}).strict();
const documentRequestUpdateBody = documentRequestBody.partial().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
const documentRequestStatusBody = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED']),
  rejectionReason: z.string().trim().max(1000).optional(),
}).strict();

const scholarshipRequestBody = z.object({
  program: z.string().trim().min(1).max(200),
  applicationData: z.record(z.any()).optional(),
}).strict();
const scholarshipRequestUpdateBody = z.object({
  applicationData: z.record(z.any()).optional(),
}).strict();
const scholarshipRequestStatusBody = z.object({
  status: z.enum(['NEW', 'UNDER_REVIEW', 'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED']),
  rejectionReason: z.string().trim().max(1000).optional(),
}).strict();
const guardianRequestBody = z.object({
  studentCode: z.string().trim().min(2).max(50).optional(),
  studentIdentifier: z.string().trim().min(2).max(50).optional(),
  guardianLinkCode: z.string().trim().min(4).max(50).optional(),
}).strict().refine(value => value.studentCode || value.studentIdentifier, {
  message: 'studentCode is required',
});

// Health check endpoint stays public (liveness probe, used by other services' dashboards)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'academic-service' });
});

router.get('/certificates/verify/:code',
  createPrincipalRateLimiter({ windowMs: 60_000, max: 30 }),
  validate('params', z.object({ code: z.string().trim().min(8).max(32).regex(/^[A-Za-z0-9_-]+$/) }).strict()),
  asyncHandler(certificateController.verify));

// Public only by possession of a short-lived, tenant-bound HMAC URL. The
// controller verifies signature/expiry and streams from a private storage origin.
router.get(
  '/uploads/download',
  validate('query', z.object({
    key: z.string().min(3).max(1000),
    organizationId: z.string().min(1).max(200),
    expires: z.coerce.number().int().positive(),
    signature: z.string().min(40).max(100),
  }).strict()),
  asyncHandler(downloadFile),
);

// Everything below requires a valid JWT; tenantMiddleware resolves the real organizationId from it.
router.use(authMiddleware, tenantMiddleware, createPrincipalRateLimiter());

// Binary data is persisted only after extension, declared MIME, magic-byte and
// malware checks.
router.post(
  '/uploads',
  requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR', 'STAFF', 'STUDENT'),
  createPrincipalRateLimiter({ windowMs: 60_000, max: 20 }),
  express.raw({ type: () => true, limit: '50mb' }),
  asyncHandler(inspectFile),
);
router.post(
  '/uploads/inspect',
  requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR', 'STAFF', 'STUDENT'),
  createPrincipalRateLimiter({ windowMs: 60_000, max: 20 }),
  express.raw({ type: () => true, limit: '50mb' }),
  asyncHandler(inspectFile),
);
router.post(
  '/uploads/sign',
  requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR', 'STAFF', 'STUDENT'),
  createPrincipalRateLimiter({ windowMs: 60_000, max: 60 }),
  validate('body', z.object({
    fileKey: z.string().min(3).max(1000),
    expiresInSeconds: z.number().int().min(1).max(900).optional(),
  }).strict()),
  asyncHandler(signFile),
);

router.get('/academic-structure', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF', 'INSTRUCTOR'), validate('query', noQuery), asyncHandler(academicStructureController.overview));
router.get('/academic-structure/:resource', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF', 'INSTRUCTOR'), validate('params', academicStructureSchemas.resourceParams), validate('query', academicStructureSchemas.listQuery), asyncHandler(academicStructureController.list));
router.post('/academic-structure/years/:id/rollover', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', academicStructureSchemas.rolloverParams), validate('body', academicStructureSchemas.rolloverBody), asyncHandler(academicStructureController.rollover));
router.post('/academic-structure/:resource', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', academicStructureSchemas.resourceParams), validate('body', academicStructureSchemas.payload), asyncHandler(academicStructureController.create));
router.put('/academic-structure/:resource/:id', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', academicStructureSchemas.resourceIdParams), validate('body', academicStructureSchemas.updatePayload), asyncHandler(academicStructureController.update));
router.delete('/academic-structure/:resource/:id', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', academicStructureSchemas.resourceIdParams), asyncHandler(academicStructureController.remove));

// Courses & Modules
router.get('/courses', validate('query', courseSchemas.courseListQuery), asyncHandler(courseController.list));
router.post('/courses/import', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('body', courseSchemas.courseBody), asyncHandler(courseController.importCourse));
router.get('/courses/:id', validate('params', courseSchemas.idParams), validate('query', noQuery), asyncHandler(courseController.get));
router.get('/courses/:id/versions', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('query', noQuery), asyncHandler(courseController.versions));
router.get('/courses/:id/versions/compare', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('query', courseSchemas.versionCompareQuery), asyncHandler(courseController.compareVersions));
router.post('/courses/:id/versions/:version/restore', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.versionParams), asyncHandler(courseController.restoreVersion));
router.post('/courses', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('body', courseSchemas.courseBody), asyncHandler(courseController.create));
router.put('/courses/:id', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('body', courseSchemas.courseUpdateBody), asyncHandler(courseController.update));
router.delete('/courses/:id', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', courseSchemas.idParams), asyncHandler(courseController.remove));
router.post('/courses/:id/duplicate', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('body', courseSchemas.duplicateBody), asyncHandler(courseController.duplicate));
router.post('/courses/:id/instructors', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('body', z.object({ userId: z.string().uuid() }).strict()), asyncHandler(courseController.addInstructor));
router.delete('/courses/:id/instructors/:userId', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.instructorParams), asyncHandler(courseController.removeInstructor));
router.post('/courses/:id/modules', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('body', courseSchemas.moduleBody), asyncHandler(courseController.createModule));
router.put('/modules/:moduleId', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.moduleParams), validate('body', courseSchemas.moduleBody), asyncHandler(courseController.updateModule));
router.delete('/modules/:moduleId', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.moduleParams), asyncHandler(courseController.removeModule));
router.put('/courses/:id/modules/reorder', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.idParams), validate('body', courseSchemas.orderBody), asyncHandler(courseController.reorderModules));
router.post('/modules/:moduleId/lessons', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.moduleParams), validate('body', courseSchemas.lessonBody), asyncHandler(courseController.createLesson));
router.put('/lessons/:lessonId', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.lessonParams), validate('body', courseSchemas.lessonUpdateBody), asyncHandler(courseController.updateLesson));
router.delete('/lessons/:lessonId', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.lessonParams), asyncHandler(courseController.removeLesson));
router.put('/modules/:moduleId/lessons/reorder', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR'), validate('params', courseSchemas.moduleParams), validate('body', courseSchemas.orderBody), asyncHandler(courseController.reorderLessons));
router.post('/lessons/:lessonId/complete', requireRole('STUDENT'), validate('params', courseSchemas.lessonParams), asyncHandler(courseController.completeLesson));

// Course schedules. Read access is enrollment/guardian scoped in the service;
// organizationId and the acting teacher always come from the verified JWT.
router.get('/schedules', validate('query', scheduleQuery), asyncHandler(listSchedules));
router.get('/schedules/me', validate('query', scheduleQuery), asyncHandler(listMySchedules));
router.get('/schedules/options', validate('query', noQuery), asyncHandler(getScheduleOptions));
router.get('/schedules/:id', validate('params', scheduleIdParams), validate('query', noQuery), asyncHandler(getSchedule));
router.post(
  '/schedules',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'),
  validate('body', scheduleBody),
  asyncHandler(createSchedule),
);
router.put(
  '/schedules/:id',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'),
  validate('params', scheduleIdParams),
  validate('body', scheduleUpdateBody),
  asyncHandler(updateSchedule),
);
router.delete(
  '/schedules/:id',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'),
  validate('params', scheduleIdParams),
  asyncHandler(deleteSchedule),
);

// Cohorts
router.get('/cohorts', validate('query', noQuery), getCohorts);
router.post(
  '/cohorts',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('body', cohortBody),
  asyncHandler(createCohort),
);
router.post(
  '/cohorts/:cohortId/enrollments',
  requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'STAFF', 'INSTRUCTOR'),
  validate('params', cohortParams),
  validate('body', z.object({ userId: z.string().trim().min(1).max(100) }).strict()),
  asyncHandler(enrollStudent),
);
router.post(
  '/cohorts/:cohortId/enrollments/import',
  requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'STAFF', 'INSTRUCTOR'),
  validate('params', cohortParams),
  validate('body', z.object({ csv: z.string().min(1).max(5 * 1024 * 1024) }).strict()),
  asyncHandler(importCohortEnrollments),
);
router.delete(
  '/enrollments/:id',
  requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'STAFF', 'INSTRUCTOR'),
  validate('params', idParams),
  asyncHandler(deleteEnrollment),
);

// Assignments
router.get('/assignments', validate('query', noQuery), getAssignments);
router.post('/assignments', requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'), validate('body', assignmentBody), asyncHandler(createAssignment));
router.put('/assignments/:id', requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'), validate('params', idParams), validate('body', assignmentUpdateBody), asyncHandler(updateAssignment));
router.delete('/assignments/:id', requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'), validate('params', idParams), asyncHandler(deleteAssignment));
router.post(
  '/assignments/:id/attachments',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  validate('body', assignmentAttachmentBody),
  asyncHandler(addAssignmentAttachment),
);
router.delete(
  '/assignments/:id/attachments/:attachmentId',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', attachmentParams),
  asyncHandler(removeAssignmentAttachment),
);
router.post(
  '/assignments/:assignmentId/submissions',
  requireRole('STUDENT'),
  idempotencyMiddleware('assignment-submission'),
  validate('params', assignmentParams),
  validate('body', submissionBody),
  asyncHandler(submitAssignment),
);
router.put(
  '/submissions/:submissionId',
  requireRole('STUDENT'),
  validate('params', submissionParams),
  validate('body', submissionUpdateBody),
  asyncHandler(updateSubmission),
);
router.post(
  '/submissions/:submissionId/attachments',
  requireRole('STUDENT'),
  validate('params', submissionParams),
  validate('body', submissionAttachmentBody),
  asyncHandler(addSubmissionAttachment),
);
router.delete(
  '/submissions/:submissionId/attachments/:attachmentId',
  requireRole('STUDENT'),
  validate('params', submissionAttachmentParams),
  asyncHandler(removeSubmissionAttachment),
);
router.post(
  '/submissions/:submissionId/grades',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', submissionParams),
  validate('body', gradeBody),
  asyncHandler(gradeSubmission),
);
router.get('/submissions', getSubmissions);
router.put('/grades/:id', requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'), validate('params', idParams), validate('body', gradeBody.partial()), asyncHandler(updateGrade));

// Quiz/exam domain
router.get('/quizzes', validate('query', quizSchemas.listQuery), asyncHandler(quizController.list));
router.get('/question-bank', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('query', quizSchemas.bankQuery), asyncHandler(quizController.bank));
router.get('/quizzes/:id', validate('params', quizSchemas.id), asyncHandler(quizController.get));
router.post('/quizzes', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('body', quizSchemas.quizBody), asyncHandler(quizController.create));
router.put('/quizzes/:id', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), validate('body', quizSchemas.quizUpdate), asyncHandler(quizController.update));
router.delete('/quizzes/:id', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), asyncHandler(quizController.remove));
router.post('/quizzes/:id/questions', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), validate('body', quizSchemas.questionBody), asyncHandler(quizController.createQuestion));
router.post('/quizzes/:id/question-links', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), validate('body', quizSchemas.linkQuestion), asyncHandler(quizController.link));
router.delete('/quizzes/:id/question-links/:questionId', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.quizQuestionParams), asyncHandler(quizController.unlink));
router.put('/questions/:id', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), validate('body', quizSchemas.questionUpdate), asyncHandler(quizController.updateQuestion));
router.delete('/questions/:id', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), asyncHandler(quizController.deleteQuestion));
router.post('/quizzes/:id/attempts', requireRole('STUDENT'), validate('params', quizSchemas.id), asyncHandler(quizController.start));
router.get('/quizzes/:id/attempts/me', requireRole('STUDENT'), validate('params', quizSchemas.id), asyncHandler(quizController.history));
router.get('/quiz-attempts/:attemptId', requireRole('STUDENT'), validate('params', quizSchemas.attemptParams), asyncHandler(quizController.resume));
router.put('/quiz-attempts/:attemptId/answers/:questionId', requireRole('STUDENT'), validate('params', quizSchemas.answerParams), validate('body', quizSchemas.autosave), asyncHandler(quizController.save));
router.post('/quiz-attempts/:attemptId/submit', requireRole('STUDENT'), validate('params', quizSchemas.attemptParams), validate('body', quizSchemas.submit), asyncHandler(quizController.submit));
router.post('/quiz-attempts/:attemptId/audit-events', requireRole('STUDENT'), validate('params', quizSchemas.attemptParams), validate('body', quizSchemas.audit), asyncHandler(quizController.audit));
router.put('/quiz-attempts/:attemptId/answers/:questionId/grade', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.answerParams), validate('body', quizSchemas.grade), asyncHandler(quizController.grade));
router.get('/quizzes/:id/analytics', requireRole('INSTRUCTOR','ORG_ADMIN','SUPER_ADMIN'), validate('params', quizSchemas.id), asyncHandler(quizController.analytics));

// Attendance
router.get('/attendance', validate('query', attendanceSchemas.listQuery), getAttendance);
router.post(
  '/attendance',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'STAFF'),
  validate('body', z.object({
    cohortId: z.string().uuid(),
    studentId: z.string().uuid(),
    scheduleId: z.string().uuid().optional(),
    date: z.coerce.date(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    note: z.string().trim().max(2000).optional(),
  }).strict()),
  asyncHandler(recordAttendance),
);
router.put(
  '/attendance/:id',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'STAFF'),
  validate('params', idParams),
  validate('body', z.object({
    date: z.coerce.date().optional(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
    note: z.string().trim().max(2000).optional(),
    reason: z.string().trim().max(2000).optional(),
  }).strict().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' })),
  asyncHandler(updateAttendance),
);
router.post(
  '/attendance/batch',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'STAFF'),
  validate('body', attendanceSchemas.batchBody),
  asyncHandler(attendanceController.recordBatch),
);
router.get(
  '/attendance/export',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'STAFF'),
  validate('query', attendanceSchemas.exportQuery),
  asyncHandler(attendanceController.exportCsv),
);
router.get(
  '/attendance/:id/history',
  validate('params', attendanceSchemas.attendanceIdParams),
  asyncHandler(attendanceController.getHistory),
);

// Grades
router.get('/grades', validate('query', noQuery), getGrades);

// Grade categories
router.get(
  '/courses/:courseId/grade-categories',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.courseIdParams),
  asyncHandler(gradeController.listCategories),
);
router.post(
  '/courses/:courseId/grade-categories',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.courseIdParams),
  validate('body', gradeSchemas.categoryBody),
  asyncHandler(gradeController.createCategory),
);
router.put(
  '/grade-categories/:id',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  validate('body', gradeSchemas.categoryUpdateBody),
  asyncHandler(gradeController.updateCategory),
);
router.delete(
  '/grade-categories/:id',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  asyncHandler(gradeController.deleteCategory),
);

// Manual grades, publishing, history
router.post(
  '/grades/manual',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('body', gradeSchemas.manualGradeBody),
  asyncHandler(gradeController.createManualGrade),
);
router.post(
  '/grades/:id/publish',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.gradeIdParams),
  asyncHandler(gradeController.publishGrade),
);
router.get(
  '/grades/:id/history',
  validate('params', gradeSchemas.gradeIdParams),
  asyncHandler(gradeController.getGradeHistory),
);

// Grade appeals
router.post(
  '/grades/:id/appeals',
  requireRole('STUDENT'),
  validate('params', gradeSchemas.gradeIdParams),
  validate('body', gradeSchemas.appealBody),
  asyncHandler(gradeController.createAppeal),
);
router.get('/grades/appeals', asyncHandler(gradeController.listAppeals));
router.put(
  '/grades/appeals/:id',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.appealIdParams),
  validate('body', gradeSchemas.appealResolutionBody),
  asyncHandler(gradeController.resolveAppeal),
);

// Bulk import/export
router.post(
  '/assignments/:assignmentId/grades/bulk-import',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.assignmentIdParams),
  validate('body', gradeSchemas.bulkImportBody),
  asyncHandler(gradeController.bulkImportGrades),
);
router.get(
  '/assignments/:assignmentId/grades/export',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.assignmentIdParams),
  asyncHandler(gradeController.exportGradesCsv),
);

// Course gradebook and student transcript
router.get(
  '/courses/:courseId/gradebook',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.courseIdParams),
  asyncHandler(gradeController.getCourseGradebook),
);
router.get(
  '/students/:studentId/transcript',
  validate('params', gradeSchemas.studentIdParams),
  asyncHandler(gradeController.getTranscript),
);
router.get(
  '/courses/:courseId/at-risk-students',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', gradeSchemas.courseIdParams),
  asyncHandler(gradeController.getAtRiskStudents),
);

// Users
router.get('/users', getUsers);
router.get(
  '/students/available',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'),
  validate('query', noQuery),
  getAvailableStudents,
);
router.get(
  '/students',
  requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'STAFF'),
  validate('query', noQuery),
  getTeacherStudents,
);

// Remaining academic schema resources
router.post('/cohorts/:cohortId/complete', requireRole('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN'), validate('params', cohortParams), asyncHandler(certificateController.completeCohortCertificates));
router.get('/certificates', asyncHandler(certificateController.list));
router.get('/certificates/:id/download', validate('params', idParams), asyncHandler(certificateController.download));
router.post('/certificates/:id/revoke', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', idParams), validate('body', z.object({ reason: z.string().trim().min(3).max(500) }).strict()), asyncHandler(certificateController.revoke));
router.post('/certificates/:id/reissue', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('params', idParams), validate('body', z.object({ reason: z.string().trim().max(500).optional() }).strict()), asyncHandler(certificateController.reissue));
router.get('/certificate-templates', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), asyncHandler(certificateController.listTemplates));
router.post('/certificate-templates/preview', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('body', z.object({ title: z.string().trim().max(150).optional(), issuerName: z.string().trim().max(150).optional(), signatureName: z.string().trim().max(150).optional(), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), logoUrl: z.string().url().max(2000).optional() }).strict()), asyncHandler(certificateController.previewTemplate));
router.post('/certificate-templates', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validate('body', z.object({ name: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(150), issuerName: z.string().trim().min(1).max(150), signatureName: z.string().trim().max(150).optional(), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), logoUrl: z.string().url().max(2000).optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional() }).strict()), asyncHandler(certificateController.createTemplate));
router.get('/audit-logs', requireRole('ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'), asyncHandler(getAuditLogs));
router.get('/system-health', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), asyncHandler(getSystemHealth));

router.get(
  '/document-requests',
  asyncHandler(listDocumentRequests),
);
router.get(
  '/document-requests/:id',
  validate('params', idParams),
  asyncHandler(getDocumentRequest),
);
router.post(
  '/document-requests',
  requireRole('STUDENT'),
  validate('body', documentRequestBody),
  asyncHandler(createDocumentRequest),
);
router.put(
  '/document-requests/:id',
  validate('params', idParams),
  validate('body', documentRequestUpdateBody),
  asyncHandler(updateDocumentRequest),
);
router.patch(
  '/document-requests/:id/status',
  requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  validate('body', documentRequestStatusBody),
  asyncHandler(updateDocumentRequestStatus),
);
router.post(
  '/document-requests/:id/cancel',
  requireRole('STUDENT'),
  validate('params', idParams),
  asyncHandler(cancelDocumentRequest),
);
router.get(
  '/scholarship-requests',
  asyncHandler(listScholarshipRequests),
);
router.get(
  '/scholarship-requests/:id',
  validate('params', idParams),
  asyncHandler(getScholarshipRequest),
);
router.post(
  '/scholarship-requests',
  requireRole('STUDENT'),
  validate('body', scholarshipRequestBody),
  asyncHandler(createScholarshipRequest),
);
router.put(
  '/scholarship-requests/:id',
  validate('params', idParams),
  validate('body', scholarshipRequestUpdateBody),
  asyncHandler(updateScholarshipRequest),
);
router.patch(
  '/scholarship-requests/:id/status',
  requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  validate('body', scholarshipRequestStatusBody),
  asyncHandler(updateScholarshipRequestStatus),
);
router.post(
  '/scholarship-requests/:id/cancel',
  requireRole('STUDENT'),
  validate('params', idParams),
  asyncHandler(cancelScholarshipRequest),
);

router.get('/announcements', asyncHandler(listAnnouncements));
router.get('/announcements/:id', validate('params', idParams), asyncHandler(getAnnouncement));
router.post(
  '/announcements',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('body', announcementBody),
  asyncHandler(createAnnouncement),
);
router.put(
  '/announcements/:id',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  validate('body', announcementUpdateBody),
  asyncHandler(updateAnnouncement),
);
router.delete(
  '/announcements/:id',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  asyncHandler(deleteAnnouncement),
);
router.post(
  '/announcements/:id/publish',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  asyncHandler(publishAnnouncement),
);
router.post(
  '/announcements/:id/archive',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  asyncHandler(archiveAnnouncement),
);
router.post(
  '/announcements/:id/attachments',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  validate('body', announcementAttachmentBody),
  asyncHandler(addAttachment),
);
router.delete(
  '/announcements/:id/attachments/:attachmentId',
  requireRole('INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', attachmentParams),
  asyncHandler(removeAttachment),
);

router.get('/guardians', asyncHandler(listGuardianLinks));
router.post('/guardians', requireRole('PARENT'), validate('body', guardianRequestBody), asyncHandler(createGuardianLink));
router.patch(
  '/guardians/:id/respond',
  requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'),
  validate('params', idParams),
  asyncHandler(respondToGuardianLink),
);
router.patch(
  '/guardians/:id',
  requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'),
  validate('params', idParams),
  asyncHandler(updateGuardianLink),
);
router.delete('/guardians/:id', validate('params', idParams), asyncHandler(revokeGuardianLink));

const CONSENT_STAFF_ROLES = ['INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'] as const;

router.get('/consent-forms', validate('query', consentFormListQuery), asyncHandler(listConsentForms));
router.post(
  '/consent-forms',
  requireRole(...CONSENT_STAFF_ROLES),
  validate('body', consentFormBody),
  asyncHandler(createConsentForm),
);
router.patch(
  '/consent-forms/:id',
  requireRole(...CONSENT_STAFF_ROLES),
  validate('params', consentFormIdParams),
  validate('body', consentFormUpdateBody),
  asyncHandler(updateConsentForm),
);
router.post(
  '/consent-forms/:id/publish',
  requireRole(...CONSENT_STAFF_ROLES),
  validate('params', consentFormIdParams),
  asyncHandler(publishConsentForm),
);
router.get(
  '/consent-forms/:id/acknowledgements',
  requireRole(...CONSENT_STAFF_ROLES),
  validate('params', consentFormIdParams),
  asyncHandler(listConsentAcknowledgements),
);
router.post(
  '/consent-forms/:id/acknowledge',
  requireRole('PARENT'),
  validate('params', consentFormIdParams),
  validate('body', acknowledgeConsentBody),
  asyncHandler(acknowledgeConsentForm),
);

const REPORT_ROLES = ['INSTRUCTOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'FINANCE'] as const;
const reportTypeParams = z.object({ type: z.string().trim().min(1).max(100) }).strict();
const reportFilterQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  courseId: z.string().trim().min(1).max(200).optional(),
  cohortId: z.string().trim().min(1).max(200).optional(),
  format: z.enum(['csv', 'pdf']).optional(),
}).strict();
const reportJobBody = z.object({
  format: z.enum(['CSV', 'PDF']).optional(),
  filters: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    courseId: z.string().trim().min(1).max(200).optional(),
    cohortId: z.string().trim().min(1).max(200).optional(),
  }).strict().optional(),
}).strict();
const reportScheduleBody = z.object({
  reportType: z.string().trim().min(1).max(100),
  format: z.enum(['CSV', 'PDF']).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  filters: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    courseId: z.string().trim().min(1).max(200).optional(),
    cohortId: z.string().trim().min(1).max(200).optional(),
  }).strict().optional(),
}).strict();
const reportScheduleUpdateBody = z.object({ isActive: z.boolean() }).strict();

router.get('/reports/catalog', requireRole(...REPORT_ROLES), asyncHandler(getReportCatalog));
router.get('/reports/jobs', requireRole(...REPORT_ROLES), asyncHandler(listReportJobs));
router.get('/reports/jobs/:id/download', requireRole(...REPORT_ROLES), validate('params', idParams), asyncHandler(getReportJobDownload));
router.get('/reports/schedules', requireRole(...REPORT_ROLES), asyncHandler(listReportSchedules));
router.post('/reports/schedules', requireRole(...REPORT_ROLES), validate('body', reportScheduleBody), asyncHandler(createReportSchedule));
router.patch('/reports/schedules/:id', requireRole(...REPORT_ROLES), validate('params', idParams), validate('body', reportScheduleUpdateBody), asyncHandler(updateReportSchedule));
router.delete('/reports/schedules/:id', requireRole(...REPORT_ROLES), validate('params', idParams), asyncHandler(deleteReportSchedule));
router.get('/reports/:type', requireRole(...REPORT_ROLES), validate('params', reportTypeParams), validate('query', reportFilterQuery), asyncHandler(getReportData));
router.get('/reports/:type/export', requireRole(...REPORT_ROLES), validate('params', reportTypeParams), validate('query', reportFilterQuery), asyncHandler(exportReport));
router.post('/reports/:type/jobs', requireRole(...REPORT_ROLES), validate('params', reportTypeParams), validate('body', reportJobBody), asyncHandler(createReportJob));

// Dashboards — each scoped to its matching role
router.get('/dashboards/student', requireRole('STUDENT'), getStudentDashboard);
router.get('/dashboards/teacher', requireRole('INSTRUCTOR'), getTeacherDashboard);
router.get('/dashboards/admin', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), getAdminDashboard);
router.get('/dashboards/parent', requireRole('PARENT'), getParentDashboard);
router.get('/dashboards/staff', requireRole('STAFF'), getStaffDashboard);
router.get('/dashboards/principal', requireRole('PRINCIPAL'), getPrincipalDashboard);
router.get('/dashboards/finance', requireRole('FINANCE', 'ORG_ADMIN', 'SUPER_ADMIN'), getFinanceDashboard);

export default router;
