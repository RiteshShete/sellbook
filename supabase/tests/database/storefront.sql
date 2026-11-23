-- Storefront S1: shops, customers, customer orders, payment claims, security matrix (STOREFRONT_PLAN T1-T25) and the
-- pricing cases C1-C10 of Appendix C. Everything is rolled back. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(154);

select set_config('storage.allow_delete_query', 'true', true);

-- ---- Temp helpers (created first, as the DB owner, usable by every test role) -------------------------------------
create temp table t (k text primary key, id uuid);
create temp table keys (k text primary key, id uuid default gen_random_uuid());
grant all on t, keys to public;

-- ---- Fixtures -------------------------------------------------------------------------------------------
-- A = owner of the main shop, B = owner of a pickup-only shop, C1 / C2 = customers, ADM = platform admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a@example.test', now()),
  ('b0000000-0000-4000-8000-000000000002', 'b@example.test', now()),
  ('c1000000-0000-4000-8000-000000000003', 'c1@example.test', now()),
  ('c2000000-0000-4000-8000-000000000004', 'c2@example.test', now()),
  ('ad000000-0000-4000-8000-000000000005', 'adm@example.test', now());
insert into public.platform_admins (user_id) values ('ad000000-0000-4000-8000-000000000005');
update public.subscriptions set tier = 'pro', ends_at = '2099-01-01' where owner_id in
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
insert into public.shop_invites (code, created_by, expires_at) values
  ('AAAAAAAAAA', 'ad000000-0000-4000-8000-000000000005', now() + interval '1 day'),
  ('BBBBBBBBBB', 'ad000000-0000-4000-8000-000000000005', now() + interval '1 day'),
  ('EEEEEEEEEE', 'ad000000-0000-4000-8000-000000000005', now() - interval '1 day');

-- ---- T1 / T3: anon sees no table and can run only the public storefront --------------------------------------
set local role anon;
select throws_ok('select count(*) from public.shops', '42501', null, 'T1 anon cannot read shops');
select throws_ok('select count(*) from public.customer_profiles', '42501', null, 'T1 anon cannot read customer_profiles');
select throws_ok('select count(*) from public.customer_addresses', '42501', null, 'T1 anon cannot read customer_addresses');
select throws_ok('select count(*) from public.shop_customers', '42501', null, 'T1 anon cannot read shop_customers');
select throws_ok('select count(*) from public.shop_invites', '42501', null, 'T1 anon cannot read shop_invites');
select throws_ok('select count(*) from public.orders', '42501', null, 'T1 anon cannot read orders');
select throws_ok('select count(*) from public.products', '42501', null, 'T1 anon cannot read products');
select throws_ok($$select public.place_order('{}'::jsonb)$$, '42501', null, 'T2 anon cannot place an order');
select throws_ok($$select public.create_shop('x', 'y', 'z')$$, '42501', null, 'T2 anon cannot create a shop');
select throws_ok($$select public.my_customers()$$, '42501', null, 'T2 anon cannot list customers');
select throws_ok($$select public.effective_price(null::public.variants)$$, '42501', null, 'T2 anon cannot call effective_price');
reset role;
select is((select array_agg(distinct routine_schema || '.' || routine_name order by routine_schema || '.' || routine_name)
             from information_schema.routine_privileges
            where grantee = 'anon' and routine_schema in ('public', 'app_private') and privilege_type = 'EXECUTE'),
  array['app_private.slug_available', 'app_private.storefront_catalog', 'app_private.storefront_shop',
        'public.ping', 'public.slug_available', 'public.storefront_catalog', 'public.storefront_shop'],
  'T3 the only functions anon can run');

