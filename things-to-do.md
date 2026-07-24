# Backend To-Do (LMS)

Backend-ийн одоогийн байдал (2026-07-23-нд шалгасан). Микросервис бүрийг **хийгдсэн** / **хийгдээгүй** гэж ангилав. Эх сурвалж: `backend/*/src` кодыг бодитоор уншиж шалгасан дүн.

---

## Ерөнхий дүн зураг

- Infrastructure (docker-compose, Prisma schema, `shared` package) их хэмжээгээр бэлэн, гэхдээ бодит бизнес логик хамгийн бага хэсэг нь.
- 6 сервисээс **3 нь бараг хоосон** (зөвхөн `/health` route-той): billing, notification, organization.
- Зөвхөн **login/register** л бодитоор DB-д бичдэг; бусад бүх зүйл READ-only эсвэл байхгүй.
- `backend/shared` дотор бэлэн auth/tenant/error/event/logging модулиуд байгаа ч **нэг ч сервис ашигладаггүй**.

---

## 1. auth-service — хамгийн бэлэн ✅ 2026-07-23-нд бүх 8 зүйл хийгдсэн

### Хийгдсэн
- [x] `register`, `login`, `getMe` — zod validation, bcrypt, JWT ашигласан (`auth.controller.ts`)
- [x] **Refresh-token flow бүрэн хийгдсэн**: `@lms/shared`-ийн `signAccessToken`/`signRefreshToken`/`verifyRefreshToken`-г ашиглаж, access token 15 мин, refresh token 7 хоног болсон. `POST /api/auth/refresh` нэмэгдсэн — refresh token-г `RefreshToken` prisma model-оос шалгаж (revoked/expired эсэх), хэрэглэх бүрдээ **rotate** хийдэг (хуучныг revoke, шинийг үүсгэдэг). `register`/`login` хариу нь `token` (access, frontend-тэй backward-compat) + `refreshToken` хоёуланг буцаадаг.
- [x] **`POST /api/auth/logout`** нэмэгдсэн — өгөгдсөн refresh token-г DB дээр revoke хийдэг.
- [x] **Нууц үг сэргээх flow** (`forgot-password` / `reset-password`) хийгдсэн — шинэ `PasswordResetToken` model (sha256-хэшлэсэн token, 1 цагийн хугацаатай, нэг удаа ашиглагддаг). Имэйл үйлчилгээ (notification-service) байхгүй тул raw token-г зөвхөн `NODE_ENV !== production` үед хариунд буцааж, сервер талд `console.log`-оор "илгээдэг" (жинхэнэ имэйл илгээхийг дараа notification-service бэлэн болоход холбох хэрэгтэй). Нууц үг сэргээхэд тухайн хэрэглэгчийн бүх refresh token автоматаар revoke болно (хаа сайгүй дахин нэвтрэх шаардлагатай болно). Email enumeration-с хамгаалж, бүртгэлтэй эсэхээс үл хамааран ижил хариу буцаадаг.
- [x] **Имэйл/утас баталгаажуулах flow** хийгдсэн — шинэ `VerificationToken` model + `VerificationType` enum (EMAIL/PHONE), `UserAccount`-д `isEmailVerified`/`isPhoneVerified` талбар нэмэгдсэн. Бүртгүүлэх үед автоматаар EMAIL token үүсдэг; `POST /api/auth/send-verification` (auth шаардана) дахин илгээх/PHONE token авах; `POST /api/auth/verify` token-оор баталгаажуулна. Мөн л жинхэнэ имэйл/SMS илгээдэггүй (notification-service бэлэн биш) — dev горимд token-г хариунд буцаадаг.
- [x] **`getMe`-д `@lms/shared`-ийн `authMiddleware` ашиглах болсон** — гараар JWT parse хийдэг байсныг арилгасан (`routes/auth.routes.ts`-д `router.get('/me', authMiddleware, getMe)`).
- [x] **`routes/index.ts` dead code устгагдсан.**
- [x] **`normalizeRole`**: тодорхойгүй role утга ирвэл чимээгүй STUDENT болгохын оронд `AppError.badRequest`-ээр 400 шиднэ (практикт zod validator аль хэдийн зөвшөөрөгдсөн жагсаалтаар шүүдэг тул хос давхар хамгаалалт).
- [x] **`/login`-д rate-limit нэмэгдсэн** (`express-rate-limit`: IP тутам 15 минутад 10 оролдлого) — мөн шинээр нэмсэн `/forgot-password`-д илүү хатуу лимит (5/15мин) тавьсан.

