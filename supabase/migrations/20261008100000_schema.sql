-- Sellbook database foundation, part 1: enums, shared trigger function, tables, indexes.
-- RLS/grants are in 20261008100200_rls.sql; numbering/triggers in 20261008100100_triggers_functions.sql.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.order_status as enum ('new', 'ready', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid');
create type public.payment_mode as enum ('online', 'cash');

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger function
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- settings (one row per owner)
-- ---------------------------------------------------------------------------
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shop_name text not null default '',
  shop_address text not null default '',
  shop_phone text not null default '',
  upi_id text null,
  qr_path text null,
  logo_path text null,
  bill_prefix text not null default 'INV' check (bill_prefix ~ '^[A-Za-z0-9-]{0,10}$'),
  next_bill_no integer not null default 1 check (next_bill_no >= 1),
  bill_footer text null,
  default_country_code text not null default '91',
  timezone text not null default 'Asia/Kolkata',
  last_backup_at timestamptz null,
  constraint settings_owner_unique unique (owner_id)
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create unique index products_owner_name_uniq
  on public.products (owner_id, lower(name))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- variants
-- ---------------------------------------------------------------------------
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  product_id uuid not null references public.products (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  price numeric(12, 2) not null check (price >= 0),
  cost_price numeric(12, 2) null check (cost_price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create unique index variants_product_name_uniq
  on public.variants (product_id, lower(name))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- orders
-- order_no gets its default (next_order_no()) in the functions migration.
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  order_no integer not null,
  customer_name text not null,
  customer_phone text null,
  order_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  due_date date null,
  notes text null,
  status public.order_status not null default 'new',
  payment_status public.payment_status not null default 'pending',
  payment_mode public.payment_mode null,
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  ready_at timestamptz null,
  delivered_at timestamptz null,
  paid_at timestamptz null,
  cancelled_at timestamptz null,
  bill_no integer null,
  constraint orders_owner_order_no_uniq unique (owner_id, order_no),
  constraint orders_payment_mode_matches_status
    check ((payment_status = 'paid') = (payment_mode is not null)),
  constraint orders_paid_at_matches_status
    check ((payment_status = 'paid') = (paid_at is not null)),
  constraint orders_delivered_has_timestamp
    check (status <> 'delivered' or delivered_at is not null)
);

create index orders_owner_status_idx on public.orders (owner_id, status) where deleted_at is null;
create index orders_owner_delivered_at_idx on public.orders (owner_id, delivered_at);
create index orders_owner_paid_at_idx on public.orders (owner_id, paid_at);
create index orders_owner_order_date_idx on public.orders (owner_id, order_date desc);
create index orders_owner_payment_status_idx on public.orders (owner_id, payment_status, status);

-- ---------------------------------------------------------------------------
-- order_items (name + price are snapshots; B8)
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid null references public.variants (id) on delete set null,
  product_name text not null,
  variant_name text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  cost_price numeric(12, 2) null,
  quantity integer not null check (quantity > 0 and quantity <= 100000),
  line_total numeric(12, 2) generated always as (unit_price * quantity) stored,
  position integer not null default 0
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- bills (one row per generated revision; B6)
-- ---------------------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id),
  bill_no integer not null,
  revision integer not null default 1,
  image_path text not null,
  total_at_generation numeric(12, 2) not null,
  items_hash text not null,
  generated_at timestamptz not null default now(),
  constraint bills_order_revision_uniq unique (order_id, revision)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.variants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bills
  for each row execute function public.set_updated_at();
