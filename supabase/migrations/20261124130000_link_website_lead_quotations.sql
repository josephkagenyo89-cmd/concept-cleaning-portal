-- Link staff-created quotations to the CRM lead that originated a website request.
-- This does not create bookings or change the existing quotation approval workflow.

alter table public.quotations
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists idx_quotations_lead_id
  on public.quotations(lead_id)
  where lead_id is not null;

comment on column public.quotations.lead_id is
  'Optional CRM lead source for quotations prepared from enquiries, including website service requests.';

-- Match the ERP admin gate, which allows both admin and super_admin roles.
drop policy if exists "Admins can view website service requests" on public.website_service_requests;
create policy "Admins can view website service requests"
  on public.website_service_requests for select to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  );

drop policy if exists "Admins can view website service request items" on public.website_service_request_items;
create policy "Admins can view website service request items"
  on public.website_service_request_items for select to authenticated
  using (
    exists (
      select 1
      from public.website_service_requests r
      where r.id = website_service_request_items.request_id
    )
    and (
      has_role(auth.uid(), 'admin'::app_role)
      or has_role(auth.uid(), 'super_admin'::app_role)
    )
  );
