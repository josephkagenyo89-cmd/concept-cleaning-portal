-- Secure customer referral registration used by the website signup flow.
create table if not exists public.customer_referrals (
 id uuid primary key default gen_random_uuid(),
 referrer_user_id uuid not null references auth.users(id) on delete cascade,
 referred_user_id uuid not null unique references auth.users(id) on delete cascade,
 referral_code text not null,
 status text not null default 'pending'
   check (status in ('pending','verified','rewarded','rejected')),
 created_at timestamptz not null default now(),
 verified_at timestamptz,
 rewarded_at timestamptz,
 constraint customer_referrals_no_self_referral check (referrer_user_id <> referred_user_id)
);
create index if not exists idx_customer_referrals_referrer_created
 on public.customer_referrals(referrer_user_id, created_at desc);
alter table public.customer_referrals enable row level security;
grant select on public.customer_referrals to authenticated;
grant all on public.customer_referrals to service_role;

drop policy if exists "Customers view their own referral records" on public.customer_referrals;
create policy "Customers view their own referral records"
 on public.customer_referrals for select to authenticated
 using (referrer_user_id = (select auth.uid()) or referred_user_id = (select auth.uid()));
drop policy if exists "Admins view all customer referrals" on public.customer_referrals;
create policy "Admins view all customer referrals"
 on public.customer_referrals for select to authenticated
 using (has_role((select auth.uid()), 'admin'::app_role)
     or has_role((select auth.uid()), 'super_admin'::app_role));

create or replace function public.register_customer_referral(p_referral_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 v_user_id uuid := auth.uid();
 v_referrer_id uuid;
 v_inserted integer := 0;
begin
 if v_user_id is null then
   raise exception 'Authentication is required to register a referral';
 end if;
 if p_referral_code is null or length(trim(p_referral_code)) < 4 or length(trim(p_referral_code)) > 64 then
   return false;
 end if;

 select a.user_id into v_referrer_id
 from public.customer_loyalty_accounts a
 where upper(a.referral_code) = upper(trim(p_referral_code))
 limit 1;

 if v_referrer_id is null or v_referrer_id = v_user_id then
   return false;
 end if;

 insert into public.customer_referrals(referrer_user_id, referred_user_id, referral_code)
 values (v_referrer_id, v_user_id, upper(trim(p_referral_code)))
 on conflict (referred_user_id) do nothing;

 get diagnostics v_inserted = row_count;
 return v_inserted = 1;
end;
$$;
revoke all on function public.register_customer_referral(text) from public, anon;
grant execute on function public.register_customer_referral(text) to authenticated;
