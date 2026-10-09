# Sellbook — Technical Plan

Status: approved; M0–M2 built. **Where this plan and §3.0 "As built" disagree, §3.0 wins** (owner decision, 2026-10-09).

## 0. Assumptions & open points

No question is genuinely blocking. I will proceed on these assumptions unless you correct them:

| #   | Assumption                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Auth = email + password** (one user, created manually in the Supabase dashboard). Not magic link/OTP: on iOS, an installed PWA has separate storage from Safari and magic links open in Safari, so the PWA would never get the session. |
| A2  | Phone numbers are Indian: user types 10 digits (optional +91/0 prefix); stored normalised as `+91XXXXXXXXXX`. Non-Indian numbers are out of scope for v1.                                                                                 |
| A3  | `order_date` and `due_date` are calendar `date`s (IST as entered). `delivered_at`, `paid_at`, `ready_at`, `cancelled_at`, `created_at` are `timestamptz` set by the server with `now()`.                                                  |
| A4  | Strict status steps (new->ready->delivered; no skipping). Cancel allowed from new/ready/delivered. Undoing a cancel returns to the status it was cancelled from.                                                                          |
| A5  | Orders never go back through "delete" to affect history: deleting an order = soft delete (Trash); it is excluded from every metric until restored.                                                                                        |
| A6  | **Collected** excludes cancelled/deleted orders (a cancelled order that was marked paid is not counted; you should set it back to pending / refund by hand).                                                                              |
| A7  | Per-product / per-variant breakdown shows **gross line revenue (before order discount)** and units, labelled as such; discount is order-level so these do not sum to Sales. Sales/AOV use net totals.                                     |
| A8  | Rollback restores the _whole_ order (fields, items, status, payment) to the chosen version and itself creates a new version. It does not touch stored bill images; the bill then shows "outdated" if content differs (B7).                |
| A9  | Bill is shown/shared at a fixed 1080px-wide portrait PNG (height varies with line count). One shop, one currency (INR), no tax/GST lines in v1 (a free-text "GSTIN / footer note" in settings is printed if filled).                      |
| A10 | v1 is online-only: PWA installs and loads offline (app shell) but data needs network; an offline banner blocks writes. No offline queue.                                                                                                  |
| A11 | Customers are not a table; autocomplete is `DISTINCT` over past (non-deleted) orders, most recent first.                                                                                                                                  |
| A12 | Setting `delivered_at`/`paid_at` always uses "now"; no back-dating UI in v1 (flagged as a likely v1.1 request, since it affects monthly numbers).                                                                                         |

Dependencies I would add beyond your list (**need your approval**, see §16): ESLint + typescript-eslint, `@supabase/supabase-js`, `sonner` (toasts), `lucide-react` (icons), `@testing-library/react` + `jsdom` (component tests), `@fontsource/inter` (self-hosted font for bill rendering). pgTAP is built into the Supabase CLI (no dependency).

---

## 1. Architecture

```
 Phone (PWA, installed from URL)
   React SPA  --(anon key + owner JWT)-->  Supabase
     |  TanStack Query cache                 |- Auth (1 user, signups off)
     |  html-to-image (bill PNG, client)     |- Postgres (RLS, RPC functions, triggers)
     |  Realtime websocket <-----------------|- Realtime (postgres_changes)
     |                                       '- Storage (private: `bills`, `assets`)
 Cloudflare Pages (static hosting, GitHub auto-deploy; no server code)
```

- **No backend server.** All trust sits in Postgres: RLS + `SECURITY DEFINER` RPCs that check `auth.uid()`.
- Bill images are rendered **on the device** (no Edge Functions / headless browser needed => free-tier friendly).
- Server owns: totals, snapshots, status/payment validity, bill numbers, versions, audit rows, analytics math.
  Client owns: forms, optimistic UI where safe, rendering the bill, sharing.
- Cache + freshness: TanStack Query with `staleTime` ~30s; Realtime events invalidate keys (see §8).

## 2. Folder structure

See CLAUDE.md "Folder map". Additional detail:

```
src/features/orders/
  api/ordersApi.ts       rpc + select wrappers, zod-parsed
  schemas.ts             zod: OrderFormSchema, OrderRowSchema, ItemSchema
  hooks/                 useOrders, useOrder, useCreateOrder, useUpdateOrder, useSetStatus, useSetPayment...
  components/            OrderCard, OrderForm, ItemPicker, CustomerAutocomplete, StatusStepper, PaymentSheet
src/features/bill/
  BillTemplate.tsx       pure presentational, fixed width, inline-safe styles
  renderBill.ts          fonts/images preload + html-to-image -> Blob
  useBill.ts             reserve number, upload, register revision
src/lib/money.ts         toPaise, fromPaise, formatINR, sumPaise
src/lib/time.ts          monthKey(), monthLabel(), prevMonthKey() (IST)
```

## 3. Data model

Conventions: every table has `id uuid pk default gen_random_uuid()`, `owner_id uuid not null default auth.uid() references auth.users(id)`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (trigger `set_updated_at`). Soft-deletable tables add `deleted_at timestamptz null`. Money = `numeric(12,2)`.

### 3.0 As built (authoritative)

The applied migrations (`supabase/migrations`) differ from the original design below. The built schema is the source of truth; later milestones extend it instead of reshaping it.

