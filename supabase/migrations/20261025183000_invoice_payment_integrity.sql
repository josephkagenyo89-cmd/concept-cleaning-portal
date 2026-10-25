-- Atomic invoice payment recording with partial-payment support.
-- This creates a payment ledger; it does not post to the accounting GL yet.
-- Apply only after verifying the target Supabase project and testing locally.

BEGIN;

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('mpesa', 'cash', 'bank')),
  payment_reference text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  income_record_id uuid REFERENCES public.income_records(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_reference_required CHECK (
    payment_method = 'cash' OR NULLIF(BTRIM(payment_reference), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_date
  ON public.invoice_payments(invoice_id, payment_date, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_unique_reference
  ON public.invoice_payments (payment_method, upper(btrim(payment_reference)))
  WHERE payment_method IN ('mpesa', 'bank') AND NULLIF(btrim(payment_reference), '') IS NOT NULL;

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accounting admins view invoice payments" ON public.invoice_payments;
CREATE POLICY "Accounting admins view invoice payments"
  ON public.invoice_payments FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

GRANT SELECT ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_reference text,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment_id uuid;
  v_income_id uuid;
  v_reference text := NULLIF(BTRIM(p_payment_reference), '');
  v_paid_before numeric(18,2);
  v_balance numeric(18,2);
  v_paid_after numeric(18,2);
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized administrators may record invoice payments';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Payment amount must be a positive amount to two decimal places';
  END IF;
  IF p_payment_method NOT IN ('mpesa', 'cash', 'bank') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_payment_method IN ('mpesa', 'bank') AND v_reference IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required for M-Pesa and bank payments';
  END IF;
  IF p_payment_date IS NULL OR p_payment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Payment date is invalid or in the future';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.payment_status IN ('cancelled', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment against a cancelled invoice';
  END IF;
  IF v_invoice.payment_status NOT IN ('approved', 'partial') THEN
    RAISE EXCEPTION 'Invoice must be approved before payment can be recorded';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid_before
  FROM public.invoice_payments
  WHERE invoice_id = p_invoice_id;

  v_balance := round(GREATEST(COALESCE(v_invoice.amount, 0) - v_paid_before, 0), 2);
  IF v_balance <= 0 THEN RAISE EXCEPTION 'Invoice has no outstanding balance'; END IF;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment exceeds outstanding balance of %', v_balance;
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, amount, payment_method, payment_reference, payment_date, recorded_by
  ) VALUES (
    p_invoice_id, p_amount, p_payment_method, v_reference, p_payment_date, auth.uid()
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.income_records (
    date, amount, description, service, payment_method, source,
    booking_id, invoice_id, created_by, client_id, mpesa_code, payment_reference, status
  ) VALUES (
    p_payment_date,
    p_amount,
    'Payment for invoice ' || v_invoice.invoice_number,
    v_invoice.service,
    p_payment_method,
    'client_payment',
    v_invoice.booking_id,
    v_invoice.id,
    auth.uid(),
    v_invoice.client_id,
    CASE WHEN p_payment_method = 'mpesa' THEN v_reference ELSE NULL END,
    v_reference,
    'pending_approval'
  ) RETURNING id INTO v_income_id;

  UPDATE public.invoice_payments SET income_record_id = v_income_id WHERE id = v_payment_id;

  v_paid_after := v_paid_before + p_amount;
  v_status := CASE WHEN v_paid_after >= COALESCE(v_invoice.amount, 0)
                   THEN 'paid' ELSE 'partial' END;

  UPDATE public.invoices
  SET payment_status = v_status,
      payment_method = p_payment_method,
      payment_reference = v_reference,
      mpesa_code = CASE WHEN p_payment_method = 'mpesa' THEN v_reference ELSE NULL END,
      payment_date = p_payment_date::timestamptz,
      updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'income_record_id', v_income_id,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'payment_amount', p_amount,
    'total_paid', v_paid_after,
    'outstanding_balance', round(GREATEST(COALESCE(v_invoice.amount, 0) - v_paid_after, 0), 2),
    'payment_status', v_status,
    'payment_method', p_payment_method,
    'payment_reference', v_reference,
    'payment_date', p_payment_date
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, numeric, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, numeric, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, text, text, date) TO authenticated;

COMMIT;
