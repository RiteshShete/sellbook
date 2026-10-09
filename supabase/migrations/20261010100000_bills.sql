-- M6: bill numbers, bill revisions, outdated detection (B6, B7).
-- Same security model as before: SECURITY INVOKER, fixed search_path, RLS applies.

-- ---------------------------------------------------------------------------
-- Bills are insert-only history (old images are kept; requirement 4).
-- ---------------------------------------------------------------------------
revoke update on public.bills from authenticated;
drop policy bills_update_own on public.bills;

alter table public.bills add constraint bills_image_path_uniq unique (image_path);
create index bills_order_revision_idx on public.bills (order_id, revision desc);

-- B6: a bill number belongs to one order only.
create unique index orders_owner_bill_no_uniq on public.orders (owner_id, bill_no)
  where bill_no is not null;

-- ---------------------------------------------------------------------------
-- bill_content_hash(order): md5 of what the bill prints that B7 tracks: items (name, variant,
-- unit price, qty, in order), discount and total. A bill is outdated when its items_hash differs.
-- ---------------------------------------------------------------------------
create function public.bill_content_hash(p_order uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_array(i.product_name, i.variant_name, i.unit_price::text, i.quantity)
                       order by i.position)
        from public.order_items i
       where i.order_id = o.id
    ), '[]'::jsonb),
    'discount', o.discount::text,
    'total', o.total::text
  )::text)
  from public.orders o
  where o.id = p_order;
$$;

-- ---------------------------------------------------------------------------
-- reserve_bill_number(order): gives the order its bill number once (never changes, never reused)
-- and returns what to print: the order snapshot (row + items) plus bill_no and content_hash,
-- read in one statement so the hash matches the data the client renders.
-- Not an order edit: version_no is not bumped (an open edit form stays valid).
-- ---------------------------------------------------------------------------
create function public.reserve_bill_number(p_order uuid)
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
    update public.orders set bill_no = public.next_bill_no() where id = p_order;
  end if;

  return public.order_snapshot(p_order)
    || jsonb_build_object('content_hash', public.bill_content_hash(p_order));
end;
$$;

-- ---------------------------------------------------------------------------
-- register_bill_revision(order, path, hash): records an uploaded bill image as the next revision.
-- p_hash is the content_hash the image was rendered from; if the order changed since, raises
-- SB410 and the client renders again. The image must already be in the bills bucket, in the
-- caller's folder.
-- ---------------------------------------------------------------------------
create function public.register_bill_revision(p_order uuid, p_path text, p_hash text)
returns public.bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_bill public.bills;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.deleted_at is not null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.bill_no is null then
    raise exception 'this order has no bill number yet' using errcode = '22023';
  end if;
  if p_hash is distinct from public.bill_content_hash(p_order) then
    raise exception 'the order changed while the bill was being made' using errcode = 'SB410';
  end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects where bucket_id = 'bills' and name = p_path) then
    raise exception 'bill image not found in storage' using errcode = 'P0002';
  end if;

  insert into public.bills (order_id, bill_no, revision, image_path, total_at_generation, items_hash)
  values (
    p_order,
    v_order.bill_no,
    coalesce((select max(revision) from public.bills where order_id = p_order), 0) + 1,
    p_path,
    v_order.total,
    p_hash
  )
  returning * into v_bill;

  insert into public.audit_log (owner_id, entity, entity_id, action, summary)
  values (
    v_order.owner_id, 'bill', p_order, 'bill',
    format('#%s %s: bill no. %s, revision %s', v_order.order_no, v_order.customer_name,
           v_bill.bill_no, v_bill.revision)
  );

  return v_bill;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function
  public.bill_content_hash(uuid),
  public.reserve_bill_number(uuid),
  public.register_bill_revision(uuid, text, text)
from public, anon;

grant execute on function
  public.bill_content_hash(uuid),
  public.reserve_bill_number(uuid),
  public.register_bill_revision(uuid, text, text)
to authenticated;
