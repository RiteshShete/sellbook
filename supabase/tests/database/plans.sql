-- Plans phase 1: trial/base/pro limits, read-only after expiry, Pro-only features, and that none of it
-- can be bypassed (self-upgrade, direct inserts, trash+restore, backdating). Everything is rolled back.
-- "system" below = no JWT (auth.uid() is null), which is how the admin RPCs / cron will act later.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

-- 1. Sign-up starts a 30-day trial
select is((select tier from public.subscriptions where owner_id = '11111111-1111-1111-1111-111111111111'),
  'trial', 'sign-up starts a trial');
select ok((select ends_at from public.subscriptions where owner_id = '11111111-1111-1111-1111-111111111111')
  between now() + interval '29 days' and now() + interval '31 days', 'the trial lasts 30 days');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
create temp table t_ids (k text primary key, id uuid);

-- 2. A shop reads its plan and cannot change it
select is((select count(*)::int from public.subscriptions), 1, 'a shop sees only its own subscription');
select throws_ok($$update public.subscriptions set tier = 'pro'$$, '42501', null, 'a shop cannot upgrade itself');
select throws_ok($$insert into public.subscriptions (owner_id, tier, ends_at) values (auth.uid(), 'pro', now())$$,
  '42501', null, 'a shop cannot insert a subscription');
select throws_ok($$update public.plan_limits set orders_limit = 99999$$, '42501', null, 'a shop cannot change the limits');
select is(public.my_plan() ->> 'status', 'trial', 'my_plan: status trial');
select is(public.my_plan() -> 'limits' ->> 'orders', '10', 'my_plan: trial allows 10 orders');

-- 3. Trial: 5 products
do $$
begin
  for i in 1..5 loop
    perform public.upsert_product(format('{"name":"P%s","variants":[{"name":"One","price":"10"}]}', i)::jsonb);
  end loop;
end $$;
insert into t_ids select 'p1', id from public.products where name = 'P1';
insert into t_ids select 'v2', v.id from public.variants v join public.products p on p.id = v.product_id where p.name = 'P2';

select throws_ok($$select public.upsert_product('{"name":"P6","variants":[{"name":"One","price":"10"}]}'::jsonb)$$,
  'SB411', 'your plan allows 5 products: upgrade to add more', 'trial: the 6th product is refused');
select throws_ok($$insert into public.products (name) values ('Direct')$$, 'SB411', null,
  'a direct insert cannot bypass the product limit');
select lives_ok(format($$select public.trash_product(%L)$$, (select id from t_ids where k = 'p1')), 'trash a product');
select lives_ok($$select public.upsert_product('{"name":"P6","variants":[{"name":"One","price":"10"}]}'::jsonb)$$,
  'Trash frees a product slot');
select throws_ok(format($$select public.restore_product(%L)$$, (select id from t_ids where k = 'p1')), 'SB411', null,
  'restoring from Trash cannot exceed the product limit');
select is(public.my_plan() -> 'usage' ->> 'products', '5', 'usage counts live products');

-- 4. Trial: 10 orders, ever
do $$
begin
  for i in 1..9 loop
    perform public.create_order(format('{"customer_name":"C%s","items":[]}', i)::jsonb);
  end loop;
end $$;
insert into t_ids select 'o10', (public.create_order(
  '{"customer_name":"C10","client_key":"aaaaaaaa-0000-4000-8000-000000000010","items":[]}'::jsonb)).id;

select throws_ok($$select public.create_order('{"customer_name":"C11","items":[]}'::jsonb)$$,
  'SB411', 'the free trial allows 10 orders: choose a plan to add more', 'trial: the 11th order is refused');
select is((public.create_order(
  '{"customer_name":"C10","client_key":"aaaaaaaa-0000-4000-8000-000000000010","items":[]}'::jsonb)).id,
  (select id from t_ids where k = 'o10'), 'a retried save at the limit still returns its order');
select lives_ok(format($$select public.trash_order(%L)$$, (select id from t_ids where k = 'o10')), 'trash an order');
select throws_ok($$select public.create_order('{"customer_name":"C11","items":[]}'::jsonb)$$, 'SB411', null,
  'trashing an order does not free a trial slot');
select throws_ok($$insert into public.orders (customer_name) values ('Direct')$$, 'SB411', null,
  'a direct insert cannot bypass the order limit');
select lives_ok(format($$select public.restore_order(%L)$$, (select id from t_ids where k = 'o10')),
  'restoring an order is allowed (it was already counted)');

-- 5. Base: 100 orders per IST month, counted by a created_at the shop cannot move
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscriptions set tier = 'base', ends_at = now() + interval '30 days'
 where owner_id = '11111111-1111-1111-1111-111111111111';
update public.orders set created_at = now() - interval '40 days'
 where owner_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(public.my_plan() ->> 'status', 'active', 'base: status active');