-- ---- T15 / T16: shop creation, invite, slug ----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.create_shop('', 'a-foods', 'A Foods')$$, 'SB428', null, 'T15 missing invite');
select throws_ok($$select public.create_shop('EEEEEEEEEE', 'a-foods', 'A Foods')$$, 'SB428', null, 'T15 expired invite');
select throws_ok($$select public.create_shop('AAAAAAAAAA', 'orders', 'A Foods')$$, 'SB427', null, 'T16 reserved slug refused');
select throws_ok($$select public.create_shop('AAAAAAAAAA', 'A', 'A Foods')$$, 'SB427', null, 'T16 slug too short / not lower-case');
select is((select public.slug_available('a-foods')), true, 'T16 a free slug is available');
select is((select public.slug_available('login')), false, 'T16 reserved word is not available');
select is((select public.slug_available(null)), false, 'T16 null is not available');
select lives_ok($$select public.create_shop('AAAAAAAAAA', 'a-foods', 'A Foods')$$, 'T15 valid invite creates the shop');
select throws_ok($$select public.create_shop('BBBBBBBBBB', 'a-two', 'A Two')$$, 'SB427', null, 'one shop per owner');
select is((select public.slug_available('a-foods')), false, 'T16 taken slug is not available');

-- B creates the other shop; the first invite cannot be reused
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.create_shop('AAAAAAAAAA', 'b-sweets', 'B Sweets')$$, 'SB428', null, 'T15 used invite');
select lives_ok($$select public.create_shop('BBBBBBBBBB', 'b-sweets', 'B Sweets')$$, 'B creates a shop');

-- owner A fills the shop: catalogue, offer rules, payment
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into t select 'snacks', (public.upsert_product('{"name":"Snacks","variants":[
  {"name":"A","price":"150","cost_price":"90"},{"name":"B","price":"100"},{"name":"Big","price":"1500"}]}'::jsonb) ->> 'id')::uuid;
insert into t select 'vA', id from public.variants where name = 'A';
insert into t select 'vB', id from public.variants where name = 'B';
insert into t select 'vBig', id from public.variants where name = 'Big';
update public.settings set shop_address = '12 Market Road', upi_id = 'afoods@upi', payee_name = 'A Foods';

select is((select (public.set_shop_published(true) -> 'missing')::text), '["whatsapp"]',
  'publish checklist lists exactly what is missing');
select lives_ok($$select public.update_shop('{"whatsapp":"9876543210","delivery_fee":40,"free_delivery_above":500,
  "min_order":200,"lead_time_hours":0,"delivery_mode":"both"}'::jsonb)$$, 'owner sets the shop rules');
select throws_ok($$select public.update_shop('{"upi_id":"x@y"}'::jsonb)$$, 'SB427', null, 'update_shop rejects unknown keys');
select throws_ok($$select public.update_shop('{"logo_path":"someone-else/logo.png"}'::jsonb)$$, 'SB427', null,
  'logo must be inside the shop folder');
select is((select public.set_shop_published(true) ->> 'published'), 'true', 'publish works once the checklist is clear');

-- B: pickup-only shop with a product, COD only
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into t select 'bprod', (public.upsert_product('{"name":"Laddu","variants":[{"name":"Box","price":"300"}]}'::jsonb) ->> 'id')::uuid;
insert into t select 'vBox', id from public.variants where name = 'Box';
update public.settings set shop_address = '1 Temple St';
select public.update_shop('{"whatsapp":"9123456780","delivery_mode":"pickup","pay_upi":false,"pay_cod":true,"lead_time_hours":0}'::jsonb);
select is((select public.set_shop_published(true) ->> 'published'), 'true', 'B publishes a pickup-only COD shop');

-- ---- T17: what the public can read ---------------------------------------------------------------------------
reset role;
set local role anon;
select is((select array(select jsonb_object_keys(public.storefront_shop('a-foods')) order by 1)),
  array['accepts_orders', 'banner_text', 'city', 'closed_message', 'delivery_fee', 'delivery_mode', 'delivery_note',
        'earliest_date', 'free_delivery_above', 'fssai_no', 'lead_time_hours', 'logo_path', 'min_order', 'name',
        'pay_cod', 'pay_upi', 'pickup_address', 'slug', 'tagline', 'whatsapp'],
  'T17 shop JSON has exactly the allow-listed keys (no upi_id, owner_id)');
select is((public.storefront_shop('A-Foods') ->> 'name'), 'A Foods', 'slug lookup is case-insensitive');
select is((public.storefront_shop('nope')), null, 'unknown slug looks like an unpublished shop');
select is((select array(select jsonb_object_keys(public.storefront_catalog('a-foods') -> 'products' -> 0) order by 1)),
  array['allergens', 'category_id', 'description', 'id', 'image_paths', 'ingredients', 'is_available', 'name',
        'nutrition', 'shelf_life', 'variants', 'veg_type'], 'T17 product JSON keys');
select is((select array(select jsonb_object_keys(public.storefront_catalog('a-foods') -> 'products' -> 0 -> 'variants' -> 0) order by 1)),
  array['effective_price', 'id', 'name', 'offer_ends_at', 'offer_label', 'offer_price', 'price', 'size_amount', 'size_unit'],
  'T17 variant JSON has no cost_price');
select is((select (public.storefront_catalog('a-foods')::text like '%cost%')), false, 'T17 the word cost never appears');

-- ---- T14: customers --------------------------------------------------------------------------------------------
reset role;
select is((select count(*)::int from public.subscriptions where owner_id = 'c1000000-0000-4000-8000-000000000003'), 1,
  'sign-up trigger gave the new user a trial (so every old fixture still works)');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.place_order('{}'::jsonb)$$, '42501', null, 'a user with no customer profile cannot order');
