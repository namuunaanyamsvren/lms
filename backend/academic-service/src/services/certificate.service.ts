import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Prisma } from '@prisma/client-academic';
import { AppError } from '@lms/shared';
import { EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from './event-outbox.service';
import { computeCourseGrade } from './grade.service';
import { getOrganizationGradingScale } from './organization-grading-policy.service';

import { prisma } from '../lib/prisma';
const storageRoot = path.resolve(process.env.CERTIFICATE_STORAGE_PATH || '/tmp/lms-private-certificates');
const publicBase = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const safeName = (value: string) => value.replace(/[\r\n]/g, ' ').slice(0, 200);

const createCode = () => crypto.randomBytes(9).toString('base64url').toUpperCase();

// Admin-supplied CertificateTemplate.logoUrl is an arbitrary URL, so this is
// intentionally not fetched by the backend. Certificate issuance must not make
// outbound requests to tenant-controlled URLs.
const fetchLogoBuffer = async (logoUrl?: string | null): Promise<Buffer | null> => {
  if (!logoUrl) return null;
  return null;
};

async function renderPdf(input: { title: string; issuer: string; recipient: string; course: string; code: string; issuedAt: Date; accent: string; signature?: string | null; logo?: Buffer | null }) {
  const verifyUrl = `${publicBase}/verify/certificate/${encodeURIComponent(input.code)}`;
  const qr = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: 'M', margin: 1, width: 180 });
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 55, bottom: 55, left: 65, right: 65 }, info: { Title: input.title, Author: input.issuer } });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  doc.rect(24, 24, 793, 547).lineWidth(4).stroke(input.accent);
  if (input.logo) {
    try { doc.image(input.logo, 373, 34, { fit: [90, 60], align: 'center' }); } catch { /* unsupported/corrupt image bytes — skip, don't fail issuance */ }
  }
  doc.font('Helvetica-Bold').fontSize(30).fillColor(input.accent).text(safeName(input.title), { align: 'center' });
  doc.moveDown(1.2).font('Helvetica').fontSize(15).fillColor('#475569').text('This certifies that', { align: 'center' });
  doc.moveDown(.6).font('Helvetica-Bold').fontSize(28).fillColor('#0f172a').text(safeName(input.recipient), { align: 'center' });
  doc.moveDown(.7).font('Helvetica').fontSize(15).fillColor('#475569').text('has successfully completed', { align: 'center' });
  doc.moveDown(.5).font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(safeName(input.course), { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor('#64748b').text(`Issued ${input.issuedAt.toISOString().slice(0, 10)} · ${safeName(input.issuer)}`, 80, 430, { width: 520, align: 'center' });
  if (input.signature) doc.text(safeName(input.signature), 80, 460, { width: 520, align: 'center' });
  doc.image(qr, 655, 385, { width: 115 });
  doc.fontSize(8).text(`Verify: ${input.code}`, 635, 505, { width: 155, align: 'center' });
  doc.end();
  return done;
}

export async function issueCertificate(
  organizationId: string,
  studentId: string,
  courseId: string,
  issuedByUserId?: string,
  reissuedFromId?: string,
  enrollmentId?: string,
) {
  const existing = await prisma.certificate.findFirst({ where: { organizationId, studentId, courseId, revokedAt: null } });
  if (existing && !reissuedFromId) return existing;
  const [student, course, template] = await Promise.all([
    prisma.user.findFirst({ where: { id: studentId, organizationId }, select: { firstName: true, lastName: true } }),
    prisma.course.findFirst({ where: { id: courseId, organizationId }, select: { title: true } }),
    prisma.certificateTemplate.findFirst({ where: { organizationId, isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ]);
  if (!student || !course) throw AppError.notFound('Student or course not found');
  const issuedAt = new Date(); const code = createCode();
  const recipientName = `${student.lastName} ${student.firstName}`.trim();
  const issuer = template?.issuerName || 'EduPulse LMS';
  const logo = await fetchLogoBuffer(template?.logoUrl);
  const pdf = await renderPdf({ title: template?.title || 'Certificate of Completion', issuer, recipient: recipientName, course: course.title, code, issuedAt, accent: template?.accentColor || '#4E00AB', signature: template?.signatureName, logo });
  const storageKey = `${organizationId}/${code}.pdf`; const target = path.join(storageRoot, storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, pdf, { mode: 0o600 });
  try {
    return await prisma.$transaction(async tx => {
      const certificate = await tx.certificate.create({ data: { organizationId, studentId, courseId, enrollmentId, templateId: template?.id, verificationCode: code, storageKey, recipientName, courseTitle: course.title, issuedAt, issuedByUserId, reissuedFromId } });
      await enqueueAcademicEvent(tx, EVENTS.CERTIFICATE_ISSUED, organizationId, { certificateId: certificate.id, studentId, courseId, verificationCode: code });
      return certificate;
    });
  } catch (error: any) {
    await fs.unlink(target).catch(() => undefined);
    // A concurrent issueCertificate call for the same student+course can win the
    // race against the DB's partial unique index (Certificate_active_unique,
    // see schema.prisma) — treat that as success and return whichever row won,
    // rather than surfacing a 500 for what is really just a duplicate issuance attempt.
    if (error?.code === 'P2002') {
      const raceWinner = await prisma.certificate.findFirst({ where: { organizationId, studentId, courseId, revokedAt: null } });
      if (raceWinner) return raceWinner;
    }
    throw error;
  }
}

// Renders a sample PDF from in-progress template field values — never
// persisted, no Certificate/verification-code row created — so an admin can
// see layout/logo/signature/accent-color placement before saving a template.
export const renderCertificatePreview = async (input: {
  title?: string; issuerName?: string; accentColor?: string; signatureName?: string; logoUrl?: string;
}) => {
  const logo = await fetchLogoBuffer(input.logoUrl);
  return renderPdf({
    title: input.title || 'Certificate of Completion',
    issuer: input.issuerName || 'EduPulse LMS',
    recipient: 'Бат-Эрдэнэ Болдбаатар',
    course: 'Жишээ курсын нэр',
    code: 'PREVIEW-SAMPLE',
    issuedAt: new Date(),
    accent: input.accentColor || '#4E00AB',
    signature: input.signatureName,
    logo,
  });
};

export const verifyCertificate = async (code: string) => {
  const cert = await prisma.certificate.findUnique({ where: { verificationCode: code.toUpperCase() } });
  if (!cert) return null;
  const parts = cert.recipientName.split(/\s+/); const masked = parts.map(p => p.length < 2 ? '*' : `${p[0]}${'*'.repeat(Math.min(p.length - 1, 6))}`).join(' ');
  return { valid: !cert.revokedAt, status: cert.revokedAt ? 'REVOKED' : 'VALID', recipient: masked, courseTitle: cert.courseTitle, issuedAt: cert.issuedAt, verificationCode: cert.verificationCode, revokedAt: cert.revokedAt };
};

// Pure so it's unit-testable without a DB: "passed" means the course grade
// resolved to something other than the bottom (failing) letter, mirroring
// how the letter scale already treats 'F' everywhere else in the app.
export const isPassingGrade = (grade: { hasGrades: boolean; letter: string | null }): boolean =>
  grade.hasGrades && grade.letter != null && grade.letter !== 'F';

const isAdmin = (role: string) => ['ORG_ADMIN', 'SUPER_ADMIN'].includes(role);
const editableCourseWhere = (actor: { userId: string; role: string }) =>
  isAdmin(actor.role) ? {} : { OR: [{ instructorId: actor.userId }, { instructors: { some: { userId: actor.userId } } }] };

export type CohortCompletionOutcome = { studentId: string; outcome: 'issued' | 'already-issued' | 'not-passing' };

// The P0 flow the audit asked for: marking a cohort complete finds every
// enrolled student, checks whether their computed course grade passes, and
// issues (or reuses) a certificate for each one — rather than certificates
// only ever appearing as a side-effect of clicking through 100% of lessons
// (completeLesson, course.service.ts), which never looks at grades at all.
export const completeCohort = async (
  organizationId: string,
  actor: { userId: string; role: string },
  cohortId: string,
): Promise<{ cohortId: string; courseId: string; courseTitle: string; results: CohortCompletionOutcome[] }> => {
  const cohort = await prisma.cohort.findFirst({
    where: { id: cohortId, organizationId, course: editableCourseWhere(actor) },
    include: { enrollments: true, course: { select: { id: true, title: true } } },
  });
  if (!cohort) throw AppError.notFound('Cohort not found');

  if (cohort.status !== 'COMPLETED') {
    await prisma.cohort.update({ where: { id: cohort.id }, data: { status: 'COMPLETED' } });
  }

  const gradingScale = await getOrganizationGradingScale(organizationId);
  const results: CohortCompletionOutcome[] = [];
  for (const enrollment of cohort.enrollments) {
    const grade = await computeCourseGrade(organizationId, enrollment.userId, cohort.courseId, gradingScale);
    if (!isPassingGrade(grade)) {
      results.push({ studentId: enrollment.userId, outcome: 'not-passing' });
      continue;
    }
    const existing = await prisma.certificate.findFirst({
      where: { organizationId, studentId: enrollment.userId, courseId: cohort.courseId, revokedAt: null },
    });
    if (existing) {
      results.push({ studentId: enrollment.userId, outcome: 'already-issued' });
      continue;
    }
    await issueCertificate(organizationId, enrollment.userId, cohort.courseId, actor.userId, undefined, enrollment.id);
    results.push({ studentId: enrollment.userId, outcome: 'issued' });
  }

  return { cohortId: cohort.id, courseId: cohort.courseId, courseTitle: cohort.course.title, results };
};

export const certificateFile = async (organizationId: string, id: string, userId: string, role: string) => {
  const audience: Prisma.CertificateWhereInput = role === 'STUDENT' ? { studentId: userId } : role === 'INSTRUCTOR' ? { course: { instructorId: userId } } : {};
  const cert = await prisma.certificate.findFirst({ where: { id, organizationId, ...audience } });
  if (!cert) throw AppError.notFound('Certificate not found');
  return { cert, bytes: await fs.readFile(path.join(storageRoot, cert.storageKey)) };
};

export { prisma as certificatePrisma };
