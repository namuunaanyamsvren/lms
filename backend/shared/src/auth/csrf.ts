import crypto from 'crypto';
import { CookieOptions, NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { getRefreshTokenExpiresInMs } from './tokenService';

const DEFAULT_CSRF_COOKIE_NAME = 'lms_csrf';
const DEFAULT_CSRF_HEADER_NAME = 'x-csrf-token';
const DEVELOPMENT_CSRF_SECRET = 'dev-csrf-secret';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const getCsrfSecret = () => {
  const secret = process.env.CSRF_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CSRF_SECRET is required in production');
  }
  return DEVELOPMENT_CSRF_SECRET;
};

export const getCsrfCookieName = () =>
  process.env.CSRF_COOKIE_NAME?.trim() || DEFAULT_CSRF_COOKIE_NAME;

export const getCsrfHeaderName = () =>
  process.env.CSRF_HEADER_NAME?.trim().toLowerCase() || DEFAULT_CSRF_HEADER_NAME;

const signCsrfValue = (value: string) =>
  crypto.createHmac('sha256', getCsrfSecret()).update(value, 'utf8').digest('base64url');

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const createCsrfToken = () => {
  const value = crypto.randomBytes(32).toString('base64url');
  return `${value}.${signCsrfValue(value)}`;
};

const isValidSignedToken = (token: string) => {
  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) return false;
  const value = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  return safeEqual(signature, signCsrfValue(value));
};

const readCookie = (req: Request, name: string) => {
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const buildCsrfCookieOptions = (): CookieOptions => {
  const sameSiteValue = (process.env.REFRESH_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (sameSiteValue !== 'lax' && sameSiteValue !== 'strict' && sameSiteValue !== 'none') {
    throw new Error('REFRESH_COOKIE_SAME_SITE must be lax, strict, or none');
  }
  const domain = process.env.REFRESH_COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production' || sameSiteValue === 'none',
    sameSite: sameSiteValue,
    path: '/',
    maxAge: getRefreshTokenExpiresInMs(),
    ...(domain ? { domain } : {}),
  };
};

export const setCsrfCookie = (res: Response) => {
  const token = createCsrfToken();
  res.cookie(getCsrfCookieName(), token, buildCsrfCookieOptions());
};

export const issueCsrfToken = (_req: Request, res: Response) => {
  setCsrfCookie(res);
  return res.json({ success: true });
};

export const csrfProtection = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

  const cookieToken = readCookie(req, getCsrfCookieName());
  const headerToken = req.get(getCsrfHeaderName());
  if (
    !cookieToken ||
    !headerToken ||
    !safeEqual(cookieToken, headerToken) ||
    !isValidSignedToken(cookieToken)
  ) {
    return next(AppError.forbidden('Invalid CSRF token'));
  }
  return next();
};

export const validateCsrfEnvironment = () => {
  getCsrfSecret();
  getCsrfCookieName();
  getCsrfHeaderName();
  buildCsrfCookieOptions();
};
