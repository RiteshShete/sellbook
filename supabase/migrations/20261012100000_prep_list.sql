-- Prep list: what to make for orders still in status "new" (not trashed), summed per product and
-- per variant. Read-only; SECURITY INVOKER with a fixed search_path, so RLS limits it to the
-- caller's orders. Not inventory tracking: the owner compares it with their stock by hand.
--
-- Grouping follows analytics_month: product by variants.product_id (falls back to the name
-- snapshot when the variant link is gone), variant by variant_id (falls back to names), and the
-- newest order's snapshot names win. Order: catalog order (sort_order), then name.

create function public.prep_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with lines as (
    select o.id as order_id, o.created_at, i.quantity, i.unit_price, i.product_name, i.variant_name,
           coalesce(v.product_id::text, 'name:' || i.product_name) as product_key,
           coalesce(i.variant_id::text, 'name:' || i.product_name || ' / ' || i.variant_name) as variant_key,
           p.sort_order as product_sort,
           v.sort_order as variant_sort
      from public.orders o
      join public.order_items i on i.order_id = o.id
      left join public.variants v on v.id = i.variant_id
      left join public.products p on p.id = v.product_id
     where o.status = 'new' and o.deleted_at is null
  ),
  variants as (
    select product_key, variant_key,
           (array_agg(variant_name order by created_at desc))[1] as name,
           sum(quantity)::int as quantity,
           count(distinct order_id)::int as orders,
           min(variant_sort) as sort_order,
           min(unit_price) as min_price
      from lines
     group by product_key, variant_key
  ),
  products as (
    select product_key,
           (array_agg(product_name order by created_at desc))[1] as name,
           sum(quantity)::int as quantity,
           count(distinct order_id)::int as orders,
           min(product_sort) as sort_order
      from lines
     group by product_key
  )
  select jsonb_build_object(
    'orders', (select count(distinct order_id)::int from lines),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', p.product_key,
               'name', p.name,
               'quantity', p.quantity,
               'orders', p.orders,
               'variants', (
                 select jsonb_agg(jsonb_build_object('key', v.variant_key, 'name', v.name,
                                                     'quantity', v.quantity, 'orders', v.orders)
                                  order by v.sort_order nulls last, v.min_price, v.name)
                   from variants v
                  where v.product_key = p.product_key))
             order by p.sort_order nulls last, lower(p.name))
        from products p), '[]'::jsonb)
  );
$$;

revoke all on function public.prep_list() from public, anon;
grant execute on function public.prep_list() to authenticated;