**Замдаа олдсон, шалгах явцад засагдсан нэмэлт алдаанууд:**
- `@lms/shared` package дотор **давхардсан, зөрчилдсөн код** байсныг илрүүлж засав: `jwt/index.ts`, `errors/index.ts`, `middlewares/index.ts` тус бүр өөрийн сул хувилбарыг (нэг secret-тэй JWT, factory-гүй AppError, header-based tenant middleware) экспортолж байсан бол ижил фолдер доторх илүү сайн хийгдсэн хувилбарууд (`jwt.ts`, `AppError.ts`, `authMiddleware.ts`/`tenantMiddleware.ts`) огт reachable биш, package-ийн barrel export-д холбогдоогүй байв. Эдгээрийг нэгтгэж, сайн хувилбаруудыг л экспортлохоор засав (өөр ямар ч сервис shared-г ашигладаггүй байсан тул аюулгүй өөрчлөлт). Мөн `types/express.d.ts` (req.user typing) `.ts`-рүү нэрлээд, `types/index.ts`-д export нэмж, `tsc` build хийхэд dist-д орохгүй байсан асуудлыг засав.
- **JWT давхардал bug**: refresh token-г шууд JWT string хэлбэрээр DB-ийн `token` (unique) баганад хадгалдаг тул ижил хэрэглэгчид **ижил секундэд** 2 удаа token гаргавал (жишээ нь register дараа шууд login) JWT bytes яг ижил гарч, DB unique constraint зөрчигддөг байв (`P2002` алдаа). `jti` (random UUID) claim нэмж засав.
- **Stack trace leak bug**: `authMiddleware`-г нэмэхэд token байхгүй/буруу үед Express-ийн default error handler ажиллаж, бүтэн server-side stack trace-г HTML хэлбэрээр клиент рүү алддаг байв (`index.ts`-д `@lms/shared`-ийн `errorHandler`/`notFoundHandler` холбогдоогүй байсан). `index.ts`-д эдгээрийг сүүлд нь mount хийж засав.

**Шалгасан байдал**: локал ts-node орчинд docker дээрх postgres-той холбогдож (register→verify-email→login→me→refresh(rotate)→refresh(хуучин token-оор, 401 болохыг батал)→logout→forgot-password→reset-password→шинэ нууц үгээр login→хуучин нууц үгээр login (401)→rate-limit (10 оролдлогын дараа 429)→invalid role (400)) бүх сценарийг curl-аар дараалан шалгасан, бүгд зөв ажиллаж байгааг баталгаажуулсан. **Full `docker compose up --build` асуудлыг ажиллуулж бодит контейнер орчинд эцсийн шалгалт хийгээгүй** (хэрэглэгч тухайн алхмыг зогсоосон) — зөвхөн `docker-compose.yml`-ийн auth-service env хэсэгт шинэ `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`-г нэмсэн төдий, contain-жүүлсэн орчинд ажиллуулж баталгаажуулах алхам үлдсэн.

---

## 2. academic-service — зөвхөн унших боломжтой (READ-only)

### Хийгдсэн
- [x] 8 GET endpoint: courses, courseById, cohorts, assignments, quizzes, attendance, grades, users (`routes/index.ts:16-35`)

### Хийгдээгүй
- [ ] **POST/PUT/DELETE огт байхгүй** — course үүсгэх, суралцагч бүртгэх (enroll), даалгавар илгээх (submit assignment), дүн тавих (grade), quiz attempt, ирц тэмдэглэх зэрэг бичих үйлдэл нэг ч байхгүй
- [ ] Prisma schema-д 19 model байгаагаас зөвхөн 7-г нь controller хэрэглэдэг — `Certificate`, `Invoice`, `Payment`, `Notification`, `AuditLog` model-үүдэд controller/route огт байхгүй
- [ ] **Аюулгүй байдлын алдаа**: `getOrgId` нь клиентийн `x-organization-id` header-ийг баталгаажуулалгүй итгэдэг (`academic.controller.ts:6-9`) — өөр organization-ийн course/grade/attendance/users-г уншиж чадна (tenant isolation алдагдсан)
- [ ] Route-үүд дээр **authentication middleware огт байхгүй** — бүх 7 endpoint нээлттэй, token шаардахгүй
- [ ] Input validation байхгүй (`getCourseById`-ийн `:id`, бусад query параметрүүд)
- [ ] `index.ts` router-г `/api` болон `/` хоёуланд нь mount хийсэн — илүүдэл/цэвэрлэх
- [ ] Алдааны хариу бүрд raw Prisma error message-г клиент рүү шууд алддаг (internal-ийг задруулах эрсдэлтэй)

