-- History slimming: delta versions, slim snapshots, rebuilding states, rollback through deltas,
-- pruning (with materialising), slim audit rows and audit expiry. Everything is rolled back.
-- Needs the 20261113100000_history_slimming migration. Run with scripts/test-db-linked.sh or `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid);
create temp table pre (version_no integer, snapshot jsonb);
grant all on t, pre to public;
select public.init_settings();
insert into t (k, id) select 'cake', (public.upsert_product('{"name":"Cake","variants":[{"name":"500 g","price":"250"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'v500', id from public.variants where name = '500 g';

create function pg_temp.oid(p text) returns uuid language sql as $$ select id from t where k = p $$;
create function pg_temp.o(p text) returns public.orders language sql as $$ select * from public.orders where id = pg_temp.oid(p) $$;
create function pg_temp.ver(p text, n integer) returns jsonb language sql as $$
  select snapshot from public.order_versions where order_id = pg_temp.oid(p) and version_no = n $$;

-- Order "o": v1 create, v2 ready, v3 delivered, v4 paid (cash)
insert into t (k, id) select 'o', (public.create_order(format('{"customer_name":"Asha","items":[{"variant_id":"%s","quantity":2}]}',
  pg_temp.oid('v500'))::jsonb)).id;
select public.set_order_status(pg_temp.oid('o'), 'ready', 1);
select public.set_order_status(pg_temp.oid('o'), 'delivered', 2);
select public.set_payment(pg_temp.oid('o'), 'paid', 'cash', 3);

-- 1) deltas
select is((select count(*)::int from public.order_versions where order_id = pg_temp.oid('o') and snapshot ? '_delta'), 3,
  'status and payment versions are deltas');
select is(pg_temp.ver('o', 2) - '_delta' - 'ready_at', '{"status":"ready"}'::jsonb, 'a status delta holds only what changed');
select is(pg_temp.ver('o', 4) - '_delta' - 'paid_at', '{"payment_status":"paid","payment_mode":"cash"}'::jsonb,
  'a payment delta holds only what changed');
select ok(pg_column_size(pg_temp.ver('o', 2)) * 3 < pg_column_size(pg_temp.ver('o', 1)), 'a delta is far smaller than a full snapshot');

-- 2) slim full snapshot; the bill snapshot is untouched
select ok(not (pg_temp.ver('o', 1) ? 'owner_id') and not (pg_temp.ver('o', 1) ? 'id')
  and not ((pg_temp.ver('o', 1) -> 'items' -> 0) ? 'order_id'), 'full snapshot drops repeated ids');
select ok(public.order_snapshot(pg_temp.oid('o')) ? 'owner_id', 'order_snapshot (bills) is unchanged');

-- 3) full state of every version
select is((select count(*)::int from public.list_order_versions(pg_temp.oid('o'))), 4, 'every version is listed');
select is((select snapshot ->> 'status' from public.list_order_versions(pg_temp.oid('o')) where version_no = 3), 'delivered',
  'a delta version is rebuilt to the full state');
select is((select jsonb_array_length(snapshot -> 'items') from public.list_order_versions(pg_temp.oid('o')) where version_no = 2), 1,
  'a rebuilt version has its items');
select is((select snapshot ->> 'payment_status' from public.list_order_versions(pg_temp.oid('o')) where version_no = 2), 'pending',
  'a rebuilt version keeps earlier fields');
select is((select snapshot ->> 'payment_mode' from public.list_order_versions(pg_temp.oid('o')) where version_no = 4), 'cash',
  'payment fields rebuilt');

-- 4) rollback through deltas
select lives_ok(format('select public.rollback_order(%L, 2, 4)', pg_temp.oid('o')), 'roll back to a delta version (ready)');
select is((pg_temp.o('o')).status, 'ready'::public.order_status, 'status back to ready');
select is((pg_temp.o('o')).delivered_at, null, 'delivered_at cleared');
select is((pg_temp.o('o')).payment_status, 'pending'::public.payment_status, 'payment back to pending');
select lives_ok(format('select public.rollback_order(%L, 4, 5)', pg_temp.oid('o')), 'roll forward to the paid delta version');
select is((pg_temp.o('o')).status, 'delivered'::public.order_status, 'status delivered again');
select is((pg_temp.o('o')).payment_mode, 'cash'::public.payment_mode, 'payment mode restored');

-- 5) a history row in the old full format is a valid starting point
insert into t (k, id) select 'o2', (public.create_order(format('{"customer_name":"Ravi","items":[{"variant_id":"%s","quantity":1}]}',
  pg_temp.oid('v500'))::jsonb)).id;
reset role;
update public.order_versions set snapshot = public.order_snapshot(pg_temp.oid('o2')) where order_id = pg_temp.oid('o2') and version_no = 1;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.set_order_status(pg_temp.oid('o2'), 'ready', 1);
select ok(not (pg_temp.ver('o2', 2) ? 'items'), 'a delta after an old-format row does not copy the unchanged items');
select is((select jsonb_array_length(snapshot -> 'items') from public.list_order_versions(pg_temp.oid('o2')) where version_no = 2), 1,
  'and still rebuilds with its items');

-- 6) pruning: v1 + 14 status toggles = 15 versions, all old
insert into t (k, id) select 'o3', (public.create_order(format('{"customer_name":"Meena","items":[{"variant_id":"%s","quantity":1}]}',
  pg_temp.oid('v500'))::jsonb)).id;
select public.set_order_status(pg_temp.oid('o3'), (case when g % 2 = 1 then 'ready' else 'new' end)::public.order_status, g)
  from generate_series(1, 14) g;
insert into pre select version_no, snapshot from public.list_order_versions(pg_temp.oid('o3'));
reset role;
update public.order_versions set created_at = now() - interval '200 days' where order_id = pg_temp.oid('o3');
select is(public.prune_order_history(3, 120), 11, 'prune deletes all but first + last 3 of an old order (and nothing recent)');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.order_versions where order_id = pg_temp.oid('o3')), 4, 'first and last 3 are kept');
select is((select count(*)::int from public.list_order_versions(pg_temp.oid('o3')) l join pre p using (version_no)
            where l.snapshot = p.snapshot), 4, 'every kept version still rebuilds to exactly the same state');
select lives_ok(format('select public.rollback_order(%L, 14, 15)', pg_temp.oid('o3')), 'roll back to a kept version after pruning');
select is((pg_temp.o('o3')).status, 'ready'::public.order_status, 'and it restores that version');

-- 7) audit rows: changed fields only, and expiry
select public.upsert_product(format('{"id":"%s","name":"Cake","variants":[{"id":"%s","name":"500 g","price":"999"}]}',
  pg_temp.oid('cake'), pg_temp.oid('v500'))::jsonb);
select is((select array_agg(k) from public.audit_log a, jsonb_object_keys(a.after) k
            where a.entity = 'variant' and a.action = 'update' and a.entity_id = pg_temp.oid('v500')), array['price'],
  'a variant update logs only the changed field (after)');
select is((select array_agg(k) from public.audit_log a, jsonb_object_keys(a.before) k
            where a.entity = 'variant' and a.action = 'update' and a.entity_id = pg_temp.oid('v500')), array['price'],
  'and only the changed field (before)');
select ok(not exists (select 1 from public.audit_log where entity = 'product' and action = 'create' and after ? 'owner_id'),
  'a create row drops the bookkeeping keys');
reset role;
update public.audit_log set created_at = now() - interval '400 days' where id = (select min(id) from public.audit_log);
select is(public.prune_audit_log(12), 1, 'audit rows older than 12 months are deleted');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok('select public.prune_order_history()', '42501', null, 'app users cannot prune order history');
select throws_ok('select public.prune_audit_log()', '42501', null, 'app users cannot prune the audit log');

select * from finish();
rollback;
