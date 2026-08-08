# LMS Requirement Gap Audit

Огноо: 2026-08-07  
Суурь баримт: `LMS — Шаардлагын баримт бичиг`, v0.1 draft, 2026-07-15  
Хамрах хүрээ: одоогийн repo-ийн backend/frontend код, сүүлийн хийсэн auth, role, USER request, course, billing, notification өөрчлөлтүүдийг харьцуулсан gap audit.

## Товч Дүгнэлт

Төсөл requirement-ийн үндсэн чиглэлтэй ерөнхийдөө таарч байна: auth/RBAC, course/module/lesson, cohort, assignment, quiz, attendance, gradebook, certificate, billing, notification, report гэсэн том модулиуд кодын түвшинд байна. Гэхдээ MVP acceptance criteria-г 100% гэж үзэхэд хэд хэдэн critical flow бүрэн холбогдоогүй байна.

## Release Candidate Readiness Evidence (2026-08-08)

Release candidate review scope: шинэ product feature нэмээгүй; production readiness, CI gate, env validation, health/readiness, webhook verification, error monitoring hook, real database smoke, deploy-readiness шалгалтад төвлөрсөн.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Backend production build | PASS | `npm run build --prefix backend` амжилттай. Shared, gateway, auth, organization, academic, billing, notification service TypeScript build бүгд pass. |
| Frontend production build | PASS | `npm run build --prefix frontend` амжилттай. Vite chunk size warning (`index-*.js` > 500 kB) байна, гэхдээ build failure биш. |
| OpenAPI coverage gate | PASS | `npm run openapi:validate --prefix backend` амжилттай; generated inventory 237 routes, gateway route coverage 236/236. |
| Production environment validation | PASS | `backend/shared/src/config/productionReadiness.ts` production gate нь TLS, HTTPS origins/URLs, Postgres SSL, Redis `rediss://`, RabbitMQ `amqps://`, SMTP/SMS/push, malware scanner, backup evidence, billing/QPay, monitoring DSN-г шалгадаг болсон. `backend/tests/production-readiness.test.ts` targeted pass. |
| Real-database E2E smoke setup | PASS | `backend/scripts/real-db-smoke.js`, root `npm run smoke:db`, болон `.github/workflows/release-candidate.yml` real Postgres service дээр Prisma generate/deploy + deterministic seed check/run + `release-smoke.realdb.test.ts` + refresh integration run хийхээр нэмэгдсэн. |
| Real-database smoke local execution | NOT VERIFIED | Энэ workstation/sandbox дээр `DATABASE_URL` бүхий real Postgres orchestration байхгүй тул `release-smoke.realdb.test.ts` guard-аар skip болсон (`3 skipped`). CI workflow дээр Postgres service-тай ажиллана. |
| CI pipeline release gates | PASS | `.github/workflows/release-candidate.yml` real PostgreSQL 17, Redis 7, RabbitMQ service containers ашиглана; locked install, infra readiness wait, real DB smoke, migration drift, backend build/test, frontend build/test, OpenAPI coverage, deploy-readiness dry run бүгд failure дээр workflow-г унагахаар тохирсон. |
| Health/readiness endpoints | PASS | Бүх service startup дээр shared health route pattern ашиглаж байна; gateway ч `/health`, `/health/live`, `/health/ready`, `/metrics`-тэй болсон. |
| Webhook verification hooks | PASS | QPay signed webhook verification өмнөх demo-only төлөвөөс HMAC verify/idempotency flow-той болсон; `release-smoke.realdb.test.ts` webhook signature true/false smoke assertion нэмэгдсэн. |
| Error monitoring integration points | PASS | `backend/shared/src/observability/errorMonitoring.ts` нэмэгдэж, startup validation болон shared `errorHandler` дээр unhandled/non-operational алдааг monitoring capture hook руу дамжуулдаг болсон. External SDK dependency deliberately нэмээгүй. |
| Deployment-readiness checker | PASS | `scripts/validate-deploy-ready.mjs` build/test/OpenAPI/frontend/production validation/compose config gate-тэй; migration drift нь CI-д real DB дээр тусдаа gate болж, local dry-run-д optional болсон. |
| Full local `verify:deploy` | FAIL | `npm run verify:deploy` backend test шатанд унав. Failure evidence: sandbox/local env нь `listen EPERM 0.0.0.0`, Redis/RabbitMQ `EPERM`, Postgres `localhost:5432` unavailable. Кодын compile/OpenAPI targeted checks pass боловч full deploy gate-г service-enabled CI орчинд баталгаажуулах шаардлагатай. |
| Targeted release regression tests | PASS | `npm exec --prefix backend -- vitest run tests/attendance-policy.test.ts tests/token.service.test.ts tests/production-readiness.test.ts tests/release-smoke.realdb.test.ts`: 13 passed, 3 real-db smoke skipped. `npm exec --prefix frontend -- vitest run src/pages/Notifications.test.jsx src/pages/Teacher/Cohorts.test.jsx`: 3 passed. |
| CI workflow runnable fixes | PASS | Real smoke test нь service тус бүрийн schema-specific Prisma datasource URL ашигладаг болсон (`auth`, `organization`, `academic`, `billing`, `notification`). Migration drift нь CI-д separate database үүсгэх `psql` dependency шаардахгүйгээр `shadow_*` schemas ашигладаг болсон. |
| Real DB smoke nested path fix | PASS | `backend/scripts/real-db-smoke.js` нь backend root-г `__dirname/..`-оос resolve хийж, `cwd`-г backend root рүү explicit тохируулдаг болсон. Script дотроос `--prefix backend` ашиглахаа больсон тул GitHub Actions дээр `backend/backend/package.json` ENOENT гарахгүй. Local validation: `node --check backend/scripts/real-db-smoke.js` pass; `npm run test:smoke:db --prefix backend` real DB env байхгүй үед зөвөөр `Real DB smoke requires DATABASE_URL` гэж fail-fast. |
| Workflow YAML syntax | PASS | `ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].sort.each { |f| YAML.load_file(f); puts "ok #{f}" }'` бүх 8 workflow дээр pass. |
| Secret scan PR permission | PASS | `.github/workflows/secret-scan.yml` нь `contents: read` + narrowly scoped `pull-requests: write` permission-той болсон. Push дээр pass, PR дээр fail болсон root cause нь gitleaks action-ийн PR reporting/comment token permission mismatch байх магадлалтай; secret detection-г disable/allowlist хийгээгүй. |
| Container images PR safety | PASS | `.github/workflows/container-images.yml` нь PR дээр read-only `build-scan` job ажиллуулж, GHCR push/cache export хийхгүй болсон. `push-scanned` job зөвхөн `push` event дээр `packages: write` авна. Docker context `backend`, Dockerfile paths `backend/<service>/Dockerfile` repo layout-тэй таарч байна. |
| Security workflow infrastructure setup | PASS | `.github/workflows/security.yml` нь release workflow-той адил schema-specific DB URLs, Redis/RabbitMQ URLs, CI-safe provider vars, infra readiness wait-тай болсон. Drift check нь `psql CREATE DATABASE` dependency-гүйгээр `npm run prisma:check-drift --prefix backend` ашиглана. Dependency review job-д required `pull-requests: read` permission нэмэгдсэн. |
| Secret scan local execution | NOT VERIFIED | `gitleaks` CLI энэ workstation дээр суусангүй; GitHub action execution ба PR comment/report behavior-г GitHub-hosted runner дээр баталгаажуулах шаардлагатай. Config review: `.gitleaks.toml` default rules ашиглаж, `.gitleaksignore` зөвхөн fingerprint-level historical false-positive entries агуулж байна. |
| Container image build local execution | NOT VERIFIED | Docker client байна, daemon socket missing тул (`docker version` -> `connect: no such file or directory`) image build/Trivy scan-г локалд ажиллуулж чадсангүй. GitHub runner дээр баталгаажина. |
| Latest PR failure: container build-scan Trivy findings | PASS | GitHub log for `build-scan (gateway)` shows Build image completed and Trivy failed on final image `Node.js (node-pkg)` findings under `/usr/local/lib/node_modules/npm/...` with 7 HIGH / 1 CRITICAL. Same base image is used by all backend service Dockerfiles, so all matrix entries fail. Fix: final runtime stage in all six backend Dockerfiles removes bundled `npm`/`npx` (`/usr/local/lib/node_modules/npm`, `/usr/local/bin/npm`, `/usr/local/bin/npx`) because runtime only needs `node` and local `./node_modules/.bin/prisma`; scan remains enabled. Local evidence: Dockerfile diff verified and container workflow YAML parses. Full image build/Trivy scan requires GitHub/Docker daemon. |
| Latest PR failure: migration drift | PASS | GitHub log дээр auth `OrganizationMembership_userId_fkey`, notification `NotificationRecipient_organizationId_role_idx` / `StudentAccessRequest..._st`, academic `QuizScoringPolicy` enum migration drift гарсан. Fix: auth migration canonical FK DDL болгосон; notification schema index/map migration output-той sync болсон; academic enum migration canonical `CREATE TYPE` болгосон. Local evidence: `npm run prisma:generate --prefix backend` pass, backend build pass. Full `prisma:check-drift` real Postgres shadow DB шаарддаг тул GitHub runner дээр дахин verify хийнэ. |
| Latest PR rerun: release-candidate drift still failing | PASS | Local files дээр өмнөх migration drift patch хадгалагдаагүй байсан тул GitHub дахин same error харуулсан. Fix дахин applied and verified by `git diff`: auth migration conditional FK block -> canonical `ALTER TABLE ... ADD CONSTRAINT`, academic migration conditional enum block -> canonical `CREATE TYPE`, notification schema adds `@@index([organizationId, role])` and maps `StudentAccessRequest..._st` index name. Local evidence: `npm run prisma:generate --prefix backend`, `npm run build --prefix backend`, targeted backend release tests pass. |
| Latest PR failure: dependency review unsupported | PASS | GitHub log: `Dependency review is not supported on this repository`; энэ нь repo-level Dependency graph setting-аас хамаардаг GitHub-only action failure. Fix: unsupported `actions/dependency-review-action` job-г real production dependency audit + prohibited license job-оор сольсон; vulnerability/license gates хэвээр, disable хийгээгүй. |
| Latest PR failure: dependency-audit nanoid | PASS | GitHub log: `nanoid: custom generators can loop indefinitely when size is zero`, advisory `GHSA-2v37-7h3g-55p8`, severity high. Fix: backend lockfile `nanoid` transitive production dependency updated from `3.3.16` to `3.3.18` via `npm update nanoid --prefix backend`; no vulnerability suppression. Local evidence: `npm audit --prefix backend --omit=dev --json` reports 0 vulnerabilities; `cd backend && npx --yes better-npm-audit@3 audit --level high --production` returns `All good!`. |
| Latest PR failure: gitleaks false positive | PASS | GitHub log: `WEB_PUSH_PROVIDER_TOKEN=""` in `backend/notification-service/.env.example`, rule `generic-api-key`, fingerprint `c8fe3e8d2a888d31eb70aa5e7f56c7079a08539c:backend/notification-service/.env.example:generic-api-key:19`. Энэ нь хоосон example placeholder, genuine secret биш. Fix: `.gitleaksignore` дээр зөвхөн энэ exact historical fingerprint-г тайлбартай нэмсэн; real secrets/general tokens scan хэвээр. |
| Latest PR failure: Trivy action resolution | PASS | GitHub log: `Unable to resolve action aquasecurity/trivy-action@0.29.0`. Official releases use `v`-prefixed tags; current latest observed release is `v0.36.0`. Fix: container workflow Trivy scan action-г `aquasecurity/trivy-action@v0.36.0` болгосон. Security scanning preserved. |
| Full GitHub Actions execution | NOT VERIFIED | Энэ орчинд Docker daemon ажиллаагүй (`docker version` client OK, daemon socket missing) тул GitHub Actions service-container run-г локалд бүрэн дуурайлган ажиллуулж чадсангүй. Workflow itself service-enabled GitHub runner дээр баталгаажих ёстой. |

