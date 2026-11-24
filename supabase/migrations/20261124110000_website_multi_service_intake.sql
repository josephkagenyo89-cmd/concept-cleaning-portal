-- Website multi-service intake. This is a request/CRM intake layer only:
-- it does not create bookings, quotations, invoices, payments, or approvals.

create table if not exists public.website_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_submission_id uuid not null unique,
  request_reference text not null unique,
  lead_id uuid not null unique references public.leads(id) on delete restrict,
  customer_type text not null check (customer_type in ('guest', 'registered')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  service_location text not null,
  property_type text,
  property_name text,
  preferred_date date,
  preferred_time text,
  payment_preference text,
  instructions text,
  selected_assets jsonb not null default '[]'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'under_review', 'quoted', 'converted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_service_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.website_service_requests(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,
  quantity integer not null check (quantity between 1 and 100),
  base_price_snapshot numeric(12,2) not null default 0,
  pricing_model_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (request_id, service_id)
);

create index if not exists idx_website_service_requests_lead
  on public.website_service_requests(lead_id);
create index if not exists idx_website_service_requests_status_created
  on public.website_service_requests(status, created_at desc);
create index if not exists idx_website_service_request_items_request
  on public.website_service_request_items(request_id);

alter table public.website_service_requests enable row level security;
alter table public.website_service_request_items enable row level security;

grant select on public.website_service_requests, public.website_service_request_items to authenticated;
grant all on public.website_service_requests, public.website_service_request_items to service_role;

create policy "Admins can view website service requests"
  on public.website_service_requests for select to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
  );

create policy "Admins can view website service request items"
  on public.website_service_request_items for select to authenticated
  using (
    exists (
      select 1 from public.website_service_requests r
      where r.id = website_service_request_items.request_id
    )
    and (
      has_role(auth.uid(), 'admin'::app_role)
      )
  );

-- No anonymous policies: only the ERP service-role Edge Function can submit
-- public requests. Authenticated ERP admins can read the CRM-linked request.

create or replace function public.submit_website_service_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid := nullif(p_payload->>'client_submission_id', '')::uuid;
  v_request_id uuid := gen_random_uuid();
  v_lead_id uuid;
  v_reference text;
  v_name text := nullif(trim(p_payload->>'name'), '');
  v_phone text := nullif(trim(p_payload->>'phone'), '');
  v_email text := nullif(trim(p_payload->>'email'), '');
  v_location text := nullif(trim(p_payload->>'location'), '');
  v_customer_type text := coalesce(p_payload->>'customer_type', 'guest');
  v_service_interest text;
  v_item_count integer;
  v_valid_count integer;
begin
  if v_submission_id is null then
    raise exception 'A valid submission token is required';
  end if;
  -- Serialize concurrent retries using the same token.
  perform pg_advisory_xact_lock(hashtextextended(v_submission_id::text, 0));

  if v_name is null or v_phone is null or v_location is null then
    raise exception 'Name, phone and service location are required';
  end if;
  if length(v_name) > 160 or length(v_phone) > 40 or length(v_location) > 500 then
    raise exception 'A customer field exceeds the allowed length';
  end if;
  if v_customer_type not in ('guest', 'registered') then
    raise exception 'Invalid customer type';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') < 1
     or jsonb_array_length(p_payload->'items') > 30 then
    raise exception 'Select between 1 and 30 services';
  end if;

  select r.id, r.request_reference, r.lead_id
    into v_request_id, v_reference, v_lead_id
  from public.website_service_requests r
  where r.client_submission_id = v_submission_id;

  if found then
    select coalesce(string_agg(i.service_name, ', ' order by i.service_name), '')
      into v_service_interest
    from public.website_service_request_items i
    where i.request_id = v_request_id;
    return jsonb_build_object(
      'request_id', v_request_id,
      'request_reference', v_reference,
      'lead_id', v_lead_id,
      'service_summary', v_service_interest,
      'duplicate', true
    );
  end if;

  select count(*), count(distinct x.service_id)
    into v_item_count, v_valid_count
  from jsonb_to_recordset(p_payload->'items') as x(service_id uuid, quantity integer);

  if v_item_count < 1 or v_item_count <> v_valid_count then
    raise exception 'Service list contains duplicate or invalid entries';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_payload->'items') as x(service_id uuid, quantity integer)
    where x.quantity is null or x.quantity < 1 or x.quantity > 100
  ) then
    raise exception 'Each service quantity must be between 1 and 100';
  end if;

  select string_agg(s.name, ', ' order by s.name)
    into v_service_interest
  from jsonb_to_recordset(p_payload->'items') as x(service_id uuid, quantity integer)
  join public.services s on s.id = x.service_id and s.is_active = true;

  select count(*) into v_valid_count
  from jsonb_to_recordset(p_payload->'items') as x(service_id uuid, quantity integer)
  join public.services s on s.id = x.service_id and s.is_active = true;

  if v_valid_count <> v_item_count then
    raise exception 'One or more selected services are unavailable';
  end if;

  insert into public.leads (
    full_name, phone, whatsapp_number, email, location,
    service_interest, source, status, priority, estimated_value, notes
  ) values (
    v_name, v_phone, nullif(trim(coalesce(p_payload->>'whatsapp_number', '')), ''),
    v_email, v_location, v_service_interest, 'website', 'new', 'normal', 0,
    'Website service request. Reference pending generation.'
  ) returning id into v_lead_id;

  v_reference := 'WEB-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(v_request_id::text, '-', ''), 1, 6));

  insert into public.website_service_requests (
    id, client_submission_id, request_reference, lead_id, customer_type, customer_name,
    customer_phone, customer_email, service_location, property_type,
    property_name, preferred_date, preferred_time, payment_preference,
    instructions, selected_assets
  ) values (
    v_request_id, v_submission_id, v_reference, v_lead_id, v_customer_type, v_name,
    v_phone, v_email, v_location,
    nullif(p_payload->>'property_type', ''),
    nullif(p_payload->>'property_name', ''),
    nullif(p_payload->>'preferred_date', '')::date,
    nullif(p_payload->>'preferred_time', ''),
    nullif(p_payload->>'payment_preference', ''),
    nullif(p_payload->>'instructions', ''),
    coalesce(p_payload->'selected_assets', '[]'::jsonb)
  );

  insert into public.website_service_request_items (
    request_id, service_id, service_name, quantity,
    base_price_snapshot, pricing_model_snapshot
  )
  select v_request_id, s.id, s.name, x.quantity,
         s.base_price, s.pricing_model
  from jsonb_to_recordset(p_payload->'items') as x(service_id uuid, quantity integer)
  join public.services s on s.id = x.service_id and s.is_active = true;

  update public.leads
  set notes = concat_ws(E'\n', nullif(notes, ''),
    'Website request reference: ' || v_reference,
    nullif(p_payload->>'instructions', ''))
  where id = v_lead_id;

  return jsonb_build_object(
    'request_id', v_request_id,
    'request_reference', v_reference,
    'lead_id', v_lead_id,
    'service_summary', v_service_interest,
    'duplicate', false
  );
end;
$$;

revoke all on function public.submit_website_service_request(jsonb) from public, anon, authenticated;
grant execute on function public.submit_website_service_request(jsonb) to service_role;

comment on table public.website_service_requests is
  'Website multi-service requests linked to CRM leads; not operational bookings or quotations.';
comment on table public.website_service_request_items is
  'Service lines attached to one website request; ERP catalogue IDs and server-side price snapshots.';
