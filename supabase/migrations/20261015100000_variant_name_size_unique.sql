-- UI round 2 (variants): the same name may be reused with a different size ("Retail 500 g",
-- "Retail 1 kg"). Uniqueness becomes name + size within a product (live variants only).
-- Strictly more permissive than before, so every existing row still satisfies it and no data
-- changes. Same-name variants without any size still collide, as before.
drop index public.variants_product_name_uniq;

create unique index variants_product_name_size_uniq
  on public.variants (product_id, lower(name), coalesce(size_amount, 0), coalesce(size_unit::text, ''))
  where deleted_at is null;
