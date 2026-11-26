-- Storefront S1, part 2 of 3: security.
--  1) who is a shop owner / a customer
--  2) RLS and grants for the new tables
--  3) customers cannot use the owner tables (restrictive policy), so owner RPCs fail for them
--  4) plan limits keyed by the ROW's owner, not auth.uid()  (S0 finding F1)
--  5) storage policies for the public `catalog` bucket
-- DEVIATION from STOREFRONT_PLAN D3: the new-user trial trigger on auth.users is KEPT (every existing test and the
-- phase-5 self sign-up rely on it); register_customer (part 3) removes the trial row of a customer who has no shop.

-- ---------------------------------------------------------------------------
-- 1) Roles come from data
-- ---------------------------------------------------------------------------
create function app_private.has_shop()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops where owner_id = (select auth.uid()) and deleted_at is null);
$$;

-- A customer who is not also a shop owner. Such a user may not touch any owner table.
create function app_private.is_customer_only()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.customer_profiles where user_id = (select auth.uid()))
     and not exists (select 1 from public.shops where owner_id = (select auth.uid()));
$$;

-- For definer functions that act for a shop owner: returns the caller's id or raises.
create function app_private.require_shop()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.shops where owner_id = v_uid and deleted_at is null) then
    raise exception 'not a shop owner' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

revoke all on function app_private.has_shop(), app_private.is_customer_only(), app_private.require_shop()
  from public, anon;
grant execute on function app_private.has_shop(), app_private.is_customer_only(), app_private.require_shop()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2) New tables: RLS on, minimal grants. Writes go through functions (part 3).
-- ---------------------------------------------------------------------------
alter table public.shops enable row level security;
revoke all on public.shops from anon, authenticated;
grant select on public.shops to authenticated;
create policy shops_select_own on public.shops
  for select to authenticated using (owner_id = (select auth.uid()));

alter table public.shop_invites enable row level security;
revoke all on public.shop_invites from anon, authenticated; -- no policies: only definer functions touch it

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant update (name) on public.customer_profiles to authenticated;
create policy customer_profiles_select_own on public.customer_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy customer_profiles_update_own on public.customer_profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from anon, authenticated;
grant select, insert, update on public.customer_addresses to authenticated; -- delete = soft (deleted_at)
create policy customer_addresses_select_own on public.customer_addresses
  for select to authenticated using (user_id = (select auth.uid()));
