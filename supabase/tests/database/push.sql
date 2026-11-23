-- Web push: subscriptions are reachable only through the two functions, only by shop owners; the trigger never breaks an order.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a@example.test', now()),
  ('b0000000-0000-4000-8000-000000000002', 'b@example.test', now()),
  ('c1000000-0000-4000-8000-000000000003', 'c1@example.test', now());
insert into public.shop_invites (code, created_by, expires_at)
  select 'PUSHAAAAAA', 'a0000000-0000-4000-8000-000000000001', now() + interval '1 day';
insert into public.shop_invites (code, created_by, expires_at)
  select 'PUSHBBBBBB', 'a0000000-0000-4000-8000-000000000001', now() + interval '1 day';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_shop('PUSHAAAAAA', 'push-a', 'Push A');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.create_shop('PUSHBBBBBB', 'push-b', 'Push B');

-- owner A saves a device
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.save_push_subscription('https://push.example.test/abc', repeat('p', 40), repeat('a', 16))$$, 'owner can save a device');
select throws_ok('select count(*) from public.push_subscriptions', '42501', null, 'owner cannot read the table directly');
select throws_ok($$select public.save_push_subscription('http://insecure.test/x', repeat('p', 40), repeat('a', 16))$$, '23514', null, 'a non-https address is refused');

-- owner B cannot delete A's device; the same browser address moves to B when B signs in on it
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.delete_push_subscription('https://push.example.test/abc');
reset role;
select is((select count(*)::int from public.push_subscriptions where owner_id = 'a0000000-0000-4000-8000-000000000001'), 1, 'another shop cannot delete it');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.save_push_subscription('https://push.example.test/abc', repeat('q', 40), repeat('b', 16));
reset role;
select is((select owner_id::text from public.push_subscriptions where endpoint = 'https://push.example.test/abc'), 'b0000000-0000-4000-8000-000000000002', 'one address, one owner (latest wins)');

-- at most 10 devices per shop
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.save_push_subscription('https://push.example.test/d' || g, repeat('p', 40), repeat('a', 16)) from generate_series(1, 12) g;
reset role;
select is((select count(*)::int from public.push_subscriptions where owner_id = 'a0000000-0000-4000-8000-000000000001'), 10, 'ten devices at most');

-- a customer-only account and a visitor are refused
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.save_push_subscription('https://push.example.test/c', repeat('p', 40), repeat('a', 16))$$, '42501', null, 'a customer cannot save a device');
set local role anon;
select throws_ok($$select public.save_push_subscription('https://push.example.test/z', repeat('p', 40), repeat('a', 16))$$, '42501', null, 'a visitor cannot save a device');
reset role;

-- the trigger: with no Vault secrets it does nothing and never fails an order or a claim
select lives_ok($$insert into public.orders (owner_id, customer_name, source, customer_user_id, fulfilment, payment_method) values ('a0000000-0000-4000-8000-000000000001', 'PushAsha', 'customer', 'c1000000-0000-4000-8000-000000000003', 'pickup', 'upi')$$, 'an order is saved without push secrets');
select lives_ok($$update public.orders set payment_claim_status = 'claimed' where customer_name = 'PushAsha'$$, 'a payment claim is saved without push secrets');
select is((select count(*)::int from pg_trigger where tgname = 'orders_push_to_owner' and not tgisinternal), 1, 'the push trigger exists');

select * from finish();
rollback;
