# Single Render Demo Deployment

Use this deployment mode for demo/staging when Render free-tier microservices
produce repeated `502 Bad Gateway` errors.

## What Changes

- One Render web service runs the public gateway.
- The same container starts these services on localhost:
  - auth-service: `127.0.0.1:8001`
  - organization-service: `127.0.0.1:8002`
  - academic-service: `127.0.0.1:8003`
  - notification-service: `127.0.0.1:8005`
- The gateway proxies to localhost instead of separate `*.onrender.com`
  upstream services.
- Prisma migrations run for each schema before the services start.

## Files

- `render.single.yaml`: Render blueprint for the single-service demo backend.
- `single-service/Dockerfile`: builds all backend workspaces into one image.
- `scripts/start-single-render.js`: migrates schemas and starts each service.

## Required Render Env Values

The blueprint generates the token and service secrets. Fill these manually:

- `FRONTEND_URL`: your Vercel URL, for example `https://lms-i3ha.vercel.app`
- `ALLOWED_ORIGINS`: same frontend URL, comma-separated if more than one
- `TENANT_BASE_DOMAIN`: frontend host, for example `lms-i3ha.vercel.app`
- `FILE_DOWNLOAD_BASE_URL`: the single backend URL after Render creates it

Optional:

- `RABBITMQ_URL`: set CloudAMQP if notification/event workers are needed.
  If omitted in staging, HTTP flows still start and workers log connection
  failures instead of taking down the demo backend.
- Google OAuth values can be filled when OAuth is needed:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## Frontend

After the single backend is live, set Vercel:

```text
VITE_API_BASE_URL=https://<single-backend>.onrender.com/api/v1
```

Then redeploy the frontend.
