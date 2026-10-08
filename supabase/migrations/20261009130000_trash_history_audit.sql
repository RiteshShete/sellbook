-- M5: audit log, order trash/restore, rollback to any version.

-- ---------------------------------------------------------------------------
-- audit_log: insert-only. Orders are logged by record_order_version (every order RPC);
-- products / variants / settings by triggers.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  entity text not null check (entity in ('order', 'product', 'variant', 'settings', 'bill')),
  entity_id uuid null,
  action text not null
    check (action in ('create', 'update', 'delete', 'restore', 'status', 'payment', 'rollback', 'bill')),
  summary text not null,
  before jsonb null,
  after jsonb null
);

create index audit_log_owner_created_idx on public.audit_log (owner_id, created_at desc, id desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select, insert on public.audit_log to authenticated;

create policy audit_log_select_own on public.audit_log
  for select to authenticated using (owner_id = (select auth.uid()));
create policy audit_log_insert_own on public.audit_log
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Order versions now also write the audit row (same transaction).
-- ---------------------------------------------------------------------------
create or replace function public.record_order_version(p_order uuid, p_reason text, p_summary text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order;

  insert into public.order_versions (order_id, version_no, reason, summary, snapshot)
  values (v_order.id, v_order.version_no, p_reason, p_summary, public.order_snapshot(v_order.id));

  insert into public.audit_log (owner_id, entity, entity_id, action, summary)
  values (
    v_order.owner_id, 'order', v_order.id,
    case p_reason when 'edit' then 'update' else p_reason end,
    format('#%s %s: %s', v_order.order_no, v_order.customer_name, p_summary)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog + settings audit trigger. Skips no-op updates (only updated_at changed).
-- ---------------------------------------------------------------------------
create function public.audit_row_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entity text := case tg_table_name when 'products' then 'product' when 'variants' then 'variant' else 'settings' end;
  v_action text;
  v_label text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return null;
  -- via to_jsonb: settings has no deleted_at column (a missing key reads as null).
  elsif (to_jsonb(old) ->> 'deleted_at') is null and (to_jsonb(new) ->> 'deleted_at') is not null then
    v_action := 'delete';
  elsif (to_jsonb(old) ->> 'deleted_at') is not null and (to_jsonb(new) ->> 'deleted_at') is null then
    v_action := 'restore';
  else
    v_action := 'update';
  end if;

  v_label := case v_entity
    when 'settings' then 'Settings'
    when 'product' then 'Product ' || (to_jsonb(new) ->> 'name')
    else 'Variant ' || (to_jsonb(new) ->> 'name')
  end;

  insert into public.audit_log (owner_id, entity, entity_id, action, summary, before, after)
  values (
    new.owner_id, v_entity, new.id, v_action,
    v_label || ' ' || case v_action
      when 'create' then 'added' when 'delete' then 'moved to Trash'
      when 'restore' then 'restored' else 'updated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return null;
end;
$$;

create trigger audit_products after insert or update on public.products
  for each row execute function public.audit_row_change();
create trigger audit_variants after insert or update on public.variants
  for each row execute function public.audit_row_change();
create trigger audit_settings after insert or update on public.settings
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- trash_order / restore_order (soft delete; excluded from everything while trashed, A5)
-- ---------------------------------------------------------------------------
create function public.trash_order(p_id uuid)
returns public.orders
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
  update public.orders
     set deleted_at = clock_timestamp(), version_no = version_no + 1
   where id = p_id and deleted_at is null
  returning * into v_order;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  perform public.record_order_version(p_id, 'delete', 'Moved to Trash');
  return v_order;
end;
$$;

create function public.restore_order(p_id uuid)
returns public.orders
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
  update public.orders
     set deleted_at = null, version_no = version_no + 1
   where id = p_id and deleted_at is not null
  returning * into v_order;
  if not found then
    raise exception 'order not found in trash' using errcode = 'P0002';
  end if;
  perform public.record_order_version(p_id, 'restore', 'Restored from Trash');
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- rollback_order(p_id, p_target, p_version): make the order look exactly like version p_target
-- (fields, items with their snapshot prices, status, payment, timestamps). bill_no is kept.
-- Recorded as a new version ('rollback'), so a rollback can itself be rolled back.
-- ---------------------------------------------------------------------------
create function public.rollback_order(p_id uuid, p_target integer, p_version integer)
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

  -- 3) Items exactly as snapshotted (names and prices included; never re-read the catalog).
  delete from public.order_items where order_id = p_id;
  insert into public.order_items
    (order_id, variant_id, product_name, variant_name, unit_price, cost_price, quantity, position)
  select p_id, (i ->> 'variant_id')::uuid, i ->> 'product_name', i ->> 'variant_name',
         (i ->> 'unit_price')::numeric, (i ->> 'cost_price')::numeric,
         (i ->> 'quantity')::integer, (i ->> 'position')::integer
    from jsonb_array_elements(coalesce(s -> 'items', '[]'::jsonb)) i;

  perform public.check_order_rules(p_id);
  perform public.record_order_version(p_id, 'rollback', format('Rolled back to version %s', p_target));

  select * into v_order from public.orders where id = p_id;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function
  public.audit_row_change(),
  public.trash_order(uuid),
  public.restore_order(uuid),
  public.rollback_order(uuid, integer, integer)
from public, anon;

grant execute on function
  public.trash_order(uuid),
  public.restore_order(uuid),
  public.rollback_order(uuid, integer, integer)
to authenticated;
