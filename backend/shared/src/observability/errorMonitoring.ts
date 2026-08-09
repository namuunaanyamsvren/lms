import { createLogger } from '../logger';

const logger = createLogger('error-monitoring');

export type ErrorMonitoringContext = {
  service?: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  [key: string]: unknown;
};

const configured = () => Boolean(process.env.SENTRY_DSN || process.env.ERROR_MONITORING_DSN);

export function validateErrorMonitoringEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && !env.SENTRY_DSN && !env.ERROR_MONITORING_DSN) {
    logger.warn?.('Error monitoring DSN is not configured; unhandled errors will only be logged locally');
  }
}

export function captureException(error: unknown, context: ErrorMonitoringContext = {}): void {
  if (!configured()) return;
  // Integration point: production deployments can wire the Sentry SDK here
  // without touching service handlers. Until then, the release gate verifies
  // DSN presence and this hook keeps a single capture boundary.
  logger.error('Captured exception for external monitoring', {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
