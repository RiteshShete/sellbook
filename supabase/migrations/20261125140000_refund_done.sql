-- "Refunded": after a customer order is declined (or cancelled) with money paid or claimed, the shop refunds by hand and
-- marks it done. The reminder (Needs action) goes away; nothing is paid back by the app, it only remembers.
alter table public.orders add column refund_done_at timestamptz null;

alter table public.order_versions drop constraint order_versions_reason_check;
alter table public.order_versions add constraint order_versions_reason_check check (
  reason in ('create', 'edit', 'status', 'payment', 'delete', 'restore', 'rollback',
             'confirm', 'decline', 'claim', 'verify', 'reject', 'customer_cancel', 'refund'));
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (
  action in ('create', 'update', 'delete', 'restore', 'status', 'payment', 'rollback', 'bill',
             'confirm', 'decline', 'claim', 'verify', 'reject', 'customer_cancel', 'refund'));

create function app_private.mark_refunded(p_id uuid, v integer)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.owner_lock_order(p_id, v);
  r public.orders;
begin
  if o.source <> 'customer' or o.status <> 'cancelled' or o.refund_done_at is not null
     or not (o.payment_status = 'paid' or o.payment_claim_status = 'claimed') then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  update public.orders set refund_done_at = now(), version_no = version_no + 1 where id = o.id returning * into r;
  perform public.record_order_version(o.id, 'refund', 'Refund marked as done');
  return r;
end;
$$;

create function public.mark_refunded(p_id uuid, v integer) returns public.orders language sql security invoker
  set search_path = '' as $$ select * from app_private.mark_refunded(p_id, v); $$;

revoke all on function app_private.mark_refunded(uuid, integer), public.mark_refunded(uuid, integer) from public, anon;
grant execute on function app_private.mark_refunded(uuid, integer), public.mark_refunded(uuid, integer) to authenticated;
