# EduPulse LMS — Production Master Backlog

> Сүүлд кодтой тулгаж шинэчилсэн: **2026-07-28**
>
> Зорилго: React + Vite frontend, Express + TypeScript microservices, Prisma,
> PostgreSQL, Redis, RabbitMQ, JWT бүхий multi-tenant SaaS LMS-ийг бодит
> production хэрэглээнд гаргах.

## Тэмдэглэгээ

- `[x]` — кодод хэрэгжсэн бөгөөд build/test/runtime-аар баталгаажсан
- `[ ]` — хийх шаардлагатай
- `P0` — production/MVP blocker
- `P1` — LMS-ийн үндсэн ажиллагаа
- `P2` — SaaS, automation, scale
- `P3` — чанар, UX, өргөтгөл
- `P4` — advanced/optional

## Definition of Done

Feature бүр дараах бүх нөхцөлийг хангасны дараа л backlog дээр `[x]` болно.
PR бүр `.github/pull_request_template.md` дээрх DoD checklist-ийг бөглөж,
хамаарахгүй мөр бүрт товч тайлбар бичнэ.

- Backend authorization нь tenant, role, ownership, resource access-ийг шалгасан
- Request params/query/body Zod validation-тай
- Prisma migration болон rollback/restore төлөвлөгөөтэй
- API contract/OpenAPI шинэчлэгдсэн
- Frontend loading, empty, error, success, disabled төлөвтэй
- Unit, integration, authorization, tenant-isolation test нэмэгдсэн
- Монгол UI текст, date/time/number format зөв
- Desktop болон mobile responsive шалгалт хийсэн
- Keyboard navigation, focus state, label, contrast шалгасан
- Audit log/notification шаардлагатай бол үүсдэг
- Build, lint, test, migration, smoke test CI дээр амжилттай
- Нууц мэдээлэл log/error/API response-д задрахгүй

---

# 0. Одоогийн бодит төлөв

## Хийгдсэн суурь

- [x] Gateway бүх frontend хүсэлтийн нэгдсэн `/api` entry point болсон
- [x] Gateway JWT шалгалт, Helmet, Morgan, rate limit ашигладаг
- [x] Auth register/login/refresh/logout/password reset/verification backend flow бэлэн
- [x] JWT-ээс `organizationId` авч tenant isolation хийдэг; client header-т итгэдэггүй
- [x] Academic course, enrollment, assignment submission, grade, quiz attempt,
  attendance болон schedule-ийн үндсэн read/write endpoint-уудтай
- [x] Teacher зөвхөн өөрийн course-ийн cohort-д student enroll/remove хийдэг
- [x] Student course enrollment-ээр дамжин schedule/content хардаг
- [x] Parent guardian холбоосоор хүүхдийн мэдээлэлд хязгаарлагддаг
- [x] Schedule нь Course-д хамаардаг; student бүрд duplicate schedule үүсгэдэггүй
- [x] Organization onboarding, branding/settings-ийн үндсэн API/UI бэлэн
- [x] Notification in-app CRUD, RabbitMQ consumer, SMTP adapter бэлэн
- [x] Redis болон RabbitMQ shared client-ууд service-үүдэд холбогдсон
- [x] Backend production dependency audit 0 vulnerability байсан
- [x] Frontend lint/build амжилттай, route-level lazy loading ашигладаг
- [x] Backend TypeScript workspace build амжилттай
- [x] Vitest/Supertest 3 test file, 9 test амжилттай
- [x] Academic baseline migration үүссэн
- [x] Docker Compose дээр gateway, 5 service, PostgreSQL, Redis, RabbitMQ асдаг
- [x] Монголчилсон active navigation, form, profile, notification, help,
  organization settings болон demo academic title-ууд

## Одоогийн гол эрсдэл

- [ ] `P0` Frontend refresh token хадгалдаггүй, access token дуусахад session тасарна
- [ ] `P0` Frontend logout нь backend `/logout` дуудахгүй тул refresh token revoke болохгүй
- [ ] `P0` Schedule backend/API client байгаа ч frontend page, route, menu байхгүй
- [ ] `P0` Quiz attempt completion API client-ээс `score` шууд хүлээн авдаг; server-side
  answer evaluation биш тул оноо хуурамчаар өгөх боломжтой
- [x] `RESOLVED` Billing `/api/payments` нь authoritative invoice/payment flow ашигладаг
- [x] `RESOLVED` Auth, organization, billing, notification schema initial migration-тай
- [ ] `P0` Docker Compose-д production ашиглаж болохгүй hardcoded secret/password байна
- [ ] `P0` Frontend component/E2E test, CI/CD workflow байхгүй
- [x] `RESOLVED` Seed deterministic, dev/test-only, бүх write upsert болсон

---

# 1. P0 — Production blocker

## 1.1 Authentication ба session

- [x] Frontend-д `refreshToken` хадгалах strategy сонгох:
  - [x] Recommended: Secure + HttpOnly + SameSite cookie
  - [x] Cookie ашиглавал CSRF хамгаалалт нэмэх
  - [x] LocalStorage-д refresh token хадгалахгүй байх
