-- Variant sizes: validation, snapshot on order lines (B8), rollback, fallback for unsnapshotted
-- lines, and grams / ml / pieces totals in prep_list and analytics_month. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid);
select public.init_settings();
insert into t (k, id) select 'cake', (public.upsert_product('{"name":"Cake","variants":[
  {"name":"250 g","price":"150","size_amount":"250","size_unit":"g"},
  {"name":"1 kg","price":"480","size_amount":"1000","size_unit":"g"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'milk', (public.upsert_product('{"name":"Milk","variants":[
  {"name":"500 ml","price":"30","size_amount":"500","size_unit":"ml"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'box', (public.upsert_product('{"name":"Cookies","variants":[
  {"name":"Box of 6","price":"120","size_amount":"6","size_unit":"pcs"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'bread', (public.upsert_product('{"name":"Bread","variants":[
  {"name":"Loaf","price":"40"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'v250', id from public.variants where name = '250 g';
insert into t (k, id) select 'v1kg', id from public.variants where name = '1 kg';
insert into t (k, id) select 'ml', id from public.variants where name = '500 ml';
insert into t (k, id) select 'boxv', id from public.variants where name = 'Box of 6';
insert into t (k, id) select 'loaf', id from public.variants where name = 'Loaf';
create function pg_temp.id(p_key text) returns uuid language sql as $$ select id from t where k = p_key $$;

-- Catalog
select is((select size_amount || ' ' || size_unit from public.variants where id = pg_temp.id('v1kg')),
  '1000.000 g', 'variant stores size in base units');
select is((select size_unit from public.variants where id = pg_temp.id('loaf')), null, 'size is optional');
select throws_ok($$select public.upsert_product('{"name":"X","variants":[{"name":"a","price":"1","size_unit":"g"}]}'::jsonb)$$,
  '22023', 'a size needs both an amount and a unit', 'unit without amount refused');
select throws_ok($$select public.upsert_product('{"name":"X","variants":[{"name":"a","price":"1","size_amount":"1","size_unit":"kg"}]}'::jsonb)$$,
  '22023', 'size unit must be g, ml or pcs', 'unknown unit refused');
select throws_ok($$select public.upsert_product('{"name":"X","variants":[{"name":"a","price":"1","size_amount":"0","size_unit":"g"}]}'::jsonb)$$,
  '22023', 'size must be more than 0', 'zero size refused');
select public.upsert_product(format('{"id":"%s","name":"Bread","variants":[{"id":"%s","name":"Loaf","price":"45"}]}',
  pg_temp.id('bread'), pg_temp.id('loaf'))::jsonb);
select public.upsert_product(format('{"id":"%s","name":"Cake","variants":[{"id":"%s","name":"250 g","price":"150"},{"id":"%s","name":"1 kg","price":"480"}]}',
  pg_temp.id('cake'), pg_temp.id('v250'), pg_temp.id('v1kg'))::jsonb);
select is((select size_amount from public.variants where id = pg_temp.id('v1kg')), 1000.000,
  'an update without size keys keeps the size');

-- Order A: 2 x 1 kg, 3 x 250 g, 2 x 500 ml, 1 x Box of 6, 4 x Loaf (no size)
insert into t (k, id) select 'A', (public.create_order(format('{"customer_name":"Asha","items":[
  {"variant_id":"%s","quantity":2},{"variant_id":"%s","quantity":3},{"variant_id":"%s","quantity":2},
  {"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":4}]}',
  pg_temp.id('v1kg'), pg_temp.id('v250'), pg_temp.id('ml'), pg_temp.id('boxv'), pg_temp.id('loaf'))::jsonb)).id;
select is((select size_amount || ' ' || size_unit from public.order_items where order_id = pg_temp.id('A') and position = 0),
  '1000.000 g', 'order line snapshots the size');

-- Prep list totals
create function pg_temp.prep(p_path text[]) returns text language sql as $$ select public.prep_list() #>> p_path $$;
-- One product's field from the prep list, by name.
create function pg_temp.pp(p_name text, p_field text) returns text language sql as
  $$ select p ->> p_field from jsonb_array_elements(public.prep_list() -> 'products') p where p ->> 'name' = p_name $$;
select is(pg_temp.prep('{products,0,name}'), 'Bread', 'same catalog position: sorted by name');
select is(pg_temp.pp('Cake', 'grams')::numeric, 2750.000, 'Cake: 2 x 1000 g + 3 x 250 g = 2750 g');
select is(pg_temp.pp('Cake', 'unsized')::int, 0, 'Cake: nothing unsized');
select is((select v ->> 'grams' from jsonb_array_elements(public.prep_list() -> 'products') p, jsonb_array_elements(p -> 'variants') v
  where v ->> 'name' = '1 kg')::numeric, 2000.000, '1 kg line: 2000 g');
select is(pg_temp.pp('Milk', 'ml')::numeric, 1000.000, 'Milk: 2 x 500 ml');
select is(pg_temp.pp('Cookies', 'pieces')::numeric, 6.000, 'Cookies: 1 box of 6 = 6 pcs');
select is(pg_temp.pp('Bread', 'unsized')::int, 4, 'Bread has no size: 4 unsized');
select is(pg_temp.pp('Bread', 'grams')::numeric, 0::numeric, 'Bread: 0 g');

-- B8: changing the catalog size does not change the order (snapshot wins).
select public.upsert_product(format('{"id":"%s","name":"Cake","variants":[{"id":"%s","name":"250 g","price":"150","size_amount":"300","size_unit":"g"},{"id":"%s","name":"1 kg","price":"480","size_amount":"1000","size_unit":"g"}]}',
  pg_temp.id('cake'), pg_temp.id('v250'), pg_temp.id('v1kg'))::jsonb);
select is(pg_temp.pp('Cake', 'grams')::numeric, 2750.000, 'catalog size change leaves the order total alone');

-- Editing: kept line keeps its old size; a newly added line takes the current one.
select public.update_order(pg_temp.id('A'), format('{"customer_name":"Asha","items":[
  {"id":"%s","variant_id":"%s","quantity":3},{"variant_id":"%s","quantity":1}]}',
  (select id from public.order_items where order_id = pg_temp.id('A') and position = 1), pg_temp.id('v250'),
  pg_temp.id('v250'))::jsonb, 1);
select is((select string_agg(size_amount::int::text, ',' order by position) from public.order_items where order_id = pg_temp.id('A')),
  '250,300', 'kept line keeps 250 g; new line snapshots 300 g');

-- Rollback to version 1 restores the original lines with their sizes.
select public.rollback_order(pg_temp.id('A'), 1, 2);
select is((select count(*)::int from public.order_items where order_id = pg_temp.id('A') and size_unit is not null), 4,
  'rollback restores sized lines');
select is((select size_amount from public.order_items where order_id = pg_temp.id('A') and position = 1), 250.000,
  'rollback restores the 250 g snapshot, not the catalog 300 g');

-- Lines saved before sizes existed (no snapshot) fall back to the variant's current size.
update public.order_items set size_amount = null, size_unit = null
 where order_id = pg_temp.id('A') and variant_id = pg_temp.id('loaf');
select public.upsert_product(format('{"id":"%s","name":"Bread","variants":[{"id":"%s","name":"Loaf","price":"45","size_amount":"400","size_unit":"g"}]}',
  pg_temp.id('bread'), pg_temp.id('loaf'))::jsonb);
select is(pg_temp.pp('Bread', 'grams')::numeric, 1600.000, 'unsnapshotted Loaf uses the catalog 400 g: 4 x 400');
select is(pg_temp.pp('Bread', 'unsized')::int, 0, 'and is no longer unsized');

-- Analytics: delivered quantity x size per product.
select public.set_order_status(pg_temp.id('A'), 'ready', (select version_no from public.orders where id = pg_temp.id('A')));
select public.set_order_status(pg_temp.id('A'), 'delivered', (select version_no from public.orders where id = pg_temp.id('A')));
create temp table r as select public.analytics_month(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM')) as j;
select is((select (p ->> 'grams')::numeric from r, jsonb_array_elements(j -> 'by_product') p where p ->> 'name' = 'Cake'),
  2750.000, 'analytics: Cake 2750 g delivered');
select is((select (p ->> 'ml')::numeric from r, jsonb_array_elements(j -> 'by_product') p where p ->> 'name' = 'Milk'),
  1000.000, 'analytics: Milk 1000 ml');
select is((select (p ->> 'pieces')::numeric from r, jsonb_array_elements(j -> 'by_variant') p where p ->> 'variant_name' = 'Box of 6'),
  6.000, 'analytics: Box of 6 = 6 pcs per variant');
select is(pg_temp.prep('{orders}')::int, 0, 'delivered order left the prep list');

select * from finish();
rollback;
