-- Storefront S1, part 3 of 3: functions.
-- Pattern (as in the plans migration): the SECURITY DEFINER body lives in app_private (not exposed by the API) and a thin
-- SECURITY INVOKER wrapper with the same name lives in public. Every definer body checks auth.uid() / the caller's role as
-- its first statements and sets search_path = ''. Money crosses the API as numbers (rupees); the app converts to paise.
-- Errors (STOREFRONT_PLAN Appendix B): SB420 closed/limit, SB421 minimum, SB422 item, SB423 date, SB424 open orders,
-- SB425 wrong state, SB426 blocked, SB427 invalid input, SB428 invite, SB429 daily cap.

-- ---------------------------------------------------------------------------
-- 0) Helpers
-- ---------------------------------------------------------------------------
-- Patch an existing function's source in place. Fails loudly when the text to change is not there, so a later edit of the
-- original cannot silently skip a change. (CR is dropped: migration files may have been checked out with CRLF.)
create function app_private.patch_function(p_sig regprocedure, p_from text, p_to text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_def text := replace(pg_get_functiondef(p_sig), E'\r', '');
begin
  if position(p_from in v_def) = 0 then
    raise exception 'patch target not found in %: %', p_sig, p_from;
  end if;
  execute replace(v_def, p_from, p_to);
end;
$$;

create function app_private.valid_vpa(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select coalesce(p ~ '^[a-zA-Z0-9.\-_]{2,255}@[a-zA-Z]{2,64}$', false); $$; -- src/lib/upi.ts allows 256 (Postgres caps a repeat at 255)

-- Per-owner order number for a definer caller (next_order_no() reads auth.uid(), which is the customer here).
create function app_private.next_order_no_for(p_owner uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sellbook:order_no:' || p_owner::text, 0));
  select coalesce(max(order_no), 0) + 1 into v_next from public.orders where owner_id = p_owner;
  return v_next;
end;
$$;

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated; -- only request_account_deletion() writes

-- ---------------------------------------------------------------------------
-- 1) Public storefront (anon)
-- ---------------------------------------------------------------------------
create function app_private.storefront_shop(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shops;
  st public.settings;
  v_plan record;
begin
  select * into s from public.shops
   where lower(slug) = lower(coalesce(p_slug, '')) and is_published and deleted_at is null;
  if not found then
    return null;
  end if;
  select * into st from public.settings where owner_id = s.owner_id;
  select * into v_plan from app_private.plan_state(s.owner_id);
  return jsonb_build_object(
    'slug', s.slug,
    'name', coalesce(st.shop_name, ''),
    'tagline', s.tagline,
    'banner_text', s.banner_text,
    'logo_path', s.logo_path,
    'whatsapp', s.whatsapp,
    'city', s.city,
    'fssai_no', s.fssai_no,
    -- a shop whose plan has ended looks "closed" to customers (they never see plan details)
    'accepts_orders', s.accepts_orders and coalesce(v_plan.status in ('trial', 'active'), false),
    'closed_message', s.closed_message,
    'delivery_mode', s.delivery_mode,
    'delivery_fee', s.delivery_fee,
    'free_delivery_above', s.free_delivery_above,
    'min_order', s.min_order,
    'lead_time_hours', s.lead_time_hours,
    'delivery_note', s.delivery_note,
    'pay_upi', s.pay_upi and app_private.valid_vpa(st.upi_id) and coalesce(btrim(st.payee_name), '') <> '',
    'pay_cod', s.pay_cod,
    'pickup_address', case when s.delivery_mode in ('pickup', 'both') then nullif(btrim(st.shop_address), '') end,
    'earliest_date', ((now() + make_interval(hours => s.lead_time_hours)) at time zone 'Asia/Kolkata')::date
  );
end;
$$;

-- Never returns cost_price, owner_id or scheduled (not yet started) offers.
create function app_private.storefront_catalog(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shops;
begin
  select * into s from public.shops
   where lower(slug) = lower(coalesce(p_slug, '')) and is_published and deleted_at is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sort_order', c.sort_order)
                       order by c.sort_order, lower(c.name))
        from public.categories c
       where c.owner_id = s.owner_id and c.deleted_at is null), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'category_id', p.category_id, 'name', p.name,
          'description', p.description, 'ingredients', p.ingredients, 'nutrition', p.nutrition,
          'allergens', to_jsonb(p.allergens), 'veg_type', p.veg_type, 'shelf_life', p.shelf_life,
          'is_available', p.is_available, 'image_paths', to_jsonb(p.image_paths),
          'variants', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'id', v.id, 'name', v.name, 'size_amount', v.size_amount, 'size_unit', v.size_unit,
                'price', v.price,
                'offer_price', case when public.effective_price(v) < v.price then v.offer_price end,
                'offer_label', case when public.effective_price(v) < v.price then v.offer_label end,
                'offer_ends_at', case when public.effective_price(v) < v.price then v.offer_ends_at end,
                'effective_price', public.effective_price(v)) order by v.sort_order, v.price), '[]'::jsonb)
              from public.variants v
             where v.product_id = p.id and v.deleted_at is null and v.is_active))
        order by p.sort_order, lower(p.name))
        from public.products p
       where p.owner_id = s.owner_id and p.deleted_at is null and p.is_active
         and exists (select 1 from public.variants v2
                      where v2.product_id = p.id and v2.deleted_at is null and v2.is_active)), '[]'::jsonb)
  );
end;
$$;

create function app_private.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
    and not (p_slug = any (app_private.reserved_slugs()))
    and not exists (select 1 from public.shops where lower(slug) = lower(p_slug) and deleted_at is null), false);
$$;

-- ---------------------------------------------------------------------------
-- 2) Who am I, customer profile and addresses
-- ---------------------------------------------------------------------------
create function app_private.my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'is_owner', exists (select 1 from public.shops where owner_id = v_uid and deleted_at is null),
    'shop_slug', (select slug from public.shops where owner_id = v_uid and deleted_at is null),
    'has_customer_profile', exists (select 1 from public.customer_profiles where user_id = v_uid));
end;
$$;

