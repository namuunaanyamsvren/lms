import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { AuthAuditEventType, Role } from '@prisma/client-auth';
import { AppError, setRefreshCookie } from '@lms/shared';
import { enqueueUserCreated } from '../services/auth-outbox.service';
import {
  buildGoogleAuthorizationUrl,
  consumeGoogleExchangeCode,
  consumeGoogleOAuthState,
  createGoogleExchangeCode,
  createGoogleOAuthState,
  exchangeGoogleAuthorizationCode,
  googleOAuthFrontendRedirect,
} from '../services/google-oauth.service';
import {
  createAuthenticatedSession,
  getSessionRequestContext,
} from '../services/session.service';
import { getOrganizationAuthPolicy } from '../services/organization-policy.service';

import { prisma } from '../lib/prisma';

const queryString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const redirectWithError = (res: Response, error: string) =>
  res.redirect(googleOAuthFrontendRedirect({ error }));

export const beginGoogleOAuth = async (req: Request, res: Response) => {
  const organizationId = queryString(req.query.organizationId);
  if (!organizationId) throw AppError.badRequest('organizationId is required');

  const policy = await getOrganizationAuthPolicy(organizationId);
  if (!policy.active) throw AppError.forbidden('Organization is not active');

  const { state, codeChallenge } = await createGoogleOAuthState(organizationId, res);
  return res.redirect(buildGoogleAuthorizationUrl(state, codeChallenge));
};

export const handleGoogleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const returnedState = queryString(req.query.state);
    const { organizationId, codeVerifier } =
      await consumeGoogleOAuthState(req, res, returnedState);

    const authorizationCode = queryString(req.query.code);
    if (!authorizationCode) return redirectWithError(res, 'missing_code');

    const profile = await exchangeGoogleAuthorizationCode(authorizationCode, codeVerifier);
    const policy = await getOrganizationAuthPolicy(organizationId);
    if (!policy.active) return redirectWithError(res, 'organization_unavailable');

    const context = getSessionRequestContext(req);
    const { accessToken, rawRefreshToken } = await prisma.$transaction(async tx => {
      const linkedAccount = await tx.oAuthAccount.findUnique({
        where: {
          organizationId_provider_providerAccountId: {
            organizationId,
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        include: { user: true },
      });

      let user = linkedAccount?.user || null;
      if (user && !user.isActive) throw AppError.forbidden('User account is inactive');

      if (!user) {
        user = await tx.userAccount.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            email: { equals: profile.email, mode: 'insensitive' },
          },
        });

        if (!user) {
          if (!policy.allowRegister) {
            throw AppError.forbidden('Self-registration is disabled for this organization');
          }
          const userCount = await tx.userAccount.count({
            where: { organizationId, deletedAt: null },
          });
          if (userCount >= policy.maxUsers) {
            throw AppError.conflict('Organization user limit has been reached');
          }
          user = await tx.userAccount.create({
            data: {
              organizationId,
              email: profile.email,
              firstName: profile.firstName || profile.displayName || null,
              lastName: profile.lastName || null,
              passwordHash: await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 10),
              role: Role.USER,
              isEmailVerified: true,
            },
          });
          await enqueueUserCreated(tx, user);
        } else if (!user.isActive) {
          throw AppError.forbidden('User account is inactive');
        } else if (!user.isEmailVerified) {
          user = await tx.userAccount.update({
            where: { id: user.id },
            data: { isEmailVerified: true },
          });
        }

        await tx.oAuthAccount.create({
          data: {
            organizationId,
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            email: profile.email,
            userId: user.id,
          },
        });
      }

      return createAuthenticatedSession(
        tx,
        user,
        context,
        AuthAuditEventType.LOGIN_SUCCESS,
        policy.requireEmailVerification,
        policy.requirePhoneVerification,
      );
    });

    const exchangeCode = await createGoogleExchangeCode(accessToken);
    setRefreshCookie(res, rawRefreshToken);
    return res.redirect(googleOAuthFrontendRedirect({ code: exchangeCode }));
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('[Google OAuth callback] unexpected failure', error);
    }
    return redirectWithError(res, 'authentication_failed');
  }
};

export const exchangeGoogleLoginCode = async (req: Request, res: Response) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
    throw AppError.badRequest('Google login code is invalid');
  }
  const accessToken = await consumeGoogleExchangeCode(code);
  return res.status(200).json({
    success: true,
    data: { token: accessToken },
  });
};
