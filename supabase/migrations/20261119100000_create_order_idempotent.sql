-- create_order becomes idempotent: the app sends one client_key (uuid) per "New order" screen.
-- If the reply to a save is lost (bad network) and the owner taps Save again, the same key returns the
-- order that already exists instead of creating a duplicate. The key is optional (old clients keep working).

alter table public.orders add column client_key uuid;

-- One order per (owner, key). Partial: orders without a key are unaffected.
create unique index orders_owner_client_key_uq
  on public.orders (owner_id, client_key) where client_key is not null;

create or replace function public.create_order(p jsonb)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'customer_name', ''));
  v_key uuid := nullif(p ->> 'client_key', '')::uuid;
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'customer name must be 1 to 100 characters' using errcode = '22023';
  end if;

  -- Retry of a save that already went through: hand back the existing order (RLS limits this to the owner's).
  if v_key is not null then
    select * into v_order from public.orders where client_key = v_key;
    if found then
      return v_order;
    end if;
  end if;

  insert into public.orders (customer_name, customer_phone, order_date, due_date, notes, discount, client_key)
  values (
    v_name,
    public.normalize_phone(p ->> 'customer_phone'),
    coalesce(nullif(p ->> 'order_date', '')::date, (now() at time zone 'Asia/Kolkata')::date),
    nullif(p ->> 'due_date', '')::date,
    nullif(btrim(coalesce(p ->> 'notes', '')), ''),
    coalesce(nullif(p ->> 'discount', '')::numeric, 0),
    v_key
  )
  returning * into v_order;

  perform public.replace_order_items(v_order.id, p -> 'items');
  perform public.check_order_rules(v_order.id);
  perform public.record_order_version(v_order.id, 'create', 'Order created');

  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end;
$$;