create function app_private.register_customer(p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phone text := public.normalize_phone(p_phone);
  v_auth_phone text;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 100 or v_phone is null or v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'check your name and mobile number' using errcode = 'SB427';
  end if;
  -- A phone sign-up already proves which number the account has; it must be the one given.
  select nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') into v_auth_phone from auth.users where id = v_uid;
  if v_auth_phone is not null and v_auth_phone <> v_phone then
    raise exception 'use the mobile number you signed up with' using errcode = 'SB427';
  end if;
  -- An account already used as a shop account (settings, no shop yet) must not become customer-only.
  if exists (select 1 from public.settings where owner_id = v_uid)
     and not exists (select 1 from public.shops where owner_id = v_uid) then
    raise exception 'use a different login to order as a customer' using errcode = 'SB427';
  end if;

  insert into public.customer_profiles (user_id, name, phone) values (v_uid, v_name, v_phone)
  on conflict (user_id) do update set name = excluded.name;

  -- Customers hold no plan: remove the trial the sign-up trigger gave them (only if they have no shop).
  delete from public.subscriptions s
   where s.owner_id = v_uid and not exists (select 1 from public.shops where owner_id = v_uid);
  return jsonb_build_object('user_id', v_uid, 'name', v_name, 'phone', v_phone);
exception when unique_violation then
  raise exception 'this mobile number is already registered' using errcode = 'SB427';
end;
$$;

create function app_private.upsert_address(p jsonb)
returns public.customer_addresses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_phone text := public.normalize_phone(p ->> 'phone');
  v_row public.customer_addresses;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_id is null then
    insert into public.customer_addresses (user_id, label, name, phone, line1, line2, area, city, pincode, landmark, is_default)
    values (v_uid, nullif(btrim(p ->> 'label'), ''), btrim(p ->> 'name'), v_phone, btrim(p ->> 'line1'),
            nullif(btrim(p ->> 'line2'), ''), nullif(btrim(p ->> 'area'), ''), btrim(p ->> 'city'),
            p ->> 'pincode', nullif(btrim(p ->> 'landmark'), ''), coalesce((p ->> 'is_default')::boolean, false))
    returning * into v_row;
  else
    update public.customer_addresses
       set label = nullif(btrim(p ->> 'label'), ''), name = btrim(p ->> 'name'), phone = v_phone,
           line1 = btrim(p ->> 'line1'), line2 = nullif(btrim(p ->> 'line2'), ''),
           area = nullif(btrim(p ->> 'area'), ''), city = btrim(p ->> 'city'), pincode = p ->> 'pincode',
           landmark = nullif(btrim(p ->> 'landmark'), ''),
           is_default = coalesce((p ->> 'is_default')::boolean, is_default)
     where id = v_id and user_id = v_uid and deleted_at is null
    returning * into v_row;
    if not found then
      raise exception 'address not found' using errcode = 'P0002';
    end if;
  end if;
  if v_row.is_default then
    update public.customer_addresses set is_default = false
     where user_id = v_uid and id <> v_row.id and is_default;
  end if;
  return v_row;
end;
$$;

create function app_private.delete_address(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.customer_addresses set deleted_at = now(), is_default = false
   where id = p_id and user_id = (select auth.uid()) and deleted_at is null;
  if not found then
    raise exception 'address not found' using errcode = 'P0002';
  end if;
end;
$$;

create function app_private.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.account_deletion_requests (user_id) values ((select auth.uid()))
  on conflict (user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Placing and following an order (customer)
-- ---------------------------------------------------------------------------
-- The same JSON for a fresh order and for an idempotent retry. UPI details only while unpaid UPI.
create function app_private.place_order_result(p_order uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_id', o.id,
    'order_no', o.order_no,
    'breakdown', jsonb_build_object(
      'subtotal', (select coalesce(sum(i.line_total), 0) from public.order_items i where i.order_id = o.id),
      'offer_savings', (select coalesce(sum((coalesce(i.list_price, i.unit_price) - i.unit_price) * i.quantity), 0)
                          from public.order_items i where i.order_id = o.id),
      'delivery_fee', o.delivery_fee,
      'total', o.total),
    'payment', jsonb_build_object(
      'method', o.payment_method,
      'upi_id', case when o.payment_method = 'upi' and o.payment_status = 'pending' then s.upi_id end,
      'payee_name', case when o.payment_method = 'upi' and o.payment_status = 'pending' then s.payee_name end))
  from public.orders o
  join public.settings s on s.owner_id = o.owner_id
  where o.id = p_order;
$$;

create function app_private.place_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_allowed text[] := array['slug', 'items', 'fulfilment', 'address', 'address_id', 'requested_for', 'notes',
                            'payment_method', 'idempotency_key'];
  v_bad text;
  v_prof public.customer_profiles;
  v_shop public.shops;
  v_set public.settings;
  v_plan record;
  v_key uuid;
  v_existing uuid;
  v_fulf text := p ->> 'fulfilment';
  v_method text := p ->> 'payment_method';
  v_date date;
  v_earliest date;
  v_notes text := nullif(btrim(coalesce(p ->> 'notes', '')), '');
  v_addr jsonb;
  v_a public.customer_addresses;
  v_e jsonb;
  v_missing uuid[] := '{}';
  v_nlines integer;
  v_subtotal numeric := 0;
  v_savings numeric := 0;
  v_fee numeric := 0;
  v_total numeric;
  v_lines jsonb := '[]'::jsonb;
  r record;
  v_oid uuid;
  v_name text;
  v_phone text;
begin
  -- 1) caller
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_prof from public.customer_profiles where user_id = v_uid;
  if not found then
    raise exception 'register as a customer first' using errcode = '42501';
  end if;

  -- 2) input shape: nothing the browser should not send (no price, total or owner id)
  if jsonb_typeof(p) <> 'object' then
    raise exception 'invalid order' using errcode = 'SB427';
  end if;
  select k into v_bad from jsonb_object_keys(p) k where k <> all (v_allowed) limit 1;
  if v_bad is not null then
    raise exception 'unexpected field: %', v_bad using errcode = 'SB427';
  end if;
  if jsonb_typeof(p -> 'items') is distinct from 'array' then
    raise exception 'the cart is empty' using errcode = 'SB427';
  end if;
  for v_e in select value from jsonb_array_elements(p -> 'items') loop
    if jsonb_typeof(v_e) <> 'object' or exists (select 1 from jsonb_object_keys(v_e) k where k not in ('variant_id', 'qty'))
       or jsonb_typeof(v_e -> 'qty') is distinct from 'number' or coalesce(v_e ->> 'qty', '') !~ '^[0-9]{1,3}$'
       or coalesce(v_e ->> 'variant_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'check your cart' using errcode = 'SB427';
    end if;
  end loop;
  begin
    v_key := (p ->> 'idempotency_key')::uuid;
    v_date := (p ->> 'requested_for')::date;
  exception when others then
    raise exception 'check the order details' using errcode = 'SB427';
  end;
  if v_key is null or v_date is null or v_fulf not in ('delivery', 'pickup') or v_method not in ('upi', 'cod')
     or (v_notes is not null and char_length(v_notes) > 300) then
    raise exception 'check the order details' using errcode = 'SB427';
  end if;

  -- 3) shop
  select * into v_shop from public.shops
   where lower(slug) = lower(coalesce(p ->> 'slug', '')) and is_published and deleted_at is null;
  if not found or not v_shop.accepts_orders then
    raise exception 'this shop cannot take orders right now' using errcode = 'SB420';
  end if;
  select * into v_set from public.settings where owner_id = v_shop.owner_id;
  select * into v_plan from app_private.plan_state(v_shop.owner_id);
  if coalesce(v_plan.status, 'locked') not in ('trial', 'active') then
    raise exception 'this shop cannot take orders right now' using errcode = 'SB420';
  end if;

  -- 4) blocked
  if exists (select 1 from public.shop_customers
              where owner_id = v_shop.owner_id and customer_user_id = v_uid and is_blocked) then
    raise exception 'this shop cannot take your order' using errcode = 'SB426';
  end if;

  -- 5) a retry of an order that already went through
  select id into v_existing from public.orders where customer_user_id = v_uid and idempotency_key = v_key;
  if found then
    return app_private.place_order_result(v_existing);
  end if;

  -- 6) fulfilment and payment must be allowed by the shop
  if (v_fulf = 'delivery' and v_shop.delivery_mode = 'pickup') or (v_fulf = 'pickup' and v_shop.delivery_mode = 'delivery') then
    raise exception 'check the order details' using errcode = 'SB427';
  end if;
  if (v_method = 'upi' and not (v_shop.pay_upi and app_private.valid_vpa(v_set.upi_id)
                                and coalesce(btrim(v_set.payee_name), '') <> ''))
     or (v_method = 'cod' and not v_shop.pay_cod) then
    raise exception 'check the order details' using errcode = 'SB427';
  end if;

  -- 7) lines: merge duplicates, then price everything from the catalogue (never from the browser)
  select count(*) into v_nlines from (select distinct (e ->> 'variant_id') from jsonb_array_elements(p -> 'items') e) d;
  if v_nlines < 1 or v_nlines > 30 then
    raise exception 'check your cart' using errcode = 'SB427';
  end if;
  for r in
    select l.variant_id, l.qty, v.id as vid, pr.id as pid, v.name as vname, pr.name as pname, v.price,
           public.effective_price(v) as eff, v.cost_price, v.size_amount, v.size_unit, v.offer_label, l.pos
      from (select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'qty')::integer) as qty, min(ord) as pos
              from jsonb_array_elements(p -> 'items') with ordinality t(e, ord) group by 1) l
      left join public.variants v on v.id = l.variant_id and v.owner_id = v_shop.owner_id
                                  and v.deleted_at is null and v.is_active
      left join public.products pr on pr.id = v.product_id and pr.deleted_at is null and pr.is_active and pr.is_available
     order by l.pos
  loop
    if r.qty < 1 or r.qty > 50 then
      raise exception 'check the quantities' using errcode = 'SB427';
    end if;
    if r.vid is null or r.pid is null then
      v_missing := v_missing || r.variant_id;
      continue;
    end if;
    v_subtotal := v_subtotal + r.eff * r.qty;
    v_savings := v_savings + (r.price - r.eff) * r.qty;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', r.vid, 'product_name', r.pname, 'variant_name', r.vname, 'unit_price', r.eff,
      'list_price', r.price, 'offer_label', case when r.eff < r.price then r.offer_label end,
      'cost_price', r.cost_price, 'size_amount', r.size_amount, 'size_unit', r.size_unit,
      'quantity', r.qty, 'position', jsonb_array_length(v_lines));
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'some items are no longer available' using errcode = 'SB422', hint = array_to_string(v_missing, ',');
  end if;

  -- 8) date, minimum, caps, delivery fee
  v_earliest := ((now() + make_interval(hours => v_shop.lead_time_hours)) at time zone 'Asia/Kolkata')::date;
  if v_date < v_earliest or v_date > ((now() at time zone 'Asia/Kolkata')::date + 30) then
    raise exception 'the earliest date is %', to_char(v_earliest, 'DD Mon') using errcode = 'SB423', hint = v_earliest::text;
  end if;
  if v_subtotal < v_shop.min_order then
    raise exception 'the minimum order is Rs %', v_shop.min_order using errcode = 'SB421';
  end if;
  if (select count(*) from public.orders o
       where o.customer_user_id = v_uid and o.owner_id = v_shop.owner_id and o.status in ('new', 'ready')
         and o.deleted_at is null) >= 5 then
    raise exception 'please wait until your earlier orders are completed' using errcode = 'SB424';
  end if;
  if (select count(*) from public.orders o
       where o.customer_user_id = v_uid and o.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too many orders today' using errcode = 'SB429';
  end if;
  if v_fulf = 'delivery' and not (v_shop.free_delivery_above is not null and v_subtotal >= v_shop.free_delivery_above) then
    v_fee := v_shop.delivery_fee;
  end if;
  v_total := v_subtotal + v_fee;
  if v_total > 50000 then
    raise exception 'check your order total' using errcode = 'SB427';
  end if;

  -- 9) address snapshot (delivery only)
  if v_fulf = 'delivery' then
    if p ? 'address_id' then
      select * into v_a from public.customer_addresses
       where id = (p ->> 'address_id')::uuid and user_id = v_uid and deleted_at is null;
      if not found then
        raise exception 'check the delivery address' using errcode = 'SB427';
      end if;
      v_addr := jsonb_build_object('name', v_a.name, 'phone', v_a.phone, 'line1', v_a.line1, 'line2', v_a.line2,
                                   'area', v_a.area, 'city', v_a.city, 'pincode', v_a.pincode, 'landmark', v_a.landmark);
    else
      v_e := p -> 'address';
      if jsonb_typeof(v_e) is distinct from 'object'
         or exists (select 1 from jsonb_object_keys(v_e) k
                     where k not in ('name', 'phone', 'line1', 'line2', 'area', 'city', 'pincode', 'landmark'))
         or char_length(btrim(coalesce(v_e ->> 'name', ''))) not between 1 and 100
         or public.normalize_phone(v_e ->> 'phone') is null
         or char_length(btrim(coalesce(v_e ->> 'line1', ''))) not between 1 and 200
         or char_length(btrim(coalesce(v_e ->> 'city', ''))) not between 1 and 100
         or coalesce(v_e ->> 'pincode', '') !~ '^[1-9][0-9]{5}$' then
        raise exception 'check the delivery address' using errcode = 'SB427';
      end if;
      v_addr := jsonb_build_object('name', btrim(v_e ->> 'name'), 'phone', public.normalize_phone(v_e ->> 'phone'),
        'line1', btrim(v_e ->> 'line1'), 'line2', nullif(btrim(coalesce(v_e ->> 'line2', '')), ''),
        'area', nullif(btrim(coalesce(v_e ->> 'area', '')), ''), 'city', btrim(v_e ->> 'city'),
        'pincode', v_e ->> 'pincode', 'landmark', nullif(btrim(coalesce(v_e ->> 'landmark', '')), ''));
    end if;
    v_name := v_addr ->> 'name';
    v_phone := v_addr ->> 'phone';
  else
    v_name := v_prof.name;
    v_phone := v_prof.phone;
  end if;

  -- 10) write. The plan triggers judge the SHOP (row owner); a limit or ended plan reads as "closed" to the customer.
  begin
    insert into public.orders (owner_id, order_no, customer_name, customer_phone, order_date, due_date, notes, discount,
                               source, customer_user_id, fulfilment, delivery_address, delivery_fee,
                               confirmation_status, payment_method, idempotency_key)
    values (v_shop.owner_id, app_private.next_order_no_for(v_shop.owner_id), v_name, v_phone,
            (now() at time zone 'Asia/Kolkata')::date, v_date, v_notes, 0,
            'customer', v_uid, v_fulf, v_addr, v_fee, 'pending', v_method, v_key)
    returning id into v_oid;

    insert into public.order_items (owner_id, order_id, variant_id, product_name, variant_name, unit_price, list_price,
                                    offer_label, cost_price, size_amount, size_unit, quantity, position)
    select v_shop.owner_id, v_oid, (l ->> 'variant_id')::uuid, l ->> 'product_name', l ->> 'variant_name',
           (l ->> 'unit_price')::numeric, (l ->> 'list_price')::numeric, l ->> 'offer_label',
           (l ->> 'cost_price')::numeric, (l ->> 'size_amount')::numeric, (l ->> 'size_unit')::public.size_unit,
           (l ->> 'quantity')::integer, (l ->> 'position')::integer
      from jsonb_array_elements(v_lines) l;
  exception when sqlstate 'SB411' then
    raise exception 'this shop cannot take orders right now' using errcode = 'SB420';
  end;

  perform public.record_order_version(v_oid, 'create', 'Customer order placed');
  insert into public.shop_customers (owner_id, customer_user_id, customer_name, customer_phone, order_count)
  values (v_shop.owner_id, v_uid, v_prof.name, v_prof.phone, 1)
  on conflict (owner_id, customer_user_id) do update
    set customer_name = excluded.customer_name, customer_phone = excluded.customer_phone,
        last_order_at = now(), order_count = public.shop_customers.order_count + 1;

  return app_private.place_order_result(v_oid);
