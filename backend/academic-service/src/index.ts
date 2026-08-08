import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { applyCors, applyHttpSecurity, createLogger, errorHandler, notFoundHandler, rabbitMQDependency, redisDependency, registerHealthRoutes, requestIdMiddleware,
  requestLogger,
  tracingMiddleware, requireInternalService, startServiceRuntime, validateErrorMonitoringEnvironment, validateFileSecurityEnvironment, validateServiceEnvironment } from '@lms/shared';
import routes from './routes';
import { asyncHandler } from '@lms/shared';
import { internalAuth } from './middlewares/internalAuth';
import {
  provisionOrganization,
  removeProvisionedOrganization,
} from './controllers/internal-organization.controller';
import { recordAuditLog } from './services/audit.service';
import { startUserCreatedConsumer } from './events/user-created.consumer';
import { startAcademicOutboxPublisher } from './services/event-outbox.service';
import { startAssignmentScheduler } from './services/assignment-scheduler.service';
import { startUserLifecycleConsumers } from './events/user-lifecycle.consumer';
import { startAcademicEventReconciliation } from './services/event-reconciliation.service';
import { exportUserAcademicData } from './controllers/privacy.controller';
import { startReportProcessing } from './services/report-job.service';
import { prisma } from './lib/prisma';

const app = express();
const logger = createLogger('academic-service');
validateServiceEnvironment('academic');
validateFileSecurityEnvironment();
validateErrorMonitoringEnvironment();
const PORT = process.env.ACADEMIC_PORT || process.env.PORT || 8003;

app.use(requestIdMiddleware);
app.use(tracingMiddleware('academic-service'));
app.use(requestLogger);
applyCors(app);
applyHttpSecurity(app);
app.use(express.json({ limit: '2mb' }));

// Routes
app.post('/internal/organizations', internalAuth, requireInternalService('organization-service'), asyncHandler(provisionOrganization));
app.delete('/internal/organizations/:id', internalAuth, requireInternalService('organization-service'), asyncHandler(removeProvisionedOrganization));
app.post(
  '/internal/audit-logs',
  internalAuth,
  requireInternalService('notification-service', 'billing-service', 'auth-service', 'organization-service'),
  asyncHandler(async (req, res) => {
    const input = {
      organizationId: String(req.body.organizationId || ''),
      userId: req.body.userId ? String(req.body.userId) : null,
      action: String(req.body.action || ''),
      entity: String(req.body.entity || ''),
      entityId: req.body.entityId ? String(req.body.entityId) : null,
      details: req.body.details ? String(req.body.details) : null,
      ipAddress: req.body.ipAddress ? String(req.body.ipAddress) : null,
    };
    if (!input.organizationId || !input.action || !input.entity) {
      return res.status(400).json({ success: false, message: 'Invalid audit log payload' });
    }
    const data = await recordAuditLog(prisma, input);
    return res.status(201).json({ success: true, data });
  }),
);
app.get(
  '/internal/privacy/export/:organizationId/:userId',
  internalAuth,
  requireInternalService('auth-service'),
  asyncHandler(exportUserAcademicData),
);
app.use('/api', routes);

const runtimeDependencies = [redisDependency(false), rabbitMQDependency(false)];
registerHealthRoutes(app, 'academic-service', runtimeDependencies);

// authMiddleware (and any other route handler) forwards errors via next(err);
// without these, Express's default handler would leak stack traces to clients.
app.use(notFoundHandler);
app.use(errorHandler);

startServiceRuntime({
  app,
  serviceName: 'academic-service',
  port: PORT,
  logger,
  prisma,
  dependencies: runtimeDependencies,
  registerHealth: false,
  startWorkers: () => {
    startUserCreatedConsumer().catch(error => {
      logger.error('USER_CREATED consumer failed to start', { error: String(error) });
    });
    startUserLifecycleConsumers().catch(error => {
      logger.error('User lifecycle consumers failed to start', { error: String(error) });
    });
    startAcademicOutboxPublisher();
    startAcademicEventReconciliation();
    startAssignmentScheduler();
    startReportProcessing();
  },
}).catch(error => {
  logger.error('Academic Service failed to start', { error: String(error) });
  process.exit(1);
});