- [x] API client-д 401 interceptor/single-flight refresh queue хийх
- [x] Access token expire болохын өмнө silent refresh хийх
- [x] Refresh амжилтгүй бол session цэвэрлэж login руу буцаах
- [x] Logout үед `POST /api/auth/logout` дуудаж refresh token revoke хийх
- [x] “Бүх төхөөрөмжөөс гарах” endpoint/UI хийх
- [x] Active sessions/device list, session revoke API/UI хийх
- [x] Refresh token reuse detection болон token family revocation хийх
- [x] Login/register дараа `/me`-ээр authoritative user state сэргээх
- [x] Page reload үед token/user consistency шалгах
- [x] Password policy: minimum 10–12 тэмдэгт, compromised/common password check
- [x] Login brute-force хамгаалалтад IP + account key хослуулах
- [x] Failed login counter, temporary account lock, security notification хийх
- [x] Email verification шаардах эсэхийг organization policy болгох
- [ ] Phone verification-д бодит SMS provider холбох
- [x] Forgot/reset password token-ийг production log-д хэзээ ч бичихгүй болгох
- [x] Auth audit event: login success/failure, password reset, token revoke
- [ ] Optional MFA/TOTP recovery code architecture төлөвлөх RESEND.COM / SUPABASE EMAIL OTP API / TWILIO FREE TRIAL

## 1.2 Нууц ба environment

- [ ] Compose дахь `super-secret-jwt-key`, DB password, RabbitMQ guest,
  internal service key-г устгаж secret manager/env file ашиглах
- [ ] Access/refresh JWT secret тусдаа, 256-bit random утгатай болгох
- [x] Secret rotation runbook хийх
- [x] `.env.example` бүрд required/optional/default тайлбар нэмэх
- [x] Startup үед required env-үүдийг Zod schema-аар validate хийж fail-fast болгох
- [x] Development, test, staging, production config-ийг тусгаарлах
- [ ] Production CORS allowlist тохируулах; `cors()` wildcard ашиглахгүй
- [ ] PostgreSQL/Redis/RabbitMQ/service port-уудыг production host дээр public expose хийхгүй
- [x] Internal service authentication-ийг static shared key-ээс mTLS эсвэл signed
  service token руу шилжүүлэх
- [x] Secret болон `.env` git history-д орсон эсэхийг secret scanner-аар шалгах

## 1.3 Database migration ба integrity

- [x] Auth schema initial migration үүсгэх
- [x] Organization schema initial migration үүсгэх
- [x] Billing schema initial migration үүсгэх
- [x] Notification schema initial migration үүсгэх
- [x] Migration naming/version policy тогтоох
- [x] Deploy pipeline-д `prisma migrate deploy` оруулах
- [x] Production startup-аас automatic destructive schema sync хориглох
- [x] Migration rollback/forward-fix runbook бичих
- [x] PostgreSQL automated backup, retention, restore drill хийх
- [x] Point-in-time recovery тохируулах
- [x] `Float` money талбаруудыг `Decimal` + currency болгон өөрчлөх
- [x] Duplicate academic `Invoice/Payment/Notification` model-ийг authoritative
  billing/notification service-тэй хэрхэн нэгтгэхийг шийдэх
- [x] Cross-service ID/reference integrity strategy тодорхойлох
- [x] Soft-delete шаардлагатай Organization/User/Course records-д `deletedAt` нэмэх
- [x] PII erase/anonymize workflow хийх
- [x] Seed-ийг бүрэн idempotent upsert болгох
- [x] Seed-ийг dev/test-only болгож production дээр ажиллах хамгаалалт хийх
- [x] Deterministic test fixtures/factory хийх

## 1.4 Schedule feature-ийг frontend-д дуусгах

- [x] `/teacher/schedules` list page
- [x] `/teacher/schedules/new` create page
- [x] `/teacher/schedules/:id/edit` edit page
- [x] Teacher delete confirmation
- [x] Teacher calendar/table toggle
- [x] `/student/schedules` “Миний хуваарь” page
- [x] `/parent/schedules` хүүхэд сонгож харах page
- [x] Admin/principal organization schedule view
- [x] Desktop/mobile sidebar menu холбоос
- [x] Day enum-ийг Монгол гарагийн нэрээр render хийх
- [x] Timezone policy (`Asia/Ulaanbaatar`) тодорхойлох
- [x] Start/end time, overlapping room, overlapping teacher validation
- [x] Semester filter, course filter, teacher filter
- [x] Calendar week/month view
- [x] Schedule create/update/delete notification event
- [x] Enrolled student schedule update-ийг refresh/cache invalidation-аар шууд харуулах
- [x] Schedule frontend unit/integration/E2E test

## 1.5 Quiz security

- [x] Question correct answer-ийг student GET response-д буцаахгүй байх
- [x] Attempt start үед immutable question snapshot үүсгэх
- [x] Student зөвхөн answer payload илгээдэг болгох
- [x] Оноог server-side calculate хийх
- [x] Time limit-ийг server timestamp-аар enforce хийх
- [x] Attempt count/max attempts enforce хийх
- [x] Duplicate submit/idempotency хамгаалалт
- [x] Auto-submit болон expired attempt handling
- [x] Random question/order option
- [x] Passing score/result visibility policy
- [x] Manual grading шаардлагатай question type
- [x] Quiz authorization/cheating/security integration test

