import { AppError, EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from './event-outbox.service';

import { prisma } from '../lib/prisma';

export type Actor = { userId: string; role: string };

const STAFF_LIKE_ROLES = ['INSTRUCTOR', 'STAFF', 'PRINCIPAL', 'ORG_ADMIN', 'SUPER_ADMIN'];

const consentFormSelect = {
  id: true,
  organizationId: true,
  title: true,
  body: true,
  requiresSignature: true,
  status: true,
  dueAt: true,
  createdById: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export const publishConsentForm = async (organizationId: string, actor: Actor, formId: string) => {
  if (!STAFF_LIKE_ROLES.includes(actor.role)) throw AppError.forbidden('Not authorized to publish consent forms');

  const form = await prisma.consentForm.findFirst({ where: { id: formId, organizationId } });
  if (!form) throw AppError.notFound('Consent form not found');
  if (form.status !== 'DRAFT') throw AppError.conflict('Only draft consent forms can be published');

  const guardians = await prisma.guardian.findMany({
    where: { organizationId, status: 'APPROVED' },
    select: { parentUserId: true, studentUserId: true },
  });

  const published = await prisma.$transaction(async tx => {
    if (guardians.length) {
      await tx.consentAcknowledgement.createMany({
        data: guardians.map(g => ({
          organizationId,
          consentFormId: form.id,
          studentUserId: g.studentUserId,
          parentUserId: g.parentUserId,
        })),
        skipDuplicates: true,
      });
    }
    const updated = await tx.consentForm.update({
      where: { id: form.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      select: consentFormSelect,
    });
    const recipientIds = [...new Set(guardians.map(g => g.parentUserId))];
    await enqueueAcademicEvent(tx, EVENTS.CONSENT_FORM_PUBLISHED, organizationId, {
      consentFormId: form.id,
      title: form.title,
      dueAt: form.dueAt ? form.dueAt.toISOString() : null,
      recipientIds,
    });
    return updated;
  });

  return published;
};

export const acknowledgeConsentForm = async (
  organizationId: string,
  actor: Actor,
  formId: string,
  input: { studentUserId: string; status: 'ACKNOWLEDGED' | 'DECLINED'; signatureName?: string },
) => {
  if (actor.role !== 'PARENT') throw AppError.forbidden('Only parents can respond to consent forms');

  const form = await prisma.consentForm.findFirst({ where: { id: formId, organizationId } });
  if (!form) throw AppError.notFound('Consent form not found');
  if (form.status !== 'PUBLISHED') throw AppError.conflict('Consent form is not open for responses');
  if (form.requiresSignature && input.status === 'ACKNOWLEDGED' && !input.signatureName) {
    throw AppError.badRequest('signatureName is required to acknowledge this form');
  }

  const acknowledgement = await prisma.consentAcknowledgement.findUnique({
    where: {
      consentFormId_studentUserId_parentUserId: {
        consentFormId: formId,
        studentUserId: input.studentUserId,
        parentUserId: actor.userId,
      },
    },
  });
  if (!acknowledgement) throw AppError.notFound('No consent acknowledgement found for this child');

  return prisma.consentAcknowledgement.update({
    where: { id: acknowledgement.id },
    data: {
      status: input.status,
      signatureName: input.status === 'ACKNOWLEDGED' ? input.signatureName : null,
      respondedAt: new Date(),
    },
  });
};

export { consentFormSelect, STAFF_LIKE_ROLES };
