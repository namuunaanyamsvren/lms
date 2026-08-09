import { Request, Response } from 'express';
import { AppError } from '@lms/shared';
import * as consentService from '../services/consent.service';
import { consentFormSelect, STAFF_LIKE_ROLES } from '../services/consent.service';

import { prisma } from '../lib/prisma';
const org = (req: Request) => req.organizationId!;

const acknowledgementSelect = {
  id: true,
  consentFormId: true,
  status: true,
  signatureName: true,
  respondedAt: true,
  createdAt: true,
  studentUser: { select: { id: true, firstName: true, lastName: true, studentId: true } },
  parentUser: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export const listConsentForms = async (req: Request, res: Response) => {
  const { role, userId } = req.user!;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  if (STAFF_LIKE_ROLES.includes(role)) {
    const forms = await prisma.consentForm.findMany({
      where: { organizationId: org(req), ...(status ? { status: status as any } : {}) },
      select: consentFormSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json({ success: true, data: forms });
  }

  if (role !== 'PARENT') throw AppError.forbidden('Not allowed to view consent forms');

  const acknowledgements = await prisma.consentAcknowledgement.findMany({
    where: { organizationId: org(req), parentUserId: userId },
    select: {
      status: true,
      signatureName: true,
      respondedAt: true,
      studentUser: { select: { id: true, firstName: true, lastName: true } },
      consentForm: { select: consentFormSelect },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const filtered = status
    ? acknowledgements.filter(a => a.status === status)
    : acknowledgements;

  return res.json({ success: true, data: filtered });
};

export const createConsentForm = async (req: Request, res: Response) => {
  const form = await prisma.consentForm.create({
    data: {
      organizationId: org(req),
      title: req.body.title,
      body: req.body.body,
      requiresSignature: req.body.requiresSignature ?? true,
      dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
      createdById: req.user!.userId,
    },
    select: consentFormSelect,
  });
  return res.status(201).json({ success: true, data: form });
};

const findDraftForm = async (req: Request) => {
  const form = await prisma.consentForm.findFirst({ where: { id: req.params.id, organizationId: org(req) } });
  if (!form) throw AppError.notFound('Consent form not found');
  if (form.status !== 'DRAFT') throw AppError.conflict('Only draft consent forms can be edited');
  return form;
};

export const updateConsentForm = async (req: Request, res: Response) => {
  const form = await findDraftForm(req);
  const data: Record<string, unknown> = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.body !== undefined) data.body = req.body.body;
  if (req.body.requiresSignature !== undefined) data.requiresSignature = req.body.requiresSignature;
  if (req.body.dueAt !== undefined) data.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;

  const updated = await prisma.consentForm.update({
    where: { id: form.id },
    data,
    select: consentFormSelect,
  });
  return res.json({ success: true, data: updated });
};

export const publishConsentForm = async (req: Request, res: Response) => {
  const data = await consentService.publishConsentForm(org(req), req.user!, req.params.id);
  return res.json({ success: true, data });
};

export const listConsentAcknowledgements = async (req: Request, res: Response) => {
  const form = await prisma.consentForm.findFirst({ where: { id: req.params.id, organizationId: org(req) } });
  if (!form) throw AppError.notFound('Consent form not found');
  const acknowledgements = await prisma.consentAcknowledgement.findMany({
    where: { consentFormId: form.id, organizationId: org(req) },
    select: acknowledgementSelect,
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ success: true, data: acknowledgements });
};

export const acknowledgeConsentForm = async (req: Request, res: Response) => {
  const data = await consentService.acknowledgeConsentForm(org(req), req.user!, req.params.id, req.body);
  return res.json({ success: true, data });
};
