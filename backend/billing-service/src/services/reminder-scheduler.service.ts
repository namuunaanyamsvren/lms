import { prisma } from '../lib/prisma';
import { sendOutstandingReminderEvents } from '../controllers/billing.controller';

export async function processDueBillingReminders(limit = 50) {
  const organizations = await prisma.invoice.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lte: new Date() },
    },
    distinct: ['organizationId'],
    take: limit,
    select: { organizationId: true },
  });
  let reminderCount = 0;
  for (const organization of organizations) {
    const rows = await sendOutstandingReminderEvents(organization.organizationId);
    reminderCount += rows.length;
  }
  return reminderCount;
}

let reminderTimer: NodeJS.Timeout | undefined;
export const startBillingReminderScheduler = () => {
  const interval = Number(process.env.BILLING_REMINDER_INTERVAL_MS || 60 * 60 * 1000);
  reminderTimer = setInterval(() => {
    processDueBillingReminders().catch(error => console.error('[Billing reminders]', error));
  }, interval);
  reminderTimer.unref();
  void processDueBillingReminders();
};

export const stopBillingReminderScheduler = () => {
  if (reminderTimer) clearInterval(reminderTimer);
};
