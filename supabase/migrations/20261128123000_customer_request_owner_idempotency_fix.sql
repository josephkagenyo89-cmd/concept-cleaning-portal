-- Correct first-submission ownership assignment while retaining strict retry ownership checks.
create or replace function public.submit_website_service_request_with_owner(
  p_payload jsonb,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
  v_request_id uuid;
  v_client_id uuid;
  v_existing_user_id uuid;
  v_existing_client_id uuid;
  v_is_duplicate boolean;
  v_customer_type text := coalesce(p_payload->>'customer_type', 'guest');
begin
  if v_customer_type = 'registered' then
    if p_user_id is null then
      raise exception 'Sign in is required to submit a registered-customer request.'
        using errcode = '42501';
    end if;

    select c.id
      into v_client_id
      from public.clients c
     where c.user_id = p_user_id
     order by c.created_at desc
     limit 1;

    if v_client_id is null then
      raise exception 'Your customer profile is not linked yet. Refresh your account and try again.'
        using errcode = 'P0002';
    end if;
  elsif v_customer_type = 'guest' then
    if p_user_id is not null then
      raise exception 'Guest requests cannot be assigned a registered customer identity.'
        using errcode = '42501';
    end if;
  else
    raise exception 'Invalid customer type.';
  end if;

  v_result := public.submit_website_service_request(p_payload);
  v_request_id := nullif(v_result->>'request_id', '')::uuid;
  v_is_duplicate := coalesce((v_result->>'duplicate')::boolean, false);

  if v_request_id is null then
    raise exception 'The service request could not be identified.';
  end if;

  select r.user_id, r.client_id
    into v_existing_user_id, v_existing_client_id
    from public.website_service_requests r
   where r.id = v_request_id
   for update;

  if not found then
    raise exception 'The submitted service request could not be found.';
  end if;

  if v_is_duplicate then
    if v_existing_user_id is distinct from p_user_id
       or v_existing_client_id is distinct from v_client_id then
      raise exception 'This submission token is already associated with a different request owner.'
        using errcode = '42501';
    end if;
  elsif v_existing_user_id is not null or v_existing_client_id is not null then
    raise exception 'A new request unexpectedly already has an owner.'
      using errcode = '42501';
  end if;

  if p_user_id is not null and not v_is_duplicate then
    update public.website_service_requests
       set user_id = p_user_id,
           client_id = v_client_id,
           updated_at = now()
     where id = v_request_id
       and user_id is null
       and client_id is null;
  end if;

  return v_result;
end;
$function$;

revoke all on function public.submit_website_service_request_with_owner(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_website_service_request_with_owner(jsonb, uuid)
  to service_role;
