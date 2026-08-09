# Event Catalog

All events use envelope version `1`.

```json
{
  "eventId": "uuid",
  "eventType": "USER_CREATED",
  "version": 1,
  "occurredAt": "2026-08-05T00:00:00.000Z",
  "traceId": "trace-id",
  "organizationId": "org-id",
  "payload": {}
}
```

Core events:

- `USER_CREATED`: auth publishes; academic creates domain user; notification may send invite/welcome.
- `USER_UPDATED`: auth publishes profile/role/status changes.
- `COURSE_PUBLISHED`: academic publishes; notification informs enrolled users.
- `ASSIGNMENT_CREATED`: academic publishes; notification informs enrolled students.
- `SUBMISSION_CREATED`: academic publishes; teacher notification.
- `GRADE_PUBLISHED`: academic publishes; student/parent notification.
- `ATTENDANCE_RECORDED`: academic publishes; parent notification for absence/late.
- `QUIZ_ATTEMPT_SUBMITTED`: academic publishes; analytics/notification consumers.
- `INVOICE_ISSUED`: billing publishes; notification sends payment reminder.
- `PAYMENT_COMPLETED`: billing publishes; finance/audit notification.
- `NOTIFICATION_DELIVERED`: notification publishes operational delivery status.

Compatibility rules:

- Additive payload fields are backwards compatible.
- Removing or changing a field requires a new event version.
- Consumers must reject unsupported versions to DLQ with poison classification.
