-- Plans, phase 4: tell the platform admin by email when a shop files a payment claim.
--
-- AFTER INSERT on subscription_requests -> pg_net POST to the Edge Function "notify-admin".
-- The function URL and the shared secret live in Supabase Vault (never in the repo). Create them once
-- per project in the SQL editor:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify-admin', 'notify_admin_url');
--   select vault.create_secret('<long random text, same as the function secret NOTIFY_SECRET>', 'notify_admin_secret');
-- Until both exist the trigger does nothing. It can never fail a claim: any problem is only a warning,
-- and the claim is still listed on the Admin page.

-- pg_net sends the request in the background after the claim is committed. Same guard as pg_cron.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  else
    raise notice 'pg_net is not available: admin emails are off (claims still show on the Admin page)';
  end if;
end;
$$;

create function app_private.notify_admin_of_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_admin_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_admin_secret';
    if v_url is null or v_secret is null then
      return new;
    end if;
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
      body := jsonb_build_object(
        'id', new.id,
        'tier', new.tier,
        'amount_paise', new.amount_paise,
        'ref_code', new.ref_code,
        'utr', new.utr,
        'email', (select u.email from auth.users u where u.id = new.owner_id),
        'shop_name', coalesce((select s.shop_name from public.settings s where s.owner_id = new.owner_id), '')
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notify_admin_of_request: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function app_private.notify_admin_of_request() from public, anon, authenticated;

create trigger subscription_requests_notify_admin
  after insert on public.subscription_requests
  for each row execute function app_private.notify_admin_of_request();