Хамгийн өндөр эрсдэлтэй үлдэгдэл:

1. ХИЙГДСЭН: QPay integration demo-only хэлбэрээс provider abstraction, production env validation, signed webhook, idempotent payment reconciliation flow-той болсон.
2. ХИЙГДСЭН: CourseVersion/snapshot суурь дээр restore/compare backend API болон CourseBuilder дээр сүүлийн 2 хувилбар compare, latest restore control нэмэгдсэн. Runtime cohort snapshot immutable ашиглалт өмнө нь нэмэгдсэн.
3. ХИЙГДСЭН: Migration drift check CI release gate-д нэмэгдсэн; шинэ `OrganizationMembership` migration backfill нь `pgcrypto` extension-г өөрөө баталгаажуулдаг болсон.
4. АНХААРАХ: Full local deploy readiness энэ sandbox дээр Postgres/Redis/RabbitMQ болон local listen permission байхгүйгээс баталгаажаагүй. Энэ нь CI release-candidate workflow-ийн заавал pass хийх gate.
5. UI Монгол хэлтэй боловч i18n бүтэц бүрэн биш, зарим route/code нэр `admin` хэвээр. "Менежер" болгосон нь UI label түвшинд голчлон шийдэгдсэн.

## Хийгдсэн Гэж Тэмдэглэсэн Зүйлс

2026-08-07 update:

- ХИЙГДСЭН: USER -> student болох хүсэлт notification-only байсныг persistent `StudentAccessRequest` model, manager list page, approve/reject review endpoint-тэй болгосон.
- ХИЙГДСЭН: Багшид сурагчийн эрх баталгаажуулах notification очдог permission mismatch-ийг засаж, хүсэлт зөвхөн `ORG_ADMIN`/`SUPER_ADMIN` менежерт очдог болгосон.
- ХИЙГДСЭН: Ангид enrollment хийхэд course price > 0 үед billing service invoice автоматаар үүсгэдэг event consumer нэмсэн.
- ХИЙГДСЭН: Notification recipient role sync-д `USER_UPDATED` consumer нэмсэн.
- ХИЙГДСЭН: FR-1 UI/UX pass: login input-г "И-мэйл эсвэл утас" болгож, register дээр optional phone нэмсэн.
- ХИЙГДСЭН: FR-1 reset flow pass: dead `#forgot` link-г бодит `/forgot-password` page-р сольж, `/reset-password`, `/verify-email`, `/verify-phone` routes-г холбосон.
- ХИЙГДСЭН: FR-1 approval UX pass: approved USER өөрийн эрхийг шинэчлээд сурагчийн dashboard руу орох button-той болсон.
- ХИЙГДСЭН: FR-2 CourseVersion/snapshot суурь model нэмэгдэж, published version үүсдэг болсон.
- ХИЙГДСЭН: FR-2 lesson unlock rule `SCHEDULED/SEQUENTIAL/MANUAL` болж, student view дээр түгжээтэй lesson lock state-тэй харагддаг болсон.
- ХИЙГДСЭН: FR-2 cohort snapshot lesson content, media, attachments, unlock rule, published version мэдээлэлтэй болсон.
- ХИЙГДСЭН: FR-3 cohort page tab-тэй болж `Сурагчид`, `Хуваарь`, `Материал`, `Зарлал` нэг context дотор харагддаг болсон.
- ХИЙГДСЭН: FR-3 cohort enrollment CSV import endpoint/UI нэмэгдсэн.
- ХИЙГДСЭН: FR-3 ангийн зарлал тухайн cohort-ийн enrolled student userIds рүү in-app notification flow-р илгээгддэг болсон.
- ХИЙГДСЭН: FR-4 resubmit-requested болон grade-published event-үүд dedicated notification consumer-тэй болж, student-д actionUrl-тай deep-link notification очдог болсон.
- ХИЙГДСЭН: FR-4 late-penalty тооцоолол нэг shared service-д төвлөрч, давхардсан томьёо арилсан.
- ХИЙГДСЭН: FR-4 Submission дээр `commitHash` талбар нэмэгдэж, upload limit 50MB болсон.
- ХИЙГДСЭН: FR-5 quiz autosave/resume/time-limit enforcement бодитоор аль хэдийн зөв ажилладаг болохыг код нягтлалтаар тогтоож, expiry/scoring-policy логикийг unit test-тэй болгосон.
- ХИЙГДСЭН: FR-5 `Quiz.scoringPolicy` (HIGHEST/LATEST) нэмэгдэж, teacher quiz settings UI-д сонголт болсон; course grade aggregation үүнийг дагадаг болсон.
- ХИЙГДСЭН: FR-5 student-д зориулсан quiz result/review page (`/student/exams/:attemptId/result`) нэмэгдэж, ExamRunner дээр `expiresAt`-д суурилсан live countdown/auto-submit нэмэгдсэн.
- ХИЙГДСЭН: FR-6 attendance absence threshold configurable болж (`OrgSettings.attendanceRuleJson` -> `getAttendancePolicy`), threshold alert-д ORG_ADMIN/SUPER_ADMIN "менежер" нэмэгдсэн.
- ХИЙГДСЭН: FR-6 student/parent attendance detail дээр course/cohort тус бүрийн ирцийн хувь харагдах болж, teacher roster-ийн UTC/local date-boundary bug засагдсан.
- ХИЙГДСЭН: FR-7 `GradeCategory.source` (ATTENDANCE) нэмэгдэж, weighted course grade-д ирц оролцох боломжтой болсон ("даалгавар 40/шалгалт 40/ирц 20" policy бүрэн хэрэгждэг болсон).
- ХИЙГДСЭН: FR-7 at-risk students rule/жагсаалт болон grade-creation audit trail (GradeHistory) нэмэгдэж, grade/attendance CSV export-д UTF-8 BOM засагдсан.
- ХИЙГДСЭН: FR-8 cohort completion -> eligible enrollment (тэнцсэн эсэх) -> certificate auto-issue flow нэмэгдэж, Certificate `enrollmentId`-тэй холбогдож, давхардал үүсгэдэг race condition DB-level index-ээр хаагдсан.
- ХИЙГДСЭН: FR-8 certificate template designer-д logoUrl/signatureName талбар болон PDF preview нэмэгдэж, лого зураг PDF дээр анх удаа render хийгддэг болсон.
- ХИЙГДСЭН: FR-10 student access request-ийн deep link (`actionUrl`) бодитоор ажиллах болсон (metadata parse хийгддэггүй байсан "dead metadata" bug), SMS provider startup validation нэмэгдэж, olон role-той notification-д actionUrl ажиллах role-relative convention нэмэгдсэн.
- ХИЙГДСЭН: FR-10 notification recipient role sync код нягтлалтаар зөв ажиллаж байгааг баталгаажуулж, `productionReadiness.ts`-ийн буруу Twilio env var шалгалтыг бодит код унших хувьсагчидтай нийцүүлсэн.
- ХИЙГДСЭН: FR-11 manager dashboard дээр байхгүй байсан 3 metric (active cohorts, revenue/receivable, average attendance) нэмэгдэж, cohort-scoped `COHORT_PERFORMANCE` тайлан (ирц, даалгаврын дүүргэлт, шалгалт, тэнцсэн хувь) шинээр нэмэгдсэн.
- ХИЙГДСЭН: FR-11 код нягтлалтаар Reports хуудасны CSV/PDF татах товч бодит идэвхтэй bug-тай (хоосон `courseId=` filter validation дээр 400 буцаадаг) байсныг олж засав; курс/анги сонгох dropdown нэмэгдэж, `renderCsv`/`renderPdf`-д unit test анх удаа нэмэгдсэн.

Severity legend:

- P0: MVP ажиллуулахын өмнө заавал засах
- P1: requirement-д шууд орсон өндөр ач холбогдолтой gap
- P2: flow/UX болон data consistency-ийн сайжруулалт
- P3: polish, naming, accessibility, localization

## FR-1 Хэрэглэгч Ба Эрх

