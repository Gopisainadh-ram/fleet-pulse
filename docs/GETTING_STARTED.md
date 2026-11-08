# Getting started

This guide assumes you have never seen the project before. Follow it top to bottom.

## 1. What you need installed

| Tool           | Version         | Check with      |
| -------------- | --------------- | --------------- |
| Node.js        | 20 or newer     | `node -v`       |
| npm            | comes with Node | `npm -v`        |
| Docker Desktop | any recent      | `docker -v`     |
| Git            | any             | `git --version` |

Docker is only used to run PostgreSQL. If you already have PostgreSQL installed you can
skip Docker and point `DATABASE_URL` at your own server.

## 2. Install the packages

```bash
npm install
```

One install at the repo root covers the API, the web app and the shared library.
That is how Nx monorepos work.

## 3. Create your `.env` file

```powershell
Copy-Item .env.example .env
```

Open `.env`. Two values **must** be changed: the two JWT secrets. Generate each one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste one result after `JWT_ACCESS_SECRET=` and a different one after `JWT_REFRESH_SECRET=`.
Set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_FIRST_NAME`, and `SUPER_ADMIN_LAST_NAME` to the
initial administrator's details. Set `SUPER_ADMIN_BOOTSTRAP_PASSWORD` to a unique
password with at least 12 characters, upper and lower case letters, and a number. Keep
this value in `.env` or your deployment's secret manager; never commit it.
The previously used `SEED_PASSWORD` setting has been removed from the local `.env`.

Configure `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` to deliver user
invitations by email. `SMTP_PORT` defaults to 587. In development without SMTP, the Users
page displays the one-time setup link for manual sharing.

`.env` is in `.gitignore`. Never commit it.

## 4. Start the database

```bash
npm run db:up
```

## 5. Create the tables and bootstrap the first administrator

```bash
npm run db:generate    # builds the typed Prisma client from schema.prisma
npm run db:migrate     # creates the tables (type a name like "init" if asked)
npm run db:seed        # creates only the configured super-admin if it does not exist
```

## 6. Run the app

Use two terminals.

```bash
npm run start:api      # http://localhost:3333/api/health should say {"status":"ok"}
npm run start:web      # http://localhost:4200
```

The API development command runs the TypeScript entry point directly with workspace
path aliases enabled and restarts it when source files change.

Sign in with the configured `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_BOOTSTRAP_PASSWORD`.
The bootstrap command does not create demo users, drivers, vehicles, or assignments.

## 7. Things to try

1. As **super-admin**, add users from the Users page. Each invited user sets their own password.
2. Add vehicles and drivers using the application forms.
3. Assign an available vehicle to a driver and check the dashboard.

## 8. Where to go next

- Want to know how the code is organised? Read [ARCHITECTURE.md](ARCHITECTURE.md).
- Want to change who can do what? Edit one file: `libs/shared/src/lib/permissions.ts`.
- Want to add a feature? Follow the checklist in [CONTRIBUTING.md](CONTRIBUTING.md).

## Common problems

| Symptom                              | Fix                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration`  | A value in `.env` is missing or shorter than 32 characters (secrets).                                 |
| `P1001: Can't reach database server` | Database is not running. `npm run db:up`, wait a few seconds.                                         |
| Port 5432 already in use             | Another PostgreSQL is running. Stop it or change the port in `docker-compose.yml` and `DATABASE_URL`. |
| Browser shows 401 everywhere         | Use http://localhost:4200, not port 3333.                                                             |
| Locked out after wrong passwords     | 5 wrong tries lock the account for 15 minutes. Wait, or clear `lockedUntil` in Prisma Studio.         |
| Super-admin password needs resetting | Set `SUPER_ADMIN_RESET_PASSWORD=true` and a compliant `SUPER_ADMIN_BOOTSTRAP_PASSWORD`, run `npm run db:seed` once, then set the reset flag back to `false`. |
