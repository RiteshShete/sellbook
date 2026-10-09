-- M7: monthly analytics, pending payments, CSV export rows. Read-only; SECURITY INVOKER with a
-- fixed search_path like everything else, so RLS limits every number to the caller's own rows.
-- Definitions: docs/PLAN.md §5.1 (B4, B5). Month windows are [start, end) in Asia/Kolkata.

-- ---------------------------------------------------------------------------
-- month_window('YYYY-MM'): the IST month as UTC instants. Raises 22023 on a bad month.
-- ---------------------------------------------------------------------------
create function public.month_window(p_month text, out start_at timestamptz, out end_at timestamptz)
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_first date;
begin
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'month must look like 2026-10' using errcode = '22023';
  end if;
  v_first := (p_month || '-01')::date;
  start_at := v_first::timestamp at time zone 'Asia/Kolkata';
  end_at := (v_first + interval '1 month')::timestamp at time zone 'Asia/Kolkata';
end;
$$;

-- ---------------------------------------------------------------------------
-- analytics_month('YYYY-MM') -> jsonb
--   sales/orders/units/aov: delivered orders by delivered_at in the month (B4)
--   collected (+ online/cash split): paid orders by paid_at in the month, not cancelled (B5, A6)
--   outstanding: delivered + pending, all time (B5)
--   by_product / by_variant: gross line revenue before order discount (A7), newest name wins
--   daily: every day of the month, zero-filled
-- Cancelled and trashed orders never count.
-- ---------------------------------------------------------------------------
create function public.analytics_month(p_month text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  w record;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into w from public.month_window(p_month);

  with delivered as (
    select o.id, o.total, o.delivered_at
      from public.orders o
     where o.status = 'delivered'
       and o.deleted_at is null
       and o.delivered_at >= w.start_at and o.delivered_at < w.end_at
  ),
  lines as (
    select i.order_id, i.quantity, i.line_total, i.product_name, i.variant_name, i.variant_id,
           v.product_id, d.delivered_at
      from public.order_items i
      join delivered d on d.id = i.order_id
      left join public.variants v on v.id = i.variant_id
  ),
  paid as (
    select o.total, o.payment_mode
      from public.orders o
     where o.payment_status = 'paid'
       and o.status <> 'cancelled'
       and o.deleted_at is null
       and o.paid_at >= w.start_at and o.paid_at < w.end_at
  ),
  outstanding as (
    select o.total
      from public.orders o
     where o.status = 'delivered' and o.payment_status = 'pending' and o.deleted_at is null
  ),
  by_product as (
    select coalesce(l.product_id::text, 'name:' || l.product_name) as key,
           (array_agg(l.product_name order by l.delivered_at desc))[1] as name,
           sum(l.line_total) as revenue,
           sum(l.quantity)::int as units,
           count(distinct l.order_id)::int as orders
      from lines l
     group by 1
  ),
  by_variant as (
    select coalesce(l.variant_id::text, 'name:' || l.product_name || ' / ' || l.variant_name) as key,
           (array_agg(l.product_name order by l.delivered_at desc))[1] as product_name,
           (array_agg(l.variant_name order by l.delivered_at desc))[1] as variant_name,
           sum(l.line_total) as revenue,
           sum(l.quantity)::int as units,
           count(distinct l.order_id)::int as orders
      from lines l
     group by 1
  ),
  days as (
    select g::date as day
      from generate_series(
        (w.start_at at time zone 'Asia/Kolkata')::date,
        (w.end_at at time zone 'Asia/Kolkata')::date - 1,
        interval '1 day'
      ) g
  ),
  daily as (
    select d.day,
           coalesce(sum(x.total), 0) as sales,
           count(x.id)::int as orders
      from days d
      left join delivered x on (x.delivered_at at time zone 'Asia/Kolkata')::date = d.day
     group by d.day
  )
  select jsonb_build_object(
    'month', p_month,
    'sales', (select coalesce(sum(total), 0) from delivered),
    'orders', (select count(*)::int from delivered),
    'units', (select coalesce(sum(quantity), 0)::int from lines),
    'aov', (select case when count(*) = 0 then 0 else round(sum(total) / count(*), 2) end from delivered),
    'collected', (select coalesce(sum(total), 0) from paid),
    'collected_online', (select coalesce(sum(total) filter (where payment_mode = 'online'), 0) from paid),
    'collected_cash', (select coalesce(sum(total) filter (where payment_mode = 'cash'), 0) from paid),
    'outstanding_total', (select coalesce(sum(total), 0) from outstanding),
    'outstanding_count', (select count(*)::int from outstanding),
    'by_product', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'revenue', revenue,
                                          'units', units, 'orders', orders)
                       order by revenue desc, name)
        from by_product), '[]'::jsonb),
    'by_variant', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'product_name', product_name,
                                          'variant_name', variant_name, 'revenue', revenue,
                                          'units', units, 'orders', orders)
                       order by revenue desc, product_name, variant_name)
        from by_variant), '[]'::jsonb),
    'daily', (
      select jsonb_agg(jsonb_build_object('date', day, 'sales', sales, 'orders', orders) order by day)
        from daily)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- pending_payments(): delivered but unpaid orders, all time, oldest first, with ageing.
