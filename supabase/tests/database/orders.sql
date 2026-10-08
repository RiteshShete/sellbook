-- Orders: create/update RPCs, snapshots (B8), totals (B3), B9, versions, concurrency, suggestions.
-- Everything is rolled back. Run with `supabase test db`, or paste into the SQL editor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t_ids (k text primary key, id uuid);
insert into t_ids select 'cake', (public.upsert_product('{"name":"Cake","variants":[
  {"name":"500 g","price":"250"},{"name":"1 kg","price":"480.50","cost_price":"300"}]}'::jsonb) ->> 'id')::uuid;
insert into t_ids select 'v500', id from public.variants where name = '500 g';
insert into t_ids select 'v1kg', id from public.variants where name = '1 kg';

-- normalize_phone mirrors lib/phone.ts
select is(public.normalize_phone('+91 98765-43210'), '919876543210', 'phone normalised');
select is(public.normalize_phone('09876543210'), '919876543210', 'leading zero dropped');
select is(public.normalize_phone('  '), null, 'blank phone -> null');
select throws_ok($$select public.normalize_phone('12345')$$, '22023', 'invalid phone number', 'bad phone rejected');

-- create_order snapshots name + price and computes the total (B3)
insert into t_ids select 'o1', (public.create_order(format('{"customer_name":" Asha ","customer_phone":"9876543210",
  "discount":"30.50","items":[{"variant_id":"%s","quantity":2},{"variant_id":"%s","quantity":1}]}',
  (select id from t_ids where k = 'v500'), (select id from t_ids where k = 'v1kg'))::jsonb)).id;

select is((select total from public.orders where id = (select id from t_ids where k = 'o1')), 950.00::numeric,
  'total = 2x250 + 480.50 - 30.50');
select is((select customer_name from public.orders where id = (select id from t_ids where k = 'o1')), 'Asha', 'name trimmed');
select is((select customer_phone from public.orders where id = (select id from t_ids where k = 'o1')), '919876543210', 'phone stored normalised');
select is((select string_agg(product_name || ' ' || variant_name || '@' || unit_price, ', ' order by position)
             from public.order_items where order_id = (select id from t_ids where k = 'o1')),
  'Cake 500 g@250.00, Cake 1 kg@480.50', 'items snapshot product, variant and price in order');
select is((select version_no from public.orders where id = (select id from t_ids where k = 'o1')), 1, 'version 1');
select is((select reason from public.order_versions where order_id = (select id from t_ids where k = 'o1')), 'create',
  'create version recorded');
select is((select jsonb_array_length(snapshot -> 'items') from public.order_versions
            where order_id = (select id from t_ids where k = 'o1')), 2, 'snapshot includes items');

-- B8: catalog price change does not touch the existing order
select lives_ok(format($$select public.upsert_product('{"id":"%s","name":"Cake","variants":[{"id":"%s","name":"500 g","price":"999"}]}'::jsonb)$$,
  (select id from t_ids where k = 'cake'), (select id from t_ids where k = 'v500')), 'catalog price changed');
select is((select unit_price from public.order_items where order_id = (select id from t_ids where k = 'o1') and position = 0),
  250.00::numeric, 'old order keeps its snapshot price (B8)');

-- update_order: kept item keeps its snapshot, a re-picked variant gets the current price
select lives_ok(format($$select public.update_order(%L, '{"customer_name":"Asha","customer_phone":"9876543210","items":[
    {"id":"%s","variant_id":"%s","quantity":3},
    {"variant_id":"%s","quantity":1}]}'::jsonb, 1)$$,
  (select id from t_ids where k = 'o1'),
  (select id from public.order_items where order_id = (select id from t_ids where k = 'o1') and position = 0),
  (select id from t_ids where k = 'v500'), (select id from t_ids where k = 'v500')), 'update order');
select is((select string_agg(unit_price::text || 'x' || quantity, ', ' order by position)
             from public.order_items where order_id = (select id from t_ids where k = 'o1')),
  '250.00x3, 999.00x1', 'kept line keeps 250, new line snapshots 999');
select is((select total from public.orders where id = (select id from t_ids where k = 'o1')), 1749.00::numeric,
  'total recomputed, discount cleared');
select is((select version_no from public.orders where id = (select id from t_ids where k = 'o1')), 2, 'version bumped');
select is((select count(*)::int from public.order_versions where order_id = (select id from t_ids where k = 'o1')), 2,
  'two versions recorded');

-- Optimistic concurrency
select throws_ok(format($$select public.update_order(%L, '{"customer_name":"X","items":[]}'::jsonb, 1)$$,
  (select id from t_ids where k = 'o1')), 'SB409', 'order changed on another device', 'stale version rejected');

-- Validation
select throws_ok(format($$select public.create_order('{"customer_name":"B","discount":"10","items":[]}'::jsonb)$$),
  '22023', 'discount cannot be more than the items total', 'discount > items total rejected (B3)');
select throws_ok($$select public.create_order('{"customer_name":"B","order_date":"2026-10-09","due_date":"2026-10-01","items":[]}'::jsonb)$$,
  '22023', 'due date cannot be before the order date', 'due before order date rejected');
select throws_ok(format($$select public.create_order('{"customer_name":"B","items":[{"variant_id":"%s","quantity":0}]}'::jsonb)$$,
  (select id from t_ids where k = 'v500')), '22023', null, 'zero quantity rejected');
select lives_ok($$select public.create_order('{"customer_name":"Draft","items":[]}'::jsonb)$$, 'draft order with no items allowed');

-- B9: a ready order cannot lose all its items
update public.orders set status = 'ready' where id = (select id from t_ids where k = 'o1');
select throws_ok(format($$select public.update_order(%L, '{"customer_name":"Asha","items":[]}'::jsonb, 2)$$,
  (select id from t_ids where k = 'o1')), '22023', 'a ready or delivered order needs at least one item', 'B9 enforced on edit');

-- suggest_customers: latest per phone, by name or phone digits
select is((select count(*)::int from public.suggest_customers('ash')), 1, 'suggest by name substring');
select is((select customer_phone from public.suggest_customers('54321')), '919876543210', 'suggest by phone digits');

-- Another user sees nothing
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.order_versions), 0, 'other user sees no versions');

select * from finish();
rollback;
