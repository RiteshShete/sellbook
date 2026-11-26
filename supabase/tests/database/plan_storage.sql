-- Plans phase 6: bill storage cap + retention, admin stats, and the shop's own data export. Rolled back.
-- Storage rows are inserted directly (as the shop, so the policies run); no real files are involved.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- Supabase refuses a plain SQL DELETE on storage tables ("use the Storage API"). The Storage API sets this flag
-- itself and still runs the row policies under the caller's JWT, so setting it here tests exactly those policies.
select set_config('storage.allow_delete_query', 'true', true);

-- A database may already hold other shops (local dev): count them first, the stats cover everyone.
select set_config('t.shops_before', (select count(*) from public.subscriptions)::text, true);
select set_config('t.ended_before', (select count(*) from public.subscriptions where now() >= ends_at)::text, true);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'shop@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.test');
insert into public.platform_admins (user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ---- 1. Numbers per plan ---------------------------------------------------------------------
select is((select storage_bytes from public.plan_limits where tier = 'trial'), 20971520::bigint, 'trial: 20 MB of bills');
select is((select storage_bytes from public.plan_limits where tier = 'base'), 104857600::bigint, 'base: 100 MB');
select is((select storage_bytes from public.plan_limits where tier = 'pro'), 314572800::bigint, 'pro: 300 MB');
select is((select bill_keep_days from public.plan_limits where tier = 'trial'), 30, 'trial keeps bill images 30 days');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
create temp table t (k text primary key, id uuid);

select is(public.my_plan() -> 'storage' ->> 'used', '0', 'my_plan: nothing stored yet');
select is(public.my_plan() -> 'storage' ->> 'limit', '20971520', 'my_plan: the trial cap');
select is(public.my_plan() -> 'storage' ->> 'keep_days', '30', 'my_plan: the retention');

-- ---- 2. The cap on uploads --------------------------------------------------------------------
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '11111111-1111-1111-1111-111111111111/2026/a.png', '11111111-1111-1111-1111-111111111111', '{"size": 15728640}')$$,
  'first bill image (15 MB) is stored');
select is(public.my_plan() -> 'storage' ->> 'used', '15728640', 'usage counts it');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '11111111-1111-1111-1111-111111111111/2026/b.png', '11111111-1111-1111-1111-111111111111', '{"size": 15728640}')$$,
  'the upload that crosses the cap is allowed (15 MB < 20 MB when it starts)');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '11111111-1111-1111-1111-111111111111/2026/c.png', '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  '42501', null, 'the next one is refused: the shop is over its storage');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('assets', '11111111-1111-1111-1111-111111111111/2026/logo.png', '11111111-1111-1111-1111-111111111111', '{"size": 100000}')$$,
  'QR and logo uploads are not capped');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '22222222-2222-2222-2222-222222222222/2026/x.png', '11111111-1111-1111-1111-111111111111', '{"size": 1}')$$,
  '42501', null, 'a shop cannot upload into another shop''s folder');

-- ---- 3. Another shop and an ended plan --------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '22222222-2222-2222-2222-222222222222/2026/a.png', '22222222-2222-2222-2222-222222222222', '{"size": 1000}')$$,
  'the cap is per shop');
select is(public.my_plan() -> 'storage' ->> 'used', '1000', 'usage is per shop');

reset role;
select set_config('request.jwt.claims', '{}', true);
update public.subscriptions set ends_at = now() - interval '1 day' where owner_id = '22222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '22222222-2222-2222-2222-222222222222/2026/b.png', '22222222-2222-2222-2222-222222222222', '{"size": 1000}')$$,
  '42501', null, 'a plan that has ended cannot add bill images');

-- ---- 4. Retention: old bill images may be deleted by their shop, new ones not -------------------
reset role;
select set_config('request.jwt.claims', '{}', true);
-- two bills of the first shop: one 40 days old (past the 30-day trial retention), one fresh
insert into public.orders (owner_id, customer_name, order_no, bill_no, bill_prefix) values
  ('11111111-1111-1111-1111-111111111111', 'Old', 1, 1, 'INV'), ('11111111-1111-1111-1111-111111111111', 'New', 2, 2, 'INV');