- **Security model:** every function is `SECURITY INVOKER` with `set search_path = ''`, so RLS always applies (not `SECURITY DEFINER`). `authenticated` has owner-only SELECT/INSERT/UPDATE policies on every table. DELETE is revoked everywhere except `order_items` (an order edit replaces its item rows). "Orders are written only through RPCs" is a client-code rule, not enforced by policy.
- **Enums:** `order_status` (new, ready, delivered, cancelled), `payment_status` (pending, paid), `payment_mode` (online, cash).
- **settings:** own `id` pk + unique `owner_id`. `next_bill_no` (not `next_bill_seq`), `bill_footer` (not `footer_note`), plus `upi_id`, `default_country_code`, `timezone`, `last_backup_at`. `shop_address`/`shop_phone` are `not null default ''`. Bill numbers come from `next_bill_no()`.
- **products:** no `description`.
- **orders:** `order_no` per-owner number (default `next_order_no()`, advisory-locked). `bill_no integer` (display = prefix + number) instead of `bill_seq`/`bill_number`. `customer_phone` nullable, stored as digits with country code (`919876543210`, see `lib/phone.ts`). `total` maintained by triggers from items and discount (B3). Status/payment timestamps maintained by the `orders_apply_timestamps` trigger. Not built yet, added when needed: `version_no` (M3), `cancelled_from` (M4), `content_hash` (M6). No `subtotal` column.
- **order_items:** extra `cost_price` snapshot; quantity 1..100000; no `product_id`.
- **bills:** `bill_no`, `revision`, `image_path`, `total_at_generation`, `items_hash`, `generated_at`.
- **order_versions** (M3): insert-only, full snapshot per version; `version_no` on orders. **audit_log** (M5): insert-only; order rows written by `record_order_version`, catalog/settings rows by the `audit_row_change` trigger (no-op updates skipped). `orders.cancelled_from` added in M4.
- **Storage:** path `<owner_id>/<yyyy>/<file>`; both buckets accept png/jpeg/webp (`assets` 2 MB, `bills` 3 MB). Bill files are immutable (no UPDATE/DELETE policy); asset files can be replaced/removed.
- **Built RPCs:** `init_settings`, `upsert_product`, `trash_product`/`restore_product`, `trash_variant`/`restore_variant`, `create_order`, `update_order`, `suggest_customers`, `set_order_status`, `set_payment`, `trash_order`/`restore_order`, `rollback_order`, `next_order_no`, `next_bill_no`, `compute_order_total`, `ping`, `bill_content_hash`, `reserve_bill_number`, `register_bill_revision` (M6), `month_window`, `analytics_month`, `pending_payments`, `export_orders_csv_rows` (M7), `prep_list` (prep list). Order RPCs take the expected `version_no` and raise SQLSTATE `SB409` when stale.
- **Analytics (M7):** `analytics_month` returns money as JSON numbers (parsed to paise by zod). by_product groups by `variants.product_id` (order_items has no `product_id`), falling back to the name snapshot. Online/cash split is a two-part proportion bar with labels instead of a donut (a 2-slice donut is hard to read). `/pending` is reachable from the Outstanding card and from More.
- **Prep list (added after M7, user request):** Orders screen has two views, `Orders | To prepare` (`/orders?view=prep`). `prep_list()` sums the items of every `new`, non-trashed order per product and variant (catalog order; only ordered products). Marking an order Ready removes it. No date filter and no stock tracking (the owner compares with stock by hand).
- **Variant sizes (user request):** `variants.size_amount numeric(12,3)` + `size_unit` enum (`g`, `ml`, `pcs`; both or neither), snapshotted onto `order_items` like name/price (B8) and kept by edits and rollback. Lines saved before sizes existed fall back to the variant's current size (`item_size()`). Owner types g/kg/ml/L/pcs in Catalog; stored in base units. Totals (quantity x size per unit) show in the prep list, Analytics 'What sold' and order detail ('6.25 kg'); unsized lines count as items.
- **DB tests without Docker:** `bash scripts/test-db-linked.sh` runs every pgTAP file on the linked project inside a transaction that always rolls back.
- **Environments:** one hosted Supabase project is used for development (no local Docker). pgTAP files run on it via `scripts/test-db-linked.sh` (always rolled back) until Docker works.

### 3.1 `settings` (exactly one row per owner)

| column        | type                        | notes                                                                   |
| ------------- | --------------------------- | ----------------------------------------------------------------------- |
| owner_id      | uuid **pk**                 | one row; created by migration seed RPC `init_settings()` on first login |
| shop_name     | text not null default ''    |                                                                         |
| shop_address  | text                        | multi-line                                                              |
| shop_phone    | text                        |                                                                         |
| footer_note   | text                        | e.g. GSTIN / thanks message                                             |
| logo_path     | text null                   | storage path in `assets`                                                |
| qr_path       | text null                   | storage path in `assets` (payment QR)                                   |
| bill_prefix   | text not null default 'INV' | check `bill_prefix ~ '^[A-Za-z0-9-]{0,10}$'`                            |
| next_bill_seq | integer not null default 1  | check `>= 1`; only changed by `reserve_bill_number`                     |
| updated_at    | timestamptz                 |                                                                         |

### 3.2 `products`

`name text not null (check length 1..80)`, `description text`, `sort_order int not null default 0`, `is_active boolean not null default true`, `deleted_at`.
Indexes: `(owner_id) where deleted_at is null`; unique `(owner_id, lower(name)) where deleted_at is null`.

### 3.3 `variants`