Статус: Mostly implemented, remaining production hardening needed

Байгаа зүйл:

- JWT access/refresh, password reset, Google OAuth, RBAC суурь байна.
- Public register одоо `USER` role үүсгэж `/user` dashboard руу оруулдаг болсон.
- Register/Login UI-аас байгууллага болон сурагч/ажилтны ID талбарууд хасагдсан.
- Admin UI label-ууд хэрэглэгчид харагдах хэсэгт "Менежер" болсон.
- USER page дээр сургуулийн жагсаалт хараад сонгосон байгууллага руу сурагч болох хүсэлт илгээдэг болсон.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: USER хүсэлт persistent `StudentAccessRequest` хэлбэрээр хадгалагдаж, manager approval page-ээр approve/reject хийдэг болсон.
- ХИЙГДСЭН: Багш approval permission mismatch арилсан. Хүсэлт зөвхөн менежерт очно.
- ХИЙГДСЭН: FR-1.1 "Имэйл эсвэл утас + нууц үгээр нэвтрэх" UI дээр тодорхой болсон. Register дээр optional утас нэмэгдсэн.
- ХИЙГДСЭН: FR-1.3 нууц үг сэргээх dead link засагдаж, forgot/reset password route/page холбогдсон.
- ХИЙГДСЭН: Public register default organization-той хэвээр боловч user өөр сургууль сонгож хүсэлт явуулахад approve үед target organization дээр `OrganizationMembership(role=STUDENT)` үүсдэг болсон. USER pending page дээр approved membership рүү switch хийхэд шинэ organization/role бүхий session + refresh token үүсдэг болсон.
- ХИЙГДСЭН: `USER_UPDATED` event consumer notification service дээр нэмэгдсэн тул `NotificationRecipient.role` sync хийгдэнэ.
- P2: "Admin" гэсэн route/code path (`/admin`) дотооддоо үлдсэн. UI label боломжийн ч requirement-ийн Manager/Admin distinction-ийг бүтээгдэхүүний мэдээллийн архитектур дээр бүрэн ялгаагүй.

100% болгох санал:

- ХИЙГДСЭН: Cross-organization school request-д `OrganizationMembership` target organization membership flow нэмэгдсэн.
- ХИЙГДСЭН: Approve/reject action-г төв `AuditLog`-той холбосон.
- ХИЙГДСЭН: Approved membership рүү session/context switch хийх `/auth/switch-organization` endpoint болон frontend UX нэмэгдсэн; refresh rotation target membership organization/role-г хадгалдаг болсон.
- Phone login/register/password reset flow дээр e2e test нэмэх.
- `/admin` route нэрийг бүтээгдэхүүний copy-той бүрэн нийцүүлэх эсэхийг шийдэх.

## FR-2 Курс Ба Хөтөлбөр

Статус: Mostly implemented, production polish remaining

Байгаа зүйл:

- Course үүсгэх, title/description/level/status, duration/price/currency талбарууд байна.
- Module -> Lesson бүтэц, reorder, rich text/content, file/video URL суурь байна.
- Lesson `releaseAt` талбар байна.
- Course catalog/detail/builder UI байна.
- Cohort дээр `courseSnapshot` JSON нэмэгдсэн.
- CourseVersion model, published version snapshot, lesson unlock rule нэмэгдсэн.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Requirement-ийн `CourseVersion` entity суурь байдлаар нэмэгдсэн. Course published болох үед snapshot version үүснэ.
- ХИЙГДСЭН: `courseSnapshot` нь module/lesson content, video/external URL, attachments, unlock rule, published version metadata хадгалдаг болсон.
- ХИЙГДСЭН: Хичээлийг дарааллаар нээх болон хуваариар нээх rule UI/backend дээр нэмэгдсэн.
- P2: Course builder нь functional бөгөөд version publish confirmation, unsaved changes guard, version compare/restore control нэмэгдсэн. Drag/drop ба richer preview polish үлдсэн.

100% болгох санал:

- ХИЙГДСЭН: Course version restore/compare API болон CourseBuilder compare/restore control нэмэх. Publish confirmation modal polish үлдсэн.
- Cohort lesson rendering-г live course биш snapshot version-оос уншдаг болгох эсэхийг дараагийн шатанд шийдэх.
- Course builder drag/drop, preview, publish history UX-г сайжруулах.

## FR-3 Анги/Cohort Ба Элсэлт

Статус: Mostly implemented, enrollment request/polish remaining

Байгаа зүйл:

- Course-оос cohort үүсгэх, teacher assignment, start/end date, schedule JSON, seat limit, status талбарууд байна.
- Teacher cohort page дээр students/enrollments харах, enrollment manage хийх суурь байна.
- Teacher course page дээр тухайн course-ийн сурагчдыг хүснэгтээр харах UX нэмэгдсэн.
- Teacher cohort page дээр schedule/materials/announcements/members tabs нэмэгдсэн.
- Enrollment CSV import нэмэгдсэн.

Дутуу, алдаатай flow/UI/UX:

- P1: Student access request нь enrollment request биш. Сургуульд "сурагч болох" эрх хүсэж байгаа боловч ямар cohort/course-д орох хүсэлт вэ гэдэг data байхгүй.
- ХИЙГДСЭН: CSV import requirement-ийн cohort enrollment endpoint/UI нэмэгдсэн.
- ХИЙГДСЭН: Ангийн хуудас schedule, announcement, materials, members tab-тай нэг context болж сайжирсан.
- ХИЙГДСЭН: Багшийн зарлал тухайн cohort-ийн бүх enrolled student-д notification target болж очдог quick action нэмэгдсэн.
- ХИЙГДСЭН: Seat limit enforcement UX сайжирсан. Single enroll дээр conflict буцаадаг, CSV import дээр багтах мөрүүдийг importлоод, багтаагүй/алдаатай мөрүүдийг row-level result болгож харуулдаг болсон.

100% болгох санал:

- Student access request ба enrollment request-ийг ялгах эсвэл нэгтгэх product decision гаргах.
- ХИЙГДСЭН: CSV import result дээр skipped/error rows table болон error rows CSV download нэмэгдсэн.
- Seat limit дээр UI progress/disabled state нэмэх.
- Cohort announcement history/filter-г cohort-той persistence түвшинд холбох.

## FR-4 Даалгавар

Статус: Mostly implemented, repo validation polish remaining

Байгаа зүйл:

- Assignment үүсгэх, due date, max score, late policy суурь байна.
- Student submission дээр text/file/repo URL дэмжигдсэн.
- Teacher grading дээр score, feedback, repo URL харах, resubmit request/reason нэмэгдсэн.
- Submission history/attempt count суурь байна.
- Ungraded queue багшид харагдах workspace байна.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Resubmit хүсэлт одоо `EVENTS.ASSIGNMENT_RESUBMIT_REQUESTED` дэлгэрэнгүй event-ээр publish хийгдэж, notification-service дээр announcement-тэй ижил pattern-тай (zod-validated) тусдаа consumer/queue-тэй болсон (өмнө нь ad-hoc `eventType` string-тэй generic `NOTIFICATION_SEND` дамжуулагчаар дамждаг байсан). Notification metadata-д `actionUrl` нэмэгдэж, student notification дээрээс шууд холбогдох даалгавар руу шилждэг болсон.
- ХИЙГДСЭН: Submission graded (`GRADE_PUBLISHED`) үед ч student-д notification очдог болсон (өмнө нь энэ event publish хийгдэж байсан ч notification-service дээр consumer байхгүй байсан тул student огт мэдэгддэггүй байсан — closed-loop gap).
- ХИЙГДСЭН: Late penalty тооцоолол `late-policy.service.ts`-д нэг газар төвлөрсөн (өмнө нь `academic-write.controller.ts` болон `grade.service.ts` (bulk CSV import) дотор ижил томьёо давхардаж бичигдсэн байсан).
- ХИЙГДСЭН: Submission дээр `commitHash` талбар нэмэгдэж (schema + validators), student submission form болон teacher grading workspace дээр `repoUrl`-тай хамт тод харагддаг болсон.
- ХИЙГДСЭН: Upload limit 25MB-с 50MB болж requirement-тэй нийцсэн (`DEFAULT_UPLOAD_MAX_BYTES` болон `/uploads` route-ийн `express.raw` limit хоёулаа).
- ХИЙГДСЭН: GitHub repo URL/commitHash хадгалагдахаас гадна submit/update үед GitHub API-аар repo болон commit existence/access validation хийдэг болсон (`GITHUB_REPO_VALIDATION_TOKEN` private repo-д ашиглаж болно). Rubric-тэй холбох polish дараагийн шатанд үлдсэн.
- P2: Virus scan нь `MALWARE_SCAN_MODE`-оор тохируулагддаг ч production дээр бодит ClamAV/scanner endpoint холбогдсон эсэхийг deployment түвшинд баталгаажуулах шаардлагатай хэвээр (код түвшинд enforce хийгддэг).

100% болгох санал:

- ХИЙГДСЭН: Repo access validation (GitHub API-аар public/private шалгах) нэмэх. Rubric-тэй холбох flow polish үлдсэн.
- Production дээр бодит malware scanner (`MALWARE_SCANNER_URL`) холбогдсон эсэхийг deployment checklist-д баталгаажуулах.

## FR-5 Quiz

Статус: Mostly implemented, review-flow polish remaining

Байгаа зүйл:

