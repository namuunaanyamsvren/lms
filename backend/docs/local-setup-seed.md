# Local Setup, Seed, And Demo Credentials

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run docker:up
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Demo Tenant

- Tenant slug: `mongol-erdem`
- Domain: `lms.mn`
- Password: `password123` unless `DEV_SEED_PASSWORD` is set.

Demo users:

- `admin@lms.mn`
- `teacher@lms.mn`
- `student@lms.mn`
- `parent@lms.mn`
- `staff@lms.mn`
- `principal@lms.mn`

The seed is deterministic and idempotent. It refuses production and non-loopback database hosts unless `ALLOW_NONLOCAL_DEV_SEED=true` is explicitly set for ephemeral test systems.
