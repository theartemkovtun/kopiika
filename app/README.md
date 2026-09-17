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

## In a container

```bash
docker compose up --build       # http://localhost:3000, reads .env.local
```

Or without compose:

```bash
docker build -t kopiika-app .
docker run -p 3000:3000 --env-file .env.local kopiika-app
```

Three stages: bun installs from `bun.lock`, node runs `next build`, and the
runtime stage keeps only what `output: "standalone"` produced — the server, its
pruned `node_modules`, `.next/static`, `public/` — on `node:24-alpine` as the
unprivileged `node` user. About 225 MB.

Every value the app reads is `NEXT_PUBLIC_`, and Next inlines those into the
bundle at build time. So the build reads `.env.production` — six
`__NEXT_PUBLIC_API_URL__`-style sentinels and no real values — and
`docker-entrypoint.sh` rewrites them from the environment at startup: one image
runs in any environment, and pointing it at another API is a restart rather
than a rebuild. Locally that file is outranked by your `.env.local`, so
`bun run build` is unaffected. On a platform like Render that means the Docker
runtime with the variables set in the dashboard, nothing passed at build. A
variable left unset is named on stderr when the container starts, instead of
reaching the browser as a literal `__NAME__`.

A new `NEXT_PUBLIC_` variable needs its sentinel added to `.env.production`;
the entrypoint finds it by name from the environment.

## The design

Everything visual comes from the Claude Design canvas, `Kopiika v9`:
<https://claude.ai/design/p/ff82fd75-91cb-4fbb-a975-51f08f8c419f?file=Kopiika+v9.dc.html>

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

Two faces, wired in `src/lib/fonts.ts`:

- **script** — Bad Script, the wordmark, once per page
- **sans** — Google Sans, everything else

v9 collapsed four families into one, so the two roles the extra faces used to
carry are now settings on that one:

