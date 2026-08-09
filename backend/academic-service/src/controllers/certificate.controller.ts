import { Request, Response } from 'express';
import { AppError } from '@lms/shared';
import { certificateFile, certificatePrisma as prisma, completeCohort, issueCertificate, renderCertificatePreview, verifyCertificate } from '../services/certificate.service';

export const verify = async (req: Request, res: Response) => {
  const data = await verifyCertificate(req.params.code);
  if (!data) throw AppError.notFound('Certificate not found');
  // Public verification result; short cache since revocation can invalidate it at any time.
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ success: true, data });
};
export const list = async (req: Request, res: Response) => {
  const { role, userId } = req.user!;
  const audience = role === 'STUDENT' ? { studentId: userId } : role === 'INSTRUCTOR' ? { course: { instructorId: userId } } : role === 'PARENT' ? { student: { guardianAsStudent: { some: { parentUserId: userId } } } } : {};
  const data = await prisma.certificate.findMany({ where: { organizationId: req.organizationId!, ...audience }, include: { student: { select: { firstName: true, lastName: true } }, template: { select: { name: true } } }, orderBy: { issuedAt: 'desc' } });
  res.json({ success: true, data });
};
export const download = async (req: Request, res: Response) => {
  const { cert, bytes } = await certificateFile(req.organizationId!, req.params.id, req.user!.userId, req.user!.role);
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="certificate-${cert.verificationCode}.pdf"`); res.setHeader('Cache-Control', 'private, no-store'); res.send(bytes);
};
export const revoke = async (req: Request, res: Response) => {
  const cert = await prisma.certificate.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
  if (!cert) throw AppError.notFound('Certificate not found');
  if (cert.revokedAt) throw AppError.conflict('Certificate already revoked');
  const data = await prisma.certificate.update({ where: { id: cert.id }, data: { revokedAt: new Date(), revokedByUserId: req.user!.userId, revocationReason: req.body.reason } });
  res.json({ success: true, data });
};
export const reissue = async (req: Request, res: Response) => {
  const cert = await prisma.certificate.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
  if (!cert) throw AppError.notFound('Certificate not found');
  if (!cert.revokedAt) await prisma.certificate.update({ where: { id: cert.id }, data: { revokedAt: new Date(), revokedByUserId: req.user!.userId, revocationReason: req.body.reason || 'Reissued' } });
  res.status(201).json({ success: true, data: await issueCertificate(req.organizationId!, cert.studentId, cert.courseId, req.user!.userId, cert.id, cert.enrollmentId ?? undefined) });
};
export const completeCohortCertificates = async (req: Request, res: Response) => {
  const data = await completeCohort(req.organizationId!, req.user!, req.params.cohortId);
  res.json({ success: true, data });
};
export const previewTemplate = async (req: Request, res: Response) => {
  const pdf = await renderCertificatePreview(req.body);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="certificate-preview.pdf"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
};
export const createTemplate = async (req: Request, res: Response) => {
  if (req.body.isDefault) await prisma.certificateTemplate.updateMany({ where: { organizationId: req.organizationId! }, data: { isDefault: false } });
  res.status(201).json({ success: true, data: await prisma.certificateTemplate.create({ data: { ...req.body, organizationId: req.organizationId! } }) });
};
export const listTemplates = async (req: Request, res: Response) => res.json({ success: true, data: await prisma.certificateTemplate.findMany({ where: { organizationId: req.organizationId! }, orderBy: { createdAt: 'desc' } }) });
