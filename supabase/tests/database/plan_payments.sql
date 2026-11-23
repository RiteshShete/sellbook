-- Plans phase 3: payment requests and admin approval. A shop can only ask; only a platform admin can
-- change a plan. Everything is rolled back. "system" = no JWT (auth.uid() is null).
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'shop@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.test');
insert into public.platform_admins (user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ---- 1. A shop is not an admin and cannot touch the tables ----------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(public.is_admin(), false, 'a shop is not an admin');
select throws_ok($$select * from public.admin_list_requests()$$, '42501', 'not allowed', 'shop cannot list requests');
select throws_ok($$select public.admin_decide_request(gen_random_uuid(), true)$$, '42501', 'not allowed', 'shop cannot approve');
select throws_ok($$select public.admin_set_config('upi_id', 'thief@okbank')$$, '42501', 'not allowed', 'shop cannot change where money goes');
select throws_ok($$select count(*) from public.platform_admins$$, '42501', null, 'shop cannot read the admin list');
select throws_ok($$insert into public.platform_admins values (auth.uid())$$, '42501', null, 'shop cannot make itself admin');
select throws_ok($$insert into public.subscription_requests (owner_id, tier, amount_paise, ref_code, status)
  values (auth.uid(), 'pro', 1, 'x', 'approved')$$, '42501', null, 'shop cannot insert a request directly');
select throws_ok($$update public.subscription_requests set status = 'approved'$$, '42501', null, 'shop cannot edit a request');
select throws_ok($$insert into public.platform_config values ('upi_id', 'thief@okbank')$$, '42501', null, 'shop cannot write config');

-- ---- 2. Asking for a plan ----------------------------------------------------------------------
select throws_ok($$select public.request_subscription('trial')$$, '22023', 'choose the Base or the Pro plan', 'only base or pro can be requested');
select throws_ok($$select public.request_subscription('base', 'bad utr!')$$, '22023', null, 'a malformed reference is refused');

create temp table t (k text primary key, id uuid);
-- (f()).col inside BETWEEN would call f twice, so decisions are stored first.
create temp table ends (k text primary key, at timestamptz);
insert into t select 'r1', (public.request_subscription('base', ' UTR12345678 ')).id;

select is((select status from public.subscription_requests where id = (select id from t where k = 'r1')), 'pending', 'request is pending');
select is((select amount_paise from public.subscription_requests where id = (select id from t where k = 'r1')), 10000, 'amount comes from the plan, not the caller');
select is((select utr from public.subscription_requests where id = (select id from t where k = 'r1')), 'UTR12345678', 'reference is trimmed');
select matches((select ref_code from public.subscription_requests where id = (select id from t where k = 'r1')), '^SB-[0-9A-F]{8}$', 'reference code looks like SB-1A2B3C4D');
select is(public.my_plan() ->> 'pay_ref', (select ref_code from public.subscription_requests where id = (select id from t where k = 'r1')), 'my_plan shows the same reference');
select is(public.my_plan() -> 'request' ->> 'status', 'pending', 'my_plan shows the pending request');
select is(public.my_plan() ->> 'tier', 'trial', 'asking does not change the plan');
select throws_ok($$select public.request_subscription('pro')$$, 'SB411', 'a payment is already waiting for approval', 'one open request per shop');

-- the other shop sees nothing of it
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.subscription_requests), 0, 'another shop cannot see the request');
select isnt(public.my_plan() ->> 'pay_ref', (select ref_code from t, public.subscription_requests r where false), 'reference is per shop');

-- ---- 3. Admin approves ------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

select is(public.is_admin(), true, 'the admin is an admin');
-- (filtered to this test's shop: the admin sees every shop, and a database may already hold requests)
select is((select count(*)::int from public.admin_list_requests() where owner_id = '11111111-1111-1111-1111-111111111111'), 1, 'admin sees the pending request');
select is((select email from public.admin_list_requests() where owner_id = '11111111-1111-1111-1111-111111111111'), 'shop@example.test', 'with the shop email');
select throws_ok(format($$select public.admin_decide_request(%L, false)$$, (select id from t where k = 'r1')), '22023', null, 'reject needs a reason');
select lives_ok($$select public.admin_set_config('upi_id', 'platform@okbank')$$, 'admin sets the UPI ID');
select lives_ok($$select public.admin_set_config('payee_name', 'Sellbook')$$, 'admin sets the payee name');
select throws_ok($$select public.admin_set_config('upi_id', 'not a upi id')$$, '22023', 'that is not a valid UPI ID', 'a bad UPI ID is refused');
select throws_ok($$select public.admin_set_config('anything', 'x')$$, '22023', null, 'unknown setting is refused');
select is((public.admin_decide_request((select id from t where k = 'r1'), true)).status, 'approved', 'admin approves');
select throws_ok(format($$select public.admin_decide_request(%L, true)$$, (select id from t where k = 'r1')), '22023', 'this request was already approved', 'a second tap cannot approve twice');

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() ->> 'tier', 'base', 'approval puts the shop on Base');
select is(public.my_plan() ->> 'status', 'active', 'and it is active');
select ok((public.my_plan() ->> 'ends_at')::timestamptz between now() + interval '29 days' and now() + interval '31 days', 'for 30 days from now (the trial remainder is not added)');
select is(public.my_plan() -> 'pay_to' ->> 'upi_id', 'platform@okbank', 'my_plan shows where to pay');

