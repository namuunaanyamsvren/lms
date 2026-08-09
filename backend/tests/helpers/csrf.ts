import { Application } from 'express';
import {
  createCsrfToken,
  getCsrfCookieName,
  getCsrfHeaderName,
} from '@lms/shared';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const installCsrfTestClient = (app: Application) => {
  app.use((req, _res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next();
    const token = createCsrfToken();
    const csrfCookie = `${getCsrfCookieName()}=${encodeURIComponent(token)}`;
    req.headers.cookie = [req.headers.cookie, csrfCookie].filter(Boolean).join('; ');
    req.headers[getCsrfHeaderName()] = token;
    return next();
  });
};
