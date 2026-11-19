-- create_order idempotency: the same client_key never creates a second order (lost-reply retry).
-- Everything is rolled back. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t_ids (k text primary key, id uuid);
insert into t_ids select 'a', (public.create_order('{"customer_name":"Asha","client_key":"aaaaaaaa-0000-4000-8000-000000000001","items":[]}'::jsonb)).id;
insert into t_ids select 'again', (public.create_order('{"customer_name":"Asha","client_key":"aaaaaaaa-0000-4000-8000-000000000001","items":[]}'::jsonb)).id;

select is((select id from t_ids where k = 'again'), (select id from t_ids where k = 'a'), 'same key returns the same order');
select is((select count(*)::int from public.orders where customer_name = 'Asha'), 1, 'no duplicate order created');
select is((select count(*)::int from public.order_versions where order_id = (select id from t_ids where k = 'a')), 1, 'no duplicate version');

-- a different key is a different order; no key is never deduplicated
select public.create_order('{"customer_name":"Asha","client_key":"aaaaaaaa-0000-4000-8000-000000000002","items":[]}'::jsonb);
select public.create_order('{"customer_name":"Asha","items":[]}'::jsonb);
select public.create_order('{"customer_name":"Asha","items":[]}'::jsonb);
select is((select count(*)::int from public.orders where customer_name = 'Asha'), 4, 'new key and keyless calls still create orders');

-- another owner can reuse the same key value without colliding or seeing the first order
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.create_order('{"customer_name":"Other","client_key":"aaaaaaaa-0000-4000-8000-000000000001","items":[]}'::jsonb)$$,
  'same key from another owner creates their own order');
select is((select count(*)::int from public.orders), 1, 'other owner sees only their own order');

select * from finish();
rollback;
