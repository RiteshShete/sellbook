-- UI round 2 (variants): the same name may be reused with a different size ("Retail 500 g",
-- "Retail 1 kg"). Uniqueness becomes name + size within a product (live variants only).
-- Strictly more permissive than before, so every existing row still satisfies it and no data
-- changes. Same-name variants without any size still collide, as before.
drop index public.variants_product_name_uniq;

-- NULLS NOT DISTINCT (Postgres 15+): two variants without a size still collide. (An expression like
-- coalesce(size_unit::text, '') is rejected: the enum-to-text cast is not IMMUTABLE.)
create unique index variants_product_name_size_uniq
  on public.variants (product_id, lower(name), size_amount, size_unit) nulls not distinct
  where deleted_at is null;
