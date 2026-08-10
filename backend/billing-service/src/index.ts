import express from 'express';
import dotenv from 'dotenv';
import {
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
  applyCors,
  startServiceRuntime,
  validateErrorMonitoringEnvironment,
  validateServiceEnvironment,
} from '@lms/shared';
import routes from './routes';
import { startOrganizationCreatedConsumer } from './events/organization-created.consumer';
import { startBillingOutboxPublisher } from './services/event-outbox.service';
import { startBillingEventReconciliation } from './services/event-reconciliation.service';
import { startBillingReminderScheduler } from './services/reminder-scheduler.service';
import { deactivateOrganizationBilling, getAccessStatus, getRevenueSummary } from './controllers/internal.controller';
import { handleQPayWebhook, handleStripeWebhook } from './controllers/billing.controller';
import { validateQPayConfiguration } from './services/qpay-provider.service';
import { validateStripeConfiguration } from './services/stripe-provider.service';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();
const logger = createLogger('billing-service');
validateServiceEnvironment('billing');
validateErrorMonitoringEnvironment();
validateQPayConfiguration();
validateStripeConfiguration();
const PORT = process.env.PORT || 8004;

app.use(requestIdMiddleware);
app.use(tracingMiddleware('billing-service'));
app.use(requestLogger);
applyCors(app);
applyHttpSecurity(app);
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), asyncHandler(handleStripeWebhook));
app.use(express.json({ limit: '1mb' }));

app.post('/api/payments/qpay/webhook', asyncHandler(handleQPayWebhook));

app.delete(
  '/internal/organizations/:organizationId',
  internalServiceAuth,
  requireInternalService('organization-service'),
  asyncHandler(deactivateOrganizationBilling),
);
app.get(
  '/internal/organizations/:organizationId/revenue-summary',
  internalServiceAuth,
  requireInternalService('academic-service'),
  asyncHandler(getRevenueSummary),
);
app.get(
  '/internal/organizations/:organizationId/access-status',
  internalServiceAuth,
  requireInternalService('academic-service'),
  asyncHandler(getAccessStatus),
);
app.use('/api/payments', routes);

const runtimeDependencies = [redisDependency(false), rabbitMQDependency(false)];
registerHealthRoutes(app, 'billing-service', runtimeDependencies);

app.use(notFoundHandler);
app.use(errorHandler);

startServiceRuntime({
  app,
  serviceName: 'billing-service',
  port: PORT,
  logger,
  prisma,
  dependencies: runtimeDependencies,
  registerHealth: false,
  startWorkers: () => {
    Promise.all([
      startOrganizationCreatedConsumer(),
    ]).catch(error => {
      logger.error('Billing consumers failed to start', { error: String(error) });
    });
    startBillingOutboxPublisher();
    startBillingEventReconciliation();
    startBillingReminderScheduler();
  },
}).catch(error => {
  logger.error('Billing Service failed to start', { error: String(error) });
  process.exit(1);
});
