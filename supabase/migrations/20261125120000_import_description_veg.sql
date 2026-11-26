-- Product import: optional description and veg_type columns, used only for NEW products.
-- The existing function is patched in place (its text is read from the catalog, one regexp replacement, asserted), so nothing else changes.
do $$
declare
  v_def text := pg_get_functiondef('app_private.apply_product_import(jsonb)'::regprocedure);
  v_re text := 'insert into public\.products \(name, category_id, sort_order, is_active\)\s+values \(v_name, v_cat, v_sort, true\)';
  v_new text := 'insert into public.products (name, category_id, sort_order, is_active, description, veg_type) values (v_name, v_cat, v_sort, true, nullif(left(btrim(coalesce(v_prod ->> ''description'', '''')), 2000), ''''), case when v_prod ->> ''veg_type'' in (''veg'', ''non_veg'', ''egg'') then v_prod ->> ''veg_type'' end)';
begin
  if v_def !~ v_re then
    raise exception 'apply_product_import: expected insert statement not found';
  end if;
  execute regexp_replace(v_def, v_re, replace(v_new, '\', '\\'));
end;
$$;