- **a heading is the sans in italic** — `italic` on the element, at 400 (500 for
  an account's name), never a separate family. There is no `font-serif`.
- **a figure is the sans with tabular figures** — `font-feature-settings: "tnum"`
  is set on `<html>` in `globals.css`, so a column of amounts lines up without
  any element asking for it. There is no `font-mono` either: both tokens are
  left undefined on purpose, so that a stray `font-mono` copied in from a
  shadcn block shows up as a real monospace instead of passing silently.

The one place that has to name the family itself is `src/lib/charts.ts`:
recharts writes its ticks and tooltips as SVG, which inherits neither the body
font nor the `tnum` setting.

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
    external-auth/ where the Google hand-off lands: no shell, a spinner
  components/
    accounts/     the accounts screen: balances, the new-account form
    auth/         the signed-out screens: field, code cells, footer
    entry/        the new-entry screen: calendar, day list, form
    layout/       sidebar, page header, period strip, mobile drawer
    ledger/       the transactions screen: rows, filter rail, detail dialog
    ui/           shadcn primitives, restyled, plus the ruled form row
  contexts/       user, preferences, period
  hooks/          react-query hooks over src/api, one file per resource,
                  plus the two the signed-out screens need
  i18n/           next-intl routing, navigation helpers, request config
  lib/            accounts, auth, categories, dates, fonts, locales, money,
                  nav
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

Two ways in, both Cognito through Amplify: an email and a password on `/login`,
and Google beside them.

**The form.** `signIn` answers one of three things, and only one of them is a
session. `CONFIRM_SIGN_UP` is an account that was never confirmed, which is
`/totp` rather than an error; `RESET_PASSWORD` is a pool that has forced a
change, which is `/password/reset`. Signing up posts `name` and `email` as
user-pool attributes — the Go API reads the profile off the token's pool, so
what is typed there is what the sidebar greets them with — and arms Amplify's
`autoSignIn`, which `/totp` redeems once the code lands. That is why no password
is ever carried between screens: the only thing handed to `/totp` is the address
(`@/lib/auth/pending`), and the one path that cannot auto-sign-in — arriving at
`/totp` from the sign-in form — confirms the address and asks for the password
again.

**"Remember me"** is a question about cookie lifetime and nothing else, because
the tokens live in cookies. Checked writes dated ones, unchecked writes session
ones, and the choice is applied to the token provider's storage _before_ the
sign-in call and again on every load — a token refresh under the stock storage
would quietly promote a session cookie to a dated one. See
`@/lib/amplify/remember`.

**Google** calls Amplify's `signInWithRedirect({ provider: "Google" })`, which
leaves for Cognito's hosted UI and comes back to `/external-auth` with a code.
That page imports `aws-amplify/auth/enable-oauth-listener` — the import _is_ the
exchange — then awaits `fetchAuthSession`, which blocks while an OAuth flow is
in flight, and forwards on the answer: Overview with tokens, `/login` without.

It sits outside `(auth)` rather than in it, because it is not one of those
screens: no wordmark, no language strip, nothing to read. Just a turning ring on
an empty ground, built out of the same hairline as the icons — the one spinner
in the app, since every other wait here is a skeleton drawn in rules.

Three things have to line up outside the code. The app client needs a
username-and-password flow enabled (`ALLOW_USER_SRP_AUTH`) and self sign-up
allowed on the pool, or the form's first call is refused; every URL in
`NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_IN` must be registered as a callback
URL on that client, or Cognito refuses the Google hand-off; and the tokens are
kept in cookies (`Amplify.configure(..., { ssr: true })`), which is the only
reason middleware can see the session at all.

The locale segment is not part of the callback: Cognito can only return to a
registered URL, so a Ukrainian visitor lands on `/external-auth` and next-intl's
cookie carries the locale back.

Nothing on these screens throws a toast except the two sentences that have to
outlive the screen that earned them — an address confirmed on the way back to
the form, and a password saved. Everything else is the message line above the
submit button, green or red, which is where the design puts it.

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

The comparison note the design puts under each total — "−₴4,000 vs Aug 12" —
is **wired but not drawn**. It is the one thing the API cannot answer in a
single call, so it would cost a second read of the previous period on every
page view, which is a request per period for one line.

What holds it off is two places in `src/components/overview/summary.tsx`: the
`useStatistics(null)` call, which leaves that query disabled rather than
removing it, and the `{false &&` around the note itself. Everything behind it
still works. `usePeriod().comparison` shapes the range — the period before the
selected one, **cut to the same span** while the selected one is still running,
because measuring a month that is three days old against a whole one would read
as a collapse; year view does the same a scale up, January to today against
January to the same day a year earlier, and says so in words rather than naming
a day, since "vs Sep 14" over nine months of figures would read as one. The
note's sign is the change, not the direction of the money: `+₴500` under Spent
means five hundred more went out than by the same point before.

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

2. **An account row leads with its own currency here, and with the converted
   figure on the Accounts screen.** The two are the opposite way round on
   purpose: this panel is a list of accounts, where the Accounts screen is a
   list that has to add up to the total above it. The converted figure appears
   here as the small one beside the balance, and only when the currencies
   differ. Above five accounts the heading says how many are being left out.
3. **A share is a share of categorised spending.** The API leaves uncategorised
   spending out of the category breakdown rather than pooling it, so the slices
   need not add up to Spent above them.

Two smaller notes. Spending is a magnitude on the wire and always shown
negative, so it spells its own sign — `signed` would read `+₴0` on a month with
nothing spent, which is why `MINUS` is exported from `@/lib/money`. And the
recent-entries list is deliberately _not_ bounded by the period strip: it
answers "what have I written lately", which a month-bounded read cannot answer
on the 1st.

### The accounts screen

`/accounts` is one read wide. `GET /v1/accounts/balance` answers every account
and their combined worth together, so the total, the share bar and the rows all
come out of the same response — and the total is the only figure converted,
because it is the only one that has to add up. The figure a row leads with is
therefore the converted one, and the account's own balance sits to its left,
small, and only when the two currencies differ; the API hands back both, so
nothing is converted in the client.

An account is drawn in the `colorHex` stored against it, and the Overview reads
the same field — so an account keeps one colour across both screens, and
however the response happens to be ordered. A stored value that is not a hex
colour falls back to the positional `--ch*` series; see `storedColor`. The bar
is what the total is made of, which is why only accounts in credit take a band:
one in the red subtracts from the total rather than adding to it.

Opening an account is settled in `src/lib/accounts.ts`:

1. **An account has no type.** Earlier designs collected one — debit, wallet,
   deposit, credit — and their rows read "Main card · Debit"; v8 dropped the
   picker and the subtitle and v9 has neither, so nothing is written to the
   API's free `description` any more and no screen reads it.
2. **A colour is picked, not assigned.** `colorHex` is required on create, and
   v9 gives the form a picker for it: six presets — `--ch1`..`--ch6` as the
   nearest sRGB, in `ACCOUNT_SWATCHES` — with a custom colour behind them. The
   field opens on the next swatch in the series, cycled by how many accounts
   are already held so the first six differ, but that is a suggestion at the
   moment of creation only. The colour is then stored on the account and is
   what every screen draws it in.

Two smaller notes. The opening balance may be left empty, and empty is sent as
_no value_ rather than as a zero — which is why it is read with
`parseDecimalInput` rather than `parseAmountInput`: zero is a real answer for an
account and not for an entry. And creating an account drops the accounts tree
and `transactions/configuration` — the latter is the entry form's account
picker, held for five minutes, so without dropping it a new account could not
be posted to until it expired. The rest of the transactions tree is left alone:
an account opens with a balance, not with an entry.

`/accounts/[accountId]` is that same read once more: `useAccount` picks the one
account out of the balance response rather than calling `accounts/{id}`, since
its share of the total is a figure about the whole set anyway — and arriving
from the list then paints without re-reading. The account's own currency leads
there, where the list leads with the converted figure: on a screen about one
account, that account's currency is the subject. Its recent entries come from
the ledger endpoint narrowed to the account, which pages by **day** rather than
by row — fifteen days is the window read to fill a ten-row list, and the
all-time figure beside it counts active days for the same reason. "All entries"
hands the account on to the ledger as `?account=`, which _seeds_ the filter rail
rather than driving it, so narrowing further or clearing it works normally.

Deleting is on that screen, and is the only write on it: `DELETE
/v1/accounts/{id}`, a soft delete, with entries recorded on the account staying
in the ledger — the confirmation says so, which is why the delete drops the
transactions tree as well as the accounts one. Renaming is not there at all:
the API has no update endpoint, so the design's Edit action is left unbuilt
rather than built against something that would fail.

## State of play

Built: the shell, sidebar, routing, contexts, API client, theme, the Settings
screen, the new-entry screen, the ledger, the Overview, Accounts, and signing
in.

Stubbed, showing what belongs in it: Reports. So are the email/password
screens — sign-up, confirmation and password reset — and nothing links to them,
because Google is the only way in.

## A gap that closed

The four-family set had no Cyrillic in its body face: Instrument Sans ships
latin and latin-ext only, so Ukrainian copy fell through to the fallback stack
while the headings and figures around it did not. Google Sans carries Cyrillic,
so v9's single family renders the whole UI in one face in both languages.
