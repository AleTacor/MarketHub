# MarketHub

Marketplace for local shops in Spain. Two user roles:

- **cliente**: searches shops by postal code, by name, or by drawing an area on a map; views a shop's location and products. **No account needed**: browsing (`/`, `/tiendas/[id]`) is public, and customers can optionally register.
- **empresario**: everything a cliente can do, plus creating/editing shops and managing their products and stock.

**All user-facing text is in Spanish** (UI copy, API error messages, validation messages). Code, comments, and docs are in English.

## Architecture

pnpm workspaces + Turborepo monorepo. Three services plus shared code, run locally with docker-compose behind nginx.

```
apps/
  web/            Next.js 15 (App Router) + React 19 + TanStack Query + Tailwind 3 + react-leaflet
  auth-service/   Express 5 + Knex: register, login, logout, /me, JWKS   → DB auth_db
  shop-service/   Express 5 + Knex + PostGIS: shop types, shops, products, image uploads → DB shop_db
packages/
  shared/         zod schemas, API types, constants (cookie name, roles); TS source, no build step
infra/
  docker/Dockerfile.dev   shared Node dev image (repo is bind-mounted, not copied)
  nginx/nginx.conf        routing (below)
  postgres/init.sql       creates auth_db and shop_db; enables postgis on shop_db
```

