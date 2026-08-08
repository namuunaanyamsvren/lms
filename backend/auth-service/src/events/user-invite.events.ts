import { EVENT_EXCHANGE, EVENTS, publishEvent } from '@lms/shared';

export const publishUserInviteEmail = async (
  user: { id: string; organizationId: string; email: string; firstName?: string | null },
  rawToken: string,
) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  await publishEvent(EVENT_EXCHANGE, EVENTS.USER_INVITED, {
    userId: user.id,
    organizationId: user.organizationId,
    recipientEmail: user.email,
    firstName: user.firstName || '',
    inviteUrl: `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}&purpose=invite`,
    occurredAt: new Date().toISOString(),
  });
};
