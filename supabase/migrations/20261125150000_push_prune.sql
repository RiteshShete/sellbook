-- Phone addresses that stopped working: a device that is still used re-saves its address every time the app opens (the row's
-- created_at is then "last seen"); anything not seen for 90 days is removed weekly. App users cannot call this.
create function app_private.prune_push_subscriptions(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.push_subscriptions where created_at < now() - make_interval(days => p_days);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function app_private.prune_push_subscriptions(integer) from public, anon, authenticated;

-- Sunday 03:15 IST (21:45 UTC). Skipped with a notice where pg_cron is not available, so the migration never fails on it.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('sellbook-prune-push', '45 21 * * 0', 'select app_private.prune_push_subscriptions();');
  else
    raise notice 'pg_cron is not available: run app_private.prune_push_subscriptions() yourself now and then';
  end if;
exception when others then
  raise notice 'pg_cron could not schedule the push cleanup: %', sqlerrm;
end;
$$;
