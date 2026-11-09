-- Dynamic UPI QR settings columns: defaults, length guard, still owner-only.
-- Rolled back. Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner@example.test');
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'other@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select public.init_settings();

select is((select use_dynamic_qr from public.settings), true, 'a new settings row has the dynamic QR on');
select is((select payee_name from public.settings), null, 'the payee name starts empty');

update public.settings set payee_name = 'आशा केक्स', upi_id = 'asha@okicici', use_dynamic_qr = false;
select is((select payee_name from public.settings), 'आशा केक्स', 'a Devanagari payee name is stored as is');
select is((select use_dynamic_qr from public.settings), false, 'the switch can be turned off');

select throws_ok(
  $$update public.settings set payee_name = repeat('x', 51)$$,
  '23514',
  null,
  'a payee name over 50 characters is rejected'
);

-- Another owner cannot see or change these settings.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.settings), 0, 'another owner sees none of them');

select * from finish();
rollback;
