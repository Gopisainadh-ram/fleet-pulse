# Role-based access control (RBAC)

## The five roles

| Role | Who it is for | In one line |
| --- | --- | --- |
| `SUPER_ADMIN` | Owner of the system | Everything, including managing admins |
| `ADMIN` | Operations head | Everything except touching admins or super admins |
| `MANAGER` | Fleet supervisor | Day-to-day: add/edit vehicles and drivers, assign vehicles |
| `VIEWER` | Auditor, finance, guest | Read-only on vehicles, drivers and the dashboard |
| `DRIVER` | A driver | Only their own profile and current vehicle |

## Permission matrix

| Permission | Super admin | Admin | Manager | Viewer | Driver |
| --- | :-: | :-: | :-: | :-: | :-: |
| `dashboard:read` | yes | yes | yes | yes | no |
| `vehicle:read` | yes | yes | yes | yes | no |
| `vehicle:write` (add / edit) | yes | yes | yes | no | no |
| `vehicle:assign` (assign / unassign) | yes | yes | yes | no | no |
| `vehicle:delete` | yes | yes | no | no | no |
| `driver:read` | yes | yes | yes | yes | no |
| `driver:write` | yes | yes | yes | no | no |
| `driver:delete` | yes | yes | no | no | no |
| `user:read` | yes | yes | no | no | no |
| `user:write` | yes | yes | no | no | no |
| `self:read` (own profile + own vehicle) | no | no | no | no | yes |

This table is **generated from one place**: `libs/shared/src/lib/permissions.ts`.
If this document and that file ever disagree, the file wins.

## Who can manage whom

User management has an extra rule on top of the table (`canManageRole` in
`libs/shared/src/lib/roles.ts`):

- A super admin can create or edit any role.
- Everyone else can only manage roles **below** their own. An admin can create managers,
  drivers and viewers, but not other admins.
- Nobody can change their own role or deactivate themselves.
- Admins don't see super admin accounts in the user list at all.

## How it is enforced

```
Request
  -> authenticate          valid, unexpired access token? sets req.user { id, role }
  -> requirePermission()   does req.user.role have this permission?  else 403
  -> controller / service  extra data rules (e.g. a driver only ever gets their OWN record)
```

Example from `vehicle.routes.ts`:

```ts
vehicleRouter.post('/', requirePermission('vehicle:write'), validate({ body: createVehicleSchema }), vehicleController.create);
```

Two principles to keep in mind:

1. **Deny by default.** A permission that isn't in the table is denied for everyone.
2. **The UI is not security.** The Angular guards and `*fpCan` directive only hide things.
   Every rule is checked again on the server.

## Changing access

| I want to... | Do this |
| --- | --- |
| Let managers delete vehicles | add `'MANAGER'` to `vehicle:delete` in `permissions.ts` |
| Add a new permission | add a line in `permissions.ts`, then use `requirePermission('x:y')` on the route and `*fpCan="'x:y'"` in the template |
| Add a new role | add it to `ROLES` in `roles.ts` and to the `Role` enum in `schema.prisma`, migrate, then give it rows in `permissions.ts` |