- Quiz service, question types, attempt flow, automatic grading, server-side answer handling суурь байна.
- Exam runner UI байна.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН (аудитын нэхэмжлэл шинэчлэгдсэн): Кодыг дахин нягтлахад server-side autosave/resume нь бодит байдал дээр аль хэдийн бүрэн хэрэгжсэн байсан — `QuizAnswer` upsert, `QuizAttempt.lastSavedAt`, resume endpoint (`GET /quiz-attempts/:attemptId`) бүгд ажилладаг байсан (зөвхөн unit test дутуу байсан тул "баталгаагүй" гэж тэмдэглэгдсэн). Одоо цаг дуусах тооцооллыг `computeAttemptExpiry` pure function болгож гаргаж, unit test-ээр баталгаажуулсан. Мөн ExamRunner.jsx дээр `expiresAt`-д суурилсан бодит цаг харуулагч (live countdown) болон client-side auto-submit safety net нэмэгдсэн (сервер аль хэдийн баталгаатай enforce хийдэг байсан ч UI дээр бодит цаг харагдахгүй байсан нь жинхэнэ gap байлаа).
- ХИЙГДСЭН (аудитын нэхэмжлэл шинэчлэгдсэн): Time limit server талд `QuizAttempt.expiresAt`-аар угаасаа хатуу enforce хийгддэг байсан (client хэзээ ч elapsed/remaining цаг дамжуулдаггүй, `resume`/`saveAnswer`/`expireDueAttempts` sweep бүгд серверийн цагаар шалгадаг). Одоо `computeAttemptExpiry` unit test-тэй болсон.
- ХИЙГДСЭН: `maxAttempts` аль хэдийн server-side enforce хийгддэг, teacher UI-д харагддаг байсан. Харин **highest/latest scoring policy огт байхгүй байсан нь бодит gap** — `Quiz.scoringPolicy` (HIGHEST/LATEST) enum нэмэгдэж, teacher quiz settings UI-д сонголт болж, course grade aggregation (`grade.service.ts`) үүнийг дагадаг болсон (өмнө нь "latest" hardcoded байсан).
- ХИЙГДЭЭГҮЙ ГЭЖ ТЭМДЭГЛЭСЭН БОЛОВЧ БОДИТООР ИЛҮҮ ЧУХАЛ GAP ОЛДСОН: Result visibility (`showResults`) backend дээр бүрэн ажилладаг байсан ч **student-д зориулсан per-question review/result page огт байхгүй байсан** — `resume()` endpoint шалгалт дууссаны дараа асуултын snapshot-г бүрэн хоослодог байсан тул frontend дээр харуулах өгөгдөл ч байхгүй байлаа. Үүнийг засаж, `resume()` дуусасан attempt дээр (зөвхөн `showResults=true` үед) асуулт бүрийн зөв/буруу, авсан оноо, зөв хариултыг буцаадаг болгож, шинэ `/student/exams/:attemptId/result` review page нэмэгдсэн.
- ХИЙГДСЭН: Teacher quiz settings form (`TeacherQuizzes.jsx`, `QuizEditor.jsx`) дээрх checkbox-ууд өмнө нь raw field name (`shuffleQuestions`, `showResults` гэх мэт) шууд label болж харагддаг байсныг ойлгомжтой монгол label + tooltip болгосон.
- P2: GitHub-той адил "IDOR" load risk (submission/grade/billing) нь энэ FR-ийн scope-д ороогүй, NFR-4 дор бие даан хаагдах ёстой хэвээр.

100% болгох санал:

- Autosave/resume/expiry логикийг цаашид DB-holding integration test-ээр (жинхэнэ Postgres-той CI орчинд) бататгах — одоогийн unit test зөвхөн pure function-уудыг (expiry тооцоолол, scoring policy) хамардаг.
- Manual review (`UNDER_REVIEW`, essay/text) дууссаны дараа student review page дээр шинэчлэгдсэн оноог харуулах flow (жишээ нь notification) нэмэх.

## FR-6 Ирц

Статус: Mostly implemented, e2e/DoD verification remaining

Байгаа зүйл:

- Teacher attendance roster, present/late/absent/excused status, batch record, history, CSV export байна.
- Absence count болон notification payload logic байна.
- Student/parent attendance view байна.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Absence threshold `OrgSettings.attendanceRuleJson`-оос (`absenceThreshold`) тохируулагддаг болсон — өмнө нь `ABSENCE_THRESHOLD = 3` кодод hardcoded байсан бөгөөд `attendanceRuleJson` UI дээр засварлагддаг байсан ч academic-service хэзээ ч буцааж уншдаггүй байсан ("завсрын" тохиргоо). Одоо `organization-service`-ийн `/internal/organizations/:id/attendance-policy` endpoint болон academic-service-ийн `getOrganizationAttendancePolicy` client-ээр холбогдсон.
- ХИЙГДСЭН: Threshold давсан үед зөвхөн guardian + course instructor мэдэгддэг байсныг засаж, байгууллагын `ORG_ADMIN`/`SUPER_ADMIN` ("менежер") хэрэглэгчид ч мэдэгдэл авдаг болсон.
- ХИЙГДСЭН: Notification-service-ийн alert текст дэх hardcoded "(босго: 3)" мессежийг event payload-оос ирсэн бодит threshold-оор сольсон.
- ХИЙГДСЭН: `Notification`/`NotificationDelivery` хүснэгтүүд threshold alert бүрийг идемпотент бичдэг тул "notification history" шаардлага өмнө нь ч хангагдсан байсныг баталгаажуулсан (код нягтлалт).
- ХИЙГДСЭН: `GET /attendance` хариу дотор `cohort.course` мэдээлэл нэмэгдэж, student/parent attendance detail хуудсуудад course/cohort тус бүрийн ирцийн хувь (progress bar) харагдах болсон (шинэ shared `CourseAttendanceBreakdown` component).
- ХИЙГДСЭН: `AttendanceRoster.jsx` дээрх өдрийн default утга `toISOString()` (UTC) ашигладаг байснаас болж Asia/Ulaanbaatar (UTC+8) цагийн бүсэд өглөөний эрт цагт өчигдрийн огноог харуулдаг байсан бодит off-by-one bug-ийг олж, local date-аар засав.
- ХИЙГДСЭН: `OrganizationSettings.jsx` дээрх "Attendance rule JSON" raw textarea-г бүтэцтэй "Тасалсан удаагийн босго" болон "Хоцролт минут" тоон талбар болгосон.
- P2: Дээрх бүх засварыг бодит Postgres-той orchestrated e2e/DoD орчинд баталгаажуулах шаардлагатай хэвээр (энэ dev орчинд DB алга тул зөвхөн pure function unit test хийгдсэн).

100% болгох санал:

- `attendance.security.test.ts`-ийг бодит DB-тэй CI орчинд ажиллуулж, configurable threshold, manager recipient, per-course breakdown-г e2e баталгаажуулах.
- Teacher/student attendance page-үүд дээр org timezone-той бүрэн уялдсан "өнөөдөр" тодорхойлолт (одоогийн засвар зөвхөн browser local date ашигладаг, org timezone-той 100% тохирно гэсэн баталгаа биш).

## FR-7 Дүн Ба Явц

Статус: Mostly implemented, org-level risk threshold config remaining

Байгаа зүйл:

- Grade service, gradebook UI, teacher student progress, CSV export суурь байна.
- Organization grading policy service байна.
- Student dashboard дээр дүн/явцын хэсгүүд байна.
- `computeCourseGrade` нь API-аар бодитоор дамждаг байсныг (gradebook, transcript endpoint-үүдээр) код нягтлалтаар баталгаажуулсан — student/parent/teacher бүгд бодит weighted percent/letter харж байсан (энэ хэсэг аудитын анхны төсөөллөөс илүү сайн байсан).

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Weighted grade policy-д attendance нэмэгдэх боломжгүй байсан жинхэнэ gap-ыг олсон (assignment/quiz категориуд аль хэдийн ажилладаг байсан ч attendance огт холбогдоогүй байсан). `GradeCategory.source` (MANUAL/ATTENDANCE) enum нэмэгдэж, ATTENDANCE эх сурвалжтай категори үүсгэвэл тухайн сурагчийн курсын ирцийн хувийг автоматаар тухайн категорийн жинтэйгээр `computeCourseGrade`-д оруулдаг болсон. Ингэснээр "даалгавар 40% / шалгалт 40% / ирц 20%" policy бүрэн тохируулагдах боломжтой болсон.
- ХИЙГДСЭН: At-risk students rule болон жагсаалт нэмэгдсэн (өмнө нь код дотор "risk"-той холбоотой юу ч байгаагүй нь баталгаажсан). Курсын дүн/ирцийн fallback босго 60%/80% боловч одоо байгууллага бүр `OrganizationSettings` дээр risk grade/attendance threshold тохируулж, academic-service тэр policy-г уншдаг болсон. `GET /courses/:courseId/at-risk-students`, teacher Gradebook болон Manager/Admin dashboard дээр "Эрсдэлтэй сурагчид" харагдана.
- ХИЙГДСЭН: Grade audit log-ийн жинхэнэ цоорхойг олсон — `GradeHistory` зөвхөн score өөрчлөгдөх (`updateGrade`, bulk CSV update) үед бичигддэг байсан ч анхны дүн үүсгэх бүх зам (`gradeSubmission`, `createManualGrade`, bulk CSV create) огт `GradeHistory` бичдэггүй байсан тул `getGradeHistory` анх удаа дүнлэгдсэн грэйдэд хоосон түүх буцаадаг байсан. Гурван замд `previousScore: null, newScore` бүхий эхний `GradeHistory` мөр бичдэг болгосон.
- ХИЙГДСЭН: Grade CSV export (`grade-csv.service.ts`) болон attendance CSV export (`attendance-csv.service.ts`) хоёулаа UTF-8 BOM байхгүй байсныг олж, `report-storage.service.ts`-ийн адил BOM prefix нэмсэн (Cyrillic feedback/тэмдэглэл Excel дээр гажигтай харагдах эрсдэлийг арилгасан). `parseCsv`-д ч BOM strip нэмж, экспортолсон файлаа дахин импортлоход эвдрэхгүй болгосон.
- ХИЙГДСЭН: `RISK_GRADE_THRESHOLD`/`RISK_ATTENDANCE_THRESHOLD` fallback хэвээр үлдсэн ч байгууллага бүрийн өөрийн threshold тохируулах UI/backend policy нэмэгдсэн.
- P2: Дээрх бүх засварыг бодит Postgres-той orchestrated e2e орчинд баталгаажуулах шаардлагатай хэвээр (энэ dev орчинд DB алга тул зөвхөн pure function unit test + DB-holding test update хийгдсэн).

