-- Add client_id linkage to income_records and signature_tokens
ALTER TABLE public.income_records ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE INDEX IF NOT EXISTS idx_income_records_client_id ON public.income_records(client_id);
CREATE INDEX IF NOT EXISTS idx_income_records_invoice_id ON public.income_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_income_records_booking_id ON public.income_records(booking_id);

ALTER TABLE public.signature_tokens ADD COLUMN IF NOT EXISTS client_id uuid;

-- Backfill client_id on income_records from linked invoice/booking
UPDATE public.income_records ir
SET client_id = i.client_id
FROM public.invoices i
WHERE ir.invoice_id = i.id AND ir.client_id IS NULL AND i.client_id IS NOT NULL;

UPDATE public.income_records ir
SET client_id = b.client_id
FROM public.bookings b
WHERE ir.booking_id = b.id AND ir.client_id IS NULL AND b.client_id IS NOT NULL;

-- Backfill client_id on signature_tokens from booking
UPDATE public.signature_tokens st
SET client_id = b.client_id
FROM public.bookings b
WHERE st.booking_id = b.id AND st.client_id IS NULL AND b.client_id IS NOT NULL;

-- Trigger: auto-inherit client_id on income_records insert from invoice or booking
CREATE OR REPLACE FUNCTION public.income_inherit_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    IF NEW.invoice_id IS NOT NULL THEN
      SELECT client_id INTO NEW.client_id FROM public.invoices WHERE id = NEW.invoice_id;
    END IF;
    IF NEW.client_id IS NULL AND NEW.booking_id IS NOT NULL THEN
      SELECT client_id INTO NEW.client_id FROM public.bookings WHERE id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_income_inherit_client_id ON public.income_records;
CREATE TRIGGER trg_income_inherit_client_id
BEFORE INSERT ON public.income_records
FOR EACH ROW
EXECUTE FUNCTION public.income_inherit_client_id();

-- Trigger: auto-inherit client_id on documents insert from invoice/booking/quotation
CREATE OR REPLACE FUNCTION public.document_inherit_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    IF NEW.invoice_id IS NOT NULL THEN
      SELECT client_id INTO NEW.client_id FROM public.invoices WHERE id = NEW.invoice_id;
    END IF;
    IF NEW.client_id IS NULL AND NEW.booking_id IS NOT NULL THEN
      SELECT client_id INTO NEW.client_id FROM public.bookings WHERE id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_inherit_client_id ON public.documents;
CREATE TRIGGER trg_document_inherit_client_id
BEFORE INSERT ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.document_inherit_client_id();