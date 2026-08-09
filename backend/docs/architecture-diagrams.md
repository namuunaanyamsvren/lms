# Architecture And Domain Diagrams

## Runtime Architecture

```mermaid
flowchart LR
  FE[Frontend] --> GW[API Gateway]
  GW --> AUTH[auth-service]
  GW --> ORG[organization-service]
  GW --> ACAD[academic-service]
  GW --> BILL[billing-service]
  GW --> NOTIF[notification-service]
  AUTH --> PGA[(PostgreSQL auth schema)]
  ORG --> PGO[(PostgreSQL organization schema)]
  ACAD --> PGAC[(PostgreSQL academic schema)]
  BILL --> PGB[(PostgreSQL billing schema)]
  NOTIF --> PGN[(PostgreSQL notification schema)]
  AUTH --> REDIS[(Redis)]
  NOTIF --> MQ[(RabbitMQ)]
  ACAD --> MQ
  BILL --> MQ
  BILL --> OBJ[Object storage + CDN]
```

## ERD / Domain Ownership

```mermaid
erDiagram
  ORGANIZATION ||--o{ USER_ACCOUNT : owns
  ORGANIZATION ||--o{ COURSE : owns
  ORGANIZATION ||--o{ COHORT : owns
  COURSE ||--o{ MODULE : contains
  MODULE ||--o{ LESSON : contains
  COURSE ||--o{ COHORT : schedules
  COHORT ||--o{ ENROLLMENT : has
  USER ||--o{ ENROLLMENT : joins
  USER ||--o{ GUARDIAN : parent
  USER ||--o{ SUBMISSION : submits
  ASSIGNMENT ||--o{ SUBMISSION : receives
  SUBMISSION ||--o{ GRADE : assessed_by
  QUIZ ||--o{ QUIZ_ATTEMPT : attempted_by
  USER ||--o{ ATTENDANCE : receives
  ORGANIZATION ||--o{ INVOICE : bills
  INVOICE ||--o{ PAYMENT : paid_by
  USER ||--o{ NOTIFICATION : receives
```

Ownership boundaries:

- `auth-service`: identity, sessions, refresh rotation, audit events.
- `organization-service`: tenant lifecycle, branding, settings, domain verification.
- `academic-service`: courses, cohorts, schedules, assignments, quizzes, grades, attendance, certificates, student documents.
- `billing-service`: subscriptions, invoices, payments, checkout/webhook idempotency.
- `notification-service`: delivery queue, preferences, templates, read/delete state.
