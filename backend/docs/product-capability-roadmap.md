# Additional Product Capabilities

This document defines the P3/P4 capability contracts. The registry source of truth is `backend/config/product-capabilities.json`; frontend visibility flags are mirrored in `frontend/src/config/productCapabilities.js`.

## Collaboration

- In-app messaging: tenant-scoped teacher/student/parent threads, immutable moderation audit, parent/minor visibility policy.
- Discussion forum: course membership required, instructor moderation, abuse report workflow, attachment scanning.
- Live class/video: provider adapter interface for Zoom, Google Meet, and Microsoft Teams; webhooks require signatures; recordings require consent.

## Calendar And Search

- Calendar export: schedule endpoints can expose iCal feeds and Google Calendar deep links; links must be signed and revocable.
- Cross-domain search: course, lesson, assignment, quiz, document, and announcement records must be indexed with tenant and role visibility fields.

## Intelligence And Engagement

- Learning analytics/risk alerts: risk reason must be explainable, auditable, and never the sole automated decision for minors.
- Personalized recommendations: teacher override and opt-out required; use only minimum necessary learning signals.
- Gamification: badges and leaderboards are tenant configurable; student leaderboard display must be opt-in.
- Survey/feedback: anonymous mode, retention limits, and anti-reidentification rules are required.
- AI quiz assistant: teacher approval is required before publishing generated content; prompts must redact student data and record audit metadata.

## Mobile And Offline

- PWA manifest is present at `frontend/public/manifest.webmanifest`.
- Offline lessons use an allowlist cache policy in `frontend/src/offline-capabilities.js`.
- Native mobile API readiness uses version and device session headers from `nativeMobileApiPolicy`.

## Interoperability

- SCORM/xAPI/LTI: uploaded packages are scanned, launch requests are signed, and xAPI statements are validated before storage.
- SIS integration: imports support dry-run, field mapping approval, idempotency keys, and rollback evidence.
- SSO: Google OAuth exists; SAML/OIDC/Microsoft require domain verification, JIT provisioning policy, and break-glass admin.
- Webhook/public integration API: tenant-scoped API keys, signed delivery, retry/DLQ, and audit logs are mandatory.
- Multi-language course content: course material supports locale variants with fallback and instructor review before publication.

## Delivery Gates

- Add Prisma/API contracts in owning service.
- Add OpenAPI route/schema/error examples.
- Add privacy/security review notes for minors.
- Add E2E smoke and tenant-isolation test.
- Add operational runbook entry and metrics.
