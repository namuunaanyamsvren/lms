import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const REPORT_TYPE_LABELS: Record<string, string> = {
  ENROLLMENT: 'Элсэлтийн тайлан',
  COURSE_PROGRESS: 'Хичээл дүүргэлтийн тайлан',
  ASSIGNMENT_QUIZ_PERFORMANCE: 'Даалгавар, шалгалтын гүйцэтгэл',
  GRADE_DISTRIBUTION: 'Дүнгийн тархалт',
  ATTENDANCE: 'Ирцийн тайлан',
  TEACHER_WORKLOAD: 'Багшийн ачааллын тайлан',
  PARENT_ENGAGEMENT: 'Эцэг эхийн оролцооны тайлан',
  ORG_USAGE_ADOPTION: 'Байгууллагын хэрэглээний тайлан',
  BILLING_REVENUE: 'Төлбөр, орлогын тайлан',
};

const reportReadyEventSchema = z.object({
  organizationId: z.string().min(1),
  reportJobId: z.string().min(1).max(200),
  reportType: z.string().min(1).max(100),
  recipientIds: z.array(z.string().min(1)).max(50),
}).strict();

export async function deliverReportReadyNotifications(raw: unknown) {
  const event = reportReadyEventSchema.parse(raw);
  const label = REPORT_TYPE_LABELS[event.reportType] || event.reportType;
  await Promise.all([...new Set(event.recipientIds)].map(userId =>
    deliverNotification({
      organizationId: event.organizationId,
      userId,
      eventType: 'REPORT_READY',
      idempotencyKey: `report:ready:${event.reportJobId}:${userId}`,
      title: 'Тайлан бэлэн боллоо',
      body: `"${label}" тайлан бэлэн боллоо. Татаж авахын тулд Тайлан хэсэг рүү орно уу.`,
      channels: ['IN_APP'],
      digestEligible: false,
      // Absolute: /reports is a single top-level route shared by every role
      // that can ever request a report job (report-data.service.ts's catalogFor gating).
      metadata: { reportJobId: event.reportJobId, reportType: event.reportType, actionUrl: '/reports' },
    })
  ));
}

export const startReportConsumers = () => subscribeToEvent(
  EVENT_EXCHANGE,
  'notification-service.report-ready.v1',
  EVENTS.REPORT_READY,
  raw => deliverReportReadyNotifications(raw),
  { deadLetter: true, inbox: notificationInbox },
);
