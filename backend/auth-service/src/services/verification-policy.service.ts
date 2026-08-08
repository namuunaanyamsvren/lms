import crypto from 'crypto';

export interface EmailVerificationState {
  isEmailVerified: boolean;
}

export const isEmailVerificationRequired = (
  policyRequired: boolean,
  user: EmailVerificationState,
): boolean => policyRequired && !user.isEmailVerified;

export const hashVerificationToken = (rawToken: string): string =>
  crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

export const isVerificationResendThrottled = (
  latestCreatedAt: Date | null,
  now: Date,
  cooldownMs: number,
): boolean =>
  Boolean(latestCreatedAt && latestCreatedAt.getTime() + cooldownMs > now.getTime());

export type VerificationTokenDisposition = 'CLAIM' | 'IDEMPOTENT' | 'INVALID';

export const getVerificationTokenDisposition = (
  token: {
    usedAt: Date | null;
    expiresAt: Date;
    alreadyVerified: boolean;
  } | null,
  now: Date,
): VerificationTokenDisposition => {
  if (!token || token.expiresAt <= now) return 'INVALID';
  if (token.usedAt) return token.alreadyVerified ? 'IDEMPOTENT' : 'INVALID';
  return 'CLAIM';
};
