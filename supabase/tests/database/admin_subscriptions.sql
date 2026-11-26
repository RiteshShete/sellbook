-- Admin: list shops and set a plan by hand. Only a platform admin may; a shop cannot touch plans.
-- Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'shop@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'buyer@example.test'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.test');
insert into public.platform_admins (user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- a customer-only account: never listed as a shop
insert into public.customer_profiles (user_id, name, phone) values ('33333333-3333-3333-3333-333333333333', 'Buyer', '9000000099');

-- ---- 1. A shop cannot list or change plans ---------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.admin_list_shops()$$, '42501', 'not allowed', 'shop cannot list shops');
select throws_ok($$select public.admin_set_subscription('11111111-1111-1111-1111-111111111111', 'pro', 30, true)$$,
  '42501', 'not allowed', 'shop cannot upgrade itself');
select throws_ok($$update public.subscriptions set tier = 'pro'$$, '42501', null, 'shop cannot write subscriptions directly');

-- ---- 2. Admin lists --------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), 1, 'admin sees the shop');
select is((select tier from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), 'trial', 'a new account starts on the trial');
select is((select status from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), 'trial', 'status is trial');
select is((select count(*)::int from public.admin_list_shops() where owner_id = '33333333-3333-3333-3333-333333333333'), 0, 'a customer-only account is not listed');
select is((select count(*)::int from public.admin_list_shops('shop@example') where owner_id = '11111111-1111-1111-1111-111111111111'), 1, 'search by email finds it');
select is((select count(*)::int from public.admin_list_shops('nobody-here-xyz')), 0, 'search with no match is empty');

-- ---- 3. Admin sets plans ---------------------------------------------------------------------------
select lives_ok($$select public.admin_set_subscription('11111111-1111-1111-1111-111111111111', 'pro', 30, true)$$, 'admin sets lifetime Pro');
select is((select tier from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), 'pro', 'tier is pro');
select is((select lifetime from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), true, 'marked lifetime');
select is((select status from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), 'active', 'status is active');

select lives_ok($$select public.admin_set_subscription('11111111-1111-1111-1111-111111111111', 'base', 30)$$, 'admin sets Base for 30 days');
select is((select lifetime from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), false, 'no longer lifetime');
select ok((select ends_at from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111')
  between now() + interval '29 days' and now() + interval '31 days', 'ends in about 30 days');

select lives_ok($$select public.admin_set_subscription('11111111-1111-1111-1111-111111111111', 'pro', 0)$$, 'admin ends the plan now');
select is((select status from public.admin_list_shops() where owner_id = '11111111-1111-1111-1111-111111111111'), 'grace_readonly', 'an ended plan is read-only');

-- ---- 4. Bad input is refused -----------------------------------------------------------------------
select throws_ok($$select public.admin_set_subscription('11111111-1111-1111-1111-111111111111', 'gold', 30)$$, '22023', 'unknown plan', 'unknown plan is refused');
select throws_ok($$select public.admin_set_subscription('11111111-1111-1111-1111-111111111111', 'pro', 99999)$$, '22023', null, 'too many days is refused');
select throws_ok($$select public.admin_set_subscription(gen_random_uuid(), 'pro', 30)$$, 'P0002', 'shop not found', 'unknown shop is refused');

select * from finish();
rollback;
