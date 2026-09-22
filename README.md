# Kopiika

A personal budget tracker: a Go API and the Next.js app that runs on it.

```
api/   Go REST API — Gin, GORM, PostgreSQL, Atlas migrations, OpenTelemetry
app/   Web app — Next.js 16, React 19, Tailwind 4, shadcn/ui, next-intl, TanStack Query
```

Both sides authenticate against the same AWS Cognito user pool: the app signs in
through Amplify, and the API validates the Cognito **id** token against that
pool's JWKS. If the pool differs between the two, every request is a 401.

## Running it locally

**API** — PostgreSQL and an OpenTelemetry collector come with the compose file.

```bash
cd api
cp env.sample .env                # set COGNITO_REGION and COGNITO_USER_POOL_ID
docker compose up --build         # http://localhost:8080
```

Or against a Postgres you already have: `make migrate-apply`, then `go run .`.
Swagger UI is served at <http://localhost:8080/api/docs/index.html>.

**App**

```bash
cd app
bun install
cp .env.example .env.local        # Cognito values; NEXT_PUBLIC_API_URL=http://localhost:8080
bun dev                           # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` is the bare host — every endpoint already carries `/v1`.

## Further reading

- [`app/README.md`](app/README.md) — the design tokens, layout, routing, sign-in
  flow, and how each screen maps onto the API.
- [`api/CLAUDE.md`](api/CLAUDE.md) — build and migration commands, the layer
  structure, and authentication.

## History

This repository was assembled from two separate ones, `kopiika-api-go` and
`kopiika-app-2`, with their histories rewritten into `api/` and `app/` and
joined in a single merge commit. `git log` and `git blame` on any file reach
back to its original commits.

## License

[MIT](LICENSE)
