<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `app/node_modules/next/dist/docs/` (in this monorepo the `next` package is only visible from `app/`) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `app/node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kopiika

A personal budget tracker: a Go API in `api/` and the Next.js app in `app/`
that runs on it. Read `README.md` first for how the two fit together and how
to run them; `app/README.md` carries the design vocabulary and the layout map.

Both sides authenticate against the same AWS Cognito user pool. Currency codes
are **lower case** (`uah`, `usd`) on both sides of the wire, and amounts travel
as decimal **strings**.

## Pull requests

When opening a PR, write its description from `pr-template.md` at the repo
root: fill in **Why**, **What** and **Risks** as bullet points (no prose
paragraphs), and drop the guidance comments.
With `gh`, pass the filled-in text via `gh pr create --body-file <file>`.

One PR does one job: it may change at most one of `.github/`, `api/` and
`app/` (files at the repo root go with any of them). The `PR Scope` check
fails a PR that touches more than one; split it instead.

Every PR check lives in one workflow, `.github/workflows/pr.yml`.
`PR Scope` runs first; if it passes, it reports which areas changed, and the
checks below run in parallel, each only when its area changed. A skipped
check starts no runner, and the one required check is `PR Checks`, which
fails unless `PR Scope` passed and every other check passed or was skipped.
Each check's steps are a composite action in `.github/actions/`, so another
workflow can reuse one without copying it (`deploy.yml` builds its images
with `build-image`).

- `Go Linter` (when `api/` changes) runs `golangci-lint run` in `api/`,
  which covers both linters and formatters. Run `make lint` in `api/` before
  pushing, and `make fmt` to fix formatting.
- `Atlas Migrations` (when `api/` changes) runs `atlas migrate validate`, then
  `atlas migrate diff`, which fails the PR if it generates a migration. That
  is, a model change must ship with its migration; `make migrate-validate`
  and `make migrate-diff` run the same checks locally.
- `App Linter` (when `app/` changes) typechecks, lints and checks formatting.
- `Build API` and `Build App` build the Docker image of each side a PR
  changes (both when `.github/` changes) without pushing it.

---

# App (`app/`)

A budget tracker on a print-inspired ledger design, talking to the API.
Paths in this section are relative to `app/`.

## Conventions that are easy to break

- **Navigation**: import `Link`, `useRouter`, `usePathname` from
  `@/i18n/navigation`, never from `next/link` / `next/navigation`. The locale
  prefix is "as-needed", and these helpers are what add or omit it.
- **Money**: every amount from the API is a decimal **string**, and every
  currency code is **lower case**. Parse with `toNumber` from `@/lib/money`;
  format with the bound formatters on `usePreferences()`, not by calling
  `@/lib/money` directly, so locale and the cents setting are respected.
- **Design tokens**: use `bg-bg`, `text-ink`, `text-mute`, `border-rule`,
  `border-rule2`, `text-blue`, `text-green`, `text-red`, `bg-ch1`..`bg-ch6`.
  They are defined in `src/app/globals.css` and mirror the design's own names.
  The shadcn names alias the same values; either works, but match the file
  you are editing.
- **No radius, no shadow**: the radius scale is `0` on purpose, so a stock
  shadcn component is already square — do not add `rounded-*`. The only shadow
  in the design is on a dropdown panel.
- **Emphasis** is a rule or a fill, never a colour shift: an active item takes
  `text-blue` plus a heavier border, not a brighter hue.
- **Analytics**: call `track` from `@/lib/analytics`, in a hook's
  `onSuccess` rather than in `src/api/`, and add the event to its
  `AnalyticsEvents` type first. Metadata is enums and booleans only — never an
  amount, a title, a description or a name.
- **Adding a shadcn component**: `bunx shadcn@latest add <name>` writes
  `import { cn } from "cn"` — that is correct here, `cn` is shadcn's own
  package and the single import path for it. Then restyle to the design;
  the stock focus rings and `shadow-xs` do not belong.

## Layer boundaries

`src/api/` holds wire types and endpoint functions and nothing else — no
react-query, no formatting. Hooks and components own caching, via the key
factory in `src/api/endpoints.ts`. Contexts do not fetch beyond their own
resource.

## Checks

```bash
cd app
bun run typecheck && bun run lint && bun run build
```

ESLint is pinned to 9: `eslint-plugin-react`, pulled in by
`eslint-config-next`, still calls `context.getFilename()`, which ESLint 10
removed.

---

# API (`api/`)

Go REST API using Gin with GORM and PostgreSQL. Paths and commands in this
section are relative to `api/`.

## Build & Run Commands

```bash
cd api

# Run the application (requires .env with DATABASE_URL, COGNITO_REGION, COGNITO_USER_POOL_ID, REDIS_URL)
go run .

# Build the binary (regenerates swagger first)
make build

