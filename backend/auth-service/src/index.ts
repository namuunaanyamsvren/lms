import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import {
  applyCors,
  applyHttpSecurity,
  createLogger,
  errorHandler,
  notFoundHandler,
  redisDependency,
  registerHealthRoutes,
  requestIdMiddleware,
  requestLogger,
  tracingMiddleware,
  validateAuthenticationEnvironment,
  validateCsrfEnvironment,
  validateErrorMonitoringEnvironment,
  validateServiceEnvironment,
  requireInternalService,
  startServiceRuntime,
} from '@lms/shared';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import { asyncHandler } from '@lms/shared';
import {
  activateOrganizationAdmins,
  provisionOrganizationAdmin,
  removeOrganizationAccounts,
  revokeOrganizationSessions,
} from './controllers/internal-organization.controller';
import {
  listUserMemberships,
  upsertOrganizationMembership,
} from './controllers/internal-membership.controller';
import { internalAuth } from './middlewares/internalAuth';
import { validatePhoneOtpEnvironment } from './services/phone-verification.service';
import { validateSmsEnvironment } from './services/sms-provider.service';
import { validatePasswordResetEnvironment } from './services/password-reset.service';
import { startAuthOutboxPublisher } from './services/auth-outbox.service';
import { validateGoogleOAuthEnvironment } from './services/google-oauth.service';
import { startAuthRetentionJob } from './services/auth-retention.service';
import { prisma } from './lib/prisma';

const app = express();
const logger = createLogger('auth-service');
validateServiceEnvironment('auth');
validateErrorMonitoringEnvironment();
const PORT = process.env.AUTH_PORT || 8001;
const trustProxyHops = Number(process.env.AUTH_TRUST_PROXY_HOPS || 1);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error('AUTH_TRUST_PROXY_HOPS must be an integer between 0 and 10');
}
app.set('trust proxy', trustProxyHops);

validateAuthenticationEnvironment('full');
validateCsrfEnvironment();
validatePhoneOtpEnvironment();
validateSmsEnvironment();
validatePasswordResetEnvironment();
validateGoogleOAuthEnvironment();

app.use(requestIdMiddleware);
app.use(tracingMiddleware('auth-service'));
app.use(requestLogger);
applyCors(app);
applyHttpSecurity(app);
app.use(express.json({ limit: '2mb' }));

// Routes
app.post(
  '/internal/organizations/:organizationId/admin',
  internalAuth,
  requireInternalService('organization-service'),
  asyncHandler(provisionOrganizationAdmin),
);
app.patch(
  '/internal/organizations/:organizationId/admins/activate',
  internalAuth,
  requireInternalService('billing-service'),
  asyncHandler(activateOrganizationAdmins),
);
app.post(
  '/internal/organizations/:organizationId/revoke-sessions',
  internalAuth,
  requireInternalService('organization-service'),
  asyncHandler(revokeOrganizationSessions),
);
app.delete(
  '/internal/organizations/:organizationId',
  internalAuth,
  requireInternalService('organization-service'),
  asyncHandler(removeOrganizationAccounts),
);
app.put(
  '/internal/organizations/:organizationId/memberships',
  internalAuth,
  requireInternalService('notification-service', 'organization-service'),
  asyncHandler(upsertOrganizationMembership),
);
app.get(
  '/internal/users/:userId/memberships',
  internalAuth,
  requireInternalService('notification-service', 'gateway'),
  asyncHandler(listUserMemberships),
);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

const runtimeDependencies = [redisDependency(false)];
registerHealthRoutes(app, 'auth-service', runtimeDependencies);

// authMiddleware (and any other route handler) forwards errors via next(err);
// without these, Express's default handler would leak stack traces to clients.
app.use(notFoundHandler);
app.use(errorHandler);

startServiceRuntime({
  app,
  serviceName: 'auth-service',
  port: PORT,
  logger,
  prisma,
  dependencies: runtimeDependencies,
  registerHealth: false,
  startWorkers: () => {
  startAuthOutboxPublisher();
  startAuthRetentionJob();
  },
}).catch(error => {
  logger.error('Auth Service failed to start', { error: String(error) });
  process.exit(1);
});
