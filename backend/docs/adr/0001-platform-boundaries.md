# ADR 0001: LMS Platform Boundaries

## Status

Accepted

## Context

The LMS needs tenant isolation, school operations, academic workflows, billing, notifications, and production operations without a single shared database model becoming a bottleneck.

## Decision

- Use service-owned schemas behind an API gateway.
- Use JWT access tokens and rotated refresh tokens owned by `auth-service`.
- Store tenant identity as `organizationId` on domain rows and derive request tenant context from verified identity, not client supplied headers.
- Keep billing owned by `billing-service`; checkout/webhook idempotency is handled there.
- Publish cross-service work through versioned RabbitMQ event envelopes with idempotent consumers.

## Consequences

- Cross-service reads require explicit APIs or events.
- OpenAPI and event contracts are required for developer velocity.
- Migrations are service-owned and deployed independently with shared release discipline.
