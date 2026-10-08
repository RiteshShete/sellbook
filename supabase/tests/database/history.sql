-- Trash/restore, rollback to any version, audit log. Everything is rolled back.
-- Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid, j jsonb);
grant all on t to public;
select public.init_settings();
insert into t (k, id) select 'cake', (public.upsert_product('{"name":"Cake","variants":[
  {"name":"500 g","price":"250"},{"name":"1 kg","price":"480"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'v500', id from public.variants where name = '500 g';
insert into t (k, id) select 'v1kg', id from public.variants where name = '1 kg';

create function pg_temp.oid() returns uuid language sql as $$ select id from t where k = 'o' $$;
create function pg_temp.o() returns public.orders language sql as $$ select * from public.orders where id = pg_temp.oid() $$;
create function pg_temp.items() returns text language sql as $$
  select string_agg(variant_name || '@' || unit_price || 'x' || quantity, ', ' order by position)
    from public.order_items where order_id = pg_temp.oid() $$;

-- v1: create (2x 500 g)
insert into t (k, id) select 'o', (public.create_order(format('{"customer_name":"Asha","items":[{"variant_id":"%s","quantity":2}]}',
  (select id from t where k = 'v500'))::jsonb)).id;
insert into t (k, j) values ('v1_items', to_jsonb(pg_temp.items()));
-- v2: edit (add 1 kg, discount 30)
select public.update_order(pg_temp.oid(), format('{"customer_name":"Asha K","discount":"30","items":[
  {"id":"%s","variant_id":"%s","quantity":2},{"variant_id":"%s","quantity":1}]}',
  (select id from public.order_items where order_id = pg_temp.oid()), (select id from t where k = 'v500'),
  (select id from t where k = 'v1kg'))::jsonb, 1);
-- v3: ready, v4: delivered, v5: paid cash
select public.set_order_status(pg_temp.oid(), 'ready', 2);
select public.set_order_status(pg_temp.oid(), 'delivered', 3);
select public.set_payment(pg_temp.oid(), 'paid', 'cash', 4);
-- Catalog price change after the fact: rollback must use snapshots, not the catalog.
select public.upsert_product(format('{"id":"%s","name":"Cake","variants":[{"id":"%s","name":"500 g","price":"999"},{"id":"%s","name":"1 kg","price":"480"}]}',
  (select id from t where k = 'cake'), (select id from t where k = 'v500'), (select id from t where k = 'v1kg'))::jsonb);

-- Rollback to v1
select throws_ok(format('select public.rollback_order(%L, 5, 5)', pg_temp.oid()), '22023', 'that is already the current version',
  'cannot roll back to the current version');
select throws_ok(format('select public.rollback_order(%L, 1, 4)', pg_temp.oid()), 'SB409', null, 'stale version rejected');
select lives_ok(format('select public.rollback_order(%L, 1, 5)', pg_temp.oid()), 'roll back to v1');
select is(pg_temp.items(), (select j #>> '{}' from t where k = 'v1_items'), 'items back to v1 with v1 snapshot price');
select is((pg_temp.o()).customer_name, 'Asha', 'fields back to v1');
select is((pg_temp.o()).discount, 0.00::numeric, 'discount back to v1');
select is((pg_temp.o()).total, 500.00::numeric, 'total recomputed from restored items');
select is((pg_temp.o()).status, 'new'::public.order_status, 'status back to new');
select is((pg_temp.o()).delivered_at, null, 'delivered_at cleared');
select is((pg_temp.o()).payment_status, 'pending'::public.payment_status, 'payment back to pending');
select is((pg_temp.o()).version_no, 6, 'rollback is a new version');
select is((select reason || ': ' || summary from public.order_versions where order_id = pg_temp.oid() and version_no = 6),
  'rollback: Rolled back to version 1', 'rollback version recorded');

-- Rollback to v5 restores exact timestamps: backdate v5's snapshot (as the table owner) first.
reset role;
update public.order_versions
   set snapshot = snapshot || '{"delivered_at":"2026-01-15T04:30:00+00:00","paid_at":"2026-01-16T05:00:00+00:00"}'
 where order_id = (select id from t where k = 'o') and version_no = 5;
set local role authenticated;
select lives_ok(format('select public.rollback_order(%L, 5, 6)', pg_temp.oid()), 'roll forward to v5');
select is((pg_temp.o()).delivered_at, '2026-01-15T04:30:00+00:00'::timestamptz, 'delivered_at restored exactly');
select is((pg_temp.o()).paid_at, '2026-01-16T05:00:00+00:00'::timestamptz, 'paid_at restored exactly');
select is((pg_temp.o()).payment_mode, 'cash'::public.payment_mode, 'payment mode restored');

-- Trash then restore returns identical data
insert into t (k, j) values ('before', public.order_snapshot(pg_temp.oid()) - '{version_no,updated_at}'::text[]);
select lives_ok(format('select public.trash_order(%L)', pg_temp.oid()), 'trash order');
select throws_ok(format('select public.set_order_status(%L, %L, 8)', pg_temp.oid(), 'ready'), 'P0002', 'order not found',
  'a trashed order cannot be changed');
select lives_ok(format('select public.restore_order(%L)', pg_temp.oid()), 'restore order');
select is(public.order_snapshot(pg_temp.oid()) - '{version_no,updated_at}'::text[], (select j from t where k = 'before'),
  'trash then restore returns identical data');

-- Audit log
select is((select count(*)::int from public.audit_log where entity = 'order' and entity_id = pg_temp.oid()), 9,
  'one audit row per order version');
select ok(exists (select 1 from public.audit_log where entity = 'product' and action = 'create'), 'product create audited');
select ok(exists (select 1 from public.audit_log where entity = 'variant' and action = 'update'), 'variant price change audited');
select is((select count(*)::int from public.audit_log where entity = 'variant' and entity_id = (select id from t where k = 'v1kg')), 1,
  'unchanged variant in a save is not audited again');

reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.audit_log), 0, 'other user sees no audit rows');

select * from finish();
rollback;
