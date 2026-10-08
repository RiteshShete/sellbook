-- M3: order versions + optimistic concurrency, create/update order RPCs, customer suggestions.
-- SECURITY INVOKER like every other function: RLS applies, so helpers called from the RPCs
-- must be executable by authenticated too.

-- ---------------------------------------------------------------------------
-- orders.version_no: bumped by every RPC write; a stale value means another device changed it.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column version_no integer not null default 1 check (version_no >= 1);

-- ---------------------------------------------------------------------------
-- order_versions: insert-only history, one full snapshot (order row + items) per version.
-- ---------------------------------------------------------------------------
create table public.order_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id),
  version_no integer not null,
  reason text not null
    check (reason in ('create', 'edit', 'status', 'payment', 'delete', 'restore', 'rollback')),
  summary text null,
  snapshot jsonb not null,
  constraint order_versions_order_version_uniq unique (order_id, version_no)
);

create index order_versions_order_idx on public.order_versions (order_id, version_no desc);

alter table public.order_versions enable row level security;
-- Supabase grants new tables to authenticated by default; narrow to read + append.
revoke all on public.order_versions from anon, authenticated;
grant select, insert on public.order_versions to authenticated;

create policy order_versions_select_own on public.order_versions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy order_versions_insert_own on public.order_versions
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Same rules as lib/phone.ts normalizePhone: Indian mobile -> '91XXXXXXXXXX'; blank -> null.
create function public.normalize_phone(p text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^0+', '');
begin
  if v_digits = '' then
    return null;
  end if;
  if length(v_digits) = 12 and left(v_digits, 2) = '91' then
    v_digits := substr(v_digits, 3);
  end if;
  if v_digits !~ '^[6-9][0-9]{9}$' then
    raise exception 'invalid phone number' using errcode = '22023';
  end if;
  return '91' || v_digits;
end;
$$;

create function public.order_snapshot(p_order uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select to_jsonb(o) || jsonb_build_object('items', coalesce((
    select jsonb_agg(to_jsonb(i) order by i.position)
      from public.order_items i
     where i.order_id = o.id
  ), '[]'::jsonb))
  from public.orders o
  where o.id = p_order;
$$;

create function public.record_order_version(p_order uuid, p_reason text, p_summary text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.order_versions (order_id, version_no, reason, summary, snapshot)
  select o.id, o.version_no, p_reason, p_summary, public.order_snapshot(o.id)
    from public.orders o
   where o.id = p_order;
$$;

-- Replaces an order's items from [{id?, variant_id, quantity}].
-- An item whose id AND variant_id match an existing row keeps its snapshot (name, price) and only
-- takes the new quantity (B8). Anything else is snapshotted from the current catalog, which must
-- have the variant and product live and active.
create function public.replace_order_items(p_order uuid, p_items jsonb)
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
        'cost_price', v_old.cost_price, 'quantity', v_qty, 'position', v_pos);
    else
      if v_vid is null then
        raise exception 'item has no variant' using errcode = '22023';
      end if;
      select pr.name as product_name, v.name as variant_name, v.price, v.cost_price
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
        'cost_price', v_cat.cost_price, 'quantity', v_qty, 'position', v_pos);
    end if;
    v_pos := v_pos + 1;
  end loop;

  delete from public.order_items where order_id = p_order;
  insert into public.order_items
    (order_id, variant_id, product_name, variant_name, unit_price, cost_price, quantity, position)
  select p_order, (r ->> 'variant_id')::uuid, r ->> 'product_name', r ->> 'variant_name',
         (r ->> 'unit_price')::numeric, (r ->> 'cost_price')::numeric,
         (r ->> 'quantity')::integer, (r ->> 'position')::integer
    from jsonb_array_elements(v_rows) r;
end;
$$;

-- Header rules shared by create/update. Raises with a readable message.
create function public.check_order_rules(p_order uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_items_total numeric;
  v_item_count integer;
begin
  select * into v_order from public.orders where id = p_order;
  select coalesce(sum(line_total), 0), count(*) into v_items_total, v_item_count
    from public.order_items where order_id = p_order;

  if v_order.due_date is not null and v_order.due_date < v_order.order_date then
    raise exception 'due date cannot be before the order date' using errcode = '22023';
  end if;
  if v_order.discount > v_items_total then
    raise exception 'discount cannot be more than the items total' using errcode = '22023';
  end if;
  if v_order.status in ('ready', 'delivered') and v_item_count = 0 then -- B9
    raise exception 'a ready or delivered order needs at least one item' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_order(p): p = {customer_name, customer_phone?, order_date?, due_date?, notes?,
--                       discount?, items: [{variant_id, quantity}]}
-- Items may be empty (a draft 'new' order). Writes version 1 ('create').
-- ---------------------------------------------------------------------------
create function public.create_order(p jsonb)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'customer_name', ''));
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'customer name must be 1 to 100 characters' using errcode = '22023';
  end if;

  insert into public.orders (customer_name, customer_phone, order_date, due_date, notes, discount)
  values (
    v_name,
    public.normalize_phone(p ->> 'customer_phone'),
    coalesce(nullif(p ->> 'order_date', '')::date, (now() at time zone 'Asia/Kolkata')::date),
    nullif(p ->> 'due_date', '')::date,
    nullif(btrim(coalesce(p ->> 'notes', '')), ''),
    coalesce(nullif(p ->> 'discount', '')::numeric, 0)
  )
  returning * into v_order;

  perform public.replace_order_items(v_order.id, p -> 'items');
  perform public.check_order_rules(v_order.id);
  perform public.record_order_version(v_order.id, 'create', 'Order created');

  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_order(p_id, p, p_version): same fields as create_order; items may carry their id.
