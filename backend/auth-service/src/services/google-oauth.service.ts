import crypto from 'crypto';
import { CookieOptions, Request, Response } from 'express';
import { AppError, getRedisClient } from '@lms/shared';

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_PROVIDER = 'google';
const STATE_TTL_SECONDS = 10 * 60;
const EXCHANGE_TTL_SECONDS = 60;
const DEFAULT_OAUTH_COOKIE_PATH = '/';
const DEFAULT_STATE_COOKIE_NAME = 'lms_google_oauth_state';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
}

export interface GoogleProfile {
  provider: typeof GOOGLE_PROVIDER;
  providerAccountId: string;
  email: string;
  emailVerified: true;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  pictureUrl?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

interface OAuthStateRecord {
  organizationId: string;
  codeVerifier: string;
}

const requiredValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Google OAuth`);
  return value;
};

const parseAbsoluteUrl = (value: string, name: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }
  if (
    process.env.NODE_ENV === 'production' &&
    parsed.protocol !== 'https:' &&
    parsed.hostname !== 'localhost' &&
    parsed.hostname !== '127.0.0.1'
  ) {
    throw new Error(`${name} must use HTTPS in production`);
  }
  return parsed;
};

export const getGoogleOAuthConfig = (): GoogleOAuthConfig => {
  const redirectUri = requiredValue('GOOGLE_REDIRECT_URI');
  const redirect = parseAbsoluteUrl(redirectUri, 'GOOGLE_REDIRECT_URI');
  const supportedCallbackPaths = new Set([
    '/auth/callback',
    '/api/auth/google/callback',
    '/api/v1/auth/google/callback',
  ]);
  if (!supportedCallbackPaths.has(redirect.pathname)) {
    throw new Error(
      'GOOGLE_REDIRECT_URI must use /auth/callback, /api/auth/google/callback, or /api/v1/auth/google/callback',
    );
  }

  const frontendUrl = requiredValue('FRONTEND_URL');
  parseAbsoluteUrl(frontendUrl, 'FRONTEND_URL');

  return {
    clientId: requiredValue('GOOGLE_CLIENT_ID'),
    clientSecret: requiredValue('GOOGLE_CLIENT_SECRET'),
    redirectUri,
    frontendUrl,
  };
};

export const validateGoogleOAuthEnvironment = (): void => {
  getGoogleOAuthConfig();
};

export const buildGoogleAuthorizationUrl = (
  state: string,
  codeChallenge: string,
  config = getGoogleOAuthConfig(),
): string => {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('include_granted_scopes', 'true');
  return url.toString();
};

const parseJsonResponse = async <T>(response: globalThis.Response): Promise<T> => {
  try {
    return await response.json() as T;
  } catch {
    throw AppError.unauthorized('Google OAuth provider returned an invalid response');
  }
};

export const exchangeGoogleAuthorizationCode = async (
  code: string,
  codeVerifier: string,
  config = getGoogleOAuthConfig(),
): Promise<GoogleProfile> => {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokens = await parseJsonResponse<GoogleTokenResponse>(tokenResponse);
  if (!tokenResponse.ok || !tokens.access_token) {
    throw AppError.unauthorized('Google authorization code is invalid or expired');
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const userInfo = await parseJsonResponse<GoogleUserInfo>(userInfoResponse);
  if (
    !userInfoResponse.ok ||
    !userInfo.sub ||
    !userInfo.email ||
    userInfo.email_verified !== true
  ) {
    throw AppError.unauthorized('Google account must have a verified email address');
  }

  return {
    provider: GOOGLE_PROVIDER,
    providerAccountId: userInfo.sub,
    email: userInfo.email.trim().toLowerCase(),
    emailVerified: true,
    firstName: userInfo.given_name?.trim() || undefined,
    lastName: userInfo.family_name?.trim() || undefined,
    displayName: userInfo.name?.trim() || undefined,
    pictureUrl: userInfo.picture?.trim() || undefined,
  };
};

const opaqueKey = (kind: 'state' | 'exchange', value: string) =>
  `oauth:google:${kind}:${crypto.createHash('sha256').update(value).digest('hex')}`;

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const readCookie = (req: Request, name: string): string | undefined => {
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

const stateCookieName = () =>
  process.env.GOOGLE_OAUTH_STATE_COOKIE_NAME?.trim() || DEFAULT_STATE_COOKIE_NAME;

export const stateCookiePath = () =>
  process.env.GOOGLE_OAUTH_STATE_COOKIE_PATH?.trim() || DEFAULT_OAUTH_COOKIE_PATH;

const stateCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: stateCookiePath(),
  maxAge: STATE_TTL_SECONDS * 1000,
});

export const createGoogleOAuthState = async (
  organizationId: string,
  res: Response,
): Promise<{ state: string; codeChallenge: string }> => {
  const state = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier, 'ascii')
    .digest('base64url');
  const record: OAuthStateRecord = { organizationId, codeVerifier };
  const result = await getRedisClient().set(
    opaqueKey('state', state),
    JSON.stringify(record),
    'EX',
    STATE_TTL_SECONDS,
    'NX',
  );
  if (result !== 'OK') throw AppError.internal('Unable to start Google login');
  res.cookie(stateCookieName(), state, stateCookieOptions());
  return { state, codeChallenge };
};

export const consumeGoogleOAuthState = async (
  req: Request,
  res: Response,
  returnedState: string,
): Promise<OAuthStateRecord> => {
  const cookieState = readCookie(req, stateCookieName());
  const clearOptions = stateCookieOptions();
  delete clearOptions.maxAge;
  res.clearCookie(stateCookieName(), clearOptions);

  if (!cookieState || !returnedState || !safeEqual(cookieState, returnedState)) {
    throw AppError.unauthorized('Google OAuth state validation failed');
  }
  const serialized = await getRedisClient().getdel(opaqueKey('state', returnedState));
  if (!serialized) throw AppError.unauthorized('Google OAuth state is invalid or expired');

  try {
    const record = JSON.parse(serialized) as OAuthStateRecord;
    if (
      !record.organizationId ||
      typeof record.organizationId !== 'string' ||
      !record.codeVerifier ||
      typeof record.codeVerifier !== 'string'
    ) throw new Error();
    return record;
  } catch {
    throw AppError.unauthorized('Google OAuth state is invalid or expired');
  }
};

export const createGoogleExchangeCode = async (accessToken: string): Promise<string> => {
  const code = crypto.randomBytes(32).toString('base64url');
  const result = await getRedisClient().set(
    opaqueKey('exchange', code),
    accessToken,
    'EX',
    EXCHANGE_TTL_SECONDS,
    'NX',
  );
  if (result !== 'OK') throw AppError.internal('Unable to complete Google login');
  return code;
};

export const consumeGoogleExchangeCode = async (code: string): Promise<string> => {
  const accessToken = await getRedisClient().getdel(opaqueKey('exchange', code));
  if (!accessToken) throw AppError.unauthorized('Google login code is invalid or expired');
  return accessToken;
};

export const googleOAuthFrontendRedirect = (
  outcome: { code: string } | { error: string },
): string => {
  const config = getGoogleOAuthConfig();
  const url = new URL('/auth/google/callback', config.frontendUrl);
  if ('code' in outcome) url.searchParams.set('code', outcome.code);
  else url.searchParams.set('error', outcome.error);
  return url.toString();
};