create policy customer_addresses_insert_own on public.customer_addresses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy customer_addresses_update_own on public.customer_addresses
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.shop_customers enable row level security;
revoke all on public.shop_customers from anon, authenticated;
grant select on public.shop_customers to authenticated;
create policy shop_customers_select_own on public.shop_customers
  for select to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) Customers cannot use owner tables (this is what makes init_settings, create_order, upsert_product ... fail
--    for them). RESTRICTIVE policies are ANDed with the existing owner policies. Definer functions bypass RLS.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['settings', 'products', 'variants', 'categories', 'orders', 'order_items',
                           'bills', 'order_versions', 'audit_log', 'import_batches']
  loop
    execute format(
      'create policy block_customers on public.%I as restrictive for all to authenticated
         using (not (select app_private.is_customer_only()))
         with check (not (select app_private.is_customer_only()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Plan limits keyed by the row's owner (F1). Inside a definer function auth.uid() is still the CUSTOMER, so every
--    helper now takes the owner explicitly; the old zero/one-argument forms delegate with auth.uid().
-- ---------------------------------------------------------------------------
create function app_private.plan_state(
  p_owner uuid,
  out tier text, out status text, out ends_at timestamptz,
  out orders_limit integer, out orders_scope text, out products_limit integer, out pro_features boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.tier,
         case when now() < s.ends_at then case when s.tier = 'trial' then 'trial' else 'active' end
              when now() < s.ends_at + interval '60 days' then 'grace_readonly'
              else 'locked' end,
         s.ends_at, l.orders_limit, l.orders_scope, l.products_limit, l.pro_features
    from public.subscriptions s
    join public.plan_limits l on l.tier = s.tier
   where s.owner_id = p_owner;
$$;

create or replace function app_private.plan_state(
  out tier text, out status text, out ends_at timestamptz,
  out orders_limit integer, out orders_scope text, out products_limit integer, out pro_features boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from app_private.plan_state((select auth.uid()));
$$;

-- Orders made in the window, INCLUDING trashed ones (trash -> create -> restore must not win a slot), EXCEPT orders the
-- shop declined: those were never accepted work (decision D12). created_at is forced by the trigger.
create function app_private.orders_used(p_scope text, p_owner uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
    from public.orders o
   where o.owner_id = p_owner
     and o.confirmation_status <> 'declined'
     and (p_scope = 'total'
          or o.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
$$;

create or replace function app_private.orders_used(p_scope text)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.orders_used(p_scope, (select auth.uid()));
$$;

create function app_private.products_used(p_owner uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.products p where p.owner_id = p_owner and p.deleted_at is null;
$$;

create or replace function app_private.products_used()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.products_used((select auth.uid()));
$$;

-- p_kind: 'order' | 'product' (a new slot is needed) or 'write' (only "may this shop write at all").
create function app_private.assert_within_plan(p_kind text, p_owner uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p record;
begin
  if auth.uid() is null then
    return; -- system work (pg_cron prune jobs, migrations), never a shop
  end if;
  select * into p from app_private.plan_state(p_owner);
  if p.status = 'grace_readonly' then
    raise exception 'your plan has ended: the shop is read-only until you renew'
      using errcode = 'SB411', hint = 'readonly';
  elsif p.status is null or p.status = 'locked' then
    raise exception 'your plan has ended: renew to use the shop' using errcode = 'SB411', hint = 'locked';
  end if;

  if p_kind = 'order' and p.orders_limit is not null then
    -- Serialise this shop's inserts so two requests cannot both take the last slot.
    perform pg_advisory_xact_lock(hashtextextended('sellbook:plan:' || p_owner::text, 0));
    if app_private.orders_used(p.orders_scope, p_owner) >= p.orders_limit then
      if p.orders_scope = 'total' then
        raise exception 'the free trial allows % orders: choose a plan to add more', p.orders_limit
          using errcode = 'SB411', hint = 'trial_orders';
      end if;
      raise exception 'your plan allows % orders a month: upgrade or wait for next month', p.orders_limit
        using errcode = 'SB411', hint = 'month_orders';
    end if;
  elsif p_kind = 'product' and p.products_limit is not null then
    perform pg_advisory_xact_lock(hashtextextended('sellbook:plan:' || p_owner::text, 0));
    if app_private.products_used(p_owner) >= p.products_limit then
      raise exception 'your plan allows % products: upgrade to add more', p.products_limit
        using errcode = 'SB411', hint = 'products';
    end if;
  end if;
end;
$$;

create or replace function app_private.assert_within_plan(p_kind text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.assert_within_plan(p_kind, (select auth.uid()));
$$;

-- Row triggers now (the statement-level ones could not know the shop). Same rules as before.
create or replace function app_private.plan_guard_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      new.created_at := now(); -- the monthly count trusts this
      perform app_private.assert_within_plan('order', new.owner_id);
    else
      new.created_at := old.created_at;
      perform app_private.assert_within_plan('write', new.owner_id);
    end if;
  elsif tg_table_name = 'products' then
    if tg_op = 'INSERT' then
      perform app_private.assert_within_plan('product', new.owner_id);
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform app_private.assert_within_plan('product', new.owner_id); -- restore from Trash takes a slot again
    else
      perform app_private.assert_within_plan('write', new.owner_id);
    end if;
  elsif tg_table_name = 'variants' then
    perform app_private.assert_within_plan('write', new.owner_id);
    -- Abuse guard: without it, 5 products could carry thousands of variants.
    if tg_op = 'INSERT' and (select count(*) from public.variants v
         where v.product_id = new.product_id and v.deleted_at is null) >= 25 then
      raise exception 'a product can have at most 25 variants' using errcode = 'SB411', hint = 'variants';
    end if;
  elsif tg_table_name = 'order_items' then
    -- NEW is unassigned in a DELETE trigger, so it cannot sit inside a coalesce
    perform app_private.assert_within_plan('write', case when tg_op = 'DELETE' then old.owner_id else new.owner_id end);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger order_items_plan_guard on public.order_items;
create trigger order_items_plan_guard before insert or update or delete on public.order_items
  for each row execute function app_private.plan_guard_row();
drop trigger variants_plan_guard_upd on public.variants;
create trigger variants_plan_guard_upd before update on public.variants
  for each row execute function app_private.plan_guard_row();

revoke all on function
  app_private.plan_state(uuid), app_private.orders_used(text, uuid), app_private.products_used(uuid),
  app_private.assert_within_plan(text, uuid)
from public, anon;
grant execute on function
  app_private.plan_state(uuid), app_private.orders_used(text, uuid), app_private.products_used(uuid),
  app_private.assert_within_plan(text, uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Storage: the public `catalog` bucket. Anyone can fetch an object by its URL (random UUID names); nobody can list
--    it; only the owner writes, in their own folder. Catalog bytes count toward the same plan cap as bills.
-- ---------------------------------------------------------------------------
create or replace function app_private.bill_storage_used()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  -- bills AND catalog pictures share the plan's storage cap (the name is historical)
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
    from storage.objects o
   where o.bucket_id in ('bills', 'catalog')
     and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

create policy "owner can upload own catalog" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'catalog'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select app_private.has_shop())
    and app_private.bill_upload_allowed()
  );

create policy "owner can read own catalog" on storage.objects
  for select to authenticated
  using (bucket_id = 'catalog' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owner can update own catalog" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'catalog' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owner can delete own catalog" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog' and (storage.foldername(name))[1] = (select auth.uid())::text);
