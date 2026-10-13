-- UI round 2, categories. ADDITIVE and backward compatible:
--  * new table public.categories (soft delete, owner-only RLS, same conventions as products)
--  * products.category_id, nullable: every existing product simply stays "Uncategorised"
--  * upsert_product accepts an optional "category_id" (a missing key leaves it unchanged)
--  * RPCs: upsert_category, reorder_categories, trash_category, restore_category
-- Trashing a category keeps products.category_id, so Restore brings the grouping back exactly;
-- the app shows products of a trashed category under "Uncategorised".

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  sort_order integer not null default 0
);

create unique index categories_owner_name_uniq
  on public.categories (owner_id, lower(name))
  where deleted_at is null;

create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
grant select, insert, update, delete on public.categories to authenticated;

create policy categories_select_own on public.categories
  for select to authenticated using (owner_id = (select auth.uid()));
create policy categories_insert_own on public.categories
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy categories_update_own on public.categories
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy categories_delete_own on public.categories
  for delete to authenticated using (owner_id = (select auth.uid()));

alter table public.products
  add column category_id uuid null references public.categories (id) on delete restrict;
create index products_category_idx on public.products (category_id);

-- ---------------------------------------------------------------------------
-- Category RPCs
-- ---------------------------------------------------------------------------
create function public.upsert_category(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_id is null then
    insert into public.categories (name, sort_order)
    values (
      btrim(p ->> 'name'),
      coalesce((select max(sort_order) + 1 from public.categories where deleted_at is null), 0)
    )
    returning id into v_id;
  else
    update public.categories set name = btrim(p ->> 'name')
     where id = v_id and deleted_at is null;
    if not found then
      raise exception 'category not found' using errcode = 'P0002';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

-- p_ids = every live category in the new order; sort_order becomes the position.
create function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.categories c
     set sort_order = o.pos - 1
    from unnest(p_ids) with ordinality as o(id, pos)
   where c.id = o.id and c.deleted_at is null;
end;
$$;

create function public.trash_category(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.categories set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.restore_category(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.categories set deleted_at = null where id = p_id and deleted_at is not null;
  if not found then
    raise exception 'category not found in trash' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_product: as in 20261013100000_sizes.sql, plus an optional category_id.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_product(p jsonb)
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
  v_has_size boolean;
  v_amount numeric;
  v_unit public.size_unit;
  v_has_cat boolean := p ? 'category_id';
  v_cat uuid := nullif(p ->> 'category_id', '')::uuid;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_cat is not null
     and not exists (select 1 from public.categories where id = v_cat and deleted_at is null) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  if v_id is null then
    insert into public.products (name, category_id, sort_order, is_active)
    values (
      btrim(p ->> 'name'),
      v_cat,
      coalesce((p ->> 'sort_order')::integer, 0),
      coalesce((p ->> 'is_active')::boolean, true)
    )
    returning id into v_id;
  else
    update public.products
       set name = btrim(p ->> 'name'),
           category_id = case when v_has_cat then v_cat else category_id end,
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
    v_has_size := v_variant ? 'size_unit' or v_variant ? 'size_amount';
    v_amount := nullif(v_variant ->> 'size_amount', '')::numeric;
    if nullif(v_variant ->> 'size_unit', '') is not null
       and v_variant ->> 'size_unit' not in ('g', 'ml', 'pcs') then
      raise exception 'size unit must be g, ml or pcs' using errcode = '22023';
    end if;
    v_unit := nullif(v_variant ->> 'size_unit', '')::public.size_unit;
    if (v_amount is null) <> (v_unit is null) then
      raise exception 'a size needs both an amount and a unit' using errcode = '22023';
    end if;
    if v_amount is not null and v_amount <= 0 then
      raise exception 'size must be more than 0' using errcode = '22023';
    end if;

    if v_vid is null then
      insert into public.variants
        (product_id, name, price, cost_price, sort_order, is_active, size_amount, size_unit)
      values (
        v_id,
        btrim(v_variant ->> 'name'),
        (v_variant ->> 'price')::numeric,
        (v_variant ->> 'cost_price')::numeric,
        v_pos,
        coalesce((v_variant ->> 'is_active')::boolean, true),
        v_amount,
        v_unit
      );
    else
      update public.variants
         set name = btrim(v_variant ->> 'name'),
             price = (v_variant ->> 'price')::numeric,
             cost_price = (v_variant ->> 'cost_price')::numeric,
             sort_order = v_pos,
             is_active = coalesce((v_variant ->> 'is_active')::boolean, is_active),
             size_amount = case when v_has_size then v_amount else size_amount end,
             size_unit = case when v_has_size then v_unit else size_unit end
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

revoke all on function
  public.upsert_category(jsonb),
  public.reorder_categories(uuid[]),
  public.trash_category(uuid),
  public.restore_category(uuid)
from public, anon;

grant execute on function
  public.upsert_category(jsonb),
  public.reorder_categories(uuid[]),
  public.trash_category(uuid),
  public.restore_category(uuid)
to authenticated;

alter publication supabase_realtime add table public.categories;
