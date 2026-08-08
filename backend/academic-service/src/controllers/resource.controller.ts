import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';

export const getCertificates = async (req: Request, res: Response) => {
  const { role, userId } = req.user!;
  let audience: any = {};
  if (role === 'STUDENT') {
    audience = { studentId: userId };
  } else if (role === 'INSTRUCTOR') {
    audience = { course: { instructorId: userId } };
  } else if (role === 'PARENT') {
    audience = { student: { guardianAsStudent: { some: { parentUserId: userId } } } };
  }
  const data = await prisma.certificate.findMany({
    where: { organizationId: req.organizationId!, ...audience },
  });
  return res.json({ success: true, data });
};
export const getAuditLogs = async (req: Request, res: Response) => {
  const data = await prisma.auditLog.findMany({
    where: { organizationId: req.organizationId! },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return res.json({ success: true, data });
};

const pingService = async (name: string, baseUrl: string | undefined) => {
  if (!baseUrl) return { name, online: false, error: 'URL not configured' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const start = Date.now();
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return { name, online: response.ok, latencyMs: Date.now() - start };
  } catch {
    return { name, online: false };
  }
};

export const getSystemHealth = async (_req: Request, res: Response) => {
  const checks = [
    Promise.resolve({ name: 'academic-service', online: true, latencyMs: 0 }),
    pingService('auth-service', process.env.AUTH_SERVICE_URL),
    pingService('organization-service', process.env.ORGANIZATION_SERVICE_URL),
    pingService('notification-service', process.env.NOTIFICATION_SERVICE_URL),
  ];
  if (process.env.FEATURE_BILLING_ENABLED === 'true') checks.push(pingService('billing-service', process.env.BILLING_SERVICE_URL));
  const services = await Promise.all(checks);
  const allOnline = services.every(s => s.online);
  return res.json({ success: true, data: { services, allOnline } });
};
