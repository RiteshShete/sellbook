-- M4: status pipeline (B1, B9) and payment (B2) RPCs. Every move writes a version, so every move
-- is undoable by calling the reverse move.
--
-- Allowed moves (from -> to):
--   new -> ready -> delivered            (forward, one step at a time)
--   ready -> new, delivered -> ready     (undo of a forward step)
--   new|ready|delivered -> cancelled     (remembers cancelled_from)
--   cancelled -> cancelled_from          (undo of a cancel; only back to where it was)
-- Timestamps are kept by the orders_apply_timestamps trigger (foundation migration).

alter table public.orders
  add column cancelled_from public.order_status null,
  add constraint orders_cancelled_from_matches_status
    check ((status = 'cancelled') = (cancelled_from is not null) and cancelled_from is distinct from 'cancelled');

-- ---------------------------------------------------------------------------
-- set_order_status(p_id, p_status, p_version)
-- ---------------------------------------------------------------------------
create function public.set_order_status(p_id uuid, p_status public.order_status, p_version integer)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from public.order_status;
  v_ok boolean;
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

  v_from := v_order.status;
  v_ok := case
    when v_from = 'new' then p_status in ('ready', 'cancelled')
    when v_from = 'ready' then p_status in ('delivered', 'new', 'cancelled')
    when v_from = 'delivered' then p_status in ('ready', 'cancelled')
    when v_from = 'cancelled' then p_status = v_order.cancelled_from
    else false
  end;
  if not v_ok then
    raise exception 'cannot move an order from % to %', v_from, p_status using errcode = '22023';
  end if;

  update public.orders
     set status = p_status,
         cancelled_from = case when p_status = 'cancelled' then v_from end,
         version_no = version_no + 1
   where id = p_id;

  perform public.check_order_rules(p_id); -- B9: ready/delivered need at least one item
  perform public.record_order_version(p_id, 'status', format('Status: %s → %s', v_from, p_status));

  select * into v_order from public.orders where id = p_id;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_payment(p_id, p_status, p_mode, p_version)
-- paid needs a mode; pending clears mode and paid_at (trigger). Independent of status (B2).
-- ---------------------------------------------------------------------------
create function public.set_payment(
  p_id uuid,
  p_status public.payment_status,
  p_mode public.payment_mode,
  p_version integer
)
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
  if p_status = 'paid' and p_mode is null then
    raise exception 'choose online or cash' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_id for update;
  if not found or v_order.deleted_at is not null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.version_no <> p_version then
    raise exception 'order changed on another device' using errcode = 'SB409';
  end if;

  update public.orders
     set payment_status = p_status,
         payment_mode = case when p_status = 'paid' then p_mode end,
         version_no = version_no + 1
   where id = p_id;

  perform public.record_order_version(p_id, 'payment', case
    when p_status = 'paid' then format('Payment: paid (%s)', p_mode)
    else 'Payment: pending' end);

  select * into v_order from public.orders where id = p_id;
  return v_order;
end;
$$;

revoke all on function
  public.set_order_status(uuid, public.order_status, integer),
  public.set_payment(uuid, public.payment_status, public.payment_mode, integer)
from public, anon;

grant execute on function
  public.set_order_status(uuid, public.order_status, integer),
  public.set_payment(uuid, public.payment_status, public.payment_mode, integer)
to authenticated;
