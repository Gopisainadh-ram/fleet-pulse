# API reference

Base URL (dev): `http://localhost:3333/api`  (or `http://localhost:4200/api` through the proxy)

- All bodies and responses are JSON.
- Protected endpoints need `Authorization: Bearer <accessToken>`.
- Lists are paginated: `?page=1&pageSize=10` (max `pageSize` is 100) and return
  `{ items, total, page, pageSize, totalPages }`.
- Errors look like `{ "error": { "code": "...", "message": "..." } }`.
  Validation errors (400) also include a `fields` array.

| Status | Meaning |
| --- | --- |
| 400 | Input failed validation |
| 401 | Not signed in, or token expired |
| 403 | Signed in but the role is not allowed |
| 404 | Not found |
| 409 | Conflict (duplicate value, or a business rule such as "driver already has a vehicle") |
| 429 | Rate limit hit |

## Auth

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | Body `{ email, password }`. Returns `{ accessToken, user }` and sets the `fp_refresh` cookie. 10 tries / 15 min / IP. |
| POST | `/auth/refresh` | cookie | Needs header `X-Requested-With: fleet-pulse`. Rotates the refresh token, returns a new access token. |
| POST | `/auth/logout` | cookie | Needs the same header. Revokes the refresh token, clears the cookie. |
| GET | `/auth/me` | signed in | The current user. |
| POST | `/auth/set-password` | public | Body `{ token, password }`. Consumes a one-time invitation token (expires after 24 hours). |

## Vehicles

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/vehicles` | `vehicle:read` | Filters: `search`, `status`, `type`, `unassigned=true`, `insuranceExpiringInDays`. Sort: `sortBy` (plateNumber, make, year, odometerKm, insuranceExpiry), `sortDir`. |
| GET | `/vehicles/mine` | `self:read` | The signed-in driver's current vehicle, or `null`. |
| GET | `/vehicles/:id` | `vehicle:read` | |
| GET | `/vehicles/:id/assignments` | `vehicle:read` | Assignment history (latest 50). |
| POST | `/vehicles` | `vehicle:write` | |
| PATCH | `/vehicles/:id` | `vehicle:write` | Any subset of fields. Can't change status while `IN_USE`. Odometer can't go down. |
| DELETE | `/vehicles/:id` | `vehicle:delete` | 409 if the vehicle has history. |
| POST | `/vehicles/:id/assign` | `vehicle:assign` | Body `{ driverId, notes? }`. |
| POST | `/vehicles/:id/unassign` | `vehicle:assign` | Optional body `{ odometerKm }`. |

## Drivers

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/drivers` | `driver:read` | Filters: `search`, `status`, `hasVehicle`, `licenseExpiringInDays`. Sort: `sortBy` (lastName, licenseExpiry, hireDate), `sortDir`. |
| GET | `/drivers/me` | `self:read` | The signed-in driver's own record. |
| GET | `/drivers/:id` | `driver:read` | |
| POST | `/drivers` | `driver:write` | Links to a DRIVER login with the same email if one exists. |
| PATCH | `/drivers/:id` | `driver:write` | |
| DELETE | `/drivers/:id` | `driver:delete` | 409 if the driver has history. |

## Users

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/users` | `user:read` | Filters: `search`, `role`, `isActive`. |
| POST | `/users` | `user:write` | Creates an account and emails a one-time password setup link. In development without SMTP, returns a link for manual sharing. |
| POST | `/users/:id/invitation` | `user:write` | Re-issues a password setup link for an account that has not set a password yet. |
| PATCH | `/users/:id` | `user:write` | `firstName`, `lastName`, `role`, `isActive`, `password`. Role / password / deactivate changes sign the user out. |

## Dashboard

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | `dashboard:read` | Totals, status breakdown, expiring licences and insurance, busiest drivers, monthly assignments. |

## Health

`GET /health` returns `{ "status": "ok" }`. No login needed.
