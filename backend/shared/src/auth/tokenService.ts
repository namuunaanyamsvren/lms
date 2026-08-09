import crypto from 'crypto';
import { Request, Response, CookieOptions } from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

const DEFAULT_ACCESS_TOKEN_TTL = '15m';
const DEFAULT_REFRESH_TOKEN_TTL = '7d';
const DEFAULT_REFRESH_COOKIE_NAME = 'lms_refresh';
const DEFAULT_REFRESH_COOKIE_PATH = '/api/v1/auth';
const DEVELOPMENT_ACCESS_SECRET = 'dev-access-secret';
const TEST_REFRESH_SECRET = 'test-only-refresh-secret';
const REFRESH_TOKEN_BYTES = 32;

type SameSite = 'lax' | 'strict' | 'none';
export type AuthEnvironmentScope = 'access' | 'full';

export interface AccessTokenClaims extends JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
  sessionId: string;
  emailVerified: boolean;
  emailVerificationRequired: boolean;
  phoneVerified: boolean;
  phoneVerificationRequired: boolean;
}

export interface CreateAccessTokenInput {
  userId: string;
  organizationId: string;
  role: string;
  sessionId: string;
  emailVerified?: boolean;
  emailVerificationRequired?: boolean;
  phoneVerified?: boolean;
  phoneVerificationRequired?: boolean;
}

export interface RefreshCookieConfig {
  name: string;
  options: CookieOptions;
  expiresInMs: number;
}

const getAccessTokenSecret = () => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ACCESS_TOKEN_SECRET is required in production');
  }
  return DEVELOPMENT_ACCESS_SECRET;
};

export function parseDuration(value: string, variableName = 'duration'): number {
  const match = /^(\d+)(ms|s|m|h|d|w)$/i.exec(value.trim());
  if (!match) {
    throw new Error(`${variableName} must use a positive duration such as 15m, 12h, or 7d`);
  }

  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`${variableName} must be a positive safe integer duration`);
  }

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  const duration = amount * multipliers[match[2].toLowerCase()];
  if (!Number.isSafeInteger(duration)) {
    throw new Error(`${variableName} is too large`);
  }
  return duration;
}

export function getAccessTokenExpiresIn(): string {
  const value =
    process.env.ACCESS_TOKEN_EXPIRES_IN ||
    process.env.JWT_ACCESS_EXPIRES_IN ||
    DEFAULT_ACCESS_TOKEN_TTL;
  parseDuration(value, 'ACCESS_TOKEN_EXPIRES_IN');
  return value;
}

export function getRefreshTokenExpiresInMs(): number {
  const value =
    process.env.REFRESH_TOKEN_EXPIRES_IN ||
    process.env.JWT_REFRESH_EXPIRES_IN ||
    DEFAULT_REFRESH_TOKEN_TTL;
  return parseDuration(value, 'REFRESH_TOKEN_EXPIRES_IN');
}

export function createAccessToken(input: CreateAccessTokenInput): string {
  const payload: AccessTokenClaims = {
    userId: input.userId,
    organizationId: input.organizationId,
    role: input.role,
    sessionId: input.sessionId,
    emailVerified: input.emailVerified === true,
    emailVerificationRequired: input.emailVerificationRequired === true,
    phoneVerified: input.phoneVerified === true,
    phoneVerificationRequired: input.phoneVerificationRequired === true,
  };
  return jwt.sign(payload, getAccessTokenSecret(), {
    algorithm: 'HS256',
    expiresIn: getAccessTokenExpiresIn(),
    subject: input.userId,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, getAccessTokenSecret(), {
    algorithms: ['HS256'],
  });
  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.organizationId !== 'string' ||
    typeof decoded.role !== 'string' ||
    typeof decoded.sessionId !== 'string' ||
    decoded.sub !== decoded.userId
  ) {
    throw new Error('Invalid access token claims');
  }
  return {
    ...decoded,
    emailVerified: decoded.emailVerified === true,
    emailVerificationRequired: decoded.emailVerificationRequired === true,
    phoneVerified: decoded.phoneVerified === true,
    phoneVerificationRequired: decoded.phoneVerificationRequired === true,
  } as AccessTokenClaims;
}