select lives_ok($$select public.register_customer('Asha Patil', '9876501234')$$, 'C1 registers');
reset role;
select is((select count(*)::int from public.subscriptions where owner_id = 'c1000000-0000-4000-8000-000000000003'), 0,
  'T14 a customer holds no subscription');
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.register_customer('', '9876501234')$$, 'SB427', null, 'name is required');
select throws_ok($$select public.register_customer('Dup', '9876501234')$$, 'SB427', null, 'a number already registered is refused');
select lives_ok($$select public.register_customer('Ravi Kale', '9876505678')$$, 'C2 registers');
select is((select public.my_context() ->> 'has_customer_profile'), 'true', 'my_context: customer profile');
select is((select public.my_context() ->> 'is_owner'), 'false', 'my_context: not an owner');

-- ---- T4 / T13: a customer cannot be an owner ---------------------------------------------------------------------
select is((select count(*)::int from public.orders), 0, 'T4 customer sees no orders');
select is((select count(*)::int from public.products), 0, 'T4 customer sees no products');
select is((select count(*)::int from public.settings), 0, 'T4 customer sees no settings');
select is((select count(*)::int from public.shop_customers), 0, 'T4 customer sees no shop_customers');
select throws_ok($$select public.init_settings()$$, '42501', null, 'T13 customer cannot init_settings');
-- denied by the plan guard (SB411: a customer has no plan) or by RLS (42501): both mean "denied"; the next check proves it
select throws_ok($$select public.upsert_product('{"name":"X","variants":[{"name":"v","price":"1"}]}'::jsonb)$$, null, null,
  'T13 customer cannot upsert_product');
select throws_ok($$select public.create_order('{"customer_name":"X"}'::jsonb)$$, null, null, 'T13 customer cannot create_order');
select throws_ok($$select public.confirm_order(gen_random_uuid(), null, 1)$$, '42501', null, 'T7 customer cannot confirm_order');
select throws_ok($$select public.verify_payment(gen_random_uuid(), 1)$$, '42501', null, 'T7 customer cannot verify_payment');
select throws_ok($$select public.my_customers()$$, '42501', null, 'customer cannot list customers');
select throws_ok($$select public.set_shop_published(true)$$, '42501', null, 'customer cannot publish');
reset role;
select is((select (select count(*) from public.settings where owner_id in ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000004'))
          + (select count(*) from public.products where owner_id in ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000004'))
          + (select count(*) from public.orders where owner_id in ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000004')))::int,
  0, 'T13 no settings, product or order row was created for a customer');

-- ---- T9 / T10 / T11 / T12: place_order guards ------------------------------------------------------------------------
create function public.zz_order_json(p_slug text, p_items text, p_fulf text default 'delivery', p_method text default 'upi',
                                   p_key uuid default gen_random_uuid(), p_date date default null, p_extra text default '')
returns jsonb language sql as $f$
  select format('{"slug":"%s","items":%s,"fulfilment":"%s","payment_method":"%s","idempotency_key":"%s","requested_for":"%s",
    "address":{"name":"Asha","phone":"9876501234","line1":"12 Market Road","city":"Pune","pincode":"411001"}%s}',
    p_slug, p_items, p_fulf, p_method, p_key, coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date), p_extra)::jsonb
$f$;
create function public.zz_line(p_variant text, p_qty int) returns text language sql as $f$
  select format('{"variant_id":"%s","qty":%s}', (select id from t where k = p_variant), p_qty)
$f$;

grant execute on function public.zz_order_json(text, text, text, text, uuid, date, text), public.zz_line(text, int) to public;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']', p_extra => ',"total":1')),
  'SB427', null, 'T9 a client-sent total is refused');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']', p_extra => ',"owner_id":"a0000000-0000-4000-8000-000000000001"')),
  'SB427', null, 'T9 a client-sent owner_id is refused');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods',
  format('[{"variant_id":"%s","qty":2,"price":1}]', (select id from t where k = 'vA')))),
  'SB427', null, 'T9 a client-sent line price is refused');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[{"variant_id":"x","qty":"two"}]')),
  'SB427', null, 'a malformed cart is refused cleanly');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vBox', 2) || ']')),
  'SB422', null, 'T10 a variant from another shop is refused');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('nope', '[' || public.zz_line('vA', 2) || ']')),
  'SB420', null, 'T12 unknown shop');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('b-sweets', '[' || public.zz_line('vBox', 2) || ']', 'delivery', 'cod')),
  'SB427', null, 'C10 delivery on a pickup-only shop');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('b-sweets', '[' || public.zz_line('vBox', 2) || ']', 'pickup', 'upi')),
  'SB427', null, 'a payment method the shop does not offer is refused');

