# apps/web

The Angular frontend. Standalone components, signals, lazy-loaded routes, reactive forms.

## Folder map

```
src/
  main.ts, index.html, styles.css    entry point and global styles
  app/
    app.config.ts                    providers (router, HTTP, session restore at startup)
    app.routes.ts                    all routes, each with a permission guard
    core/                            used everywhere, created once
      auth.service.ts                login, logout, refresh, "can I do X?"
      auth.interceptor.ts            adds the token, refreshes on 401
      guards.ts                      authGuard, permissionGuard, homeGuard
      has-permission.directive.ts    *fpCan="'vehicle:write'"
      api.ts                         small helpers for query params and error messages
    layout/shell.component.ts        sidebar + content area (collapses on phones)
    shared/                          modal, pager, status badge
    features/                        one folder per screen
      auth/ dashboard/ vehicles/ drivers/ users/ my-vehicle/
```

## Patterns you'll see in every feature

- A `*.service.ts` wraps the HTTP calls for that feature.
- The component keeps its data in **signals** (`items`, `total`, `loading`, `error`).
- Filters are `FormControl`s. Typing in search waits 300 ms (`debounceTime`) before calling the API.
- Create/edit forms open in `<fp-modal>`.
- Buttons are wrapped in `*fpCan="'...'"` so only allowed roles see them.

## Responsive behaviour

Under 760 px wide the sidebar becomes a slide-in menu and tables turn into stacked cards
(each cell shows its label through a `data-label` attribute). The CSS for this is at the
bottom of `styles.css`.

## Running

```bash
npm run start:web      # http://localhost:4200, proxies /api to localhost:3333
npx nx build web       # production build in dist/apps/web
```