export function createSecureRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('REFRESH_TOKEN_SECRET is required');
  }
  return crypto.createHmac('sha256', secret || TEST_REFRESH_SECRET).update(token, 'utf8').digest('hex');
}

export function refreshTokenHashMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashRefreshToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const resolveSameSite = (): SameSite => {
  const value = (process.env.REFRESH_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (value !== 'lax' && value !== 'strict' && value !== 'none') {
    throw new Error('REFRESH_COOKIE_SAME_SITE must be lax, strict, or none');
  }
  return value;
};

export function buildRefreshCookieConfig(): RefreshCookieConfig {
  const sameSite = resolveSameSite();
  const secure = process.env.NODE_ENV === 'production' || sameSite === 'none';
  if (sameSite === 'none' && !secure) {
    throw new Error('REFRESH_COOKIE_SAME_SITE=none requires a secure cookie');
  }

  const expiresInMs = getRefreshTokenExpiresInMs();
  const domain = process.env.REFRESH_COOKIE_DOMAIN?.trim() || undefined;
  return {
    name: process.env.REFRESH_COOKIE_NAME?.trim() || DEFAULT_REFRESH_COOKIE_NAME,
    expiresInMs,
    options: {
      httpOnly: true,
      secure,
      sameSite,
      path: process.env.REFRESH_COOKIE_PATH?.trim() || DEFAULT_REFRESH_COOKIE_PATH,
      ...(domain ? { domain } : {}),
      maxAge: expiresInMs,
    },
  };
}

export function setRefreshCookie(res: Response, token: string, maxAgeMs?: number): void {
  const cookie = buildRefreshCookieConfig();
  res.cookie(cookie.name, token, {
    ...cookie.options,
    ...(maxAgeMs === undefined ? {} : { maxAge: Math.max(0, maxAgeMs) }),
  });
}

export function getRefreshTokenCookie(req: Request): string | undefined {
  const cookie = buildRefreshCookieConfig();
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== cookie.name) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function clearRefreshCookie(res: Response): void {
  const cookie = buildRefreshCookieConfig();
  const clearOptions = { ...cookie.options };
  delete clearOptions.maxAge;
  res.clearCookie(cookie.name, clearOptions);
}

export function resolveClientIp(req: Request): string | undefined {
  return req.ips[0] || req.ip || req.socket.remoteAddress || undefined;
}

export function parseSafeDeviceName(req: Request): string | undefined {
  const explicitName = req.headers['x-device-name'];
  const value = Array.isArray(explicitName) ? explicitName[0] : explicitName;
  const fallback = req.get('user-agent');
  const deviceName = Array.from(value || fallback || '')
    .filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('')
    .trim();
  return deviceName ? deviceName.slice(0, 200) : undefined;
}

export function maskIp(ipAddress?: string): string | undefined {
  if (!ipAddress) return undefined;
  if (ipAddress.includes(':')) {
    const segments = ipAddress.split(':');
    return `${segments.slice(0, 4).join(':')}::`;
  }
  const segments = ipAddress.split('.');
  return segments.length === 4 ? `${segments[0]}.${segments[1]}.${segments[2]}.0` : ipAddress;
}

export function validateAuthenticationEnvironment(
  scope: AuthEnvironmentScope = 'full',
): void {
  getAccessTokenSecret();
  getAccessTokenExpiresIn();
  if (scope === 'full') {
    buildRefreshCookieConfig();
  }

  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL && !process.env.ALLOWED_ORIGINS) {
    throw new Error('FRONTEND_URL or ALLOWED_ORIGINS is required in production');
  }
}