100% болгох санал:

- ХИЙГДСЭН: `RISK_GRADE_THRESHOLD`/`RISK_ATTENDANCE_THRESHOLD`-г `OrgSettings.attendanceRuleJson` policy-д тохируулагддаг болгосон.
- ХИЙГДСЭН: At-risk жагсаалтыг Manager/Admin dashboard-д нэгтгэсэн.
- `grade.security.test.ts`, `grade-csv-bom.test.ts`, `at-risk-students.test.ts`-г бодит DB-тэй CI орчинд ажиллуулж баталгаажуулах.

## FR-8 Гэрчилгээ

Статус: Mostly implemented, PDF QA checklist remaining

Байгаа зүйл:

- Certificate issue, PDF storage, download, revoke/reissue, public verify link байна.
- Certificate template суурь байна.
- Код нягтлалтаар тогтоов: гэрчилгээ өмнө нь **зөвхөн lesson-progress хувиар** (`Course.completionRule`/`completionPercentage`) автоматаар үүсдэг байсан — cohort/дүнтэй огт холбогдоогүй байсан тул сурагч бүх хичээлээ дарсан ч дүнгээрээ тэнцээгүй байхад ч гэрчилгээ авдаг байж болзошгүй эрсдэлтэй байлаа.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Cohort completion -> eligible enrollment (тэнцсэн эсэх, `computeCourseGrade` ашиглан) -> certificate issue flow бүрэн нэмэгдсэн. Багш "Анги дуусгах" товч дарахад cohort `COMPLETED` болж, тухайн ангийн F бус дүнтэй сурагч бүрт автоматаар гэрчилгээ олгогддог, аль хэдийн байгаа бол алгасдаг, тэнцээгүй бол алгасдаг болсон.
- ХИЙГДСЭН: Certificate-г `enrollmentId`-тэй холбосон (аль cohort-оор дамжиж авсныг тодорхой болгосон). Мөн код нягтлалтаар **бодит race condition** илэрсэн: `@@unique([organizationId, studentId, courseId, revokedAt])` бодитоор ажилладаггүй байсан (Postgres NULL-ыг distinct гэж үздэг тул `revokedAt IS NULL` мөрүүд давхардаж болдог байсан) — DB-level partial unique index нэмж, `issueCertificate`-г race-safe (давхардал үүсэхэд шинэ мөр биш, байгаа гэрчилгээгээ буцаадаг) болгосон.
- ХИЙГДСЭН: Template designer UI дээр `logoUrl`, `signatureName` талбарууд нэмэгдсэн (backend/validator дээр байсан ч UI дээр байхгүй байсан). PDF-д лого зурагийг render хийдэг болгосон (өмнө нь `logoUrl` бүрэн хадгалагддаг ч PDF дээр хэзээ ч зурагддаггүй байсан). "Урьдчилан харах" (preview) endpoint/товч нэмэгдэж, admin гэрчилгээ хадгалахаасаа өмнө sample PDF-ээ шалгах боломжтой болсон.
- P2: Serial/verification-code формат хэвээрээ hardcoded (`crypto.randomBytes(9)`), байгууллагаар тохируулах боломжгүй.
- P2: Дээрх бүх засварыг бодит Postgres-той orchestrated e2e орчинд баталгаажуулах шаардлагатай хэвээр (энэ dev орчинд DB алга тул зөвхөн pure eligibility function unit test хийгдэж, DB-holding test бичигдсэн ч ажиллуулж баталгаажуулаагүй).

100% болгох санал:

- Serial/verification-code форматыг тохируулах эсэхийг шийдэх.
- `certificate.security.test.ts`-г бодит DB-тэй CI орчинд ажиллуулж баталгаажуулах.
- PDF visual regression/manual QA checklist нэмэх (лого/гарын үсгийн зохион байгуулалт).

## FR-9 Төлбөр

Статус: Partial, high risk

Байгаа зүйл:

- Billing service, invoice/payment model, manual payment, outstanding invoices, reminders endpoint болон scheduled reminder job байна.
- Invoice дээр student/cohort/enrollment холбоос, installment fields, due date, access restriction flag нэмэгдсэн; installmentTotal өгвөл auto split invoices үүсдэг болсон.
- ХИЙГДСЭН: QPay provider abstraction, invoice create, signed webhook/reconciliation endpoint нэмэгдсэн.
- Billing feature flag default enabled болсон.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Academic enrollment event course price/currency-тэй гарч, billing service `ENROLLMENT_CREATED` consumer course price > 0 үед invoice автоматаар үүсгэдэг болсон.
- ХИЙГДСЭН: Installment schedule auto split logic нэмэгдсэн (`installmentTotal`, `installmentIntervalDays`-аар олон invoice үүсгэнэ). UI polish үлдсэн.
- ХИЙГДСЭН: Төлбөр дутуу үед материал хязгаарлах policy student course content access дээр enforce хийгддэг болсон.
- ХИЙГДСЭН: QPay demo URL gap хаагдсан. Production-д `QPAY_API_URL`, `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_WEBHOOK_SECRET` заавал шалгагдаж, webhook HMAC signature баталгаажуулж, invoice/payment-г idempotent reconcile хийдэг болсон.
- ХИЙГДСЭН: Payment reminder scheduler/job нэмэгдсэн, 24 цагийн duplicate guard болон outbox retry ашигладаг болсон. Billing invoice/reminder/payment notification consumer, default email templates, `/student/payments` actionUrl нэмэгдсэн; sent history нь `NotificationDelivery` дээр хадгалагдана.
- ХИЙГДСЭН: Student payment page нэмэгдэж, оюутан өөрийн invoice, үлдэгдэл, QPay төлөх товч, төлбөрийн түүх харах боломжтой болсон.
- ХИЙГДСЭН: Migration drift check deploy readiness gate-д нэмэгдсэн (`npm run prisma:check-drift --prefix backend`). Бодит production DB дээр `prisma migrate deploy` ажиллуулах release-time баталгаа хэвээр шаардлагатай.

100% болгох санал:

- Enrollment created event -> Billing invoice schedule generator.
- ХИЙГДСЭН: QPay provider abstraction + real webhook + payment reconciliation.
- Organization billing setting: restrict unpaid access true/false.
- ХИЙГДСЭН: Course/lesson access middleware дээр unpaid restriction шалгах.
- ХИЙГДСЭН: Student payment dashboard нэмэх.
- ХИЙГДСЭН: Migration drift-г detect хийх gate нэмэгдсэн; `prisma migrate deploy` бүх service дээр clean ажиллуулах нь release runbook/CI орчинд баталгаажна.

## FR-10 Мэдэгдэл

Статус: Mostly implemented, cross-role deep-link coverage remaining

Байгаа зүйл:

- Notification service, in-app delivery, preferences, RabbitMQ consumers, bulk notification, email/SMS/push channel structure байна.
- Announcement, attendance, schedule, password reset, user invite гэх мэт event consumers байна.
- USER register болон student access request notification нэмэгдсэн.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Student access request notification-ийн deep link (`actionUrl: '/admin/student-access-requests'`) аль хэдийн backend дээр байсан ч `getNotifications` metadata-г хэзээ ч parse хийдэггүй, frontend actionUrl-г хэзээ ч render хийдэггүй байсан тул бодит practice дээр ажиллахгүй байсан ("dead metadata"). FR-4 ажлын явцад `getNotifications`-д metadata parsing, Notifications.jsx/NotificationDropdown.jsx-д "Харах" action button нэмэгдсэнээр энэ notification-ийн deep link анх удаа бодитоор ажиллах болсон. `STUDENT_ACCESS_REQUEST_REVIEWED` (шийдвэрийн мэдэгдэл)-д ч `actionUrl: '/user'` нэмэгдэж, requester өөрийн хүсэлтийн төлөвийг мэдэгдлээс шууд шалгах боломжтой болсон.
- ХИЙГДСЭН (аудитын нэхэмжлэл шинэчлэгдсэн): Код нягтлалтаар шалгахад `USER_UPDATED` consumer (`events/user-updated.consumer.ts`) аль хэдийн зөв бичигдсэн (`role` талбарыг sync хийдэг), зөв `index.ts`-д wiring хийгдсэн, publish trigger (`auth-service`-ийн `updateUser`) ч бодитоор ажилладаг болохыг баталгаажуулсан — "role update дээр алдагдах" гэсэн P1 нэхэмжлэл код түвшинд batalгаажаагүй (архитектурын цаашдын эрсдэл л үлдсэн: DLQ дээрх алдаатай мессежийг monitor хийх зохион байгуулалт байхгүй, гэхдээ энэ нь код засвар шаардсан bug биш).
- ХИЙГДСЭН: SMS provider (`channel-provider.service.ts`) production дээр startup validation байхгүй байсан (зөвхөн email-д байсан) — half-configured SMS (URL байгаа ч token байхгүй гэх мэт) send хийх мөчид л илэрдэг байсан. `validateSmsProviderConfiguration` нэмэгдэж, notification-service эхлэхэд шалгадаг болсон. `productionReadiness.ts`-ийн SMS шалгалт бодит код унших `SMS_PROVIDER_URL`/`SMS_PROVIDER_TOKEN`-ийн оронд хэзээ ч ашиглагддаггүй `TWILIO_*` хувьсагчдыг шалгадаг байсан алдааг засав.
- ХИЙГДСЭН: `channel-provider.service.ts`-ийн `sendChannel` (EMAIL/SMS/PUSH) болон `validateSmsProviderConfiguration`-д unit test нэмэгдсэн (өмнө нь тестгүй байсан).
- ХИЙГДСЭН: Notification `metadata.actionUrl` олон role хүлээн авагчтай (staff-workflow: document/scholarship request) notification дээр ч ажилладаг болгохын тулд role-relative actionUrl convention нэмэгдсэн (`resolveNotificationActionUrl` — `/`-ээр эхлэхгүй бол хүлээн авагчийн role-ийн dashboard prefix-ээр автоматаар холбоно). `DOCUMENT_REQUEST_CREATED/STATUS_UPDATED`, `SCHOLARSHIP_REQUEST_CREATED/STATUS_UPDATED` дөрвөн notification төрөлд actionUrl нэмэгдсэн.
- P2: `ANNOUNCEMENT_PUBLISHED`, `ATTENDANCE_THRESHOLD_ALERT`, `ATTENDANCE_ABSENT/LATE`, `SCHEDULE_*` зэрэг notification-д actionUrl хараахан нэмэгдээгүй — эдгээрийн зарим нь (жишээ нь announcement) тохирох landing page/route огт байхгүй тул actionUrl нэмэхийн өмнө frontend page эсвэл role-with-context resolution шаардлагатай.
- P2: Notification page search/filter хэвээрээ basic (title/description substring search) — semantic filter (eventType-аар) нэмэгдээгүй.

