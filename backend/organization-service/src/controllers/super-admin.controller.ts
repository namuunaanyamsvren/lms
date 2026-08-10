import { Request, Response } from 'express';
import { AppError, serviceAuthorizationHeaders } from '@lms/shared';
import net from 'net';
import { prisma as organizationPrisma } from '../lib/prisma';
import { authPrisma, billingPrisma, notificationPrisma, academicPrisma } from '../lib/cross-db';

const ORG_STATUSES = ['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] as const;
const LEGACY_ORG_STATUSES = ['CANCELLED', 'ARCHIVED'] as const;
const ALL_ORG_STATUSES = [...ORG_STATUSES, ...LEGACY_ORG_STATUSES] as const;
const MAX_LIMIT = 100;

const redact = (value: unknown) => {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/(password|secret|token|credential|apiKey)["']?\s*[:=]\s*["']?[^"',}\s]+/gi, '$1:[REDACTED]').slice(0, 2000);
};

const getListParams = (
  req: Request,
  allowedSorts: string[],
  defaultSort = 'createdAt',
) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20));
  const search = String(req.query.search || '').trim().slice(0, 200);
  const sortBy = allowedSorts.includes(String(req.query.sortBy || '')) ? String(req.query.sortBy) : defaultSort;
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  return { page, limit, search, sortBy, sortOrder, skip: (page - 1) * limit };
};

const getPingLatency = async (fn: () => Promise<unknown>, timeoutMs = 2000): Promise<{ ok: boolean; latencyMs: number }> => {
  const start = Date.now();
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs));
    await Promise.race([fn(), timeout]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
};

const tcpPing = (host: string, port: number, timeoutMs = 2000) => new Promise((resolve, reject) => {
  const socket = net.createConnection({ host, port });
  const done = (error?: Error) => {
    socket.removeAllListeners();
    socket.destroy();
    error ? reject(error) : resolve(true);
  };
  socket.setTimeout(timeoutMs);
  socket.once('connect', () => done());
  socket.once('timeout', () => done(new Error('Timeout')));
  socket.once('error', done);
});

const envUrl = (key: string, fallback: string) => process.env[key] || fallback;

const healthFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(2000) }).then(response => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});

const healthStatus = (ok: boolean, downStatus = 'DOWN') => ok ? 'HEALTHY' : downStatus;

