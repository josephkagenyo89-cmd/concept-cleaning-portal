-- Preserve discount audit details with every registered document and service certificate.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_approval_status text;

ALTER TABLE public.service_certificates
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_approval_status text;

COMMENT ON COLUMN public.documents.discount_amount IS 'Total discount applied to this document, in KES.';
COMMENT ON COLUMN public.documents.discount_reason IS 'Promotion label or reason for the discount.';
COMMENT ON COLUMN public.service_certificates.discount_amount IS 'Discount applied to the booking/invoice represented by this certificate.';
COMMENT ON COLUMN public.service_certificates.discount_reason IS 'Promotion label or reason for the discount.';
