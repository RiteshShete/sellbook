-- Product import: RLS on import_batches, apply_product_import (atomic, modes, SB410), and
-- undo_product_import (soft delete + restore of previous values). Everything is rolled back.
-- Run with `supabase test db` or scripts/test-db-linked.sh (needs 20261110100000_product_import applied).
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

set local role anon;
select throws_ok('select 1 from public.import_batches', '42501', null, 'anon cannot read import batches');
select throws_ok($$select public.apply_product_import('{}'::jsonb)$$, '42501', null, 'anon cannot apply an import');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t_ids (k text primary key, id uuid);
grant all on t_ids to authenticated;
-- An existing product the import will touch.
insert into t_ids select 'poha', (public.upsert_product(
  '{"name":"Poha","variants":[{"name":"500 g","price":"50","size_amount":"500","size_unit":"g"}]}'::jsonb) ->> 'id')::uuid;

-- add mode: new category, new product with 2 variants, one new variant on the existing product
create temp table t_batch (id uuid);
grant all on t_batch to authenticated;
insert into t_batch select (public.apply_product_import(format($j$
{"file_name":"menu.csv","mode":"add","categories":["Tea"],
 "products":[{"name":"Chai Masala","category":"Tea","variants":[
   {"name":"Retail","price":"80.00","cost_price":"55.00","size_amount":"100","size_unit":"g","is_active":true},
   {"name":"Wholesale","price":"700.00","size_amount":"1000","size_unit":"g"}]}],
 "add_variants":[{"product_id":"%s","variants":[{"name":"1 kg","price":"95.00","size_amount":"1000","size_unit":"g"}]}]}
$j$, (select id from t_ids where k = 'poha'))::jsonb) ->> 'batch_id')::uuid;

select is((select count(*)::int from public.products where deleted_at is null), 2, 'one product created');
select is((select count(*)::int from public.variants where deleted_at is null), 4, 'three variants created');
select is((select name from public.categories where deleted_at is null), 'Tea', 'category created');
select is((select c.name from public.products p join public.categories c on c.id = p.category_id where p.name = 'Chai Masala'),
  'Tea', 'new product is in the new category');
select is((select counts ->> 'variants' from public.import_batches where id = (select id from t_batch)), '3',
  'batch records its counts');

-- add mode never touches an existing price
select is((select price from public.variants where product_id = (select id from t_ids where k = 'poha') and name = '500 g'),
  50.00::numeric, 'existing price untouched in add mode');

-- a concurrent change: the plan thinks Chai Masala is new, but it exists now
select throws_ok($$select public.apply_product_import('{"mode":"add","products":[{"name":"chai masala","variants":[{"name":"X","price":"1"}]}]}'::jsonb)$$,
  'SB410', null, 'a product that now exists raises SB410');
select throws_ok($$select public.apply_product_import('{"mode":"add","updates":[{"variant_id":"00000000-0000-0000-0000-000000000000","price":"1"}]}'::jsonb)$$,
  '22023', null, 'updates are refused in add mode');
-- all or nothing: the bad second variant rolls back the first product too
select throws_ok($$select public.apply_product_import('{"mode":"add","products":[{"name":"Half","variants":[{"name":"A","price":"1"},{"name":"B","price":"-5"}]}]}'::jsonb)$$,
  '22023', null, 'a bad variant fails the whole import');
select is((select count(*)::int from public.products where name = 'Half'), 0, 'nothing from the failed import was saved');

-- update mode: price change is recorded, then undone
insert into t_ids select 'upd', (public.apply_product_import(format(
  '{"mode":"update","updates":[{"variant_id":"%s","price":"60.00","is_active":false}]}',
  (select id from public.variants where product_id = (select id from t_ids where k = 'poha') and name = '500 g'))::jsonb) ->> 'batch_id')::uuid;
select is((select price from public.variants where product_id = (select id from t_ids where k = 'poha') and name = '500 g'),
  60.00::numeric, 'update mode changes the price');

select lives_ok(format('select public.undo_product_import(%L)', (select id from t_ids where k = 'upd')), 'undo the update batch');
select is((select price from public.variants where product_id = (select id from t_ids where k = 'poha') and name = '500 g'),
  50.00::numeric, 'undo puts the previous price back');
select is((select is_active from public.variants where product_id = (select id from t_ids where k = 'poha') and name = '500 g'),
  true, 'undo puts active back');

-- undo of the create batch: soft delete (Trash), nothing hard deleted
select lives_ok(format('select public.undo_product_import(%L)', (select id from t_batch)), 'undo the create batch');
select is((select count(*)::int from public.products where deleted_at is null), 1, 'created product is in Trash');
select is((select count(*)::int from public.products where name = 'Chai Masala' and deleted_at is not null), 1,
  'created product still exists (soft delete), restorable');
select throws_ok(format('select public.undo_product_import(%L)', (select id from t_batch)), 'P0002', null,
  'a batch cannot be undone twice');

-- another owner sees nothing
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.import_batches), 0, 'another owner cannot see import batches');

select * from finish();
rollback;
