# API Documentation And Developer Experience

## OpenAPI Contract

- Gateway serves Swagger UI at `/api-docs` and raw OpenAPI at `/openapi.json`.
- `npm run openapi:inventory` scans service route files and writes:
  - `docs/api-route-inventory.generated.json`
  - `gateway/src/openapi-route-inventory.generated.ts`
- `npm run openapi:validate` checks every gateway route operation is represented in the OpenAPI contract inventory.
- `npm run openapi:export` writes `openapi.generated.json` after gateway build.

Every operation carries method, path, service owner, auth mode, and role metadata in `x-routeInventory`. Detailed hand-authored schemas remain in `gateway/src/openapi.ts`; new routes must update examples, request/response shape, and errors before merge.

## Schemas, Examples, Errors

All responses use the envelope:

```json
{ "success": true, "data": {} }
```

Errors use:

```json
{ "success": false, "code": "VALIDATION_ERROR", "message": "Invalid request", "errors": {} }
```

Standard codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.

## API Client Types

Run:

```bash
npm run api:types
```

This writes `generated/api-client.d.ts` with the `ApiOperation`, `ApiEnvelope<T>`, and `ApiErrorCode` types used by frontend or SDK codegen.

## Developer Checklist

- Add or update service route.
- Add Zod validation for params/query/body.
- Regenerate inventory and API operation types.
- Add OpenAPI detailed schema/example for public or user-facing routes.
- Run `npm run openapi:validate`, `npm run test`, and affected E2E tests.
