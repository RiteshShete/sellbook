-- Analytics (B4, B5, A6, A7): IST month boundaries, exclusions, ageing, CSV rows, RLS.
-- Fixture month is Feb 2025 (28 days), far from "now", so relative-date orders never land in it.
-- Everything is rolled back. Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid);
grant all on t to public;
select public.init_settings();
select public.upsert_product('{"name":"Cake","variants":[{"name":"500 g","price":"250"},{"name":"1 kg","price":"480"}]}'::jsonb);
select public.upsert_product('{"name":"Bread","variants":[{"name":"Loaf","price":"40"}]}'::jsonb);
insert into t (k, id) select 'v500', id from public.variants where name = '500 g';
insert into t (k, id) select 'v1kg', id from public.variants where name = '1 kg';
insert into t (k, id) select 'loaf', id from public.variants where name = 'Loaf';

-- mk(key, customer, '[[variant key, qty], ...]', discount)
create function pg_temp.mk(p_key text, p_name text, p_items jsonb, p_discount text default '0') returns void
language sql as $$
  insert into t (k, id) select p_key, (public.create_order(jsonb_build_object(
    'customer_name', p_name, 'discount', p_discount,
    'items', (select jsonb_agg(jsonb_build_object('variant_id', (select id from t where k = e ->> 0),
                                                  'quantity', (e ->> 1)::int) order by n)
                from jsonb_array_elements(p_items) with ordinality as x(e, n))))).id
$$;
create function pg_temp.oid(p_key text) returns uuid language sql as $$ select id from t where k = p_key $$;
create function pg_temp.ver(p_key text) returns int language sql as
  $$ select version_no from public.orders where id = pg_temp.oid(p_key) $$;
create function pg_temp.mv(p_key text, p_status public.order_status) returns void language sql as
  $$ select public.set_order_status(pg_temp.oid(p_key), p_status, pg_temp.ver(p_key)) $$;
-- Deliver, then backdate delivered_at (the trigger keeps it while the status stays delivered).
create function pg_temp.deliver(p_key text, p_at timestamptz) returns void language sql as $$
  select pg_temp.mv(p_key, 'ready');
  select pg_temp.mv(p_key, 'delivered');
  update public.orders set delivered_at = p_at where id = pg_temp.oid(p_key);
$$;
create function pg_temp.pay(p_key text, p_mode public.payment_mode, p_at timestamptz) returns void language sql as $$
  select public.set_payment(pg_temp.oid(p_key), 'paid', p_mode, pg_temp.ver(p_key));
  update public.orders set paid_at = p_at where id = pg_temp.oid(p_key);
$$;

-- A: 2 x Cake 1 kg (960) - 60 = 900. Delivered at the first instant of Feb (IST); paid online in Feb.
select pg_temp.mk('A', 'Asha', '[["v1kg",2]]', '60');
select pg_temp.deliver('A', '2025-01-31 18:30:00+00');
select pg_temp.pay('A', 'online', '2025-02-02 10:00+05:30');
-- B: Cake 500 g + 3 Loaf = 370. Delivered at the last second of Feb (IST); unpaid.
select pg_temp.mk('B', 'Bina', '[["v500",1],["loaf",3]]');
select pg_temp.deliver('B', '2025-02-28 18:29:59+00');
-- C: Loaf = 40. Delivered at the last second of Jan (IST); paid cash in Feb.
select pg_temp.mk('C', 'Chetan', '[["loaf",1]]');
select pg_temp.deliver('C', '2025-01-31 18:29:59+00');
select pg_temp.pay('C', 'cash', '2025-02-05 12:00+05:30');
-- D: Cake 1 kg = 480. Delivered at the first instant of Mar (IST); unpaid.
select pg_temp.mk('D', 'Dev', '[["v1kg",1]]');
select pg_temp.deliver('D', '2025-02-28 18:30:00+00');
-- E: 4 x Cake 500 g = 1000. Delivered and paid in Feb, then cancelled: never counts.
select pg_temp.mk('E', 'Esha', '[["v500",4]]');
select pg_temp.deliver('E', '2025-02-10 12:00+05:30');
select pg_temp.pay('E', 'cash', '2025-02-10 13:00+05:30');
select pg_temp.mv('E', 'cancelled');
-- F: 2 Loaf = 80. Delivered in Feb, unpaid, then trashed: never counts.
select pg_temp.mk('F', 'Farah', '[["loaf",2]]');
select pg_temp.deliver('F', '2025-02-12 12:00+05:30');
select public.trash_order(pg_temp.oid('F'));
-- G: 2 x Cake 500 g = 500. Only ready, but paid online in Feb: collected, not sales.
select pg_temp.mk('G', 'Gopal', '[["v500",2]]');
select pg_temp.mv('G', 'ready');
select pg_temp.pay('G', 'online', '2025-02-15 10:00+05:30');
-- I, J: Loaf = 40 each, unpaid, delivered 60 days ago and today (ageing buckets).
select pg_temp.mk('I', 'Isha', '[["loaf",1]]');
select pg_temp.deliver('I', now() - interval '60 days');
select pg_temp.mk('J', 'Jai', '[["loaf",1]]');
select pg_temp.deliver('J', now());