-- ---- Appendix C: pricing (offers set and cleared by the owner between cases) -----------------------------------------
reset role;
create function public.zz_as_owner_a() returns void language sql as $f$
  select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true) $f$;
create function public.zz_as_c1() returns void language sql as $f$
  select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true) $f$;
create function public.zz_pricing(p_items text, p_fulf text default 'delivery')
returns jsonb language sql as $f$
  select public.place_order(public.zz_order_json('a-foods', p_items, p_fulf, 'upi') ) -> 'breakdown'
$f$;
-- cancel everything the customer has open so the open-order cap never interferes with the price cases
create function public.zz_clear_open() returns void language plpgsql as $f$
begin
  update public.orders set status = 'cancelled', cancelled_from = 'new' where status = 'new' and source = 'customer';
end $f$;

grant execute on function public.zz_as_owner_a(), public.zz_as_c1(), public.zz_pricing(text, text), public.zz_clear_open() to public;
reset role;
select public.zz_as_owner_a();
set local role authenticated;
select public.end_offers(null);
select public.zz_as_c1();
select is(public.zz_pricing('[' || public.zz_line('vA', 2) || ']'),
  '{"subtotal":300.00,"offer_savings":0.00,"delivery_fee":40.00,"total":340.00}'::jsonb, 'C1 2xA delivery = 340');
select is(public.zz_pricing('[' || public.zz_line('vA', 4) || ']'),
  '{"subtotal":600.00,"offer_savings":0.00,"delivery_fee":0.00,"total":600.00}'::jsonb, 'C3 4xA free delivery = 600');
select is(public.zz_pricing('[' || public.zz_line('vA', 2) || ']', 'pickup'),
  '{"subtotal":300.00,"offer_savings":0.00,"delivery_fee":0.00,"total":300.00}'::jsonb, 'C6 pickup = 300');
select is(public.zz_pricing('[' || public.zz_line('vB', 5) || ']'),
  '{"subtotal":500.00,"offer_savings":0.00,"delivery_fee":0.00,"total":500.00}'::jsonb, 'C7 threshold is inclusive');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 1) || ']')),
  'SB421', null, 'C5 below the minimum order');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vB', 51) || ']')),
  'SB427', null, 'C8 quantity above 50');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vBig', 50) || ']')),
  'SB427', null, 'C9 total above Rs 50,000');