end;
$$;

create function app_private.customer_orders_list(p_slug text, p_limit integer default 20, p_before timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
      from (
        select o.created_at, jsonb_build_object(
                 'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at, 'status', o.status,
                 'confirmation_status', o.confirmation_status, 'payment_status', o.payment_status,
                 'payment_claim_status', o.payment_claim_status, 'total', o.total) as j
          from public.orders o
          join public.shops s on s.owner_id = o.owner_id and lower(s.slug) = lower(coalesce(p_slug, ''))
         where o.customer_user_id = v_uid and o.deleted_at is null
           and (p_before is null or o.created_at < p_before)
         order by o.created_at desc
         limit least(greatest(coalesce(p_limit, 20), 1), 50)) x), '[]'::jsonb);
end;
$$;

-- Own order only. A missing order and someone else's order give the same answer.
create function app_private.customer_order_get(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  o public.orders;
  st public.settings;
  s public.shops;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into o from public.orders where id = p_order_id and customer_user_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  select * into st from public.settings where owner_id = o.owner_id;
  select * into s from public.shops where owner_id = o.owner_id;
  return jsonb_build_object(
    'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at, 'status', o.status,
    'confirmation_status', o.confirmation_status, 'payment_status', o.payment_status,
    'payment_claim_status', o.payment_claim_status, 'total', o.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_name', i.product_name, 'variant_name', i.variant_name, 'qty', i.quantity,
               'unit_price', i.unit_price, 'list_price', i.list_price, 'offer_label', i.offer_label)
             order by i.position)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'breakdown', (app_private.place_order_result(o.id) -> 'breakdown'),
    'fulfilment', o.fulfilment, 'address', o.delivery_address, 'requested_for', o.due_date, 'notes', o.notes,
    'decline_reason', o.decline_reason, 'payment_reject_reason', o.payment_reject_reason, 'claim_count', o.claim_count,
    'payment', (app_private.place_order_result(o.id) -> 'payment'),
    'shop', jsonb_build_object('name', coalesce(st.shop_name, ''), 'slug', s.slug, 'whatsapp', s.whatsapp));
