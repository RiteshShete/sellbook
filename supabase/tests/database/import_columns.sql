-- apply_product_import stores description and veg_type on NEW products, and still works without them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, email_confirmed_at) values ('a0000000-0000-4000-8000-000000000001', 'a@example.test', now());
update public.subscriptions set tier = 'pro', ends_at = '2099-01-01' where owner_id = 'a0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok($$select public.apply_product_import('{"file_name":"f.csv","mode":"add","categories":[],"add_variants":[],"updates":[],"products":[
  {"name":"Poha","category":null,"description":"Flattened rice","veg_type":"veg","variants":[{"name":"Std","price":"60.00","cost_price":null,"size_amount":null,"size_unit":null,"is_active":true}]},
  {"name":"Tea","category":null,"description":null,"veg_type":null,"variants":[{"name":"Std","price":"10.00","cost_price":null,"size_amount":null,"size_unit":null,"is_active":true}]},
  {"name":"Old","category":null,"variants":[{"name":"Std","price":"5.00","cost_price":null,"size_amount":null,"size_unit":null,"is_active":true}]}]}'::jsonb)$$, 'the import runs');
select is((select description || '/' || veg_type from public.products where name = 'Poha'), 'Flattened rice/veg', 'description and veg mark are stored');
select is((select description is null and veg_type is null from public.products where name = 'Tea'), true, 'nulls stay null');
select is((select veg_type is null from public.products where name = 'Old'), true, 'an old-style payload without the keys still works');

select * from finish();
rollback;
