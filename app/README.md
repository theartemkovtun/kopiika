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
    entry/        the new-entry screen: calendar, day list, form
    layout/       sidebar, page header, period strip, mobile drawer
    ledger/       the transactions screen: rows, filter rail, detail dialog
    ui/           shadcn primitives, restyled
  contexts/       user, preferences, period
  hooks/          react-query hooks over src/api, one file per resource
  i18n/           next-intl routing, navigation helpers, request config
  lib/            categories, dates, fonts, locales, money, nav
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

### The entry screen

`/add` is wired end to end and worth reading before the screens that are not,
because it is where the three API conventions above actually bite.

The calendar on the left _is_ the date field — there is no date row in the form
— so the selected day is the one piece of state the two halves share. Its dots
come from `GET /v1/transactions`, which pages by day: a single page of 31 is the
whole month, and the days it answers with are exactly the days with something on
them. The list under it is `GET /v1/transactions/date/{date}`, which answers
`null` rather than an empty group for a day with nothing on it.

Two rules on the form come from the API rather than from the design. An entry
posted to an account has to be in that account's currency, which is why the
account list is filtered by the currency picked above it and why changing that
currency drops an account that no longer matches. And the amount is normalised
as _text_ — a comma becomes a point, grouping spaces go — so that the decimal
string reaching the wire never passes through a float.

Creating an entry drops both the `transactions` and the `accounts` query trees:
the ledger moved, and so did a balance.

One last thing the wire types do not say: the API seeds ten global categories
whose `name` is a **slug** — `food`, `transportation` — and `messages/*.json`
translates exactly those ten. A category a user creates carries the name they
typed, in the language they typed it, and is shown as written. `categoryLabel`
in `src/lib/categories.ts` picks between the two by id, because the seed
reserves 1..11 and the sequence starts above it.

### The ledger

`/transactions` is the entry screen's other half: everything already written,
newest first.

Paging follows the API rather than the calendar. `GET /v1/transactions` cuts a
page by **day**, so the ledger asks for twenty days at a time and "is there
more" is days seen against days available — never rows, which would over- or
under-count on any day holding more than one entry. A sentinel at the foot of
the list asks for the next page as it comes into view, and a `···` marker says
more is coming; the list simply stops when there is none.

Narrowing keeps what is on screen. The query holds the previous answer
(`placeholderData: keepPreviousData`) rather than blanking to a loading state,
because the rail is used while the ledger is being read — a list that empties on
every checkbox is one you are aiming at blind. Paging pauses while those
stand-in rows are up: they belong to a filter set nobody is reading any more.

Two details in the rows are load-bearing and easy to lose in a refactor. A day
with more than one entry writes its date **once**, and the hairline between
those rows starts at 86px — the 72px date column plus the 14px gap — so the
rows under one date read as a single day. The last row of a month carries no
rule at all: the month heading underneath is the separator.

Editing is where the design and the API disagree, and the API wins twice. The
design's dialog offers a date field, but `PUT /v1/transactions` deliberately has
none — an entry cannot be moved to another day — so the row is shown and not
editable, and moving an entry means deleting it and writing it again. The
currency is fixed for the same reason the entry form filters accounts: an entry
posted to an account has to match it. And the update **replaces every field**,
so an omitted description would be cleared — the dialog does not edit the
description but carries it through untouched.

One addition the design does not have: deleting asks first. A delete is the one
action here with nothing behind it, and `detail.confirm` was already in the
dictionary waiting for it.

### The overview

Three bands, each narrower than the one above it: the totals, what they were
made of, then the entries and balances behind them.

Everything period-bound comes out of **one** read.
`GET /v1/transactions/statistics` answers the three totals, a day-by-day series
and the per-category spending together, and the three panels that draw them all
ask for the same range — so react-query answers the second and third from the
cache. `full` is left off: it buys the counts, averages, extremes and account
breakdowns that Reports wants, and the response keeps its shape without them.

The year view does not ask twelve times. `rangeStatistics` carries every day of
the range, empty ones included, so the monthly bars are that series folded into
twelve buckets. All twelve are always drawn, even mid-year, so that walking back
through the years never changes the width of a bar.

The comparison note under each total — "−₴4,000 vs this point in August" — is
the one thing the API cannot answer in a single call, so a second range is read.
`usePeriod().comparison` is what shapes it: the month before the selected one,
**cut to the same day-of-month** while the selected month is still running,
because measuring a month that is three days old against a whole one would read
as a collapse. Year view has no note at all, and the height it would take is
held anyway so the band does not change shape.

Three places where the design and the API do not line up, and how it was
settled:

1. **A category is drawn in its own colour; an account is not.** The design
   assigns `--ch1`..`--ch6` by position for both, but a category has a real
   colour stored against it — `#00A36C` for food, and whatever was picked for
   one someone created — so the pie and its legend use that, and a category
   reads the same colour here as anywhere else it is marked. `categoryColor` in
   `@/lib/charts` validates the value before using it, because the column is a
   free `varchar(64)` with no format check behind it, and falls back to the
   positional series. Accounts stay positional: the API keeps a `colorHex` for
   them too, but nothing in the design offers a way to choose it — the
   new-account form has no colour field. Their colours are assigned _before_
   the rows are sorted, so the segment in the share bar and the dot beside the
   name agree.

   The one cost of a stored colour is that it is a single colour: it cannot
   lighten for the dark theme the way `--ch*` does, so the seeded `#252525`
   ("other") reads faintly on the dark ground and `#E9DCC9` ("charity") on the
   light.

2. **An account has no type.** The design's rows read "Monobank · debit"; the
   API has only `description`, so that is what the subtitle shows, and nothing
   when it is empty.
3. **A share is a share of categorised spending.** The API leaves uncategorised
   spending out of the category breakdown rather than pooling it, so the slices
   need not add up to Spent above them.

Two smaller notes. Spending is a magnitude on the wire and always shown
negative, so it spells its own sign — `signed` would read `+₴0` on a month with
nothing spent, which is why `MINUS` is exported from `@/lib/money`. And the
recent-entries list is deliberately _not_ bounded by the period strip: it
answers "what have I written lately", which a month-bounded read cannot answer
on the 1st.

One departure from the repo's own type rule, taken from the design file: the
INCOME / SPENT / KEPT labels are the only all-caps micro-labels in the design
set in the sans rather than the mono. Every other one — the ledger rail, the
entry form, TOTAL BALANCE in the same panel — names JetBrains Mono explicitly.

## State of play

Built: the shell, sidebar, routing, contexts, API client, theme, the Settings
screen, the new-entry screen, the ledger, the Overview, and signing in.

Stubbed, each screen showing what belongs in it: Accounts and Reports. So are
the email/password screens — sign-up, confirmation and password reset — and
nothing links to them, because Google is the only way in.

## Known gap

Instrument Sans ships latin and latin-ext only — it has **no Cyrillic**, so
Ukrainian body copy falls through to the stack in `src/lib/fonts.ts`. The serif,
mono and script faces all carry Cyrillic, so headings and figures are
unaffected. Worth a decision before the Ukrainian UI ships.
