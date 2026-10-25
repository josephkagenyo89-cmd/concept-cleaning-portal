-- Manual regression tests for the Expenses + Petty Cash extension.
-- Run only on a disposable/local database after applying both petty-cash migrations.
-- Test data is rolled back. These tests have not been executed by the assistant.

BEGIN;

DO $$
DECLARE
  test_fund_id uuid;
  calculated_balance numeric(14,2);
  opening_rows integer;
BEGIN
  INSERT INTO public.petty_cash_funds(name, opening_balance, is_active)
  VALUES ('TEST petty cash fund ' || gen_random_uuid()::text, 1000.00, true)
  RETURNING id INTO test_fund_id;

  SELECT COUNT(*) INTO opening_rows
  FROM public.petty_cash_transactions
  WHERE fund_id = test_fund_id AND transaction_type = 'opening_balance';
  IF opening_rows <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: opening balance was not written to the cashbook exactly once';
  END IF;

  INSERT INTO public.petty_cash_transactions(
    fund_id, transaction_date, transaction_type, amount, description, status
  ) VALUES
    (test_fund_id, CURRENT_DATE, 'replenishment', 500.00, 'TEST replenishment', 'approved'),
    (test_fund_id, CURRENT_DATE, 'adjustment_out', 100.00, 'TEST cash adjustment out', 'approved'),
    (test_fund_id, CURRENT_DATE, 'replenishment', 50.00, 'TEST pending replenishment', 'pending_approval');

  SELECT current_balance INTO calculated_balance
  FROM public.petty_cash_fund_balances
  WHERE fund_id = test_fund_id;

  IF calculated_balance <> 1400.00 THEN
    RAISE EXCEPTION 'TEST FAILED: expected petty-cash balance 1400.00, got %', calculated_balance;
  END IF;

  RAISE NOTICE 'Petty-cash regression checks passed';
END;
$$;

ROLLBACK;