`product_id uuid not null references products(id)`, `name text not null` (e.g. "500 g", "Chocolate"), `price numeric(12,2) not null check (price >= 0)`, `cost_price numeric(12,2) null check (cost_price >= 0)`, `sort_order int default 0`, `is_active boolean default true`, `deleted_at`.
Indexes: `(product_id) where deleted_at is null`; unique `(product_id, lower(name)) where deleted_at is null`.
`is_active=false` hides from the order item picker but keeps it everywhere else; soft delete moves it to Trash.

### 3.4 `orders`

| column                                 | type                                                            | constraints / notes                                                          |
| -------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| customer_name                          | text not null                                                   | length 1..100                                                                |
| customer_phone                         | text not null                                                   | check `~ '^\+91[6-9][0-9]{9}$'`                                              |
| order_date                             | date not null default (now() at time zone 'Asia/Kolkata')::date |                                                                              |
| due_date                               | date null                                                       | check `due_date is null or due_date >= order_date`                           |
| notes                                  | text null                                                       |                                                                              |
| status                                 | text not null default 'new'                                     | check in (`new`,`ready`,`delivered`,`cancelled`)                             |
| cancelled_from                         | text null                                                       | check in (`new`,`ready`,`delivered`); set only when cancelled                |
| subtotal                               | numeric(12,2) not null default 0                                | = sum(items.line_total), maintained by RPCs                                  |
| discount                               | numeric(12,2) not null default 0                                | check `discount >= 0 and discount <= subtotal` (so total never negative, B3) |
| total                                  | numeric(12,2) not null default 0                                | check `total = subtotal - discount` and `total >= 0`                         |
| payment_status                         | text not null default 'pending'                                 | check in (`pending`,`paid`)                                                  |
| payment_mode                           | text null                                                       | check in (`online`,`cash`)                                                   |
| paid_at                                | timestamptz null                                                |                                                                              |
| ready_at / delivered_at / cancelled_at | timestamptz null                                                | set/cleared by `set_order_status`                                            |
| bill_seq                               | integer null                                                    | assigned once by `reserve_bill_number` (B6)                                  |
| bill_number                            | text null                                                       | `prefix                                                                      |     | '-' |     | lpad(seq,4,'0')`, assigned with seq; never changes |
| content_hash                           | text not null default ''                                        | md5 of canonical (items, discount, total); maintained by RPCs (B7)           |
| version_no                             | integer not null default 1                                      | optimistic concurrency + history pointer                                     |
| deleted_at                             | timestamptz null                                                |                                                                              |

Table-level CHECKs:

- `payment_consistent`: `(payment_status='paid' and payment_mode is not null and paid_at is not null) or (payment_status='pending' and payment_mode is null and paid_at is null)` (B2).
- `status_timestamps`: `status <> 'delivered' or delivered_at is not null`; `status <> 'cancelled' or (cancelled_at is not null and cancelled_from is not null)`.
- Unique `(owner_id, bill_seq) where bill_seq is not null` (B6 never reused).

Indexes:

- `(owner_id, status, created_at desc) where deleted_at is null` — pipeline lists, Delivery stack.
- `(owner_id, delivered_at) where status='delivered' and deleted_at is null` — monthly sales.
- `(owner_id, paid_at) where payment_status='paid' and deleted_at is null` — collected.
- `(owner_id, delivered_at) where status='delivered' and payment_status='pending' and deleted_at is null` — outstanding/ageing.
- `(owner_id, lower(customer_name) text_pattern_ops)`, `(owner_id, customer_phone text_pattern_ops)` — autocomplete.
- `(owner_id, deleted_at) where deleted_at is not null` — Trash.

### 3.5 `order_items`

`order_id uuid not null references orders(id)`, `variant_id uuid null references variants(id) on delete set null` (traceability only), `product_id uuid null` (no FK; for grouping), `product_name text not null`, `variant_name text not null` (snapshots), `unit_price numeric(12,2) not null check >= 0` (snapshot), `quantity integer not null check (quantity between 1 and 10000)`, `line_total numeric(12,2) generated always as (unit_price * quantity) stored`, `position int not null`.
Indexes: `(order_id)`, `(owner_id, variant_id)`. Unique `(order_id, position)`.
Items are hard-deleted/replaced only inside `update_order`/`rollback_order` (they are captured in `order_versions` first); not user-visible deletes.

### 3.6 `order_versions`

`order_id uuid not null references orders(id)`, `version_no int not null`, `snapshot jsonb not null` (full order row + items array), `reason text not null` (`create|edit|status|payment|delete|restore|rollback`), `summary text` (human line e.g. "Qty of Cake 1kg 2 -> 3"), `created_at`. Unique `(order_id, version_no)`. Insert-only (no update/delete policy). Index `(order_id, version_no desc)`.

### 3.7 `bills`

`order_id uuid not null references orders(id)`, `bill_number text not null`, `revision int not null`, `storage_path text not null` (bucket `bills`), `content_hash text not null` (copy of `orders.content_hash` at generation), `total numeric(12,2) not null`, `created_at`. Unique `(order_id, revision)`, unique `storage_path`. Index `(order_id, revision desc)`. Insert-only. Outdated (B7) := `orders.content_hash <> latest_bill.content_hash`.

### 3.8 `audit_log`

`id bigint generated always as identity pk`, `owner_id`, `entity text` (`order|product|variant|settings|bill`), `entity_id uuid`, `action text` (`create|update|delete|restore|status|payment|rollback|bill`), `summary text`, `before jsonb`, `after jsonb`, `created_at`. Insert-only. Index `(owner_id, created_at desc)`, `(entity, entity_id)`.

### 3.9 Triggers