nginx (http://localhost:8080) is the only public entry point. Everything is same-origin, so there is no CORS and the cookie works as is:

| Path          | Target                     |
|---------------|----------------------------|
| `/api/auth/*` | auth-service:4001          |
| `/api/*`      | shop-service:4002          |
| `/uploads/*`  | `uploads` volume (static)  |
| `/*`          | web:3000 (WebSocket upgrade for HMR) |

Backends mount their routes **with the full `/api/...` prefix**. nginx does not strip it.

### Auth flow

- auth-service hashes passwords with bcryptjs and signs an **RS256 JWT** (`sub`=user id, `name`, `role`, `iss`=`markethub-auth`), sent as the httpOnly cookie `mh_token` (`AUTH_COOKIE` in shared).
- It publishes the public key at `/api/auth/.well-known/jwks.json`. shop-service verifies tokens with `createRemoteJWKSet` (`apps/shop-service/src/auth.ts`). shop-service never sees the private key and never calls auth-service per request.
- The private key comes from `JWT_PRIVATE_KEY`. If that is unset, it is generated once and persisted in `KEYS_DIR` (the `jwt-keys` docker volume).
- Usernames are unique case-insensitively (`lower(name)` unique index).
- Only the business area (`/mis-tiendas/*`) needs an account. `apps/web/src/middleware.ts` matches just that path and only checks that the cookie *exists*, to redirect to `/login?next=...`. Real verification happens in the backends. Those pages also wrap content in `<RequireUser role="empresario">`, which loads `/api/auth/me`. Public pages call `useMe()` only to adapt the UI (header buttons, the "Gestionar" link for owners), so for anonymous visitors `/me` returning 401 is expected.
- shop-service read endpoints (`GET /api/shops*`, `search-area`, `shop-types`) are public. Only write endpoints require auth.

### Geo / search

- `shops.location` is `geography(Point, 4326)` with a GiST index. Insert with `ST_MakePoint(lng, lat)`. Note the order: **lng first**.
- Map area search: the frontend sends the drawn shape (rectangle or polygon, via Leaflet-Geoman) as GeoJSON to `POST /api/shops/search-area`. The backend runs `ST_Intersects(location, polygon)` and returns `{ shops, postalCodes }`, where `postalCodes` are the distinct postal codes of the shops found. There is no postal-code polygon dataset; that was a deliberate choice.
- Postal code validation: `postalCodeSchema` in shared (5 digits, province 01–52).
- Map tiles: OpenStreetMap. Maps are client-only (`next/dynamic` with `ssr:false`, see `apps/web/src/components/maps/index.tsx`). Markers are `CircleMarker`s, to avoid Leaflet's broken default icon images under bundlers.

### API (shop-service)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/shop-types` | – | list from DB (`shop_types`) |
| GET | `/api/shops?postalCode=&q=` | – | at least one filter |
| POST | `/api/shops/search-area` | – | `{ area: GeoJSON Polygon, q? }` |
| GET | `/api/shops/mine` | empresario | |
| GET | `/api/shops/:id` | – | shop + products |
| POST | `/api/shops` | empresario | multipart, `image` required |
| PUT | `/api/shops/:id` | owner | multipart, `image` optional |
| DELETE | `/api/shops/:id` | owner | cascades products, deletes images |
| POST | `/api/shops/:id/products` | owner | multipart, `image` optional |
| PUT | `/api/products/:id` | owner | multipart |
| PATCH | `/api/products/:id/stock` | owner | `{ stock }`: inline stock editing |
| DELETE | `/api/products/:id` | owner | |

auth-service: `POST /api/auth/register {name,password,role}`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/.well-known/jwks.json`. Both services also expose `GET /health`.

Errors are always `{ "error": "<Spanish message>" }`. Throw `HttpError(status, msg)` from handlers. Express 5 forwards async errors, so no try/catch wrappers are needed. `ZodError` and `MulterError` are mapped to 400 in `src/errors.ts`.

## Commands

Two ways to run the app:

```bash
pnpm dev                         # Postgres in Docker + all 3 apps on the host, watch mode → http://localhost:3000
docker compose up --build        # everything in Docker behind nginx → http://localhost:8080
docker compose down -v           # stop and wipe DB, uploads, keys (Docker volumes)

pnpm db:up / pnpm db:down        # start/stop only the Postgres container

pnpm install                     # install deps of every app/package
npm run docker:install           # same, inside the dev container (after changing dependencies)
pnpm typecheck                   # all packages (turbo)
pnpm test                        # vitest in every package (no DB or Docker needed)
pnpm --filter @markethub/shop-service test:watch
pnpm build                       # next build
pnpm --filter @markethub/web dev                 # a single app
pnpm --filter @markethub/auth-service migrate   # also run automatically on service start
```

pnpm is pinned via `packageManager` (pnpm@9.15.9). Install it globally once with `npm install -g pnpm`. pnpm ≥ 9.7 then switches to the pinned version automatically. Don't use `npm install` in this repo.

How `pnpm dev` works: it runs `docker compose up -d --wait postgres` (exposed on localhost:5432) and then `turbo run dev`, which starts web (:3000), auth-service (:4001) and shop-service (:4002) in parallel. There is no nginx in this mode. Instead `apps/web/next.config.mjs` adds **dev-only rewrites** that mirror nginx: `/api/auth/*` → 4001, `/api/*` → 4002, `/uploads/*` → shop-service, which serves `UPLOAD_DIR` itself via `express.static`. The rewrites only apply in `next dev`. In Docker, nginx routes these paths before they reach Next. Defaults in each `src/config.ts` point at localhost. On the host, data lives in `apps/shop-service/uploads/` and `apps/auth-service/.keys/` (gitignored), separate from the Docker volumes.

Turbo 2 filters environment variables for tasks (strict mode). If a service gains a new env var that must be settable for `pnpm dev`, add it to `passThroughEnv` of the `dev` task in `turbo.json`.

## Conventions

- **Validation lives in `packages/shared/src/schemas.ts`** and is used by both the frontend forms and the backend handlers. Change it there, never duplicate it. Multipart fields arrive as strings, so numeric schemas use `z.coerce`.
- **Response types** live in `packages/shared/src/types.ts`. Backends return camelCase. DB columns are snake_case and get aliased in `apps/shop-service/src/repository.ts` (all SQL for shop-service is there).
- **Migrations** are TS modules registered in `src/db/migrations/index.ts` (a custom Knex `migrationSource`, no knex CLI or knexfile). Add a new numbered file and register it. Never edit an applied migration. They run on service startup.
- **Shop types** are seeded idempotently from `apps/shop-service/src/db/seed.ts` on every start. The DB table is the source of truth.
- Services run TypeScript directly with `tsx` (`tsx watch` in dev). There is no compile step, and `tsc` is only for type-checking (`noEmit`). ESM (`"type": "module"`), extensionless relative imports.
- Images: `apps/shop-service/src/storage.ts` writes to `UPLOAD_DIR` and returns `/uploads/<uuid>.<ext>` URLs (JPG/PNG/WEBP, max 5 MB). To move to S3/R2, change only that module.
- Frontend: client components and TanStack Query, with query keys in `apps/web/src/lib/hooks.ts` (`queryKeys`). Use the `api()` helper from `src/lib/api.ts`. It throws `ApiError` carrying the backend's Spanish message. Shared Tailwind classes (`btn`, `btn-primary`, `input`, `label`, `card`, `error-box`) are defined in `globals.css`.
- Stock editing (`StockControl.tsx`) updates the `["shop", id]` cache optimistically and rolls back on error.
- **Dark mode / colors:** use the semantic tokens (`bg-canvas`, `bg-surface`, `bg-surface-muted`, `border-line`, `border-line-strong`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-accent`, `bg-accent-soft`, `text-danger`, `bg-danger-soft`, `border-danger-line`). **Don't use raw `slate-*`, `white`, or `red-*`, and don't add `dark:` variants.** The tokens are CSS variables defined for `:root` and `.dark` in `globals.css` and mapped in `tailwind.config.ts`. To add one, define it in both blocks and in the config. `brand-500/600/700` are static (buttons, markers).
- Theme: `darkMode: "class"`. `ThemeToggle` cycles Sistema → Claro → Oscuro and stores it in `localStorage["mh-theme"]` (nothing stored means follow the OS). `themeInitScript` (`src/lib/theme.ts`) runs in `<head>` to set the class before paint, so keep it in sync with `applyTheme`. The map goes dark through a CSS filter on Leaflet tiles and controls (`globals.css`).

## Testing

Vitest everywhere. Tests live in `apps/<app>/test/` (schemas: `packages/shared/src/*.test.ts`). They are unit tests: no Postgres, no network, no browser.

### Backends (Supertest)

- Both `createApp` functions take their dependencies, so tests inject fakes:
  - auth-service: `createApp({ users, keys })`. `users` is a `UsersRepository` (`src/users.ts`, all SQL of the service). Tests use `memoryUsers()` from `test/helpers.ts`.
  - shop-service: `createApp({ repo, getKey })`. `repo` is the `Repository` (`src/repository.ts`), and tests use `fakeRepo()`, where every method is a `vi.fn` with empty-DB defaults. `getKey` is the JWT key source: production uses `remoteKeys()` (auth-service JWKS), and tests use `createIssuer()`, a local RS256 key pair that also signs test tokens (`ctx.cookie(userId, role)`).
- `test/setup.ts` points `UPLOAD_DIR` / `KEYS_DIR` at fresh temp dirs before `config.ts` is imported. `config` reads env at import time, so tests that need different env use `vi.resetModules()` and a dynamic import (see `auth-service/test/keys.test.ts`).
- auth-service tests run with `BCRYPT_ROUNDS=4` (vitest.config.ts) to stay fast.
- Each new route needs tests for: the happy path, validation (400 with the Spanish message), 401 without a session, 403 for the wrong role or owner, and 404 when the resource is missing. Assert that the repo is **not** called when a request is rejected.

### Frontend (React Testing Library + MSW)

`apps/web/vitest.config.mts`: jsdom, located at `http://localhost:3000` so relative `fetch("/api/...")` works. `test/setup.ts` wires up:
- **MSW** (`test/msw.ts`): a shared `server` with no default handlers. Each test adds its own with `server.use(http.get("/api/...", ...))`. Requests without a handler fail the test (`onUnhandledRequest: "error"`). `recorder()` collects the URL and body of received requests for assertions.
- **`next/navigation` is mocked** (`test/navigation.ts`): assert on `router.replace` and friends, and set the URL with `setLocation("/login?next=/x")`. Everything is reset after each test.
- `renderWithClient(ui)` (`test/render.tsx`) renders inside a fresh QueryClient (no retries) and returns `user` (user-event). `shop()` / `shopDetail()` build fixtures.

Rules:
- Query by role and label (`getByRole("button", { name: "Sumar uno" })`, `getByLabelText(...)`), the way a user finds things. Use test ids only for fakes.
- **Leaflet can't run in jsdom.** Mock `@/components/maps` with a fake that exposes the props (see `test/SearchPage.test.tsx`: buttons call `onAreaChange`, data attributes expose `shops`, `clearKey`, `fitToShops`).
- To test optimistic updates, make sure the follow-up refetch can't mask a bug. For example, give it `delay("infinite")` when testing a rollback.
- jsdom gaps are patched in `test/setup.ts`: `matchMedia` (ThemeToggle), `URL.createObjectURL` (image previews), and `FormData`, which jsdom builds from an internal file list that `user.upload()` can't fill. Also, jsdom's `required` check ignores uploaded files and would block submit, so tests that submit with an upload call `skipNativeValidation(field)` from `test/render.tsx` and check `toBeRequired()` separately.
- Every form field needs a `<label htmlFor>` linked to the input (use `useId` in components that can render more than once). Tests find fields by label, and screen readers need it too.
- MSW is pinned to v2 and jest-dom to v6 (v3/v7 exist but weren't adopted).

### Not covered yet
- The SQL in the repositories (PostGIS queries, case-insensitive uniqueness). This needs integration tests against a real PostGIS (e.g. Testcontainers).
- Real map interaction, the middleware, and cross-service flows. These need Playwright end-to-end tests against `pnpm dev`.

## Gotchas

- The dev image runs as user `node` (uid 1000), and `node_modules` is written into the bind-mounted repo. If the host uid isn't 1000, expect permission errors.
- `docker-compose`'s `install` service runs `pnpm install --frozen-lockfile`. After changing dependencies, run `pnpm install` on the host and commit `pnpm-lock.yaml`.
- `infra/postgres/init.sql` only runs when the `pgdata` volume is first created.
- There is no production setup yet (Dockerfiles copy nothing; images are stored on local disk; `COOKIE_SECURE=false`).
