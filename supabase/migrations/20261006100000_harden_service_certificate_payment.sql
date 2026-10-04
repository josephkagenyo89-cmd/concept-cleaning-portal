BEGIN;

-- M-Pesa code is only required for M-Pesa payments.
ALTER TABLE public.service_certificates
  ALTER COLUMN mpesa_code DROP NOT NULL;

-- Payment method must support the same controlled methods as bookings/invoices.
ALTER TABLE public.service_certificates
  DROP CONSTRAINT IF EXISTS service_certificates_payment_method_check;

ALTER TABLE public.service_certificates
  ADD CONSTRAINT service_certificates_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('mpesa', 'cash', 'bank')
  );

-- Payment reference is optional for Cash, required by application logic
-- for M-Pesa and Bank.
ALTER TABLE public.service_certificates
  ALTER COLUMN payment_reference DROP NOT NULL;

COMMIT;
