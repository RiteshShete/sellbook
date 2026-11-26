-- Plans, phase 6: keep bill storage inside the free 1 GB, show the platform's usage to the admin, and let a
-- shop download its own data.
--
-- Bill images are the one thing that fills Supabase's free storage. Two rules, both enforced here:
--   1. CAP: a shop whose bill images already use its plan's storage cannot upload another one.
--      (The upload that crosses the line is allowed; the next one is refused. A plan that has ended cannot upload.)
--   2. RETENTION: a bill image older than the plan's keep-days may be deleted by its own shop. The app does this
--      by itself when a shop opens it (the shop's own session calls the Storage API, so no privileged key is
--      needed). The bill row stays; the image can be made again from the order at any time.

-- ---------------------------------------------------------------------------
-- 1) Per-plan numbers and the "image removed" marker
-- ---------------------------------------------------------------------------
alter table public.plan_limits
  add column storage_bytes bigint null check (storage_bytes > 0),
  add column bill_keep_days integer null check (bill_keep_days > 0);

update public.plan_limits set storage_bytes = 20 * 1024 * 1024, bill_keep_days = 30 where tier = 'trial';
update public.plan_limits set storage_bytes = 100 * 1024 * 1024, bill_keep_days = 90 where tier = 'base';
update public.plan_limits set storage_bytes = 300 * 1024 * 1024, bill_keep_days = 365 where tier = 'pro';

alter table public.bills add column image_purged_at timestamptz null;

-- ---------------------------------------------------------------------------
-- 2) Helpers (the caller's own numbers; storage.objects is readable for the caller's own files)
-- ---------------------------------------------------------------------------
create function app_private.plan_storage(out storage_bytes bigint, out keep_days integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.storage_bytes, l.bill_keep_days
    from public.subscriptions s
    join public.plan_limits l on l.tier = s.tier
   where s.owner_id = (select auth.uid());
$$;

create function app_private.bill_storage_used()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
    from storage.objects o
   where o.bucket_id = 'bills'
     and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

create function app_private.bill_keep_days()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select keep_days from app_private.plan_storage();
$$;

-- May the caller store one more bill image? Needs a running plan and room under the cap (null cap = unlimited).
create function app_private.bill_upload_allowed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select st.status in ('trial', 'active') from app_private.plan_state() st), false)
     and (select coalesce(app_private.bill_storage_used() < ps.storage_bytes, true)
            from app_private.plan_storage() ps);
$$;

-- ---------------------------------------------------------------------------
-- 3) Storage policies. The old policy covered both buckets; split it so only bills carry the cap.
-- ---------------------------------------------------------------------------
drop policy "owner can upload own files" on storage.objects;

create policy "owner can upload own assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owner can upload own bills" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and app_private.bill_upload_allowed()
  );

-- Delete: a bill image past the plan's keep-days, or an upload that never became a bill (over a day old).
create policy "owner can delete own old bills" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      exists (
        select 1 from public.bills b
         where b.image_path = name
           and b.generated_at < now() - make_interval(days => coalesce(app_private.bill_keep_days(), 36500))
      )
      or (
        created_at < now() - interval '1 day'
        and not exists (select 1 from public.bills b where b.image_path = name)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) What the app tidies: the list, then the "image removed" marker
-- ---------------------------------------------------------------------------
-- Up to 50 files this shop may delete now. A bill is listed even if its file is already gone, so it still gets marked.
create function public.bill_files_to_purge()
returns table (path text, bill_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  (select b.image_path, b.id
     from public.bills b
    where b.image_purged_at is null
      and app_private.bill_keep_days() is not null
      and b.generated_at < now() - make_interval(days => app_private.bill_keep_days()))
  union all
  (select o.name, null::uuid
     from storage.objects o
    where o.bucket_id = 'bills'
      and (storage.foldername(o.name))[1] = (select auth.uid())::text
      and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.bills b where b.image_path = o.name))
  limit 50;
$$;

-- Marks the caller's bills whose image is really gone (a bill whose file still exists is left alone). Returns how
-- many. Bills are read-only for shops (no UPDATE privilege), so this is the one narrow, checked way to set the marker.
create function public.mark_bills_purged(p_paths text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.bills b
     set image_purged_at = now()
   where b.owner_id = auth.uid()
     and b.image_path = any (p_paths)
     and b.image_purged_at is null
     and not exists (select 1 from storage.objects o where o.bucket_id = 'bills' and o.name = b.image_path);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) my_plan(): now also the shop's storage use, cap and retention
