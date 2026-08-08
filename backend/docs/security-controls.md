# Security control baseline

This is an engineering control matrix, not an OWASP certification or a legal
compliance attestation. Release owners must attach CI, penetration-test and
deployment evidence for the target environment.

The baseline is OWASP ASVS 5.0.0 and the OWASP API Security Top 10 (2023):

- <https://owasp.org/www-project-application-security-verification-standard/>
- <https://owasp.org/API-Security/editions/2023/en/0x04-release-notes/>

## Implemented application controls

| Control | Implementation and regression evidence |
|---|---|
| Tenant isolation / API1 BOLA / IDOR | `authMiddleware` verifies signed tenant claims; `tenantMiddleware` ignores client tenant headers; academic records carry `organizationId`; every object lookup must include it. `security-privacy.regression.test.ts` fails if a tenant academic model loses the field. Guardian lookup was corrected to include the tenant. |
| Horizontal and vertical authorization | Resource services combine `organizationId`, acting `userId`, enrollment/guardian/teacher ownership, and `requireRole`. `shared.middleware.test.ts` exercises untrusted tenant headers and student-to-admin escalation. |
| Broken authentication | Short access tokens, hash-only rotating refresh tokens, reuse detection, session revocation, generic login errors, IP/account throttling, password policy, email/phone verification, OAuth state + PKCE + one-time exchange. |
| API3 object property authorization | Strict Zod schemas reject unknown/tenant-owned fields. Response DTOs select safe fields and never return password/token hashes. |
| API4 resource consumption | Global IP limit; tenant/role/user/normalized-endpoint limit; tighter register, login, recovery, OAuth, upload, notification and bulk limits; payload/array/file size ceilings. |
| API5 function authorization | Route-level roles plus ownership checks; public gateway allowlist is explicit and defaults to authenticated. |
| API6 sensitive business flow abuse | Register/onboarding/login/recovery/OAuth/bulk notification and upload have purpose-specific limits and idempotency where applicable. Quiz audit and event audit preserve high-stakes extension points. |
| API7 SSRF | User URLs are validated and are not fetched server-side. Service and scanner destinations come only from validated deployment configuration. Add an egress allowlist at the network layer. |
| API8 misconfiguration | Helmet CSP/HSTS/referrer headers, Permissions-Policy, no `X-Powered-By`, exact-origin credentialed CORS, generic errors, production HTTPS/TLS fail-fast validation. Frontend `_headers` supplies browser policy for compatible hosts. |
| API9 inventory | Gateway proxy routes and OpenAPI are source-controlled. Events use a versioned envelope and contract tests. Owners must inventory deployed versions and remove obsolete routes. |
| API10 unsafe API consumption | Internal calls use short-lived service JWTs, timeouts, validated responses and configured HTTPS when internal TLS is enabled. Provider webhooks require a constant-time shared-secret check. |
| XSS | Server lesson HTML allowlist (`sanitize-html`), client defense-in-depth (`DOMPurify`), JSON escaping, non-reflective 404s, CSP, and regression tests. See OWASP guidance: <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>. |
| SQL injection | Prisma parameterized APIs and strict input validation; CI regression fails on unsafe raw-query APIs. |
| CSRF | Refresh auth uses Secure/HttpOnly/SameSite cookies and all unsafe auth methods require a signed double-submit CSRF cookie/header pair. Tests cover missing, malformed and valid tokens. |
| Secure files | Extension + allowlisted MIME + magic-byte agreement, size cap, safe generated tenant key, malware scanner fail-closed in production, and signed URL maximum 15-minute expiry. See OWASP guidance: <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>. |
| Audit/privacy | Safe auth audit metadata, masked exported IPs, CSV export with spreadsheet-injection defense, retention jobs, self-service JSON export, account anonymization event fan-out. |
| Supply chain | Locked installs, high-severity `npm audit`, prohibited-license gate, Dependency Review, Dependabot, CodeQL and Gitleaks workflows. |

## Tenant isolation review rule

For every new tenant resource, the pull request must include:

1. `organizationId` in schema, unique keys and useful indexes.
2. Read, update and delete predicates containing the trusted JWT tenant.
3. Ownership/enrollment/guardian scope for non-admin readers.
4. A cross-tenant ID test returning 404 (preferred to avoid resource discovery).
5. A lower-role mutation test returning 403.
6. No `organizationId` accepted from a body/header as authority.

Infrastructure tables such as an event inbox may omit `organizationId` only when
the event envelope is validated and the table contains no domain resource.

## Release evidence still required

- Independent authenticated API penetration test, including every resource ID,
  role pair, batch endpoint, indirect relation and alternate HTTP method.
- Browser CSP report-only observation before enforcing a changed policy.
- Object-store policy proving private-by-default buckets and signed URL enforcement.
- Malware scanner EICAR test in an isolated non-production tenant.
- Service mesh/private-PKI evidence for HTTPS, `rediss`, `amqps`, PostgreSQL
  certificate verification and certificate rotation.
- Database/storage encryption-at-rest and backup restore evidence.
- External privacy/legal review for each operating jurisdiction.