- `set_updated_at` on every mutable table.
- `audit_catalog` AFTER INSERT/UPDATE on `products`, `variants`, `settings` -> writes `audit_log` (single-row catalog/settings writes are direct, so triggers cover them; secrets none).
- `block_direct_order_writes`: not a trigger — orders/items/versions/bills have **no INSERT/UPDATE/DELETE policy** for `authenticated`; only SECURITY DEFINER RPCs write them.

## 4. RLS & storage policy design

Sign-ups disabled (`supabase/config.toml: enable_signup = false`, plus the same toggle in the hosted dashboard — manual checklist item in M1). One user created in dashboard.

For every table: `alter table ... enable row level security; alter table ... force row level security;`

- Role `anon`: **no policies, no grants** on any table or function (revoke defaults).
- Role `authenticated`:
  | table                                                 | SELECT                | INSERT                                     | UPDATE                                  | DELETE                                   |
  | ----------------------------------------------------- | --------------------- | ------------------------------------------ | --------------------------------------- | ---------------------------------------- |
  | settings                                              | owner_id = auth.uid() | via `init_settings()` only                 | owner_id = auth.uid() (with check same) | none                                     |
  | products, variants                                    | owner                 | owner (`with check owner_id = auth.uid()`) | owner                                   | none (soft delete = UPDATE `deleted_at`) |
  | orders, order_items, order_versions, bills, audit_log | owner                 | **none**                                   | **none**                                | **none**                                 |
- All policies use `(select auth.uid())` form for plan caching. `owner_id` default `auth.uid()`; a trigger rejects any UPDATE that changes `owner_id`.
- Defence in depth: a `BEFORE INSERT` check on catalog tables ensures `owner_id = auth.uid()`; pgTAP verifies a second fake user (created in test only) cannot read/write anything.
- RPCs: `SECURITY DEFINER`, `set search_path = ''` (fully qualified names), first statement `v_owner := auth.uid(); if v_owner is null then raise exception 'not authenticated'`, all queries filter `owner_id = v_owner`. `revoke all on function ... from public, anon; grant execute ... to authenticated;`.
- Storage buckets (both **private**, `public=false`), created in migration:
  - `bills` — files `{owner_id}/{order_id}/{uuid}.png`; `allowed_mime_types = image/png`; `file_size_limit = 2MB`.
  - `assets` — files `{owner_id}/qr-{uuid}.{png|jpg|webp}`, `logo-{uuid}.*`; images only; 2MB.
  - `storage.objects` policies for role `authenticated`: SELECT / INSERT on bucket and `(storage.foldername(name))[1] = auth.uid()::text`; `bills`: no UPDATE/DELETE (immutable history); `assets`: UPDATE/DELETE allowed for own folder (replacing QR/logo) — old QR objects are removed by the client after the settings update succeeds.
  - Access from the app via `createSignedUrl` (TTL 1h) or authenticated `download()`; never public URLs.
- Secrets hygiene: repo only contains `VITE_SUPABASE_URL` + anon key names (`.env.example` with placeholders). CI/lint step greps for `service_role` and JWT-shaped strings and fails the build (M0).

## 5. RPC functions

All return typed JSON/rows parsed by zod on the client. All write an `order_versions` row (orders) and `audit_log` row, inside the same transaction. "v" = expected `version_no` for optimistic concurrency (a stale `v` raises `stale_version`, client toasts "Order changed on another device — reloaded").

