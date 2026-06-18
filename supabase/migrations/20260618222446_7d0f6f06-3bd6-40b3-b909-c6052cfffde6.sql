
-- Bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS discount_approved_by uuid,
  ADD COLUMN IF NOT EXISTS discount_approved_at timestamptz;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.service_certificates
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.income_records
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

-- Update auto-invoice trigger to copy discount fields
CREATE OR REPLACE FUNCTION public.auto_create_invoice_on_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv_num text;
  existing_id uuid;
  primary_service text;
BEGIN
  IF NEW.status = 'fully_confirmed' AND (OLD.status IS DISTINCT FROM 'fully_confirmed') THEN
    SELECT id INTO existing_id FROM public.invoices WHERE booking_id = NEW.id LIMIT 1;
    IF existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT s.name INTO primary_service FROM public.services s WHERE s.id = NEW.service_id;
    IF primary_service IS NULL THEN
      primary_service := 'Cleaning Service';
    END IF;

    SELECT 'CCS-INV-' || nextval('public.invoice_number_seq')::text INTO inv_num;

    INSERT INTO public.invoices (
      invoice_number, client_name, client_phone, client_id, booking_id,
      service, amount, date, payment_status, created_by, line_items,
      salesperson_id, salesperson_name, salesperson_role, notes,
      subtotal, discount_amount, discount_reason
    ) VALUES (
      inv_num, NEW.client_name, NEW.client_phone, NEW.client_id, NEW.id,
      primary_service, NEW.price, CURRENT_DATE, 'pending_approval', NEW.agent_id,
      COALESCE(NEW.line_items, '[]'::jsonb),
      NEW.salesperson_id, NEW.salesperson_name, NEW.salesperson_role,
      'Auto-generated from locked booking ' || NEW.id::text,
      NEW.subtotal, COALESCE(NEW.discount_amount, 0), NEW.discount_reason
    );
  END IF;
  RETURN NEW;
END;
$function$;
