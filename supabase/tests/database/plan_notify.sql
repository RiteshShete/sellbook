-- Plans phase 4: a payment claim queues one HTTP call to the notify-admin function, only when the Vault
-- holds its URL and secret, and never blocks the claim. Rolled back, so nothing is ever sent.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'shop@example.test');
-- This database may already hold the real secrets: the test starts without them.
delete from vault.secrets where name in ('notify_admin_url', 'notify_admin_secret');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.request_subscription('base')$$, 'a claim works when notifications are not set up');
select lives_ok($$select public.cancel_subscription_request()$$, 'and can be cancelled');

reset role;
select is((select count(*)::int from net.http_request_queue where url like '%notify-admin-test%'), 0,
  'nothing is queued without the Vault secrets');
select vault.create_secret('http://example.invalid/notify-admin-test', 'notify_admin_url') is not null;
select vault.create_secret('s3cret-test', 'notify_admin_secret') is not null;

set local role authenticated;
select lives_ok($$select public.request_subscription('pro', 'UTR12345678')$$, 'a claim works with notifications on');

reset role;
select is((select count(*)::int from net.http_request_queue where url = 'http://example.invalid/notify-admin-test'), 1,
  'exactly one call is queued for the claim');
select is((select headers ->> 'x-notify-secret' from net.http_request_queue where url = 'http://example.invalid/notify-admin-test'),
  's3cret-test', 'it carries the shared secret');
select is((select convert_from(body, 'UTF8')::jsonb - 'id' - 'ref_code' from net.http_request_queue where url = 'http://example.invalid/notify-admin-test'),
  '{"tier":"pro","amount_paise":25000,"utr":"UTR12345678","email":"shop@example.test","shop_name":""}'::jsonb,
  'and the claim details the email needs');

select * from finish();
rollback;
