-- Bill prefix snapshot and bill-number guards (B6), also for writes that bypass the RPCs.
-- Rolled back. Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid);
select public.init_settings();
update public.settings set bill_prefix = 'INV';
insert into t (k, id) select 'cake', (public.upsert_product('{"name":"Cake","variants":[
  {"name":"500 g","price":"250"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'v', id from public.variants where name = '500 g';
insert into t (k, id) select 'o', (public.create_order(format('{"customer_name":"Asha","items":[{"variant_id":"%s","quantity":1}]}',
  (select id from t where k = 'v'))::jsonb)).id;
create function pg_temp.o() returns public.orders language sql as
  $$ select * from public.orders where id = (select id from t where k = 'o') $$;

select is((pg_temp.o()).bill_prefix, null, 'no prefix before a bill number');
select is(public.reserve_bill_number((pg_temp.o()).id) ->> 'bill_prefix', 'INV', 'reserve returns the snapshotted prefix');

-- Changing the prefix in Settings does not relabel an existing bill.
update public.settings set bill_prefix = 'SB';
select public.reserve_bill_number((pg_temp.o()).id);
select is((pg_temp.o()).bill_prefix || '-' || (pg_temp.o()).bill_no, 'INV-1', 'revision keeps INV-1 after the prefix change');

-- A new order picks up the new prefix.
insert into t (k, id) select 'o2', (public.create_order(format('{"customer_name":"Ravi","items":[{"variant_id":"%s","quantity":1}]}',
  (select id from t where k = 'v'))::jsonb)).id;
select is(public.reserve_bill_number((select id from t where k = 'o2')) ->> 'bill_prefix', 'SB', 'next order gets SB');

-- CSV rows carry each order's own prefix.
select public.set_order_status((pg_temp.o()).id, 'ready', (pg_temp.o()).version_no);
select public.set_order_status((pg_temp.o()).id, 'delivered', (pg_temp.o()).version_no);
select is((select bill_prefix from public.export_orders_csv_rows(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'))),
  'INV', 'CSV export uses the order''s prefix');

-- Direct writes cannot change or clear a bill number, or move the counter back.
select throws_ok(format('update public.orders set bill_no = null, bill_prefix = null where id = %L', (pg_temp.o()).id),
  '22023', 'a bill number never changes once given', 'bill number cannot be cleared');
select throws_ok(format('update public.orders set bill_no = 99 where id = %L', (pg_temp.o()).id),
  '22023', 'a bill number never changes once given', 'bill number cannot be changed');
select throws_ok(format('update public.orders set bill_prefix = %L where id = %L', 'X', (pg_temp.o()).id),
  '22023', 'a bill number never changes once given', 'bill prefix cannot be changed');
select throws_ok('update public.settings set next_bill_no = 1', '22023', 'the next bill number can only go up',
  'next_bill_no cannot move back');
select lives_ok('update public.settings set next_bill_no = next_bill_no + 5', 'next_bill_no can move forward');

select * from finish();
rollback;