reset role;
select public.zz_clear_open();
select public.zz_as_owner_a();
set local role authenticated;
select public.bulk_offer(format('{"variant_ids":["%s"],"percent_off":20,"label":"Diwali","starts_on":"%s","ends_on":"%s"}',
  (select id from t where k = 'vA'), (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date + 1)::jsonb);
select public.zz_as_c1();
select is(public.zz_pricing('[' || public.zz_line('vA', 2) || ']'),
  '{"subtotal":240.00,"offer_savings":60.00,"delivery_fee":40.00,"total":280.00}'::jsonb, 'C2 2xA with the offer = 280');
select is(public.zz_pricing('[' || public.zz_line('vA', 4) || ']'),
  '{"subtotal":480.00,"offer_savings":120.00,"delivery_fee":40.00,"total":520.00}'::jsonb, 'C4 the offer loses free delivery = 520');
select is((select public.storefront_catalog('a-foods') -> 'products' -> 0 -> 'variants' -> 0 ->> 'offer_label'), 'Diwali',
  'an active offer shows on the storefront');
reset role;
select public.zz_clear_open();

-- ---- T11 / T12: idempotency, caps, closed, blocked, dates ---------------------------------------------------------------
select public.zz_as_c1();
set local role authenticated;
insert into keys (k) values ('once');
select is((select public.place_order(public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']', p_key => (select id from keys where k = 'once')))
            ->> 'order_id') = (select public.place_order(public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']', p_key => (select id from keys where k = 'once')))
            ->> 'order_id'), true, 'T11 the same key returns the same order');
reset role;
select is((select count(*)::int from public.orders where idempotency_key = (select id from keys where k = 'once')), 1, 'T11 and only one order exists');
select public.zz_clear_open();

select public.zz_as_owner_a();
set local role authenticated;
select public.update_shop('{"lead_time_hours":48}'::jsonb);
select public.zz_as_c1();
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')),
  'SB423', null, 'T12 before the lead time');
select public.zz_as_owner_a();
select public.update_shop('{"lead_time_hours":0}'::jsonb);
select public.zz_as_c1();
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']',
  p_date => (now() at time zone 'Asia/Kolkata')::date + 31)), 'SB423', null, 'T12 more than 30 days ahead');

select public.zz_as_owner_a();
select public.update_shop('{"accepts_orders":false}'::jsonb);
select public.zz_as_c1();
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')),
  'SB420', null, 'T12 a closed shop');
select public.zz_as_owner_a();
select public.update_shop('{"accepts_orders":true}'::jsonb);
select public.set_shop_published(false);
select public.zz_as_c1();
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')),
  'SB420', null, 'T12 an unpublished shop');
select public.zz_as_owner_a();
select public.set_shop_published(true);

-- sixth open order, then blocked
select public.zz_as_c1();
select lives_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')), 'open order 1');
select lives_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')), 'open order 2');
select lives_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')), 'open order 3');
select lives_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')), 'open order 4');
select lives_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')), 'open order 5');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')),
  'SB424', null, 'T12 the sixth open order');
reset role;
select public.zz_clear_open();
select public.zz_as_owner_a();
set local role authenticated;
select is((select jsonb_array_length(public.my_customers())), 1, 'T22 the shop has one customer');
select is((select (public.my_customers() -> 0 ->> 'order_count')::int), (select count(*)::int from public.orders where customer_user_id = 'c1000000-0000-4000-8000-000000000003'),
  'T22 the order count matches');
select lives_ok(format($$select public.set_customer_block(%L, true)$$, 'c1000000-0000-4000-8000-000000000003'), 'owner blocks C1');
select public.zz_as_c1();
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')),
  'SB426', null, 'T12 a blocked customer');
select public.zz_as_owner_a();
select public.set_customer_block('c1000000-0000-4000-8000-000000000003', false);

