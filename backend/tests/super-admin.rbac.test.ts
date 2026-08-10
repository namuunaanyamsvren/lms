import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler, signAccessToken } from '@lms/shared';

vi.mock('../organization-service/src/controllers/super-admin.controller', () => ({
  getOverview: vi.fn((_req, res) => res.json({ success: true, data: {} })),
  getOrganizations: vi.fn(),
  getOrganizationById: vi.fn(),
  updateOrganizationStatus: vi.fn((_req, res) => res.json({ success: true, data: {} })),
  getSubscriptions: vi.fn(),
  getUsers: vi.fn(),
  getPlans: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  getSystemHealth: vi.fn(),
  getSecurityEvents: vi.fn(),
  getAuditLogs: vi.fn(),
  getNotificationDeliveries: vi.fn(),
  getSupportTickets: vi.fn(),
}));

const token = (role: string) => signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: 'platform',
  role,
  sessionId: 'session-1',
});

describe('super admin routes', () => {
  let app: express.Express;

  beforeAll(async () => {
    const { default: router } = await import('../organization-service/src/routes/super-admin.router');
    app = express();
    app.use(express.json());
    app.use('/api/super-admin', router);
    app.use(errorHandler);
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await request(app).get('/api/super-admin/overview');
    expect(response.status).toBe(401);
  });

  it('returns 403 for non-super-admin roles', async () => {
    const response = await request(app)
      .get('/api/super-admin/overview')
      .set('Authorization', `Bearer ${token('ORG_ADMIN')}`);
    expect(response.status).toBe(403);
  });

  it('validates organization lifecycle status before mutation', async () => {
    const response = await request(app)
      .patch('/api/super-admin/organizations/org-1/status')
      .set('Authorization', `Bearer ${token('SUPER_ADMIN')}`)
      .send({ status: 'ARCHIVED', reason: 'Testing invalid status' });
    expect(response.status).toBe(400);
  });
});
