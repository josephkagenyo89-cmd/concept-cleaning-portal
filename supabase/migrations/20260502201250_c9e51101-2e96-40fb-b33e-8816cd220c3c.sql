-- 1. Add payment persistence fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mpesa_code text,
  ADD COLUMN IF NOT EXISTS payment_date timestamptz;

-- 2. Trigger: when an invoice is marked paid, mirror payment data back to its booking
CREATE OR REPLACE FUNCTION public.sync_booking_payment_from_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM 'paid')
     AND NEW.booking_id IS NOT NULL THEN
    UPDATE public.bookings
       SET amount_paid = COALESCE(NEW.amount, 0),
           mpesa_code  = NEW.mpesa_code,
           payment_date = COALESCE(NEW.payment_date, now())
     WHERE id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_payment ON public.invoices;
CREATE TRIGGER trg_sync_booking_payment
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_payment_from_invoice();

-- 3. service_certificates table — permanent record of every generated certificate
CREATE TABLE IF NOT EXISTS public.service_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  booking_id uuid NOT NULL,
  invoice_id uuid,
  client_id uuid,
  client_name text NOT NULL,
  client_phone text,
  client_location text,
  services text,
  line_items jsonb DEFAULT '[]'::jsonb,
  amount_paid numeric NOT NULL DEFAULT 0,
  mpesa_code text NOT NULL,
  payment_date timestamptz NOT NULL,
  invoice_number text,
  client_signature text NOT NULL,
  staff_signature text NOT NULL,
  staff_signed_name text,
  client_signed_at timestamptz,
  staff_signed_at timestamptz,
  document_reference text,
  generated_by uuid NOT NULL,
  generated_by_name text,
  generated_by_role text,
  date_created timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_certificates_booking ON public.service_certificates(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_certificates_client ON public.service_certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_service_certificates_date ON public.service_certificates(date_created DESC);

ALTER TABLE public.service_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all certificates"
ON public.service_certificates FOR SELECT
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Agents can view own certificates"
ON public.service_certificates FOR SELECT
TO authenticated
USING (auth.uid() = generated_by);

CREATE POLICY "Admins can create certificates"
ON public.service_certificates FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()) AND auth.uid() = generated_by);

CREATE POLICY "Super admins can delete certificates"
ON public.service_certificates FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));
