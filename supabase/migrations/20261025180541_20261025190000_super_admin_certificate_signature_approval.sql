-- Require an authenticated Super Admin's own signature when waiving
-- the client signature requirement for a service completion certificate.
-- This is intentionally scoped to service_certificates only.

ALTER TABLE public.service_certificates
  ADD COLUMN IF NOT EXISTS signature_bypass_admin_signature text;

COMMENT ON COLUMN public.service_certificates.signature_bypass_admin_signature
  IS 'PNG data URL of the Super Admin approval signature captured when the client signature is waived.';

CREATE OR REPLACE FUNCTION public.enforce_super_admin_certificate_waiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_approver_name text;
BEGIN
  -- Preserve existing historical waiver records when unrelated fields change.
  IF TG_OP = 'UPDATE'
     AND NEW.signature_bypassed IS NOT DISTINCT FROM OLD.signature_bypassed
     AND NEW.signature_bypass_reason IS NOT DISTINCT FROM OLD.signature_bypass_reason
     AND NEW.signature_bypassed_by IS NOT DISTINCT FROM OLD.signature_bypassed_by
     AND NEW.signature_bypassed_by_name IS NOT DISTINCT FROM OLD.signature_bypassed_by_name
     AND NEW.signature_bypassed_at IS NOT DISTINCT FROM OLD.signature_bypassed_at
     AND NEW.signature_bypass_admin_signature IS NOT DISTINCT FROM OLD.signature_bypass_admin_signature
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.signature_bypassed IS TRUE THEN
    RAISE EXCEPTION 'A recorded client-signature waiver is immutable';
  END IF;

  IF NEW.signature_bypassed IS TRUE THEN
    IF auth.uid() IS NULL
       OR NEW.signature_bypassed_by IS DISTINCT FROM auth.uid()
       OR NOT coalesce(public.has_role(auth.uid(), 'super_admin'::public.app_role), false)
    THEN
      RAISE EXCEPTION 'Only the approving Super Admin may waive a client signature';
    END IF;

    IF NEW.signature_bypass_admin_signature IS NULL
       OR length(NEW.signature_bypass_admin_signature) > 2000000
       OR NEW.signature_bypass_admin_signature NOT LIKE 'data:image/png;base64,%'
    THEN
      RAISE EXCEPTION 'A valid Super Admin PNG approval signature is required';
    END IF;

    IF coalesce(length(btrim(NEW.signature_bypass_reason)), 0) = 0 THEN
      RAISE EXCEPTION 'A reason is required to waive the client signature';
    END IF;

    IF length(NEW.signature_bypass_reason) > 1000 THEN
      RAISE EXCEPTION 'The waiver reason must be 1000 characters or fewer';
    END IF;

    SELECT nullif(btrim(p.full_name), '')
      INTO v_approver_name
      FROM public.profiles AS p
     WHERE p.user_id = auth.uid();

    IF v_approver_name IS NULL THEN
      RAISE EXCEPTION 'The approving Super Admin must have a profile name';
    END IF;

    -- Never trust a client-supplied approver name or timestamp.
    NEW.signature_bypassed_by_name := v_approver_name;
    NEW.signature_bypassed_at := now();
  ELSIF NEW.signature_bypass_admin_signature IS NOT NULL
     OR NEW.signature_bypass_reason IS NOT NULL
     OR NEW.signature_bypassed_by IS NOT NULL
     OR NEW.signature_bypassed_by_name IS NOT NULL
     OR NEW.signature_bypassed_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Waiver approval fields may only be set when signature_bypassed is true';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_super_admin_certificate_waiver
  ON public.service_certificates;

CREATE TRIGGER trg_enforce_super_admin_certificate_waiver
BEFORE INSERT OR UPDATE ON public.service_certificates
FOR EACH ROW
EXECUTE FUNCTION public.enforce_super_admin_certificate_waiver();

REVOKE ALL ON FUNCTION public.enforce_super_admin_certificate_waiver() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_super_admin_certificate_waiver() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_super_admin_certificate_waiver() FROM authenticated;