-- ---------------------------------------------------------------------------
create or replace function public.my_plan()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'tier', p.tier,
    'status', coalesce(p.status, 'locked'),
    'ends_at', p.ends_at,
    'readonly_until', p.ends_at + interval '60 days',
    'can_write', coalesce(p.status in ('trial', 'active'), false),
    'pro_features', coalesce(p.pro_features, false),
    'limits', jsonb_build_object('orders', p.orders_limit, 'orders_scope', p.orders_scope, 'products', p.products_limit),
    'usage', jsonb_build_object('orders', app_private.orders_used(p.orders_scope), 'products', app_private.products_used()),
    'storage', jsonb_build_object(
      'used', app_private.bill_storage_used(),
      'limit', (select ps.storage_bytes from app_private.plan_storage() ps),
      'keep_days', (select ps.keep_days from app_private.plan_storage() ps)),
    'pay_ref', app_private.pay_ref((select auth.uid())),
    'pay_to', (select jsonb_build_object(
                 'upi_id', max(c.value) filter (where c.key = 'upi_id'),
                 'payee_name', max(c.value) filter (where c.key = 'payee_name'),
                 'support_email', max(c.value) filter (where c.key = 'support_email'))
                 from public.platform_config c),
    'request', (select jsonb_build_object(
                  'id', r.id, 'tier', r.tier, 'amount_paise', r.amount_paise, 'utr', r.utr,
                  'status', case when r.status = 'pending' and r.created_at < now() - interval '14 days'
                                 then 'expired' else r.status end,
                  'created_at', r.created_at, 'reject_reason', r.reject_reason)
                  from public.subscription_requests r
                 where r.owner_id = (select auth.uid())
                 order by r.created_at desc limit 1)
  )
  from app_private.plan_state() p;
$$;

-- ---------------------------------------------------------------------------
-- 6) Admin: how full is the free plan?
-- ---------------------------------------------------------------------------
create function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'shops', (select jsonb_build_object(
                'total', count(*),
                'trial', count(*) filter (where s.tier = 'trial' and now() < s.ends_at),
                'base', count(*) filter (where s.tier = 'base' and now() < s.ends_at),
                'pro', count(*) filter (where s.tier = 'pro' and now() < s.ends_at),
                'ended', count(*) filter (where now() >= s.ends_at))
                from public.subscriptions s),
    'orders', (select count(*) from public.orders),
    'pending_requests', (select count(*) from public.subscription_requests where status = 'pending'),
    'db_bytes', pg_database_size(current_database()),
    'bill_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o where o.bucket_id = 'bills'),
    'asset_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o where o.bucket_id = 'assets')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) A shop's own data, as one JSON document (RLS limits every table to the caller's rows)
-- ---------------------------------------------------------------------------
create function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'settings', (select to_jsonb(s) from public.settings s limit 1),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.categories c), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object('variants', coalesce((
          select jsonb_agg(to_jsonb(v) order by v.sort_order) from public.variants v where v.product_id = p.id), '[]'::jsonb))
        order by p.name)
      from public.products p), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(
        to_jsonb(o) || jsonb_build_object('items', coalesce((
          select jsonb_agg(to_jsonb(i) order by i.position) from public.order_items i where i.order_id = o.id), '[]'::jsonb))
        order by o.order_no)
      from public.orders o), '[]'::jsonb),
    'bills', coalesce((select jsonb_agg(to_jsonb(b) order by b.bill_no, b.revision) from public.bills b), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 8) Privileges
-- ---------------------------------------------------------------------------
revoke all on function
  app_private.plan_storage(), app_private.bill_storage_used(), app_private.bill_keep_days(),
  app_private.bill_upload_allowed()
from public, anon;
grant execute on function
  app_private.plan_storage(), app_private.bill_storage_used(), app_private.bill_keep_days(),
  app_private.bill_upload_allowed()
to authenticated;

revoke all on function
  public.bill_files_to_purge(), public.mark_bills_purged(text[]), public.admin_stats(), public.export_my_data()
from public, anon;
grant execute on function
  public.bill_files_to_purge(), public.mark_bills_purged(text[]), public.admin_stats(), public.export_my_data()
to authenticated;
