import express from 'express';
import dotenv from 'dotenv';
import {
  applyHttpSecurity,
  applyCors,
  asyncHandler,
  createLogger,
  errorHandler,
  notFoundHandler,
  redisDependency,
  registerHealthRoutes,
  requestIdMiddleware,
  requestLogger,
  tracingMiddleware,
  validateErrorMonitoringEnvironment,
  validateServiceEnvironment,
  requireInternalService,
  startServiceRuntime,
} from '@lms/shared';
import routes from './routes';
import { getRegistrationPolicy, getGradingPolicy, getAttendancePolicy, internalLifecycle } from './controllers/organization.controller';
import { internalAuth } from './middleware/internalAuth';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();
const logger = createLogger('organization-service');
validateServiceEnvironment('organization');
validateErrorMonitoringEnvironment();
const PORT = process.env.PORT || 8002;

app.use(requestIdMiddleware);
app.use(tracingMiddleware('organization-service'));
app.use(requestLogger);
applyCors(app);
applyHttpSecurity(app, {
  skipRateLimit: req => req.method === 'GET' && req.path === '/api/organizations/resolve',
});
app.use(express.json({ limit: '2mb' }));

app.get(
  '/internal/organizations/:id/registration-policy',
  internalAuth,
  requireInternalService('auth-service'),
  asyncHandler(getRegistrationPolicy),
);
app.get(
  '/internal/organizations/:id/grading-policy',
  internalAuth,
  requireInternalService('academic-service'),
  asyncHandler(getGradingPolicy),
);
app.get(
  '/internal/organizations/:id/attendance-policy',
  internalAuth,
  requireInternalService('academic-service'),
  asyncHandler(getAttendancePolicy),
);
app.patch(
  '/internal/organizations/:id/status',
  internalAuth,
  requireInternalService('billing-service'),
  asyncHandler(internalLifecycle),
);
import superAdminRouter from './routes/super-admin.router';
app.use('/api/organizations', routes);
app.use('/api/super-admin', superAdminRouter);

const runtimeDependencies = [redisDependency(false)];
registerHealthRoutes(app, 'organization-service', runtimeDependencies);

app.use(notFoundHandler);
app.use(errorHandler);

startServiceRuntime({
  app,
  serviceName: 'organization-service',
  port: PORT,
  logger,
  prisma,
  dependencies: runtimeDependencies,
  registerHealth: false,
}).catch(error => {
  logger.error('Organization Service failed to start', { error: String(error) });
  process.exit(1);
});
