
CREATE OR REPLACE FUNCTION public.payroll_runs_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.payroll_code:='PR-'||NEW.period_year||'-'||lpad(NEW.period_month::text,2,'0');
    IF EXISTS(SELECT 1 FROM public.payroll_runs WHERE payroll_code=NEW.payroll_code) THEN
      NEW.payroll_code:=NEW.payroll_code||'-'||substr(gen_random_uuid()::text,1,4);
    END IF;
    NEW.status:='draft';
    NEW.created_by:=COALESCE(NEW.created_by,auth.uid());
  ELSE
    NEW.payroll_code:=OLD.payroll_code;
    IF OLD.status IN ('paid','cancelled') THEN
      IF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
        RAISE EXCEPTION 'Payroll run already % and is locked',OLD.status;
      END IF;
    ELSIF OLD.status='approved' THEN
      IF NEW.status NOT IN ('approved','paid') THEN
        RAISE EXCEPTION 'Approved payroll can only be marked paid';
      END IF;
      IF (to_jsonb(NEW)-ARRAY['status','paid_at','payment_reference','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','paid_at','payment_reference','updated_at']) THEN
        RAISE EXCEPTION 'Approved payroll details are locked';
      END IF;
      IF NEW.paid_at IS DISTINCT FROM OLD.paid_at
         AND NOT (NEW.status='paid' AND OLD.status='approved') THEN
        RAISE EXCEPTION 'Paid timestamp can only be set when marking payroll paid';
      END IF;
      IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
         AND NOT (NEW.status='paid' AND OLD.status='approved') THEN
        RAISE EXCEPTION 'Payment reference can only change when marking payroll paid';
      END IF;
    ELSIF OLD.status='pending_approval' THEN
      IF NEW.status NOT IN ('pending_approval','approved','rejected') THEN
        RAISE EXCEPTION 'Payroll awaiting review can only remain pending, be approved or be rejected';
      END IF;
      IF (to_jsonb(NEW)-ARRAY['status','approved_by','approved_at','rejection_reason','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','approved_by','approved_at','rejection_reason','updated_at']) THEN
        RAISE EXCEPTION 'Payroll details are locked while awaiting approval';
      END IF;
    END IF;

    IF OLD.status='draft' AND NEW.status NOT IN ('draft','pending_approval','approved','cancelled') THEN
      RAISE EXCEPTION 'Invalid payroll status transition from draft to %',NEW.status;
    END IF;
    IF NEW.status='approved' AND OLD.status='draft' THEN
      NEW.approved_by:=auth.uid();
      NEW.approved_at:=now();
    END IF;
    IF NEW.status='paid' AND OLD.status='approved' THEN
      NEW.paid_at:=now();
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;
