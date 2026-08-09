# Schedule timezone policy

All organization schedules currently use the IANA timezone `Asia/Ulaanbaatar`
(UTC+08:00). The academic API returns this value in schedule response metadata
and in `GET /schedules/options`; the frontend uses the same constant for week and
month calendar rendering.

## Storage and rendering

- `dayOfWeek`, `startTime`, and `endTime` describe a recurring local wall-clock
  interval in `Asia/Ulaanbaatar`.
- Time-only values are stored as `HH:mm` and are not converted to UTC.
- Term start/end dates bound calendar occurrences. Calendar labels and date
  calculations are rendered in the policy timezone.
- Intervals are half-open: `[startTime, endTime)`. Consecutive classes such as
  `10:00–11:00` and `11:00–12:00` are allowed.

## Validation

The API rejects `startTime >= endTime`. Within the same organization, semester,
and weekday it also rejects overlapping intervals for either the assigned
teacher or room. The checks run inside a serializable transaction so concurrent
create/update requests cannot bypass conflict validation.

If multi-timezone organizations are introduced later, timezone must become an
organization-level IANA timezone field and be included in all schedule event
payloads before the fixed policy is removed.
