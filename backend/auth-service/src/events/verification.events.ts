import { EVENT_EXCHANGE, EVENTS, publishEvent } from '@lms/shared';

interface VerificationEmailUser {
  id: string;
  organizationId: string;
  email: string;
}

export const publishVerificationEmail = async (
  user: VerificationEmailUser,
  rawToken: string,
) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  await publishEvent(EVENT_EXCHANGE, EVENTS.EMAIL_VERIFICATION_REQUESTED, {
    userId: user.id,
    organizationId: user.organizationId,
    recipientEmail: user.email,
    verificationUrl: `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`,
    occurredAt: new Date().toISOString(),
  });
};
