-- Plans, phase 3: a shop asks for a plan after paying by UPI; the platform admin approves or rejects by hand.
--
-- The app never verifies a payment. A request is only a claim ("I have paid, here is my reference");
-- the plan changes only inside admin_decide_request(), which only a platform admin can run.
-- Shops cannot write any of these tables: every change goes through the SECURITY DEFINER functions below,
-- each of which checks who is calling.

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
-- Who may approve. No policy and no grant: only definer functions read it. Rows are added by hand in the
-- SQL editor (never from the repo): insert into public.platform_admins values ('<your user id>');
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

-- Where shops send the money (the admin's UPI ID), editable from the Admin page without a deploy.
create table public.platform_config (
  key text primary key check (key in ('upi_id', 'payee_name', 'support_email')),
  value text not null check (char_length(value) between 1 and 200),
  updated_at timestamptz not null default now()
);
alter table public.platform_config enable row level security;
revoke all on public.platform_config from anon, authenticated;
grant select on public.platform_config to authenticated;
create policy platform_config_select_all on public.platform_config
  for select to authenticated using (true);

create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  tier text not null references public.plan_limits (tier) check (tier in ('base', 'pro')),
  amount_paise integer not null check (amount_paise > 0),
  -- Shown in the payer's UPI app ("Sub SB-1A2B3C4D") so the admin can match the payment.
  ref_code text not null,
  -- The bank's transaction reference, if the shop typed it.
  utr text null check (utr ~ '^[A-Za-z0-9]{6,30}$'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz null,
  decided_by uuid null references auth.users (id) on delete set null,
  reject_reason text null,
  resulting_ends_at timestamptz null
);
-- One open request per shop.
create unique index subscription_requests_one_pending
  on public.subscription_requests (owner_id) where status = 'pending';
create index subscription_requests_status_idx on public.subscription_requests (status, created_at);

alter table public.subscription_requests enable row level security;
revoke all on public.subscription_requests from anon, authenticated;
grant select on public.subscription_requests to authenticated;
create policy subscription_requests_select_own on public.subscription_requests
  for select to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------
create function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

-- For the app: show or hide the Admin page. The admin functions check again themselves.
create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.is_platform_admin();
$$;

-- The same short reference for a shop every time, so a repeat payer is recognisable.
create function app_private.pay_ref(p_owner uuid)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select 'SB-' || upper(substr(encode(sha256(convert_to(p_owner::text, 'UTF8')), 'hex'), 1, 8));
$$;

-- ---------------------------------------------------------------------------
-- 3) Shop: ask for a plan / take the request back
-- ---------------------------------------------------------------------------
create function public.request_subscription(p_tier text, p_utr text default null)
returns public.subscription_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_utr text := nullif(btrim(coalesce(p_utr, '')), '');
  v_price integer;
  v_sub public.subscriptions;
  v_row public.subscription_requests;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select price_paise into v_price from public.plan_limits where tier = p_tier and tier in ('base', 'pro');
  if v_price is null then
    raise exception 'choose the Base or the Pro plan' using errcode = '22023';
  end if;
  if v_utr is not null and v_utr !~ '^[A-Za-z0-9]{6,30}$' then
    raise exception 'the transaction reference must be 6 to 30 letters or digits' using errcode = '22023';
  end if;

  -- One request at a time per shop, decided in order.
  perform pg_advisory_xact_lock(hashtextextended('sellbook:plan:' || v_owner::text, 0));

  select * into v_sub from public.subscriptions where owner_id = v_owner;
  if v_sub.tier = 'pro' and p_tier = 'base' and v_sub.ends_at > now() then
    raise exception 'you are on Pro: you can choose Base when it ends' using errcode = '22023';
  end if;

  -- A request nobody decided in 14 days no longer blocks a new one.
  update public.subscription_requests set status = 'expired'
   where owner_id = v_owner and status = 'pending' and created_at < now() - interval '14 days';

  if exists (select 1 from public.subscription_requests where owner_id = v_owner and status = 'pending') then
    raise exception 'a payment is already waiting for approval'
      using errcode = 'SB411', hint = 'pending_exists';
  end if;
  if (select count(*) from public.subscription_requests
       where owner_id = v_owner and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'too many requests today: try again tomorrow'
      using errcode = 'SB411', hint = 'rate_limited';
  end if;

  insert into public.subscription_requests (owner_id, tier, amount_paise, ref_code, utr)
  values (v_owner, p_tier, v_price, app_private.pay_ref(v_owner), v_utr)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.cancel_subscription_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.subscription_requests set status = 'cancelled', decided_at = now()
   where owner_id = auth.uid() and status = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Admin: list, decide, set where the money goes
-- ---------------------------------------------------------------------------
create function public.admin_list_requests(p_status text default 'pending')
returns table (
  id uuid, owner_id uuid, email text, shop_name text, tier text, amount_paise integer, ref_code text,
  utr text, status text, created_at timestamptz, decided_at timestamptz, reject_reason text,
  current_tier text, current_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select r.id, r.owner_id, u.email::text, coalesce(st.shop_name, ''), r.tier, r.amount_paise, r.ref_code,
           r.utr, r.status, r.created_at, r.decided_at, r.reject_reason, s.tier, s.ends_at
      from public.subscription_requests r
      join auth.users u on u.id = r.owner_id
      left join public.settings st on st.owner_id = r.owner_id
      left join public.subscriptions s on s.owner_id = r.owner_id
     where r.status = p_status
     order by case when p_status = 'pending' then r.created_at end asc, r.created_at desc
     limit 200;
end;
$$;

-- Approve: the same plan while it still runs is extended from its end (early renewal is not lost);
-- anything else (new plan, upgrade, renewal after the end) starts now. Reject: a reason is required.
create function public.admin_decide_request(p_id uuid, p_approve boolean, p_reason text default null)
returns public.subscription_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_req public.subscription_requests;
  v_sub public.subscriptions;
  v_days integer;
  v_end timestamptz;
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_req from public.subscription_requests where id = p_id for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'this request was already %', v_req.status using errcode = '22023';
  end if;

  if not p_approve then
    if v_reason is null or char_length(v_reason) > 200 then
      raise exception 'give a reason (up to 200 characters) so the shop knows why' using errcode = '22023';
    end if;
    update public.subscription_requests
       set status = 'rejected', decided_at = now(), decided_by = v_admin, reject_reason = v_reason
     where id = p_id returning * into v_req;
    return v_req;
  end if;

  select period_days into v_days from public.plan_limits where tier = v_req.tier;
  select * into v_sub from public.subscriptions where owner_id = v_req.owner_id for update;
  v_end := case when v_sub.tier = v_req.tier and v_sub.ends_at > now() then v_sub.ends_at else now() end
           + make_interval(days => v_days);

  insert into public.subscriptions (owner_id, tier, started_at, ends_at)
  values (v_req.owner_id, v_req.tier, now(), v_end)
  on conflict (owner_id) do update
    set tier = excluded.tier,
        ends_at = excluded.ends_at,
        started_at = case when public.subscriptions.tier = excluded.tier and public.subscriptions.ends_at > now()
                          then public.subscriptions.started_at else now() end;

  update public.subscription_requests
     set status = 'approved', decided_at = now(), decided_by = v_admin, resulting_ends_at = v_end
   where id = p_id returning * into v_req;
  return v_req;
end;
$$;

create function public.admin_set_config(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text := btrim(coalesce(p_value, ''));
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Same shape as VPA_PATTERN in src/lib/upi.ts (Postgres caps a repetition count at 255).
  if p_key = 'upi_id' and v_value !~ '^[a-zA-Z0-9.\-_]{2,255}@[a-zA-Z]{2,64}$' then
    raise exception 'that is not a valid UPI ID' using errcode = '22023';
  end if;
  -- The table's checks reject an unknown key or an empty/too long value.
  insert into public.platform_config (key, value) values (p_key, v_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
exception when check_violation then
  raise exception 'unknown setting, or the value is empty or too long' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) my_plan(): now also where to pay, the shop's reference and its latest request
-- ---------------------------------------------------------------------------
create or replace function public.my_plan()
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
    'usage', jsonb_build_object('orders', app_private.orders_used(p.orders_scope), 'products', app_private.products_used()),
    'pay_ref', app_private.pay_ref((select auth.uid())),
    'pay_to', (select jsonb_build_object(
                 'upi_id', max(c.value) filter (where c.key = 'upi_id'),
                 'payee_name', max(c.value) filter (where c.key = 'payee_name'),
                 'support_email', max(c.value) filter (where c.key = 'support_email'))
                 from public.platform_config c),
    'request', (select jsonb_build_object(
                  'id', r.id, 'tier', r.tier, 'amount_paise', r.amount_paise, 'utr', r.utr,
                  -- An undecided request older than 14 days no longer counts (see request_subscription).
                  'status', case when r.status = 'pending' and r.created_at < now() - interval '14 days'
                                 then 'expired' else r.status end,
                  'created_at', r.created_at, 'reject_reason', r.reject_reason)
                  from public.subscription_requests r
                 where r.owner_id = (select auth.uid())
                 order by r.created_at desc limit 1)
  )
  from app_private.plan_state() p;
$$;

-- ---------------------------------------------------------------------------
-- 6) Privileges
-- ---------------------------------------------------------------------------
revoke all on function app_private.is_platform_admin(), app_private.pay_ref(uuid) from public, anon;
grant execute on function app_private.is_platform_admin(), app_private.pay_ref(uuid) to authenticated;

revoke all on function
  public.is_admin(),
  public.request_subscription(text, text),
  public.cancel_subscription_request(),
  public.admin_list_requests(text),
  public.admin_decide_request(uuid, boolean, text),
  public.admin_set_config(text, text)
from public, anon;

grant execute on function
  public.is_admin(),
  public.request_subscription(text, text),
  public.cancel_subscription_request(),
  public.admin_list_requests(text),
  public.admin_decide_request(uuid, boolean, text),
  public.admin_set_config(text, text)
to authenticated;