| Function                                                                                   | Behaviour                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_order(p jsonb) returns orders`                                                     | p = `{customer_name, customer_phone, order_date?, due_date?, notes?, discount?, items:[{variant_id, quantity}]}`. Validates & normalises phone; **snapshots** product_name/variant_name/unit_price from `variants` (must be active, not deleted); computes subtotal/total/content_hash; inserts order + items; version 1 (`create`). Items may be empty (draft `new`; B9 enforced at ready/delivered). |
| `update_order(p_id uuid, p jsonb, v int) returns orders`                                   | Edits header fields, discount, items `[{id?, variant_id, quantity}]`. Existing item with same `id`+`variant_id` keeps its snapshot; new/changed variant gets current snapshot. Rebuilds items, recomputes totals/hash. Rejects: discount > subtotal; removing all items when status in (ready, delivered) (B9); editing deleted order. Bumps version.                                                  |
| `set_order_status(p_id uuid, p_status text, v int) returns orders`                         | Validates transition map (A4). B9: items >= 1 for ready/delivered. Sets/clears `ready_at`, `delivered_at`, `cancelled_at`, `cancelled_from` so **undo = the reverse transition** (delivered->ready clears delivered_at; ready->new clears ready_at; cancelled->cancelled_from).                                                                                                                        |
| `set_payment(p_id uuid, p_status text, p_mode text, v int) returns orders`                 | paid requires mode; sets `paid_at = now()`; pending forces mode NULL and `paid_at` NULL (B2). Independent of status.                                                                                                                                                                                                                                                                                   |
| `trash_order(p_id uuid) / restore_order(p_id uuid)`                                        | set/clear `deleted_at` on order (items untouched). Version + audit.                                                                                                                                                                                                                                                                                                                                    |
| `rollback_order(p_id uuid, p_version int) returns orders`                                  | Loads snapshot, replaces header/items/status/payment/timestamps from it (keeping bill_seq/bill_number as-is), recomputes hash, new `version_no` with reason `rollback`. Refuses if target version == current. Does not resurrect a hard-missing variant (snapshots are self-contained).                                                                                                                |
| `upsert_product(p jsonb) returns jsonb`                                                    | Creates/updates a product + its variants list in one transaction (used by the catalog editor). Variants omitted from payload are left unchanged (deleting is explicit).                                                                                                                                                                                                                                |
| `trash_product(p_id uuid) / restore_product(p_id uuid)`                                    | Product + its variants soft-deleted/restored together; restore only restores variants whose `deleted_at` equals the product's deleted timestamp.                                                                                                                                                                                                                                                       |
| `trash_variant(p_id) / restore_variant(p_id)`                                              | Single variant; restore fails with message if parent product is trashed.                                                                                                                                                                                                                                                                                                                               |
| `reserve_bill_number(p_order uuid) returns jsonb{bill_number}`                             | Idempotent: if `bill_seq` already set return it. Else `update settings set next_bill_seq = next_bill_seq+1 returning` (row-locked, atomic) and stamp order. Seq never reused even if render later fails (gap acceptable).                                                                                                                                                                              |
| `register_bill_revision(p_order uuid, p_path text, p_hash text) returns bills`             | Verifies `p_hash = orders.content_hash` (else `stale_order`, client re-renders), verifies object exists & path prefix `owner/order`, `revision = coalesce(max,0)+1`, inserts bill row with total. Audit `bill`.                                                                                                                                                                                        |
| `suggest_customers(p_q text, p_limit int = 8) returns table(name, phone, last_order_date)` | Distinct latest per phone among non-deleted orders; prefix match on name or phone.                                                                                                                                                                                                                                                                                                                     |
| `analytics_month(p_month text) returns jsonb`                                              | `p_month='YYYY-MM'`. Window `[start, end)` = `(p_month                                                                                                                                                                                                                                                                                                                                                 |     | '-01')::timestamp at time zone 'Asia/Kolkata'`to +1 month. Returns`{sales, orders, units, aov, collected, collected_online, collected_cash, outstanding_total, outstanding_count, by_product[], by_variant[], daily[{date, sales, orders}]}`. Definitions per B4/B5 (see §5.1). Frontend calls it for the month and the previous month for comparison. |
| `pending_payments() returns table(...)`                                                    | Delivered + pending orders, all time, with `age_days` (IST days since `delivered_at`) and bucket (0-7, 8-30, 31-60, 60+).                                                                                                                                                                                                                                                                              |
| `export_orders_csv_rows(p_month text)`                                                     | Rows backing the CSV (orders delivered in month with items concatenated). CSV is built client-side (`lib/csv.ts`, RFC4180 escaping, UTF-8 BOM so Excel opens ₹ correctly).                                                                                                                                                                                                                             |
| `init_settings()`                                                                          | Creates the owner's settings row if missing (called after login).                                                                                                                                                                                                                                                                                                                                      |

### 5.1 Analytics definitions (exact)

- Sales = `sum(total)` of orders with `status='delivered'`, `deleted_at is null`, `delivered_at in window`.
- Orders = count of the same set; Units = `sum(quantity)` over their items; AOV = Sales / Orders (0 if none).
- Collected = `sum(total)` where `payment_status='paid'`, `paid_at in window`, `status <> 'cancelled'`, `deleted_at is null`; online/cash split by `payment_mode`.
- Outstanding = `sum(total)` where `status='delivered'`, `payment_status='pending'`, not deleted, **all time**.
- by_product / by_variant: from the same delivered set; group by `product_id` / `variant_id` (fall back to name snapshot when id null); gross `sum(line_total)`, `sum(quantity)`, order count; display name = most recent snapshot name (A7).
- daily: `date_trunc('day', delivered_at at time zone 'Asia/Kolkata')`, **zero-filled** by `generate_series` for every day of the month.
- Previous-month deltas computed client-side from two calls; "n/a" if previous = 0.

## 6. Screen map & routes

Bottom nav (5): Orders · Delivery · **+ New** · Analytics · More. All routes except `/login` are guarded.

| Route                 | Screen                | Notes                                                                                                                                        |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`              | Login                 | email+password; no signup link                                                                                                               |
| `/`                   | redirect to `/orders` |                                                                                                                                              |
| `/orders`             | Orders list           | tabs New / Ready / Delivered / Cancelled / All; search by name/phone/bill no; payment badge; due-date highlight                              |
| `/orders/new`         | Order form            | customer autocomplete, item picker (product -> variant chips), qty stepper, discount, live total                                             |
| `/orders/:id`         | Order detail          | status stepper with Undo, payment sheet, bill card (preview, revision history, "Outdated — Regenerate"), Share, Edit, History, Move to Trash |
| `/orders/:id/edit`    | Edit order            | same form; save via `update_order`                                                                                                           |
| `/orders/:id/history` | Version history       | list of versions with diff summary; "Roll back to this version" with confirm                                                                 |
| `/delivery`           | Delivery stack        | ready orders only (grouped by due date), one-tap Mark delivered, payment shortcut                                                            |
| `/analytics`          | Monthly analytics     | month picker (`?month=YYYY-MM`), KPI cards + deltas, Recharts daily trend, online/cash donut, product/variant tables, CSV button             |
| `/pending`            | Pending payments      | ageing buckets + list, tap -> order                                                                                                          |
| `/catalog`            | Products              | list incl. inactive; add product                                                                                                             |
| `/catalog/:productId` | Product editor        | name, variants (price, cost, active), deactivate, trash                                                                                      |
| `/trash`              | Trash                 | tabs Orders / Products / Variants; Restore                                                                                                   |
| `/activity`           | Audit log             | filter by entity; infinite list                                                                                                              |
| `/settings`           | Shop settings         | shop details, logo, QR upload with preview, bill prefix, footer note, sign out                                                               |
| `*`                   | Not found             |                                                                                                                                              |

