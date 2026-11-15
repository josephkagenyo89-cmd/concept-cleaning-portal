-- Repair payroll maker-checker lifecycle without changing existing payroll records.
-- Rejected runs can be revised and resubmitted; pending/approved runs stay immutable.

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_status_check;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_status_check
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'));

CREATE OR REPLACE FUNCTION public.payroll_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  run_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id THEN
    RAISE EXCEPTION 'Payroll items cannot be moved between payroll runs';
  END IF;

  SELECT status INTO run_status
  FROM public.payroll_runs
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.payroll_run_id ELSE NEW.payroll_run_id END;

  IF run_status IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;

  IF run_status IN ('pending_approval', 'approved', 'cancelled') THEN
    RAISE EXCEPTION 'Payroll run is % and its items are locked', run_status;
  END IF;

  IF run_status = 'paid' THEN
    IF TG_OP = 'UPDATE'
       AND (to_jsonb(NEW) - ARRAY['payment_status', 'payment_reference', 'updated_at'])
           IS NOT DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['payment_status', 'payment_reference', 'updated_at']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Paid payroll items are locked';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.payroll_runs_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  editable_fields text[] := ARRAY[
    'status', 'employee_count', 'total_gross', 'total_deductions',
    'total_net', 'total_employer_cost', 'notes',
    'approval_requested_at', 'rejection_reason', 'approved_by', 'created_by',
    'approved_at', 'updated_at'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.payroll_code := 'PR-' || NEW.period_year || '-' || lpad(NEW.period_month::text, 2, '0');
    IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE payroll_code = NEW.payroll_code) THEN
      NEW.payroll_code := NEW.payroll_code || '-' || substr(gen_random_uuid()::text, 1, 4);
    END IF;
    NEW.status := 'draft';
    NEW.created_by := auth.uid();
    NEW.approval_requested_at := NULL;
    NEW.rejection_reason := NULL;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  ELSE
    NEW.payroll_code := OLD.payroll_code;

    IF OLD.status IN ('paid', 'cancelled') THEN
      IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RAISE EXCEPTION 'Payroll run already % and is locked', OLD.status;
      END IF;

    ELSIF OLD.status = 'approved' THEN
      IF NEW.status NOT IN ('approved', 'paid') THEN
        RAISE EXCEPTION 'Approved payroll can only be marked paid';
      END IF;
      IF (to_jsonb(NEW) - ARRAY['status', 'paid_at', 'payment_reference', 'updated_at'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status', 'paid_at', 'payment_reference', 'updated_at']) THEN
        RAISE EXCEPTION 'Approved payroll details are locked';
      END IF;
      IF NOT (OLD.status = 'approved' AND NEW.status = 'paid')
         AND (NEW.paid_at IS DISTINCT FROM OLD.paid_at
              OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference) THEN
        RAISE EXCEPTION 'Payment details can only be set when marking approved payroll paid';
      END IF;

    ELSIF OLD.status = 'pending_approval' THEN
      IF NEW.status NOT IN ('pending_approval', 'approved', 'rejected') THEN
        RAISE EXCEPTION 'Payroll awaiting review can only remain pending, be approved or be rejected';
      END IF;
      IF NEW.status = 'pending_approval' THEN
        IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
          RAISE EXCEPTION 'Payroll details and approval metadata are locked while awaiting approval';
        END IF;
      ELSIF (to_jsonb(NEW) - ARRAY['status', 'approved_by', 'approved_at', 'rejection_reason', 'updated_at'])
            IS DISTINCT FROM
            (to_jsonb(OLD) - ARRAY['status', 'approved_by', 'approved_at', 'rejection_reason', 'updated_at']) THEN
        RAISE EXCEPTION 'Payroll details are locked while awaiting approval';
      END IF;

    ELSIF OLD.status = 'draft' THEN
      IF NEW.status NOT IN ('draft', 'pending_approval', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid payroll status transition from draft to %', NEW.status;
      END IF;
      NEW.created_by := OLD.created_by;
      NEW.approval_requested_at := OLD.approval_requested_at;
      NEW.rejection_reason := OLD.rejection_reason;
      NEW.approved_by := OLD.approved_by;
      NEW.approved_at := OLD.approved_at;
      IF OLD.created_by IS NULL AND NEW.status = 'pending_approval' THEN
        NEW.created_by := auth.uid();
      END IF;
      IF (to_jsonb(NEW) - editable_fields) IS DISTINCT FROM (to_jsonb(OLD) - editable_fields) THEN
        RAISE EXCEPTION 'Payroll period and identity fields cannot be changed';
      END IF;

    ELSIF OLD.status = 'rejected' THEN
      IF NEW.status NOT IN ('rejected', 'pending_approval', 'cancelled') THEN
        RAISE EXCEPTION 'Rejected payroll can only be revised, resubmitted or cancelled';
      END IF;
      NEW.created_by := OLD.created_by;
      IF OLD.created_by IS NULL AND NEW.status = 'pending_approval' THEN
        NEW.created_by := auth.uid();
      END IF;
      IF (to_jsonb(NEW) - editable_fields) IS DISTINCT FROM (to_jsonb(OLD) - editable_fields) THEN
        RAISE EXCEPTION 'Payroll period and identity fields cannot be changed';
      END IF;
      IF NEW.status = 'pending_approval' THEN
        NEW.approval_requested_at := now();
        NEW.rejection_reason := NULL;
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
      ELSE
        NEW.approval_requested_at := OLD.approval_requested_at;
        NEW.rejection_reason := OLD.rejection_reason;
        NEW.approved_by := OLD.approved_by;
        NEW.approved_at := OLD.approved_at;
      END IF;

    ELSE
      RAISE EXCEPTION 'Unsupported payroll status: %', OLD.status;
    END IF;

    IF OLD.status = 'draft' AND NEW.status = 'pending_approval' THEN
      NEW.approval_requested_at := now();
      NEW.rejection_reason := NULL;
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;

    IF OLD.status = 'approved' AND NEW.status = 'paid' THEN
      NEW.paid_at := now();
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
