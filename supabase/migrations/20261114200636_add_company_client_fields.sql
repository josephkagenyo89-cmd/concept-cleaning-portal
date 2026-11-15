alter table public.clients
  add column if not exists client_type text not null default 'individual',
  add column if not exists company_name text,
  add column if not exists contact_person text,
  add column if not exists kra_pin text;

alter table public.clients
  add constraint clients_client_type_check
  check (client_type in ('individual', 'company'));

comment on column public.clients.client_type is 'CRM account type: individual or company.';
comment on column public.clients.company_name is 'Registered or trading name for company clients.';
comment on column public.clients.contact_person is 'Primary contact person for company clients.';
comment on column public.clients.kra_pin is 'Optional KRA PIN for company clients.';