Every list screen implements loading skeleton, empty state, error state with retry.

## 7. Real-time strategy

- Add `orders, order_items, products, variants, bills, settings` to publication `supabase_realtime` (migration). RLS applies to Realtime, so only the owner's rows are delivered.
- One `useRealtimeSync()` hook mounted at app root opens a single channel (`postgres_changes`, event `*`, per table). Events map to query-key invalidation (`orders` -> `['orders']`, `['order', id]`, `['analytics']`, `['pending']`; `variants/products` -> `['catalog']`; `bills` -> `['order', order_id]`).
- An RPC touches several rows -> a burst of events; **coalesce** invalidations with a 250 ms trailing debounce keyed by query key.
- Resilience: on channel `SUBSCRIBED` after a reconnect, and on `visibilitychange -> visible` and `online`, invalidate everything (mobile browsers suspend sockets). Auth token refresh -> `supabase.realtime.setAuth`.
- Own-write echo is harmless (invalidate = refetch, idempotent). Optimistic updates only for status/payment taps; rolled back on error with a toast.
- Free tier: 200 concurrent connections / 2M messages per month — single-user usage is far below this.

## 8. Bill rendering & sharing

**Template**: `BillTemplate` is a fixed `width: 540px` element (rendered at `pixelRatio: 2` -> 1080px PNG), white background, shop header (logo/name/address/phone), bill number + date, customer name/phone, item table (name+variant, qty, unit, line total), subtotal, discount, **total**, QR block (QR image with white quiet-zone padding, caption "Scan to pay"), footer note. Uses `₹` and tabular numbers; Indian grouping via `Intl.NumberFormat('en-IN')`.

**Flow** (`useBill`):

1. Block if order has 0 items. `reserve_bill_number` (idempotent).
2. Load shop settings; fetch logo + QR as **blobs** via authenticated `download()` -> `URL.createObjectURL` (never raw signed URLs inside the DOM to avoid CORS-tainting).
3. Mount template in an off-screen container; wait for `document.fonts.ready` and `img.decode()` for every image.
4. `toBlob` with html-to-image (`pixelRatio: 2`, `cacheBust: false`, `backgroundColor: '#fff'`, explicit `width/height`).
5. Upload to `bills/{owner}/{order}/{uuid}.png` (`upsert:false`), then `register_bill_revision(order, path, content_hash)`. If it returns `stale_order` (edited meanwhile), re-render once.
6. Keep the Blob in memory (React state/ref) so Share is instant.

**Share** (a distinct user tap, after the blob exists): `navigator.canShare({files:[file]})` then `navigator.share({files:[new File([blob], 'INV-0001.png',{type:'image/png'}), title, text])`. Fallbacks in order: (a) download via `<a download>`; (b) open the image in a new tab with "long-press to save/share" hint; (c) "Open WhatsApp chat" button to `https://wa.me/91XXXXXXXXXX?text=...` (text only; WhatsApp cannot be given a file by URL — owner then attaches the saved image). AbortError (user cancels sheet) is silent, not an error toast.

**Outdated (B7)**: Order detail shows a warning chip + "Regenerate" when `orders.content_hash <> latest bills.content_hash` or no bill exists; Share always shares the latest stored revision after confirming; list of all revisions viewable.

**iOS Safari / WebKit pitfalls & mitigations**

| Pitfall                                                                                                          | Mitigation                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `navigator.share` needs _transient user activation_; `await`ing a slow render before it throws `NotAllowedError` | Two-phase UI: Generate (async) then Share (immediate); after generation the Share button is enabled and calls `share()` synchronously with the cached Blob.        |
| html-to-image on Safari sometimes renders images/fonts blank on the first pass                                   | Preload + `decode()` all images; run a warm-up `toPng` once (discard) before the real capture; retry once if output blob < expected size or canvas is blank.       |
| Cross-origin images taint canvas / fail in `foreignObject`                                                       | All images converted to same-origin blob/data URLs first (§8 step 2).                                                                                              |
| Web fonts from third-party CSS cannot be inlined (cssRules CORS)                                                 | Self-host the font (`@fontsource/inter`, bundled woff2), `fontEmbedCSS` provided explicitly; ensure `₹` glyph exists.                                              |
| Canvas area limit (~16.7M px on iOS) and memory                                                                  | Width fixed 1080 px output; height capped (~4000 px, bill pages beyond ~60 lines are split — unlikely in a small shop; guard + toast).                             |
| `display:none`/`visibility:hidden` sources render empty                                                          | Render off-screen via `position:fixed; left:-10000px; top:0` with real layout, not hidden.                                                                         |
| Installed-PWA sharing quirks                                                                                     | `canShare` feature-detected at runtime; fallbacks above; tested on iOS 16+ Safari and standalone, Android Chrome.                                                  |
| Safe-area & 100vh bugs in standalone mode                                                                        | `dvh` units, `env(safe-area-inset-*)` padding on nav.                                                                                                              |
| QR becomes unscannable when blurred/scaled                                                                       | QR drawn at integer multiples, `image-rendering: pixelated`, min 220 CSS px, white margin; settings upload validates min 200x200 and warns on very low resolution. |

## 9. PWA strategy