---

## 3. gateway — зөвхөн proxy, магадгүй эвдэрсэн

### Хийгдсэн
- [x] 10 path prefix-г тохирох сервис рүү proxy хийдэг тохиргоо бичигдсэн (`routes/index.ts:21-39`)
- [x] **Routing bug засагдсан** (2026-07-23): `router.use(path, createProxyMiddleware(...))` хэлбэрээр бичсэн байсан тул Express mount path-г `req.url`-с автоматаар хасдаг байсан (жишээ нь `/api/auth/login` → `/login`), доод түвшний сервис бүгд бүтэн prefix-ээ хүлээдэг тул (`/api/auth/login`) proxy хийсэн бүх хүсэлт 404 өгдөг байсан. `createProxyMiddleware(path, options)` хэлбэрт шилжүүлж, path-ийг Express router.use-д биш http-proxy-middleware-ийн context болгож дамжуулснаар бүтэн зам хадгалагдах болсон (`gateway/src/routes/index.ts`). curl-аар GET болон POST (login) хоёуланг нь gateway болон шууд сервис рүү харьцуулж шалгасан — хариу яг адилхан болсныг баталгаажуулсан.
- [x] **Нэмэлт bug олж засав**: `gateway/src/index.ts`-д `app.use(express.json())`-г бүх route дээр global байдлаар дуудсан тул proxy-д хүрэхээс өмнө POST/PUT body stream-г уншиж хоосруулдаг байсан — үүнээс болж login/register зэрэг бичих хүсэлт бүрэн зогсдог (hang) байсан (доод сервис body хүлээгээд хэзээ ч авахгүй). Gateway өөрөө req.body ашигладаггүй (зөвхөн proxy) тул `express.json()`-г бүрмөсөн хассан.

### Хийгдээгүй
- [ ] JWT баталгаажуулалт gateway дээр байхгүй
- [ ] Rate limiting, request logging (morgan), helmet security header суулгасан ч ашиглагдаагүй
- [ ] `/api/users` academic-service рүү proxy хийгддэг ч хэрэглэгчийн бодит мэдээлэл auth-service дотор байгаа — API бүтэц зөрчилтэй
- [ ] JWT баталгаажуулалт gateway дээр байхгүй
- [ ] Rate limiting, request logging (morgan), helmet security header суулгасан ч ашиглагдаагүй
- [ ] `/api/users` academic-service рүү proxy хийгддэг ч хэрэглэгчийн бодит мэдээлэл auth-service дотор байгаа — API бүтэц зөрчилтэй

---

## 4. billing-service — бараг бүрэн хоосон

### Хийгдсэн
- [x] `/health` endpoint
- [x] Prisma schema сайн зохион байгуулагдсан (`Subscription`, `Invoice` + `pdfR2Url`, `PaymentStatus`/`PlanType` enum)

### Хийгдээгүй
- [ ] Controller, service, middleware, validator, events — эдгээр фолдер бүгд хоосон
- [ ] Subscription үүсгэх/upgrade хийх endpoint байхгүй
- [ ] Invoice үүсгэх endpoint байхгүй
- [ ] Payment webhook боловсруулах логик байхгүй
- [ ] Cloudflare R2 storage холболт (`.env.example`-д тодорхойлсон ч код байхгүй) — invoice PDF хадгалах
- [ ] Gateway `/api/payments`-г энд proxy хийдэг ч тохирох route байхгүй → 404
- [ ] Seed data байхгүй

---

## 5. notification-service — бараг бүрэн хоосон

### Хийгдсэн
- [x] `/health` endpoint
- [x] Prisma schema (`Notification` + `NotificationType` enum: EMAIL/IN_APP/PUSH)

