import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createLogger } from '@lms/shared';
import { config } from '../config';

const router = Router();
const logger = createLogger('gateway');

// Public paths are versioned (/api/v1/...); downstream services still mount
// their own routers at the unversioned /api/... prefix, so every proxied
// request gets rewritten back to the legacy shape before it leaves the
// gateway. This keeps the version bump scoped to the edge only — no service
// internals, tests, or inter-service calls need to change.
const V1_TO_LEGACY: Record<string, string> = { '^/api/v1/': '/api/' };

const routes: Array<{
  path: string;
  target: string;
  pathRewrite?: Record<string, string>;
}> = [
  { path: '/api/v1/auth', target: config.services.auth },
  { path: '/api/v1/organizations', target: config.services.organization },
  // Identity/user records are owned by auth-service.
  { path: '/api/v1/users', target: config.services.auth },
  { path: '/api/v1/students', target: config.services.academic },
  { path: '/api/v1/courses', target: config.services.academic },
  { path: '/api/v1/academic-structure', target: config.services.academic },
  { path: '/api/v1/modules', target: config.services.academic },
  { path: '/api/v1/lessons', target: config.services.academic },
  { path: '/api/v1/schedules', target: config.services.academic },
  { path: '/api/v1/cohorts', target: config.services.academic },
  { path: '/api/v1/enrollments', target: config.services.academic },
  { path: '/api/v1/announcements', target: config.services.academic },
  { path: '/api/v1/assignments', target: config.services.academic },
  { path: '/api/v1/submissions', target: config.services.academic },
  { path: '/api/v1/quizzes', target: config.services.academic },
  { path: '/api/v1/quiz-attempts', target: config.services.academic },
  { path: '/api/v1/questions', target: config.services.academic },
  { path: '/api/v1/question-bank', target: config.services.academic },
  { path: '/api/v1/uploads', target: config.services.academic },
  { path: '/api/v1/attendance', target: config.services.academic },
  { path: '/api/v1/grades', target: config.services.academic },
  { path: '/api/v1/certificates', target: config.services.academic },
  { path: '/api/v1/certificate-templates', target: config.services.academic },
  { path: '/api/v1/guardians', target: config.services.academic },
  { path: '/api/v1/consent-forms', target: config.services.academic },
  { path: '/api/v1/reports', target: config.services.academic },
  { path: '/api/v1/audit-logs', target: config.services.academic },
  { path: '/api/v1/system-health', target: config.services.academic },
  { path: '/api/v1/document-requests', target: config.services.academic },
  { path: '/api/v1/scholarship-requests', target: config.services.academic },
  { path: '/api/v1/dashboards', target: config.services.academic },
  { path: '/api/v1/notifications', target: config.services.notification },
];

if (config.features.billing) routes.push(
  { path: '/api/v1/invoices', target: config.services.billing, pathRewrite: { '^/api/v1/invoices': '/api/payments/invoices' } },
  { path: '/api/v1/payments', target: config.services.billing },
);

routes.forEach(({ path, target, pathRewrite }) => {
  // NOTE: the proxy `context` (path) is passed to createProxyMiddleware itself,
  // NOT to router.use(). If it were passed to router.use(path, ...), Express
  // would strip the matched prefix from req.url before the proxy middleware
  // ever sees it (e.g. /api/v1/auth/login -> /login), and since downstream
  // services mount their routes under the legacy full prefix (e.g. auth-service
  // expects /api/auth/login), every proxied request would 404. Letting
  // http-proxy-middleware do its own prefix matching preserves the full
  // original path, which pathRewrite then translates to the legacy shape.
  router.use(
    createProxyMiddleware(path, {
      target,
      changeOrigin: true,
      xfwd: true,
      pathRewrite: pathRewrite || V1_TO_LEGACY,
      onError: (err, req, res) => {
        logger.error(`Proxy target unreachable: ${target}`, { error: err.message });
        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            message: 'Target microservice is starting or unavailable.',
            code: 'SERVICE_UNAVAILABLE',
          });
        }
      },
    })
  );
});

export default router;
