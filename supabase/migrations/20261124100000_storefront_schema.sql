-- Storefront S1, part 1 of 3: schema. EXPAND ONLY (no drops, no renames), so the previous app version keeps working.
-- Tenant key stays owner_id (decision D1): one `shops` row per owner, no shop_id on existing tables.
-- Part 2 = security (RLS, grants, plan guards keyed by the row's owner), part 3 = functions.

-- ---------------------------------------------------------------------------
-- Reserved slugs: words the owner app (or the platform) uses as a first path segment.
-- Mirrored in src/lib/slug.ts; a vitest test fails if the two lists differ.
-- ---------------------------------------------------------------------------
create function app_private.reserved_slugs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'login','signup','forgot','reset-password','orders','delivery','analytics','products','catalog','pricing',
    'offers','more','settings','trash','activity','pending','plan','admin','terms','privacy','help','support',
    'api','app','assets','static','public','s','shop','shops','store','www','mail','status','about','contact',
    'loyalty','customers','reports','account','cart','checkout','sellbook','null','undefined','test'
  ];
$$;

-- A slug from a shop name: lower-case words joined by hyphens, never reserved, de-duplicated by a number.
create function app_private.make_slug(p_name text, p_owner uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base text := left(trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')), 30);
  v_try text;
  n integer := 1;
begin
  v_base := trim(both '-' from v_base);
  if length(v_base) < 3 or v_base = any (app_private.reserved_slugs()) then
    v_base := 'shop-' || left(replace(p_owner::text, '-', ''), 6);
  end if;
  v_try := v_base;
  while exists (select 1 from public.shops where lower(slug) = v_try and deleted_at is null)
        or v_try = any (app_private.reserved_slugs()) loop
    n := n + 1;
    v_try := left(v_base, 30 - length(n::text) - 1) || '-' || n;
  end loop;
  return v_try;
end;
$$;

-- ---------------------------------------------------------------------------
-- shops: storefront settings only. Name, address, phone, UPI ID and payee name stay in `settings`.
-- ---------------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  tagline text null check (char_length(tagline) <= 120),
  banner_text text null check (char_length(banner_text) <= 200),
  city text null check (char_length(city) <= 80),
  fssai_no text null check (char_length(fssai_no) <= 20),
  delivery_note text null check (char_length(delivery_note) <= 200),
  closed_message text null check (char_length(closed_message) <= 200),
  whatsapp text null check (whatsapp ~ '^[0-9]{10,15}$'),
  logo_path text null,
  is_published boolean not null default false,
  ever_published boolean not null default false,
  accepts_orders boolean not null default true,
  delivery_mode text not null default 'both' check (delivery_mode in ('delivery', 'pickup', 'both')),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  min_order numeric(12, 2) not null default 0 check (min_order >= 0),
  free_delivery_above numeric(12, 2) null check (free_delivery_above >= 0),
  lead_time_hours integer not null default 24 check (lead_time_hours between 0 and 720),
  pay_upi boolean not null default true,
  pay_cod boolean not null default true,
  constraint shops_one_payment_method check (pay_upi or pay_cod)
);
create unique index shops_slug_uniq on public.shops (lower(slug)) where deleted_at is null;

create function app_private.shops_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(new.slug) = any (app_private.reserved_slugs()) then
    raise exception 'that web address is reserved' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.ever_published and lower(new.slug) <> lower(old.slug) then
    raise exception 'the shop address cannot change after it has been published' using errcode = '22023';
  end if;
  if new.is_published then
    new.ever_published := true;
  end if;
  return new;
end;
$$;
create trigger shops_guard before insert or update on public.shops
  for each row execute function app_private.shops_guard();
create trigger set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shop_invites: pilot owners need a code from a platform admin (D10).
-- ---------------------------------------------------------------------------
create table public.shop_invites (
  code text primary key check (code ~ '^[A-Za-z0-9]{10}$'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid null references auth.users (id),
  used_at timestamptz null,
  note text null check (char_length(note) <= 100)
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  phone text not null unique check (phone ~ '^[0-9]{10,15}$'),
  created_at timestamptz not null default now()
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  label text null check (char_length(label) <= 40),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  line1 text not null check (char_length(btrim(line1)) between 1 and 200),
  line2 text null check (char_length(line2) <= 200),
  area text null check (char_length(area) <= 100),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  landmark text null check (char_length(landmark) <= 100),
  is_default boolean not null default false
);
create index customer_addresses_user_idx on public.customer_addresses (user_id) where deleted_at is null;
create trigger set_updated_at before update on public.customer_addresses
  for each row execute function public.set_updated_at();

create function app_private.address_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.customer_addresses
                            where user_id = new.user_id and deleted_at is null) >= 5 then
    raise exception 'you can save up to 5 addresses' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger customer_addresses_cap before insert on public.customer_addresses
  for each row execute function app_private.address_cap();

-- The shop's own view of its customers; name and phone are snapshots so owners never read customer_profiles.
create table public.shop_customers (
  owner_id uuid not null references auth.users (id),
  customer_user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  order_count integer not null default 0,
  is_blocked boolean not null default false,
  owner_note text null check (char_length(owner_note) <= 300),
  primary key (owner_id, customer_user_id)
);

-- ---------------------------------------------------------------------------
-- products: storefront content (all optional)
-- ---------------------------------------------------------------------------
alter table public.products
  add column description text null check (char_length(description) <= 2000),
  add column ingredients text null check (char_length(ingredients) <= 1000),
  add column nutrition jsonb null
    check (nutrition is null or (jsonb_typeof(nutrition) = 'object' and char_length(nutrition::text) <= 1000)),
  add column allergens text[] not null default '{}' check (cardinality(allergens) <= 20),
  add column veg_type text null check (veg_type in ('veg', 'non_veg', 'egg')),
  add column shelf_life text null check (char_length(shelf_life) <= 100),
  add column is_available boolean not null default true,
  add column image_paths text[] not null default '{}' check (cardinality(image_paths) <= 5);

create function app_private.product_images_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.image_paths) p where p not like new.owner_id::text || '/%' or p like '%..%') then
    raise exception 'image paths must be inside the shop folder' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger products_images_guard before insert or update of image_paths on public.products
  for each row execute function app_private.product_images_guard();

