# Attendance architecture notes

## Session model

`Attendance` rows key on `(organizationId, cohortId, studentId, date)` — one
record per student per cohort per calendar day (`date` is a `@db.Date`
column, no time component, so this constraint is unambiguous). `scheduleId`
is an optional link to the `Schedule` row (the recurring weekly template —
`Schedule` has no `date` field, so it does not identify a single meeting on
its own) that the session nominally belongs to; the pair `(scheduleId, date)`
is the de-facto session identity when a schedule link is present. A cohort
that meets more than once on the same calendar day (e.g. a double period)
still only gets one `Attendance` row per student per day today — that's a
deliberate simplification, not an oversight; splitting a day into multiple
sessions per cohort would require including `scheduleId` in the uniqueness
constraint and is left for whenever that need actually arises.

## Notification and threshold-alert flow

`recordAttendance` / `attendance.service.ts`'s `recordBatch` both call
`computeNotificationPayload` (`academic-service/src/services/attendance.service.ts`)
inside the same transaction as the write. It resolves the student's approved
guardians with `VIEW_ATTENDANCE`, counts unexcused absences in the current
term (falling back to a trailing 90-day window if the cohort has no term),
and flags `thresholdCrossed` at a fixed 3 unexcused absences. Both flags and
the resolved recipient/instructor ids travel in the `ATTENDANCE_RECORDED`/
`ATTENDANCE_UPDATED` outbox event payload, because `notification-service` has
no database access to academic-service's schema and cannot look any of this
up itself — see `notification-service/src/events/attendance.consumer.ts`,
which mirrors `schedule.consumer.ts`'s pattern (zod-validated payload,
`deliverNotification` per recipient, idempotency key derived from
`updatedAt`).

## QR / self-check-in (design note — not implemented)

This is explicitly optional in the backlog. If it's built later, the
straightforward extension is a signed, time-boxed check-in token rather than
a new authentication mechanism:

1. A teacher starting a session requests a check-in token for
   `(cohortId, scheduleId, date)`. Reuse the existing signed-URL primitive in
   `backend/shared/src/files/security.ts` (`createSignedFileUrl`'s HMAC
   pattern, not the function itself — it's file-specific) to mint a token
   scoped to that triple with a short expiry (e.g. 10–15 minutes), the same
   way file downloads are already signed and expiry-checked.
2. Render the token as a QR code client-side (no new backend surface beyond
   issuing the token — QR encoding is a pure frontend concern).
2. A new `POST /attendance/check-in` endpoint, authenticated as the student
   (normal bearer token — the QR token is not a substitute for login, only
   proof the student is physically at that session), verifies the signature
   and expiry, confirms the student is enrolled in the cohort, and creates
   or upserts the `Attendance` row exactly like `recordAttendance` does today
   (status `PRESENT`, `scheduleId` set, same notification/threshold path).
3. Rate-limit and single-use the token per student (a `usedBy` set or a short
   Redis key) so a screenshot can't be replayed by someone else after the
   fact — the existing Redis client (`@lms/shared`'s redis module) already
   used elsewhere in academic-service is the natural fit.

No schema changes are needed to start this later: `Attendance.scheduleId`
and the existing enrollment/cohort checks already cover everything except
the token issuance/verification step itself.
