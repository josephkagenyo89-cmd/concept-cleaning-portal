-- Customer sign-in fix (scope: customer sign-in only; agent behaviour unchanged)
-- 1. Optional email on CRM clients. Admin-created clients may leave it empty.
-- 2. handle_new_user():
--    - never claims a client by phone (any sign-up can send account_type/phone metadata)
--    - Google sign-ins are customers: no profile, no agent role
--    - all other sign-ups keep the existing agent path (agent work comes later)
-- 3. claim_client_record(): server-side link for Google sign-ins only, matched by email.
--    Phone numbers are never used to claim a record.

alter table public.clients add column if not exists email text;
create index if not exists clients_email_lower_idx on public.clients (lower(email));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Customer records are created or claimed by the app via claim_client_record().
  if COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'customer' then
    return NEW;
  end if;

  -- Google sign-ins are customers. Do not create a profile or grant a staff role.
  if COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'google' then
    return NEW;
  end if;

  -- Existing agent path (unchanged in this migration; reviewed in the agent phase).
  INSERT INTO public.profiles (user_id, full_name, phone, town_estate, mpesa_number, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'town_estate', ''),
    COALESCE(NEW.raw_user_meta_data->>'mpesa_number', ''),
    NEW.raw_user_meta_data->>'referral_code'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  RETURN NEW;
END;
$$;

-- Claim: returns the customer's client id, or null if none can be linked.
create or replace function public.claim_client_record()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_provider text;
  v_email text;
  v_client_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select raw_app_meta_data->>'provider', lower(email)
    into v_provider, v_email
  from auth.users
  where id = v_uid;

  -- A client id exists only for a record that has a phone number.
  -- Already linked to this account: return it.
  select id into v_client_id from public.clients where user_id = v_uid limit 1;
  if found then
    return v_client_id;
  end if;

  -- Only Google sign-ins may claim by email (Google verified the address).
  if v_provider is distinct from 'google' or v_email is null or v_email = '' then
    return null;
  end if;

  -- Claim one unowned record with the same email. Phone is never used here.
  update public.clients
     set user_id = v_uid,
         updated_at = now()
   where id = (
     select id from public.clients
      where user_id is null
        and lower(email) = v_email
        and phone is not null
        and btrim(phone) <> ''
      order by created_at
      limit 1
      for update skip locked
   )
  returning id into v_client_id;

  return v_client_id;
end;
$$;

revoke all on function public.claim_client_record() from public;
grant execute on function public.claim_client_record() to authenticated;