-- ---- Order lifecycle: confirm, B11, claim, verify, decline, reject, cancel ------------------------------------------------
select public.zz_as_c1();
insert into t select 'o1', (public.place_order(public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')) ->> 'order_id')::uuid;
select is((select public.customer_order_get((select id from t where k = 'o1')) -> 'payment' ->> 'upi_id'), 'afoods@upi',
  'T18 an unpaid UPI order shows the shop UPI ID');
select is((select public.customer_order_get((select id from t where k = 'o1')) ->> 'confirmation_status'), 'pending', 'a new customer order awaits confirmation');

select public.zz_as_owner_a();
select throws_ok(format($$select public.set_order_status(%L, 'ready', 1)$$, (select id from t where k = 'o1')), 'SB425', null,
  'B11 an unconfirmed customer order cannot move to ready');
select is((public.prep_list() ->> 'orders')::int, 0, 'T24 a pending customer order is not on the prep list');
select is((select (public.confirm_order((select id from t where k = 'o1'), 'Will prepare', 1)).confirmation_status), 'confirmed', 'owner confirms');
select throws_ok(format($$select public.confirm_order(%L, null, 2)$$, (select id from t where k = 'o1')), 'SB425', null, 'cannot confirm twice');
select is((public.prep_list() ->> 'orders')::int, 1, 'T24 a confirmed order is on the prep list');

select public.zz_as_c1();
select throws_ok(format($$select public.claim_payment(%L, '12345')$$, (select id from t where k = 'o1')), 'SB427', null, 'a UTR must be 12 digits');
select lives_ok(format($$select public.claim_payment(%L, '123456789012')$$, (select id from t where k = 'o1')), 'customer says "I have paid"');
select throws_ok(format($$select public.claim_payment(%L, null)$$, (select id from t where k = 'o1')), 'SB425', null, 'cannot claim twice');
select throws_ok(format($$select public.cancel_my_order(%L)$$, (select id from t where k = 'o1')), 'SB425', null, 'cannot cancel after a claim');

-- T5 / T6: customer C2 cannot see or touch C1's order
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(format($$select public.customer_order_get(%L)$$, (select id from t where k = 'o1')), 'P0002', 'order not found', 'T5 another customer gets "not found"');
select throws_ok($$select public.customer_order_get(gen_random_uuid())$$, 'P0002', 'order not found', 'T5 a missing order gives the same answer');
select throws_ok(format($$select public.claim_payment(%L, null)$$, (select id from t where k = 'o1')), 'P0002', null, 'T6 cannot claim another customer''s order');

-- T8: owner B cannot touch A's order
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(format($$select public.verify_payment(%L, 3)$$, (select id from t where k = 'o1')), 'P0002', null, 'T8 another shop cannot verify');
select throws_ok(format($$select public.confirm_order(%L, null, 3)$$, (select id from t where k = 'o1')), 'P0002', null, 'T8 another shop cannot confirm');
select is((select jsonb_array_length(public.my_customers())), 0, 'T22 another shop sees none of these customers');

select public.zz_as_owner_a();
select throws_ok(format($$select public.verify_payment(%L, 1)$$, (select id from t where k = 'o1')), 'SB409', null, 'a stale version is refused');
select is((public.verify_payment((select id from t where k = 'o1'), 3) ->> 'duplicate_utr_order_no'), null, 'verify: no duplicate UTR');
select is((select payment_status::text || '/' || payment_mode::text || '/' || payment_claim_status
             from public.orders where id = (select id from t where k = 'o1')), 'paid/online/verified', 'verified = paid online');
select is((select (public.set_order_status((select id from t where k = 'o1'), 'ready', 4)).status::text), 'ready', 'a confirmed order can move to ready');
select public.zz_as_c1();
select is((select public.customer_order_get((select id from t where k = 'o1')) -> 'payment' ->> 'upi_id'), null,
  'T18 a paid order no longer shows the UPI ID');

-- T21: rollback restores confirmation and payment together
select public.zz_as_owner_a();
select lives_ok(format($$select public.rollback_order(%L, 1, 5)$$, (select id from t where k = 'o1')), 'T21 rollback to version 1');
select is((select confirmation_status || '/' || payment_status::text || '/' || payment_claim_status || '/' || status::text
             from public.orders where id = (select id from t where k = 'o1')), 'pending/pending/none/new',
  'T21 rollback restored confirmation, payment and claim as one state');
select is((select count(*)::int from public.order_items where order_id = (select id from t where k = 'o1') and list_price = 150 and unit_price = 120),
  1, 'T21 the offer snapshot (list price, unit price) survives a rollback');
select is((select total from public.orders where id = (select id from t where k = 'o1')), 280.00::numeric, 'T21 the total (with delivery fee) is unchanged');

-- decline, reject, resubmit limit, COD switch, customer cancel
select public.zz_as_c1();
select lives_ok(format($$select public.claim_payment(%L, null)$$, (select id from t where k = 'o1')), 'claim again after rollback');
select public.zz_as_owner_a();
select is((public.reject_payment((select id from t where k = 'o1'), 'Not in my account', 7) ->> 'payment_claim_status'), 'rejected', 'owner rejects the claim');
select public.zz_as_c1();
select lives_ok(format($$select public.claim_payment(%L, null)$$, (select id from t where k = 'o1')), 'customer tries again');
select public.zz_as_owner_a();
select public.reject_payment((select id from t where k = 'o1'), 'Still nothing', 9);
select public.zz_as_c1();
select lives_ok(format($$select public.claim_payment(%L, null)$$, (select id from t where k = 'o1')), 'the third claim is still allowed');
select public.zz_as_owner_a();
select public.reject_payment((select id from t where k = 'o1'), 'Nope', 11);
select public.zz_as_c1();
select throws_ok(format($$select public.claim_payment(%L, null)$$, (select id from t where k = 'o1')), 'SB425', null,
  'a fourth claim is refused (at most 3 per order)');
select lives_ok(format($$select public.switch_to_cod(%L)$$, (select id from t where k = 'o1')), 'customer switches to pay on delivery');
select is((select (public.customer_order_get((select id from t where k = 'o1')) -> 'payment' ->> 'method') || '/'
                  || (public.customer_order_get((select id from t where k = 'o1')) ->> 'payment_claim_status')), 'cod/none',
  'switching to COD clears the claim');

insert into t select 'o2', (public.place_order(public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')) ->> 'order_id')::uuid;
select lives_ok(format($$select public.cancel_my_order(%L)$$, (select id from t where k = 'o2')), 'customer cancels while pending');
insert into t select 'o3', (public.place_order(public.zz_order_json('a-foods', '[' || public.zz_line('vA', 2) || ']')) ->> 'order_id')::uuid;
select public.zz_as_owner_a();
select throws_ok(format($$select public.decline_order(%L, '', 1)$$, (select id from t where k = 'o3')), 'SB427', null, 'a decline needs a reason');
select is((public.decline_order((select id from t where k = 'o3'), 'Out of stock', 1) ->> 'refund_needed'), 'false', 'declining an unpaid order needs no refund');
select is((select status::text || '/' || confirmation_status from public.orders where id = (select id from t where k = 'o3')), 'cancelled/declined',
  'a declined order is cancelled');

-- ---- T19: plan limits judge the SHOP, and customers never see plan details -------------------------------------------
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.plan_limits set orders_limit = 1 where tier = 'trial';
update public.subscriptions set tier = 'trial', ends_at = now() + interval '10 days' where owner_id = 'b0000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('b-sweets', '[' || public.zz_line('vBox', 1) || ']', 'pickup', 'cod')),
  'T19 a customer order succeeds for a shop within its plan');
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('b-sweets', '[' || public.zz_line('vBox', 1) || ']', 'pickup', 'cod')),
  'SB420', 'this shop cannot take orders right now', 'T19 the shop''s order limit reads as "closed", with no plan details');
reset role;
update public.subscriptions set ends_at = now() - interval '100 days' where owner_id = 'b0000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$select public.place_order(%L::jsonb)$$, public.zz_order_json('b-sweets', '[' || public.zz_line('vBox', 1) || ']', 'pickup', 'cod')),
  'SB420', null, 'T19 a locked shop cannot take orders');