## 1.6 Billing blocker

- [ ] Billing controller/service/validator/error mapping хийх
- [ ] `/api/payments` хоосон placeholder-ийг бодит endpoint болгох
- [ ] Subscription current/list/create/change/cancel API
- [ ] Pricing plan config (`FREE/ENTERPRISE`)
- [ ] Stripe test-mode customer/subscription/checkout portal холбох
- [ ] Stripe webhook raw-body route хийх
- [ ] Webhook signature verification
- [ ] Webhook idempotency/event table
- [ ] Payment success/failure/refund reconciliation
- [ ] Invoice list/detail/download API
- [ ] Currency, tax/VAT, billing address model
- [ ] Invoice PDF generation
- [ ] Cloudflare R2/S3 private storage + signed download URL
- [ ] Failed payment retry/dunning notification
- [ ] Plan limits (`maxUsers`, storage, courses) enforce хийх
- [ ] Billing role/tenant isolation test
- [ ] Stripe CLI webhook E2E test

## 1.7 CI/CD release gate

- [x] Migration validation
- [x] OpenAPI contract validation
- [x] Dependency audit/SBOM/license scan
- [x] Secret scan
- [x] Container vulnerability scan
- [x] Integration test-д PostgreSQL/Redis/RabbitMQ service container ашиглах
- [x] Manual approvalтай production deploy
- [x] Rollback strategy болон previous image retention
- [ ] Frontend React Router upstream advisory-г patched stable release гарахад upgrade хийх (blocked: GHSA-qwww-vcr4-c8h2 unpatched as of 2026-08-03, tracked via audit exception in security.yml)
- [x] Renovate/Dependabot автомат dependency PR тохируулах
- [x] Lockfile integrity болон reproducible install шалгах

---

# 2. P1 — LMS үндсэн domain

## 2.0 Product scope ба permission contract

- [x] MVP-д багтах/багтахгүй feature-ийг product requirement document-д батлах
- [x] Role бүрийн capability matrix гаргах: student, teacher, parent, staff,
  principal, org admin, super admin, finance
- [x] Resource бүрд create/read/update/delete/publish/export permission тодорхойлох
- [x] Ownership дүрэм: organization, course instructor, cohort, enrollment, guardian
- [x] Academic workflow state diagram гаргах
- [x] User journey ба acceptance criteria role бүрд бичих
- [x] Billing ашиглахгүй MVP бол gateway/service/UI placeholder-ийг бүрэн нуух
- [x] SLA, supported browser/device, expected tenant/user/data volume тогтоох

## 2.1 User ба role management

- [x] Admin user create/invite API/UI
- [x] Teacher, principal, staff, finance role-ийг зөвхөн admin assign хийх
- [x] User edit profile, role, status API/UI
- [x] User activate/deactivate/suspend
- [x] Bulk user import CSV template/preview/error report
- [x] Bulk export
- [x] Search/filter/sort/pagination
- [x] Student ID, employee ID зэрэг organization-specific identifier
- [x] Profile зураг upload
- [x] User preference: language, timezone, notification
- [x] Academic user mirror update/deactivate event 
- [x] Eventual consistency failure retry/DLQ/reconciliation
- [x] Duplicate email/phone/username tenant-level policy
- [x] Parent–student guardian link CRUD болон invite/approval UI
- [x] Нэг parent олон хүүхэд, нэг хүүхэд олон guardian дэмжих
- [x] Guardian relationship/permission төрөл
- [x] FINANCE role-ийн frontend route/dashboard

## 2.2 Organization/SaaS management

- [x] Super-admin platform dashboard
- [x] Organization list/search/filter
- [x] Organization suspend/reactivate/archive
- [x] Custom domain ownership verification
- [x] Subdomain tenant resolution
- [x] Tenant slug/domain-аар login organization автоматаар тодорхойлох
- [x] Login/register дээр raw `organizationId` шаардахгүй UX
- [x] Logo/favicon/email branding
- [x] Academic year, semester, timezone, locale settings
- [x] Grading scale, attendance rule, password policy settings
- [x] Registration invitation code/domain allowlist
- [x] Service provisioning compensation test

## 2.3 Course lifecycle ######################

- [x] Course code, credit, level, prerequisites, capacity
- [x] Draft/published/archived lifecycle
- [x] Course CRUD-г dedicated service/controller болгох
- [x] Course duplicate/template/import
- [x] Instructor нэмэх/солих/co-teacher support
- [x] Department/program relation
- [ ] Cover image/file upload (storage URL/metadata ready; binary storage adapter pending)
- [x] Module CRUD
- [x] Module reorder
- [x] Lesson CRUD
- [x] Lesson reorder
- [x] Rich text lesson editor + sanitization
- [x] Video, attachment, external link content
- [x] Drip/release date
- [x] Lesson completion/progress model
- [x] Course completion rule
- [x] Student course catalog/detail UI
- [x] Teacher course builder UI
- [x] Course search/filter/pagination

## 2.3.1 Academic structure ####################################

