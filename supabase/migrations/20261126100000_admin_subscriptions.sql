-- Admin: see every shop's plan and set it by hand (demo/promo accounts, lifetime Pro, ending a plan).
-- Only a platform admin can call these (rows in platform_admins, added by hand in the SQL editor).
-- Shops still cannot write `subscriptions`; the app never verifies a payment, this is the manual override.
-- "Lifetime" = ends_at 2099-01-01, the same value the plans migration gave shops that existed before plans.

create function public.admin_list_shops(p_query text default null)
returns table (
  owner_id uuid, email text, phone text, shop_name text, tier text, status text, ends_at timestamptz,
  lifetime boolean, orders_this_month integer, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.owner_id, u.email::text, u.phone::text, coalesce(st.shop_name, ''), s.tier,
           case when now() < s.ends_at then case when s.tier = 'trial' then 'trial' else 'active' end
                when now() < s.ends_at + interval '60 days' then 'grace_readonly'
                else 'locked' end,
           s.ends_at, s.ends_at >= '2090-01-01T00:00:00Z',
           (select count(*)::integer from public.orders o
             where o.owner_id = s.owner_id
               and o.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
           u.created_at
      from public.subscriptions s
      join auth.users u on u.id = s.owner_id
      left join public.settings st on st.owner_id = s.owner_id
     where not exists (select 1 from public.customer_profiles c where c.user_id = s.owner_id)
       and (v_q is null
            or u.email ilike '%' || v_q || '%' or u.phone ilike '%' || v_q || '%'
            or st.shop_name ilike '%' || v_q || '%')
     order by u.created_at desc
     limit 200;
end;
$$;

-- p_lifetime: Pro (or any tier) with no end. Otherwise p_days from now; 0 ends the plan now (read-only, then locked).
create function public.admin_set_subscription(
  p_owner uuid, p_tier text, p_days integer default 30, p_lifetime boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_end timestamptz;
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plan_limits where tier = p_tier) then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  if not exists (select 1 from public.subscriptions where owner_id = p_owner) then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  if p_lifetime then
    v_end := '2099-01-01T00:00:00Z';
  else
    if p_days is null or p_days < 0 or p_days > 3650 then
      raise exception 'days must be between 0 and 3650' using errcode = '22023';
    end if;
    v_end := now() + make_interval(days => p_days);
  end if;
  update public.subscriptions set tier = p_tier, started_at = now(), ends_at = v_end where owner_id = p_owner;
end;
$$;

revoke all on function public.admin_list_shops(text), public.admin_set_subscription(uuid, text, integer, boolean)
  from public, anon;
grant execute on function public.admin_list_shops(text), public.admin_set_subscription(uuid, text, integer, boolean)
  to authenticated;
