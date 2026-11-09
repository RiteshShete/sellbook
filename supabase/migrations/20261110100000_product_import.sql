-- Product import from CSV. ADDITIVE: one new table + three new functions; no existing object changes.
--  * import_batches: one row per import (file name, counts, ids it created, previous values of
--    the variants it updated) so "Undo this import" can reverse exactly that batch.
--  * apply_product_import(p): creates categories, products, variants and updates variant prices in
--    ONE transaction (all or nothing) and records the batch. Never deletes anything.
--  * undo_product_import(p_id): soft-deletes what the batch created (Trash, restorable) and puts
--    updated variants back to their previous values. Old orders keep their own snapshots (B8).
-- A concurrent catalog change (a product / variant the plan assumed to be absent now exists, or
-- one it meant to change is gone) raises SQLSTATE SB410 so the app can ask for a fresh review.

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  file_name text not null default '' check (char_length(file_name) <= 200),
  mode text not null check (mode in ('add', 'update')),
  counts jsonb not null default '{}'::jsonb,
  created_category_ids uuid[] not null default '{}',
  created_product_ids uuid[] not null default '{}',
  created_variant_ids uuid[] not null default '{}',
  previous_variants jsonb not null default '[]'::jsonb,
  undone_at timestamptz null
);

create index import_batches_owner_created_idx on public.import_batches (owner_id, created_at desc);

alter table public.import_batches enable row level security;
-- No delete: batches are a record. Insert / update happen inside the functions (security invoker).
grant select, insert, update on public.import_batches to authenticated;

create policy import_batches_select_own on public.import_batches
  for select to authenticated using (owner_id = (select auth.uid()));
create policy import_batches_insert_own on public.import_batches
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy import_batches_update_own on public.import_batches
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Used only by apply_product_import: validates and inserts one variant of a product.
-- ---------------------------------------------------------------------------
create function public.import_insert_variant(p_product uuid, p_variant jsonb, p_pos integer)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount numeric := nullif(p_variant ->> 'size_amount', '')::numeric;
  v_unit public.size_unit;
  v_price numeric := (p_variant ->> 'price')::numeric;
  v_name text := btrim(p_variant ->> 'name');
  v_id uuid;
