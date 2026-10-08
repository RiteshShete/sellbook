-- Catalog + settings functions, and the no-hard-delete rule. Everything is rolled back.
-- Run with `supabase test db`, or paste into the SQL editor (see rls_check.sql header).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

-- Act as the owner -------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- init_settings is idempotent
select is((select (public.init_settings()).bill_prefix), 'INV', 'init_settings creates a row with defaults');
select lives_ok('select public.init_settings()', 'init_settings can be called again');
select is((select count(*)::int from public.settings), 1, 'still exactly one settings row');

-- upsert_product: create with two variants
create temp table t_ids (k text primary key, id uuid);
insert into t_ids
  select 'cake', (public.upsert_product('{"name":"  Cake ","variants":[
    {"name":"500 g","price":"250.00"},
    {"name":"1 kg","price":"480.50","cost_price":"300"}]}'::jsonb) ->> 'id')::uuid;

select is((select name from public.products where id = (select id from t_ids where k = 'cake')), 'Cake',
  'product name is trimmed');
select is((select count(*)::int from public.variants where product_id = (select id from t_ids where k = 'cake')), 2,
  'two variants created');
select is((select price from public.variants where name = '1 kg'), 480.50::numeric, 'variant price stored exactly');
select is((select sort_order from public.variants where name = '1 kg'), 1, 'variant sort_order = list position');
select is((select cost_price from public.variants where name = '500 g'), null::numeric, 'cost_price optional');

insert into t_ids select 'v500', id from public.variants where name = '500 g';
insert into t_ids select 'v1kg', id from public.variants where name = '1 kg';

-- upsert_product: update one variant, omit the other (left unchanged), add a third
select lives_ok(format($$select public.upsert_product('{"id":"%s","name":"Cake","is_active":false,"variants":[
    {"id":"%s","name":"500 g","price":"260"},
    {"name":"2 kg","price":"900"}]}'::jsonb)$$,
  (select id from t_ids where k = 'cake'), (select id from t_ids where k = 'v500')), 'update product');
select is((select price from public.variants where id = (select id from t_ids where k = 'v500')), 260.00::numeric,
  'listed variant updated');
select is((select price from public.variants where id = (select id from t_ids where k = 'v1kg')), 480.50::numeric,
  'omitted variant unchanged');
select is((select is_active from public.products where id = (select id from t_ids where k = 'cake')), false,
  'product deactivated');

select throws_ok($$select public.upsert_product('{"name":"cake","variants":[]}'::jsonb)$$, '23505', null,
  'duplicate product name (case-insensitive) rejected');

-- trash_variant then trash_product: restoring the product brings back only variants trashed with it
select lives_ok(format('select public.trash_variant(%L)', (select id from t_ids where k = 'v1kg')), 'trash one variant');
select lives_ok(format('select public.trash_product(%L)', (select id from t_ids where k = 'cake')), 'trash product');
select is((select count(*)::int from public.variants where product_id = (select id from t_ids where k = 'cake') and deleted_at is null), 0,
  'trashing product trashes its variants');
select throws_ok(format('select public.restore_variant(%L)', (select id from t_ids where k = 'v500')), 'P0001', 'restore the product first',
  'cannot restore a variant while its product is trashed');
select lives_ok(format('select public.restore_product(%L)', (select id from t_ids where k = 'cake')), 'restore product');
select is((select count(*)::int from public.variants where product_id = (select id from t_ids where k = 'cake') and deleted_at is null), 2,
  'restore brings back the two variants trashed with the product');
select is((select deleted_at is not null from public.variants where id = (select id from t_ids where k = 'v1kg')), true,
  'individually trashed variant stays in trash');

-- No hard deletes
select throws_ok('delete from public.products', '42501', null, 'owner cannot hard-delete products');
select throws_ok('delete from public.settings', '42501', null, 'owner cannot hard-delete settings');

-- Another user cannot touch the owner's product ----------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(format('select public.trash_product(%L)', (select id from t_ids where k = 'cake')), 'P0002', null,
  'other user cannot trash the owner''s product');

-- anon cannot call catalog functions
reset role;
set local role anon;
select throws_ok($$select public.upsert_product('{"name":"X"}'::jsonb)$$, '42501', null, 'anon cannot call upsert_product');

select * from finish();
rollback;