insert into public.bills (owner_id, order_id, bill_no, revision, image_path, total_at_generation, items_hash, generated_at)
select '11111111-1111-1111-1111-111111111111', o.id, o.bill_no, 1,
       '11111111-1111-1111-1111-111111111111/2026/' || case o.bill_no when 1 then 'a' else 'b' end || '.png', 0, 'h',
       case o.bill_no when 1 then now() - interval '40 days' else now() end
  from public.orders o where o.owner_id = '11111111-1111-1111-1111-111111111111' and o.order_no in (1, 2);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.bill_files_to_purge()), 1, 'only the old bill is listed');
select is((select path from public.bill_files_to_purge()), '11111111-1111-1111-1111-111111111111/2026/a.png', 'the 40-day-old one');
select is((select bill_id is not null from public.bill_files_to_purge()), true, 'it belongs to a bill');

select is((select count(*)::int from storage.objects where name = '11111111-1111-1111-1111-111111111111/2026/b.png'), 1, 'the fresh image is there');
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/2026/b.png';
select is((select count(*)::int from storage.objects where name = '11111111-1111-1111-1111-111111111111/2026/b.png'), 1, 'a fresh bill image cannot be deleted');

select is(public.mark_bills_purged(array['11111111-1111-1111-1111-111111111111/2026/a.png']), 0, 'a bill is not marked while its file still exists');
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/2026/a.png';
select is((select count(*)::int from storage.objects where name = '11111111-1111-1111-1111-111111111111/2026/a.png'), 0, 'the old image is deleted');
select is(public.mark_bills_purged(array['11111111-1111-1111-1111-111111111111/2026/a.png']), 1, 'now the bill is marked');
select ok((select image_purged_at from public.bills where image_path = '11111111-1111-1111-1111-111111111111/2026/a.png') is not null,
  'the bill row says its image was removed');
select is((select count(*)::int from public.bill_files_to_purge()), 0, 'nothing left to tidy');
select is(public.my_plan() -> 'storage' ->> 'used', '15728640', 'usage dropped by the deleted file');

-- ---- 5. Uploads that never became a bill -----------------------------------------------------
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('bills', '11111111-1111-1111-1111-111111111111/2026/orphan.png', '11111111-1111-1111-1111-111111111111', '{"size": 10}')$$,
  'an upload that will never be registered');
select is((select count(*)::int from public.bill_files_to_purge()), 0, 'a fresh orphan is left alone');
reset role;
update storage.objects set created_at = now() - interval '2 days' where name like '%/orphan.png';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.bill_files_to_purge() where bill_id is null), 1, 'a day-old orphan is listed');
delete from storage.objects where name like '%/orphan.png';
select is((select count(*)::int from storage.objects where name like '%/orphan.png'), 0, 'and can be deleted');

-- ---- 6. Admin stats and the data export ---------------------------------------------------------
select throws_ok($$select public.admin_stats()$$, '42501', 'not allowed', 'a shop cannot read the platform stats');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((public.admin_stats() -> 'shops' ->> 'total')::int, current_setting('t.shops_before')::int + 3, 'admin: counts every shop');
select ok((public.admin_stats() ->> 'db_bytes')::bigint > 0, 'admin: database size');
select ok((public.admin_stats() ->> 'bill_bytes')::bigint >= 15728640, 'admin: bill storage across shops');
select is((public.admin_stats() -> 'shops' ->> 'ended')::int, current_setting('t.ended_before')::int + 1, 'admin: the shop whose plan ended');

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(jsonb_array_length(public.export_my_data() -> 'orders'), 2, 'export: the shop''s own orders');
select is(public.export_my_data() #>> '{orders,0,customer_name}', 'Old', 'export: in order number order');
select is(jsonb_array_length(public.export_my_data() -> 'bills'), 2, 'export: and its bills');

reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is(jsonb_array_length(public.export_my_data() -> 'orders'), 0, 'export: another shop gets none of them');

select * from finish();
rollback;