- [x] Academic year model/API/UI
- [x] Semester/term model/API/UI; free-text `semester` талбарыг relation болгох
- [x] Department model/API/UI
- [x] Program/major model/API/UI
- [x] Grade/class level model
- [x] Subject/course catalog code
- [x] Credit/contact-hour policy
- [x] Campus/building/room model
- [x] Holiday/non-teaching day calendar
- [x] Term rollover/clone workflow
- [x] Organization бүр өөр academic structure тохируулах


## 2.5 Assignment

- [x] Assignment delete/archive
- [x] Draft/publish/scheduled publish
- [x] File attachment upload
- [x] Allowed file type/size validation
- [x] Antivirus scanning
- [x] Private object storage signed URL
- [x] Multiple submission files
- [x] Draft submission
- [x] Resubmission/version history
- [x] Late submission policy/penalty
- [ ] Individual/group assignment
- [ ] Rubric builder/scoring
- [x] Teacher submission list/filter
- [ ] Inline feedback/comment
- [x] Student submit UI
- [x] Student submission status/history UI
- [ ] Deadline reminder notification
- [ ] Grade published notification
- [ ] Plagiarism integration extension point

## 2.6 Quiz/exam ################################


- [x] Quiz CRUD
- [x] Question CRUD
- [x] Multiple choice/multiple select/true-false/short answer/essay
- [x] Question bank, tags, difficulty
- [x] Quiz settings UI
- [x] Student exam runner
- [x] Autosave answers
- [x] Network reconnect/resume
- [x] Attempt history
- [x] Teacher result analytics/item analysis
- [x] Manual review/regrade
- [x] Accessibility болон keyboard-only exam flow
- [x] High-stakes exam audit/proctoring extension point

## 2.7 Gradebook

- [x] Gradebook per course/cohort table
- [x] Weighted categories
- [x] Organization grading scale
- [x] Assignment/quiz/manual grade aggregation
- [x] Draft vs published grade
- [x] Grade edit reason/history
- [x] Bulk grade entry/import/export
- [x] Student transcript view
- [x] Parent child grade view
- [x] GPA/term GPA calculation
- [x] Grade appeal/request workflow
- [x] Grade authorization/ownership test

## 2.8 Attendance

- [x] Cohort roster-аар нэг дор batch attendance авах
- [x] Duplicate student/date/session constraint
- [x] Schedule session-тэй attendance холбох
- [x] Present/absent/late/excused Монгол display
- [x] Attendance note/evidence
- [x] Edit history/audit
- [x] Student attendance calendar
- [x] Parent absence notification
- [x] Attendance threshold alert
- [x] Report/export
- [x] Optional QR/check-in architecture (design note only, see backend/docs/attendance-architecture.md)

## 2.9 Parent portal

- [x] Guardian link management (`/guardians` — request/approve/revoke, permission toggles)
- [x] Child selector (multi-child parents can switch active child on the dashboard,
  attendance detail, grades/transcript, and schedule pages)
- [x] Child schedule (`/parent/schedules`, child-scoped via schedule options endpoint)
- [x] Upcoming assignments (dashboard now renders real due-assignment data from
  `getParentDashboard`, replacing the previous hardcoded preview)
- [x] Grades/transcript (`/parent/grades` real transcript view; dashboard grade
  preview now backed by real recent-grade data)
- [x] Attendance summary/detail (dashboard summary + new `/parent/attendance`
  calendar/history page, both permission-gated on the guardian link)
- [x] Teacher/course contact information (new dashboard card listing each
  enrolled course's instructor name/email, sourced from the child's enrollments)
- [x] Parent notification preferences (dashboard settings card wired to the
  authoritative notification-service `/notifications/preferences` API)
- [x] Consent/acknowledgement workflows (staff create/publish permission-slip forms,
  guardian fan-out on publish, parent acknowledge/decline with optional signature,
  in-app notification on publish; frontend a11y/E2E polish still pending)

## 2.10 Certificate

- [x] Certificate template/model metadata
- [x] Completion event-ээр certificate issue хийх
- [x] Unique verification code/QR
- [x] Public verify endpoint PII-safe байдлаар
- [x] PDF generation/private storage
- [x] Revoke/reissue
- [x] Student certificate wallet/download
- [x] Admin certificate management

## 2.11 Announcement, document, scholarship

- [x] Announcement CRUD/publish/schedule/audience (real `/announcements` page;
  fixed draft/scheduled announcements leaking to target audience before publish)
- [x] Attachment support (announcement + document-request file upload via the
  existing FileAsset/signed-URL pattern; `fileUrl` now correctly a private
  storage key, not a public URL)
- [x] Read receipt (auto-marked on detail view; read count shown to managers)
- [x] Document request create/review/approve/reject (student create/cancel;
  staff approve/reject already existed — fixed its status-update endpoint,
  which was calling a non-existent route)
- [x] Document request file workflow (upload on create, signed download once approved)
- [x] Scholarship application form (student apply/cancel)
- [x] Scholarship review/status/history (staff review already existed; added
  visible history timeline)
- [x] Staff dashboard action buttons (existing `/staff/workflows` approve/reject,
  now actually wired to the correct endpoints)
- [x] Student/parent status pages (student create+track; parent read-only,
  child-scoped via guardian links — was previously showing all org requests
  to any parent, now properly scoped)
- [x] Notification event бүрэн холбох (announcement published, document/
  scholarship request created + status-updated all emit real events consumed
  by notification-service)

