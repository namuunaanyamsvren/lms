# Sensitive-column encryption assessment

Assessment date: 2026-07-30. Review at least annually and after adding a new
identity, health, payment, child, proctoring or biometric field.

## Current decisions

| Data | Current protection | Decision |
|---|---|---|
| Passwords | bcrypt one-way hash | Appropriate; never encrypt or log plaintext. |
| Refresh/reset/verification tokens | HMAC/hash only | Appropriate; raw values exist only at issuance/client. |
| OAuth client, JWT, CSRF, OTP and file-signing secrets | Runtime secret manager/environment | Keep outside source/database; rotate using the secret runbook. |
| Email, phone, name | Database/storage encryption at rest, TLS in transit, tenant RBAC/audit | Application column encryption deferred because equality lookup and unique constraints are core. Compensating controls are data minimization, restricted DB roles, masked exports/logs and retention. Reassess deterministic blind-index + envelope encryption if threat model or law requires it. |
| Student submissions, essay answers, guardian links | Tenant/ownership access, TLS and encrypted storage | High sensitivity. Do not index externally by default. Consider per-tenant envelope keys for deployments handling regulated minor/special-category data. |
| Provider recipients and push credentials | Restricted notification schema, deletion fan-out | Encrypt push `auth`/`p256dh` and recipient phone/email with KMS-backed envelope encryption before a high-risk production deployment. This is the highest remaining column-encryption priority. |
| Billing | No card PAN/CVV model | Continue using provider tokenization. Never add PAN/CVV columns. Transaction identifiers should be treated as confidential. |
| Files | Private object key, malware admission, short signed URL | Require provider encryption at rest; use customer-managed per-tenant keys only when contract/risk requires it. |

## Required deployment controls

- Managed KMS/HSM with separate production keys, least-privilege decrypt roles,
  key-use audit, rotation and recovery procedure.
- TLS certificate verification for database, Redis, RabbitMQ, services and object
  storage; production startup checks reject insecure configuration when
  `REQUIRE_INTERNAL_TLS=true`.
- Encrypted backups and replicas, tested key restoration, and key destruction
  aligned with retention.
- Database accounts per service/schema; no shared human credentials.
- Logs, traces, analytics and error tools must reject tokens, secrets, message
  bodies and raw child/student PII.

Field-level encryption must never reuse JWT/file-signing secrets. Store ciphertext
version, key identifier and nonce; authenticate tenant/resource identifiers as AAD;
support dual-read key rotation and failure-safe migration.
