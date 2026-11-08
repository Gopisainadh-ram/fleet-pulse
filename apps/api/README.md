# apps/api

The Express + TypeScript backend. It talks to PostgreSQL through Prisma.

## Folder map

```
src/
  main.ts              starts the server, handles shutdown
  app.ts               builds the Express app (middleware order matters, read it top to bottom)
  config/env.ts        reads and validates environment variables
  common/              things used by every module
    middleware/        authenticate, authorize (RBAC), validate, rate limit, error handler
    prisma.ts          the single PrismaClient
    audit.ts           writes rows to the audit_logs table
  modules/             one folder per feature
    auth/  users/  drivers/  vehicles/  dashboard/
prisma/
  schema.prisma        the database model
  seed.ts              first super-admin bootstrap; does not create demo data
```

## How a module is laid out

Every module follows the same four files, so once you've read one you've read them all:

| File | Job | May talk to the DB? |
| --- | --- | --- |
| `*.routes.ts` | URL + which middleware runs (login check, permission, validation) | no |
| `*.schema.ts` | zod rules describing valid input | no |
| `*.controller.ts` | takes the request, calls the service, sends the response | no |
| `*.service.ts` | the actual business logic and Prisma queries | **yes** |

If you're looking for the complex Prisma queries, start with
`modules/vehicles/vehicle.service.ts` (filters, assign transaction) and
`modules/dashboard/dashboard.service.ts` (groupBy, aggregates, raw SQL).

## Running

From the repo root: `npm run start:api`. See the root README for the full setup.
`npm run db:seed` creates only the configured initial super-admin. It does not insert
demo users, drivers, vehicles, or assignments. Existing database records are preserved.
