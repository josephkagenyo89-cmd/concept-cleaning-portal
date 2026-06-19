
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_approval_comment text,
  ADD COLUMN IF NOT EXISTS discount_requested_at timestamptz;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_approval_comment text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_approval_comment text;
ALTER TABLE public.income_records ADD COLUMN IF NOT EXISTS discount_approval_comment text;
ALTER TABLE public.service_certificates ADD COLUMN IF NOT EXISTS discount_approval_comment text;

-- Recompute booking price when a discount approval status changes
CREATE OR REPLACE FUNCTION public.apply_discount_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  margin numeric := COALESCE(NEW.agent_margin, 0);
  sub numeric := COALESCE(NEW.subtotal, NEW.price, 0);
BEGIN
  IF NEW.discount_approval_status IS DISTINCT FROM OLD.discount_approval_status THEN
    IF NEW.discount_approval_status = 'approved' THEN
      NEW.price := GREATEST(0, sub - COALESCE(NEW.discount_amount, 0)) + margin;
    ELSIF NEW.discount_approval_status = 'rejected' THEN
      NEW.discount_amount := 0;
      NEW.price := sub + margin;
    END IF;
    NEW.agent_price := NEW.price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_discount_on_approval ON public.bookings;
CREATE TRIGGER trg_apply_discount_on_approval
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.apply_discount_on_approval();

-- Update invoice-creation trigger: only apply discount when approved
CREATE OR REPLACE FUNCTION public.auto_create_invoice_on_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_num text;
  existing_id uuid;
  primary_service text;
  use_discount boolean;
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

    use_discount := NEW.discount_approval_status = 'approved' AND COALESCE(NEW.discount_amount, 0) > 0;

    INSERT INTO public.invoices (
      invoice_number, client_name, client_phone, client_id, booking_id,
      service, amount, date, payment_status, created_by, line_items,
      salesperson_id, salesperson_name, salesperson_role, notes,
      subtotal, discount_amount, discount_reason, discount_approval_comment
    ) VALUES (
      inv_num, NEW.client_name, NEW.client_phone, NEW.client_id, NEW.id,
      primary_service, NEW.price, CURRENT_DATE, 'pending_approval', NEW.agent_id,
      COALESCE(NEW.line_items, '[]'::jsonb),
      NEW.salesperson_id, NEW.salesperson_name, NEW.salesperson_role,
      'Auto-generated from locked booking ' || NEW.id::text,
      NEW.subtotal,
      CASE WHEN use_discount THEN NEW.discount_amount ELSE 0 END,
      CASE WHEN use_discount THEN NEW.discount_reason ELSE NULL END,
      CASE WHEN use_discount THEN NEW.discount_approval_comment ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;