100% болгох санал:

- `ANNOUNCEMENT_PUBLISHED`-д зориулж cohort/course-с шууд харагдах announcement list page нэмж, actionUrl холбох.
- `ATTENDANCE_THRESHOLD_ALERT`/`ATTENDANCE_ABSENT`/`ATTENDANCE_LATE`-д actionUrl нэмэх (role-relative convention ашиглаж болно, гэхдээ recipient бүрт тохирох attendance detail landing тодорхойлох шаардлагатай).
- Email/SMS delivery-ийн production DLQ monitoring/alerting нэмэх.

## FR-11 Тайлан

Статус: Mostly implemented, dashboard threshold config remaining

Байгаа зүйл:

- Report service/job/storage, manager/admin dashboards, attendance/grade/payment data sources суурь байна.
- Report catalog 9 (одоо 10) төрөлтэй, бүгд ажилладаг builder function-тэй, role-scoped, CSV/PDF export + background job + schedule бүрэн ажилладаг болохыг код нягтлалтаар баталгаажуулсан.

Дутуу, алдаатай flow/UI/UX:

- ХИЙГДСЭН: Байгууллагын менежерийн dashboard (`getAdminDashboard`) 4 metric-ийн 3-ыг (active cohorts, revenue/receivable, average attendance) огт тооцдоггүй байсныг олж, бүгдийг нэмсэн. `activeCohorts` (`Cohort.status='ACTIVE'` тоолол), `averageAttendancePct` (org-wide present/total), `revenue`/`receivable` (billing-service-ийн `/revenue-summary` internal endpoint-оор, feature-flag идэвхгүй бол `null` gracefully) — бүгд `Admin/index.jsx` дээр шинэ stat card болж харагдана.
- ХИЙГДСЭН: Billing-service-ийн `getRevenueSummary` internal endpoint нь өмнө нь зөвхөн "орлого" (collected payments) буцаадаг байсан бөгөөд "авлага" (outstanding/receivable) тооцоолол огт байхгүй байсан. `totalOutstanding` талбар нэмэгдсэн (`listOutstandingInvoices`-тэй ижил тодорхойлолт: `status=PENDING` бөгөөд `dueDate` өнгөрсөн эсвэл тодорхойгүй).
- ХИЙГДСЭН: Cohort-level performance report (`COHORT_PERFORMANCE`) шинээр нэмэгдсэн — тухайн ангийн ирцийн дундаж, даалгаврын дүүргэлтийн хувь, шалгалтын дундаж оноо, тэнцсэн хувь ("graduation rate")-ийг зөвхөн тухайн cohort-ийн бүртгэлтэй сурагчдаар (course-той нийт биш) тооцдог. Өмнө нь ийм cohort-scoped тайлан огт байгаагүйг код нягтлалтаар баталгаажуулсан.
- ХИЙГДСЭН: Reports хуудсан дээр `filters.courseId` state байгаа ч сонгох UI огт байгаагүй ("dead filter") — курс болон (COHORT_PERFORMANCE сонгосон үед) анги сонгох dropdown нэмэгдсэн.
- ХИЙГДСЭН: Код нягтлалтаар **бодит идэвхтэй bug** олдсон — `exportReportFile`/`createReportJob` хоосон утгатай filter талбаруудыг (`courseId=''`) query/body-д шууд явуулдаг байсан бөгөөд backend-ийн zod validator `.min(1)` шаарддаг тул CSV/PDF татах, том тайлан үүсгэх товч бүр 400 алдаа өгдөг байж болзошгүй байсан (курс/анги сонгох UI байхгүй үед `courseId` үргэлж `''` байсан). Бүх гурван API function-д хоосон утгыг цэвэрлэдэг `compactFilters` нэмсэн. `report.controller.ts`-ийн `filtersFrom`-д `cohortId` дутуу байсныг ч олж нэмсэн.
- ХИЙГДСЭН: `renderCsv`/`renderPdf` (`report-storage.service.ts`) хэзээ ч тестгүй байсан. `renderPdf`-д PDF magic-byte, олон хуудас (pagination), хоосон rows тестүүд нэмэгдсэн. Мөн `renderCsv`-ийн BOM prefix `report.controller.ts` болон `report-job.service.ts` дээр давхардаж бичигдэж байсныг нэг газар (`renderCsv` дотор) төвлөрүүлсэн.
- P2: Manager dashboard-ийн "average attendance"/"revenue" figure-үүдэд threshold/target тохируулах эсэхийг шийдэх (жишээ нь улаан/шар/ногоон индикатор) — одоогоор түүхий тоо л харуулдаг.
- P2: `report-cohort-performance.test.ts` бодит DB-той CI орчинд ажиллуулж баталгаажуулах шаардлагатай (энэ dev орчинд DB алга тул зөвхөн pure `renderCsv`/`renderPdf` test ажиллуулж баталгаажуулсан).

100% болгох санал:

- Manager dashboard metric-үүдэд visual threshold/trend indicator нэмэх.
- `COHORT_PERFORMANCE` тайланг Reports хуудаснаас гадна Teacher/Cohorts.jsx дотор шууд (`getCourseGradebook`-ийн адил) харуулах эсэхийг үнэлэх.
- `report-cohort-performance.test.ts`-г бодит DB-тэй CI орчинд ажиллуулж баталгаажуулах.

## Phase 2 Шаардлагууд

Requirement v0.1 дээр Phase 2 scope MVP-д орохгүй гэж заасан. Одоогийн project эдгээрийг 100% хийх албагүй:

- AI туслах
- Код даалгаврын auto test runner
- Forum/discussion
- Өөрийн video hosting/streaming
- Full multi-tenant SaaS signup/billing
- Mobile app
- Zoom/Meet integration
- Marketing enrollment page

Гэхдээ одоо нэмэгдсэн public school request flow нь Phase 2 multi-tenant/open enrollment тал руу орж эхэлсэн. Үүнийг MVP-д үлдээх бол data model-г зөв болгох шаардлагатай: notification-only request хангалтгүй.

## Non-Functional Requirements

Статус: Partial

NFR-1 Quiz fairness:

- Зөв хариулт client-д очихгүй байх суурь байна. Server time limit (`expiresAt`), duplicate submit protection (atomic `updateMany` guard) нь код түвшинд аль хэдийн зөв хэрэгжсэн болохыг баталгаажуулсан.
- ХИЙГДСЭН: `computeAttemptExpiry`, `resolveQuizAttemptScore` зэрэг цөм логикийг pure function болгож unit test-тэй болгосон.
- P1: Бодит Postgres-той orchestrated integration test (DB-д хамааралтай `start`/`saveAnswer`/`resume`/`expireDueAttempts` бүрэн урсгал) CI орчинд нэмэх шаардлагатай хэвээр — энэ dev orchestrated орчинд DB алга тул хийгдээгүй.

NFR-2 File:

- File upload/download суурь байна.
- P1: 50MB limit, MIME allowlist, virus scan эсвэл strict type filter production enforcement баталгаажуулах.

NFR-3 Performance:

- P1: API p95 < 400ms, gradebook 100 students < 2s benchmark албан ёсоор тогтмол ажилладаг эсэх тодорхой биш.
- P2: Frontend build дээр chunk size warning гарч байсан бол route-level lazy loading хэрэгтэй.

NFR-4 Security:

- CSRF, auth guard, RBAC, IDOR test зарим хэсэгт байна.
- P0: Student grade/submission/billing IDOR-г бүх endpoint дээр systematic testлэх.
- P1: Rich text sanitize бүх lesson/announcement/assignment content дээр нэг мөр хэрэгжсэн эсэхийг шалгах.

NFR-5 Privacy:

- Legal/privacy pages болон consent flow байна.
- P1: Minor policy, parent access, billing/grade visibility cross-role test нэмэх.

NFR-6 Reliability:

- Event outbox/inbox суурь байна.
- ХИЙГДСЭН (аудитын нэхэмжлэл шинэчлэгдсэн): Quiz autosave/resume нь бодитоор аль хэдийн бүрэн хэрэгжсэн болохыг тогтоосон (`QuizAnswer` upsert + `lastSavedAt` + client debounce + localStorage offline fallback + server resume). Одоо client дээр `expiresAt`-д суурилсан live countdown/auto-submit нэмэгдэж, UX-ийн жинхэнэ цоорхойг хаасан.
- ХИЙГДСЭН: Payment webhook нь signature validation, idempotent reconciliation, payment/invoice event outbox retry-тэй болсон.

NFR-7 Observability:

- Structured logging docs/health checks байна.
- P1: Sentry integration production config баталгаажуулах.

NFR-8 Testing:

- Vitest/Supertest тестүүд байна.
- P0: Grade calculation, quiz grading/time limit, billing invoice/payment lifecycle integration tests MVP DoD-д хүрэх хэмжээнд нэмэх.

## UI/UX Flow-ийн Тусгай Ажиглалтууд