select is((public.storefront_shop('b-sweets') ->> 'accepts_orders'), 'false', 'a shop with an ended plan looks closed');
reset role;
select set_config('request.jwt.claims', '{}', true);
select is((select count(*)::int from public.orders where owner_id = 'b0000000-0000-4000-8000-000000000002' and confirmation_status = 'declined'), 0,
  'no declined orders at shop B');
update public.orders set confirmation_status = 'declined', status = 'cancelled', cancelled_from = 'new'
 where owner_id = 'b0000000-0000-4000-8000-000000000002';
select is(app_private.orders_used('total', 'b0000000-0000-4000-8000-000000000002'), 0, 'D12 declined orders do not count toward the quota');

-- ---- T20: storage ------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('catalog', 'c1000000-0000-4000-8000-000000000003/x.webp')$$,
  '42501', null, 'T20 a customer cannot upload to the catalog');
select public.zz_as_owner_a();
select lives_ok($$insert into storage.objects (bucket_id, name) values ('catalog', 'a0000000-0000-4000-8000-000000000001/p/x.webp')$$,
  'T20 the owner uploads to their own folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('catalog', 'b0000000-0000-4000-8000-000000000002/p/x.webp')$$,
  '42501', null, 'T20 an owner cannot write into another shop''s folder');
