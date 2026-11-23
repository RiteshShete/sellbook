-- Plans, phase 1 (database foundation): trial / base / pro, limits and Pro-only features.
--
-- Why triggers: `authenticated` may write orders, order_items, products and variants directly (RLS only
-- checks owner_id), so a limit checked inside the RPCs alone could be bypassed with a plain REST call.
-- Plan state lives in `subscriptions`, which shops can only READ (settings is owner-updatable).
-- Status is computed from ends_at at read time, so nothing depends on a scheduled job.
-- Errors: SQLSTATE SB411 with hint trial_orders | month_orders | products | variants | readonly | locked | pro_only.

-- ---------------------------------------------------------------------------
-- 1) Private schema: helpers that the REST API does not expose (only `public` is exposed).
-- ---------------------------------------------------------------------------
create schema app_private;
grant usage on schema app_private to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Tables
-- ---------------------------------------------------------------------------
create table public.plan_limits (
  tier text primary key check (tier in ('trial', 'base', 'pro')),
  price_paise integer not null check (price_paise >= 0),
  -- null = unlimited. 'total' counts every order ever made (trial); 'month' counts the IST month.
  orders_limit integer null check (orders_limit > 0),
  orders_scope text not null check (orders_scope in ('total', 'month')),
  products_limit integer null check (products_limit > 0),
  pro_features boolean not null,
  period_days integer not null check (period_days > 0)
);

insert into public.plan_limits (tier, price_paise, orders_limit, orders_scope, products_limit, pro_features, period_days)
values ('trial', 0, 10, 'total', 5, true, 30),
       ('base', 10000, 100, 'month', 30, false, 30),
       ('pro', 25000, 500, 'month', null, true, 30);

