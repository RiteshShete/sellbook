-- Customer self-service: edit profile, edit and delete saved addresses.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('c1000000-0000-4000-8000-000000000003', 'c1@example.test', now()),
  ('c2000000-0000-4000-8000-000000000004', 'c2@example.test', now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select public.register_customer('Asha', '9876543210');
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select public.register_customer('Ravi', '9123456780');

select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((public.update_my_profile('Asha Patil', '9876500000') ->> 'name'), 'Asha Patil', 'name and number can be changed');
select is((select phone from public.customer_profiles), '919876500000', 'the number is stored with the country code');
select throws_ok($$select public.update_my_profile('Asha', '9123456780')$$, 'SB427', 'this mobile number is already registered', 'another customer''s number is refused');
select throws_ok($$select public.update_my_profile('', '9876500000')$$, 'SB427', null, 'an empty name is refused');

-- addresses: add, edit, delete, never someone else's
select lives_ok($$select public.upsert_address('{"name":"Asha","phone":"919876500000","line1":"12 Market Rd","city":"Pune","pincode":"411001"}'::jsonb)$$, 'add an address');
select set_config('t.addr', (select id::text from public.customer_addresses where deleted_at is null limit 1), true);
select is((public.upsert_address(jsonb_build_object('id', current_setting('t.addr'), 'name', 'Asha', 'phone', '919876500000', 'line1', '14 New Rd', 'city', 'Pune', 'pincode', '411001'))).line1, '14 New Rd', 'edit it');
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$select public.delete_address(current_setting('t.addr')::uuid)$$, 'P0002', null, 'another customer cannot delete it');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok($$select public.delete_address(current_setting('t.addr')::uuid)$$, 'the owner of the address deletes it');
select is((select count(*)::int from public.customer_addresses where deleted_at is null), 0, 'it no longer shows in the list');

select * from finish();
rollback;