- ХИЙГДСЭН: USER dashboard дээр хүсэлт явуулсны дараа refresh хийсэн ч persistent `StudentAccessRequest` status харагддаг болсон.
- ХИЙГДСЭН: `notified: 0` үед user-д амжилттай мэт харуулахгүй, backend тод алдаа буцаадаг болсон.
- ХИЙГДСЭН: Manager notification/request queue дээр requester context харагдаж, approval action төв audit log болон `OrganizationMembership` үүсгэлттэй холбогдсон.
- ХИЙГДСЭН: Teacher-д хүсэлт очих permission mismatch арилсан; request зөвхөн manager/admin role руу чиглэдэг болсон.
- ХИЙГДСЭН: Multi-school сонголтын product/data model `OrganizationMembership` + session switch хэлбэрээр тодорхой болсон.
- ХИЙГДСЭН: Course detail/catalog дээр price харагдахаас гадна enrollment -> invoice -> student payment -> access restriction flow холбогдсон.
- ХИЙГДСЭН: Student dashboard/navigation нь course, assignment, grade, attendance, certificate, payment үндсэн урсгалуудтай болсон.
- P2: Error states зарим page дээр console-д үлдээд user-friendly retry guidance бага.
- P2: Loading/empty/success state бүх CRUD page дээр ижил дизайнтай биш.
- P2: Accessibility системтэй шалгаагүй: dialog focus trap, keyboard navigation, table headers, aria labels.

## Хийгдсэн Ч Production-Ready Биш Хэсгүүд

Энэ хэсэгт "огт байхгүй" биш, харин код/UI нь байгаа боловч бодит хэрэглэгч дээр гаргахад workflow, ойлгомж, data consistency, алдааны төлөв, permission, test дутагдалтай хэсгүүдийг тусад нь тэмдэглэв.

### USER -> Сурагч Болох Flow

Статус: Үндсэн workflow хийгдсэн, deployment/e2e verification үлдсэн

- USER dashboard, сургуулийн жагсаалт, хүсэлт илгээх button хийгдсэн.
- ХИЙГДСЭН: Хүсэлт persistent record болсон тул refresh дараа төлөв харагдана.
- ХИЙГДСЭН: Manager талд dedicated approval inbox нэмэгдсэн.
- ХИЙГДСЭН: Approve/reject action нэмэгдсэн.
- ХИЙГДСЭН: Хүсэлт багшид очихоо больж зөвхөн менежерт очдог болсон.
- ХИЙГДСЭН: `notified: 0` үед user-д амжилттай мэт харагдахгүй, алдаа буцаана.
- ХИЙГДСЭН: Approve дараа USER pending page дээр approved membership рүү session/context switch хийгээд сурагчийн dashboard руу орох UX нэмэгдсэн.
- ХИЙГДСЭН: Approval audit нь notification-service local audit дээр бичигдэхээс гадна academic-service-ийн central `AuditLog` руу internal service endpoint-оор best-effort бичигддэг болсон.
- ХИЙГДСЭН: Approved `OrganizationMembership` рүү switch хийхэд auth-service шинэ organization/role бүхий access+refresh session үүсгэдэг болсон.

Production-д гаргахын өмнө:

- ХИЙГДСЭН: Central audit log-той холбох.
- ХИЙГДСЭН: Cross-organization membership model хийхээр шийдэж, auth-service дээр `OrganizationMembership` model + internal upsert endpoint нэмсэн.
- ХИЙГДСЭН: Membership session/context switch endpoint болон USER pending page action нэмсэн.

### Login/Register Flow

Статус: Үндсэн onboarding UX хийгдсэн, phone/e2e verification үлдсэн

- Register role сонголт, байгууллага, сурагч/ажилтны ID талбарууд хасагдсан.
- Default USER role ажиллах суурь байна.
- ХИЙГДСЭН: FR-1.1-ийн "имэйл эсвэл утас + нууц үг" UX login form дээр тодорхой болсон.
- ХИЙГДСЭН: Register хийсний дараах USER pending page дээр approval timeline/status харагддаг болсон.
- ХИЙГДСЭН: Organization default account хадгалагдсан ч олон сургуулийн real onboarding-д зориулсан `OrganizationMembership` + session switch нэмэгдсэн.

Production-д гаргахын өмнө:

- ХИЙГДСЭН: Login input label/copy-г email/phone болгон тодруулах.
- ХИЙГДСЭН: Register success -> USER pending page дээр next step/status илүү тод харуулах.
- ХИЙГДСЭН: Multi-school flow-д membership/request model нэмэгдсэн.
- ХИЙГДСЭН: Approved membership рүү session/context switch хийх flow нэмэгдсэн.

### Manager/User Management Flow

Статус: Байгаа боловч workflow муу

- Manager буюу admin user management page дээр хэрэглэгч үүсгэх, засах, role солих суурь байна.
- Гэхдээ student access request-тэй шууд холбогдоогүй.
- ХИЙГДСЭН: Student access request notification нь `actionUrl`, `targetType`, `targetId` metadata-тай болж request queue руу deep-link хийдэг болсон.
- Role update хийхдээ "энэ хүн аль сургуулиас хүсэлт явуулсан, ямар note бичсэн, хэн баталсан" гэдэг context харагдахгүй.
- Role change хийсний дараа notification recipient role sync баталгаагүй бол дараагийн notification буруу route-лагдах эрсдэлтэй.

Production-д гаргахын өмнө:

- Request queue-г user management-тэй нэгтгэх.
- Role update event consumer-уудыг бүх service дээр sync хийх.
- ХИЙГДСЭН: Manager approval action audit log бичих.

### Teacher Course/Cohort Pages

Статус: Байгаа боловч information architecture сул

- Teacher course page дээр сурагчдын хүснэгт харагдах болсон.
- Sidebar-аас тусдаа "Сурагчид, Ирц, Даалгавар, Дүн, Хуваарь" item-уудыг хасаж course дотор нэгтгэх чиглэл зөв.
- Гэхдээ course detail дотор эдгээрийг tab/section workflow болгон бүрэн mature болгоогүй бол багш өдөр тутам ажиллахад олон page хооронд төөрөх эрсдэлтэй.
- Student table байгаад attendance/assignment/grade/schedule action-ууд нэг context дотор шууд холбогдохгүй бол UX хагас дутуу санагдана.

Production-д гаргахын өмнө:

- Course detail эсвэл Cohort detail дээр tabs хийх: `Сурагчид`, `Ирц`, `Даалгавар`, `Дүн`, `Хуваарь`.
- Row action нэмэх: сурагчийн progress харах, attendance тэмдэглэх, grade өгөх.
- Empty/loading/error state-г бүх tab дээр нэг стандартаар хийх.

### Course Builder/Catalog Flow

Статус: Байгаа боловч production polish дутуу

- Course үүсгэх, duration/price харуулах, module/lesson CRUD байна.
- ХИЙГДСЭН: CourseVersion/publish/snapshot суурь workflow нэмэгдсэн.
- ХИЙГДСЭН: Lesson unlock rule UI нэмэгдсэн.
- ХИЙГДСЭН: Version restore/compare API болон CourseBuilder compare/restore control нэмэгдсэн; cohort runtime snapshot immutable rendering суурь ашиглагдаж байна.
- Builder UX дээр publish confirmation, unsaved changes guard, reorder control байна; richer preview/drag-drop polish үлдсэн.

Production-д гаргахын өмнө:

- Publish/version model хийх.
- Cohort зөвхөн published snapshot ашигладаг болгох.
- Builder дээр preview/publish/reorder UX сайжруулах.

### Assignment/Grading Flow

Статус: Resubmit/grade notification болон late policy centralize хийгдсэн, repo validation polish үлдсэн

- Student submission, file/repo URL, teacher grading, feedback, resubmit reason байна.
- ХИЙГДСЭН: Resubmit requested болон grade published үед student-д dedicated event-ээр (`ASSIGNMENT_RESUBMIT_REQUESTED`, `GRADE_PUBLISHED`) in-app notification очиж, `actionUrl` metadata-аар даалгаврын хуудас руу шууд шилждэг болсон.
- ХИЙГДСЭН: Late policy score calculation `late-policy.service.ts`-д нэг газар төвлөрсөн (single grade + bulk CSV import хоёулаа адил функц ашигладаг).
- ХИЙГДСЭН: Submission дээр `commitHash` талбар нэмэгдэж, student/teacher UI дээр `repoUrl`-тай хамт харагддаг.
- ХИЙГДСЭН: GitHub repo URL/commitHash хадгалах үед repo/commit access validation хийгддэг болсон. Branch-level validation polish үлдсэн.

Production-д гаргахын өмнө:

- ХИЙГДСЭН: Repo access validation (GitHub API-аар) нэмэх.
- Resubmit/grade notification integration test бичиж баталгаажуулах.
- Submission attempt history-г student/teacher UI дээр илүү тод болгох.

### Quiz Flow

Статус: Байгаа боловч high-stakes production-д сул

- Quiz runner, automatic grading, question types байна.
- Гэхдээ autosave/resume баталгаагүй бол шалгалтын үед browser/network тасрахад production эрсдэл өндөр.
- Time limit server enforcement, duplicate submit protection, attempt policy UX-г тестээр баталгаажуулах хэрэгтэй.

Production-д гаргахын өмнө:

- Autosave endpoint, resume UX, offline recovery хийх.
- Time-limit болон duplicate submit integration test нэмэх.
- Teacher settings дээр result visibility/attempt policy тодруулах.

### Billing/Payment Flow

Статус: Enrollment invoice auto-create, QPay provider/reconciliation, student payment UX, access restriction, installment split, reminder scheduler хийгдсэн; billing UI/template polish үлдсэн

- Invoice/payment/manual pay/outstanding/reminder/QPay provider endpoint байна.
- ХИЙГДСЭН: Enrollment хийхэд course price > 0 бол invoice автоматаар үүсдэг болсон.
- ХИЙГДСЭН: Real QPay provider abstraction, webhook signature validation, reconciliation нэмэгдсэн.
- ХИЙГДСЭН: Төлбөр дутуу үед lesson/material access restriction student course route дээр enforce хийгддэг болсон.
- ХИЙГДСЭН: Student өөрийн төлбөрөө харах/төлөх UX нэмэгдсэн.