-- age_days = IST calendar days since delivery; bucket 0-7, 8-30, 31-60, 60+.
-- ---------------------------------------------------------------------------
create function public.pending_payments()
returns table (
  id uuid,
  order_no integer,
  bill_no integer,
  customer_name text,
  customer_phone text,
  total numeric,
  delivered_at timestamptz,
  age_days integer,
  bucket text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.order_no, o.bill_no, o.customer_name, o.customer_phone, o.total, o.delivered_at,
         a.age_days,
         case when a.age_days <= 7 then '0-7'
              when a.age_days <= 30 then '8-30'
              when a.age_days <= 60 then '31-60'
              else '60+' end
    from public.orders o
   cross join lateral (
     select ((now() at time zone 'Asia/Kolkata')::date
             - (o.delivered_at at time zone 'Asia/Kolkata')::date)::int as age_days
   ) a
   where o.status = 'delivered' and o.payment_status = 'pending' and o.deleted_at is null
   order by o.delivered_at, o.order_no;
$$;

-- ---------------------------------------------------------------------------
-- export_orders_csv_rows('YYYY-MM'): one row per order delivered in the month (same set as
-- Sales), items flattened to "Cake 1 kg x 2; ...". The CSV itself is built on the client.
-- ---------------------------------------------------------------------------
create function public.export_orders_csv_rows(p_month text)
returns table (
  order_no integer,
  bill_no integer,
  order_date date,
  delivered_at timestamptz,
  customer_name text,
  customer_phone text,
  items text,
  units integer,
  discount numeric,
  total numeric,
  payment_status public.payment_status,
  payment_mode public.payment_mode,
  paid_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  w record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into w from public.month_window(p_month);

  return query
  select o.order_no, o.bill_no, o.order_date, o.delivered_at, o.customer_name, o.customer_phone,
         coalesce(string_agg(i.product_name || ' ' || i.variant_name || ' x ' || i.quantity, '; '
                             order by i.position), ''),
         coalesce(sum(i.quantity), 0)::int,
         o.discount, o.total, o.payment_status, o.payment_mode, o.paid_at
    from public.orders o
    left join public.order_items i on i.order_id = o.id
   where o.status = 'delivered'
     and o.deleted_at is null
     and o.delivered_at >= w.start_at and o.delivered_at < w.end_at
   group by o.id
   order by o.delivered_at, o.order_no;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function
  public.month_window(text),
  public.analytics_month(text),
  public.pending_payments(),
  public.export_orders_csv_rows(text)
from public, anon;

grant execute on function
  public.month_window(text),
  public.analytics_month(text),
  public.pending_payments(),
  public.export_orders_csv_rows(text)
to authenticated;
