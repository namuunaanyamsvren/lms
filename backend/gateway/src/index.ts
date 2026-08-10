import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import {
  AppError,
  authMiddleware,
  applyCors,
  connectRedis,
  createLogger,
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  requestLogger,
  registerHealthRoutes,
  tracingMiddleware,
  validateAuthenticationEnvironment,
  validateErrorMonitoringEnvironment,
  validateServiceEnvironment,
  createPrincipalRateLimiter,
  applyHttpSecurityHeaders,
  accessRevocationMiddleware,
} from '@lms/shared';
import { config } from './config';
import apiRoutes from './routes';
import { openApiDocument } from './openapi';

const app = express();
const logger = createLogger('gateway');

validateServiceEnvironment('gateway');
validateErrorMonitoringEnvironment();
validateAuthenticationEnvironment('access');

app.use(requestIdMiddleware);
app.use(tracingMiddleware('gateway'));
app.use(requestLogger);
applyCors(app);
applyHttpSecurityHeaders(app);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method === 'GET' && req.path === '/organizations/resolve',
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', apiLimiter);
// NOTE: no express.json() here. The gateway has no routes of its own that
// read req.body (only /health), and every other route is proxied through to
// a downstream service. Parsing the body here would consume the request
// stream before http-proxy-middleware can pipe it through, causing proxied
// POST/PUT/PATCH requests to hang waiting for a body that never arrives.

registerHealthRoutes(app, 'gateway', []);

// Access-token-free auth operations. Every other API request is rejected at
// the edge before it reaches a downstream service.
const publicAuthRoutes = new Set([
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/auth/verify',
  'GET /api/v1/auth/csrf-token',
  'GET /api/v1/auth/google',
  'GET /api/v1/auth/google/callback',
  'POST /api/v1/auth/google/exchange',
  'POST /api/v1/organizations/onboard',
  'POST /api/v1/payments/onboarding/stripe-checkout',
  'POST /api/v1/payments/stripe/webhook',
  'GET /api/v1/organizations/resolve',
  'GET /api/v1/organizations/public',
  'GET /api/v1/uploads/download',
]);
app.use('/api', (req, res, next) => {
  const fullPath = `/api${req.path}`;
  if (publicAuthRoutes.has(`${req.method} ${fullPath}`)) return next();
  return authMiddleware(req, res, next);
});
app.use('/api', accessRevocationMiddleware);
app.use('/api', createPrincipalRateLimiter());
const unverifiedAuthRoutes = new Set([
  'GET /api/v1/auth/me',
  'POST /api/v1/auth/send-verification',
  'POST /api/v1/auth/send-phone-verification',
  'POST /api/v1/auth/verify-phone',
  'POST /api/v1/auth/logout-all',
  'GET /api/v1/auth/sessions',
  'DELETE /api/v1/auth/sessions',
]);
app.use('/api', (req, _res, next) => {
  const fullPath = `/api${req.path}`;
  const routeKey = `${req.method} ${fullPath}`;
  const sessionRevoke = req.method === 'DELETE' && fullPath.startsWith('/api/v1/auth/sessions/');
  if (unverifiedAuthRoutes.has(routeKey) || sessionRevoke) return next();
  if (req.user?.emailVerificationRequired && !req.user.emailVerified) {
    return next(AppError.forbidden('EMAIL_VERIFICATION_REQUIRED'));
  }
  if (req.user?.phoneVerificationRequired && !req.user.phoneVerified) {
    return next(AppError.forbidden('PHONE_VERIFICATION_REQUIRED'));
  }
  return next();
});

// Proxy routes
app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`API Gateway running on port ${config.port}`);
  void connectRedis('gateway');
});
