-- Sellbook database foundation, part 4: private storage buckets + policies, realtime publication.

-- ---------------------------------------------------------------------------
-- Buckets (private). assets = QR code + logo (2 MB), bills = bill PNGs (3 MB).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assets', 'assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('bills', 'bills', false, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: <owner_id>/<yyyy>/<filename>. The first segment must be the caller's uid.
create policy "owner can read own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('bills', 'assets')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owner can upload own files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('bills', 'assets')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owner can update own files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('bills', 'assets')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('bills', 'assets')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owner can delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('bills', 'assets')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.orders, public.order_items, public.products,
  public.variants, public.bills, public.settings;

-- Delete events must carry the full old row.
alter table public.orders replica identity full;
alter table public.order_items replica identity full;
