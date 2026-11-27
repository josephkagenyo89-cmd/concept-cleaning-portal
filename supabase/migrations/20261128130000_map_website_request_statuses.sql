-- Map CRM lead lifecycle values to the constrained customer-request status vocabulary.
create or replace function public.sync_website_service_request_status_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_request_status text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_request_status := case new.status
    when 'new' then 'received'
    when 'contacted' then 'under_review'
    when 'qualified' then 'under_review'
    when 'negotiation' then 'under_review'
    when 'proposal' then 'quoted'
    when 'won' then 'converted'
    when 'converted' then 'converted'
    when 'lost' then 'closed'
    else 'under_review'
  end;

  update public.website_service_requests
     set status = v_request_status,
         updated_at = now()
   where lead_id = new.id;

  return new;
end;
$function$;

revoke all on function public.sync_website_service_request_status_from_lead()
  from public, anon, authenticated;
