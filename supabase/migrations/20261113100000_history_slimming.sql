-- History slimming: keep the free database small as users and orders grow.
--  1) status / payment / trash / restore versions store only what changed (a "delta"), not the whole order.
--  2) full snapshots are slimmer (no repeated ids, timestamps, nulls or derived line totals).
--  3) prune_order_history(): keep the first version, the last N and everything from the last D days.
--  4) audit rows for product / variant / settings edits keep changed fields only; prune_audit_log()
--     expires audit rows after 12 months.
-- ADDITIVE and backward compatible: the table order_versions is unchanged, old full snapshots stay valid
-- (they are simply "full" rows), order_snapshot() (used by bills) is NOT touched, and rollback_order /
-- the history screen read versions through order_version_state() / list_order_versions(), which rebuild a
-- delta version from the nearest earlier full snapshot plus the deltas in between.

-- ---------------------------------------------------------------------------
-- Slim snapshot pieces
-- ---------------------------------------------------------------------------

-- Items reduced to what rollback and the history screen read; null keys dropped.
create function public.slim_order_items(p_items jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'variant_id', t.e -> 'variant_id',
      'product_name', t.e -> 'product_name',
      'variant_name', t.e -> 'variant_name',
      'unit_price', t.e -> 'unit_price',
      'cost_price', t.e -> 'cost_price',
      'size_amount', t.e -> 'size_amount',
      'size_unit', t.e -> 'size_unit',
      'quantity', t.e -> 'quantity',
      'position', t.e -> 'position'
    )) order by t.ord
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(e, ord);
$$;

-- The slim full snapshot stored in order_versions (order_snapshot() stays as it is, for bills).
create function public.order_version_snapshot(p_order uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'order_date', o.order_date,
    'due_date', o.due_date,
    'notes', o.notes,
    'discount', o.discount,
    'total', o.total,
    'status', o.status,
    'cancelled_from', o.cancelled_from,
    'payment_status', o.payment_status,
    'payment_mode', o.payment_mode,
    'ready_at', o.ready_at,
    'delivered_at', o.delivered_at,
    'cancelled_at', o.cancelled_at,
    'paid_at', o.paid_at,
    'items', public.slim_order_items(coalesce((
      select jsonb_agg(to_jsonb(i) order by i.position)
        from public.order_items i
       where i.order_id = o.id
    ), '[]'::jsonb))
  )
  from public.orders o
  where o.id = p_order;
$$;

