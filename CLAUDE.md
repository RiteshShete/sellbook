# Sellbook — owner-only order & sales app

Mobile-first PWA for ONE owner (a small shop in India). Customers never log in or see the app.
The owner adds orders, moves them through a pipeline, generates a bill PNG (with the saved payment QR),
shares it to WhatsApp via the phone share sheet, keeps a stored copy, marks payment by hand, and reviews
monthly analytics. Full design: `docs/PLAN.md` (source of truth for schema, RPCs, screens, milestones).

## STANDING RULE

**Before declaring any task done, run typecheck, lint, tests and build, and report the real results honestly.**
Never claim a command passed unless it ran. If something was skipped or failed, say so with the output.

## Requirements (summary)

1. Catalog: ~5 products, each with variants (price, optional cost price stored but hidden in v1). Create/edit/deactivate/delete (soft).
2. Orders: customer name+phone, order date, optional due date, notes, items (variant+qty), optional discount.
   Item name + unit price are SNAPSHOTTED on the order. Name/phone autocomplete from past orders.
3. Pipeline: new -> ready -> delivered, plus cancelled. `ready` orders = Delivery stack. Every move undoable.
4. Bill: PNG with shop details, bill number, date, customer, lines, discount, total, payment QR ("Scan to pay").
   Shared via share sheet, stored in cloud storage, linked to the order. Re-generating after edits = new
   revision of the same bill number; old images kept.
5. Payment: pending/paid by hand; when paid choose online|cash. App never verifies payments. Back to pending clears mode.
6. Analytics (monthly, Asia/Kolkata): sales, orders, units, AOV, collected, outstanding, online/cash split,
   per-product + per-variant, daily trend, previous-month comparison, pending list with ageing, CSV export.
7. No hard deletes in UI; Trash with restore; per-order version history with one-tap rollback; audit log.
8. Realtime: changes (also from another device) show on open screens without refresh.
9. Free tiers only.

## Decisions (do NOT change without asking the user)

- React + Vite + TypeScript (strict), Tailwind, React Router, TanStack Query, Recharts, html-to-image,
  vite-plugin-pwa, zod, Vitest.
- Supabase free plan (Postgres, Auth, Storage, Realtime); Supabase CLI migrations in `supabase/migrations`.
- Hosting: Cloudflare Pages, GitHub auto-deploy.
- Money: `numeric(12,2)` in Postgres, **integer paise** in JS. Time: `timestamptz`; month boundaries in `Asia/Kolkata`.
- Single owner user, public sign-ups disabled, RLS on every table keyed by `owner_id`, private storage buckets.
- Frontend uses ONLY the anon key. **A service_role key must never appear in the repo** (code, env files, docs, CI).
- Multi-row writes go through Postgres functions via `supabase.rpc` (atomic, one version snapshot each).
- Deletes are soft (`deleted_at`).
- New dependencies beyond the list above need user approval (proposed ones are listed in PLAN.md §16).

## Business rules

- B1 Status: new -> ready -> delivered; cancelled is a separate end state; every step undoable.
- B2 Payment independent of delivery: pending (default) | paid. Mode online|cash required when paid, NULL when pending.
- B3 Total = sum(qty x unit_price snapshot) - discount, never negative.
- B4 Monthly Sales = delivered orders by `delivered_at` in that month (IST). Cancelled and deleted never count.
- B5 Collected = orders by `paid_at` in that month. Outstanding = delivered AND pending, all time.
- B6 Bill number assigned once per order (prefix + sequence in settings), never reused; edits => new revision, same number.
- B7 Bill is "outdated" if items/discount/total changed after its latest revision; UI warns + offers Regenerate.
- B8 Catalog edits/deletes never alter old orders.
- B9 An order needs >= 1 item before moving to ready or delivered.

## Commands