- `vite-plugin-pwa`, `registerType: 'prompt'` — new version shows a toast "Update available — Reload" (no silent mid-edit refresh).
- Manifest: name Sellbook, `display: standalone`, `start_url: /orders`, theme/background colours, icons 192, 512, maskable 512, `apple-touch-icon` 180; `apple-mobile-web-app-capable` meta, status bar style.
- Workbox: precache the app shell/assets only. **Runtime caching: none for Supabase** (`NetworkOnly` for `*.supabase.co`) — private data and signed URLs must not be cached by the SW. Navigation fallback to `index.html` (denylist `/api`).
- Offline: shell loads; `useOnlineStatus` shows a banner and disables write buttons (A10).
- Cloudflare Pages: `public/_redirects` -> `/* /index.html 200`; `public/_headers` -> `sw.js` and `index.html` `Cache-Control: no-cache`, hashed assets immutable; security headers (CSP restricting connect-src to Supabase, `X-Content-Type-Options`, `Referrer-Policy`).
- Add-to-Home-Screen instructions screen for iOS (no install prompt event on iOS). Session stored in the PWA's own localStorage -> log in again once inside the installed app (A1 makes this painless).

## 10. Testing strategy

| Layer                          | Tool                                                                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                           | Vitest                                                                | `money.ts` (paise rounding, formatting, ₹ Indian grouping), totals/discount clamp (B3), phone normalisation, IST month key/boundaries (incl. 31 Dec -> 1 Jan, 00:00 IST vs UTC edge), zod schemas, CSV escaping, content-hash/outdated logic, status transition map                                                                                                                                                                                                                                            |
| Component                      | Vitest + Testing Library                                              | OrderForm (add/remove items, totals), PaymentSheet (mode required), StatusStepper + Undo, empty/loading/error states of lists                                                                                                                                                                                                                                                                                                                                                                                  |
| Database                       | pgTAP via `supabase test db`                                          | RLS: second user sees/writes nothing; anon has no access; direct INSERT/UPDATE into orders denied; every RPC happy path + failure (B2 payment consistency, B3 discount>subtotal, B9, transitions, stale_version); snapshot immutability (B8: change variant price -> old order same); analytics_month against a fixed fixture across IST month boundary (order delivered 2026-03-31 20:00 UTC = 1 Apr IST counts in April); bill number uniqueness/idempotence under concurrent calls; rollback; trash/restore |
| Integration (manual checklist) | real phone                                                            | bill render + share on iPhone Safari, installed PWA, Android Chrome; realtime across two devices                                                                                                                                                                                                                                                                                                                                                                                                               |
| Static                         | tsc strict, ESLint (`no-explicit-any`, hooks rules), grep for secrets | in `npm run check` and CI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

CI (GitHub Actions, free): on PR/push run `npm ci`, `npm run check`; DB tests run in a job using the Supabase CLI + Docker. Cloudflare builds on push to `main`. Optional (needs approval): Playwright smoke test.

## 11. Deployment & environments

