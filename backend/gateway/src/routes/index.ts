import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config';

const router = Router();

const routes = [
  { path: '/api/auth', target: config.services.auth },
  { path: '/api/organizations', target: config.services.organization },
  { path: '/api/users', target: config.services.academic },
  { path: '/api/courses', target: config.services.academic },
  { path: '/api/cohorts', target: config.services.academic },
  { path: '/api/assignments', target: config.services.academic },
  { path: '/api/quizzes', target: config.services.academic },
  { path: '/api/attendance', target: config.services.academic },
  { path: '/api/grades', target: config.services.academic },
  { path: '/api/payments', target: config.services.billing },
  { path: '/api/notifications', target: config.services.notification },
];

routes.forEach(({ path, target }) => {
  // NOTE: the proxy `context` (path) is passed to createProxyMiddleware itself,
  // NOT to router.use(). If it were passed to router.use(path, ...), Express
  // would strip the matched prefix from req.url before the proxy middleware
  // ever sees it (e.g. /api/auth/login -> /login), and since downstream
  // services mount their routes under the full prefix (e.g. auth-service
  // expects /api/auth/login), every proxied request would 404. Letting
  // http-proxy-middleware do its own prefix matching preserves the full
  // original path.
  router.use(
    createProxyMiddleware(path, {
      target,
      changeOrigin: true,
      onError: (err, req, res) => {
        console.error(`[Gateway Proxy Error] Target ${target} unreachable:`, err.message);
        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            message: 'Target microservice is starting or unavailable.',
          });
        }
      },
    })
  );
});

export default router;
