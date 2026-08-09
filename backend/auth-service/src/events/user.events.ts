import { EVENT_EXCHANGE, EVENTS, publishEvent } from '@lms/shared';

type CreatedUser = {
  id: string;
  organizationId: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
};

export const publishUserCreated = async (user: CreatedUser) => {
  await publishEvent(EVENT_EXCHANGE, EVENTS.USER_CREATED, {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    username: user.username,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    occurredAt: new Date().toISOString(),
  });
};