- Local: `supabase start` + `npm run dev`. Remote: one Supabase project; migrations applied with `supabase db push` (manual, from the owner's/dev machine with `supabase login`; DB password never stored in repo).
- Cloudflare Pages build: `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Hosted Supabase settings checklist (done by hand, recorded in docs): disable sign-ups, create the owner user, set Site URL to the Pages URL, enable Realtime on the listed tables (migration does it), confirm RLS on all tables via dashboard linter.

## 12. Risks & mitigations

| #   | Risk                                                         | Mitigation                                                                                                                                               |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Supabase free projects **pause after ~7 days of inactivity** | Owner opens app regularly; optional free GitHub Actions weekly cron that calls a tiny `ping` RPC with the anon key; documented restore-from-pause steps. |
| R2  | Free tier has no point-in-time backup — data loss            | Monthly CSV export in-app; optional scheduled `pg_dump` via GitHub Action to a private artifact (DB URL as repo secret, never in code).                  |
| R3  | iOS share-sheet/canvas quirks make bill sharing flaky        | Two-phase generate/share, warm-up render, blob-only images, fallbacks, device test checklist in M6 DoD.                                                  |
| R4  | Bill image storage grows (1 GB free)                         | ~150 KB per PNG ≈ 6,000+ revisions; show storage use in Settings; PNG size capped (palette-friendly template).                                           |
| R5  | Timezone bugs shift orders across months                     | All month math in SQL with `Asia/Kolkata`; pgTAP boundary tests; no JS `Date` month math for business logic.                                             |
| R6  | Money float errors                                           | Integer paise in JS, `numeric(12,2)` in DB, generated `line_total`, CHECK `total = subtotal - discount`.                                                 |
| R7  | Two devices edit the same order                              | `version_no` optimistic concurrency + realtime refresh + toast.                                                                                          |
| R8  | Realtime event storms / stale UI after phone sleep           | Debounced invalidation; refetch on visibility/online/reconnect.                                                                                          |
| R9  | service_role key or other secret leaks                       | Anon-key-only frontend, secret scan in CI, `.gitignore` for `.env*`, CSP.                                                                                |
| R10 | RLS misconfiguration exposes data                            | RLS forced on all tables, pgTAP negative tests, no anon grants, dashboard linter check in M1/M9.                                                         |
| R11 | Service worker serves stale app after deploy                 | `prompt` update flow, `no-cache` on `sw.js`/`index.html`.                                                                                                |
| R12 | Owner accidentally destroys data                             | No UI hard delete, Trash, versions, rollback, audit log (all by design).                                                                                 |
| R13 | Magic-link/OTP login breaks in iOS PWA                       | Password auth (A1).                                                                                                                                      |
| R14 | Large `order_versions.snapshot` growth                       | Small orders (~1–2 KB each); acceptable for 500 MB DB free limit (~100k+ snapshots).                                                                     |
| R15 | Scope creep (GST invoice, customers table, offline)          | Out-of-scope list in §15; changes go through approval.                                                                                                   |

## 13. Ordered milestones

Each milestone ends with `npm run check` green (typecheck, lint, tests, build) plus `supabase test db` where DB changed, with real output reported.

**M0 — Scaffold & tooling**
Vite+React+TS strict, Tailwind, Router shell with bottom nav, QueryClient, Toaster, ESLint, Vitest, `.env.example`, `lib/money.ts` + `lib/dates.ts` with tests, secret-scan script, GitHub Actions CI, Cloudflare Pages connected.
_DoD:_ app runs on phone via dev URL; `npm run check` passes; CI green; deployed placeholder at Pages URL; no secrets in repo.

**M1 — Database foundation, auth, RLS**
Migrations: tables, constraints, indexes, triggers, RLS + storage buckets/policies, `init_settings`; sign-ups off; login screen + route guard; generated types; pgTAP RLS tests.
_DoD:_ owner can log in/out on the deployed app; anon and second-user pgTAP negative tests pass; hosted checklist (§11) done; `supabase db push` succeeded; types generated.

**M2 — Settings & Catalog**
Settings screen (shop details, logo, QR upload with validation/preview, bill prefix); catalog list/editor with variants, deactivate, soft delete (via triggers audit + `upsert_product`/`trash_*`).
_DoD:_ create ~5 products with variants; edit/deactivate/trash; QR uploaded and previewed via signed blob; all states (loading/empty/error) present; tests green.

**M3 — Orders: create, edit, list, detail**
`create_order`, `update_order`, `suggest_customers`, snapshots, totals, version rows; Orders list with tabs/search; order form with autocomplete; detail screen.
_DoD:_ creating/editing orders works end to end; B3/B8 proven by pgTAP (catalog price change leaves old order untouched); optimistic concurrency works across two tabs; unit + component tests pass.

**M4 — Pipeline, Delivery stack, Payment, Undo**
`set_order_status`, `set_payment`; status stepper with Undo toast; Delivery screen; payment sheet; B1, B2, B9 enforced in DB and UI.
_DoD:_ every transition and its undo covered by pgTAP; payment consistency enforced; Delivery stack shows exactly `ready` orders; cannot reach ready/delivered with 0 items.

**M5 — Trash, Version history, Rollback, Audit log**
`trash_*`/`restore_*`, `rollback_order`, history screen with summaries, Activity screen, Trash screen.
_DoD:_ trash then restore returns identical data; rollback to any version restores items/status/payment and records a new version; audit log shows each action; pgTAP covers these.

**M6 — Bill generation, storage, sharing**
`BillTemplate`, `renderBill`, `reserve_bill_number`, `register_bill_revision`, revision list, Outdated warning/Regenerate, Share + fallbacks.
_DoD:_ bill number stable across edits (B6); new revision per regenerate with old PNGs retained; B7 warning appears after an item/discount change; share sheet opens with PNG on iPhone Safari (browser + installed PWA) and Android Chrome (manual checklist recorded); QR scans from a screenshot of the produced PNG.

**M7 — Analytics & CSV**
`analytics_month`, `pending_payments`, export rows; Analytics + Pending screens with Recharts, month picker, previous-month deltas, CSV.
_DoD:_ pgTAP fixture verifies every metric incl. IST month boundary and exclusion of cancelled/deleted; numbers on screen reconcile with a hand-computed sample; CSV opens correctly in Excel/Sheets (₹, commas, quotes).

**M8 — Realtime**
`useRealtimeSync`, publication migration, reconnect/visibility refetch, concurrency toasts.
_DoD:_ with two devices/tabs, a change (status, payment, new order, catalog edit) appears on the other without refresh within ~2 s; recovers after phone sleep/offline; no duplicate-fetch storms (debounce verified).

**M9 — PWA, hardening, release**
Manifest/icons/service worker update prompt, offline banner, `_headers`/`_redirects`, CSP, a11y + touch-target pass, empty/error state audit, README/runbook (restore, pause, backups), optional keep-alive and backup jobs.
_DoD:_ installable on iOS and Android; Lighthouse PWA/installability pass; update-prompt flow tested via two consecutive deploys; security checklist (R9, R10) verified; all milestone DoDs re-confirmed on production URL.

## 14. Definition of done (global, every task)

Typecheck, lint, tests, build all run and results reported honestly; DB changes include migration + RLS + pgTAP; new UI has loading/empty/error states; errors surface as toasts; no `any`; no secrets.

## 15. Out of scope for v1

Customer-facing anything, online payment integration/verification, GST/tax invoices, inventory/stock, multi-user/roles, offline write queue, push notifications, cost-price display/profit analytics (stored only), back-dating of delivered/paid timestamps, WhatsApp Business API.

## 16. Dependencies needing approval (beyond your fixed stack)

`@supabase/supabase-js` (required by Supabase), ESLint + `typescript-eslint` + `eslint-plugin-react-hooks` (required by the lint rule), `sonner` (toasts), `lucide-react` (icons), `@testing-library/react` + `@testing-library/user-event` + `jsdom` (component tests), `@fontsource/inter` (self-hosted bill font), optional later: Playwright. Tailwind plugins: none planned. Date library: none (use `Intl` and SQL).