-- ---------------------------------------------------------------------------
-- variants: price stays the normal price (MRP); optional offer
-- ---------------------------------------------------------------------------
alter table public.variants
  add column offer_price numeric(12, 2) null check (offer_price >= 0),
  add column offer_label text null check (char_length(offer_label) <= 40),
  add column offer_starts_at timestamptz null,
  add column offer_ends_at timestamptz null,
  add constraint variants_offer_below_price check (offer_price is null or offer_price < price),
  add constraint variants_offer_window check (
    offer_starts_at is null or offer_ends_at is null or offer_ends_at > offer_starts_at);

-- The only place the offer rule lives: the offer price while inside its window (open-ended bounds), else the normal price.
create function public.effective_price(p_variant public.variants, p_at timestamptz default now())
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_variant.offer_price is not null
     and (p_variant.offer_starts_at is null or p_at >= p_variant.offer_starts_at)
     and (p_variant.offer_ends_at is null or p_at < p_variant.offer_ends_at)
    then p_variant.offer_price
    else p_variant.price
  end;
$$;

-- ---------------------------------------------------------------------------
-- order_items: what the customer saw (B8 snapshots). cost_price is never shown to customers.
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column list_price numeric(12, 2) null check (list_price >= 0),
  add column offer_label text null;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
alter table public.orders
  add column source text not null default 'owner' check (source in ('owner', 'customer')),
  add column customer_user_id uuid null references auth.users (id),
  add column fulfilment text null check (fulfilment in ('delivery', 'pickup')),
  add column delivery_address jsonb null,
  add column delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  add column confirmation_status text not null default 'not_needed'
    check (confirmation_status in ('not_needed', 'pending', 'confirmed', 'declined')),
  add column decline_reason text null check (char_length(decline_reason) <= 300),
  add column payment_method text null check (payment_method in ('upi', 'cod')),
  add column payment_claim_status text not null default 'none'
    check (payment_claim_status in ('none', 'claimed', 'verified', 'rejected')),
  add column payment_reference text null check (payment_reference ~ '^[0-9]{12}$'),
  add column payment_claimed_at timestamptz null,
  add column payment_verified_at timestamptz null,
  add column payment_reject_reason text null check (char_length(payment_reject_reason) <= 300),
  add column claim_count integer not null default 0 check (claim_count between 0 and 3),
  add column idempotency_key uuid null,
  add constraint orders_customer_fields check (
    source <> 'customer'
    or (customer_user_id is not null and fulfilment is not null and payment_method is not null)),
  add constraint orders_claim_needs_upi check (
    payment_claim_status <> 'claimed' or (payment_method = 'upi' and payment_status = 'pending')),
  add constraint orders_verified_is_paid check (
    payment_claim_status <> 'verified' or payment_status = 'paid');