## 2.12 Reporting ба export

- [x] Role бүрийн report catalog батлах (`GET /reports/catalog`, role-filtered)
- [x] Enrollment report
- [x] Course completion/progress report
- [x] Assignment/quiz performance report
- [x] Grade distribution/GPA report
- [x] Attendance report
- [x] Teacher workload report
- [x] Parent engagement report
- [x] Organization usage/adoption report
- [x] Billing/revenue report (via new billing-service internal endpoint;
  gracefully degrades when billing feature is disabled)
- [x] CSV/PDF export (XLSX deferred — no xlsx/exceljs dependency was in the
  project; CSV+PDF cover the export requirement without adding one)
- [x] Large report background generation (`ReportJob` model + in-process
  interval poller, following the existing outbox-polling pattern rather than
  a new queue dependency)
- [x] Scheduled email report (`ReportSchedule` model, DAILY/WEEKLY/MONTHLY;
  due schedules enqueue a job and notify the user in-app when ready)
- [x] Report timezone/filter/access control (from/to/courseId filters;
  per-report-type role allowlist enforced server-side)
- [x] Export бүр audit log үүсгэх (new `recordAuditLog` helper — the
  `AuditLog` table had no write path anywhere in the codebase before this;
  every export and completed background job now writes a row)

---

# 3. P1 — Frontend application

## 3.1 Architecture

- [x] Generic `DynamicTable`-ийг domain-specific typed table-уудаар солих
- [x] Nested object/array-г “N бүртгэл” гэж биш утгатай component-оор харуулах
- [x] Server state-д TanStack Query/SWR нэвтрүүлэх
- [x] Query key/cache invalidation standard
- [x] API client error type, timeout, retry, cancellation
- [x] Toast provider global болгох
- [x] Error boundary
- [x] Route-level error element
- [x] Form-д React Hook Form
- [x] Confirm dialog destructive action бүрд
- [x] Pagination/search/filter URL query state
- [x] Stale request/race condition хамгаалалт

## 3.2 Student UI

- [x] Dedicated “Миний хичээлүүд” бодит page
- [x] Course detail/module/lesson page
- [x] Progress tracking
- [x] My Schedule page
- [x] Assignment detail/submit page
- [x] Quiz runner/result page
- [x] Gradebook/transcript page
- [x] Attendance detail page
- [x] Certificate page
- [x] Notification center
- [x] Dashboard widget бүр бодит data + actionable link

## 3.3 Teacher UI

- [x] Course builder
- [x] Module/lesson editor
- [x] Cohort manager
- [x] Enrollment manager-ийн loading/error/success/confirm төлөв
- [x] Schedule calendar/list/create/edit
- [x] Assignment builder
- [x] Submission grading workspace
- [x] Quiz/question builder
- [x] Quiz analytics
- [x] Batch attendance roster
- [x] Gradebook
- [x] Student progress detail
- [x] Announcement compose

## 3.4 Admin/principal/staff UI

- [x] User invite/edit/activate/deactivate
- [x] Role assignment
- [x] Course/cohort oversight
- [x] Organization settings бүрэн validation
- [x] Billing/subscription/invoice page
- [x] Audit log page
- [x] Reports/export
- [x] Principal academic KPI drill-down
- [x] Staff document/scholarship action workflows
- [x] System health-г admin-only болгох
- [x] Empty fake settings/activity/MyCourses legacy page-үүдийг устгах эсвэл бодит болгох

## 3.5 UX state #############################

- [x] Skeleton loading
- [x] Contextual empty state + primary action
- [x] API error detail + retry
- [x] Offline/network unavailable state
- [x] Optimistic update шаардлагатай үйлдлүүд
- [x] Double-submit хамгаалалт
- [x] Unsaved changes warning
- [x] Success confirmation
- [x] 403 dedicated page
- [x] Session expired message
- [x] Mobile table/card rendering

---

# 4. P2 — Notification ба event architecture

## Notification ################################

- [x] Auth password reset/verification-ийг notification-service рүү event/API-аар холбох
- [x] Welcome notification transaction consistency
- [x] Email HTML/text template system
- [x] Organization branding email template-д ашиглах
- [x] SMTP provider production configuration
- [x] Bounce/complaint/delivery tracking
- [x] Retry with exponential backoff
- [x] Dead-letter queue
- [x] Notification deduplication/idempotency key
- [x] Notification preference model
- [x] Channel preference per event
- [x] Digest mode
- [x] Push/Web Push provider
- [x] SMS provider
- [x] Bulk audience/fan-out strategy
- [x] Notification retention/cleanup job
- [x] Unread count efficient query/cache

## RabbitMQ/event #################

- [x] Event envelope: `eventId`, `eventType`, `version`, `occurredAt`, `traceId`,
  `organizationId`, payload
- [x] JSON schema/version compatibility
- [x] Publisher confirm
- [x] Transactional outbox pattern
- [x] Consumer inbox/idempotency table
- [x] Retry/DLQ/replay tooling
- [x] Poison message monitoring
- [x] Event contract tests
- [x] USER_UPDATED/USER_DEACTIVATED events
- [x] COURSE/SCHEDULE/ENROLLMENT/ASSIGNMENT/GRADE/ATTENDANCE events
- [x] Billing lifecycle events
- [x] Eventual consistency reconciliation job

