# Deploying: backend on Render, frontend on Vercel

First-pass deploy — optimized for "get it running," not full production hardening.
Known limitations of this pass are listed at the bottom.

Every service runs with `NODE_ENV=staging`, not `production`, on purpose:
`backend/shared/src/config/environment.ts` and `.../files/security.ts` hard-fail
at boot under `NODE_ENV=production` unless a real malware scanner, at-rest file
encryption, a Sentry DSN, and strict TLS-only URL schemes are all wired up —
none of which exist yet. `staging` is a supported value in the same schema and
skips those checks while keeping normal behavior otherwise. Revisit this before
a real production launch (see the limitations section).

## 0. Before you start

Have these ready (reuse values already in `deploy.env` if you have real ones):

- Google OAuth client ID + secret (Google Cloud Console)
- Twilio account SID / auth token / from-number (optional — skip and phone OTP just won't work yet)
- SMTP host/user/pass/from (optional — skip and email sending just won't work yet)

## 1. RabbitMQ — CloudAMQP

1. Create a free "Little Lemur" instance at cloudamqp.com.
2. Copy its AMQPS URL (starts with `amqps://`) — you'll paste it once in step 3.

## 2. Backend — Render Blueprint

1. Push `backend/render.yaml` to the branch Render will deploy from.
2. Render dashboard → **New** → **Blueprint** → select this repo. Render reads `backend/render.yaml` and lists every service it will create.
3. When prompted for `sync: false` values, fill in:
   - `lms-auth-service`: `RABBITMQ_URL` (from step 1), `TWILIO_*`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` = `https://placeholder.example.com/callback` for now (real value set in step 6, once the gateway URL is known).
   - `lms-billing-service`: leave `STRIPE_*`/`QPAY_*` blank (billing is off — `FEATURE_BILLING_ENABLED=false`).
   - `lms-notification-service`: `SMTP_*` if you have them, otherwise leave blank.
   - `lms-gateway`: `FRONTEND_URL` = `https://placeholder.example.com`, `ALLOWED_ORIGINS` = `https://placeholder.example.com`, `TENANT_BASE_DOMAIN` = `placeholder.example.com` — real values set in step 6, once the Vercel URL exists. (These three are required, non-empty fields for every service, so a placeholder avoids a blank-value crash loop in the meantime — every service that depends on them will keep restarting with "invalid environment" errors in its logs until step 6 is done, which is expected.)
4. Click **Apply**. Render provisions `lms-postgres`, `lms-redis`, and the 6 web services.

## 3. Backend — per-service DATABASE_URL (the one manual repeat)

All 5 services (not gateway) share one Postgres instance, separated by schema — this mirrors `backend/docker-compose.yml`. Blueprint syntax can't append a suffix to a generated connection string, so:

1. Render dashboard → `lms-postgres` → copy the **External Connection String**.
2. For each of `lms-auth-service`, `lms-organization-service`, `lms-academic-service`, `lms-billing-service`, `lms-notification-service`: open its **Environment** tab, set `DATABASE_URL` to that connection string with the matching suffix appended:
   - auth → `...?schema=auth`
   - organization → `...?schema=organization`
   - academic → `...?schema=academic`
   - billing → `...?schema=billing`
   - notification → `...?schema=notification`
3. Save — each save triggers a redeploy, which runs `prisma migrate deploy` before the service starts (already wired into each Dockerfile's `CMD`).

## 4. Backend — confirm service URLs

`render.yaml` copies each web service's Render-provided `RENDER_EXTERNAL_URL` into the corresponding `*_SERVICE_URL`. This preserves suffixes Render adds after a hostname collision (for example, `-klai`) and avoids manual proxy wiring. After changing an existing Blueprint, run **Sync Blueprint** and verify the updated values in each service's **Environment** page.

## 5. Frontend — Vercel

1. Vercel dashboard → **Add New Project** → import this repo → set **Root Directory** to `frontend`. Vercel auto-detects Vite (`npm run build`, output `dist`); `frontend/vercel.json` already handles the SPA rewrite.
2. Project → Settings → Environment Variables:
   - `VITE_API_BASE_URL` = your gateway's exact Render URL plus `/api/v1` (for example, `https://lms-gateway-klai.onrender.com/api/v1`)
   - `VITE_TENANT_BASE_DOMAIN` = your Vercel deployment domain (e.g. `your-app.vercel.app`)
   - `VITE_ENABLE_DEMO_LOGIN` = `false`
   - The legal/contact vars in `frontend/.env.example` (`VITE_LEGAL_ENTITY_NAME`, `VITE_PRIVACY_CONTACT_EMAIL`, `VITE_SUPPORT_EMAIL`, `VITE_LEGAL_EFFECTIVE_DATE`)
3. Deploy. Note the resulting URL, e.g. `https://your-app.vercel.app`.

## 6. Wire the two together

1. Render → `lms-gateway` → Environment: set `FRONTEND_URL` and `ALLOWED_ORIGINS` to your Vercel URL (e.g. `https://your-app.vercel.app`), and `TENANT_BASE_DOMAIN` to the same domain (e.g. `your-app.vercel.app`). These propagate automatically to the other 4 services via the Blueprint's `fromService` references — no need to repeat them.
2. Render → `lms-auth-service` → Environment: set `GOOGLE_REDIRECT_URI` to your exact gateway URL plus `/api/v1/auth/google/callback` (for example, `https://lms-gateway-klai.onrender.com/api/v1/auth/google/callback`).
3. Confirm `REFRESH_COOKIE_SAME_SITE=none` and `REFRESH_COOKIE_PATH=/api/v1/auth` on `lms-auth-service`; these are required when Vercel and Render use different sites.
4. Google Cloud Console → OAuth client → add that same URL to **Authorized redirect URIs**.
5. Save — affected services redeploy automatically.

## 7. Smoke test

```
curl https://<your-exact-gateway-host>/health
```

Should return 200. Then load your Vercel URL and exercise login end-to-end. Check each Render service's **Logs** tab for `prisma migrate deploy` succeeding followed by the server starting.

If a service crash-loops right after boot with an environment-validation error:

- **"must contain at least 256 bits of random base64url data"** (or similar min-length message): Render's auto-generated value for that secret came out shorter than the app requires. Open the service's Environment tab and replace the flagged var (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CSRF_SECRET`, `SERVICE_TOKEN_SECRET`, or `PHONE_OTP_HASH_SECRET`) with the output of `openssl rand -base64 32` — and if it's one of the shared ones (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SERVICE_TOKEN_SECRET`), update it on the service that generates it (gateway or auth-service per `render.yaml`'s comments) so the `fromService` copies on the other services pick up the new value too.

## Known limitations of this first pass

- **Free tier, chained cold starts**: web services sleep after 15 min idle (~30-60s cold start on the next request); the free Postgres instance auto-deletes after 30 days. Because gateway proxies to 5 other services that may *also* be asleep, the very first request after a period of idleness can time out before every service finishes waking — just retry it. Upgrade the relevant `plan:` fields in `render.yaml` when you're ready to keep this running for real.
- **`NODE_ENV=staging`, not `production`** (see top of this doc): TLS-only URL schemes, at-rest file encryption, and malware scanning are configured but not enforced. Before a real launch: switch to `NODE_ENV=production`, stand up a malware scanner and point `MALWARE_SCANNER_URL`/`MALWARE_SCAN_MODE=required` at it, set `FILE_STORAGE_AT_REST_ENCRYPTED=true` with real encryption in place, add `sslmode=require` to each `DATABASE_URL`, and set `SENTRY_DSN`.
- **Tenant subdomains**: `frontend/src/services/tenantResolution.js` resolves tenants from `<tenant>.<TENANT_BASE_DOMAIN>` or a `?tenant=` query param. Without a custom domain + wildcard DNS pointed at Vercel, real subdomains aren't available — use `https://your-app.vercel.app/login?tenant=<slug>` for now.
- **Billing and malware scanning are off** (`FEATURE_BILLING_ENABLED=false`, `MALWARE_SCAN_MODE=disabled`) pending real Stripe/QPay and malware-scanner setup.
- **SMS/email**: outbound SMS defaults to a mock provider whenever `NODE_ENV` isn't `production` (`auth-service/src/services/sms-provider.service.ts`), so phone OTP won't send real texts on this pass even with real Twilio creds filled in. Outbound email via SMTP does work if you filled in `SMTP_*`; if you skipped it, notification emails just won't send.