### Хийгдээгүй
- [ ] Controller/service/events/middleware — бүгд хоосон
- [ ] SMTP/имэйл илгээх код байхгүй (`.env.example`-д SMTP тохиргоо байгаа ч ашиглагдаагүй)
- [ ] `EVENTS.NOTIFICATION_SEND` events catalog-д тодорхойлогдсон ч publish/consume хийгддэггүй
- [ ] Gateway `/api/notifications`-г proxy хийдэг ч route байхгүй → 404
- [ ] Frontend `NotificationDropdown` компонент бодит датагүй, үргэлж "No new notifications" харуулдаг (backend холбогдоогүй)

---

## 6. organization-service — бараг бүрэн хоосон

### Хийгдсэн
- [x] `/health` endpoint
- [x] Prisma schema (`Organization`, `OrgSettings`: branding, allowRegister, maxUsers)

### Хийгдээгүй
- [ ] Controller/service — бүгд хоосон, organization CRUD байхгүй
- [ ] Multi-tenant onboarding (SaaS-ийн гол feature) — бүрэн байхгүй
- [ ] `seed.ts`-д organization-ийг **academic-service-ийн давхардсан Organization model**-д л үүсгэдэг — organization-service-ийн өөрийн DB-г огт seed хийдэггүй
- [ ] Branding/тохиргоо (өнгө, max users, бүртгэл нээх/хаах) удирдах UI/API байхгүй
- [ ] Gateway `/api/organizations`-г proxy хийдэг ч route байхгүй → 404

---

## 7. `backend/shared` — бэлэн ч ашиглагдаагүй

### Хийгдсэн (бичигдсэн, тест хийгдээгүй)
- [x] `authMiddleware.ts` — JWT auth + `requireRole()` RBAC
- [x] `tenantMiddleware.ts` — JWT-с organizationId гаргаж авдаг зөв tenant isolation (academic-service-ийн header vulnerability-г засах гарц энэ)
- [x] `errorHandler.ts`, `requestLogger.ts`
- [x] `errors/AppError.ts` — typed HTTP error class
- [x] `jwt/jwt.ts` — access/refresh token sign хийх
- [x] `rabbitmq/{connection,consumer,publisher}.ts`, `redis/client.ts`
- [x] `constants/events.ts` — бүрэн event catalog (11 event)

- [x] **(2026-07-23) `jwt/index.ts`, `errors/index.ts`, `middlewares/index.ts` barrel export-уудын давхардал засагдсан.** Эдгээр 3 файл өмнө нь дээрх сайн хийгдсэн (`jwt.ts`, `AppError.ts`, `authMiddleware.ts`/`tenantMiddleware.ts`) модулиудыг экспортлохын оронд package-ийн жинхэнэ export chain-д огт холбогдоогүй, өөрийн сул/давхардсан хувилбарыг л экспортолж байсныг илрүүлж, зөв модулиудыг re-export хийхээр засав (`auth-service`-г шинэчлэх явцад олдсон). Одоо `import { authMiddleware, signAccessToken, AppError, ... } from '@lms/shared'` бодитоор ажиллана.
- [x] **auth-service `@lms/shared`-г dependency болгон нэмж, бодитоор ашиглаж эхэлсэн** (authMiddleware, errorHandler, notFoundHandler, signAccessToken/signRefreshToken/verifyRefreshToken, AppError).

### Хийгдээгүй
- [ ] Бусад 5 сервис (academic, organization, billing, notification, gateway) hараа `@lms/shared`-г dependency болгож нэмээгүй, импортлоогүй хэвээр — зөвхөн auth-service л одоогоор ашиглаж байна
- [ ] `logger/`, `redis/`, `rabbitmq/` фолдер тус бүрт мөн адил давхардсан barrel export бий (жишээ нь `redis/index.ts`-ийн `RedisClient` skeleton stub, `redis/client.ts`-ийн бодит `ioredis`-той холбогддог хувилбар хоёул байгаа ч зөвхөн skeleton нь export-логдож байгаа) — энэ удаад зөвхөн auth-service-д шаардлагатай jwt/errors/middlewares хэсгийг л засварласан, logger/redis/rabbitmq хэсгийг цэвэрлээгүй
- [ ] Бүх сервисийн `src/events/` фолдер хоосон — event нэг ч тал publish/consume хийдэггүй
- [ ] docker-compose дээр RabbitMQ, Redis container ажиллаж байгаа ч ямар ч сервис холбогддоггүй (`amqplib`, `ioredis`/`redis` package зэрэг импортлогдоогүй)

