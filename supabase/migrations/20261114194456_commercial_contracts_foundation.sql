-- Commercial cleaning contracts: company agreements, sites, recurring schedules and visit costing.
-- VAT is intentionally excluded. Staff cost is recorded as a fixed amount per visit;
-- it does not create payroll or ledger postings.
CREATE SEQUENCE IF NOT EXISTS public.service_contract_number_seq;

GRANT USAGE, SELECT ON SEQUENCE public.service_contract_number_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public.service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE DEFAULT (
    'CCS-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.service_contract_number_seq')::text, 5, '0')
  ),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  company_legal_name text NOT NULL,
  company_registration_number text,
  billing_contact_name text,
  billing_email text,
  billing_phone text,
  billing_address text,
  scope_of_work text NOT NULL,
  pricing_model text NOT NULL CHECK (pricing_model IN ('fixed_monthly','per_visit','per_sqm','hybrid')),
  fixed_monthly_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (fixed_monthly_fee >= 0),
  per_visit_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (per_visit_rate >= 0),
  per_sqm_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (per_sqm_rate >= 0),
  hybrid_fixed_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (hybrid_fixed_fee >= 0),
  hybrid_visit_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (hybrid_visit_rate >= 0),
  hybrid_per_sqm_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (hybrid_per_sqm_rate >= 0),
  billing_frequency text NOT NULL CHECK (billing_frequency IN ('per_visit','weekly','monthly','quarterly','annually')),
  payment_terms_days integer CHECK (payment_terms_days IS NULL OR payment_terms_days >= 0),
  start_date date NOT NULL,
  end_date date,
  renewal_notice_days integer CHECK (renewal_notice_days IS NULL OR renewal_notice_days >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','terminated','expired')),
  approval_status text NOT NULL DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval','approved','rejected')),
  approval_note text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (approval_status <> 'approved' OR (approved_by IS NOT NULL AND approved_by <> created_by)),
  CHECK (status <> 'active' OR approval_status = 'approved')
);

CREATE TABLE IF NOT EXISTS public.service_contract_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  address text NOT NULL,
  contact_name text,
  contact_phone text,
  area_sqm numeric(14,2) CHECK (area_sqm IS NULL OR area_sqm >= 0),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_contract_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.service_contract_sites(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  service_description text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','custom')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  visits_per_cycle integer NOT NULL DEFAULT 1 CHECK (visits_per_cycle > 0),
  weekday smallint CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  preferred_time text,
  start_date date NOT NULL,
  end_date date,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.service_contract_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.service_contract_sites(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.service_contract_schedules(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  pest_job_id uuid REFERENCES public.pest_jobs(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed','cancelled')),
  fixed_staff_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (fixed_staff_cost >= 0),
  supplies_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (supplies_cost >= 0),
  transport_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  equipment_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (equipment_cost >= 0),
  other_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  total_direct_cost numeric(14,2) GENERATED ALWAYS AS (
    fixed_staff_cost + supplies_cost + transport_cost + equipment_cost + other_cost
  ) STORED,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_site_id uuid REFERENCES public.service_contract_sites(id) ON DELETE SET NULL;
ALTER TABLE public.pest_jobs
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_site_id uuid REFERENCES public.service_contract_sites(id) ON DELETE SET NULL;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_site_id uuid REFERENCES public.service_contract_sites(id) ON DELETE SET NULL;
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_site_id uuid REFERENCES public.service_contract_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_visit_id uuid REFERENCES public.service_contract_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_contracts_client_status ON public.service_contracts(client_id,status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_approval ON public.service_contracts(approval_status,created_at);
CREATE INDEX IF NOT EXISTS idx_service_contract_sites_contract ON public.service_contract_sites(contract_id,is_active);
CREATE INDEX IF NOT EXISTS idx_service_contract_schedules_contract ON public.service_contract_schedules(contract_id,status);
CREATE INDEX IF NOT EXISTS idx_service_contract_visits_contract_date ON public.service_contract_visits(contract_id,scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_contract ON public.bookings(contract_id);
CREATE INDEX IF NOT EXISTS idx_pest_jobs_contract ON public.pest_jobs(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON public.invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_expenses_contract ON public.expenses(contract_id);

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_visits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.service_contracts,
  public.service_contract_sites,
  public.service_contract_schedules,
  public.service_contract_visits
TO authenticated;

CREATE POLICY "Commercial contract admins read contracts" ON public.service_contracts
  FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins create contracts" ON public.service_contracts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()) AND created_by = auth.uid());
-- Contract approval and activation are only performed by the SECURITY DEFINER decision function.
-- No direct UPDATE or DELETE policy is granted on the parent contract record.
CREATE POLICY "Commercial contract admins manage sites" ON public.service_contract_sites
  FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins read schedules" ON public.service_contract_schedules
  FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins create schedules" ON public.service_contract_schedules
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Commercial contract admins update schedules" ON public.service_contract_schedules
  FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins delete schedules" ON public.service_contract_schedules
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins read visits" ON public.service_contract_visits
  FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins create visits" ON public.service_contract_visits
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Commercial contract admins update visits" ON public.service_contract_visits
  FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Commercial contract admins delete visits" ON public.service_contract_visits
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.commercial_contract_decide(
  p_contract_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.service_contracts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid contract decision';
  END IF;
  IF p_decision = 'rejected' AND NULLIF(trim(COALESCE(p_note,'')), '') IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  SELECT * INTO v_contract
  FROM public.service_contracts
  WHERE id = p_contract_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.approval_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Contract is not awaiting approval';
  END IF;
  IF v_contract.created_by = auth.uid() THEN
    RAISE EXCEPTION 'You cannot approve or reject a contract you submitted';
  END IF;
  UPDATE public.service_contracts
  SET approval_status = p_decision,
      status = CASE WHEN p_decision = 'approved' THEN 'active' ELSE 'draft' END,
      approval_note = NULLIF(trim(COALESCE(p_note,'')), ''),
      approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_contract_id;
END;
$$;

REVOKE ALL ON FUNCTION public.commercial_contract_decide(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commercial_contract_decide(uuid,text,text) TO authenticated;
