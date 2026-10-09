-- Bill numbers (B6), revisions, outdated hash (B7), insert-only bills. Everything is rolled back.
-- Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');
-- Uploaded images (the client uploads via the Storage API before registering).
insert into storage.objects (bucket_id, name, owner_id) values
  ('bills', '11111111-1111-1111-1111-111111111111/2026/bill-a.png', '11111111-1111-1111-1111-111111111111'),
  ('bills', '11111111-1111-1111-1111-111111111111/2026/bill-b.png', '11111111-1111-1111-1111-111111111111'),
  ('bills', '11111111-1111-1111-1111-111111111111/2026/bill-c.png', '11111111-1111-1111-1111-111111111111'),
  ('assets', '11111111-1111-1111-1111-111111111111/2026/qr.png', '11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid, j jsonb);
grant all on t to public;
select public.init_settings();
insert into t (k, id) select 'cake', (public.upsert_product('{"name":"Cake","variants":[
  {"name":"500 g","price":"250"},{"name":"1 kg","price":"480"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'v500', id from public.variants where name = '500 g';

create function pg_temp.oid() returns uuid language sql as $$ select id from t where k = 'o' $$;
create function pg_temp.o() returns public.orders language sql as $$ select * from public.orders where id = pg_temp.oid() $$;
create function pg_temp.p(f text) returns text language sql as $$ select '11111111-1111-1111-1111-111111111111/2026/' || f $$;

-- An order with no items cannot get a bill.
insert into t (k, id) select 'empty', (public.create_order('{"customer_name":"Nobody"}'::jsonb)).id;
select throws_ok(format('select public.reserve_bill_number(%L)', (select id from t where k = 'empty')), '22023',
  'add at least one item before making a bill', 'no bill without items');
select is((select next_bill_no from public.settings), 1, 'a refused reserve does not use up a number');

insert into t (k, id) select 'o', (public.create_order(format('{"customer_name":"Asha","items":[{"variant_id":"%s","quantity":2}]}',
  (select id from t where k = 'v500'))::jsonb)).id;

-- Reserve: assigns once, idempotent, returns the snapshot + hash, does not bump the version.
insert into t (k, j) select 'r1', public.reserve_bill_number(pg_temp.oid());
select is((pg_temp.o()).bill_no, 1, 'first reserve assigns bill no. 1');
select is((select (j ->> 'bill_no')::int from t where k = 'r1'), 1, 'reserve returns the bill no.');
select is((select jsonb_array_length(j -> 'items') from t where k = 'r1'), 1, 'reserve returns the items');
select is((select j ->> 'content_hash' from t where k = 'r1'), public.bill_content_hash(pg_temp.oid()), 'reserve returns the current hash');
select is((pg_temp.o()).version_no, 1, 'reserving a bill number is not an order edit');
select lives_ok(format('select public.reserve_bill_number(%L)', pg_temp.oid()), 'reserve again');
select is((pg_temp.o()).bill_no, 1, 'bill no. unchanged on second reserve');
select is((select next_bill_no from public.settings), 2, 'second reserve does not consume a number');

-- Register revision 1.
select is((public.register_bill_revision(pg_temp.oid(), pg_temp.p('bill-a.png'),
  (select j ->> 'content_hash' from t where k = 'r1'))).revision, 1, 'first image is revision 1');
select is((select total_at_generation from public.bills where order_id = pg_temp.oid()), 500.00::numeric, 'bill keeps the total');
select throws_ok(format('select public.register_bill_revision(%L, %L, %L)', pg_temp.oid(), pg_temp.p('missing.png'),
  (select j ->> 'content_hash' from t where k = 'r1')), 'P0002', 'bill image not found in storage', 'image must exist');
select throws_ok(format('select public.register_bill_revision(%L, %L, %L)', pg_temp.oid(), pg_temp.p('qr.png'),
  (select j ->> 'content_hash' from t where k = 'r1')), 'P0002', 'bill image not found in storage', 'image must be in the bills bucket');

-- B7: changing notes keeps the hash; changing quantity changes it and a stale hash is refused.
select public.update_order(pg_temp.oid(), format('{"customer_name":"Asha","notes":"ring bell","items":[{"id":"%s","variant_id":"%s","quantity":2}]}',
  (select id from public.order_items where order_id = pg_temp.oid()), (select id from t where k = 'v500'))::jsonb, 1);
select is(public.bill_content_hash(pg_temp.oid()), (select j ->> 'content_hash' from t where k = 'r1'), 'notes edit does not outdate the bill');
select public.update_order(pg_temp.oid(), format('{"customer_name":"Asha","items":[{"id":"%s","variant_id":"%s","quantity":3}]}',
  (select id from public.order_items where order_id = pg_temp.oid()), (select id from t where k = 'v500'))::jsonb, 2);
select isnt(public.bill_content_hash(pg_temp.oid()), (select j ->> 'content_hash' from t where k = 'r1'), 'qty edit outdates the bill');
select throws_ok(format('select public.register_bill_revision(%L, %L, %L)', pg_temp.oid(), pg_temp.p('bill-b.png'),
  (select j ->> 'content_hash' from t where k = 'r1')), 'SB410', null, 'stale hash refused');

-- Regenerate: same bill no., revision 2, old row kept.
select is((public.register_bill_revision(pg_temp.oid(), pg_temp.p('bill-b.png'),
  public.reserve_bill_number(pg_temp.oid()) ->> 'content_hash')).revision, 2, 'regenerate is revision 2');
select is((select string_agg(bill_no || '/' || revision, ',' order by revision) from public.bills where order_id = pg_temp.oid()),
  '1/1,1/2', 'both revisions kept with the same bill no.');
select is((pg_temp.o()).bill_no, 1, 'bill no. survives edits (B6)');

-- A second order gets the next number.
insert into t (k, id) select 'o2', (public.create_order(format('{"customer_name":"Ravi","items":[{"variant_id":"%s","quantity":1}]}',
  (select id from t where k = 'v500'))::jsonb)).id;
select is((public.reserve_bill_number((select id from t where k = 'o2')) ->> 'bill_no')::int, 2, 'next order gets bill no. 2');

-- Bills are insert-only; registering is audited.
select throws_ok(format('update public.bills set revision = 9 where order_id = %L', pg_temp.oid()), '42501', null,
  'bills cannot be updated');
select is((select count(*)::int from public.audit_log where entity = 'bill' and entity_id = pg_temp.oid()), 2,
  'each revision is audited');

-- Another user cannot reserve or register on this order.
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format('select public.reserve_bill_number(%L)', (select id from t where k = 'o2')), 'P0002', 'order not found',
  'other user cannot reserve');
select is((select count(*)::int from public.bills), 0, 'other user sees no bills');

select * from finish();
rollback;