**Дараах ажлыг хийвэл олон асуудал зэрэг шийдэгдэнэ:** `@lms/shared`-г бусад сервист дээ dependency болгон нэмж, `authMiddleware`, `tenantMiddleware`, `errorHandler`, `requestLogger`-г холбох; auth-service-с `USER_CREATED` event publish хийж, academic/notification-service-ээр consume хийлгэх.

---

## 8. Frontend ↔ Backend зөрүү

### Хийгдсэн
- [x] Admin/Student/Teacher хэсгүүд academic-service-ийн GET endpoint-уудыг дуудаж бодит дата харуулдаг

### Хийгдээгүй
- [ ] Frontend gateway-г огт ашигладаггүй — `api.js` нь `localhost:8003` (academic), `AuthContext.jsx` нь `localhost:8001` (auth) руу тус тусад нь шууд хандаж байна; нэгдсэн configurable API base URL байхгүй
- [ ] Ямар ч хүсэлт дээр `Authorization: Bearer <token>` эсвэл `x-organization-id` header холбогдоогүй (одоогоор academic-service auth шалгадаггүй болохоор "ажиллаж байгаа мэт" харагдаж байгаа)
- [ ] **Parent, Principal, Staff** dashboard-ууд 100% hardcoded mock дата ашигладаг — backend холболт огт байхгүй
- [ ] Course/assignment/grade/attendance үүсгэх/засах форм байхгүй (`components/forms` фолдер хоосон) — учир нь backend-д ч write endpoint байхгүй
- [ ] Route guard (auth шалгаж хамгаалсан route) байхгүй — `/admin`, `/teacher` гэх мэт хэн ч чөлөөтэй орох боломжтой

---

## 9. Тест, tooling, DevOps

### Хийгдээгүй
- [ ] Тест framework огт суулгаагүй (jest/mocha/vitest байхгүй), `__tests__`/`*.test.ts` файл нэг ч байхгүй
- [ ] Swagger/OpenAPI баримт бичиг байхгүй (`swagger-ui-express` суулгасан ч ашиглагдаагүй)
- [ ] `helmet`, `express-rate-limit`, `morgan`, `cookie-parser`, `multer` бүгд package.json-д байгаа ч нэг ч сервисд ашиглагдаагүй
- [ ] `dist/` фолдер эх кодтой хамт commit хийгдсэн, зарим нь `src`-тэй нийцэхгүй (хуучирсан) — `.gitignore`-д нэмэх, цэвэрлэх шаардлагатай

---

## 10. Seed data

### Хийгдсэн
- [x] `seed.js` — academic + auth schema-д Organization, 6 role-ийн User, 2 Course, Cohort+Enrollment, Assignment+Submission+Grade, Quiz+Question+Attempt, Attendance, Notification үүсгэдэг (ажилладаг хувилбар)

### Хийгдээгүй
- [ ] `seed.ts` эвдэрсэн — байхгүй `@prisma/client`-с import хийж байна (зөв нь `@prisma/client-auth`, `@prisma/client-academic` гэх мэт custom output path). `seed.js`-тэй нийцүүлж засах эсвэл `seed.ts`-г эх сурвалж болгож `seed.js`-г дахин generate хийх
- [ ] organization-service, billing-service, notification-service-ийн өөрийн schema-д seed data байхгүй
- [ ] academic-service-ийн `Certificate`, `Invoice`, `Payment`, `AuditLog` model-үүд seed хийгдээгүй

---

## Тэргүүлэх дараалал (санал)

1. ~~**Gateway proxy bug шалгаж засах**~~ ✅ 2026-07-23-нд хийгдсэн (path-stripping bug + express.json() hang bug хоёуланг нь засав)
2. **`@lms/shared` middleware-г бүх сервист холбох** (auth + tenant isolation) — academic-service-ийн аюулгүй байдлын цоорхойг таглана
3. **academic-service-д write endpoint нэмэх** (enroll, submit, grade, attendance) — LMS-ийн үндсэн функц эдгээрээс шалтгаална
4. **auth-service-д refresh token + logout нэмэх**
5. **organization-service, billing-service, notification-service-ийг үндсэн CRUD-аар хийх** (эсвэл MVP-д хэрэггүй бол scope-с хасаж, docker-compose/package.json-с хасах шийдвэр гаргах)
6. **Frontend-г gateway рүү шилжүүлж, auth header холбох**
