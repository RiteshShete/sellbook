-- RLS / privilege check. Run with `supabase test db` (pgTAP). Everything is rolled back.
-- Proves: anon can read nothing, cannot insert, cannot list/read storage objects, ping() works for anon;
-- plus positive controls so "reads nothing" is not vacuous (owner sees own rows, other user sees none).
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Fixtures (as the migration role, before switching roles) -----------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

insert into public.settings (owner_id, shop_name) values ('11111111-1111-1111-1111-111111111111', 'Test Shop');
insert into public.products (id, owner_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cake');
insert into public.variants (id, owner_id, product_id, name, price) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', '1 kg', 500);
-- order_no is explicit: the fixture runs without auth.uid(), so next_order_no() would raise.
insert into public.orders (id, owner_id, order_no, customer_name) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'Asha');
insert into public.order_items (owner_id, order_id, variant_id, product_name, variant_name, unit_price, quantity) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'Cake', '1 kg', 500, 2);
insert into public.bills (owner_id, order_id, bill_no, image_path, total_at_generation, items_hash) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 1,
   '11111111-1111-1111-1111-111111111111/2026/INV-0001.png', 1000, 'hash');
insert into storage.objects (bucket_id, name, owner_id) values
  ('bills', '11111111-1111-1111-1111-111111111111/2026/INV-0001.png', '11111111-1111-1111-1111-111111111111');

-- Sanity: fixture arithmetic (trigger-maintained total) ---------------------------------------------
select is((select total from public.orders where id = 'cccccccc-0000-0000-0000-000000000001'), 1000.00::numeric,
  'order total is maintained from items (2 x 500)');

-- ANON: no privileges on any table -> reading raises "permission denied" (42501) ---------------------
set local role anon;

select throws_ok('select 1 from public.settings', '42501', null, 'anon cannot read settings');
select throws_ok('select 1 from public.products', '42501', null, 'anon cannot read products');
select throws_ok('select 1 from public.variants', '42501', null, 'anon cannot read variants');
select throws_ok('select 1 from public.orders', '42501', null, 'anon cannot read orders');
select throws_ok('select 1 from public.order_items', '42501', null, 'anon cannot read order_items');
select throws_ok('select 1 from public.bills', '42501', null, 'anon cannot read bills');

select throws_ok($$insert into public.settings (owner_id) values ('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'anon cannot insert settings');
select throws_ok($$insert into public.products (owner_id, name) values ('11111111-1111-1111-1111-111111111111', 'X')$$,
  '42501', null, 'anon cannot insert products');
select throws_ok($$insert into public.variants (owner_id, product_id, name, price)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'X', 1)$$,
  '42501', null, 'anon cannot insert variants');
select throws_ok($$insert into public.orders (owner_id, customer_name) values ('11111111-1111-1111-1111-111111111111', 'X')$$,
  '42501', null, 'anon cannot insert orders');
select throws_ok($$insert into public.order_items (owner_id, order_id, product_name, variant_name, unit_price, quantity)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'X', 'X', 1, 1)$$,
  '42501', null, 'anon cannot insert order_items');
select throws_ok($$insert into public.bills (owner_id, order_id, bill_no, image_path, total_at_generation, items_hash)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 9, 'p', 1, 'h')$$,
  '42501', null, 'anon cannot insert bills');

select throws_ok('update public.orders set customer_name = ''hacked''', '42501', null, 'anon cannot update orders');
select throws_ok('delete from public.orders', '42501', null, 'anon cannot delete orders');

-- ANON: storage. Listing returns nothing, inserting is blocked by RLS.
select is((select count(*)::int from storage.objects), 0, 'anon lists zero storage objects');
select is((select count(*)::int from storage.objects where bucket_id in ('bills', 'assets')), 0,
  'anon reads zero objects from bills/assets');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('bills', '11111111-1111-1111-1111-111111111111/2026/evil.png')$$,
  '42501', null, 'anon cannot upload to bills');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('assets', '11111111-1111-1111-1111-111111111111/2026/evil.png')$$,
  '42501', null, 'anon cannot upload to assets');

-- ANON: keep-alive works, and it is the only function callable.
select is(public.ping(), 1, 'ping() works for anon');
select throws_ok('select public.next_bill_no()', '42501', null, 'anon cannot call next_bill_no()');
select throws_ok('select public.next_order_no()', '42501', null, 'anon cannot call next_order_no()');

-- AUTHENTICATED other user: sees nothing of the owner's data -------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.orders), 0, 'other user sees no orders');
select is((select count(*)::int from public.order_items), 0, 'other user sees no order_items');
select is((select count(*)::int from storage.objects where bucket_id = 'bills'), 0, 'other user sees no bill files');
select throws_ok($$insert into public.products (owner_id, name) values ('11111111-1111-1111-1111-111111111111', 'Steal')$$,
  '42501', null, 'other user cannot insert rows owned by someone else');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('bills', '11111111-1111-1111-1111-111111111111/2026/steal.png')$$,
  '42501', null, 'other user cannot upload into the owner folder');

-- AUTHENTICATED owner: positive controls ---------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.orders), 1, 'owner sees own order');
select is((select count(*)::int from storage.objects where bucket_id = 'bills'), 1, 'owner sees own bill file');
select is(public.next_bill_no(), 1, 'next_bill_no() returns 1 first, then advances');
select is((select next_bill_no from public.settings), 2, 'settings.next_bill_no advanced to 2');

select * from finish();
rollback;
