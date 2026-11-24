-- Refund reminder: marking it done is owner-only, one time, and only for a cancelled customer order with money in play.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'a@example.test', now()),
  ('b0000000-0000-4000-8000-000000000002', 'b@example.test', now()),
  ('c1000000-0000-4000-8000-000000000003', 'c1@example.test', now());
insert into public.shop_invites (code, created_by, expires_at) values
  ('REFUNDAAAA', 'a0000000-0000-4000-8000-000000000001', now() + interval '1 day'),
  ('REFUNDBBBB', 'a0000000-0000-4000-8000-000000000001', now() + interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_shop('REFUNDAAAA', 'refund-a', 'Refund A');
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.create_shop('REFUNDBBBB', 'refund-b', 'Refund B');
reset role;
-- a declined customer order that was paid, and one that was not
insert into public.orders (id, order_no, owner_id, customer_name, source, status, customer_user_id, fulfilment, payment_method, payment_status, payment_mode)
values ('00000000-0000-4000-8000-0000000000d1', 1, 'a0000000-0000-4000-8000-000000000001', 'Paid', 'customer', 'new', 'c1000000-0000-4000-8000-000000000003', 'pickup', 'upi', 'paid', 'online'),
       ('00000000-0000-4000-8000-0000000000d2', 2, 'a0000000-0000-4000-8000-000000000001', 'Unpaid', 'customer', 'new', 'c1000000-0000-4000-8000-000000000003', 'pickup', 'cod', 'pending', null);
update public.orders set status = 'cancelled', cancelled_from = 'new', confirmation_status = 'declined', decline_reason = 'Closed' where id in ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.mark_refunded('00000000-0000-4000-8000-0000000000d1', 1)$$, 'P0002', null, 'another shop cannot mark it');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.mark_refunded('00000000-0000-4000-8000-0000000000d1', 99)$$, 'SB409', null, 'a stale version is refused');
select throws_ok($$select public.mark_refunded('00000000-0000-4000-8000-0000000000d2', (select version_no from public.orders where id = '00000000-0000-4000-8000-0000000000d2'))$$, 'SB425', null, 'nothing was paid: nothing to refund');
select isnt((public.mark_refunded('00000000-0000-4000-8000-0000000000d1', (select version_no from public.orders where id = '00000000-0000-4000-8000-0000000000d1'))).refund_done_at, null, 'the owner marks the refund done');
select throws_ok($$select public.mark_refunded('00000000-0000-4000-8000-0000000000d1', (select version_no from public.orders where id = '00000000-0000-4000-8000-0000000000d1'))$$, 'SB425', null, 'only once');
select is((select count(*)::int from public.list_order_versions('00000000-0000-4000-8000-0000000000d1') where reason = 'refund'), 1, 'the step is in the order history');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.mark_refunded('00000000-0000-4000-8000-0000000000d1', 1)$$, '42501', null, 'a customer cannot mark it');

select * from finish();
rollback;