-- The full state of an order as of a version: the nearest full snapshot at or before it, plus every
-- delta after that up to the version. null when there is no full snapshot to start from.
create function public.order_version_state(p_order uuid, p_version integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_base public.order_versions;
  v_state jsonb;
  r record;
begin
  select * into v_base from public.order_versions
   where order_id = p_order and version_no <= p_version and not (snapshot ? '_delta')
   order by version_no desc limit 1;
  if not found then
    return null;
  end if;
  v_state := v_base.snapshot;
  for r in
    select snapshot from public.order_versions
     where order_id = p_order and version_no > v_base.version_no and version_no <= p_version
     order by version_no
  loop
    v_state := v_state || (r.snapshot - '_delta');
  end loop;
  return v_state;
end;
$$;

-- Every version of an order with its FULL state, oldest first (the history screen sorts it).
create function public.list_order_versions(p_order uuid)
returns table (version_no integer, reason text, summary text, created_at timestamptz, snapshot jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  r record;
  s jsonb;
begin
  for r in
    select v.version_no as vn, v.reason as rs, v.summary as sm, v.created_at as ca, v.snapshot as sn
      from public.order_versions v
     where v.order_id = p_order
     order by v.version_no
  loop
    if r.sn ? '_delta' then
      if s is null then
        continue; -- a delta with nothing to build on cannot be shown
      end if;
      s := s || (r.sn - '_delta');
    else
      s := r.sn;
    end if;
    version_no := r.vn;
    reason := r.rs;
    summary := r.sm;
    created_at := r.ca;
    snapshot := s;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_order_version: deltas for status / payment / trash / restore, slim full snapshots otherwise.
-- (Same audit row as before, in the same transaction.)
-- ---------------------------------------------------------------------------
create or replace function public.record_order_version(p_order uuid, p_reason text, p_summary text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_snap jsonb;
  v_prev jsonb;
  v_delta jsonb;
begin
  select * into v_order from public.orders where id = p_order;
  v_snap := public.order_version_snapshot(p_order);

  if p_reason in ('status', 'payment', 'delete', 'restore') then
    v_prev := public.order_version_state(p_order, v_order.version_no - 1);
    if v_prev is not null then
      select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_delta
        from jsonb_each(v_snap) n
       where n.key <> 'items' and (v_prev -> n.key) is distinct from n.value;
      if public.slim_order_items(v_prev -> 'items') is distinct from (v_snap -> 'items') then
        v_delta := v_delta || jsonb_build_object('items', v_snap -> 'items');
      end if;
      v_snap := v_delta || '{"_delta": true}'::jsonb;
    end if;
  end if;

  insert into public.order_versions (order_id, version_no, reason, summary, snapshot)
  values (v_order.id, v_order.version_no, p_reason, p_summary, v_snap);

  insert into public.audit_log (owner_id, entity, entity_id, action, summary)
  values (
    v_order.owner_id, 'order', v_order.id,
    case p_reason when 'edit' then 'update' else p_reason end,
    format('#%s %s: %s', v_order.order_no, v_order.customer_name, p_summary)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- rollback_order: as in 20261013100000_sizes.sql, but the target state is rebuilt from deltas.
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

  if not exists (select 1 from public.order_versions where order_id = p_id and version_no = p_target) then
    raise exception 'version not found' using errcode = 'P0002';
  end if;
  s := public.order_version_state(p_id, p_target);
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
-- Audit trigger: updates keep only the fields that changed (before / after); creates drop the
-- bookkeeping keys. Same action, summary and skip-no-op rules as before.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entity text := case tg_table_name when 'products' then 'product' when 'variants' then 'variant' else 'settings' end;
  v_action text;
  v_label text;
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_new jsonb := to_jsonb(new);
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif (v_new - 'updated_at') = (v_old - 'updated_at') then
    return null;
  -- via jsonb: settings has no deleted_at column (a missing key reads as null).
  elsif (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
    v_action := 'delete';
  elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
    v_action := 'restore';
  else
    v_action := 'update';
  end if;

  v_label := case v_entity
    when 'settings' then 'Settings'
    when 'product' then 'Product ' || (v_new ->> 'name')
    else 'Variant ' || (v_new ->> 'name')
  end;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(o.key, o.value) into v_before
      from jsonb_each(v_old) o
     where o.key <> 'updated_at' and (v_new -> o.key) is distinct from o.value;
    select jsonb_object_agg(n.key, n.value) into v_after
      from jsonb_each(v_new) n
     where n.key <> 'updated_at' and (v_old -> n.key) is distinct from n.value;
  else
    v_after := v_new - '{owner_id,created_at,updated_at}'::text[];
  end if;

  insert into public.audit_log (owner_id, entity, entity_id, action, summary, before, after)
  values (
    new.owner_id, v_entity, new.id, v_action,
    v_label || ' ' || case v_action
      when 'create' then 'added' when 'delete' then 'moved to Trash'
      when 'restore' then 'restored' else 'updated' end,
    v_before, v_after
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention. Run by pg_cron (superuser) or by hand; app users cannot call them (history is
-- append-only for them).
-- ---------------------------------------------------------------------------

-- Per order keeps: the first version, the last p_keep_last, and everything newer than p_days.
-- A kept delta whose predecessor is dropped is first turned into a full snapshot, so every kept
-- version can still be rebuilt (and rolled back to). Returns the number of rows deleted.
create function public.prune_order_history(p_keep_last integer default 10, p_days integer default 120)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order uuid;
  v_keep integer[];
  v_deleted integer := 0;
  v_n integer;
  r record;
begin
  for v_order in
    select order_id from public.order_versions group by order_id having count(*) > p_keep_last + 1
  loop
    select array_agg(x.version_no) into v_keep
      from (
        select version_no, created_at,
               row_number() over (order by version_no desc) as rn,
               min(version_no) over () as first_no
          from public.order_versions
         where order_id = v_order
      ) x
     where x.rn <= p_keep_last
        or x.version_no = x.first_no
        or x.created_at >= now() - make_interval(days => p_days);

    for r in
      select version_no from public.order_versions
       where order_id = v_order and version_no = any (v_keep)
         and snapshot ? '_delta' and not ((version_no - 1) = any (v_keep))
       order by version_no
    loop
      update public.order_versions
         set snapshot = public.order_version_state(v_order, r.version_no)
       where order_id = v_order and version_no = r.version_no;
    end loop;

    delete from public.order_versions where order_id = v_order and not (version_no = any (v_keep));
    get diagnostics v_n = row_count;
    v_deleted := v_deleted + v_n;
  end loop;
  return v_deleted;
end;
$$;

-- Audit rows older than p_months months. Returns the number of rows deleted.
create function public.prune_audit_log(p_months integer default 12)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.audit_log where created_at < now() - make_interval(months => p_months);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function
  public.slim_order_items(jsonb),
  public.order_version_snapshot(uuid),
  public.order_version_state(uuid, integer),
  public.list_order_versions(uuid),
  public.prune_order_history(integer, integer),
  public.prune_audit_log(integer)
from public, anon;

grant execute on function
  public.slim_order_items(jsonb),
  public.order_version_snapshot(uuid),
  public.order_version_state(uuid, integer),
  public.list_order_versions(uuid)
to authenticated;
-- prune_* stay with the database owner / pg_cron only. Supabase's default privileges grant new functions
-- to authenticated, so it is revoked explicitly.
revoke execute on function
  public.prune_order_history(integer, integer),
  public.prune_audit_log(integer)
from authenticated;

-- Weekly, Sunday 03:00 IST (21:30 UTC). Skipped with a notice where pg_cron is not available, so the
-- migration never fails on it; then call the two prune functions yourself (docs/HISTORY_SLIMMING.md).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'sellbook-prune-history', '30 21 * * 0',
      'select public.prune_order_history(); select public.prune_audit_log();');
  else
    raise notice 'pg_cron is not available: schedule prune_order_history() and prune_audit_log() yourself';
  end if;
exception when others then
  raise notice 'could not schedule the prune job (%): schedule it yourself', sqlerrm;
end;
$$;
