# Contributing

## Code conventions

- TypeScript strict mode everywhere. No `any` unless there's a comment saying why.
- Files: `kebab-case`. Angular components `name.component.ts`, API files `name.service.ts` etc.
- Keep controllers thin and put logic in services.
- Validate every input with zod. Never trust `req.body`, `req.query` or `req.params`.
- Never build SQL with string concatenation.
- Comments explain **why**, not what.
- Format with Prettier (`npx prettier --write .`).

## Checklist: adding a new backend module

Example: you want a `maintenance` module.

1. Add the model to `apps/api/prisma/schema.prisma`, then run `npm run db:migrate`.
2. Create `apps/api/src/modules/maintenance/` with:
   - `maintenance.schema.ts`: zod input rules
   - `maintenance.service.ts`: the Prisma queries and business rules
   - `maintenance.controller.ts`: thin handlers
   - `maintenance.routes.ts`: URLs, `authenticate`, `requirePermission(...)`, `validate(...)`
3. Add the new permissions to `libs/shared/src/lib/permissions.ts`.
4. Mount the router in `apps/api/src/app.ts`.
5. Add the response types to `libs/shared/src/lib/dto.ts`.
6. Call `audit(...)` for create / update / delete.
7. Document the endpoints in `docs/API.md` and the permissions in `docs/RBAC.md`.

## Checklist: adding a new screen

1. Create `apps/web/src/app/features/<name>/` with a service and a component.
2. Add a lazy route in `app.routes.ts` with `permissionGuard('...')`.
3. Add a link in `layout/shell.component.ts` (the `NAV` list).
4. Hide action buttons with `*fpCan="'permission'"`.

## Git

- Branch names: `feature/short-name`, `fix/short-name`.
- Commit messages in the imperative: "Add licence expiry filter to drivers list".
- One topic per pull request. Describe what changed and how you tested it.

## Before you open a pull request

- [ ] `npm run build` passes
- [ ] You tried the change in the browser with at least two different roles
- [ ] New endpoints have a permission check and zod validation
- [ ] Docs updated if behaviour or access rules changed
