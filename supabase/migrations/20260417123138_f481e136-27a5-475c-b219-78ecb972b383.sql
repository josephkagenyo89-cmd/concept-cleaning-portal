-- 1. Payment fields on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS mpesa_code text,
  ADD COLUMN IF NOT EXISTS payment_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);

-- 2. Certificate numbering
CREATE SEQUENCE IF NOT EXISTS public.certificate_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_certificate_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'CCS-CERT-' || nextval('public.certificate_number_seq')::text
$$;

-- 3. Auto-create invoice when booking is fully_confirmed (locked)
CREATE OR REPLACE FUNCTION public.auto_create_invoice_on_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv_num text;
  existing_id uuid;
  primary_service text;
BEGIN
  -- Only act when transitioning into fully_confirmed
  IF NEW.status = 'fully_confirmed' AND (OLD.status IS DISTINCT FROM 'fully_confirmed') THEN
    -- Skip if invoice already exists for this booking
    SELECT id INTO existing_id FROM public.invoices WHERE booking_id = NEW.id LIMIT 1;
    IF existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Get a service label (single name from services table or fallback)
    SELECT s.name INTO primary_service FROM public.services s WHERE s.id = NEW.service_id;
    IF primary_service IS NULL THEN
      primary_service := 'Cleaning Service';
    END IF;

    -- Generate invoice number
    SELECT 'CCS-INV-' || nextval('public.invoice_number_seq')::text INTO inv_num;

    INSERT INTO public.invoices (
      invoice_number,
      client_name,
      client_phone,
      client_id,
      booking_id,
      service,
      amount,
      date,
      payment_status,
      created_by,
      line_items,
      salesperson_id,
      salesperson_name,
      salesperson_role,
      notes
    ) VALUES (
      inv_num,
      NEW.client_name,
      NEW.client_phone,
      NEW.client_id,
      NEW.id,
      primary_service,
      NEW.price,
      CURRENT_DATE,
      'pending_approval',
      NEW.agent_id,
      COALESCE(NEW.line_items, '[]'::jsonb),
      NEW.salesperson_id,
      NEW.salesperson_name,
      NEW.salesperson_role,
      'Auto-generated from locked booking ' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_invoice_on_lock ON public.bookings;
CREATE TRIGGER trg_auto_create_invoice_on_lock
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_invoice_on_lock();