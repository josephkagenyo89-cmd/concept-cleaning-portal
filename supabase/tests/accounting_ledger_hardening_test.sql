-- Regression tests for accounting ledger hardening.
-- Run only on a disposable/local database after applying the foundation and hardening migrations.
-- All records are rolled back; these tests have not been executed by this file creation.

BEGIN;

DO $$
DECLARE
  test_suffix text := gen_random_uuid()::text;
  period_a uuid;
  period_b uuid;
  cash_account_id uuid;
  revenue_account_id uuid;
  journal_id uuid;
  line_id uuid;
  blocked boolean;
BEGIN
  SELECT id INTO cash_account_id FROM public.accounting_accounts WHERE code = '1000';
  SELECT id INTO revenue_account_id FROM public.accounting_accounts WHERE code = '4000';
  IF cash_account_id IS NULL OR revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Required starter chart accounts are missing';
  END IF;

  -- Overlapping inclusive date ranges must be rejected.
  INSERT INTO public.accounting_periods(name, starts_on, ends_on)
  VALUES ('TEST overlap A ' || test_suffix, DATE '2098-01-01', DATE '2098-01-31')
  RETURNING id INTO period_a;

  blocked := false;
  BEGIN
    INSERT INTO public.accounting_periods(name, starts_on, ends_on)
    VALUES ('TEST overlap B ' || test_suffix, DATE '2098-01-31', DATE '2098-02-28')
    RETURNING id INTO period_b;
  EXCEPTION WHEN exclusion_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'TEST FAILED: overlapping accounting periods were accepted';
  END IF;

  -- Create and post a balanced journal so account classification is historical.
  INSERT INTO public.accounting_periods(name, starts_on, ends_on)
  VALUES ('TEST account guard ' || test_suffix, DATE '2098-03-01', DATE '2098-03-31')
  RETURNING id INTO period_b;

  INSERT INTO public.journal_entries(entry_date, description, period_id)
  VALUES (DATE '2098-03-15', 'TEST hardening posted journal', period_b)
  RETURNING id INTO journal_id;

  INSERT INTO public.journal_lines(journal_entry_id, line_number, account_id, debit, credit)
  VALUES (journal_id, 1, cash_account_id, 25.00, 0)
  RETURNING id INTO line_id;

  INSERT INTO public.journal_lines(journal_entry_id, line_number, account_id, debit, credit)
  VALUES (journal_id, 2, revenue_account_id, 0, 25.00);

  UPDATE public.journal_entries SET status = 'posted' WHERE id = journal_id;

  -- Journal-line insert should have been written to the audit log.
  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_audit_log
    WHERE table_name = 'journal_lines'
      AND record_id = line_id::text
      AND action = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'TEST FAILED: journal line change was not audited';
  END IF;

  -- Reclassifying an account with posted activity must be rejected.
  blocked := false;
  BEGIN
    UPDATE public.accounting_accounts
       SET account_type = 'liability'
     WHERE id = cash_account_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Account classification cannot change%' THEN RAISE; END IF;
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'TEST FAILED: account classification changed after posting';
  END IF;

  RAISE NOTICE 'Accounting ledger hardening regression checks passed';
END;
$$;

ROLLBACK;