select throws_ok($$update public.products set image_paths = array['b0000000-0000-4000-8000-000000000002/p/x.webp']$$,
  '22023', null, 'T20 a product cannot point at another shop''s picture');

-- ---- T16 / T23 / T25: slugs, offer windows, back-fill ------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$update public.shops set slug = 'a-renamed' where owner_id = 'a0000000-0000-4000-8000-000000000001'$$, '22023', null,
  'T16 the slug is locked once published');
select throws_ok($$insert into public.shops (owner_id, slug) values ('c2000000-0000-4000-8000-000000000004', 'admin')$$, '22023', null,
  'T16 a reserved word is refused by the table too');
select throws_ok($$insert into public.shops (owner_id, slug) values ('c2000000-0000-4000-8000-000000000004', 'a-foods')$$, '23505', null,
  'T16 slugs are unique');
select is(app_private.make_slug('Orders', 'c2000000-0000-4000-8000-000000000004'), 'shop-c20000', 'T25 a reserved name gets a generated slug');
select is(app_private.make_slug('A Foods', 'c2000000-0000-4000-8000-000000000004'), 'a-foods-2', 'T25 a taken name gets a number');
select is((select count(*)::int from public.settings s where not exists (select 1 from public.shops x where x.owner_id = s.owner_id)), 0,
  'T25 every owner with settings has a shop, so re-running the back-fill (insert ... where not exists) adds nothing');

update public.variants set offer_price = 120, offer_starts_at = '2026-11-23T18:30:00Z', offer_ends_at = '2026-11-25T18:30:00Z'
 where id = (select id from t where k = 'vA');
select is(public.effective_price((select v from public.variants v where v.id = (select id from t where k = 'vA')), '2026-11-23T18:29:59Z'), 150.00::numeric, 'T23 23 Nov 23:59:59 IST = normal');
select is(public.effective_price((select v from public.variants v where v.id = (select id from t where k = 'vA')), '2026-11-23T18:30:00Z'), 120.00::numeric, 'T23 24 Nov 00:00 IST = offer');
select is(public.effective_price((select v from public.variants v where v.id = (select id from t where k = 'vA')), '2026-11-25T18:29:59Z'), 120.00::numeric, 'T23 25 Nov 23:59:59 IST = offer');
select is(public.effective_price((select v from public.variants v where v.id = (select id from t where k = 'vA')), '2026-11-25T18:30:00Z'), 150.00::numeric, 'T23 26 Nov 00:00 IST = normal');
select throws_ok($$update public.variants set offer_price = 150 where name = 'A' and owner_id = 'a0000000-0000-4000-8000-000000000001'$$, '23514', null,
  'an offer at the normal price is refused');
select public.zz_as_owner_a();
set local role authenticated;
select public.bulk_offer(format('{"variant_ids":["%s"],"amount_off":30,"starts_on":"2026-11-24","ends_on":"2026-11-25"}', (select id from t where k = 'vA'))::jsonb);
select is((select offer_starts_at from public.variants where id = (select id from t where k = 'vA')), '2026-11-23T18:30:00Z'::timestamptz,
  'bulk_offer stores IST midnight for the start date');
select is((select offer_ends_at from public.variants where id = (select id from t where k = 'vA')), '2026-11-25T18:30:00Z'::timestamptz,
  'bulk_offer stores the next IST midnight (exclusive) for the end date');
select throws_ok(format($$select public.bulk_offer('{"variant_ids":["%s"],"amount_off":150,"starts_on":"2026-11-24","ends_on":"2026-11-25"}'::jsonb)$$,
  (select id from t where k = 'vA')), 'SB427', null, 'an offer that is not below the price is refused');

-- ---- Platform: invites -------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.admin_create_invite('x')$$, '42501', null, 'a shop owner cannot create invites');
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select matches((select public.admin_create_invite('pilot')), '^[a-f0-9]{10}$', 'an admin gets a 10-character invite code');

select * from finish();
rollback;