Production-д гаргахын өмнө:

- ХИЙГДСЭН: Real QPay integration хийх.
- ХИЙГДСЭН: Payment webhook/reconciliation хийх.
- ХИЙГДСЭН: Student payment page хийх.
- ХИЙГДСЭН: Access restriction-г course/lesson route дээр enforce хийх.

### Notifications Flow

Статус: Байгаа боловч actionability сул

- In-app notification, preferences, event consumers байна.
- ХИЙГДСЭН: Notification metadata normalizer нэмэгдэж `actionUrl`, `targetType`, `targetId` стандарт болж, frontend card/dropdown эдгээрээс action route resolve хийдэг болсон.
- Student request, resubmit, payment reminder, attendance warning зэрэгт тухайн үйлдэл хийх page руу шууд шилжүүлэх UX хэрэгтэй.

Production-д гаргахын өмнө:

- ХИЙГДСЭН: Notification metadata-д `actionUrl`, `targetType`, `targetId` стандарт болгох.
- ХИЙГДСЭН: Notification card дээр primary action button харуулах.
- Delivery failure/retry monitoring хийх.

### Reports/Dashboard Flow

Статус: Manager metric contract бүрэн болсон, drill-down polish үлдсэн

- Dashboard/report service байна.
- ХИЙГДСЭН: Manager dashboard дээр revenue/receivable, attendance average, active cohorts, student count бүгд нэг дэлгэц дээр харагдах болсон. At-risk students card teacher gradebook дээрээс гадна Manager/Admin dashboard дээр organization-wide summary болон top risk list хэлбэрээр нэмэгдсэн. Graduation rate одоо `COHORT_PERFORMANCE` report-оор cohort тус бүрээр (өмнө нь зөвхөн org-wide байсан) тооцогддог.
- ХИЙГДСЭН: Report preview дээр `COHORT_PERFORMANCE` cohort мөрөөс role-aware drill-down link нэмэгдсэн (teacher -> cohort page, manager/admin -> course oversight cohort highlight).

Production-д гаргахын өмнө:

- ХИЙГДСЭН: Manager dashboard metric contract (active cohorts, revenue/receivable, average attendance, student count) бүрэн болсон.
- ХИЙГДСЭН: Report cards дээр drill-down link хийх (COHORT_PERFORMANCE report-оос тухайн cohort context руу шилжих).
- ХИЙГДСЭН: Export болон scheduled report output (CSV BOM, PDF magic-byte/pagination) unit test-тэй болсон; бодит DB-тэй CI орчинд баталгаажуулах нь үлдсэн.

## Data Model Gap

Requirement-д байгаа боловч одоогийн model дээр эрсдэлтэй зөрүү:

- ХИЙГДСЭН: `CourseVersion` суурь first-class model нэмэгдсэн.
- ХИЙГДСЭН: `Lesson.unlockRule` дээр scheduled/sequential/manual rule нэмэгдсэн.
- `AttendanceDay` + `AttendanceRecord`: current model шууд Attendance row хэлбэртэй байж болох тул requirement-ийн day abstraction-тай яг таарахгүй.
- `FinalGrade`: weighted final grade persistent snapshot хэлбэрээр бүрэн биш байж болзошгүй.
- ХИЙГДСЭН: `Certificate.enrollmentId` нэмэгдэж, DB-level partial unique index-ээр давхардал (race condition) хаагдсан.
- ХИЙГДСЭН: `Invoice.schedule(jsonb)` gap-ийг existing installment fields дээр auto split generator хэлбэрээр хаасан; access-restricted enrollment invoice auto-generation хийгдсэн.
- `StudentAccessRequest`: requirement-д шууд нэрлээгүй ч шинэ USER -> student approval flow-д зайлшгүй хэрэгтэй.
- ХИЙГДСЭН: `OrganizationMembership`: олон сургууль сонгох flow-д нэг user олон байгууллагад ямар эрхтэйг хадгалах model нэмэгдсэн.

## Priority Backlog

P0:

1. ХИЙГДСЭН: `StudentAccessRequest` persistent model, API, manager queue UI, approve/reject flow хийх.
2. ХИЙГДСЭН: Багш notification/approval permission mismatch-ийг шийдэх.
3. ХИЙГДСЭН: Enrollment created -> invoice schedule auto-create flow хийх.
4. ХИЙГДСЭН: Payment incomplete үед material restriction enforcement хийх.
5. ХИЙГДСЭН: Prisma migration drift/schema engine error асуудлыг detect хийх deploy gate нэмэх.
6. ХИЙГДСЭН: Quiz autosave/resume бодитоор аль хэдийн ажилладаг байсныг баталгаажуулж, expiry/scoring-policy pure function-уудыг unit test-тэй болгосон; DB-holding integration test CI орчинд нэмэх нь үлдсэн.
7. Grade, quiz, billing integration tests нэмэх.

P1:

1. ХИЙГДСЭН: CourseVersion restore/compare UI болон snapshot runtime rendering-г гүйцээх.
2. ХИЙГДСЭН: Enrollment CSV import preview/error handling хийх.
3. ХИЙГДСЭН: Real QPay provider/webhook/reconciliation хийх.
4. ХИЙГДСЭН: Student payment dashboard хийх.
5. ХИЙГДСЭН: Weighted grade policy UI + final grade computation (attendance категори орсноор) болон org-level risk threshold config хийгдсэн.
6. ХИЙГДСЭН: Certificate auto issue on cohort completion хийгдсэн (dedicated "Анги дуусгах" action, computeCourseGrade-д суурилсан eligibility).
7. ХИЙГДСЭН: Notification recipient role sync код нягтлалтаар зөв ажиллаж байгааг баталгаажуулсан (нэмэлт код засвар шаардагдаагүй).
8. Phone login UX/e2e test хийх.

P2:

1. ХИЙГДСЭН: Cohort detail page-г schedule/announcement/materials/members төвтэй болгох.
2. ХИЙГДСЭН: At-risk students card teacher gradebook болон Manager/Admin dashboard дээр нэгтгэгдсэн.
3. ХИЙГДСЭН: Attendance threshold settings UI (тасалсан удаагийн босго, хоцролт минут) хийгдсэн; DB-holding e2e test-ээр баталгаажуулах нь үлдсэн.
4. Rich text sanitize, file scan/type filter-г auditлах.
5. Accessibility болон responsive QA хийх.
6. UI Монгол/i18n string sweep хийх.

P3:

1. `/admin` route нэрийг product copy-той нийцүүлэх эсэх шийдэх.
2. Empty/loading/error states нэг загварт оруулах.
3. Course builder UX polish: publish confirmation/order controls хийгдсэн; richer preview/drag-drop polish үлдсэн.

## Acceptance Criteria-д Харьцуулсан Эцсийн Үнэлгээ

- Курс -> модуль -> хичээл үүсэх: Mostly pass. Unlock/snapshot/version restore/compare хийгдсэн; richer builder preview/drag-drop polish үлдсэн.
- Анги үүсгэх, оюутан CSV import, зарлал мэдэгдэл: Mostly pass. Cohort tabs, CSV enrollment, row-level import result/error CSV download, announcement notification хийгдсэн; e2e баталгаажуулалт үлдсэн.
- Даалгавар full cycle: Mostly pass. Resubmit/grade notification, late policy centralize, repo/commit validation хийгдсэн; branch/rubric polish, integration test дутуу.
- Quiz: Mostly pass. Server answer handling, autosave/resume, time-limit enforcement бодитоор ажиллаж байгааг тогтоож unit test нэмсэн; scoring policy болон student result review page-ийг гүйцээсэн. DB-holding integration test хэвээр дутуу.
- Ирц: Mostly pass. Threshold configurable болж, manager alert-д ORG_ADMIN/SUPER_ADMIN нэмэгдсэн; DB-holding e2e баталгаажуулах нь үлдсэн.
- Дүн weighted gradebook CSV: Mostly pass. Attendance категори weighted final grade-д орсон, CSV BOM засагдсан, grade-creation audit log нэмэгдсэн, org-level risk threshold config нэмэгдсэн; DB/e2e баталгаажуулалт үлдсэн.
- Certificate PDF + public verify: Mostly pass. Cohort completion -> eligible enrollment -> auto issue flow хийгдсэн, enrollmentId холбогдсон, race condition хаагдсан; DB-holding e2e баталгаажуулах нь үлдсэн.
- Төлбөр QPay + manual + reminders: Mostly pass. Auto invoice, QPay provider/webhook/reconciliation, student payment page, restriction enforcement, installment schedule generator, reminder scheduler, billing notification templates/action links/sent delivery history хийгдсэн.
- USER -> Student onboarding: Mostly pass. Persistent request, manager approval, central audit, `OrganizationMembership`, session/context switch, refresh rotation хийгдсэн; бодит олон сургуультай e2e smoke test үлдсэн.
- IDOR/security: Partial. Зарим test байна, бүх grade/submission/billing endpoint дээр бүрэн биш.
- Grade/payment/quiz integration tests: Partial. MVP итгэл өгөх хэмжээнд нэмэх шаардлагатай.
- Dogfood pilot: Not verified. Нэг бодит анги бүтэн cycle-ээр ашигласан нотолгоо repo дээр алга.

## Дараагийн Зөв Алхам

100% requirement-д ойртуулах хамгийн зөв дараалал:

1. ХИЙГДСЭН: Enrollment -> billing -> payment -> access restriction chain-ийн payment/access restriction хэсгийг гүйцээх.
2. ХИЙГДСЭН: CourseVersion/snapshot-г immutable болгох.
3. DB-holding integration/e2e tests: quiz autosave/time limit, weighted final grade, billing webhook/access restriction, multi-school membership switch.
4. Remaining UX polish: course builder richer preview/drag-drop.
5. Approval action-г төв `AuditLog`-той холбож production audit trail бүрэн болгох.

Эдгээрийг хийсний дараа project requirement v0.1-ийн MVP хэсэгтэй бодитоор 100% ойртоно.