export const getOverview = async (_req: Request, res: Response) => {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    totalOrgs,
    activeOrgs,
    trialOrgs,
    pendingPaymentOrgs,
    pastDueOrgs,
    suspendedOrgs,
    canceledOrgs,
    totalUsers,
    studentsCount,
    instructorsCount,
    activeSubscriptions,
    failedPayments,
    recentInvoices,
    notificationFailures,
    recentAuditLogs,
  ] = await Promise.all([
    organizationPrisma.organization.count().catch(() => 0),
    organizationPrisma.organization.count({ where: { status: 'ACTIVE', deletedAt: null } }).catch(() => 0),
    organizationPrisma.organization.count({ where: { status: 'TRIAL', deletedAt: null } }).catch(() => 0),
    organizationPrisma.organization.count({ where: { status: 'PENDING_PAYMENT', deletedAt: null } }).catch(() => 0),
    organizationPrisma.organization.count({ where: { status: 'PAST_DUE', deletedAt: null } }).catch(() => 0),
    organizationPrisma.organization.count({ where: { status: 'SUSPENDED' } }).catch(() => 0),
    organizationPrisma.organization.count({ where: { status: { in: ['CANCELED', 'CANCELLED', 'ARCHIVED'] } } }).catch(() => 0),
    authPrisma.userAccount.count({ where: { deletedAt: null } }).catch(() => 0),
    authPrisma.userAccount.count({ where: { role: 'STUDENT', deletedAt: null } }).catch(() => 0),
    authPrisma.userAccount.count({ where: { role: 'INSTRUCTOR', deletedAt: null } }).catch(() => 0),
    billingPrisma.subscription.count({ where: { isActive: true } }).catch(() => 0),
    billingPrisma.invoice.count({ where: { status: 'FAILED' } }).catch(() => 0),
    billingPrisma.invoice.findMany({
      where: { status: 'COMPLETED', paidAt: { gte: monthStart } },
      select: { amount: true, currency: true },
    }).catch(() => []),
    notificationPrisma.notificationDelivery.count({ where: { status: { in: ['FAILED', 'DEAD_LETTER', 'BOUNCED'] } } }).catch(() => 0),
    organizationPrisma.platformAuditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
  ]);

  const monthlyRevenue = recentInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  const [postgresCheck, authCheck, billingCheck, notificationCheck, academicCheck] = await Promise.all([
    getPingLatency(() => organizationPrisma.$queryRaw`SELECT 1`),
    getPingLatency(() => authPrisma.userAccount.findFirst({ select: { id: true } })),
    getPingLatency(() => billingPrisma.subscription.findFirst({ select: { id: true } })),
    getPingLatency(() => notificationPrisma.notification.findFirst({ select: { id: true } })),
    getPingLatency(() => academicPrisma.course.findFirst({ select: { id: true } })),
  ]);

  const healthSummary = {
    postgres: postgresCheck.ok ? 'HEALTHY' : 'DOWN',
    authService: authCheck.ok ? 'HEALTHY' : 'DEGRADED',
    billingService: billingCheck.ok ? 'HEALTHY' : 'DEGRADED',
    notificationService: notificationCheck.ok ? 'HEALTHY' : 'DEGRADED',
    academicService: academicCheck.ok ? 'HEALTHY' : 'DEGRADED',
  };

  return res.json({
    success: true,
    data: {
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        trial: trialOrgs,
        pendingPayment: pendingPaymentOrgs,
        pastDue: pastDueOrgs,
        suspended: suspendedOrgs,
        canceled: canceledOrgs,
      },
      users: {
        total: totalUsers,
        students: studentsCount,
        instructors: instructorsCount,
      },
      billing: {
        activeSubscriptions,
        failedPayments,
        monthlyRevenue,
        currency: 'MNT',
      },
      notifications: {
        deliveryFailures: notificationFailures,
      },
      healthSummary,
      recentAuditLogs,
    },
  });
};

