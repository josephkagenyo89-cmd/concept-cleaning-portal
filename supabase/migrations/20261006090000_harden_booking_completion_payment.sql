-- Concept Cleaning Services
-- Harden completed-booking payment collection.
-- Full outstanding balance only.
-- Supports M-Pesa, Cash and Bank.
-- Preserves existing invoice/discount workflow.

BEGIN;

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

  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to collect booking payment';
  END IF;

  v_reference := NULLIF(TRIM(p_payment_reference), '');

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('mpesa', 'cash', 'bank') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  IF p_payment_method IN ('mpesa', 'bank')
     AND v_reference IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required for M-Pesa and Bank payments';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status NOT IN ('completed', 'fully_confirmed') THEN
    RAISE EXCEPTION 'Booking must be completed before payment can be collected';
  END IF;

  v_amount_due := GREATEST(
    COALESCE(v_booking.price, 0)
    - COALESCE(v_booking.amount_paid, 0),
    0
  );

  IF v_amount_due <= 0 THEN
    RAISE EXCEPTION 'Booking has no outstanding balance';
  END IF;

  IF p_payment_method = 'mpesa'
     AND EXISTS (
       SELECT 1
       FROM public.income_records
       WHERE UPPER(TRIM(COALESCE(mpesa_code, ''))) =
             UPPER(TRIM(v_reference))
     ) THEN
    RAISE EXCEPTION 'This M-Pesa transaction code has already been recorded';
  END IF;

  SELECT s.name
  INTO v_service_name
  FROM public.services s
  WHERE s.id = v_booking.service_id;

  v_service_name := COALESCE(v_service_name, 'Cleaning Service');

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

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

    IF v_invoice.payment_status = 'paid' THEN
      RAISE EXCEPTION 'This booking invoice is already paid';
    END IF;

    IF COALESCE(v_invoice.amount, 0)
       <> COALESCE(v_booking.price, 0) THEN
      RAISE EXCEPTION 'Invoice amount does not match booking final price';
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
      v_amount_due,
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

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'income_id', v_income_id,
    'amount_paid', v_booking.price,
    'amount_collected', v_amount_due,
    'amount_due', 0,
    'payment_method', p_payment_method,
    'payment_reference', v_reference
  );

END;
$function$;

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
