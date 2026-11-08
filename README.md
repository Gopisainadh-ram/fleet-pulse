# Fleet-Pulse

A web app for running a vehicle fleet: keep track of vehicles and drivers, hand vehicles
out to drivers, and see at a glance what needs attention (expiring licences, expiring
insurance, how much of the fleet is on the road).

- **Frontend:** Angular 19 (standalone components, signals)
- **Backend:** Node.js + Express 5 + TypeScript
- **Database:** PostgreSQL 16 through Prisma
- **Repo layout:** Nx monorepo
- **Security:** built around the OWASP Top 10, with role-based access control (RBAC)

New here? Read [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md). It walks through
everything with no steps skipped.

---

## What's in version 1

| Area        | What you can do                                                                             |
| ----------- | ------------------------------------------------------------------------------------------- |
| Vehicles    | Add, edit, search, filter, sort, delete. Assign to a driver and take it back.               |
| Drivers     | Add, edit, search, filter (including "licence expiring soon"), delete.                      |
| Dashboard   | Fleet status, utilisation, expiring licences and insurance, busiest drivers, monthly trend. |
| Users       | Invite accounts to set their own passwords, change roles, deactivate people.               |
| Driver view | A driver who signs in only sees their own licence and current vehicle.                      |

Trips, live tracking, fuel and maintenance logs are not in this version. The folder
layout makes them easy to add later. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Quick start

You need Node.js 20+, Docker (for PostgreSQL) and npm.

```bash
npm install
cp .env.example .env
npm run db:up                 # starts PostgreSQL in Docker
npm run db:generate           # builds the Prisma client
npm run db:migrate            # creates the tables
npm run db:seed               # bootstraps the first super-admin only; no demo data
npm run start:api             # terminal 1, API on http://localhost:3333
npm run start:web             # terminal 2, app on http://localhost:4200
```

Before `npm run db:seed`, configure `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_FIRST_NAME`,
`SUPER_ADMIN_LAST_NAME`, and `SUPER_ADMIN_BOOTSTRAP_PASSWORD` in `.env`. The password
must meet the 12-character password policy. The script creates only this super-admin
when the account does not exist. Re-running it preserves an existing password; set
`SUPER_ADMIN_RESET_PASSWORD=true` only when intentionally resetting it. No demo users,
drivers, vehicles, or assignments are created. New users receive an email invitation to
set their own password; configure SMTP to deliver invitations.
The old `SEED_PASSWORD` setting has been removed.

## Folder structure

```
fleet-pulse/
├── apps/
│   ├── api/        Express backend       -> apps/api/README.md
│   └── web/        Angular frontend      -> apps/web/README.md
├── libs/
│   └── shared/     roles, permissions, DTOs used by BOTH apps
├── docs/           all the documentation (start with GETTING_STARTED)
├── docker-compose.yml   local PostgreSQL
├── nx.json  tsconfig.base.json  package.json
└── .env
```

## Documentation index

| Document                                   | Read it when you want to...                       |
| ------------------------------------------ | ------------------------------------------------- |
| [GETTING_STARTED](docs/GETTING_STARTED.md) | set the project up for the first time             |
| [ARCHITECTURE](docs/ARCHITECTURE.md)       | understand how the pieces fit together            |
| [DATABASE](docs/DATABASE.md)               | see the tables and where the complex queries live |
| [API](docs/API.md)                         | look up an endpoint                               |
| [RBAC](docs/RBAC.md)                       | check who is allowed to do what                   |
| [SECURITY](docs/SECURITY.md)               | see how each OWASP Top 10 item is handled         |
| [CONTRIBUTING](docs/CONTRIBUTING.md)       | add a feature or follow the code conventions      |

## Useful commands

| Command                           | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run start:api` / `start:web` | run the backend / frontend in dev mode                  |
| `npm run build`                   | build both apps (output in `dist/`)                     |
| `npm run db:migrate`              | create/apply a migration after editing `schema.prisma`  |
| `npm run db:studio`               | open Prisma Studio to browse the data                   |
| `npm run audit`                   | check production dependencies for known vulnerabilities |

## Troubleshooting

- **"Invalid environment configuration" when the API starts.** A value in `.env` is missing
  or too short. The message says which one. Secrets need at least 32 characters.
- **`Can't reach database server`.** Run `npm run db:up` and wait a few seconds.
- **`npm install` complains about versions.** Run `npx nx migrate latest` and follow the prompts.
- **Login works but every page says "session expired".** Open the app through
  http://localhost:4200 (not :3333). The dev proxy is what keeps the cookie working.
