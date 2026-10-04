-- HR Phase 2: Payroll Preparation & Compensation
CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'mpesa',
  bank_name text,
  bank_branch text,
  bank_account_number text,
  mpesa_number text,
  kra_pin text,
  nssf_number text,
  shif_number text,
  nssf_exempt boolean NOT NULL DEFAULT false,
  shif_exempt boolean NOT NULL DEFAULT false,
  housing_levy_exempt boolean NOT NULL DEFAULT false,
  paye_exempt boolean NOT NULL DEFAULT false,
  effective_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT ALL ON public.employee_compensation TO service_role;
ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR admins manage compensation" ON public.employee_compensation FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.employee_pay_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('allowance','deduction')),
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_taxable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_components_employee ON public.employee_pay_components(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_pay_components TO authenticated;
GRANT ALL ON public.employee_pay_components TO service_role;
ALTER TABLE public.employee_pay_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR admins manage pay components" ON public.employee_pay_components FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_code text NOT NULL UNIQUE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  pay_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  employee_count integer NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  total_employer_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_by_name text,
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_period_active ON public.payroll_runs(period_year, period_month) WHERE status <> 'cancelled';
GRANT SELECT, INSERT, UPDATE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR admins read payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins create payroll runs" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins update payroll runs" ON public.payroll_runs FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  employee_code text,
  employee_name text,
  department_name text,
  position_title text,
  payment_method text,
  payment_account text,
  kra_pin text,
  basic_salary numeric NOT NULL DEFAULT 0,
  total_allowances numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  overtime numeric NOT NULL DEFAULT 0,
  gross_salary numeric NOT NULL DEFAULT 0,
  nssf_tier1 numeric NOT NULL DEFAULT 0,
  nssf_tier2 numeric NOT NULL DEFAULT 0,
  shif_amount numeric NOT NULL DEFAULT 0,
  housing_levy_amount numeric NOT NULL DEFAULT 0,
  taxable_pay numeric NOT NULL DEFAULT 0,
  paye_before_relief numeric NOT NULL DEFAULT 0,
  personal_relief numeric NOT NULL DEFAULT 0,
  net_paye numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  employer_nssf numeric NOT NULL DEFAULT 0,
  employer_housing_levy numeric NOT NULL DEFAULT 0,
  earnings_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  deductions_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  adjustment_note text,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON public.payroll_items(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR admins manage payroll items" ON public.payroll_items FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- updated_at
CREATE TRIGGER trg_employee_compensation_updated BEFORE UPDATE ON public.employee_compensation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pay_components_updated BEFORE UPDATE ON public.employee_pay_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_payroll_items_updated BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Lock items once run is approved (only payment fields may change after approval)
CREATE OR REPLACE FUNCTION public.payroll_items_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  SELECT status INTO _status FROM public.payroll_runs WHERE id = COALESCE(NEW.payroll_run_id, OLD.payroll_run_id);
  IF _status IN ('approved','paid','cancelled') THEN
    IF TG_OP = 'UPDATE' AND _status IN ('approved','paid')
       AND NEW.gross_salary = OLD.gross_salary AND NEW.net_salary = OLD.net_salary
       AND NEW.total_deductions = OLD.total_deductions AND NEW.basic_salary = OLD.basic_salary THEN
      RETURN NEW; -- payment status / reference updates allowed
    END IF;
    RAISE EXCEPTION 'Payroll run is % and locked against changes', _status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_payroll_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.payroll_items_guard();

-- Run: code, status transitions, audit + employee timeline
CREATE OR REPLACE FUNCTION public.payroll_runs_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.payroll_code := 'PR-' || NEW.period_year || '-' || lpad(NEW.period_month::text, 2, '0');
    IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE payroll_code = NEW.payroll_code) THEN
      NEW.payroll_code := NEW.payroll_code || '-' || substr(gen_random_uuid()::text, 1, 4);
    END IF;
    NEW.status := 'draft';
  ELSE
    NEW.payroll_code := OLD.payroll_code;
    IF OLD.status IN ('paid','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Payroll run already %', OLD.status;
    END IF;
    IF OLD.status = 'approved' AND NEW.status NOT IN ('approved','paid') THEN
      RAISE EXCEPTION 'Approved payroll can only be marked paid';
    END IF;
    IF OLD.status <> 'draft' AND (NEW.total_gross <> OLD.total_gross OR NEW.total_net <> OLD.total_net) THEN
      RAISE EXCEPTION 'Payroll totals are locked after approval';
    END IF;
    IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
      NEW.approved_by := auth.uid(); NEW.approved_at := now();
    END IF;
    IF NEW.status = 'paid' AND OLD.status = 'approved' THEN NEW.paid_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payroll_runs_before BEFORE INSERT OR UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.payroll_runs_before_write();

CREATE OR REPLACE FUNCTION public.payroll_runs_after_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' THEN
      UPDATE public.payroll_items SET payment_status = 'paid', payment_reference = COALESCE(payment_reference, NEW.payment_reference)
        WHERE payroll_run_id = NEW.id;
      INSERT INTO public.employee_timeline(employee_id, event_type, event_title, description, reference_type, reference_id, created_by)
        SELECT employee_id, 'salary_paid', 'Salary Paid', NEW.payroll_code || ' · Net KES ' || to_char(net_salary, 'FM999,999,990.00'), 'payroll_run', NEW.id, _uid
        FROM public.payroll_items WHERE payroll_run_id = NEW.id;
    END IF;
  END IF;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.audit_logs(admin_id, action, target_type, target_id, details)
    VALUES (_uid,
      CASE WHEN TG_OP = 'INSERT' THEN 'payroll_created'
           WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'payroll_' || NEW.status
           ELSE 'payroll_updated' END,
      'payroll_run', NEW.id,
      jsonb_build_object('payroll_code', NEW.payroll_code, 'status', NEW.status, 'total_net', NEW.total_net, 'employees', NEW.employee_count));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payroll_runs_after AFTER INSERT OR UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.payroll_runs_after_write();

-- Compensation audit
CREATE OR REPLACE FUNCTION public.employee_compensation_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' OR NEW.basic_salary IS DISTINCT FROM OLD.basic_salary THEN
    INSERT INTO public.employee_timeline(employee_id, event_type, event_title, description, created_by)
    VALUES (NEW.employee_id, 'compensation_updated', 'Compensation Updated',
      'Basic salary set to KES ' || to_char(NEW.basic_salary, 'FM999,999,990.00'), _uid);
  END IF;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.audit_logs(admin_id, action, target_type, target_id, details)
    VALUES (_uid, 'compensation_' || lower(TG_OP), 'employee', NEW.employee_id,
      jsonb_build_object('basic_salary', NEW.basic_salary, 'payment_method', NEW.payment_method));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_employee_compensation_audit AFTER INSERT OR UPDATE ON public.employee_compensation FOR EACH ROW EXECUTE FUNCTION public.employee_compensation_audit();