export const getOrganizations = async (req: Request, res: Response) => {
  const { page, limit, search, sortBy, sortOrder, skip } = getListParams(req, ['name', 'slug', 'status', 'createdAt', 'updatedAt']);
  const status = req.query.status as string | undefined;
  if (status && !ALL_ORG_STATUSES.includes(status as any)) throw AppError.badRequest('Invalid organization status');

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { domain: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    organizationPrisma.organization.findMany({
      where,
      include: { settings: true },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    organizationPrisma.organization.count({ where }),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getOrganizationById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const org = await organizationPrisma.organization.findUnique({
    where: { id },
    include: { settings: true },
  });
  if (!org) throw AppError.notFound('Organization not found');

  const [userCount, studentCount, instructorCount, subscription, auditEvents] = await Promise.all([
    authPrisma.userAccount.count({ where: { organizationId: org.id, deletedAt: null } }).catch(() => 0),
    authPrisma.userAccount.count({ where: { organizationId: org.id, role: 'STUDENT', deletedAt: null } }).catch(() => 0),
    authPrisma.userAccount.count({ where: { organizationId: org.id, role: 'INSTRUCTOR', deletedAt: null } }).catch(() => 0),
    billingPrisma.subscription.findUnique({ where: { organizationId: org.id } }).catch(() => null),
    organizationPrisma.platformAuditLog.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),
  ]);

  return res.json({
    success: true,
    data: {
      ...org,
      stats: {
        totalUsers: userCount,
        students: studentCount,
        instructors: instructorCount,
      },
      subscription,
      auditEvents,
    },
  });
};

export const updateOrganizationStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!ORG_STATUSES.includes(status)) {
    throw AppError.badRequest('Invalid organization status');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    throw AppError.badRequest('A valid reason (minimum 3 characters) is required to update organization status');
  }

  const existing = await organizationPrisma.organization.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Organization not found');

  const previousValue = String(existing.status);
  const nextStatus = status === 'CANCELED' ? 'CANCELED' : status;
  const isDeleting = nextStatus === 'CANCELED';

  const updated = await organizationPrisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id },
      data: {
        status: nextStatus as any,
        deletedAt: isDeleting ? new Date() : null,
      },
      include: { settings: true },
    });

    await tx.platformAuditLog.create({
      data: {
        actorUserId: req.user?.userId || 'system',
        actorRole: req.user?.role || 'SUPER_ADMIN',
        organizationId: id,
        action: 'ORGANIZATION_STATUS_UPDATE',
        targetType: 'Organization',
        targetId: id,
        reason: reason.trim(),
        previousValue: redact(previousValue),
        newValue: redact(nextStatus),
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || '') || null,
        requestId: (req as any).requestId || null,
      },
    });

    return org;
  });

  if (nextStatus === 'SUSPENDED' || isDeleting) {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:8001';
    fetch(`${authServiceUrl}/internal/organizations/${id}/revoke-sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...serviceAuthorizationHeaders('organization-service'),
      },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  }

  return res.json({
    success: true,
    data: updated,
  });
};

export const getSubscriptions = async (req: Request, res: Response) => {
  const { page, limit, sortBy, sortOrder, skip } = getListParams(req, ['createdAt', 'updatedAt', 'plan', 'amount', 'nextBillingAt']);
  const plan = req.query.plan as string | undefined;
  const status = req.query.status as string | undefined;

  const where: any = {};
  if (plan) where.plan = plan;
  if (status === 'ACTIVE') where.isActive = true;
  if (status === 'INACTIVE') where.isActive = false;

  const [items, total] = await Promise.all([
    billingPrisma.subscription.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }).catch(() => []),
    billingPrisma.subscription.count({ where }).catch(() => 0),
  ]);

  const orgIds = items.map((s) => s.organizationId);
  const orgs = await organizationPrisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, slug: true, status: true },
  }).catch(() => []);
  const orgMap = new Map<string, any>(orgs.map((o) => [o.id, o] as [string, any]));

  const enriched = items.map((s) => ({
    ...s,
    status: s.status || (s.isActive ? 'ACTIVE' : 'INACTIVE'),
    currentPeriodEnd: s.currentPeriodEnd || s.nextBillingAt,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    paymentFailure: s.paymentFailure,
    trialEnd: s.trialEnd,
    stripeCustomerId: s.stripeCustomerId,
    stripeSubscriptionId: s.stripeSubscriptionId,
    stripePriceId: s.stripePriceId,
    organization: orgMap.get(s.organizationId) || null,
  }));

  return res.json({
    success: true,
    data: {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getUsers = async (req: Request, res: Response) => {
  const { page, limit, search, sortBy, sortOrder, skip } = getListParams(req, ['createdAt', 'email', 'role', 'status']);
  const role = req.query.role as string | undefined;
  const organizationId = req.query.organizationId as string | undefined;

  const where: any = { deletedAt: null };
  if (role) where.role = role;
  if (organizationId) where.organizationId = organizationId;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    authPrisma.userAccount.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }).catch(() => []),
    authPrisma.userAccount.count({ where }).catch(() => 0),
  ]);

  const orgIds = Array.from(new Set(users.map((u) => u.organizationId)));
  const orgs = await organizationPrisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, slug: true },
  }).catch(() => []);
  const orgMap = new Map<string, any>(orgs.map((o) => [o.id, o] as [string, any]));

  const items = users.map((u) => ({
    ...u,
    organization: orgMap.get(u.organizationId) || null,
  }));

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getPlans = async (req: Request, res: Response) => {
  const { page, limit, search, sortBy, sortOrder, skip } = getListParams(req, ['price', 'name', 'slug', 'createdAt', 'updatedAt'], 'price');
  const isActive = req.query.isActive as string | undefined;
  const where: any = {};
  if (isActive === 'true') where.isActive = true;
  if (isActive === 'false') where.isActive = false;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [items, total] = await Promise.all([
    organizationPrisma.platformPlan.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    organizationPrisma.platformPlan.count({ where }),
  ]);
  return res.json({
    success: true,
    data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
};

export const createPlan = async (req: Request, res: Response) => {
  const { name, slug, description, price, currency, billingCycle, maxUsers, maxCourses, featuresJson } = req.body;
  if (!name || !slug || price == null) {
    throw AppError.badRequest('name, slug, and price are required');
  }

  const plan = await organizationPrisma.$transaction(async tx => {
    const created = await tx.platformPlan.create({
      data: {
        name: String(name).trim(),
        slug: String(slug).trim().toLowerCase(),
        description,
        price: Number(price),
        currency: currency || 'MNT',
        billingCycle: billingCycle || 'monthly',
        maxUsers: Number(maxUsers || 100),
        maxCourses: Number(maxCourses || 50),
        featuresJson: typeof featuresJson === 'object' ? JSON.stringify(featuresJson) : featuresJson,
      },
    });
    await tx.platformAuditLog.create({
      data: {
        actorUserId: req.user?.userId || 'system',
        actorRole: req.user?.role || 'SUPER_ADMIN',
        action: 'PLATFORM_PLAN_CREATED',
        targetType: 'PlatformPlan',
        targetId: created.id,
        reason: typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null,
        previousValue: null,
        newValue: redact({ slug: created.slug, price: created.price, currency: created.currency, billingCycle: created.billingCycle }),
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || '') || null,
        requestId: (req as any).requestId || null,
      },
    });
    return created;
  });

  return res.status(201).json({
    success: true,
    data: plan,
  });
};

export const updatePlan = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await organizationPrisma.platformPlan.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Plan not found');

  const { name, description, price, currency, billingCycle, maxUsers, maxCourses, featuresJson, isActive } = req.body;

  const updated = await organizationPrisma.$transaction(async tx => {
    const changed = await tx.platformPlan.update({
      where: { id },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(price != null ? { price: Number(price) } : {}),
        ...(currency ? { currency } : {}),
        ...(billingCycle ? { billingCycle } : {}),
        ...(maxUsers != null ? { maxUsers: Number(maxUsers) } : {}),
        ...(maxCourses != null ? { maxCourses: Number(maxCourses) } : {}),
        ...(featuresJson !== undefined ? { featuresJson: typeof featuresJson === 'object' ? JSON.stringify(featuresJson) : featuresJson } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
    await tx.platformAuditLog.create({
      data: {
        actorUserId: req.user?.userId || 'system',
        actorRole: req.user?.role || 'SUPER_ADMIN',
        action: 'PLATFORM_PLAN_UPDATED',
        targetType: 'PlatformPlan',
        targetId: id,
        reason: typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null,
        previousValue: redact({ slug: existing.slug, price: existing.price, currency: existing.currency, isActive: existing.isActive }),
        newValue: redact({ slug: changed.slug, price: changed.price, currency: changed.currency, isActive: changed.isActive }),
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || '') || null,
        requestId: (req as any).requestId || null,
      },
    });
    return changed;
  });

  return res.json({
    success: true,
    data: updated,
  });
};

export const getSystemHealth = async (_req: Request, res: Response) => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const rabbitUrl = process.env.RABBITMQ_URL || process.env.AMQP_URL || 'amqp://localhost:5672';
  const parsePort = (url: string, fallback: number) => {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port || fallback),
      };
    } catch {
      return { host: 'localhost', port: fallback };
    }
  };
  const redis = parsePort(redisUrl, 6379);
  const rabbit = parsePort(rabbitUrl, 5672);
  const services = [
    { name: 'API Gateway', fn: () => healthFetch(`${envUrl('GATEWAY_URL', 'http://localhost:8000')}/health`) },
    { name: 'Auth Service', fn: () => healthFetch(`${envUrl('AUTH_SERVICE_URL', 'http://localhost:8001')}/health`) },
    { name: 'Organization Service', fn: () => organizationPrisma.$queryRaw`SELECT 1` },
    { name: 'Academic Service', fn: () => healthFetch(`${envUrl('ACADEMIC_SERVICE_URL', 'http://localhost:8003')}/health`) },
    { name: 'Billing Service', fn: () => healthFetch(`${envUrl('BILLING_SERVICE_URL', 'http://localhost:8004')}/health`) },
    { name: 'Notification Service', fn: () => healthFetch(`${envUrl('NOTIFICATION_SERVICE_URL', 'http://localhost:8005')}/health`) },
    { name: 'PostgreSQL', fn: () => organizationPrisma.$queryRaw`SELECT 1` },
    { name: 'Redis', fn: () => tcpPing(redis.host, redis.port) },
    { name: 'RabbitMQ', fn: () => tcpPing(rabbit.host, rabbit.port) },
  ];

  const results = await Promise.all(
    services.map(async (srv) => {
      const ping = await getPingLatency(srv.fn);
      return {
        name: srv.name,
        status: healthStatus(ping.ok),
        latencyMs: ping.latencyMs,
        lastCheckedAt: new Date().toISOString(),
      };
    }),
  );

  return res.json({
    success: true,
    data: results,
  });
};

export const getSecurityEvents = async (req: Request, res: Response) => {
  const { page, limit, sortBy, sortOrder, skip } = getListParams(req, ['createdAt', 'eventType'], 'createdAt');
  const eventType = req.query.eventType as string | undefined;
  const organizationId = req.query.organizationId as string | undefined;

  const where: any = {};
  if (eventType) where.eventType = eventType;
  if (organizationId) where.organizationId = organizationId;

  const [items, total] = await Promise.all([
    authPrisma.authAuditEvent.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        organizationId: true,
        eventType: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }).catch(() => []),
    authPrisma.authAuditEvent.count({ where }).catch(() => 0),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getAuditLogs = async (req: Request, res: Response) => {
  const { page, limit, search, sortBy, sortOrder, skip } = getListParams(req, ['createdAt', 'action', 'targetType'], 'createdAt');
  const organizationId = req.query.organizationId as string | undefined;
  const action = req.query.action as string | undefined;

  const where: any = {};
  if (organizationId) where.organizationId = organizationId;
  if (action) where.action = action;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { reason: { contains: search, mode: 'insensitive' } },
      { actorUserId: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    organizationPrisma.platformAuditLog.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    organizationPrisma.platformAuditLog.count({ where }),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getNotificationDeliveries = async (req: Request, res: Response) => {
  const { page, limit, sortBy, sortOrder, skip } = getListParams(req, ['createdAt', 'updatedAt', 'status', 'channel'], 'createdAt');
  const status = req.query.status as string | undefined;
  const channel = req.query.channel as string | undefined;
  const organizationId = req.query.organizationId as string | undefined;
  const where: any = {};
  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (organizationId) where.organizationId = organizationId;

  const [items, total, failureCount] = await Promise.all([
    notificationPrisma.notificationDelivery.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      select: {
        id: true,
        organizationId: true,
        channel: true,
        status: true,
        attemptCount: true,
        lastError: true,
        createdAt: true,
      },
    }).catch(() => []),
    notificationPrisma.notificationDelivery.count({ where }).catch(() => 0),
    notificationPrisma.notificationDelivery.count({
      where: { status: { in: ['FAILED', 'BOUNCED', 'DEAD_LETTER'] } },
    }).catch(() => 0),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      failureCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getSupportTickets = async (req: Request, res: Response) => {
  const { page, limit, search, sortBy, sortOrder, skip } = getListParams(req, ['createdAt', 'status', 'requestedRole'], 'createdAt');
  const status = req.query.status as string | undefined;
  const organizationId = req.query.organizationId as string | undefined;

  const where: any = {};
  if (status) where.status = status;
  if (organizationId) where.organizationId = organizationId;
  if (search) {
    where.OR = [
      { requesterEmail: { contains: search, mode: 'insensitive' } },
      { requesterName: { contains: search, mode: 'insensitive' } },
      { note: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    notificationPrisma.supportTicket.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }).catch(() => []),
    notificationPrisma.supportTicket.count({ where }).catch(() => 0),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};