select is(public.my_plan() -> 'usage' ->> 'orders', '0', 'base: last month''s orders do not count');
insert into t_ids select 'b1', (public.create_order(format(
  '{"customer_name":"B1","items":[{"variant_id":"%s","quantity":1}]}', (select id from t_ids where k = 'v2'))::jsonb)).id;
update public.orders set created_at = now() - interval '40 days' where id = (select id from t_ids where k = 'b1');
select ok((select created_at from public.orders where id = (select id from t_ids where k = 'b1')) > now() - interval '1 minute',
  'a shop cannot backdate an order out of the month');
insert into public.orders (customer_name, created_at) values ('Back', now() - interval '40 days');
select is(public.my_plan() -> 'usage' ->> 'orders', '2', 'a backdated direct insert still counts this month');

-- 6. Base has no Pro features
select throws_ok($$select * from public.export_orders_csv_rows(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'))$$,
  'SB411', 'this feature needs the Pro plan', 'base: CSV export is Pro');
select throws_ok($$select public.prep_list()$$, 'SB411', null, 'base: prep list is Pro');
select throws_ok(format($$select * from public.list_order_versions(%L)$$, (select id from t_ids where k = 'b1')),
  'SB411', null, 'base: version history is Pro');
select throws_ok(format($$select public.rollback_order(%L, 1, 1)$$, (select id from t_ids where k = 'b1')),
  'SB411', null, 'base: rollback is Pro');
select throws_ok($$select public.apply_product_import('{}'::jsonb)$$, 'SB411', null, 'base: product import is Pro');
select lives_ok($$select public.analytics_month(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'))$$,
  'base: this month''s analytics are allowed');
select throws_ok($$select public.analytics_month(to_char((now() at time zone 'Asia/Kolkata') - interval '1 month', 'YYYY-MM'))$$,
  'SB411', null, 'base: other months are Pro');

update public.orders set status = 'delivered' where id = (select id from t_ids where k = 'b1');
select is((select count(*)::int from public.pending_payments()), 1, 'base: the pending list still works');
select is((select age_days from public.pending_payments()), null, 'base: ageing is hidden');

-- 7. After the end date: read-only for 60 days, then locked
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscriptions set ends_at = now() - interval '1 day' where owner_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(public.my_plan() ->> 'status', 'grace_readonly', 'expired: read-only');
select is(public.my_plan() ->> 'can_write', 'false', 'expired: can_write is false');
select throws_ok($$select public.create_order('{"customer_name":"Late","items":[]}'::jsonb)$$,
  'SB411', 'your plan has ended: the shop is read-only until you renew', 'read-only: no new orders');
select throws_ok($$update public.orders set notes = 'x'$$, 'SB411', null, 'read-only: no order edits');
select throws_ok($$update public.products set is_active = false$$, 'SB411', null, 'read-only: no product edits');
select throws_ok($$update public.variants set price = 1$$, 'SB411', null, 'read-only: no variant edits');
select throws_ok($$delete from public.order_items$$, 'SB411', null, 'read-only: order items are frozen');
select ok((select count(*) from public.orders) > 0, 'read-only: the shop can still read its data');

reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscriptions set ends_at = now() - interval '61 days' where owner_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(public.my_plan() ->> 'status', 'locked', '60 days after the end: locked');
select throws_ok($$select public.create_order('{"customer_name":"Late","items":[]}'::jsonb)$$,
  'SB411', 'your plan has ended: renew to use the shop', 'locked: no new orders');

-- 8. Pro: features on, no product limit, variant abuse guard
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscriptions set tier = 'pro', ends_at = now() + interval '30 days'
 where owner_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(public.my_plan() ->> 'pro_features', 'true', 'pro: features on');
select lives_ok($$select * from public.export_orders_csv_rows(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'))$$,
  'pro: CSV export works');
select ok((select age_days from public.pending_payments()) is not null, 'pro: ageing is shown');
select lives_ok(format($$select public.restore_product(%L)$$, (select id from t_ids where k = 'p1')),
  'pro: no product limit (restore works)');
select throws_ok(format($$select public.upsert_product(%L::jsonb)$$, jsonb_build_object('name', 'Many', 'variants',
  (select jsonb_agg(jsonb_build_object('name', 'V' || g, 'price', '1')) from generate_series(1, 26) g))),
  'SB411', 'a product can have at most 25 variants', 'a product cannot carry more than 25 variants');

-- 9. Another shop is separate; a shop without a subscription row is locked
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.subscriptions), 1, 'the other shop sees only its own subscription');
select is(public.my_plan() -> 'usage' ->> 'orders', '0', 'usage is per shop');

reset role;
select set_config('request.jwt.claims', '{}', true);
delete from public.subscriptions where owner_id = '22222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() ->> 'status', 'locked', 'no subscription row = locked');
select throws_ok($$select public.create_order('{"customer_name":"X","items":[]}'::jsonb)$$, 'SB411', null,
  'no subscription row: writes are refused');

select * from finish();
rollback;
