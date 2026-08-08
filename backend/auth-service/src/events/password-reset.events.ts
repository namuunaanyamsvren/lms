import { EVENT_EXCHANGE, EVENTS, publishEvent } from '@lms/shared';

interface PasswordResetUser {
  id: string;
  organizationId: string;
  email: string;
}

export const publishPasswordResetEmail = async (
  user: PasswordResetUser,
  rawToken: string,
) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  await publishEvent(EVENT_EXCHANGE, EVENTS.PASSWORD_RESET_REQUESTED, {
    userId: user.id,
    organizationId: user.organizationId,
    recipientEmail: user.email,
    resetUrl: `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`,
    occurredAt: new Date().toISOString(),
  });
};
