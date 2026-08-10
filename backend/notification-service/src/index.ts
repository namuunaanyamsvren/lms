import express from 'express';
import dotenv from 'dotenv';
import {
  applyCors,
  applyHttpSecurity,
  asyncHandler,
  createLogger,
  errorHandler,
  internalServiceAuth,
  notFoundHandler,
  rabbitMQDependency,
  redisDependency,
  registerHealthRoutes,
  requestIdMiddleware,
  requestLogger,
  tracingMiddleware,
  requireInternalService,
  startServiceRuntime,
  validateErrorMonitoringEnvironment,
  validateServiceEnvironment,
} from '@lms/shared';
import routes from './routes';
import { startNotificationConsumer } from './events/notification.consumer';
import { startUserCreatedConsumer } from './events/user-created.consumer';
import { startUserUpdatedConsumer } from './events/user-updated.consumer';
import { startEmailVerificationConsumer } from './events/email-verification.consumer';
import { startPasswordResetConsumer } from './events/password-reset.consumer';
import { startUserInvitedConsumer } from './events/user-invited.consumer';
import { startGuardianInviteConsumer } from './events/guardian-invite.consumer';
import { startOrganizationCreatedConsumer } from './events/organization-created.consumer';
import { validateEmailProviderConfiguration } from './services/email.service';
import { validateSmsProviderConfiguration } from './services/channel-provider.service';
import { startNotificationJobs } from './jobs/notification.jobs';
import { startUserAnonymizedConsumer } from './events/user-anonymized.consumer';
import { startScheduleConsumers } from './events/schedule.consumer';
import { startAttendanceConsumers } from './events/attendance.consumer';
import { startConsentConsumers } from './events/consent.consumer';
import { startAnnouncementConsumers } from './events/announcement.consumer';
import { startAssignmentResubmitConsumer, startGradePublishedConsumer } from './events/assignment.consumer';
import { startStaffWorkflowConsumers } from './events/staff-workflow.consumer';
import { startReportConsumers } from './events/report.consumer';
import { startBillingConsumers } from './events/billing.consumer';
import {
  eraseOrganizationNotifications,
  getInternalUserNotificationSummary,
} from './controllers/internal.controller';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();
const logger = createLogger('notification-service');
validateServiceEnvironment('notification');
validateErrorMonitoringEnvironment();
validateEmailProviderConfiguration();
validateSmsProviderConfiguration();
const PORT = process.env.PORT || 8005;

app.use(requestIdMiddleware);
app.use(tracingMiddleware('notification-service'));
app.use(requestLogger);
applyCors(app);
applyHttpSecurity(app);
app.use(express.json({ limit: '1mb' }));

app.get(
  '/internal/notifications/:organizationId/:userId',
  internalServiceAuth,
  requireInternalService('academic-service'),
  asyncHandler(getInternalUserNotificationSummary),
);
app.delete(
  '/internal/organizations/:organizationId',
  internalServiceAuth,
  requireInternalService('organization-service'),
  asyncHandler(eraseOrganizationNotifications),
);

app.use('/api/notifications', routes);

const runtimeDependencies = [redisDependency(false), rabbitMQDependency(false)];
registerHealthRoutes(app, 'notification-service', runtimeDependencies);

app.use(notFoundHandler);
app.use(errorHandler);

startServiceRuntime({
  app,
  serviceName: 'notification-service',
  port: PORT,
  logger,
  prisma,
  dependencies: runtimeDependencies,
  registerHealth: false,
  startWorkers: () => {
    startNotificationJobs();
    Promise.all([
      startNotificationConsumer(),
      startUserCreatedConsumer(),
      startUserUpdatedConsumer(),
      startEmailVerificationConsumer(),
      startPasswordResetConsumer(),
      startUserInvitedConsumer(),
      startGuardianInviteConsumer(),
      startOrganizationCreatedConsumer(),
      startUserAnonymizedConsumer(),
      startScheduleConsumers(),
      startAttendanceConsumers(),
      startConsentConsumers(),
      startAnnouncementConsumers(),
      startAssignmentResubmitConsumer(),
      startGradePublishedConsumer(),
      startStaffWorkflowConsumers(),
      startReportConsumers(),
      startBillingConsumers(),
    ]).catch(error => {
      logger.error('RabbitMQ consumer failed to start', { error: String(error) });
    });
  },
}).catch(error => {
  logger.error('Notification Service failed to start', { error: String(error) });
  process.exit(1);
});