begin
  if nullif(p_variant ->> 'size_unit', '') is not null
     and p_variant ->> 'size_unit' not in ('g', 'ml', 'pcs') then
    raise exception 'size unit must be g, ml or pcs' using errcode = '22023';
  end if;
  v_unit := nullif(p_variant ->> 'size_unit', '')::public.size_unit;
  if (v_amount is null) <> (v_unit is null) then
    raise exception 'a size needs both an amount and a unit' using errcode = '22023';
  end if;
  if v_amount is not null and v_amount <= 0 then
    raise exception 'size must be more than 0' using errcode = '22023';
  end if;
  if v_price is null or v_price < 0 or v_price > 1000000 then
    raise exception 'price must be between 0 and 1,000,000' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.variants
     where product_id = p_product and deleted_at is null and lower(name) = lower(v_name)
       and size_amount is not distinct from v_amount and size_unit is not distinct from v_unit
  ) then
    raise exception 'catalog changed: variant % already exists', v_name using errcode = 'SB410';
  end if;
  insert into public.variants
    (product_id, name, price, cost_price, sort_order, is_active, size_amount, size_unit)
  values (
    p_product, v_name, v_price, nullif(p_variant ->> 'cost_price', '')::numeric, p_pos,
    coalesce((p_variant ->> 'is_active')::boolean, true), v_amount, v_unit
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_product_import
-- p = {
--   file_name, mode: 'add' | 'update',
--   categories: [name, ...]                       -- created when no live category has that name
--   products:   [{ name, category: name | null, variants: [variant, ...] }]   -- must not exist yet
--   add_variants: [{ product_id, variants: [variant, ...] }]                  -- to existing products
--   updates:    [{ variant_id, price?, cost_price?, is_active? }]             -- 'update' mode only
-- }  variant = { name, price, cost_price, size_amount, size_unit, is_active }
-- ---------------------------------------------------------------------------
create function public.apply_product_import(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mode text := coalesce(p ->> 'mode', 'add');
  v_name text;
  v_cat uuid;
  v_cat_name text;
  v_prod jsonb;
  v_add jsonb;
  v_upd jsonb;
  v_var jsonb;
  v_pid uuid;
  v_vid uuid;
  v_pos integer;
  v_cats uuid[] := '{}';
  v_prods uuid[] := '{}';
  v_vars uuid[] := '{}';
  v_prev jsonb := '[]'::jsonb;
  v_before public.variants;
  v_batch uuid;
  v_updated integer := 0;
  v_sort integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_mode not in ('add', 'update') then
    raise exception 'mode must be add or update' using errcode = '22023';
  end if;
  if v_mode = 'add' and jsonb_array_length(coalesce(p -> 'updates', '[]'::jsonb)) > 0 then
    raise exception 'updates need mode update' using errcode = '22023';
  end if;

  -- categories
  for v_name in select btrim(value) from jsonb_array_elements_text(coalesce(p -> 'categories', '[]'::jsonb))
  loop
    if not exists (select 1 from public.categories where deleted_at is null and lower(name) = lower(v_name)) then
      insert into public.categories (name, sort_order)
      values (v_name, coalesce((select max(sort_order) + 1 from public.categories where deleted_at is null), 0))
      returning id into v_cat;
      v_cats := v_cats || v_cat;
    end if;
  end loop;

  -- new products
  for v_prod in select value from jsonb_array_elements(coalesce(p -> 'products', '[]'::jsonb))
  loop
    v_name := btrim(v_prod ->> 'name');
    if exists (select 1 from public.products where deleted_at is null and lower(name) = lower(v_name)) then
      raise exception 'catalog changed: product % already exists', v_name using errcode = 'SB410';
    end if;
    v_cat_name := nullif(btrim(coalesce(v_prod ->> 'category', '')), '');
    v_cat := null;
    if v_cat_name is not null then
      select id into v_cat from public.categories
       where deleted_at is null and lower(name) = lower(v_cat_name);
    end if;
    select coalesce(max(sort_order) + 1, 0) into v_sort from public.products where deleted_at is null;
    insert into public.products (name, category_id, sort_order, is_active)
    values (v_name, v_cat, v_sort, true)
    returning id into v_pid;
    v_prods := v_prods || v_pid;
    v_pos := 0;
    for v_var in select value from jsonb_array_elements(coalesce(v_prod -> 'variants', '[]'::jsonb))
    loop
      v_vid := public.import_insert_variant(v_pid, v_var, v_pos);
      v_vars := v_vars || v_vid;
      v_pos := v_pos + 1;
    end loop;
  end loop;

  -- new variants on existing products
  for v_add in select value from jsonb_array_elements(coalesce(p -> 'add_variants', '[]'::jsonb))
  loop
    v_pid := (v_add ->> 'product_id')::uuid;
    if not exists (select 1 from public.products where id = v_pid and deleted_at is null) then
      raise exception 'catalog changed: a product was removed' using errcode = 'SB410';
    end if;
    select coalesce(max(sort_order) + 1, 0) into v_pos from public.variants where product_id = v_pid;
    for v_var in select value from jsonb_array_elements(coalesce(v_add -> 'variants', '[]'::jsonb))
    loop
      v_vid := public.import_insert_variant(v_pid, v_var, v_pos);
      v_vars := v_vars || v_vid;
      v_pos := v_pos + 1;
    end loop;
  end loop;

  -- price / cost / active updates, remembering the previous values
  for v_upd in select value from jsonb_array_elements(coalesce(p -> 'updates', '[]'::jsonb))
  loop
    select * into v_before from public.variants
     where id = (v_upd ->> 'variant_id')::uuid and deleted_at is null
     for update;
    if not found then
      raise exception 'catalog changed: a variant was removed' using errcode = 'SB410';
    end if;
    if v_upd ? 'price' and ((v_upd ->> 'price')::numeric < 0 or (v_upd ->> 'price')::numeric > 1000000) then
      raise exception 'price must be between 0 and 1,000,000' using errcode = '22023';
    end if;
    v_prev := v_prev || jsonb_build_object(
      'id', v_before.id, 'price', v_before.price,
      'cost_price', v_before.cost_price, 'is_active', v_before.is_active);
    update public.variants
       set price = case when v_upd ? 'price' then (v_upd ->> 'price')::numeric else price end,
           cost_price = case when v_upd ? 'cost_price' then (v_upd ->> 'cost_price')::numeric else cost_price end,
           is_active = case when v_upd ? 'is_active' then (v_upd ->> 'is_active')::boolean else is_active end
     where id = v_before.id;
    v_updated := v_updated + 1;
  end loop;

  insert into public.import_batches
    (file_name, mode, counts, created_category_ids, created_product_ids, created_variant_ids, previous_variants)
  values (
    left(coalesce(p ->> 'file_name', ''), 200), v_mode,
    jsonb_build_object(
      'categories', cardinality(v_cats), 'products', cardinality(v_prods),
      'variants', cardinality(v_vars), 'updated', v_updated),
    v_cats, v_prods, v_vars, v_prev)
  returning id into v_batch;

  return jsonb_build_object(
    'batch_id', v_batch,
    'categories', cardinality(v_cats), 'products', cardinality(v_prods),
    'variants', cardinality(v_vars), 'updated', v_updated);
end;
$$;

-- ---------------------------------------------------------------------------
-- undo_product_import
-- ---------------------------------------------------------------------------
create function public.undo_product_import(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_prev jsonb;
  v_now timestamptz := clock_timestamp();
  v_restored integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_batch from public.import_batches
   where id = p_id and undone_at is null for update;
  if not found then
    raise exception 'import not found or already undone' using errcode = 'P0002';
  end if;

  update public.variants set deleted_at = v_now
   where id = any (v_batch.created_variant_ids) and deleted_at is null;
  update public.products set deleted_at = v_now
   where id = any (v_batch.created_product_ids) and deleted_at is null;
  -- A created category stays when another live product (not from this batch) uses it now.
  update public.categories c set deleted_at = v_now
   where c.id = any (v_batch.created_category_ids) and c.deleted_at is null
     and not exists (
       select 1 from public.products pr
        where pr.category_id = c.id and pr.deleted_at is null
          and pr.id <> all (v_batch.created_product_ids));

  for v_prev in select value from jsonb_array_elements(v_batch.previous_variants)
  loop
    update public.variants
       set price = (v_prev ->> 'price')::numeric,
           cost_price = (v_prev ->> 'cost_price')::numeric,
           is_active = (v_prev ->> 'is_active')::boolean
     where id = (v_prev ->> 'id')::uuid and deleted_at is null;
    if found then v_restored := v_restored + 1; end if;
  end loop;

  update public.import_batches set undone_at = v_now where id = p_id;
  return jsonb_build_object(
    'products', cardinality(v_batch.created_product_ids),
    'variants', cardinality(v_batch.created_variant_ids),
    'restored', v_restored);
end;
$$;

revoke all on function
  public.import_insert_variant(uuid, jsonb, integer),
  public.apply_product_import(jsonb),
  public.undo_product_import(uuid)
from public, anon;

grant execute on function
  public.import_insert_variant(uuid, jsonb, integer),
  public.apply_product_import(jsonb),
  public.undo_product_import(uuid)
to authenticated;
