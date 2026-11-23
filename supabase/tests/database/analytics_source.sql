-- Analytics split by source (owner vs customer): the filter, by_source, the CSV columns, and the plan rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a@example.test', now()),
  ('c1000000-0000-4000-8000-000000000003', 'c1@example.test', now());
insert into public.shop_invites (code, created_by, expires_at) values ('ANSRCAAAAA', 'a0000000-0000-4000-8000-000000000001', now() + interval '1 day');
update public.subscriptions set tier = 'pro', ends_at = '2099-01-01' where owner_id = 'a0000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_shop('ANSRCAAAAA', 'an-src', 'Src Shop');
reset role;
update public.subscriptions set tier = 'pro', ends_at = '2099-01-01' where owner_id = 'a0000000-0000-4000-8000-000000000001';

-- one owner order (100) and one customer order (300 + 30 delivery), both delivered now
insert into public.orders (id, owner_id, customer_name, source, status) values
  ('00000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'Walk-in', 'owner', 'new');
insert into public.orders (id, owner_id, customer_name, source, status, customer_user_id, fulfilment, payment_method, delivery_fee) values
  ('00000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000001', 'Asha', 'customer', 'new',
   'c1000000-0000-4000-8000-000000000003', 'delivery', 'cod', 30);
insert into public.order_items (order_id, owner_id, product_name, variant_name, unit_price, quantity) values
  ('00000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'Cake', 'Std', 100, 1),
  ('00000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000001', 'Cake', 'Std', 100, 3);
update public.orders set status = 'delivered' where id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2');
-- a declined / cancelled customer order must count nowhere
insert into public.orders (owner_id, customer_name, source, status, customer_user_id, fulfilment, payment_method) values
  ('a0000000-0000-4000-8000-000000000001', 'Nope', 'customer', 'new', 'c1000000-0000-4000-8000-000000000003', 'pickup', 'cod');
update public.orders set status = 'cancelled', cancelled_from = 'new' where customer_name = 'Nope';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('t.m', to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM'), true);

select is((public.analytics_month(current_setting('t.m')) ->> 'orders')::int, 2, 'no filter: both delivered orders');
select is((public.analytics_month(current_setting('t.m'), 'owner') ->> 'orders')::int, 1, 'owner filter: one order');
select is((public.analytics_month(current_setting('t.m'), 'owner') ->> 'sales')::numeric, 100.00, 'owner filter: sales 100');
select is((public.analytics_month(current_setting('t.m'), 'customer') ->> 'sales')::numeric, 330.00, 'customer filter: sales include the delivery charge');
select is(jsonb_array_length(public.analytics_month(current_setting('t.m')) -> 'by_source'), 2, 'by_source lists both sources');
select is(jsonb_array_length(public.analytics_month(current_setting('t.m'), 'owner') -> 'by_source'), 1, 'by_source follows the filter');
select throws_ok($$select public.analytics_month('2026-01', 'robot')$$, '22023', null, 'an unknown source is refused');

select is((select count(*)::int from public.export_orders_csv_rows(current_setting('t.m'))), 2, 'export: both orders');
select is((select source from public.export_orders_csv_rows(current_setting('t.m'), 'customer')), 'customer', 'export filter: customer only');
select is((select fulfilment || '/' || payment_method || '/' || delivery_fee::text from public.export_orders_csv_rows(current_setting('t.m'), 'customer')), 'delivery/cod/30.00', 'export carries fulfilment, method and delivery fee');

-- a plan without Pro cannot export
reset role;
update public.subscriptions set tier = 'base' where owner_id = 'a0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$select * from public.export_orders_csv_rows('2026-01')$$, 'SB411', null, 'export stays Pro-only');
select throws_ok($$select public.analytics_month('2020-01', 'owner')$$, 'SB411', null, 'other months stay Pro-only');

select * from finish();
rollback;
