-- Analytics: owner-vs-customer split. analytics_month() takes an optional source ('owner' | 'customer'), and always reports
-- by_source (sales and orders of the delivered orders). The CSV export gets four columns: source, fulfilment, payment_method,
-- delivery_fee, and the same optional source filter. Declined / cancelled / deleted orders count nowhere (they never reach 'delivered').
-- The functions keep the plan rules: the current IST month is for everyone, other months and the export are Pro.

drop function public.analytics_month(text);
drop function app_private.analytics_month(text);
drop function public.export_orders_csv_rows(text);
drop function app_private.export_orders_csv_rows(text);

create function app_private.analytics_month(p_month text, p_source text default null)
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
    select o.id, o.total, o.delivered_at, o.source
      from public.orders o
     where o.status = 'delivered'
       and o.deleted_at is null
       and (p_source is null or o.source = p_source)
       and o.delivered_at >= w.start_at and o.delivered_at < w.end_at
  ),
  lines as (
    select i.order_id, i.quantity, i.line_total, i.product_name, i.variant_name, i.variant_id,
           v.product_id, d.delivered_at, s.unit, s.amount
      from public.order_items i
      join delivered d on d.id = i.order_id
      left join public.variants v on v.id = i.variant_id
      cross join lateral public.item_size(i) s
  ),
  paid as (
    select o.total, o.payment_mode
      from public.orders o
     where o.payment_status = 'paid'
       and o.status <> 'cancelled'
       and o.deleted_at is null
       and (p_source is null or o.source = p_source)
       and o.paid_at >= w.start_at and o.paid_at < w.end_at
  ),
  outstanding as (
    select o.total
      from public.orders o
     where o.status = 'delivered' and o.payment_status = 'pending' and o.deleted_at is null
       and (p_source is null or o.source = p_source)
  ),
  by_product as (
    select coalesce(l.product_id::text, 'name:' || l.product_name) as key,
           (array_agg(l.product_name order by l.delivered_at desc))[1] as name,
           sum(l.line_total) as revenue,
           sum(l.quantity)::int as units,
           count(distinct l.order_id)::int as orders,
           coalesce(sum(l.quantity * l.amount) filter (where l.unit = 'g'), 0) as grams,
           coalesce(sum(l.quantity * l.amount) filter (where l.unit = 'ml'), 0) as ml,
           coalesce(sum(l.quantity * l.amount) filter (where l.unit = 'pcs'), 0) as pieces,
           coalesce(sum(l.quantity) filter (where l.unit is null), 0)::int as unsized
      from lines l
     group by 1
  ),
  by_variant as (
    select coalesce(l.variant_id::text, 'name:' || l.product_name || ' / ' || l.variant_name) as key,
           (array_agg(l.product_name order by l.delivered_at desc))[1] as product_name,
           (array_agg(l.variant_name order by l.delivered_at desc))[1] as variant_name,
           sum(l.line_total) as revenue,
           sum(l.quantity)::int as units,
           count(distinct l.order_id)::int as orders,
           coalesce(sum(l.quantity * l.amount) filter (where l.unit = 'g'), 0) as grams,
           coalesce(sum(l.quantity * l.amount) filter (where l.unit = 'ml'), 0) as ml,
           coalesce(sum(l.quantity * l.amount) filter (where l.unit = 'pcs'), 0) as pieces,
           coalesce(sum(l.quantity) filter (where l.unit is null), 0)::int as unsized
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
                                          'units', units, 'orders', orders, 'grams', grams,
                                          'ml', ml, 'pieces', pieces, 'unsized', unsized)
                       order by revenue desc, name)
        from by_product), '[]'::jsonb),
    'by_variant', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'product_name', product_name,
                                          'variant_name', variant_name, 'revenue', revenue,
                                          'units', units, 'orders', orders, 'grams', grams,
                                          'ml', ml, 'pieces', pieces, 'unsized', unsized)
                       order by revenue desc, product_name, variant_name)
        from by_variant), '[]'::jsonb),
    'by_source', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'sales', sales, 'orders', orders) order by source)
        from (select source, sum(total) as sales, count(*)::int as orders from delivered group by source) s), '[]'::jsonb),
    'daily', (
      select jsonb_agg(jsonb_build_object('date', day, 'sales', sales, 'orders', orders) order by day)
        from daily)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function app_private.analytics_month(text, text) from public, anon;
grant execute on function app_private.analytics_month(text, text) to authenticated;

create function public.analytics_month(p_month text, p_source text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_source is not null and p_source not in ('owner', 'customer') then
    raise exception 'unknown source' using errcode = '22023';
  end if;
  if p_month is distinct from to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') then
    perform app_private.require_pro();
  end if;
  return app_private.analytics_month(p_month, p_source);
end;
$$;

revoke all on function public.analytics_month(text, text) from public, anon;
grant execute on function public.analytics_month(text, text) to authenticated;

create function app_private.export_orders_csv_rows(p_month text, p_source text default null)
returns table (
  order_no integer, bill_no integer, bill_prefix text, order_date date, delivered_at timestamptz,
  customer_name text, customer_phone text, items text, units integer, discount numeric, total numeric,
  payment_status public.payment_status, payment_mode public.payment_mode, paid_at timestamptz,
  source text, fulfilment text, payment_method text, delivery_fee numeric
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
  select o.order_no, o.bill_no, o.bill_prefix, o.order_date, o.delivered_at, o.customer_name,
         o.customer_phone,
         coalesce(string_agg(i.product_name || ' ' || i.variant_name || ' x ' || i.quantity, '; '
                             order by i.position), ''),
         coalesce(sum(i.quantity), 0)::int,
         o.discount, o.total, o.payment_status, o.payment_mode, o.paid_at,
         o.source, o.fulfilment, o.payment_method, o.delivery_fee
    from public.orders o
    left join public.order_items i on i.order_id = o.id
   where o.status = 'delivered'
     and o.deleted_at is null
     and (p_source is null or o.source = p_source)
     and o.delivered_at >= w.start_at and o.delivered_at < w.end_at
   group by o.id
   order by o.delivered_at, o.order_no;
end;
$$;

revoke all on function app_private.export_orders_csv_rows(text, text) from public, anon;
grant execute on function app_private.export_orders_csv_rows(text, text) to authenticated;

create function public.export_orders_csv_rows(p_month text, p_source text default null)
returns table (
  order_no integer, bill_no integer, bill_prefix text, order_date date, delivered_at timestamptz,
  customer_name text, customer_phone text, items text, units integer, discount numeric, total numeric,
  payment_status public.payment_status, payment_mode public.payment_mode, paid_at timestamptz,
  source text, fulfilment text, payment_method text, delivery_fee numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform app_private.require_pro();
  if p_source is not null and p_source not in ('owner', 'customer') then
    raise exception 'unknown source' using errcode = '22023';
  end if;
  return query select * from app_private.export_orders_csv_rows(p_month, p_source);
end;
$$;

revoke all on function public.export_orders_csv_rows(text, text) from public, anon;
grant execute on function public.export_orders_csv_rows(text, text) to authenticated;
