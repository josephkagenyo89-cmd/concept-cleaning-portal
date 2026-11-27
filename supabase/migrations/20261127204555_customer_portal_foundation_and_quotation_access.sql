-- Customer portal foundation for the shared website + ERP database.
-- This migration only adds portal-owned data and a customer quotation read policy.
create table if not exists public.customer_properties (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null,
 name text not null check (length(trim(name)) between 1 and 160),
 type text not null default 'Home', county text, estate text, address text, maps_url text,
 bedrooms integer check (bedrooms is null or bedrooms >= 0),
 floors integer check (floors is null or floors >= 0),
 parking_notes text, gate_notes text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_customer_properties_user_created on public.customer_properties(user_id, created_at desc);
create index if not exists idx_customer_properties_client on public.customer_properties(client_id);

create table if not exists public.customer_property_assets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null,
 property_id uuid not null references public.customer_properties(id) on delete cascade,
 room text not null default 'Living Room', category text not null default 'Other',
 name text not null check (length(trim(name)) between 1 and 160),
 size text, material text, last_cleaned_at date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_customer_property_assets_user_created on public.customer_property_assets(user_id, created_at desc);
create index if not exists idx_customer_property_assets_property on public.customer_property_assets(property_id);

create table if not exists public.customer_booking_drafts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null,
 draft_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_payload) = 'object'),
 updated_at timestamptz not null default now()
);

create table if not exists public.customer_loyalty_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 client_id uuid references public.clients(id) on delete set null,
 membership_tier text not null default 'Silver' check (membership_tier in ('Silver','Gold','Platinum')),
 points_balance integer not null default 0 check (points_balance >= 0),
 lifetime_spend numeric(14,2) not null default 0 check (lifetime_spend >= 0),
 referral_code text not null unique default ('CC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_customer_loyalty_client on public.customer_loyalty_accounts(client_id);

alter table public.customer_properties enable row level security;
alter table public.customer_property_assets enable row level security;
alter table public.customer_booking_drafts enable row level security;
alter table public.customer_loyalty_accounts enable row level security;
grant select, insert, update, delete on public.customer_properties, public.customer_property_assets, public.customer_booking_drafts to authenticated;
grant select on public.customer_loyalty_accounts to authenticated;
grant all on public.customer_properties, public.customer_property_assets, public.customer_booking_drafts, public.customer_loyalty_accounts to service_role;

drop policy if exists "Customers manage their own properties" on public.customer_properties;
create policy "Customers manage their own properties" on public.customer_properties for all to authenticated
using (user_id = (select auth.uid()) and (client_id is null or exists (select 1 from public.clients c where c.id = customer_properties.client_id and c.user_id = (select auth.uid()))))
with check (user_id = (select auth.uid()) and (client_id is null or exists (select 1 from public.clients c where c.id = customer_properties.client_id and c.user_id = (select auth.uid()))));

drop policy if exists "Customers manage their own property assets" on public.customer_property_assets;
create policy "Customers manage their own property assets" on public.customer_property_assets for all to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.customer_properties p where p.id = customer_property_assets.property_id and p.user_id = (select auth.uid())) and (client_id is null or exists (select 1 from public.clients c where c.id = customer_property_assets.client_id and c.user_id = (select auth.uid()))))
with check (user_id = (select auth.uid()) and exists (select 1 from public.customer_properties p where p.id = customer_property_assets.property_id and p.user_id = (select auth.uid())) and (client_id is null or exists (select 1 from public.clients c where c.id = customer_property_assets.client_id and c.user_id = (select auth.uid()))));

drop policy if exists "Customers manage their own booking drafts" on public.customer_booking_drafts;
create policy "Customers manage their own booking drafts" on public.customer_booking_drafts for all to authenticated
using (user_id = (select auth.uid()) and (client_id is null or exists (select 1 from public.clients c where c.id = customer_booking_drafts.client_id and c.user_id = (select auth.uid()))))
with check (user_id = (select auth.uid()) and (client_id is null or exists (select 1 from public.clients c where c.id = customer_booking_drafts.client_id and c.user_id = (select auth.uid()))));

drop policy if exists "Customers view their own loyalty account" on public.customer_loyalty_accounts;
create policy "Customers view their own loyalty account" on public.customer_loyalty_accounts for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.set_customer_portal_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists customer_properties_set_updated_at on public.customer_properties;
create trigger customer_properties_set_updated_at before update on public.customer_properties for each row execute function public.set_customer_portal_updated_at();
drop trigger if exists customer_property_assets_set_updated_at on public.customer_property_assets;
create trigger customer_property_assets_set_updated_at before update on public.customer_property_assets for each row execute function public.set_customer_portal_updated_at();
drop trigger if exists customer_booking_drafts_set_updated_at on public.customer_booking_drafts;
create trigger customer_booking_drafts_set_updated_at before update on public.customer_booking_drafts for each row execute function public.set_customer_portal_updated_at();
drop trigger if exists customer_loyalty_accounts_set_updated_at on public.customer_loyalty_accounts;
create trigger customer_loyalty_accounts_set_updated_at before update on public.customer_loyalty_accounts for each row execute function public.set_customer_portal_updated_at();

create or replace function public.ensure_customer_loyalty_account()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_spend numeric(14,2) := greatest(coalesce(new.total_spend, 0), 0);
 v_tier text := case when v_spend >= 75000 then 'Platinum' when v_spend >= 20000 then 'Gold' else 'Silver' end;
begin
 if new.user_id is not null and exists (select 1 from auth.users u where u.id = new.user_id) then
  insert into public.customer_loyalty_accounts(user_id, client_id, membership_tier, lifetime_spend)
  values (new.user_id, new.id, v_tier, v_spend)
  on conflict (user_id) do update
   set client_id = coalesce(customer_loyalty_accounts.client_id, excluded.client_id),
       lifetime_spend = greatest(customer_loyalty_accounts.lifetime_spend, excluded.lifetime_spend),
       membership_tier = case
        when greatest(customer_loyalty_accounts.lifetime_spend, excluded.lifetime_spend) >= 75000 then 'Platinum'
        when greatest(customer_loyalty_accounts.lifetime_spend, excluded.lifetime_spend) >= 20000 then 'Gold'
        else 'Silver' end;
 end if;
 return new;
end;
$$;
revoke all on function public.ensure_customer_loyalty_account() from public, anon, authenticated;
drop trigger if exists clients_ensure_customer_loyalty_account on public.clients;
create trigger clients_ensure_customer_loyalty_account after insert or update of user_id, total_spend on public.clients for each row execute function public.ensure_customer_loyalty_account();

insert into public.customer_loyalty_accounts(user_id, client_id, membership_tier, lifetime_spend)
select c.user_id, c.id,
 case when greatest(coalesce(c.total_spend,0),0) >= 75000 then 'Platinum'
      when greatest(coalesce(c.total_spend,0),0) >= 20000 then 'Gold' else 'Silver' end,
 greatest(coalesce(c.total_spend,0),0)
from public.clients c
join auth.users u on u.id = c.user_id
on conflict (user_id) do nothing;

drop policy if exists "Customers view quotations for their own client" on public.quotations;
create policy "Customers view quotations for their own client" on public.quotations for select to authenticated
using (client_id is not null and owns_client(client_id));