end;
$$;

-- Runs one customer-side state change on an own order, with the order locked.
create function app_private.customer_lock_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into o from public.orders
   where id = p_order_id and customer_user_id = (select auth.uid()) and deleted_at is null for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  return o;
end;
$$;

create function app_private.claim_payment(p_order_id uuid, p_utr text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.customer_lock_order(p_order_id);
  v_utr text := nullif(btrim(coalesce(p_utr, '')), '');
begin
  if v_utr is not null and v_utr !~ '^[0-9]{12}$' then
    raise exception 'the UTR is 12 digits' using errcode = 'SB427';
  end if;
  if o.payment_method <> 'upi' or o.payment_status <> 'pending' or o.status = 'cancelled'
     or o.payment_claim_status not in ('none', 'rejected') or o.claim_count >= 3 then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  begin
    update public.orders
       set payment_claim_status = 'claimed', payment_claimed_at = now(), payment_reference = v_utr,
           payment_reject_reason = null, claim_count = claim_count + 1, version_no = version_no + 1
     where id = o.id;
  exception when sqlstate 'SB411' then
    raise exception 'this shop cannot take orders right now' using errcode = 'SB420';
  end;
  perform public.record_order_version(o.id, 'claim', 'Customer says payment is done');
  return jsonb_build_object('payment_claim_status', 'claimed');
end;
$$;

create function app_private.switch_to_cod(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.customer_lock_order(p_order_id);
begin
  if o.payment_method <> 'upi' or o.payment_status <> 'pending' or o.status = 'cancelled'
     or o.payment_claim_status not in ('none', 'rejected')
     or not (select pay_cod from public.shops where owner_id = o.owner_id) then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  begin
    update public.orders
       set payment_method = 'cod', payment_claim_status = 'none', payment_reference = null, version_no = version_no + 1
     where id = o.id;
  exception when sqlstate 'SB411' then
    raise exception 'this shop cannot take orders right now' using errcode = 'SB420';
  end;
  perform public.record_order_version(o.id, 'payment', 'Customer chose pay on delivery');
  return jsonb_build_object('payment_method', 'cod');
end;
$$;

create function app_private.cancel_my_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.customer_lock_order(p_order_id);
begin
  if o.confirmation_status <> 'pending' or o.payment_claim_status <> 'none' or o.status <> 'new' then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  begin
    update public.orders set status = 'cancelled', cancelled_from = 'new', version_no = version_no + 1 where id = o.id;
  exception when sqlstate 'SB411' then
    raise exception 'this shop cannot take orders right now' using errcode = 'SB420';
  end;
  perform public.record_order_version(o.id, 'customer_cancel', 'Cancelled by the customer');
  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Owner: shop, publish, offers, customer orders
-- ---------------------------------------------------------------------------
create function app_private.create_shop(p_invite text, p_slug text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_terms text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.shops where owner_id = v_uid) then
    raise exception 'you already have a shop' using errcode = 'SB427';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'enter the shop name' using errcode = 'SB427';
  end if;
  if not app_private.slug_available(v_slug) then
    raise exception 'that web address is not available' using errcode = 'SB427';
  end if;
  update public.shop_invites set used_by = v_uid, used_at = now()
   where code = btrim(coalesce(p_invite, '')) and used_by is null and expires_at > now();
  if not found then
    raise exception 'this invite code isn''t valid' using errcode = 'SB428';
  end if;

  insert into public.shops (owner_id, slug) values (v_uid, v_slug) returning id into v_id;
  insert into public.settings (owner_id, shop_name) values (v_uid, v_name)
  on conflict (owner_id) do update set shop_name = case when public.settings.shop_name = '' then excluded.shop_name
                                                        else public.settings.shop_name end;
  select raw_user_meta_data ->> 'terms_version' into v_terms from auth.users where id = v_uid;
  insert into public.subscriptions (owner_id, tier, ends_at, terms_version, terms_accepted_at)
  values (v_uid, 'trial', now() + make_interval(days => (select period_days from public.plan_limits where tier = 'trial')),
          v_terms, case when v_terms is not null then now() end)
  on conflict (owner_id) do nothing;
  return jsonb_build_object('shop_id', v_id, 'slug', v_slug);
end;
$$;

create function app_private.update_shop(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
  v_allowed text[] := array['tagline', 'banner_text', 'city', 'fssai_no', 'delivery_note', 'closed_message', 'whatsapp',
                            'logo_path', 'accepts_orders', 'delivery_mode', 'delivery_fee', 'min_order',
                            'free_delivery_above', 'lead_time_hours', 'pay_upi', 'pay_cod'];
  v_bad text;
  v_row public.shops;
begin
  if jsonb_typeof(p) <> 'object' then
    raise exception 'invalid input' using errcode = 'SB427';
  end if;
  select k into v_bad from jsonb_object_keys(p) k where k <> all (v_allowed) limit 1;
  if v_bad is not null then
    raise exception 'unexpected field: %', v_bad using errcode = 'SB427';
  end if;
  if p ? 'logo_path' and nullif(p ->> 'logo_path', '') is not null
     and (p ->> 'logo_path' not like v_uid::text || '/%' or p ->> 'logo_path' like '%..%') then
    raise exception 'invalid picture' using errcode = 'SB427';
  end if;
  update public.shops s set
    tagline = case when p ? 'tagline' then nullif(btrim(p ->> 'tagline'), '') else tagline end,
    banner_text = case when p ? 'banner_text' then nullif(btrim(p ->> 'banner_text'), '') else banner_text end,
    city = case when p ? 'city' then nullif(btrim(p ->> 'city'), '') else city end,
    fssai_no = case when p ? 'fssai_no' then nullif(btrim(p ->> 'fssai_no'), '') else fssai_no end,
    delivery_note = case when p ? 'delivery_note' then nullif(btrim(p ->> 'delivery_note'), '') else delivery_note end,
    closed_message = case when p ? 'closed_message' then nullif(btrim(p ->> 'closed_message'), '') else closed_message end,
    whatsapp = case when p ? 'whatsapp' then public.normalize_phone(p ->> 'whatsapp') else whatsapp end,
    logo_path = case when p ? 'logo_path' then nullif(p ->> 'logo_path', '') else logo_path end,
    accepts_orders = coalesce((p ->> 'accepts_orders')::boolean, accepts_orders),
    delivery_mode = coalesce(p ->> 'delivery_mode', delivery_mode),
    delivery_fee = coalesce((p ->> 'delivery_fee')::numeric, delivery_fee),
    min_order = coalesce((p ->> 'min_order')::numeric, min_order),
    free_delivery_above = case when p ? 'free_delivery_above' then (p ->> 'free_delivery_above')::numeric
                               else free_delivery_above end,
    lead_time_hours = coalesce((p ->> 'lead_time_hours')::integer, lead_time_hours),
    pay_upi = coalesce((p ->> 'pay_upi')::boolean, pay_upi),
    pay_cod = coalesce((p ->> 'pay_cod')::boolean, pay_cod)
   where s.owner_id = v_uid
  returning * into v_row;
  return to_jsonb(v_row) - 'id' - 'owner_id' - 'deleted_at';
end;
$$;

create function app_private.set_shop_published(p boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
  s public.shops;
  st public.settings;
  v_missing text[] := '{}';
  v_plan record;
  u record;
begin
  select * into s from public.shops where owner_id = v_uid;
  if not p then
    update public.shops set is_published = false where owner_id = v_uid;
    return jsonb_build_object('published', false, 'missing', '[]'::jsonb);
  end if;
  select * into st from public.settings where owner_id = v_uid;
  select * into u from auth.users where id = v_uid;
  select * into v_plan from app_private.plan_state(v_uid);
  if coalesce(btrim(st.shop_name), '') = '' then v_missing := array_append(v_missing, 'shop_name'); end if;
  if not exists (select 1 from public.variants v join public.products pr on pr.id = v.product_id
                  where v.owner_id = v_uid and v.deleted_at is null and v.is_active and v.price > 0
                    and pr.deleted_at is null and pr.is_active and pr.is_available) then
    v_missing := array_append(v_missing, 'available_variant');
  end if;
  if s.whatsapp is null then v_missing := array_append(v_missing, 'whatsapp'); end if;
  if u.email is null or u.email_confirmed_at is null then v_missing := array_append(v_missing, 'recovery_email'); end if;
  if not (s.pay_cod or (s.pay_upi and app_private.valid_vpa(st.upi_id) and coalesce(btrim(st.payee_name), '') <> '')) then
    v_missing := array_append(v_missing, 'payment_method');
  end if;
  if coalesce(v_plan.status, 'locked') not in ('trial', 'active') then v_missing := array_append(v_missing, 'plan_active'); end if;
  if cardinality(v_missing) > 0 then
    return jsonb_build_object('published', s.is_published, 'missing', to_jsonb(v_missing));
  end if;
  update public.shops set is_published = true where owner_id = v_uid;
  return jsonb_build_object('published', true, 'missing', '[]'::jsonb);
end;
$$;

-- p = {variant_ids, percent_off | amount_off (rupees), label?, starts_on, ends_on}: inclusive IST dates.
create function app_private.bulk_offer(p jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
  v_ids uuid[];
  v_pct numeric := nullif(p ->> 'percent_off', '')::numeric;
  v_amt numeric := nullif(p ->> 'amount_off', '')::numeric;
  v_from date := (p ->> 'starts_on')::date;
  v_to date := (p ->> 'ends_on')::date;
  n integer;
begin
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p -> 'variant_ids') x;
  if v_ids is null or (v_pct is null) = (v_amt is null) or v_from is null or v_to is null or v_to < v_from
     or (v_pct is not null and (v_pct < 1 or v_pct > 90)) or (v_amt is not null and v_amt <= 0) then
    raise exception 'check the offer details' using errcode = 'SB427';
  end if;
  -- an offer must stay above zero (the table already requires it to be below the normal price)
  if exists (select 1 from public.variants v
              where v.owner_id = v_uid and v.id = any (v_ids) and v.deleted_at is null
                and (case when v_pct is not null then round(v.price * (1 - v_pct / 100), 2) else v.price - v_amt end) <= 0) then
    raise exception 'the offer price must be above zero and below the normal price' using errcode = 'SB427';
  end if;
  update public.variants v
     set offer_price = case when v_pct is not null then round(price * (1 - v_pct / 100), 2) else price - v_amt end,
         offer_label = nullif(btrim(coalesce(p ->> 'label', '')), ''),
         offer_starts_at = (v_from::timestamp at time zone 'Asia/Kolkata'),
         offer_ends_at = ((v_to + 1)::timestamp at time zone 'Asia/Kolkata')
   where v.owner_id = v_uid and v.id = any (v_ids) and v.deleted_at is null;
  get diagnostics n = row_count;
  return n;
exception when check_violation then
  raise exception 'the offer price must be below the normal price' using errcode = 'SB427';
end;
$$;

create function app_private.end_offers(p_variant_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
  n integer;
begin
  update public.variants
     set offer_price = null, offer_label = null, offer_starts_at = null, offer_ends_at = null
   where owner_id = v_uid and offer_price is not null and (p_variant_ids is null or id = any (p_variant_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Locks one of the caller's customer orders and checks the version (SB409 when stale).
create function app_private.owner_lock_order(p_id uuid, p_version integer)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
  o public.orders;
begin
  select * into o from public.orders where id = p_id and owner_id = v_uid and deleted_at is null for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if o.version_no <> p_version then
    raise exception 'order changed on another device' using errcode = 'SB409';
  end if;
  return o;
end;
$$;

create function app_private.confirm_order(p_id uuid, p_note text, v integer)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.owner_lock_order(p_id, v);
begin
  if o.source <> 'customer' or o.confirmation_status <> 'pending' or o.status = 'cancelled' then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  update public.orders
     set confirmation_status = 'confirmed', version_no = version_no + 1,
         notes = case when nullif(btrim(coalesce(p_note, '')), '') is null then notes
                      else coalesce(notes || E'\n', '') || 'Shop: ' || btrim(p_note) end
   where id = o.id;
  perform public.record_order_version(o.id, 'confirm', 'Order confirmed');
  select * into o from public.orders where id = o.id;
  return o;
end;
$$;

create function app_private.decline_order(p_id uuid, p_reason text, v integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.owner_lock_order(p_id, v);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'give a reason' using errcode = 'SB427';
  end if;
  if o.source <> 'customer' or o.confirmation_status <> 'pending' or o.status = 'cancelled' then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  update public.orders
     set confirmation_status = 'declined', decline_reason = v_reason, status = 'cancelled', cancelled_from = 'new',
         version_no = version_no + 1
   where id = o.id;
  perform public.record_order_version(o.id, 'decline', 'Order declined: ' || v_reason);
  return jsonb_build_object('refund_needed', o.payment_status = 'paid' or o.payment_claim_status = 'claimed');
end;
$$;

create function app_private.verify_payment(p_id uuid, v integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.owner_lock_order(p_id, v);
  v_dup integer;
begin
  if o.source <> 'customer' or o.payment_method <> 'upi' or o.payment_status <> 'pending'
     or o.payment_claim_status not in ('claimed', 'none') or o.status = 'cancelled' then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  update public.orders
     set payment_status = 'paid', payment_mode = 'online', payment_claim_status = 'verified',
         payment_verified_at = now(), version_no = version_no + 1
   where id = o.id;
  perform public.record_order_version(o.id, 'verify', 'Payment verified');
  select order_no into v_dup from public.orders
   where owner_id = o.owner_id and id <> o.id and payment_reference is not null
     and payment_reference = o.payment_reference and deleted_at is null limit 1;
  return jsonb_build_object('duplicate_utr_order_no', v_dup);
end;
$$;

create function app_private.reject_payment(p_id uuid, p_reason text, v integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := app_private.owner_lock_order(p_id, v);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'give a reason' using errcode = 'SB427';
  end if;
  if o.payment_claim_status <> 'claimed' then
    raise exception 'this can''t be done at this stage' using errcode = 'SB425';
  end if;
  update public.orders
     set payment_claim_status = 'rejected', payment_reject_reason = v_reason, version_no = version_no + 1
   where id = o.id;
  perform public.record_order_version(o.id, 'reject', 'Payment not received: ' || v_reason);
  return jsonb_build_object('payment_claim_status', 'rejected');
end;
$$;

create function app_private.set_customer_block(p_customer uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
begin
  update public.shop_customers set is_blocked = coalesce(p_blocked, false)
   where owner_id = v_uid and customer_user_id = p_customer;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
end;
$$;

create function app_private.my_customers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app_private.require_shop();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'customer_user_id', c.customer_user_id, 'customer_name', c.customer_name,
             'customer_phone', c.customer_phone, 'first_order_at', c.first_order_at, 'last_order_at', c.last_order_at,
             'order_count', c.order_count, 'is_blocked', c.is_blocked, 'owner_note', c.owner_note)
           order by c.last_order_at desc)
      from public.shop_customers c where c.owner_id = v_uid), '[]'::jsonb);
end;
$$;

create function app_private.admin_create_invite(p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
begin
  if not app_private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.shop_invites (code, created_by, note) values (v_code, (select auth.uid()), nullif(btrim(p_note), ''));
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Public wrappers (SECURITY INVOKER, thin). Same name and signature as the body they call.
-- ---------------------------------------------------------------------------
create function public.storefront_shop(p_slug text) returns jsonb language sql stable security invoker set search_path = ''
  as $$ select app_private.storefront_shop(p_slug); $$;
create function public.storefront_catalog(p_slug text) returns jsonb language sql stable security invoker set search_path = ''
  as $$ select app_private.storefront_catalog(p_slug); $$;
create function public.slug_available(p_slug text) returns boolean language sql stable security invoker set search_path = ''
  as $$ select app_private.slug_available(p_slug); $$;
create function public.my_context() returns jsonb language sql stable security invoker set search_path = ''
  as $$ select app_private.my_context(); $$;
create function public.register_customer(p_name text, p_phone text) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.register_customer(p_name, p_phone); $$;
create function public.upsert_address(p jsonb) returns public.customer_addresses language sql security invoker set search_path = ''
  as $$ select * from app_private.upsert_address(p); $$;
create function public.delete_address(p_id uuid) returns void language sql security invoker set search_path = ''
  as $$ select app_private.delete_address(p_id); $$;
create function public.request_account_deletion() returns void language sql security invoker set search_path = ''
  as $$ select app_private.request_account_deletion(); $$;
create function public.place_order(p jsonb) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.place_order(p); $$;
create function public.customer_orders_list(p_slug text, p_limit integer default 20, p_before timestamptz default null)
  returns jsonb language sql stable security invoker set search_path = ''
  as $$ select app_private.customer_orders_list(p_slug, p_limit, p_before); $$;
create function public.customer_order_get(p_order_id uuid) returns jsonb language sql stable security invoker set search_path = ''
  as $$ select app_private.customer_order_get(p_order_id); $$;
create function public.claim_payment(p_order_id uuid, p_utr text default null) returns jsonb language sql security invoker
  set search_path = '' as $$ select app_private.claim_payment(p_order_id, p_utr); $$;
create function public.switch_to_cod(p_order_id uuid) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.switch_to_cod(p_order_id); $$;
create function public.cancel_my_order(p_order_id uuid) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.cancel_my_order(p_order_id); $$;
create function public.create_shop(p_invite text, p_slug text, p_name text) returns jsonb language sql security invoker
  set search_path = '' as $$ select app_private.create_shop(p_invite, p_slug, p_name); $$;
create function public.update_shop(p jsonb) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.update_shop(p); $$;
create function public.set_shop_published(p boolean) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.set_shop_published(p); $$;
create function public.bulk_offer(p jsonb) returns integer language sql security invoker set search_path = ''
  as $$ select app_private.bulk_offer(p); $$;
create function public.end_offers(p_variant_ids uuid[]) returns integer language sql security invoker set search_path = ''
  as $$ select app_private.end_offers(p_variant_ids); $$;
create function public.confirm_order(p_id uuid, p_note text, v integer) returns public.orders language sql security invoker
  set search_path = '' as $$ select * from app_private.confirm_order(p_id, p_note, v); $$;
create function public.decline_order(p_id uuid, p_reason text, v integer) returns jsonb language sql security invoker
  set search_path = '' as $$ select app_private.decline_order(p_id, p_reason, v); $$;
create function public.verify_payment(p_id uuid, v integer) returns jsonb language sql security invoker set search_path = ''
  as $$ select app_private.verify_payment(p_id, v); $$;
create function public.reject_payment(p_id uuid, p_reason text, v integer) returns jsonb language sql security invoker
  set search_path = '' as $$ select app_private.reject_payment(p_id, p_reason, v); $$;
create function public.set_customer_block(p_customer uuid, p_blocked boolean) returns void language sql security invoker
  set search_path = '' as $$ select app_private.set_customer_block(p_customer, p_blocked); $$;
create function public.my_customers() returns jsonb language sql stable security invoker set search_path = ''
  as $$ select app_private.my_customers(); $$;
create function public.admin_create_invite(p_note text default null) returns text language sql security invoker
  set search_path = '' as $$ select app_private.admin_create_invite(p_note); $$;

-- ---------------------------------------------------------------------------
-- 6) Changes to existing functions (patched in place, see patch_function)
-- ---------------------------------------------------------------------------
-- History: the new columns are part of every snapshot, and rollback restores them together (decision: one consistent
-- state). Older versions have no such keys: the current value is kept (customer orders always have them).
select app_private.patch_function('public.slim_order_items(jsonb)'::regprocedure,
  $$'position', t.e -> 'position'$$,
  $$'position', t.e -> 'position', 'list_price', t.e -> 'list_price', 'offer_label', t.e -> 'offer_label'$$);

select app_private.patch_function('public.order_version_snapshot(uuid)'::regprocedure,
  $$'paid_at', o.paid_at,$$,
  $$'paid_at', o.paid_at,
    'delivery_fee', o.delivery_fee, 'confirmation_status', o.confirmation_status, 'decline_reason', o.decline_reason,
    'payment_method', o.payment_method, 'payment_claim_status', o.payment_claim_status,
    'payment_reference', o.payment_reference, 'payment_claimed_at', o.payment_claimed_at,
    'payment_verified_at', o.payment_verified_at, 'payment_reject_reason', o.payment_reject_reason,
    'claim_count', o.claim_count,$$);

-- A definer caller is not the owner: the history row must carry the ORDER's owner.
select app_private.patch_function('public.record_order_version(uuid,text,text)'::regprocedure,
  $$insert into public.order_versions (order_id, version_no, reason, summary, snapshot)$$,
  $$insert into public.order_versions (owner_id, order_id, version_no, reason, summary, snapshot)$$);
select app_private.patch_function('public.record_order_version(uuid,text,text)'::regprocedure,
  $$values (v_order.id, v_order.version_no, p_reason, p_summary, v_snap);$$,
  $$values (v_order.owner_id, v_order.id, v_order.version_no, p_reason, p_summary, v_snap);$$);

select app_private.patch_function('app_private.rollback_order(uuid,integer,integer)'::regprocedure,
  $$payment_mode = (s ->> 'payment_mode')::public.payment_mode,$$,
  $$payment_mode = (s ->> 'payment_mode')::public.payment_mode,
         delivery_fee = coalesce((s ->> 'delivery_fee')::numeric, delivery_fee),
         confirmation_status = coalesce(s ->> 'confirmation_status', confirmation_status),
         decline_reason = case when s ? 'confirmation_status' then s ->> 'decline_reason' else decline_reason end,
         payment_method = case when s ? 'confirmation_status' then s ->> 'payment_method' else payment_method end,
         payment_claim_status = coalesce(s ->> 'payment_claim_status', payment_claim_status),
         payment_reference = case when s ? 'confirmation_status' then s ->> 'payment_reference' else payment_reference end,
         payment_claimed_at = case when s ? 'confirmation_status' then (s ->> 'payment_claimed_at')::timestamptz
                                   else payment_claimed_at end,
         payment_verified_at = case when s ? 'confirmation_status' then (s ->> 'payment_verified_at')::timestamptz
                                    else payment_verified_at end,
         payment_reject_reason = case when s ? 'confirmation_status' then s ->> 'payment_reject_reason'
                                      else payment_reject_reason end,
         claim_count = coalesce((s ->> 'claim_count')::integer, claim_count),$$);
select app_private.patch_function('app_private.rollback_order(uuid,integer,integer)'::regprocedure,
  $$size_amount, size_unit, quantity, position)$$,
  $$size_amount, size_unit, quantity, position, list_price, offer_label)$$);
select app_private.patch_function('app_private.rollback_order(uuid,integer,integer)'::regprocedure,
  $$(i ->> 'quantity')::integer, (i ->> 'position')::integer$$,
  $$(i ->> 'quantity')::integer, (i ->> 'position')::integer,
         (i ->> 'list_price')::numeric, i ->> 'offer_label'$$);

-- B11: a customer order cannot be prepared or handed over before the shop has confirmed it.
select app_private.patch_function('public.set_order_status(uuid,public.order_status,integer)'::regprocedure,
  $$v_from := v_order.status;$$,
  $$v_from := v_order.status;
  if v_order.source = 'customer' and v_order.confirmation_status in ('pending', 'declined')
     and p_status in ('ready', 'delivered') then
    raise exception 'confirm this customer order first' using errcode = 'SB425';
  end if;$$);

-- Marking paid by hand also settles a payment claim; going back to pending clears the claim.
select app_private.patch_function('public.set_payment(uuid,public.payment_status,public.payment_mode,integer)'::regprocedure,
  $$payment_mode = case when p_status = 'paid' then p_mode end,$$,
  $$payment_mode = case when p_status = 'paid' then p_mode end,
         payment_claim_status = case when p_status = 'pending' then 'none'
                                     when payment_claim_status in ('claimed', 'rejected') then 'verified'
                                     else payment_claim_status end,
         payment_verified_at = case when p_status = 'pending' then null
                                    when payment_claim_status in ('claimed', 'rejected') then now()
                                    else payment_verified_at end,$$);

-- "To prepare" counts only confirmed (or owner-made) orders.
select app_private.patch_function('app_private.prep_list()'::regprocedure,
  $$where o.status = 'new' and o.deleted_at is null$$,
  $$where o.status = 'new' and o.deleted_at is null and o.confirmation_status in ('not_needed', 'confirmed')$$);

drop function app_private.patch_function(regprocedure, text, text);

-- ---------------------------------------------------------------------------
-- 7) Grants: nothing is executable by anon except the public storefront (and ping, for the keep-alive).
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema app_private from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema app_private revoke execute on functions from public, anon;

grant execute on all functions in schema app_private to authenticated;
grant usage on schema app_private to anon; -- the three public bodies below; everything else stays closed to anon
grant execute on function
  public.storefront_shop(text), public.storefront_catalog(text), public.slug_available(text), public.ping(),
  app_private.storefront_shop(text), app_private.storefront_catalog(text), app_private.slug_available(text)
to anon;
grant execute on function public.ping(), public.storefront_shop(text), public.storefront_catalog(text),
  public.slug_available(text) to authenticated; -- a signed-in customer browses the catalogue too
-- Every public function the app (owner or customer) calls keeps its grant; re-grant for the new ones.
grant execute on function
  public.my_context(), public.register_customer(text, text), public.upsert_address(jsonb), public.delete_address(uuid),
  public.request_account_deletion(), public.place_order(jsonb), public.customer_orders_list(text, integer, timestamptz),
  public.customer_order_get(uuid), public.claim_payment(uuid, text), public.switch_to_cod(uuid),
  public.cancel_my_order(uuid), public.create_shop(text, text, text), public.update_shop(jsonb),
  public.set_shop_published(boolean), public.bulk_offer(jsonb), public.end_offers(uuid[]),
  public.confirm_order(uuid, text, integer), public.decline_order(uuid, text, integer),
  public.verify_payment(uuid, integer), public.reject_payment(uuid, text, integer),
  public.set_customer_block(uuid, boolean), public.my_customers(), public.admin_create_invite(text),
  public.effective_price(public.variants, timestamptz)
to authenticated;
