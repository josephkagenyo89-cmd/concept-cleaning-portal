-- Manual regression tests for the accounting ledger foundation.
-- Run only against a disposable/local database after applying the foundation migration.
-- All test data is rolled back. These tests have not been executed by the assistant.

BEGIN;

DO $$
DECLARE
  open_period_id uuid;
  closed_period_id uuid;
  cash_account_id uuid;
  revenue_account_id uuid;
  balanced_journal_id uuid;
  unbalanced_journal_id uuid;
  closed_journal_id uuid;
  test_source_id text := gen_random_uuid()::text;
  test_failed boolean;
BEGIN
  SELECT id INTO cash_account_id FROM public.accounting_accounts WHERE code = '1000';
  SELECT id INTO revenue_account_id FROM public.accounting_accounts WHERE code = '4000';
  IF cash_account_id IS NULL OR revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Required starter chart accounts are missing';
  END IF;

  INSERT INTO public.accounting_periods(name, starts_on, ends_on, status)
  VALUES ('TEST open period ' || test_source_id, CURRENT_DATE - 1, CURRENT_DATE + 1, 'open')
  RETURNING id INTO open_period_id;

  INSERT INTO public.accounting_periods(name, starts_on, ends_on, status, closed_at)
  VALUES ('TEST closed period ' || test_source_id, CURRENT_DATE - 1, CURRENT_DATE + 1, 'closed', now())
  RETURNING id INTO closed_period_id;

  -- Balanced journal should post.
  INSERT INTO public.journal_entries(entry_date, description, period_id, source_type, source_id)
  VALUES (CURRENT_DATE, 'TEST balanced journal', open_period_id, 'accounting_test', test_source_id)
  RETURNING id INTO balanced_journal_id;

  INSERT INTO public.journal_lines(journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (balanced_journal_id, 1, cash_account_id, 100.00, 0),
    (balanced_journal_id, 2, revenue_account_id, 0, 100.00);

  UPDATE public.journal_entries SET status = 'posted' WHERE id = balanced_journal_id;
  IF (SELECT status FROM public.journal_entries WHERE id = balanced_journal_id) <> 'posted' THEN
    RAISE EXCEPTION 'TEST FAILED: balanced journal did not post';
  END IF;

  -- Posted journal lines must be immutable.
  test_failed := false;
  BEGIN
    INSERT INTO public.journal_lines(journal_entry_id, line_number, account_id, debit, credit)
    VALUES (balanced_journal_id, 3, cash_account_id, 1.00, 0);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Journal lines can only be changed%' THEN RAISE; END IF;
    test_failed := true;
  END;
  IF NOT test_failed THEN RAISE EXCEPTION 'TEST FAILED: posted journal accepted a new line'; END IF;

  -- Unbalanced journal must not post.
  INSERT INTO public.journal_entries(entry_date, description, period_id)
  VALUES (CURRENT_DATE, 'TEST unbalanced journal', open_period_id)
  RETURNING id INTO unbalanced_journal_id;
  INSERT INTO public.journal_lines(journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (unbalanced_journal_id, 1, cash_account_id, 100.00, 0),
    (unbalanced_journal_id, 2, revenue_account_id, 0, 90.00);

  test_failed := false;
  BEGIN
    UPDATE public.journal_entries SET status = 'posted' WHERE id = unbalanced_journal_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%equal, non-zero total debits and credits%' THEN RAISE; END IF;
    test_failed := true;
  END;
  IF NOT test_failed THEN RAISE EXCEPTION 'TEST FAILED: unbalanced journal was posted'; END IF;

  -- Duplicate source idempotency key must be rejected.
  test_failed := false;
  BEGIN
    INSERT INTO public.journal_entries(entry_date, description, period_id, source_type, source_id)
    VALUES (CURRENT_DATE, 'TEST duplicate source', open_period_id, 'accounting_test', test_source_id);
  EXCEPTION WHEN unique_violation THEN
    test_failed := true;
  END;
  IF NOT test_failed THEN RAISE EXCEPTION 'TEST FAILED: duplicate source key was accepted'; END IF;

  -- Closed accounting period must reject posting.
  INSERT INTO public.journal_entries(entry_date, description, period_id)
  VALUES (CURRENT_DATE, 'TEST closed period journal', closed_period_id)
  RETURNING id INTO closed_journal_id;
  INSERT INTO public.journal_lines(journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (closed_journal_id, 1, cash_account_id, 50.00, 0),
    (closed_journal_id, 2, revenue_account_id, 0, 50.00);

  test_failed := false;
  BEGIN
    UPDATE public.journal_entries SET status = 'posted' WHERE id = closed_journal_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%closed accounting period%' THEN RAISE; END IF;
    test_failed := true;
  END;
  IF NOT test_failed THEN RAISE EXCEPTION 'TEST FAILED: journal posted into closed period'; END IF;

  RAISE NOTICE 'Accounting foundation regression checks passed';
END;
$$;

ROLLBACK;