create table public.subscriptions (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null references public.plan_limits (tier),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  terms_version text null,
  terms_accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.plan_limits enable row level security;
alter table public.subscriptions enable row level security;

-- Read-only for shops: no insert/update/delete privilege at all (a shop must never upgrade itself).
revoke all on public.plan_limits, public.subscriptions from anon, authenticated;
grant select on public.plan_limits, public.subscriptions to authenticated;

create policy plan_limits_select_all on public.plan_limits
  for select to authenticated using (true);
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (owner_id = (select auth.uid()));

-- The monthly order count reads this.
create index orders_owner_created_at_idx on public.orders (owner_id, created_at);

-- Shops that exist before plans: unchanged, Pro without an end.
insert into public.subscriptions (owner_id, tier, ends_at)
select id, 'pro', '2099-01-01T00:00:00Z' from auth.users
on conflict (owner_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) New account -> 30-day trial. Deliberately tiny: an error here would block sign-up.
--    (The settings row is still created by init_settings() on first login.)
-- ---------------------------------------------------------------------------
create function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (owner_id, tier, ends_at, terms_version, terms_accepted_at)
  values (
    new.id,
    'trial',
    now() + make_interval(days => (select period_days from public.plan_limits where tier = 'trial')),
    new.raw_user_meta_data ->> 'terms_version',
    case when new.raw_user_meta_data ? 'terms_version' then now() end
  )
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

create trigger sellbook_new_user after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4) Plan state and usage of the caller
-- ---------------------------------------------------------------------------
-- One row; every column is null when the caller has no subscription row (treated as locked).
-- After ends_at: read-only for 60 days, then locked.
create function app_private.plan_state(
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
   where s.owner_id = (select auth.uid());
$$;

-- Orders made in the window, INCLUDING trashed ones: trash -> create -> restore must not win a slot.
-- created_at is forced by the trigger below, so it cannot be backdated out of the month.
create function app_private.orders_used(p_scope text)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
    from public.orders o
   where o.owner_id = (select auth.uid())
     and (p_scope = 'total'
          or o.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
$$;

-- Live products (deactivated ones still count; only Trash frees a slot, and restore is re-checked).
create function app_private.products_used()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.products p
   where p.owner_id = (select auth.uid()) and p.deleted_at is null;
$$;

-- p_kind: 'order' | 'product' (a new slot is needed) or 'write' (only "may this shop write at all").
create function app_private.assert_within_plan(p_kind text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  p record;
begin
  if v_owner is null then
    return; -- system work (pg_cron prune jobs, migrations), never a shop
  end if;
  select * into p from app_private.plan_state();
  if p.status = 'grace_readonly' then
    raise exception 'your plan has ended: the shop is read-only until you renew'
      using errcode = 'SB411', hint = 'readonly';
  elsif p.status is null or p.status = 'locked' then
    raise exception 'your plan has ended: renew to use the shop' using errcode = 'SB411', hint = 'locked';
  end if;

  if p_kind = 'order' and p.orders_limit is not null then
    -- Serialise this shop's inserts so two requests cannot both take the last slot.
    perform pg_advisory_xact_lock(hashtextextended('sellbook:plan:' || v_owner::text, 0));
    if app_private.orders_used(p.orders_scope) >= p.orders_limit then
      if p.orders_scope = 'total' then
        raise exception 'the free trial allows % orders: choose a plan to add more', p.orders_limit
          using errcode = 'SB411', hint = 'trial_orders';
      end if;
      raise exception 'your plan allows % orders a month: upgrade or wait for next month', p.orders_limit
        using errcode = 'SB411', hint = 'month_orders';
    end if;
  elsif p_kind = 'product' and p.products_limit is not null then
    perform pg_advisory_xact_lock(hashtextextended('sellbook:plan:' || v_owner::text, 0));
    if app_private.products_used() >= p.products_limit then
      raise exception 'your plan allows % products: upgrade to add more', p.products_limit
        using errcode = 'SB411', hint = 'products';
    end if;
  end if;
end;
$$;

create function app_private.require_pro()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null and not coalesce((select pro_features from app_private.plan_state()), false) then
    raise exception 'this feature needs the Pro plan' using errcode = 'SB411', hint = 'pro_only';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Enforcement triggers
-- ---------------------------------------------------------------------------
create function app_private.plan_guard_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      new.created_at := now(); -- the monthly count trusts this
      perform app_private.assert_within_plan('order');
    else
      new.created_at := old.created_at;
      perform app_private.assert_within_plan('write');
    end if;
  elsif tg_table_name = 'products' then
    if tg_op = 'INSERT' then
      perform app_private.assert_within_plan('product');
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform app_private.assert_within_plan('product'); -- restore from Trash takes a slot again
    else
      perform app_private.assert_within_plan('write');
    end if;
  elsif tg_table_name = 'variants' then
    perform app_private.assert_within_plan('write');
    -- Abuse guard: without it, 5 products could carry thousands of variants.
    if (select count(*) from public.variants v
         where v.product_id = new.product_id and v.deleted_at is null) >= 25 then
      raise exception 'a product can have at most 25 variants' using errcode = 'SB411', hint = 'variants';
    end if;
  end if;
  return new;
end;
$$;

create function app_private.plan_guard_stmt()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform app_private.assert_within_plan('write');
  return null;
end;
$$;

create trigger orders_plan_guard before insert or update on public.orders
  for each row execute function app_private.plan_guard_row();
create trigger products_plan_guard before insert or update on public.products
  for each row execute function app_private.plan_guard_row();
create trigger variants_plan_guard_ins before insert on public.variants
  for each row execute function app_private.plan_guard_row();
create trigger variants_plan_guard_upd before update on public.variants
  for each statement execute function app_private.plan_guard_stmt();
create trigger order_items_plan_guard before insert or update or delete on public.order_items
  for each statement execute function app_private.plan_guard_stmt();

-- ---------------------------------------------------------------------------
-- 6) my_plan(): what the app shows (tier, status, limits, usage)
-- ---------------------------------------------------------------------------
create function public.my_plan()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'tier', p.tier,
    'status', coalesce(p.status, 'locked'),
    'ends_at', p.ends_at,
    'readonly_until', p.ends_at + interval '60 days',
    'can_write', coalesce(p.status in ('trial', 'active'), false),
    'pro_features', coalesce(p.pro_features, false),
    'limits', jsonb_build_object('orders', p.orders_limit, 'orders_scope', p.orders_scope, 'products', p.products_limit),
    'usage', jsonb_build_object('orders', app_private.orders_used(p.orders_scope), 'products', app_private.products_used())
  )
  from app_private.plan_state() p;
$$;

-- ---------------------------------------------------------------------------
-- 7) Pro-only features. Each existing function moves to app_private unchanged (it keeps its grants);
--    a thin wrapper with the same name and signature checks the plan first. No body is copied.
-- ---------------------------------------------------------------------------
alter function public.export_orders_csv_rows(text) set schema app_private;
alter function public.list_order_versions(uuid) set schema app_private;
alter function public.rollback_order(uuid, integer, integer) set schema app_private;
alter function public.apply_product_import(jsonb) set schema app_private;
alter function public.prep_list() set schema app_private;
alter function public.analytics_month(text) set schema app_private;
alter function public.pending_payments() set schema app_private;