-- p_version must equal the current version_no (else SQLSTATE SB409, "changed on another device").
-- ---------------------------------------------------------------------------
create function public.update_order(p_id uuid, p jsonb, p_version integer)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'customer_name', ''));
  v_order public.orders;
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
  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'customer name must be 1 to 100 characters' using errcode = '22023';
  end if;

  update public.orders
     set customer_name = v_name,
         customer_phone = public.normalize_phone(p ->> 'customer_phone'),
         order_date = coalesce(nullif(p ->> 'order_date', '')::date, order_date),
         due_date = nullif(p ->> 'due_date', '')::date,
         notes = nullif(btrim(coalesce(p ->> 'notes', '')), ''),
         discount = coalesce(nullif(p ->> 'discount', '')::numeric, 0),
         version_no = version_no + 1
   where id = p_id;

  perform public.replace_order_items(p_id, p -> 'items');
  perform public.check_order_rules(p_id);
  perform public.record_order_version(p_id, 'edit', 'Order edited');

  select * into v_order from public.orders where id = p_id;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- suggest_customers(q): one row per customer (phone, or name when there is no phone), latest
-- details first. Matches a name substring, or 3+ digits anywhere in the phone.
-- ---------------------------------------------------------------------------
create function public.suggest_customers(p_q text, p_limit integer default 8)
returns table (customer_name text, customer_phone text, last_order_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select lower(btrim(coalesce(p_q, ''))) as t,
           regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as d
  ),
  latest as (
    select distinct on (coalesce(o.customer_phone, lower(o.customer_name)))
           o.customer_name, o.customer_phone, o.order_date
      from public.orders o, q
     where o.deleted_at is null
       and q.t <> ''
       and (strpos(lower(o.customer_name), q.t) > 0
            or (length(q.d) >= 3 and strpos(coalesce(o.customer_phone, ''), q.d) > 0))
     order by coalesce(o.customer_phone, lower(o.customer_name)), o.order_date desc, o.created_at desc
  )
  select l.customer_name, l.customer_phone, l.order_date
    from latest l
   order by l.order_date desc
   limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function
  public.normalize_phone(text),
  public.order_snapshot(uuid),
  public.record_order_version(uuid, text, text),
  public.replace_order_items(uuid, jsonb),
  public.check_order_rules(uuid),
  public.create_order(jsonb),
  public.update_order(uuid, jsonb, integer),
  public.suggest_customers(text, integer)
from public, anon;

grant execute on function
  public.normalize_phone(text),
  public.order_snapshot(uuid),
  public.record_order_version(uuid, text, text),
  public.replace_order_items(uuid, jsonb),
  public.check_order_rules(uuid),
  public.create_order(jsonb),
  public.update_order(uuid, jsonb, integer),
  public.suggest_customers(text, integer)
to authenticated;
