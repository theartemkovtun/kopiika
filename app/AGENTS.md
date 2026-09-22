<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kopiika

A budget tracker on a print-inspired ledger design, talking to `kopiika-api-go`.
Read `README.md` first — it carries the design vocabulary and the layout map.

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
bun run typecheck && bun run lint && bun run build
```

ESLint is pinned to 9: `eslint-plugin-react`, pulled in by
`eslint-config-next`, still calls `context.getFilename()`, which ESLint 10
removed.
