# Kopiika

A rebuild of the Kopiika budget tracker on the new ledger design, against the Go
API (`kopiika-api-go`).

Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · next-intl · TanStack Query ·
AWS Cognito via Amplify.

## Running it

```bash
bun install
cp .env.example .env.local     # fill in the Cognito values
bun dev                        # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` points at `kopiika-api-go` — the bare host, since every
endpoint is already prefixed `/v1`. The API validates the Cognito **id** token
against its user pool's JWKS, so the same pool has to be configured on both
sides.

```bash
bun run build       # production build
bun run typecheck   # tsc --noEmit
bun run lint
```

## The design

Everything visual comes from the Claude Design canvas:
<https://claude.ai/code/artifact/021d00e0-2d88-4a77-92e8-c8e459054736>

The vocabulary is worth knowing before changing anything:

| Token             | Role                                                          |
| ----------------- | ------------------------------------------------------------- |
| `--bg` / `--ink`  | the page ground and the type on it                            |
| `--mute`          | secondary type: notes, labels, inactive controls              |
| `--rule`          | a structural hairline — section and column edges              |
| `--rule2`         | a lighter hairline — between rows inside a section            |
| `--blue`          | emphasis. Resolves to `--ink`; marks the active/selected item |
| `--blue-soft`     | the one pale fill, for a highlighted row                      |
| `--green`/`--red` | income and spending, and nothing else                         |
| `--ch1`..`--ch6`  | categorical series, held at one lightness and one chroma      |

They live in `src/app/globals.css`, spelled exactly as the design spells them,
so a rule copied out of the canvas works unchanged. The shadcn token names
(`--color-background`, `--color-primary`, …) are aliases onto the same values,
which is why an unmodified shadcn component already lands inside the design.

Four type roles, wired in `src/lib/fonts.ts`:

- **script** — Bad Script, the wordmark, once per page
- **serif** — Gentium Book Plus, every heading
- **sans** — Instrument Sans, body and controls
- **mono** — JetBrains Mono, every number and every all-caps micro-label

Three rules the design never breaks: nothing is rounded (the whole radius scale
is `0`), nothing casts a shadow except a dropdown panel, and emphasis is carried
by a rule or a fill rather than by a colour.

## Layout

```
src/
  api/            client, wire types and endpoints for kopiika-api-go
  app/[locale]/
    (auth)/       signed-out shell — login, signup, totp, password reset
    (main)/       signed-in shell — overview, transactions, accounts,
                  reports, new entry, settings
  components/
    layout/       sidebar, page header, period strip, mobile drawer
    ui/           shadcn primitives, restyled
  contexts/       user, preferences, period
  i18n/           next-intl routing, navigation helpers, request config
  lib/            fonts, locales, money, nav
  middlewares/    locale → auth, composed in src/middleware.ts
  providers/      query, theme, amplify
messages/         en.json, uk.json
```

### Routing

`localePrefix: "as-needed"`, so English carries no path segment and Ukrainian
does: `/transactions` and `/uk/transactions`. **Always import `Link`,
`useRouter` and `usePathname` from `@/i18n/navigation`** rather than from
`next/link` and `next/navigation` — they add or omit the segment for you, and
`usePathname` returns the path without it, which is what nav matching wants.

Middleware runs locale first, then auth, threading one response through both so
the locale cookie survives the auth redirect. An unauthenticated visit to
`/uk/settings` lands on `/uk/login`, not on `/login`.

### Signing in

One button. Google is the only provider on the user pool, so `/login` has no
form: it calls Amplify's `signInWithRedirect({ provider: "Google" })`, which
leaves for Cognito's hosted UI and comes back to `/external-auth` with a code.
That page imports `aws-amplify/auth/enable-oauth-listener` — the import _is_ the
exchange — then awaits `fetchAuthSession`, which blocks while an OAuth flow is
in flight, and forwards on the answer: Overview with tokens, `/login` without.

Two things have to line up outside the code. Every URL in
`NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_IN` must be registered as a callback
URL on the app client, or Cognito refuses the hand-off; and the tokens are kept
in cookies (`Amplify.configure(..., { ssr: true })`), which is the only reason
middleware can see the session at all.

The locale segment is not part of the callback: Cognito can only return to a
registered URL, so a Ukrainian visitor lands on `/external-auth` and next-intl's
cookie carries the locale back.

### Contexts

- **`user-context`** — the user record. On a first sign-in the API answers 401
  for a token it trusts but a row it has never seen; the provider creates the
  row once and seeds the cache.
- **`preferences-context`** — display currency and language, both stored on the
  user record so they follow the account. Exposes formatters already bound to
  the current locale and cents setting; prefer those over calling `@/lib/money`
  directly.
- **`period-context`** — the selected month or year. It sits above the routes so
  that walking off to the ledger and back lands on the month you left, and it
  derives the `fromDate`/`toDate` pair every API read wants.

The shell is rendered _outside_ these providers: the sidebar needs no user, so
it paints immediately and only the page content waits.

### Two things to know about the API

Both are easy to get wrong and neither fails loudly:

1. **Every monetary figure is a string**, not a number — the API uses
   `shopspring/decimal`, which marshals quoted, so no amount is ever put through
   a float. Parse at the edge with `toNumber` from `@/lib/money`.
2. **Currency codes are lower case** (`uah`, `usd`). That is what the rates
   table holds and what the API expects to be sent.

Also worth knowing: `GET /v1/transactions` pages by **day**, not by row —
`total` counts days, and one page can hold any number of entries.

## State of play

Built: the shell, sidebar, routing, contexts, API client, theme, the Settings
screen, and signing in.

Stubbed, each screen showing what belongs in it: the Overview panels, the
ledger and its filter rail, Accounts, Reports and the entry form. So are the
email/password screens — sign-up, confirmation and password reset — and nothing
links to them, because Google is the only way in.

## Known gap

Instrument Sans ships latin and latin-ext only — it has **no Cyrillic**, so
Ukrainian body copy falls through to the stack in `src/lib/fonts.ts`. The serif,
mono and script faces all carry Cyrillic, so headings and figures are
unaffected. Worth a decision before the Ukrainian UI ships.
