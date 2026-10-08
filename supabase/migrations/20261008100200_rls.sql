-- Sellbook database foundation, part 3: row level security and table privileges.
-- Authenticated owner only. anon has no policies AND no privileges.

alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.bills enable row level security;

-- Privileges: nothing for anon (now and for future tables), CRUD for authenticated (RLS narrows it).
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant select, insert, update, delete on
  public.settings, public.products, public.variants,
  public.orders, public.order_items, public.bills
to authenticated;

-- Policies: one per command, owner only.
do $$
declare
  t text;
begin
  foreach t in array array['settings', 'products', 'variants', 'orders', 'order_items', 'bills']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;
