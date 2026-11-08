# libs/shared

Code that both the API and the web app need. Keeping it in one place means the
two sides can never disagree about what a role is or who is allowed to do what.

| File | What's inside |
| --- | --- |
| `src/lib/roles.ts` | The five roles and the "who can manage whom" rule |
| `src/lib/permissions.ts` | The permission table (the single source of truth for RBAC) |
| `src/lib/dto.ts` | Request/response shapes sent over HTTP |

Import it anywhere with:

```ts
import { can, Role } from '@fleet-pulse/shared';
```

**Rule of thumb:** only put pure TypeScript here. No Express, no Angular, no Prisma.
