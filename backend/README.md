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

## 🚀 API Gateway Routing

| Endpoint Pattern | Target Microservice | Target Port |
| :--- | :--- | :--- |
| `/api/auth/*` | `auth-service` | `8001` |
| `/api/organizations/*` | `organization-service` | `8002` |
| `/api/users/*` | `academic-service` | `8003` |
| `/api/courses/*` | `academic-service` | `8003` |
| `/api/cohorts/*` | `academic-service` | `8003` |
| `/api/assignments/*` | `academic-service` | `8003` |
| `/api/quizzes/*` | `academic-service` | `8003` |
| `/api/attendance/*` | `academic-service` | `8003` |
| `/api/grades/*` | `academic-service` | `8003` |
| `/api/payments/*` | `billing-service` | `8004` |
| `/api/notifications/*` | `notification-service` | `8005` |

---

## ⚡ Getting Started (Local with Docker)

### 1. Prerequisites
- Docker & Docker Compose installed
- Node.js (>= v18)

### 2. Run with Docker Compose
```bash
cd backend
docker-compose up --build
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