```
npm install
npm run dev            # vite --host (local network; open the printed Network URL on the phone)
npm run build          # tsc -b && vite build
npm run preview        # serve the production build on the network
npm run typecheck      # tsc -b --noEmit
npm run lint           # eslint .
npm run test           # vitest run (TZ forced to Pacific/Honolulu to prove IST logic is device-independent)
npm run format         # prettier --write .
npm run check          # secret scan + typecheck + lint + test + build (run before "done")
supabase start         # (M1+) local stack, needs Docker
supabase db reset      # (M1+) re-apply migrations + seed locally
supabase test db       # (M1+) pgTAP tests in supabase/tests/database
supabase db push       # (M1+) apply migrations to the linked remote project
supabase gen types typescript --local > src/types/database.ts
```

Env (`.env.local`, git-ignored; same names in Cloudflare Pages): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Validated by `src/lib/env.ts` (zod); a missing value shows a readable error screen.

## Folder map

```
src/
  app/            router (lazy routes), providers (QueryClient, Toast), AppLayout, TabBar, Page (sticky header
                  + action slot), ErrorBoundary, RouteError, NotFoundPage, EnvErrorScreen
  features/       auth/ catalog/ orders/ delivery/ billing/ payments/ analytics/ settings/ trash/
                  (each: api/ components/ hooks/ schemas.ts - only what it needs; pages are named XxxPage.tsx)
  components/ui/  Button Input Select BottomSheet Modal Toast Skeleton EmptyState Badge SegmentedControl ConfirmDialog
  lib/            env.ts supabase.ts money.ts dates.ts phone.ts format.ts (+ later queryKeys, csv, share, realtime)
  types/          shared types; database.ts is generated, never hand-edited
supabase/         (M1+) config.toml, migrations/, tests/database/, seed.sql
docs/PLAN.md  scripts/scan-secrets.mjs  public/ (_redirects, later icons/_headers)
```

Tabs (bottom bar): Orders, Delivery, Analytics, Catalog, More (More links to Settings and Trash).
Helper contracts: money = integer paise (`toPaise`, `fromPaise`, `addMoney`, `multiplyMoney`, `formatINR`, `parseMoneyInput`);
dates = always Asia/Kolkata (`monthRange`, `isoMonth`, `todayIST`, `formatDate`, `formatDateTime`);
phone = digits with country code, e.g. `919876543210` (`normalizePhone`, `toWaMeLink`).

## Conventions

- Small components (aim < 150 lines); logic in hooks / `lib`, not in JSX.
- TypeScript strict; **no `any`** (use `unknown` + narrowing/zod). No non-null `!` without a comment why.
- **zod at every boundary**: RPC/table responses, form input, env vars, file uploads. Parse, don't cast.
- Money: only integer paise in JS; convert to/from DB `numeric` at the API layer (`lib/money.ts`). Never use float math on money.
- Time: never use the device timezone for business logic; month ranges are computed in `Asia/Kolkata`
  (DB does the aggregation; JS helpers in `lib/dates.ts` only build ranges, `YYYY-MM` keys and labels).
- **Errors surface as toasts** (mutation `onError` -> toast with readable message). No silent catches.
- **Every query has loading, empty and error states** (skeleton / EmptyState / ErrorState with retry).
- All server state in TanStack Query; centralised query keys in `lib/queryKeys.ts`; mutations invalidate by key.
- Writes touching >1 row => RPC, never several client calls. Orders are written ONLY through RPCs.
- Tailwind only; mobile-first (design at 360px), touch targets >= 44px, safe-area insets respected.
- Migrations are append-only; never edit an applied migration. Every new table: RLS enabled + policies + pgTAP test.
- Tests live next to code (`*.test.ts`); DB tests in `supabase/tests/database`.
- Commits small and focused; never commit secrets, `.env*`, or service_role keys.

## Working agreement

- Follow milestones in `docs/PLAN.md` in order; finish one (its Definition of Done) before starting the next.
- If a requirement is ambiguous or conflicts with a decision above, ask the user; don't guess silently.
- Report honestly: what changed, what was verified (real command output), what remains.