create unique index orders_customer_idempotency_uniq
  on public.orders (customer_user_id, idempotency_key) where idempotency_key is not null;
create index orders_pending_confirmation_idx
  on public.orders (owner_id) where confirmation_status = 'pending' and deleted_at is null;
create index orders_claimed_idx
  on public.orders (owner_id) where payment_claim_status = 'claimed' and deleted_at is null;
create index orders_customer_created_idx on public.orders (customer_user_id, created_at desc);
create index orders_owner_utr_idx
  on public.orders (owner_id, payment_reference) where payment_reference is not null;

-- ---------------------------------------------------------------------------
-- Total = max(0, sum(lines) + delivery_fee - discount)   (B3 extended). The discount cap in
-- check_order_rules still compares against the items only, so the fee never lets a discount grow.
-- ---------------------------------------------------------------------------
create or replace function public.compute_order_total(p_order uuid, p_discount numeric)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select greatest(0,
           coalesce(sum(line_total), 0)
           + coalesce((select o.delivery_fee from public.orders o where o.id = p_order), 0)
           - p_discount)
  from public.order_items
  where order_id = p_order;
$$;

-- Before insert the row is not in the table yet, so the fee comes from NEW.
create or replace function public.orders_set_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.total := greatest(0,
    coalesce((select sum(i.line_total) from public.order_items i where i.order_id = new.id), 0)
    + new.delivery_fee - new.discount);
  return new;
end;
$$;

drop trigger orders_set_total_on_discount on public.orders;
create trigger orders_set_total_on_discount
  before update of discount, delivery_fee on public.orders
  for each row
  when (old.discount is distinct from new.discount or old.delivery_fee is distinct from new.delivery_fee)
  execute function public.orders_set_total();

-- ---------------------------------------------------------------------------
-- History: the new reasons (version rows for customer orders)
-- ---------------------------------------------------------------------------
alter table public.order_versions drop constraint order_versions_reason_check;
alter table public.order_versions add constraint order_versions_reason_check check (
  reason in ('create', 'edit', 'status', 'payment', 'delete', 'restore', 'rollback',
             'confirm', 'decline', 'claim', 'verify', 'reject', 'customer_cancel'));

-- ---------------------------------------------------------------------------
-- Back-fill: every existing owner gets one (unpublished) shop. Idempotent.
-- ---------------------------------------------------------------------------
insert into public.shops (owner_id, slug)
select s.owner_id, app_private.make_slug(s.shop_name, s.owner_id)
  from public.settings s
 where not exists (select 1 from public.shops x where x.owner_id = s.owner_id);

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket for product and logo pictures (decision D5). Policies come in part 2.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
