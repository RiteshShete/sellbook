-- Variant sizes (weight / volume / pieces) so the prep list, analytics and order detail can show
-- totals like "6.25 kg". Amounts are stored in base units: grams, millilitres or pieces.
-- Like name and price, an order line snapshots its variant's size (B8: later catalog edits never
-- change old orders). Lines saved before this migration have no snapshot; readers fall back to the
-- variant's current size for them (item_size below).

create type public.size_unit as enum ('g', 'ml', 'pcs');

alter table public.variants
  add column size_amount numeric(12, 3) null check (size_amount > 0),
  add column size_unit public.size_unit null,
  add constraint variants_size_pair check ((size_amount is null) = (size_unit is null));

alter table public.order_items
  add column size_amount numeric(12, 3) null check (size_amount > 0),
  add column size_unit public.size_unit null,
  add constraint order_items_size_pair check ((size_amount is null) = (size_unit is null));

-- ---------------------------------------------------------------------------
-- item_size(line): the line's own size snapshot, else its variant's current size, else nulls.
-- Unit and amount always come from the same source.
-- ---------------------------------------------------------------------------
create function public.item_size(
  p_item public.order_items,
  out unit public.size_unit,
  out amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select case when p_item.size_unit is not null then p_item.size_unit else v.size_unit end,
         case when p_item.size_unit is not null then p_item.size_amount else v.size_amount end
    from (select 1) one
    left join public.variants v on v.id = p_item.variant_id;
$$;

-- ---------------------------------------------------------------------------
-- upsert_product: variants may carry size_amount (decimal string) + size_unit ('g'|'ml'|'pcs').
-- Both or neither; a variant without the keys keeps its current size.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_product(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_variant jsonb;
  v_vid uuid;
  v_pos integer := 0;
  v_has_size boolean;
  v_amount numeric;
  v_unit public.size_unit;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_id is null then
    insert into public.products (name, sort_order, is_active)
    values (
      btrim(p ->> 'name'),
      coalesce((p ->> 'sort_order')::integer, 0),
      coalesce((p ->> 'is_active')::boolean, true)
    )
    returning id into v_id;
  else
    update public.products
       set name = btrim(p ->> 'name'),
           sort_order = coalesce((p ->> 'sort_order')::integer, sort_order),
           is_active = coalesce((p ->> 'is_active')::boolean, is_active)
     where id = v_id and deleted_at is null;
    if not found then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  end if;

  for v_variant in select value from jsonb_array_elements(coalesce(p -> 'variants', '[]'::jsonb))
  loop
    v_vid := nullif(v_variant ->> 'id', '')::uuid;
    v_has_size := v_variant ? 'size_unit' or v_variant ? 'size_amount';
    v_amount := nullif(v_variant ->> 'size_amount', '')::numeric;
    if nullif(v_variant ->> 'size_unit', '') is not null
       and v_variant ->> 'size_unit' not in ('g', 'ml', 'pcs') then
      raise exception 'size unit must be g, ml or pcs' using errcode = '22023';
    end if;
    v_unit := nullif(v_variant ->> 'size_unit', '')::public.size_unit;
    if (v_amount is null) <> (v_unit is null) then
      raise exception 'a size needs both an amount and a unit' using errcode = '22023';
    end if;
    if v_amount is not null and v_amount <= 0 then
      raise exception 'size must be more than 0' using errcode = '22023';
    end if;

    if v_vid is null then
      insert into public.variants
        (product_id, name, price, cost_price, sort_order, is_active, size_amount, size_unit)
      values (
        v_id,
        btrim(v_variant ->> 'name'),
        (v_variant ->> 'price')::numeric,
        (v_variant ->> 'cost_price')::numeric,
        v_pos,
        coalesce((v_variant ->> 'is_active')::boolean, true),
        v_amount,
        v_unit
      );
    else
      update public.variants
         set name = btrim(v_variant ->> 'name'),
             price = (v_variant ->> 'price')::numeric,
             cost_price = (v_variant ->> 'cost_price')::numeric,
             sort_order = v_pos,
             is_active = coalesce((v_variant ->> 'is_active')::boolean, is_active),
             size_amount = case when v_has_size then v_amount else size_amount end,
             size_unit = case when v_has_size then v_unit else size_unit end
       where id = v_vid and product_id = v_id and deleted_at is null;
      if not found then
        raise exception 'variant not found' using errcode = 'P0002';
      end if;
    end if;
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- replace_order_items: unchanged rules, plus the size snapshot (kept items keep theirs).
-- ---------------------------------------------------------------------------
create or replace function public.replace_order_items(p_order uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_item jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_pos integer := 0;
  v_qty integer;
  v_vid uuid;
  v_iid uuid;
  v_old public.order_items;
  v_cat record;
begin
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'items must be a list' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 100000 then
      raise exception 'quantity must be between 1 and 100000' using errcode = '22023';
    end if;
    v_vid := nullif(v_item ->> 'variant_id', '')::uuid;
    v_iid := nullif(v_item ->> 'id', '')::uuid;

    v_old := null;
    if v_iid is not null then
      select * into v_old
        from public.order_items
       where id = v_iid and order_id = p_order and variant_id is not distinct from v_vid;
    end if;

    if v_old.id is not null then
      v_rows := v_rows || jsonb_build_object(
        'variant_id', v_old.variant_id, 'product_name', v_old.product_name,
        'variant_name', v_old.variant_name, 'unit_price', v_old.unit_price,
        'cost_price', v_old.cost_price, 'size_amount', v_old.size_amount,
        'size_unit', v_old.size_unit, 'quantity', v_qty, 'position', v_pos);
    else
      if v_vid is null then
        raise exception 'item has no variant' using errcode = '22023';
      end if;
      select pr.name as product_name, v.name as variant_name, v.price, v.cost_price,
             v.size_amount, v.size_unit
        into v_cat
        from public.variants v
        join public.products pr on pr.id = v.product_id
       where v.id = v_vid
         and v.deleted_at is null and pr.deleted_at is null
         and v.is_active and pr.is_active;
      if not found then
        raise exception 'an item is no longer available in the catalog' using errcode = 'P0002';
      end if;
      v_rows := v_rows || jsonb_build_object(
        'variant_id', v_vid, 'product_name', v_cat.product_name,
        'variant_name', v_cat.variant_name, 'unit_price', v_cat.price,
        'cost_price', v_cat.cost_price, 'size_amount', v_cat.size_amount,
        'size_unit', v_cat.size_unit, 'quantity', v_qty, 'position', v_pos);
    end if;
    v_pos := v_pos + 1;
  end loop;

  delete from public.order_items where order_id = p_order;
  insert into public.order_items
    (order_id, variant_id, product_name, variant_name, unit_price, cost_price,
     size_amount, size_unit, quantity, position)
  select p_order, (r ->> 'variant_id')::uuid, r ->> 'product_name', r ->> 'variant_name',
         (r ->> 'unit_price')::numeric, (r ->> 'cost_price')::numeric,
         (r ->> 'size_amount')::numeric, (r ->> 'size_unit')::public.size_unit,
         (r ->> 'quantity')::integer, (r ->> 'position')::integer
    from jsonb_array_elements(v_rows) r;
end;
$$;

-- ---------------------------------------------------------------------------
-- rollback_order: unchanged, except items restore their size snapshot too (snapshots taken before
-- this migration have no size keys, which restores as no snapshot).
-- ---------------------------------------------------------------------------
create or replace function public.rollback_order(p_id uuid, p_target integer, p_version integer)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  s jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_id for update;
  if not found or v_order.deleted_at is not null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.version_no <> p_version then
    raise exception 'order changed on another device' using errcode = 'SB409';
  end if;
  if p_target = p_version then
    raise exception 'that is already the current version' using errcode = '22023';
  end if;

  select snapshot into s from public.order_versions where order_id = p_id and version_no = p_target;
  if s is null then
    raise exception 'version not found' using errcode = 'P0002';
  end if;

  -- 1) Fields, status and payment. The timestamp trigger reacts to the status/payment change...
  update public.orders
     set customer_name = s ->> 'customer_name',
         customer_phone = s ->> 'customer_phone',
         order_date = (s ->> 'order_date')::date,
         due_date = (s ->> 'due_date')::date,
         notes = s ->> 'notes',
         discount = (s ->> 'discount')::numeric,
         status = (s ->> 'status')::public.order_status,
         cancelled_from = (s ->> 'cancelled_from')::public.order_status,
         payment_status = (s ->> 'payment_status')::public.payment_status,
         payment_mode = (s ->> 'payment_mode')::public.payment_mode,
         version_no = version_no + 1
   where id = p_id;

  -- 2) ...then put the snapshot's exact timestamps back (status/payment unchanged now, so the
  -- trigger keeps them).
  update public.orders
     set ready_at = (s ->> 'ready_at')::timestamptz,
         delivered_at = (s ->> 'delivered_at')::timestamptz,
         cancelled_at = (s ->> 'cancelled_at')::timestamptz,
         paid_at = (s ->> 'paid_at')::timestamptz
   where id = p_id;

  -- 3) Items exactly as snapshotted (names, prices and sizes included; never re-read the catalog).
  delete from public.order_items where order_id = p_id;
  insert into public.order_items
    (order_id, variant_id, product_name, variant_name, unit_price, cost_price,
     size_amount, size_unit, quantity, position)
  select p_id, (i ->> 'variant_id')::uuid, i ->> 'product_name', i ->> 'variant_name',
         (i ->> 'unit_price')::numeric, (i ->> 'cost_price')::numeric,
         (i ->> 'size_amount')::numeric, (i ->> 'size_unit')::public.size_unit,
         (i ->> 'quantity')::integer, (i ->> 'position')::integer
    from jsonb_array_elements(coalesce(s -> 'items', '[]'::jsonb)) i;

  perform public.check_order_rules(p_id);
  perform public.record_order_version(p_id, 'rollback', format('Rolled back to version %s', p_target));

  select * into v_order from public.orders where id = p_id;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- prep_list: as before, plus per product and per variant: grams, ml, pieces (sum of quantity x
-- size) and unsized (quantity of lines with no size).
-- ---------------------------------------------------------------------------
create or replace function public.prep_list()
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
           v.sort_order as variant_sort,
           s.unit, s.amount
      from public.orders o
      join public.order_items i on i.order_id = o.id
      left join public.variants v on v.id = i.variant_id
      left join public.products p on p.id = v.product_id
      cross join lateral public.item_size(i) s
     where o.status = 'new' and o.deleted_at is null
  ),
  variants as (
    select product_key, variant_key,
           (array_agg(variant_name order by created_at desc))[1] as name,
           sum(quantity)::int as quantity,
           count(distinct order_id)::int as orders,
           coalesce(sum(quantity * amount) filter (where unit = 'g'), 0) as grams,
           coalesce(sum(quantity * amount) filter (where unit = 'ml'), 0) as ml,
           coalesce(sum(quantity * amount) filter (where unit = 'pcs'), 0) as pieces,
           coalesce(sum(quantity) filter (where unit is null), 0)::int as unsized,
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
           coalesce(sum(quantity * amount) filter (where unit = 'g'), 0) as grams,
           coalesce(sum(quantity * amount) filter (where unit = 'ml'), 0) as ml,
           coalesce(sum(quantity * amount) filter (where unit = 'pcs'), 0) as pieces,
           coalesce(sum(quantity) filter (where unit is null), 0)::int as unsized,
           min(product_sort) as sort_order
      from lines
     group by product_key
  )
  select jsonb_build_object(
    'orders', (select count(distinct order_id)::int from lines),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', p.product_key, 'name', p.name, 'quantity', p.quantity, 'orders', p.orders,
               'grams', p.grams, 'ml', p.ml, 'pieces', p.pieces, 'unsized', p.unsized,
               'variants', (
                 select jsonb_agg(jsonb_build_object(
                          'key', v.variant_key, 'name', v.name, 'quantity', v.quantity,
                          'orders', v.orders, 'grams', v.grams, 'ml', v.ml, 'pieces', v.pieces,
                          'unsized', v.unsized)
                        order by v.sort_order nulls last, v.min_price, v.name)
                   from variants v
                  where v.product_key = p.product_key))
             order by p.sort_order nulls last, lower(p.name))
        from products p), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- analytics_month: as before (PLAN §5.1), plus grams / ml / pieces / unsized on by_product and
-- by_variant (delivered quantity x size).
-- ---------------------------------------------------------------------------
create or replace function public.analytics_month(p_month text)
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
    'daily', (
      select jsonb_agg(jsonb_build_object('date', day, 'sales', sales, 'orders', orders) order by day)
        from daily)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.item_size(public.order_items) from public, anon;
grant execute on function public.item_size(public.order_items) to authenticated;
