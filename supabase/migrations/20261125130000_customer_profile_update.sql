-- Customers can change their own name and mobile number (self-service). A number the account signed up with (phone sign-up)
-- cannot be changed here: it is the login. Orders already placed keep the name and number they were placed with.
create function app_private.update_my_profile(p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phone text := public.normalize_phone(p_phone);
  v_name text := btrim(coalesce(p_name, ''));
  v_auth_phone text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.customer_profiles where user_id = v_uid) then
    raise exception 'no customer profile' using errcode = 'P0002';
  end if;
  if char_length(v_name) not between 1 and 100 or v_phone is null or v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'check your name and mobile number' using errcode = 'SB427';
  end if;
  select nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') into v_auth_phone from auth.users where id = v_uid;
  if v_auth_phone is not null and v_auth_phone <> v_phone then
    raise exception 'this is the mobile number you sign in with, it cannot be changed here' using errcode = 'SB427';
  end if;
  update public.customer_profiles set name = v_name, phone = v_phone where user_id = v_uid;
  return jsonb_build_object('name', v_name, 'phone', v_phone);
exception when unique_violation then
  raise exception 'this mobile number is already registered' using errcode = 'SB427';
end;
$$;

create function public.update_my_profile(p_name text, p_phone text) returns jsonb
  language sql security invoker set search_path = ''
  as $$ select app_private.update_my_profile(p_name, p_phone); $$;

revoke all on function app_private.update_my_profile(text, text), public.update_my_profile(text, text) from public, anon;
grant execute on function app_private.update_my_profile(text, text), public.update_my_profile(text, text) to authenticated;
