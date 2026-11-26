-- C3: history, pruning, data export and analytics with customer orders (the columns and reasons the storefront added).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a@example.test', now()),
  ('c1000000-0000-4000-8000-000000000003', 'c1@example.test', now());
insert into public.shop_invites (code, created_by, expires_at) values ('HISTAAAAAA', 'a0000000-0000-4000-8000-000000000001', now() + interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_shop('HISTAAAAAA', 'hist-shop', 'Hist Shop');
reset role;
update public.subscriptions set tier = 'pro', ends_at = '2099-01-01' where owner_id = 'a0000000-0000-4000-8000-000000000001';
update public.shops set is_published = true, lead_time_hours = 0, delivery_mode = 'both', pay_upi = true, pay_cod = true where owner_id = 'a0000000-0000-4000-8000-000000000001';
update public.settings set upi_id = 'shop@upi', payee_name = 'Hist Shop' where owner_id = 'a0000000-0000-4000-8000-000000000001';
insert into public.products (id, owner_id, name) values ('00000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-000000000001', 'Cake');
insert into public.variants (id, owner_id, product_id, name, price) values
  ('00000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'Std', 250);

-- customer: order (UPI), claim, owner confirms and verifies
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select public.register_customer('Asha', '9876543210');
select set_config('t.order', (public.place_order(jsonb_build_object('slug', 'hist-shop', 'items', jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000000b2', 'qty', 2)),
  'fulfilment', 'pickup', 'payment_method', 'upi', 'requested_for', (now() at time zone 'Asia/Kolkata')::date, 'idempotency_key', gen_random_uuid())) ->> 'order_id'), true);
select public.claim_payment(current_setting('t.order')::uuid, '123456789012');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.confirm_order(current_setting('t.order')::uuid, null, (select version_no from public.orders where id = current_setting('t.order')::uuid));
select public.verify_payment(current_setting('t.order')::uuid, (select version_no from public.orders where id = current_setting('t.order')::uuid));

-- version list: every step is labelled and readable, none breaks the reader
select cmp_ok((select count(*)::int from public.list_order_versions(current_setting('t.order')::uuid)), '>=', 4, 'the list holds the placed, claimed, confirmed and verified steps');
select is((select count(*)::int from public.list_order_versions(current_setting('t.order')::uuid) where coalesce(summary, '') = ''), 0, 'every step has a readable summary');
select is((select (public.order_version_state(current_setting('t.order')::uuid, max(version_no)) ->> 'payment_claim_status') from public.order_versions where order_id = current_setting('t.order')::uuid), 'verified', 'the latest version rebuilds to the current claim state');

-- pruning keeps the first and the newest steps and the state still rebuilds
reset role;
select cmp_ok(public.prune_order_history(1, 0), '>=', 0, 'pruning runs on customer orders');
select is((select count(*)::int from public.order_versions where order_id = current_setting('t.order')::uuid and version_no = (select min(version_no) from public.order_versions where order_id = current_setting('t.order')::uuid)), 1, 'the first version is kept');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select (public.order_version_state(current_setting('t.order')::uuid, max(version_no)) ->> 'confirmation_status') from public.order_versions where order_id = current_setting('t.order')::uuid), 'confirmed', 'the newest version still rebuilds after pruning');

-- data export carries the storefront columns
select is((public.export_my_data() -> 'orders' -> 0 ->> 'source'), 'customer', 'export: source');
select is((public.export_my_data() -> 'orders' -> 0 ->> 'payment_claim_status'), 'verified', 'export: payment claim status');
select is((public.export_my_data() -> 'orders' -> 0 ->> 'confirmation_status'), 'confirmed', 'export: confirmation status');
select ok((public.export_my_data() -> 'orders' -> 0) ? 'delivery_fee', 'export: delivery fee');

-- a declined order counts nowhere in analytics
reset role;
select set_config('t.order2', (select id::text from public.orders limit 0), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('t.order2', (public.place_order(jsonb_build_object('slug', 'hist-shop', 'items', jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000000b2', 'qty', 1)),
  'fulfilment', 'pickup', 'payment_method', 'cod', 'requested_for', (now() at time zone 'Asia/Kolkata')::date, 'idempotency_key', gen_random_uuid())) ->> 'order_id'), true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.decline_order(current_setting('t.order2')::uuid, 'Sold out', (select version_no from public.orders where id = current_setting('t.order2')::uuid));
select is((public.analytics_month(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM')) ->> 'orders')::int, 0, 'a declined order is not a sale');
select is((public.analytics_month(to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM')) ->> 'outstanding_count')::int, 0, 'and not an outstanding payment');

select * from finish();
rollback;
