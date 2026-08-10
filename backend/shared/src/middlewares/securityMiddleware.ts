import { Application, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

const apiContentSecurityPolicy = {
  directives: {
    defaultSrc: ["'none'"],
    baseUri: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'none'"],
  },
};

const normalizedEndpoint = (path: string) =>
  path
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');

export function applyHttpSecurity(
  app: Application,
  options: { rateLimitMax?: number; windowMs?: number; skipRateLimit?: (req: Request, res: Response) => boolean } = {},
) {
  applyHttpSecurityHeaders(app);
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.rateLimitMax ?? 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: options.skipRateLimit,
    message: { success: false, message: 'Too many requests. Please try again later.' },
  }));
}

export function applyHttpSecurityHeaders(app: Application) {
  app.disable('x-powered-by');
  app.set('json escape', true);
  app.use(helmet({
    contentSecurityPolicy: apiContentSecurityPolicy,
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
  }));
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    );
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });
}

export const createPrincipalRateLimiter = (
  options: { windowMs?: number; max?: number } = {},
) => rateLimit({
  windowMs: options.windowMs ?? Number(process.env.AUTHENTICATED_RATE_LIMIT_WINDOW_MS || 60_000),
  max: options.max ?? Number(process.env.AUTHENTICATED_RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => !req.user,
  keyGenerator: req => [
    req.user!.organizationId,
    req.user!.role,
    req.user!.userId,
    req.method,
    normalizedEndpoint(req.path),
  ].join(':'),
  message: { success: false, message: 'Request limit exceeded for this account and endpoint.' },
});
