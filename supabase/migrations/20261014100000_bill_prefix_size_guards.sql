-- Review fixes:
-- 1) B6: the bill prefix is snapshotted on the order with its number, so changing the prefix in
--    Settings never relabels a bill the customer already has ("INV-0007" stays "INV-0007").
-- 2) B6: a bill number never changes once given, and settings.next_bill_no only goes up (a lower
--    value would make every later bill collide with the unique index).
-- 3) B8: order lines keep only their own size snapshot. The fallback to the variant's current size
--    (meant for lines saved before sizes existed) also caught lines that were snapshotted as
--    unsized, so adding a size in the catalog later rewrote old orders and past analytics.
--    Old lines are backfilled once (so nothing shown today changes), then the fallback goes.

-- ---------------------------------------------------------------------------
-- 1) Bill prefix on the order
-- ---------------------------------------------------------------------------
alter table public.orders add column bill_prefix text null;

update public.orders o
   set bill_prefix = s.bill_prefix
  from public.settings s
 where s.owner_id = o.owner_id
   and o.bill_no is not null;

alter table public.orders
  add constraint orders_bill_prefix_pair check ((bill_no is null) = (bill_prefix is null));

create or replace function public.reserve_bill_number(p_order uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.deleted_at is not null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order) then
    raise exception 'add at least one item before making a bill' using errcode = '22023';
  end if;

  if v_order.bill_no is null then
    -- Number and prefix are given together, once.
    update public.orders
       set bill_no = public.next_bill_no(),
           bill_prefix = (select s.bill_prefix from public.settings s where s.owner_id = auth.uid())
     where id = p_order;
  end if;

  return public.order_snapshot(p_order)
    || jsonb_build_object('content_hash', public.bill_content_hash(p_order));
end;
$$;

-- CSV rows carry each order's own prefix (return type changes, so drop + create).
drop function public.export_orders_csv_rows(text);

create function public.export_orders_csv_rows(p_month text)
returns table (
  order_no integer,
  bill_no integer,
  bill_prefix text,
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
  select o.order_no, o.bill_no, o.bill_prefix, o.order_date, o.delivered_at, o.customer_name,
         o.customer_phone,
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

revoke all on function public.export_orders_csv_rows(text) from public, anon;
grant execute on function public.export_orders_csv_rows(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Guards (also hold for writes that bypass the RPCs)
-- ---------------------------------------------------------------------------
create function public.orders_guard_bill_no()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.bill_no is not null
     and (new.bill_no is distinct from old.bill_no or new.bill_prefix is distinct from old.bill_prefix) then
    raise exception 'a bill number never changes once given' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger orders_guard_bill_no
  before update of bill_no, bill_prefix on public.orders
  for each row execute function public.orders_guard_bill_no();

create function public.settings_guard_next_bill_no()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.next_bill_no < old.next_bill_no then
    raise exception 'the next bill number can only go up' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger settings_guard_next_bill_no
  before update of next_bill_no on public.settings
  for each row execute function public.settings_guard_next_bill_no();

revoke all on function public.orders_guard_bill_no(), public.settings_guard_next_bill_no()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Sizes: freeze today's view into the lines, then read only the snapshot
-- ---------------------------------------------------------------------------
update public.order_items i
   set size_amount = v.size_amount,
       size_unit = v.size_unit
  from public.variants v
 where v.id = i.variant_id
   and i.size_unit is null
   and v.size_unit is not null;

-- Same signature (prep_list and analytics_month call it); now just the line's own snapshot.
create or replace function public.item_size(
  p_item public.order_items,
  out unit public.size_unit,
  out amount numeric
)
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_item.size_unit, p_item.size_amount;
$$;