# Regenerate Swagger documentation (required whenever API annotations change)
make swagger          # swag init --parseInternal

# Run with Docker Compose (includes PostgreSQL, Redis and the asynqmon UI on :8081)
docker compose up --build

# Build the deployable image (multi-stage, static binary, non-root, ~49MB)
docker build -t kopiika-api .
```

`docs/` is generated by swag and **is committed**, because `main.go` imports it —
a clean clone would not compile otherwise. Regenerate it in the same commit as any
annotation change.

## Checks

```bash
cd api
make fmt && make lint && make test && go build ./...
```

Formatting and linting both run through golangci-lint v2 (`brew install golangci-lint`),
configured in `.golangci.yml`: gofumpt + gci for formatting (imports grouped stdlib,
third-party, `kopiika-api-go`), and the standard linters plus a few extras for linting.
`make fmt-check` reports formatting drift without rewriting files.

## Testing

`make test` runs `go test ./tests/...`, reusing cached results when nothing changed;
`make test force=1` runs every test again. It needs a running Docker daemon for any test
that touches the database.

- **Every test lives under `tests/`, one package per layer it tests**, as
  `_test.go` files only: `tests/services/` (`package services_test`) tests
  `src/services/` and `tests/core/` (`package core_test`) tests `src/core/`,
  each through the layer's exported API. Export a helper only when it is a
  unit worth naming (`services.PreviousPeriodRange`); do not add test hooks
  to `src/`. The next layer (controllers, queries) gets a sibling directory
  on the same recipe.
- **`tests/testutil/` is the shared harness**, a normal package the test
  packages import: `UseDB`, the `Use…` mock helpers, `MustDate` and `Run`.
  Helpers that only one package needs stay unexported in that package.
- **testify**: `require` for setup and anything later lines depend on,
  `assert` for the checks, `mock` for third-party services. Table-driven with
  `t.Run`. No `t.Parallel()`: tests swap `core` globals.
- **The database is real.** `testutil.UseDB(t)` starts a `postgres:16-alpine`
  container on first use, with every file in `migrations/` applied, so the
  schema is the production one, including the `currency` schema. Each test
  then runs in its own transaction, which is rolled back when the test ends.
  A statement that fails aborts that transaction, so assert a database error
  last. The connection comes from the container alone; tests never read
  `.env`. Each test package is its own binary, so each package that uses the
  database starts its own container and needs a `TestMain` that calls
  `testutil.Run(m)` to stop it (see `tests/services/main_test.go`).
- **Third-party services are mocked.** `testutil.UseQueue(t)`,
  `testutil.UseCognito(t)` and `testutil.UseRatesAPI(t)` swap `core.Queue`,
  `core.Cognito` and `core.RatesAPI` for a testify mock, and check on cleanup
  that every `On(...)` was met. A service a test does not mock stays nil, so
  an unexpected call fails the test instead of reaching the real thing. The
  RapidAPI client itself is tested against an `httptest` server.

## Database Migrations (Atlas)

All commands require a `.env` file with `DATABASE_URL` set, and a running Docker
daemon (Atlas spins up a throwaway Postgres to diff against).

```bash
make migrate-diff name=<migration_name>   # generate a migration from GORM model changes
make migrate-apply                        # apply pending migrations
make migrate-status                       # show migration status
make migrate-validate                     # validate the migration directory
make migrate-rehash                       # fix atlas.sum after manual edits
make migrate-new name=<migration_name>    # empty migration for hand-written SQL
```

Migrations are **generated from the GORM models**, never hand-written. Atlas reads
the schema from `cmd/atlas-loader`, so every new model must be registered in that
file's `gormschema.New("postgres").Load(...)` call or it will be silently missing
from the diff.

The one exception is the `currency` schema. `currency.currency_rates` and the
`currency.add_currency_rates(json)` function it is written through are not GORM
models; the only writer is the daily `currency:fetch_rates` task
(`services.FetchCurrencyRates`, 04:00 UTC), which calls the function. They are
created by a hand-written migration and `models.CurrencyRate` is deliberately *not*
registered in `cmd/atlas-loader`. For that to hold, the Atlas dev URL in `atlas.hcl`
is scoped with `?search_path=public` — without it, Atlas sees the schema in the
replayed migration state, does not see it in the desired state, and emits a
`DROP SCHEMA "currency" CASCADE` into the next diff. If you change `atlas.hcl`,
re-run `make migrate-diff` on a no-op and confirm it reports no changes.

## Architecture

### Layer Structure

- `src/api/v1/routes.go` - route groups, one per resource, wiring middleware to handlers
- `src/api/v1/controllers/` - HTTP handlers: parse request, call a service, format response
- `src/services/` - business logic; **all** database access lives here
- `src/models/` - GORM entities, embedding `BaseModel` (uuid id, created_at, deleted_at)
- `src/schemas/` - request/response DTOs, kept separate from models
- `src/queries/` - raw SQL for transactional or complex operations
- `src/tasks/` - background tasks, one file each (type, payload, constructor, handler), plus
  `tasks.Enqueue` and the shared `NewTask` / `Decode` in `tasks.go`
- `src/worker/` - handler wiring (`mux.go`), worker server and cron registry (`schedule.go`)
- `src/middleware/` - `RequireAuth` / `OptionalAuth`
- `src/core/` - config, database, telemetry, and the clients for third-party services
  (Cognito, the Redis task queue, RapidAPI)
- `cmd/atlas-loader/` - feeds the GORM schema to Atlas

### Authentication

AWS Cognito JWT via `Authorization: Bearer <token>`. The middleware validates the
token against the pool's JWKS, checks issuer and `token_use`, and stores the `sub`
claim as a `uuid.UUID` under the Gin context key `user_id`. Handlers read it with
`userId, _ := c.Get("user_id")` and assert `userId.(uuid.UUID)`.

The user's id **is** the Cognito sub; there is no separate identity table. `POST /v1/users`
creates the local row on first login, seeding name and picture from the user pool.

### Key Patterns

- Controllers never touch `core.DB`; services never write HTTP responses
- Model to DTO conversion goes through a `toXSchema` helper in the service
- Global `core.DB` for database access
- Third-party services are reached only through interface-typed globals in `core`
  (`Queue`, `Cognito`, `RatesAPI`), which `Init*` sets at boot and tests replace with
  mocks. A new integration adds one, holding only the methods the API calls
- Soft deletes via `deleted_at`; queries must filter `deleted_at IS NULL`
- Currency codes are stored **lower case** (`uah`, `usd`) everywhere — that is what
  the rates table holds and what clients send. Normalize input with
  `services.normalizeCurrency` rather than comparing raw strings
- Monetary amounts that cross currencies are localized through a
  `services.CurrencyConverter`, which reports a missing rate rather than
  silently converting to zero
- Background work runs on Asynq over Redis. Services enqueue with `tasks.Enqueue(ctx, t, opts...)`,
  delaying with `asynq.ProcessIn` / `asynq.ProcessAt`. A new task is a file in `src/tasks/`
  (see `currency_fetch_rates.go`) with `TypeX`, `XPayload`, `NewXTask` and `XHandler(...)`.
  `src/tasks/` must not import `services` (services import it), so a handler takes the
  service function it calls as an argument, and `worker.NewMux` passes it in:
  `mux.Handle(tasks.TypeX, tasks.XHandler(services.DoX))`. Handlers stay thin like
  controllers. A cron job is also an entry in `periodicTasks` in `src/worker/schedule.go`
  (cron specs are UTC; the payload is built once at boot). `APP_ROLE` picks what the process runs (`all`, `api`, `worker`);
  the scheduler enqueues every entry once per running instance, so only one instance may
  run with `all` or `worker`
- Pagination uses `page` (1-indexed) and `take`, returned in `schemas.PaginatedResponse[T]`
- Config is validated at boot: a missing required env var is a fatal error
- OpenTelemetry (traces, metrics, logs) is wired in `src/core/telemetry.go` and exported
  via OTLP/HTTP (not gRPC — gRPC's long-lived HTTP/2 streams get silently dropped by some
  firewalls/proxies; OTLP/HTTP is plain request/response and goes through the same paths
  ordinary HTTPS does). It is opt-out (`OTEL_SDK_DISABLED=true`), and any exporter/setup
  failure degrades to a no-op rather than failing boot — telemetry must never be why the
  API won't start. `log/slog` is the app-wide logging façade; use `slog.InfoContext`/
  `ErrorContext` (not the bare `slog.Info`/`Error`) so log records correlate with the
  active span

## Environment Variables

```
PORT=8080                      # optional; container platforms inject their own
DATABASE_URL=postgres://user:password@host:5432/dbname
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
REDIS_URL=redis://localhost:6379/0     # Asynq task queue; set maxmemory-policy=noeviction on the instance
APP_ROLE=all                           # optional; all | api | worker
WORKER_CONCURRENCY=10                  # optional; tasks processed in parallel per worker
RAPID_API_KEY=<key>                    # RapidAPI currency-converter5; required when APP_ROLE is all or worker
OTEL_SDK_DISABLED=false                              # optional; disables all telemetry when true
OTEL_SERVICE_NAME=kopiika-api                         # optional
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443  # optional; SigNoz OTLP/HTTP endpoint
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=<key>                 # optional; read by the exporters directly
DEPLOYMENT_ENVIRONMENT=development                    # optional; e.g. development/staging/production
```

## API Documentation

Swagger UI at `/api/docs/index.html`. Global annotations live in `main.go`,
per-endpoint annotations above each controller function.
