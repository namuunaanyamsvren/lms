import { EVENTS, EVENT_EXCHANGE, subscribeToEvent } from '@lms/shared';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const QUEUE = 'notification-service.notification-send.v2';

export const startNotificationConsumer = () =>
  subscribeToEvent(EVENT_EXCHANGE, QUEUE, EVENTS.NOTIFICATION_SEND, async payload => {
    await deliverNotification(payload);
  }, { deadLetter: true, inbox: notificationInbox });
