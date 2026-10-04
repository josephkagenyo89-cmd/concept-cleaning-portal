-- Concept Cleaning Services
-- Booking Completion Payment Flow
--
-- Adds a controlled full-payment workflow for completed bookings.
-- Supports M-Pesa, Cash and Bank.
--
-- Financial truth remains server-side.
-- Receipt/certificate document generation remains application-side.

BEGIN;

-- ============================================================
-- 1. PAYMENT FIELDS
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE public.income_records
  ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE public.service_certificates
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- Controlled payment methods.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('mpesa', 'cash', 'bank')
  );

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_method_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('mpesa', 'cash', 'bank')
  );

-- ============================================================
-- 2. ATOMIC BOOKING PAYMENT FUNCTION
-- ============================================================
--
-- This function is the financial source of truth for the new
-- "Collect Payment" workflow.
--
-- It requires the FULL outstanding balance.
--
-- It:
--   1. Authorizes the admin.
--   2. Locks the booking.
--   3. Validates the booking status.
--   4. Calculates the exact outstanding balance.
--   5. Requires the payment to equal that balance.
--   6. Finds or creates the invoice.
--   7. Marks the invoice paid.
--   8. Creates exactly one income record.
--   9. Persists payment data on the booking.
--  10. Returns the financial result.
--
-- Receipt and certificate generation remain outside the RPC.

