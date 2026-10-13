-- Variant uniqueness is name + size per product. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.upsert_product('{"name":"Bhajani","variants":[
  {"name":"Retail","price":"100","size_amount":"500","size_unit":"g"},
  {"name":"Retail","price":"190","size_amount":"1000","size_unit":"g"}]}'::jsonb)$$,
  'same name with different sizes is allowed');
select is((select count(*)::int from public.variants where name = 'Retail'), 2, 'both variants exist');

select throws_ok($$select public.upsert_product('{"name":"Kanheri","variants":[
  {"name":"Retail","price":"100","size_amount":"500","size_unit":"g"},
  {"name":"retail","price":"110","size_amount":"500","size_unit":"g"}]}'::jsonb)$$,
  '23505', null, 'same name and same size is still a duplicate');
select throws_ok($$select public.upsert_product('{"name":"Vade","variants":[
  {"name":"Pack","price":"100"},{"name":"pack","price":"120"}]}'::jsonb)$$,
  '23505', null, 'same name with no size is still a duplicate');

select * from finish();
rollback;