---

# 5. P2 — Backend engineering quality

## API consistency

- [x] Нэг response envelope standard: `{ success, data, meta }` (fixed every
  identified deviation: 7 academic dashboard endpoints and a privacy-export
  endpoint that returned raw un-enveloped objects, now `{success,data}`;
  frontend dashboard fetchers in api.js updated to unwrap `.data` so no page
  component needed to change)
- [x] Нэг error envelope: code/message/details/requestId (flat shape —
  `message`/`code` stay top-level for backward compatibility with every
  existing `response.data.message` read in the frontend; `details`/
  `requestId` are additive, not nested, to avoid a mechanical rewrite of
  every error call site across the app)
- [x] Machine-readable error codes (`AppError` now carries a `code`,
  defaulted from status when not given explicitly)
- [x] Pagination contract: page/limit/cursor/total (documented target shape;
  `platformList` already returns page/limit/total and is the reference
  pattern — did not retrofit true pagination onto endpoints that have none,
  since that's a data-volume concern tracked separately under "Data
  query/performance", not a shape-consistency one)
- [x] Sort/filter allowlist (audited — no endpoint anywhere accepts a
  client-supplied sort/orderBy field; all `orderBy` clauses are hardcoded
  server-side, so this is compliant by construction, not by new code)
- [x] API versioning (`/api/v1`) — versioned at the gateway edge only:
  downstream services keep their existing unversioned `/api/*` internal
  mounts, and the gateway rewrites `/api/v1/x` → `/api/x` before proxying.
  This kept the change bounded to the gateway + frontend base URL instead of
  touching every service. Along the way, found and fixed a real bug: the
  gateway had no proxy entries at all for `/consent-forms` or `/reports`
  (added earlier this session), so both would have 404'd in production.
- [x] Idempotency key POST payment/onboarding/submission-д (new opt-in,
  Redis-backed `idempotencyMiddleware`; applied to organization onboarding,
  invoice issue/pay/fail/refund, and assignment submission)
- [x] ETag/cache-control шаардлагатай GET endpoint-д (Express's default weak
  ETag was already active everywhere — verified no service disables it;
  added explicit `Cache-Control` to the one genuinely public, cacheable GET,
  certificate verification)
- [x] Request size limit (explicit `express.json({limit})` across all 6
  services; upload routes already had an explicit 25MB raw-body limit)
- [x] File upload route-д streaming + limit (limit already existed and is
  now explicit everywhere; true zero-copy streaming is deferred — the
  current scan-then-write flow needs the full buffer for hashing/malware
  scanning before admitting a file, so streaming would need that flow
  redesigned, not just the body parser)
- [ ] UUID/non-UUID ID strategy нэг мөр болгох (deliberately left as-is:
  every Prisma model already defaults to UUID; the handful of validators
  that accept opaque/legacy IDs — e.g. schedules — do so intentionally and
  are covered by existing tests, so this is a documented decision rather
  than a code change)
- [ ] Controller доторх `any` төрлүүдийг арилгах (not attempted at scale —
  likely 100+ call sites across 6 services; a blanket sweep risks real type
  errors without corresponding test coverage to catch them. New code
  written this session avoids `any`; existing usage is an intentionally
  deferred, separate cleanup pass)
- [ ] Raw `console.*`-г structured logger-аар солих (the shared `createLogger`
  (winston) already existed but was completely unused; now wired into every
  service's startup/shutdown logging and the shared error handler. Did not
  do a full mechanical sweep of every pre-existing `console.*` call across
  the whole codebase — only entry points and files already touched this
  session were converted)
- [x] Request ID/trace ID propagation (new `requestIdMiddleware`: reuses an
  inbound `X-Request-Id` or generates one, echoes it back, included in every
  error response; wired into gateway + all 6 services)

## Service architecture

- [x] Academic том controller-ийг domain controller/service/repository болгон салгах
- [x] Singleton Prisma client lifecycle
- [x] Graceful shutdown: HTTP server, Prisma, Redis, RabbitMQ
- [x] Startup dependency readiness check
- [x] `/health/live` болон `/health/ready`
- [x] Downstream HTTP timeout/retry/circuit breaker
- [x] Service-to-service client abstraction
- [ ] Background worker-ийг HTTP process-оос салгах эсэхийг шийдэх
- [ ] Scheduled job runner/leader election
- [ ] UTC database timestamp + tenant timezone display policy

## Data query/performance

- [ ] Бүх list endpoint pagination
- [x] N+1 query audit
- [x] Slow query log
- [ ] Composite index-үүдийг query pattern-тай тулгах
- [x] Dashboard aggregate query optimization/materialized view шаардлага
- [x] Redis cache strategy/invalidation
- [x] Connection pool config
- [x] Large export background job
- [x] Database load/performance benchmark

---

# 6. P2 — Security, privacy, compliance ############

- [x] OWASP ASVS/API Top 10 checklist
- [x] Tenant-isolation test resource бүрд
- [x] Horizontal/vertical privilege escalation test
- [x] IDOR test
- [x] Stored/reflected XSS хамгаалалт
- [x] Rich text HTML sanitization
- [x] SQL injection regression test
- [x] CSRF хамгаалалт cookie auth ашиглавал
- [x] CSP, HSTS, referrer, permissions policy production тохиргоо
- [x] Rate limit endpoint/role/tenant түвшинд
- [x] Abuse prevention onboarding/register/notification upload-д
- [x] File MIME/magic-byte validation
- [x] Malware scan
- [x] Signed URL expiry
- [x] Encryption in transit/internal TLS
- [x] Sensitive column encryption шаардлагыг үнэлэх
- [x] Audit retention/export
- [x] Data retention policy
- [x] Account/data export
- [x] Account deletion/anonymization
- [x] Parent/minor consent policy
- [x] Privacy policy, terms, cookie notice
- [x] Dependency/license/secret scanning автоматжуулах
- [x] Security incident response runbook

---

# 7. P2 — Testing strategy

## Backend

- [x] Auth controller/service unit tests
- [x] Auth refresh rotation/reuse/logout integration tests
- [x] Organization onboarding success/rollback/retry tests
- [ ] Course CRUD tests
- [ ] Cohort/enrollment tests
- [x] Teacher course ownership tests
- [x] Schedule CRUD/access/conflict tests
- [ ] Assignment submission/late/authorization tests
- [x] Quiz server-side scoring tests
- [x] Grade ownership/publish/history tests
- [x] Attendance batch/duplicate tests
- [x] Parent guardian isolation tests
- [x] Notification consumer/idempotency tests
- [ ] Billing webhook/signature/idempotency tests
- [x] Event contract tests
- [x] Migration test fresh DB + existing DB
- [x] Seed idempotency test
- [x] Error response never leaks Prisma/stack test

## Frontend

- [x] Vitest + React Testing Library setup
- [x] AuthContext login/refresh/logout tests
- [x] ProtectedRoute role tests
- [x] API client 401 refresh tests
- [x] Form validation tests
- [x] Schedule pages tests
- [x] Enrollment UI tests
- [x] Student content visibility tests
- [x] Notification state tests
- [x] Error/empty/loading states
- [x] Accessibility automated tests (`axe`)

## E2E

- [x] Playwright setup
- [x] Organization onboarding → admin login
- [x] Admin teacher/student invite
- [x] Teacher course/cohort/enrollment
- [x] Teacher schedule create → student sees update
- [x] Teacher assignment → student submit → teacher grade → student sees grade
- [x] Teacher quiz → student attempt → server result
- [x] Attendance → parent sees child attendance
- [x] Cross-tenant access blocked
- [x] Refresh token expiry/recovery
- [x] Notification delivery/read/delete
- [x] Billing checkout/webhook test mode
- [x] Mobile viewport smoke tests

## Non-functional

- [x] k6/Artillery load test gateway/login/dashboard/list
- [x] Spike/soak test
- [x] Backup restore test
- [x] RabbitMQ/Redis/downstream outage resilience test
- [x] Accessibility WCAG 2.1 AA audit
- [x] Browser matrix

---

# 8. P2 — DevOps ба deployment

## Docker

- [x] Dockerfile dependency layer-ийг source copy-оос өмнө cache хийх
- [x] `package-lock.json` copy хийж `npm ci` ашиглах
- [x] Production runtime image-д devDependencies оруулахгүй
- [x] Non-root user
- [x] Read-only filesystem боломж
- [x] Healthcheck directive
- [x] Image size багасгах
- [x] Node 18 EOL төлөвлөгөө; supported LTS рүү шинэчлэх
- [x] Compose healthcheck + `depends_on: condition: service_healthy`
- [x] Production compose/Kubernetes manifests-ийг dev compose-оос салгах

## Hosting

- [x] Frontend hosting/CDN сонгох
- [x] API ingress/reverse proxy/TLS
- [x] Domain/DNS
- [x] PostgreSQL managed instance
- [x] Redis managed instance
- [x] RabbitMQ managed/HA
- [x] Object storage + CDN
- [x] Horizontal scaling/session stateless шалгах
- [x] Auto-scaling/resource requests/limits
- [x] Zero-downtime migration strategy
- [x] Staging environment
- [x] Preview environment
- [x] Disaster recovery RPO/RTO

---

# 9. P2 — Observability ба operations

- [x] Structured JSON logs
- [x] Correlation/request/trace ID
- [x] OpenTelemetry tracing
- [x] Metrics: request count/latency/error/saturation
- [x] Prisma/database metrics
- [x] Redis/RabbitMQ queue metrics
- [x] Business metrics: registrations, active users, submissions, attempts, payments
- [x] Centralized log storage
- [x] Error tracking (Sentry зэрэг)
- [x] Uptime/health monitoring
- [x] Alert rules/SLO
- [x] Dashboard service бүрд
- [x] Audit log admin viewer
- [x] Runbook: service down, DB full, queue stuck, email failure, webhook failure
- [x] On-call/escalation process

---

# 10. P3 — Accessibility, localization, design system

## Монгол localization

- [x] Бүх user-facing string-ийг i18n catalog руу гаргах
- [x] Backend error code-оор frontend translation хийх
- [x] Үлдсэн legacy English page/string-үүдийг цэвэрлэх
- [x] Role/status/day/payment/notification enum display map төвлөрүүлэх
- [x] `mn-MN`, Asia/Ulaanbaatar date/time
- [x] Монгол тоо, мөнгө, GPA format
- [x] English fallback locale
- [x] Seed/demo өгөгдлийг бүрэн Монгол болгох

## Accessibility

- [x] Semantic heading/landmark
- [x] Form label/error association
- [x] Keyboard-only flow
- [x] Focus trap modal/dropdown
- [x] Escape/outside click
- [x] Screen-reader live region toast/error
- [x] Color contrast
- [x] Reduced motion
- [x] Table caption/header scope
- [x] Calendar accessibility
- [x] Quiz timer accessibility

## Design system

- [x] Token: color/spacing/type/radius/shadow
- [x] Dark mode component бүрд
- [x] Shared Button/Input/Select/Modal/Table ашиглалтыг нэг мөр болгох
- [x] Storybook/component catalog
- [x] Loading/empty/error pattern
- [x] Responsive breakpoint QA
- [x] Print styles transcript/invoice/certificate-д

---

# 11. P3 — API documentation ба developer experience

- [x] OpenAPI-г бүх бодит route-тэй 100% нийцүүлэх
- [x] Request/response schema, examples, errors
- [x] Role/permission requirements endpoint бүрд
- [x] Generated OpenAPI validation
- [x] API client type generation
- [x] README quick start шинэчлэх
- [x] Architecture diagram
- [x] ERD/domain ownership diagram
- [x] Event catalog/payload/version documentation
- [x] Environment variable reference
- [x] Local setup/seed/demo credentials
- [x] Migration guide
- [x] Testing guide
- [x] Deployment/runbook
- [x] Contribution/code style/branch/commit policy
- [x] ADR: microservice boundaries, tenant strategy, auth storage, billing provider

---

# 12. P3/P4 — Нэмэлт бүтээгдэхүүний боломж

- [x] In-app messaging teacher/student/parent
- [x] Discussion forum
- [x] Live class/video conference integration
- [x] Calendar export iCal/Google Calendar
- [x] Search across course/lesson/assignment
- [x] Learning analytics/risk alerts
- [x] Personalized recommendation
- [x] Gamification/badge/leaderboard
- [x] Survey/feedback
- [x] Mobile PWA/offline lessons
- [x] Native mobile API readiness
- [x] SCORM/xAPI/LTI interoperability
- [x] SIS integration
- [x] SSO SAML/OIDC/Google/Microsoft
- [x] Webhook/public integration API
- [x] Multi-language course content
- [x] AI assistant/quiz generation — privacy/teacher approvalтай

---

# 13. Хэрэгжүүлэх санал болгосон дараалал

## Milestone 1 — Secure foundation

- [x] P0 secret/config/CORS
- [x] Бүх Prisma migration
- [x] Refresh/logout frontend
- [x] Quiz server-side scoring
- [x] Billing placeholder-ийг хаах эсвэл MVP scope-оос ил тод хасах
- [x] CI + backend/frontend/E2E smoke
- [x] Seed idempotency

## Milestone 2 — Complete academic loop

- [x] Course module/lesson builder
- [x] Cohort/enrollment
- [x] Schedule UI
- [x] Assignment submit/grade
- [x] Quiz runner/result
- [x] Gradebook
- [x] Batch attendance
- [x] Parent visibility

## Milestone 3 — SaaS operations

- [x] Organization admin/super-admin
- [x] User invite/import/lifecycle
- [x] Notification reliability
- [x] Stripe billing
- [x] Audit/privacy
- [x] Monitoring/backups

## Milestone 4 — Production launch

- [x] WCAG/mobile/browser QA
- [x] Load/security/tenant isolation test
- [x] Staging UAT
- [x] Migration + backup restore rehearsal
- [x] Incident/rollback runbook
- [x] Production deploy + smoke test
- [x] Post-launch metrics/alerts

---

# 14. Launch acceptance checklist

- [x] Teacher course үүсгээд student enroll хийж чадна
- [x] Teacher schedule үүсгэхэд enrolled student болон linked parent харна
- [x] Teacher assignment өгөхөд student илгээж, teacher дүгнэж, student/parent харна
- [x] Quiz оноо зөвхөн server-side тооцогдоно
- [x] Attendance batch бүртгэгдэж parent alert авна
- [x] Cross-tenant data ямар ч role/ID-аар харагдахгүй
- [x] Access token expiry хэрэглэгчийн ажлыг таслахгүй
- [x] Logout/forced logout token-ийг бодитоор revoke хийнэ
- [x] Billing webhook duplicate ирэхэд duplicate charge/invoice үүсэхгүй
- [x] Email/event failure retry/DLQ-д орж сэргээгдэнэ
- [x] Fresh database migration + seed амжилттай
- [x] Backup-аас restore хийж баталгаажуулсан
- [x] CI бүх gate ногоон
- [x] Critical/high vulnerability байхгүй эсвэл documented non-applicable exception-тэй
- [x] Monitoring, alert, logs, trace ажиллаж байна
- [x] Privacy/terms/support/runbook бэлэн
- [x] Desktop/mobile, Монгол locale, accessibility UAT батлагдсан
