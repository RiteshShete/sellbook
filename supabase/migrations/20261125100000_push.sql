-- Web push for shop owners: a phone alert when a customer places an order or says they paid, even when the app is closed.
--
-- push_subscriptions: one row per owner device (the browser's push address + keys). Nobody reads or writes it directly:
-- the owner's device saves/removes its own row through two functions; only the trigger below reads it.
-- Trigger -> pg_net POST to the Edge Function "push-owner" (Vault secrets push_url + push_secret, like notify-admin).
-- No secrets in Vault = no call. Any problem is only a warning: it can never fail an order or a payment claim.
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/push-owner', 'push_url');
--   select vault.create_secret('<long random text, same as the function secret PUSH_SECRET>', 'push_secret');

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 20 and 200),
  auth text not null check (length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated; -- no policies, no grants: definer functions only

-- Save this device. A browser address belongs to one user at a time (a shared phone: the latest sign-in wins).
-- At most 10 devices per shop: the oldest ones are dropped.
create function app_private.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := app_private.require_shop();
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth) values (v_owner, p_endpoint, p_p256dh, p_auth);
  delete from public.push_subscriptions
   where owner_id = v_owner
     and id not in (select id from public.push_subscriptions where owner_id = v_owner order by created_at desc limit 10);
end;
$$;

create function app_private.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and owner_id = app_private.require_shop();
end;
$$;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security invoker set search_path = ''
as $$ select app_private.save_push_subscription(p_endpoint, p_p256dh, p_auth); $$;

create function public.delete_push_subscription(p_endpoint text)
returns void language sql security invoker set search_path = ''
as $$ select app_private.delete_push_subscription(p_endpoint); $$;

revoke all on function app_private.save_push_subscription(text, text, text), app_private.delete_push_subscription(text),
  public.save_push_subscription(text, text, text), public.delete_push_subscription(text) from public, anon;
grant execute on function app_private.save_push_subscription(text, text, text), app_private.delete_push_subscription(text),
  public.save_push_subscription(text, text, text), public.delete_push_subscription(text) to authenticated;

-- The alert. Same two moments as the in-app alert (src/features/orders/orderAlerts.ts).
create function app_private.push_to_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_title text;
  v_body text;
  v_subs jsonb;
begin
  begin
    if tg_op = 'INSERT' and new.source = 'customer' then
      v_title := 'New order';
      v_body := 'Order #' || new.order_no || ' from ' || new.customer_name;
    elsif tg_op = 'UPDATE' and new.payment_claim_status = 'claimed' and old.payment_claim_status is distinct from 'claimed' then
      v_title := 'Payment claimed';
      v_body := 'Order #' || new.order_no || ': check your bank app';
    else
      return new;
    end if;

    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
    if v_url is null or v_secret is null then
      return new;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
      into v_subs from public.push_subscriptions where owner_id = new.owner_id;
    if jsonb_array_length(v_subs) = 0 then
      return new;
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      body := jsonb_build_object('title', v_title, 'body', v_body, 'path', 'orders/' || new.id, 'tag', 'order-' || new.id, 'subs', v_subs),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'push_to_owner: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function app_private.push_to_owner() from public, anon, authenticated;

create trigger orders_push_to_owner
  after insert or update of payment_claim_status on public.orders
  for each row execute function app_private.push_to_owner();
