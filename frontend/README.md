# EduPulse LMS Frontend

React + Vite frontend for the multi-tenant LMS SaaS platform. The app is built
for Mongolian schools and training organizations, with role-specific workspaces
for organization admins, principals, teachers, students, parents, staff, and
finance users.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The Vite dev server proxies `/api` to `VITE_GATEWAY_TARGET`, which defaults to
`http://127.0.0.1:8000`.

## Production build

```bash
npm run build
npm run preview
```

Production containers serve the compiled SPA through nginx, cache static assets,
return `index.html` for client-side routes, expose `/health`, and proxy `/api`
to the backend gateway.

```bash
docker build -t lms-frontend:production .
docker run --rm -p 8080:8080 -e API_UPSTREAM=http://host.docker.internal:8000 lms-frontend:production
```

## Required runtime model

- Browser talks to `/api/v1`; frontend does not store refresh tokens.
- Refresh session is held by secure HTTP-only cookies from the auth service.
- Demo login stays disabled unless `VITE_ENABLE_DEMO_LOGIN=true` is explicitly
  set for a local demo environment.
- Tenant slug examples use lowercase Latin text, such as `mongol-erdem`.

## Quality gates

```bash
npm run test
npm run build
npm run test:e2e
```
