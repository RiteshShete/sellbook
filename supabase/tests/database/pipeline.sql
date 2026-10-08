-- Pipeline (B1, B9) + payment (B2): every transition, its undo, timestamps, versions.
-- Everything is rolled back. Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid, ts timestamptz);
insert into t (k, id) select 'cake', (public.upsert_product('{"name":"Cake","variants":[{"name":"1 kg","price":"500"}]}'::jsonb) ->> 'id')::uuid;
insert into t (k, id) select 'v', id from public.variants where name = '1 kg';
insert into t (k, id) select 'o', (public.create_order(format('{"customer_name":"Asha","items":[{"variant_id":"%s","quantity":1}]}',
  (select id from t where k = 'v'))::jsonb)).id;
insert into t (k, id) select 'draft', (public.create_order('{"customer_name":"Draft","items":[]}'::jsonb)).id;

create function pg_temp.o() returns public.orders language sql as
  $$ select * from public.orders where id = (select id from t where k = 'o') $$;
create function pg_temp.mv(p_status public.order_status) returns public.orders language sql as
  $$ select public.set_order_status((select id from t where k = 'o'), p_status, (pg_temp.o()).version_no) $$;
create function pg_temp.pay(p_status public.payment_status, p_mode public.payment_mode) returns public.orders language sql as
  $$ select public.set_payment((select id from t where k = 'o'), p_status, p_mode, (pg_temp.o()).version_no) $$;

-- Forward steps, no skipping (B1)
select throws_ok($$select pg_temp.mv('delivered')$$, '22023', 'cannot move an order from new to delivered', 'new -> delivered skip rejected');
select throws_ok(format('select public.set_order_status(%L, %L, 1)', (select id from t where k = 'draft'), 'ready'),
  '22023', 'a ready or delivered order needs at least one item', 'B9: empty order cannot become ready');

select is((pg_temp.mv('ready')).status, 'ready'::public.order_status, 'new -> ready');
select isnt((pg_temp.o()).ready_at, null, 'ready_at stamped');
select is((pg_temp.mv('delivered')).status, 'delivered'::public.order_status, 'ready -> delivered');
select isnt((pg_temp.o()).delivered_at, null, 'delivered_at stamped');

-- Undo steps
select is((pg_temp.mv('ready')).status, 'ready'::public.order_status, 'undo: delivered -> ready');
select is((pg_temp.o()).delivered_at, null, 'undo clears delivered_at');
select is((pg_temp.mv('new')).status, 'new'::public.order_status, 'undo: ready -> new');
select is((pg_temp.o()).ready_at, null, 'undo clears ready_at');

-- Cancel from delivered, then undo the cancel: back to delivered with the original delivered_at
select lives_ok($$select pg_temp.mv('ready'); select pg_temp.mv('delivered')$$, 'forward again');
-- now() is constant in a transaction, so backdate to tell "kept" apart from "re-stamped".
update public.orders set delivered_at = '2026-01-15 10:00+05:30' where id = (select id from t where k = 'o');
update t set ts = '2026-01-15 10:00+05:30' where k = 'o';
select is((pg_temp.mv('cancelled')).cancelled_from, 'delivered'::public.order_status, 'cancel remembers cancelled_from');
select isnt((pg_temp.o()).cancelled_at, null, 'cancelled_at stamped');
select throws_ok($$select pg_temp.mv('ready')$$, '22023', 'cannot move an order from cancelled to ready',
  'cancelled can only go back to where it was');
select is((pg_temp.mv('delivered')).status, 'delivered'::public.order_status, 'undo cancel -> delivered');
select is((pg_temp.o()).cancelled_from, null, 'cancelled_from cleared');
select is((pg_temp.o()).cancelled_at, null, 'cancelled_at cleared');
select is((pg_temp.o()).delivered_at, (select ts from t where k = 'o'), 'original delivered_at kept through cancel/undo');

-- Concurrency + history
select throws_ok(format('select public.set_order_status(%L, %L, 1)', (select id from t where k = 'o'), 'ready'),
  'SB409', 'order changed on another device', 'stale version rejected');
select is((select count(*)::int from public.order_versions where order_id = (select id from t where k = 'o') and reason = 'status'), 8,
  'one status version per move');

-- Payment (B2)
select throws_ok($$select pg_temp.pay('paid', null)$$, '22023', 'choose online or cash', 'paid needs a mode');
select is((pg_temp.pay('paid', 'online')).payment_mode, 'online'::public.payment_mode, 'paid online');
select isnt((pg_temp.o()).paid_at, null, 'paid_at stamped');
update public.orders set paid_at = '2026-02-01 09:00+05:30' where id = (select id from t where k = 'o');
update t set ts = '2026-02-01 09:00+05:30' where k = 'o';
select is((pg_temp.pay('paid', 'cash')).payment_mode, 'cash'::public.payment_mode, 'switch to cash');
select is((pg_temp.o()).paid_at, (select ts from t where k = 'o'), 'switching mode keeps paid_at');
select is((pg_temp.pay('pending', 'cash')).payment_mode, null, 'pending clears the mode (B2)');
select is((pg_temp.o()).paid_at, null, 'pending clears paid_at');
select is((select summary from public.order_versions where order_id = (select id from t where k = 'o') order by version_no desc limit 1),
  'Payment: pending', 'payment version recorded');
select lives_ok(format('select public.set_payment(%L, %L, %L, 1)', (select id from t where k = 'draft'), 'paid', 'cash'),
  'payment is independent of status (new, empty order can be paid)');

reset role;
set local role anon;
select throws_ok(format('select public.set_order_status(%L, %L, 1)', '00000000-0000-0000-0000-000000000000', 'ready'),
  '42501', null, 'anon cannot change status');

select * from finish();
rollback;