-- ---- 4. Early renewal stacks; an upgrade starts now; no downgrade while Pro runs --------------------
insert into t select 'r2', (public.request_subscription('base')).id;
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
insert into ends select 'r2', (public.admin_decide_request((select id from t where k = 'r2'), true)).resulting_ends_at;
select ok((select at from ends where k = 'r2') between now() + interval '59 days' and now() + interval '61 days',
  'renewing early extends from the current end (60 days)');

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
insert into t select 'r3', (public.request_subscription('pro')).id;
select is((select amount_paise from public.subscription_requests where id = (select id from t where k = 'r3')), 25000, 'Pro costs Rs 250');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
insert into ends select 'r3', (public.admin_decide_request((select id from t where k = 'r3'), true)).resulting_ends_at;
select ok((select at from ends where k = 'r3') between now() + interval '29 days' and now() + interval '31 days',
  'an upgrade starts today for 30 days');

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() ->> 'tier', 'pro', 'the shop is on Pro');
select throws_ok($$select public.request_subscription('base')$$, '22023', 'you are on Pro: you can choose Base when it ends', 'no downgrade while Pro runs');
select throws_ok($$select public.request_subscription('pro')$$, 'SB411', 'too many requests today: try again tomorrow', 'at most 3 requests in 24 hours');

-- ---- 5. Reject, cancel, stale ------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscription_requests set created_at = created_at - interval '3 days';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
insert into t select 'r4', (public.request_subscription('pro')).id;

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((public.admin_decide_request((select id from t where k = 'r4'), false, ' No payment found ')).status, 'rejected', 'admin rejects with a reason');
select is((select count(*)::int from public.admin_list_requests('rejected') where owner_id = '11111111-1111-1111-1111-111111111111'), 1, 'admin can list rejected requests');

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() -> 'request' ->> 'reject_reason', 'No payment found', 'the shop sees why');
select ok((public.my_plan() ->> 'ends_at')::timestamptz < now() + interval '31 days', 'a rejection does not change the plan');

insert into t select 'r5', (public.request_subscription('pro')).id;
select lives_ok($$select public.cancel_subscription_request()$$, 'the shop takes its request back');
select is((select status from public.subscription_requests where id = (select id from t where k = 'r5')), 'cancelled', 'request is cancelled');

reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscription_requests set created_at = created_at - interval '3 days';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
insert into t select 'r6', (public.request_subscription('pro')).id;
reset role;
select set_config('request.jwt.claims', '{}', true);
-- make r6 the newest request, 15 days old (inside one transaction every row has the same now())
update public.subscription_requests set created_at = created_at - interval '30 days' where id <> (select id from t where k = 'r6');
update public.subscription_requests set created_at = now() - interval '15 days' where id = (select id from t where k = 'r6');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() -> 'request' ->> 'status', 'expired', 'an undecided request shows as expired after 14 days');
select lives_ok($$select public.request_subscription('pro')$$, 'and no longer blocks a new one');
select is((select status from public.subscription_requests where id = (select id from t where k = 'r6')), 'expired', 'the old one is marked expired');

-- ---- 6. An expired shop can pay its way back ---------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscriptions set tier = 'base', ends_at = now() - interval '90 days'
 where owner_id = '22222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() ->> 'status', 'locked', 'the other shop is locked');
insert into t select 'o1', (public.request_subscription('base')).id;

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.admin_decide_request(%L, true)$$, (select id from t where k = 'o1')), 'admin approves the locked shop');

reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_plan() ->> 'status', 'active', 'a locked shop is active again after approval');
select ok((public.my_plan() ->> 'ends_at')::timestamptz between now() + interval '29 days' and now() + interval '31 days', 'for 30 days from today, not from the old end');
select lives_ok($$select public.create_order('{"customer_name":"Back","items":[]}'::jsonb)$$, 'and can write again');

select * from finish();
rollback;
