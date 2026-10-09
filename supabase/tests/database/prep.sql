-- Prep list: only "new", non-trashed orders; summed per product and variant in catalog order.
-- Everything is rolled back. Run with scripts/test-db-linked.sh (or `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

create temp table t (k text primary key, id uuid);
grant all on t to public;
select public.init_settings();
-- Cake is listed first in the catalog, Bread second; Cake's variants: 500 g then 1 kg.
select public.upsert_product('{"name":"Cake","sort_order":0,"variants":[{"name":"500 g","price":"250"},{"name":"1 kg","price":"480"}]}'::jsonb);
select public.upsert_product('{"name":"Bread","sort_order":1,"variants":[{"name":"Loaf","price":"40"}]}'::jsonb);
insert into t (k, id) select 'v500', id from public.variants where name = '500 g';
insert into t (k, id) select 'v1kg', id from public.variants where name = '1 kg';
insert into t (k, id) select 'loaf', id from public.variants where name = 'Loaf';

create function pg_temp.vid(p_key text) returns uuid language sql as $$ select id from t where k = p_key $$;
create function pg_temp.mk(p_key text, p_items jsonb) returns void language sql as $$
  insert into t (k, id) select p_key, (public.create_order(jsonb_build_object('customer_name', p_key,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('variant_id', pg_temp.vid(e ->> 0),
                                                           'quantity', (e ->> 1)::int)), '[]'::jsonb)
                from jsonb_array_elements(p_items) e)))).id
$$;
create function pg_temp.mv(p_key text, p_status public.order_status) returns void language sql as $$
  select public.set_order_status(pg_temp.vid(p_key), p_status,
    (select version_no from public.orders where id = pg_temp.vid(p_key)))
$$;

select is(public.prep_list(), '{"orders":0,"products":[]}'::jsonb, 'nothing to prepare yet');

-- Counted: A and B (new). Not counted: C (ready), D (trashed), E (delivered), F (new, no items).
select pg_temp.mk('A', '[["v1kg",2],["v500",1]]');
select pg_temp.mk('B', '[["v1kg",3],["loaf",4]]');
select pg_temp.mk('C', '[["v1kg",10]]');
select pg_temp.mv('C', 'ready');
select pg_temp.mk('D', '[["loaf",5]]');
select public.trash_order(pg_temp.vid('D'));
select pg_temp.mk('E', '[["v500",7]]');
select pg_temp.mv('E', 'ready');
select pg_temp.mv('E', 'delivered');
select pg_temp.mk('F', '[]');
-- A variant trashed after it was ordered still has to be made.
select public.trash_variant(pg_temp.vid('v500'));

create temp table r as select public.prep_list() as j;
grant all on r to public;

select is((select (j ->> 'orders')::int from r), 2, 'only the 2 new orders with items count');
select is((select jsonb_array_length(j -> 'products') from r), 2, 'only products that were ordered');
select is((select j #>> '{products,0,name}' from r), 'Cake', 'catalog order: Cake first');
select is((select (j #>> '{products,0,quantity}')::int from r), 6, 'Cake: 2 + 1 + 3');
select is((select (j #>> '{products,0,orders}')::int from r), 2, 'Cake is in 2 orders');
select is((select j #>> '{products,0,variants,0,name}' from r), '500 g', 'variant catalog order: 500 g first');
select is((select (j #>> '{products,0,variants,0,quantity}')::int from r), 1, '500 g x 1 (trashed variant still listed)');
select is((select j #>> '{products,0,variants,1,name}' from r), '1 kg', 'then 1 kg');
select is((select (j #>> '{products,0,variants,1,quantity}')::int from r), 5, '1 kg: 2 + 3 (ready order C excluded)');
select is((select (j #>> '{products,0,variants,1,orders}')::int from r), 2, '1 kg is in 2 orders');
select is((select j #>> '{products,1,name}' from r), 'Bread', 'then Bread');
select is((select (j #>> '{products,1,quantity}')::int from r), 4, 'Bread: 4 (trashed order D excluded)');

-- Marking an order ready takes it off the list.
select pg_temp.mv('B', 'ready');
select is((public.prep_list() #>> '{products,0,quantity}')::int, 3, 'after B is ready, Cake = 3');

-- Another owner sees nothing; anon cannot call it.
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is(public.prep_list(), '{"orders":0,"products":[]}'::jsonb, 'other owner: empty');
reset role;
set local role anon;
select throws_ok($$select public.prep_list()$$, '42501', null, 'anon cannot read the prep list');

select * from finish();
rollback;