create temp table r as select public.analytics_month('2025-02') as j;
grant all on r to public;
create function pg_temp.n(p_path text[]) returns numeric language sql as $$ select (j #>> p_path)::numeric from r $$;

-- Sales set (B4): A + B only. Boundaries: Jan 31 23:59:59 IST is January, Mar 1 00:00 IST is March.
select is(pg_temp.n('{sales}'), 1270.00, 'sales = delivered in month (A 900 + B 370)');
select is(pg_temp.n('{orders}'), 2::numeric, 'orders = 2');
select is(pg_temp.n('{units}'), 6::numeric, 'units = 2 + 1 + 3');
select is(pg_temp.n('{aov}'), 635.00, 'aov = 1270 / 2');
-- Collected (B5, A6): A online + C cash (delivered in Jan) + G online (only ready). E cancelled excluded.
select is(pg_temp.n('{collected}'), 1440.00, 'collected = paid_at in month, not cancelled');
select is(pg_temp.n('{collected_online}'), 1400.00, 'online = A + G');
select is(pg_temp.n('{collected_cash}'), 40.00, 'cash = C (cancelled E excluded)');
-- Outstanding: delivered + pending, all time: B, D, I, J. F (trashed) and E (cancelled) excluded.
select is(pg_temp.n('{outstanding_total}'), 930.00, 'outstanding = 370 + 480 + 40 + 40');
select is(pg_temp.n('{outstanding_count}'), 4::numeric, 'outstanding count = 4');

-- Breakdown (A7: gross before discount, so 1210 + 120 > sales).
select is((select jsonb_array_length(j -> 'by_product') from r), 2, 'two products');
select is((select j #>> '{by_product,0,name}' from r), 'Cake', 'top product is Cake');
select is(pg_temp.n('{by_product,0,revenue}'), 1210.00, 'Cake gross = 960 + 250');
select is(pg_temp.n('{by_product,0,units}'), 3::numeric, 'Cake units = 3');
select is(pg_temp.n('{by_product,0,orders}'), 2::numeric, 'Cake in 2 orders');
select is(pg_temp.n('{by_product,1,revenue}'), 120.00, 'Bread gross = 120');
select is((select jsonb_array_length(j -> 'by_variant') from r), 3, 'three variants');
select is((select (j #>> '{by_variant,0,product_name}') || ' / ' || (j #>> '{by_variant,0,variant_name}') from r),
  'Cake / 1 kg', 'top variant is Cake 1 kg');
select is(pg_temp.n('{by_variant,0,revenue}'), 960.00, 'Cake 1 kg gross = 960');

-- Daily: zero-filled, IST days.
select is((select jsonb_array_length(j -> 'daily') from r), 28, 'Feb 2025 has 28 days, all present');
select is((select j #>> '{daily,0,date}' from r), '2025-02-01', 'first day');
select is(pg_temp.n('{daily,0,sales}'), 900.00, 'A counts on 1 Feb (IST)');
select is(pg_temp.n('{daily,27,sales}'), 370.00, 'B counts on 28 Feb (IST)');
select is((select sum((d ->> 'sales')::numeric) from r, jsonb_array_elements(j -> 'daily') d), 1270.00,
  'daily sales add up to sales');
select is(pg_temp.n('{daily,1,orders}'), 0::numeric, 'empty day is zero');

-- Neighbouring months get the boundary orders.
select is((public.analytics_month('2025-01') ->> 'sales')::numeric, 40.00, 'January: C only');
select is((public.analytics_month('2025-03') ->> 'sales')::numeric, 480.00, 'March: D only');
select is((public.analytics_month('2024-12') ->> 'aov')::numeric, 0::numeric, 'empty month: aov 0');
select throws_ok($$select public.analytics_month('2025-13')$$, '22023', 'month must look like 2026-10', 'bad month rejected');

-- Pending payments: delivered + unpaid, oldest first, with ageing buckets.
select is((select count(*)::int from public.pending_payments()), 4, 'pending = B, D, I, J');
select is((select customer_name from public.pending_payments() limit 1), 'Bina', 'oldest first');
select is((select age_days || ' ' || bucket from public.pending_payments() where id = pg_temp.oid('I')),
  '60 31-60', '60 days old is in 31-60');
select is((select age_days || ' ' || bucket from public.pending_payments() where id = pg_temp.oid('J')),
  '0 0-7', 'delivered today is 0 days, 0-7');

-- CSV rows = the sales set.
select is((select count(*)::int from public.export_orders_csv_rows('2025-02')), 2, 'CSV has the 2 sales orders');
select is((select items from public.export_orders_csv_rows('2025-02') where customer_name = 'Bina'),
  'Cake 500 g x 1; Bread Loaf x 3', 'items flattened in order');
select is((select units || ' ' || total || ' ' || payment_status || ' ' || payment_mode
             from public.export_orders_csv_rows('2025-02') where customer_name = 'Asha'),
  '2 900.00 paid online', 'paid order row');

-- Another owner sees nothing; anon cannot call at all.
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((public.analytics_month('2025-02') ->> 'sales')::numeric, 0::numeric, 'other owner: no sales');
select is((select count(*)::int from public.pending_payments()), 0, 'other owner: no pending');
reset role;
set local role anon;
select throws_ok($$select public.analytics_month('2025-02')$$, '42501', null, 'anon cannot read analytics');

select * from finish();
rollback;
