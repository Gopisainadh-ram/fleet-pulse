# Architecture

## The big picture

```
 Browser (Angular)
      |   /api/...  (JSON over HTTP, access token in the Authorization header,
      |              refresh token in an httpOnly cookie)
      v
 Express API  --->  Prisma  --->  PostgreSQL
      ^
      |
 libs/shared  (roles, permissions, types: imported by BOTH sides)
```

In development the Angular dev server proxies `/api` to the Express server
(`apps/web/proxy.conf.json`), so the browser only ever talks to one origin.

## Nx monorepo

| Project | Path | Type | Imports from |
| --- | --- | --- | --- |
| `web` | `apps/web` | Angular app | `shared` |
| `api` | `apps/api` | Express app | `shared` |
| `shared` | `libs/shared` | TypeScript library | nothing |

The rule: **apps may import libs, libs never import apps, and apps never import each other.**
That is why the web app can't accidentally depend on Express or Prisma.

Handy Nx commands: `npx nx graph` (draws the dependency picture), `npx nx build api`,
`npx nx build web`.

## Backend layering

A request goes through these layers in order. Each layer has one job.

```
route  ->  middleware  ->  controller  ->  service  ->  Prisma
```

| Layer | File pattern | Responsibility |
| --- | --- | --- |
| Route | `*.routes.ts` | Maps a URL to its middleware chain and a controller function |
| Middleware | `common/middleware/*` | Login check, permission check, input validation, rate limiting |
| Controller | `*.controller.ts` | Reads the request, calls one service function, writes the response |
| Service | `*.service.ts` | Business rules and all database access |
| Schema | `*.schema.ts` | zod description of valid input |

Controllers never touch Prisma. Services never touch `req`/`res`. If you keep to that,
the business rules stay testable without a web server.

### Middleware order in `app.ts`

1. `helmet` sets security headers
2. `cors` allows only the configured web origin
3. request logging (secrets redacted)
4. JSON body parser (50 KB limit) and cookie parser
5. rate limiter on `/api`
6. routers
7. 404 handler, then the central error handler (always last)

### Errors

Services throw `AppError` (see `common/errors.ts`) with an HTTP status. The central
handler in `common/middleware/errorHandler.ts` converts these, zod validation errors and
common Prisma errors into one consistent JSON shape:

```json
{ "error": { "code": "CONFLICT", "message": "This driver already has a vehicle" } }
```

Unknown errors are logged in full but the client only gets a generic 500.

## Frontend layout

```
apps/web/src/app/
  core/        singletons: AuthService, interceptor, route guards, permission directive
  layout/      the shell (sidebar + page area)
  shared/      small reusable UI: modal, pager, badge
  features/    one folder per screen: auth, dashboard, vehicles, drivers, users, my-vehicle
```

- **State** is kept in Angular signals inside each component. There is no global store
  because nothing in v1 needs one.
- **Auth:** the access token lives in memory only. On page load, `restoreSession()` asks the
  API for a new one using the refresh cookie. The interceptor attaches the token and, on a
  401, refreshes once and retries the request.
- **Routes are lazy-loaded**, so the login page doesn't download the whole app.
- **Route guards and `*fpCan`** hide things the user can't use. They are only for a nicer
  experience. The API enforces every rule again.

## Why these choices

| Decision | Reason |
| --- | --- |
| Permissions in `libs/shared` | One table drives API checks and UI buttons, so they can't drift apart |
| zod on every input | Validation rules are written once and typed |
| Services own Prisma | Easy to find all queries for a feature in one file |
| Refresh token rotation | A stolen refresh token stops working as soon as the real user refreshes |
| No global state library | Smaller app, fewer moving parts; add NgRx only if state sharing gets painful |