CREATE OR REPLACE FUNCTION public.collect_booking_payment(
  p_booking_id uuid,
  p_payment_method text,
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$

DECLARE
  v_booking public.bookings%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_income_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_amount_due numeric;
  v_service_name text;
  v_existing_income_id uuid;
  v_reference text;
BEGIN

  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------

  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to collect booking payment';
  END IF;

  -- ----------------------------------------------------------
  -- Normalize reference
  -- ----------------------------------------------------------

  v_reference := NULLIF(TRIM(p_payment_reference), '');

  -- ----------------------------------------------------------
  -- Validate payment method
  -- ----------------------------------------------------------

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('mpesa', 'cash', 'bank') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  -- ----------------------------------------------------------
  -- Payment reference rules
  -- ----------------------------------------------------------

  IF p_payment_method IN ('mpesa', 'bank')
     AND v_reference IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required for M-Pesa and Bank payments';
  END IF;

  -- ----------------------------------------------------------
  -- Lock booking
  -- ----------------------------------------------------------

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- ----------------------------------------------------------
  -- Booking must be completed
  -- ----------------------------------------------------------

  IF v_booking.status NOT IN ('completed', 'fully_confirmed') THEN
    RAISE EXCEPTION 'Booking must be completed before payment can be collected';
  END IF;

  -- ----------------------------------------------------------
  -- Service name
  -- ----------------------------------------------------------

  SELECT s.name
  INTO v_service_name
  FROM public.services s
  WHERE s.id = v_booking.service_id;

  v_service_name := COALESCE(v_service_name, 'Cleaning Service');

  -- ----------------------------------------------------------
  -- Calculate exact outstanding balance
  -- ----------------------------------------------------------

  v_amount_due := GREATEST(
    COALESCE(v_booking.price, 0)
    - COALESCE(v_booking.amount_paid, 0),
    0
  );

  IF v_amount_due <= 0 THEN
    RAISE EXCEPTION 'Booking has no outstanding balance';
  END IF;

  -- ----------------------------------------------------------
  -- M-Pesa duplicate protection
  -- ----------------------------------------------------------

  IF p_payment_method = 'mpesa'
     AND EXISTS (
       SELECT 1
       FROM public.income_records
       WHERE mpesa_code = v_reference
     ) THEN
    RAISE EXCEPTION 'This M-Pesa transaction code has already been recorded';
  END IF;

  -- ----------------------------------------------------------
  -- Find existing invoice
  -- ----------------------------------------------------------

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  -- ----------------------------------------------------------
  -- Create invoice if none exists
  -- ----------------------------------------------------------

  IF v_invoice.id IS NULL THEN

    v_invoice_number :=
      'CCS-INV-' ||
      nextval('public.invoice_number_seq')::text;

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
      notes,
      subtotal,
      discount_amount,
      discount_reason,
      payment_method,
      payment_reference,
      mpesa_code,
      payment_date
    )
    VALUES (
      v_invoice_number,
      v_booking.client_name,
      v_booking.client_phone,
      v_booking.client_id,
      v_booking.id,
      v_service_name,
      v_booking.price,
      CURRENT_DATE,
      'paid',
      auth.uid(),
      COALESCE(v_booking.line_items, '[]'::jsonb),
      v_booking.salesperson_id,
      v_booking.salesperson_name,
      v_booking.salesperson_role,
      'Created from completed booking payment collection',
      v_booking.subtotal,
      COALESCE(v_booking.discount_amount, 0),
      v_booking.discount_reason,
      p_payment_method,
      v_reference,
      CASE
        WHEN p_payment_method = 'mpesa'
        THEN v_reference
        ELSE NULL
      END,
      now()
    )
    RETURNING * INTO v_invoice;

  ELSE

    -- --------------------------------------------------------
    -- Existing invoice
    -- --------------------------------------------------------

    IF v_invoice.payment_status = 'paid' THEN
      RAISE EXCEPTION 'This booking invoice is already paid';
    END IF;

    -- Existing invoice must represent the booking amount.
    IF COALESCE(v_invoice.amount, 0)
       <> COALESCE(v_booking.price, 0) THEN
      RAISE EXCEPTION 'Invoice amount does not match booking amount';
    END IF;

    UPDATE public.invoices
    SET
      payment_status = 'paid',
      payment_method = p_payment_method,
      payment_reference = v_reference,
      mpesa_code = CASE
        WHEN p_payment_method = 'mpesa'
        THEN v_reference
        ELSE NULL
      END,
      payment_date = now(),
      updated_at = now()
    WHERE id = v_invoice.id
    RETURNING * INTO v_invoice;

  END IF;

  v_invoice_id := v_invoice.id;

  -- ----------------------------------------------------------
  -- Create income record
  -- ----------------------------------------------------------
  --
  -- invoice_id is the idempotency key.
  --

  SELECT id
  INTO v_existing_income_id
  FROM public.income_records
  WHERE invoice_id = v_invoice_id
  LIMIT 1;

  IF v_existing_income_id IS NULL THEN

    INSERT INTO public.income_records (
      date,
      amount,
      description,
      service,
      payment_method,
      source,
      booking_id,
      invoice_id,
      created_by,
      client_id,
      mpesa_code,
      payment_reference,
      status
    )
    VALUES (
      CURRENT_DATE,
      v_booking.price,
      'Payment for completed booking ' || v_booking.id::text,
      v_service_name,
      p_payment_method,
      'client_payment',
      v_booking.id,
      v_invoice_id,
      auth.uid(),
      v_booking.client_id,
      CASE
        WHEN p_payment_method = 'mpesa'
        THEN v_reference
        ELSE NULL
      END,
      v_reference,
      'pending_approval'
    )
    RETURNING id INTO v_income_id;

  ELSE

    v_income_id := v_existing_income_id;

  END IF;

  -- ----------------------------------------------------------
  -- Persist full payment on booking
  -- ----------------------------------------------------------

  UPDATE public.bookings
  SET
    amount_paid = v_booking.price,
    payment_method = p_payment_method,
    payment_reference = v_reference,
    mpesa_code = CASE
      WHEN p_payment_method = 'mpesa'
      THEN v_reference
      ELSE mpesa_code
    END,
    payment_date = now()
  WHERE id = p_booking_id;

  -- ----------------------------------------------------------
  -- Return result
  -- ----------------------------------------------------------

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'income_id', v_income_id,
    'amount_paid', v_booking.price,
    'amount_due', 0,
    'payment_method', p_payment_method,
    'payment_reference', v_reference
  );

END;
$function$;

-- ============================================================
-- 3. FUNCTION SECURITY
-- ============================================================

REVOKE ALL ON FUNCTION public.collect_booking_payment(
  uuid,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.collect_booking_payment(
  uuid,
  text,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.collect_booking_payment(
  uuid,
  text,
  text
) TO authenticated;

COMMIT;
