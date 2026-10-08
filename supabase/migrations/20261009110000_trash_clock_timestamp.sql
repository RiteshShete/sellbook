-- Fix: trash_* stamped deleted_at with now(), which is constant within a transaction. A variant
-- trashed on its own and its product trashed later in the same transaction then shared one
-- timestamp, so restore_product brought the separately-trashed variant back too.
-- clock_timestamp() advances, so each trash action gets its own stamp. Signatures are unchanged
-- (create or replace keeps the existing grants).

create or replace function public.trash_product(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
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

create or replace function public.trash_variant(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.variants set deleted_at = clock_timestamp() where id = p_id and deleted_at is null;
  if not found then
    raise exception 'variant not found' using errcode = 'P0002';
  end if;
end;
$$;