create function public.export_orders_csv_rows(p_month text)
returns table (
  order_no integer, bill_no integer, bill_prefix text, order_date date, delivered_at timestamptz,
  customer_name text, customer_phone text, items text, units integer, discount numeric, total numeric,
  payment_status public.payment_status, payment_mode public.payment_mode, paid_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform app_private.require_pro();
  return query select * from app_private.export_orders_csv_rows(p_month);
end;
$$;

create function public.list_order_versions(p_order uuid)
returns table (version_no integer, reason text, summary text, created_at timestamptz, snapshot jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform app_private.require_pro();
  return query select * from app_private.list_order_versions(p_order);
end;
$$;

create function public.rollback_order(p_id uuid, p_target integer, p_version integer)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform app_private.require_pro();
  return app_private.rollback_order(p_id, p_target, p_version);
end;
$$;

create function public.apply_product_import(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform app_private.require_pro();
  return app_private.apply_product_import(p);
end;
$$;

create function public.prep_list()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform app_private.require_pro();
  return app_private.prep_list();
end;
$$;

-- Everyone gets the current IST month; other months (comparison, month picker) are Pro.
create function public.analytics_month(p_month text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_month is distinct from to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') then
    perform app_private.require_pro();
  end if;
  return app_private.analytics_month(p_month);
end;
$$;

-- Everyone gets the pending list; the ageing columns are Pro (null otherwise).
create function public.pending_payments()
returns table (
  id uuid, order_no integer, bill_no integer, customer_name text, customer_phone text,
  total numeric, delivered_at timestamptz, age_days integer, bucket text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.order_no, p.bill_no, p.customer_name, p.customer_phone, p.total, p.delivered_at,
         case when s.pro then p.age_days end,
         case when s.pro then p.bucket end
    from app_private.pending_payments() p
   cross join (select coalesce((select pro_features from app_private.plan_state()), false) as pro) s;
$$;

-- ---------------------------------------------------------------------------
-- 8) Privileges
-- ---------------------------------------------------------------------------
revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

revoke all on function
  public.my_plan(),
  public.export_orders_csv_rows(text),
  public.list_order_versions(uuid),
  public.rollback_order(uuid, integer, integer),
  public.apply_product_import(jsonb),
  public.prep_list(),
  public.analytics_month(text),
  public.pending_payments()
from public, anon;

grant execute on function
  public.my_plan(),
  public.export_orders_csv_rows(text),
  public.list_order_versions(uuid),
  public.rollback_order(uuid, integer, integer),
  public.apply_product_import(jsonb),
  public.prep_list(),
  public.analytics_month(text),
  public.pending_payments()
to authenticated;
