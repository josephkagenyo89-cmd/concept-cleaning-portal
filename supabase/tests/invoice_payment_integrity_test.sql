-- Manual regression test for record_invoice_payment.
-- Run only against a disposable/local Supabase database.
-- Replace the UUID below with an existing admin/super-admin auth.users.id and ensure
-- at least one unpaid/approved invoice exists. All writes are rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'REPLACE_WITH_ADMIN_AUTH_USER_UUID', true);

DO $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_first jsonb;
  v_second jsonb;
  v_paid numeric;
  v_balance numeric;
  v_reference text := 'TEST-' || upper(substr(gen_random_uuid()::text, 1, 12));
  v_blocked boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Set request.jwt.claim.sub to a valid admin/super-admin auth user before running this test';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE payment_status NOT IN ('paid', 'cancelled', 'void')
    AND amount > 2
    AND NOT EXISTS (SELECT 1 FROM public.invoice_payments ip WHERE ip.invoice_id = invoices.id)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test requires an unpaid invoice with amount > KES 2 and no invoice_payments';
  END IF;

  v_first := public.record_invoice_payment(
    v_invoice.id,
    round(v_invoice.amount / 2, 2),
    'mpesa',
    v_reference,
    CURRENT_DATE
  );

  IF v_first->>'payment_status' <> 'partial' THEN
    RAISE EXCEPTION 'Expected partial status after first payment, got %', v_first->>'payment_status';
  END IF;
  IF (v_first->>'outstanding_balance')::numeric <= 0 THEN
    RAISE EXCEPTION 'Expected a positive outstanding balance after partial payment';
  END IF;

  -- Duplicate payment reference must fail, even on a different invoice.
  BEGIN
    PERFORM public.record_invoice_payment(
      v_invoice.id, 1, 'mpesa', v_reference, CURRENT_DATE
    );
  EXCEPTION WHEN unique_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Duplicate M-Pesa reference was accepted';
  END IF;

  -- Overpayment must fail.
  v_blocked := false;
  BEGIN
    PERFORM public.record_invoice_payment(
      v_invoice.id,
      (v_first->>'outstanding_balance')::numeric + 1,
      'cash',
      NULL,
      CURRENT_DATE
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Payment exceeds outstanding balance%' THEN RAISE; END IF;
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Overpayment was accepted'; END IF;

  v_second := public.record_invoice_payment(
    v_invoice.id,
    (v_first->>'outstanding_balance')::numeric,
    'cash',
    NULL,
    CURRENT_DATE
  );
  IF v_second->>'payment_status' <> 'paid' OR (v_second->>'outstanding_balance')::numeric <> 0 THEN
    RAISE EXCEPTION 'Expected invoice to be fully paid after settling remaining balance';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.invoice_payments WHERE invoice_id = v_invoice.id;
  IF round(v_paid, 2) <> round(v_invoice.amount, 2) THEN
    RAISE EXCEPTION 'Payment total does not reconcile to invoice amount';
  END IF;

  RAISE NOTICE 'Invoice payment regression checks passed for invoice %', v_invoice.invoice_number;
END;
$$;

ROLLBACK;
