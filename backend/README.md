# Multi-Tenant SaaS LMS Backend (Microservices Architecture)

Production-ready Learning Management System (LMS) backend built using Node.js, Express.js, TypeScript, PostgreSQL, Prisma ORM, RabbitMQ, Redis, Zod, JWT, Cloudflare R2, Swagger, and Docker.

---

## 🏛 Architecture Overview

```
                        +----------------------+
                        |     API Gateway      | (Port 8000)
                        +----------+-----------+
                                   |
         +-----------------+-------+-------+-----------------+-----------------+
         |                 |               |                 |                 |
+--------v--------+ +------v-------+ +-----v-------+ +-------v-------+ +-------v-------+
|  Auth Service   | | Organization | |  Academic   | |Billing Service| | Notification  |
|   (Port 8001)   | |  (Port 8002) | | (Port 8003)  | |  (Port 8004)  | |  (Port 8005)  |
+--------+--------+ +------+-------+ +-----+-------+ +-------+-------+ +-------+-------+
         |                 |               |                 |                 |
         +-----------------+---------------+-----------------+-----------------+
                                           |
                +--------------------------+--------------------------+
                |                          |                          |
       +--------v--------+        +--------v--------+        +--------v--------+
       |   PostgreSQL    |        |     Redis       |        |    RabbitMQ     |
       |   (Port 5432)   |        |   (Port 6379)   |        |   (Port 5672)   |
       +-----------------+        +-----------------+        +-----------------+
```

---

## 🏢 Multi-Tenancy Architecture

- Data Isolation: Every entity in business domain models includes `organizationId`.
- Context Extraction: Requests to microservices pass tenant identity via the `x-organization-id` HTTP header or embedded in JWT tokens.
- Strict DB Schema separation per service or isolated queries by `organizationId`.

---

## 📁 Repository Structure

```
backend/
├── gateway/                 # API Gateway (Route proxies, Auth verification, Rate limiting)
├── auth-service/            # Authentication & Identity (JWT, Users, Password Reset)
├── organization-service/    # Tenant & Subscription Management
├── academic-service/        # Courses, Cohorts, Quizzes, Attendance, Grades, Certificates
├── notification-service/    # Email, In-app & Push Notifications via RabbitMQ
├── billing-service/         # Billing, Subscriptions, Cloudflare R2 invoices
├── shared/                  # Shared utilities, JWT, RabbitMQ, Redis, Middlewares, Logger, Errors
├── docker-compose.yml       # Container orchestration
└── README.md                # Project documentation
```

---

## 🚀 Quick Start

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run build
npm run test
npm run openapi:validate
```

Run the local stack:

```bash
npm run docker:up
```

Swagger UI is available at `http://localhost:8000/api-docs`; raw OpenAPI is
available at `http://localhost:8000/openapi.json`.

Demo tenant and account details are in `docs/local-setup-seed.md`.

---

## 🚀 API Gateway Routing

| Endpoint Pattern | Target Microservice | Target Port |
| :--- | :--- | :--- |
| `/api/auth/*` | `auth-service` | `8001` |
| `/api/organizations/*` | `organization-service` | `8002` |
| `/api/users/*` | `auth-service` | `8001` |
| `/api/courses/*` | `academic-service` | `8003` |
| `/api/cohorts/*` | `academic-service` | `8003` |
| `/api/assignments/*` | `academic-service` | `8003` |
| `/api/quizzes/*` | `academic-service` | `8003` |
| `/api/attendance/*` | `academic-service` | `8003` |
| `/api/grades/*` | `academic-service` | `8003` |
| `/api/payments/*` | `billing-service` | `8004` |
| `/api/invoices/*` | `billing-service` | `8004` |
| `/api/notifications/*` | `notification-service` | `8005` |

---

## ⚡ Getting Started (Local with Docker)

### 1. Prerequisites
- Docker & Docker Compose installed
- Node.js (>= v22.12)

### 2. Run with Docker Compose
```bash
cd backend
docker-compose up --build
```

Each service runs `prisma migrate deploy` before it starts. To deploy all
service migrations from the host instead:

```bash
npm run prisma:deploy
```

Migration directories follow `YYYYMMDDHHMMSS_snake_case`; applied migrations
are immutable. Production uses only `prisma migrate deploy`—never `db push` or
`migrate reset`. See `docs/database-migration-integrity.md`.

For the self-hosted PostgreSQL profile, enable verified daily physical backups
and run an isolated recovery drill with:

```bash
npm run db:backup:start
npm run db:backup:once
npm run db:restore-drill
```

The Compose PITR profile archives WAL continuously. Production backup storage
must be encrypted and off-host; managed PostgreSQL should use the provider's
PITR service and export restore evidence.

For Google login, register this exact local authorized redirect URI in
Google Cloud Console:

```text
http://localhost:5173/auth/callback
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and
`FRONTEND_URL` in `backend/.env`. The frontend callback relays Google's
authorization response to the existing `/api/auth/google/callback` backend
route; token exchange and the client secret stay server-side. Never commit the
Google client secret.

For an existing installation that predates the billing and notification
migration histories, run this once before the normal deployment:

```bash
npm run prisma:baseline-legacy
npm run prisma:deploy
```

---

## 🎓 Academic Service Entities
The `academic-service` defines all 14 core entities with `organizationId`:
1. `Users`
2. `Courses`
3. `Modules`
4. `Lessons`
5. `Cohorts`
6. `Enrollments`
7. `Assignments`
8. `Submissions`
9. `Quizzes`
10. `Questions`
11. `QuizAttempts`
12. `Attendance`
13. `Grades`
14. `Certificates`

---

## RabbitMQ event contracts and operations

All published domain events use the versioned envelope
`eventId`, `eventType`, `version`, `occurredAt`, `traceId`,
`organizationId`, and `payload`. Publishers use RabbitMQ confirms;
database mutations use service-owned outbox tables, while consumers use
an inbox unique key on `(eventId, consumer)` for idempotency.

Failed handlers retry with exponential backoff and eventually move to a
consumer-specific dead-letter queue. Invalid envelopes and unsupported
contract versions are classified as poison events and go directly to
that dead-letter queue.

```bash
# Queue depth, retry depth, poison/DLQ depth and consumer count
npm run events:ops -- inspect academic-service.user-created

# Confirmed replay of up to 100 messages from the queue's DLQ
npm run events:ops -- replay academic-service.user-created 100
```

The runtime contract registry is in
`shared/src/rabbitmq/envelope.ts`; the portable JSON Schema is in
`shared/src/rabbitmq/contracts/event-envelope.v1.schema.json`.

---

## Developer Documentation

- API contract and generated client types: `docs/api-developer-experience.md`
- Architecture and ERD: `docs/architecture-diagrams.md`
- Event catalog: `docs/event-catalog.md`
- Environment variables: `docs/environment-reference.md`
- Local setup and seed: `docs/local-setup-seed.md`
- Migration guide: `docs/migration-guide.md`
- Testing guide: `docs/testing-guide.md`
- Deployment runbook: `docs/deploy-release-runbook.md`
- Contribution guide: `docs/contributing.md`
- Architecture decision record: `docs/adr/0001-platform-boundaries.md`
- Additional product capability roadmap: `docs/product-capability-roadmap.md`
