-- M2: settings + catalog functions, and no hard deletes.
-- Functions stay SECURITY INVOKER with a fixed search_path (same as the foundation), so RLS applies.

-- ---------------------------------------------------------------------------
-- No hard deletes (requirement 7). Deletes are soft via deleted_at.
-- order_items keeps DELETE: editing an order replaces its item rows (M3); history lives in versions.
-- ---------------------------------------------------------------------------
revoke delete on public.settings, public.products, public.variants, public.orders, public.bills
  from authenticated;

drop policy settings_delete_own on public.settings;
drop policy products_delete_own on public.products;
drop policy variants_delete_own on public.variants;
drop policy orders_delete_own on public.orders;
drop policy bills_delete_own on public.bills;

-- Bill images are immutable history; only assets (QR, logo) may be replaced or removed.
drop policy "owner can update own files" on storage.objects;
drop policy "owner can delete own files" on storage.objects;

create policy "owner can update own assets" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owner can delete own assets" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- init_settings(): create the caller's settings row if missing; returns it. Called after login.
-- ---------------------------------------------------------------------------
create function public.init_settings()
returns public.settings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.settings;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.settings (owner_id) values (v_owner)
  on conflict (owner_id) do nothing;
  select * into v_row from public.settings where owner_id = v_owner;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_product(p): create/update a product and the listed variants in one transaction.
-- p = {id?, name, is_active?, sort_order?, variants: [{id?, name, price, cost_price?, is_active?}]}
-- Variant sort_order = position in the list. Variants not listed are left unchanged
-- (removing one is an explicit trash_variant). Returns {"id": product_id}.
-- ---------------------------------------------------------------------------
create function public.upsert_product(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_variant jsonb;
  v_vid uuid;
  v_pos integer := 0;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_id is null then
    insert into public.products (name, sort_order, is_active)
    values (
      btrim(p ->> 'name'),
      coalesce((p ->> 'sort_order')::integer, 0),
      coalesce((p ->> 'is_active')::boolean, true)
    )
    returning id into v_id;
  else
    update public.products
       set name = btrim(p ->> 'name'),
           sort_order = coalesce((p ->> 'sort_order')::integer, sort_order),
           is_active = coalesce((p ->> 'is_active')::boolean, is_active)
     where id = v_id and deleted_at is null;
    if not found then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  end if;

  for v_variant in select value from jsonb_array_elements(coalesce(p -> 'variants', '[]'::jsonb))
  loop
    v_vid := nullif(v_variant ->> 'id', '')::uuid;
    if v_vid is null then
      insert into public.variants (product_id, name, price, cost_price, sort_order, is_active)
      values (
        v_id,
        btrim(v_variant ->> 'name'),
        (v_variant ->> 'price')::numeric,
        (v_variant ->> 'cost_price')::numeric,
        v_pos,
        coalesce((v_variant ->> 'is_active')::boolean, true)
      );
    else
      update public.variants
         set name = btrim(v_variant ->> 'name'),
             price = (v_variant ->> 'price')::numeric,
             cost_price = (v_variant ->> 'cost_price')::numeric,
             sort_order = v_pos,
             is_active = coalesce((v_variant ->> 'is_active')::boolean, is_active)
       where id = v_vid and product_id = v_id and deleted_at is null;
      if not found then
        raise exception 'variant not found' using errcode = 'P0002';
      end if;
    end if;
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trash / restore. A product and its live variants share one deleted_at, so restoring the
-- product brings back exactly those variants (not ones trashed individually earlier).
-- ---------------------------------------------------------------------------
create function public.trash_product(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.products set deleted_at = v_now where id = p_id and deleted_at is null;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  update public.variants set deleted_at = v_now where product_id = p_id and deleted_at is null;
end;
$$;

create function public.restore_product(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select deleted_at into v_at from public.products where id = p_id;
  if v_at is null then
    raise exception 'product not found in trash' using errcode = 'P0002';
  end if;
  update public.products set deleted_at = null where id = p_id;
  update public.variants set deleted_at = null where product_id = p_id and deleted_at = v_at;
end;
$$;

create function public.trash_variant(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.variants set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'variant not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.restore_variant(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_variant_deleted timestamptz;
  v_product_deleted timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select v.deleted_at, pr.deleted_at into v_variant_deleted, v_product_deleted
    from public.variants v
    join public.products pr on pr.id = v.product_id
   where v.id = p_id;
  if v_variant_deleted is null then
    raise exception 'variant not found in trash' using errcode = 'P0002';
  end if;
  if v_product_deleted is not null then
    raise exception 'restore the product first' using errcode = 'P0001';
  end if;
  update public.variants set deleted_at = null where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: authenticated only.
-- ---------------------------------------------------------------------------
revoke all on function
  public.init_settings(),
  public.upsert_product(jsonb),
  public.trash_product(uuid),
  public.restore_product(uuid),
  public.trash_variant(uuid),
  public.restore_variant(uuid)
from public, anon;

grant execute on function
  public.init_settings(),
  public.upsert_product(jsonb),
  public.trash_product(uuid),
  public.restore_product(uuid),
  public.trash_variant(uuid),
  public.restore_variant(uuid)
to authenticated;
