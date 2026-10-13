-- Categories: RLS, RPCs, soft delete + restore, product assignment. Everything is rolled back.
-- Run with `supabase test db` (needs the 20261015110000_categories migration applied).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

-- anon: no access at all
set local role anon;
select throws_ok('select 1 from public.categories', '42501', null, 'anon cannot read categories');
select throws_ok($$insert into public.categories (owner_id, name) values ('11111111-1111-1111-1111-111111111111', 'X')$$,
  '42501', null, 'anon cannot insert categories');
reset role;

-- owner: create, rename, order
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t_ids (k text primary key, id uuid);
grant all on t_ids to authenticated;
insert into t_ids select 'flour', (public.upsert_category('{"name":"  Flours "}'::jsonb) ->> 'id')::uuid;
insert into t_ids select 'mix', (public.upsert_category('{"name":"Mixes"}'::jsonb) ->> 'id')::uuid;

select is((select name from public.categories where id = (select id from t_ids where k = 'flour')), 'Flours',
  'name is trimmed');
select is((select sort_order from public.categories where id = (select id from t_ids where k = 'mix')), 1,
  'new category goes last');
select throws_ok($$select public.upsert_category('{"name":"flours"}'::jsonb)$$, '23505', null,
  'duplicate name (any case) is rejected');
select lives_ok(format($$select public.upsert_category('{"id":"%s","name":"Pithe"}'::jsonb)$$,
  (select id from t_ids where k = 'flour')), 'rename');

select lives_ok(format('select public.reorder_categories(array[%L, %L]::uuid[])',
  (select id from t_ids where k = 'mix'), (select id from t_ids where k = 'flour')), 'reorder');
select is((select name from public.categories order by sort_order limit 1), 'Mixes', 'reorder applied');

-- product assignment through upsert_product
insert into t_ids select 'p', (public.upsert_product(format(
  '{"name":"Modak Pith","category_id":"%s","variants":[{"name":"500 g","price":"60"}]}',
  (select id from t_ids where k = 'flour'))::jsonb) ->> 'id')::uuid;
select is((select category_id from public.products where id = (select id from t_ids where k = 'p')),
  (select id from t_ids where k = 'flour'), 'product saved with its category');

select lives_ok(format($$select public.upsert_product('{"id":"%s","name":"Modak Pith","variants":[]}'::jsonb)$$,
  (select id from t_ids where k = 'p')), 'saving without category_id ...');
select is((select category_id from public.products where id = (select id from t_ids where k = 'p')),
  (select id from t_ids where k = 'flour'), '... leaves the category unchanged');

select lives_ok(format($$select public.upsert_product('{"id":"%s","name":"Modak Pith","category_id":null,"variants":[]}'::jsonb)$$,
  (select id from t_ids where k = 'p')), 'explicit null ...');
select is((select category_id from public.products where id = (select id from t_ids where k = 'p')), null::uuid,
  '... clears the category');

select throws_ok($$select public.upsert_product('{"name":"Ghost","category_id":"99999999-9999-9999-9999-999999999999","variants":[]}'::jsonb)$$,
  'P0002', null, 'unknown category is rejected');

-- trash + restore
select lives_ok(format('select public.trash_category(%L)', (select id from t_ids where k = 'mix')), 'trash category');
select is((select count(*)::int from public.categories where deleted_at is null), 1, 'only one live category left');
select lives_ok(format('select public.restore_category(%L)', (select id from t_ids where k = 'mix')), 'restore category');

-- another user sees none
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.categories), 0, 'other user sees no categories');

select * from finish();
rollback;
