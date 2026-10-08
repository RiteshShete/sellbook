-- Sellbook database foundation, part 2: totals, status/payment timestamps, numbering, keep-alive.
-- Every function is SECURITY INVOKER with a fixed search_path, so RLS always applies.

-- ---------------------------------------------------------------------------
-- Order total = max(0, sum(line_total) - discount)   (B3)
-- ---------------------------------------------------------------------------
create function public.compute_order_total(p_order uuid, p_discount numeric)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select greatest(0, coalesce(sum(line_total), 0) - p_discount)
  from public.order_items
  where order_id = p_order;
$$;

-- Fired after order_items insert/update/delete: refresh the parent order's total.
create function public.order_items_refresh_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.orders o
       set total = public.compute_order_total(o.id, o.discount)
     where o.id = new.order_id;
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.order_id is distinct from new.order_id) then
    update public.orders o
       set total = public.compute_order_total(o.id, o.discount)
     where o.id = old.order_id;
  end if;
  return null;
end;
$$;

create trigger order_items_refresh_total
  after insert or update or delete on public.order_items
  for each row execute function public.order_items_refresh_total();

-- Fired before orders insert / when discount changes: keep total consistent with items.
create function public.orders_set_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.total := public.compute_order_total(new.id, new.discount);
  return new;
end;
$$;

create trigger orders_set_total_on_insert
  before insert on public.orders
  for each row execute function public.orders_set_total();

create trigger orders_set_total_on_discount
  before update of discount on public.orders
  for each row
  when (old.discount is distinct from new.discount)
  execute function public.orders_set_total();

-- ---------------------------------------------------------------------------
-- Status / payment timestamps
--  * entering ready/delivered/cancelled stamps ready_at/delivered_at/cancelled_at
--  * moving back clears them: ->new clears ready_at+delivered_at, ->ready clears delivered_at,
--    leaving cancelled clears cancelled_at. Timestamps of earlier steps are kept otherwise,
--    so undoing a cancel restores the original delivered_at.
--  * paid_at is set when payment becomes paid; pending clears paid_at and payment_mode
-- ---------------------------------------------------------------------------
create function public.orders_apply_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_status public.order_status;
  v_old_payment public.payment_status;
  v_old_ready timestamptz;
  v_old_delivered timestamptz;
begin
  if tg_op = 'UPDATE' then
    v_old_status := old.status;
    v_old_payment := old.payment_status;
    v_old_ready := old.ready_at;
    v_old_delivered := old.delivered_at;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from v_old_status then
    case new.status
      when 'new' then
        new.ready_at := null;
        new.delivered_at := null;
        new.cancelled_at := null;
      when 'ready' then
        new.ready_at := coalesce(v_old_ready, now());
        new.delivered_at := null;
        new.cancelled_at := null;
      when 'delivered' then
        new.delivered_at := coalesce(v_old_delivered, now());
        new.cancelled_at := null;
      when 'cancelled' then
        new.cancelled_at := now();
    end case;
  end if;

  if new.payment_status = 'paid' then
    if tg_op = 'INSERT' then
      new.paid_at := coalesce(new.paid_at, now());
    elsif new.payment_status is distinct from v_old_payment then
      new.paid_at := now();
    end if;
  else
    new.paid_at := null;
    new.payment_mode := null;
  end if;

  return new;
end;
$$;

create trigger orders_apply_timestamps
  before insert or update on public.orders
  for each row execute function public.orders_apply_timestamps();

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------

-- Next per-owner order number. The advisory transaction lock serialises concurrent
-- callers for the same owner until their transaction commits, so two inserts can
-- never compute the same number (the unique (owner_id, order_no) is the backstop).
create function public.next_order_no()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_next integer;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sellbook:order_no:' || v_owner::text, 0));
  select coalesce(max(order_no), 0) + 1 into v_next
    from public.orders
   where owner_id = v_owner;
  return v_next;
end;
$$;

alter table public.orders alter column order_no set default public.next_order_no();

-- Reserve the next bill number atomically; the number is never reused.
create function public.next_bill_no()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill_no integer;
begin
  update public.settings
     set next_bill_no = next_bill_no + 1
   where owner_id = auth.uid()
  returning next_bill_no - 1 into v_bill_no;

  if v_bill_no is null then
    raise exception 'settings row not found for current user' using errcode = 'P0002';
  end if;
  return v_bill_no;
end;
$$;

-- ---------------------------------------------------------------------------
-- Keep-alive: touches no table, callable by anon.
-- ---------------------------------------------------------------------------
create function public.ping()
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select 1;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nobody by default; authenticated for the numbering helpers;
-- anon + authenticated for ping().
-- ---------------------------------------------------------------------------
revoke all on function
  public.set_updated_at(),
  public.compute_order_total(uuid, numeric),
  public.order_items_refresh_total(),
  public.orders_set_total(),
  public.orders_apply_timestamps(),
  public.next_order_no(),
  public.next_bill_no(),
  public.ping()
from public, anon, authenticated;

grant execute on function public.compute_order_total(uuid, numeric) to authenticated;
grant execute on function public.next_order_no() to authenticated;
grant execute on function public.next_bill_no() to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- Future functions created by this role are not executable by PUBLIC/anon unless granted.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
