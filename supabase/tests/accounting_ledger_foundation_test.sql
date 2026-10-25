-- Development-only smoke tests for accounting_ledger_foundation.sql.
-- Run manually against a disposable/development database AFTER applying the migration there.
-- This script wraps all fixtures in a transaction and rolls them back.
-- Do not run against production.

BEGIN;

DO $accounting_test$
DECLARE
  v_period_id uuid;
  v_closed_period_id uuid;
  v_account_a uuid;
  v_account_b uuid;
  v_journal_id uuid;
  v_bad_journal_id uuid;
  v_reversal_id uuid;
  v_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 16);
  v_failed boolean;
  v_status text;
BEGIN
  INSERT INTO public.accounting_periods (name, start_date, end_date)
  VALUES ('Ledger test ' || v_suffix, DATE '2098-01-01', DATE '2098-12-31')
  RETURNING id INTO v_period_id;

  INSERT INTO public.accounting_accounts (code, name, account_type, normal_balance)
  VALUES ('TST-A-' || v_suffix, 'Test asset ' || v_suffix, 'asset', 'debit')
  RETURNING id INTO v_account_a;

  INSERT INTO public.accounting_accounts (code, name, account_type, normal_balance)
  VALUES ('TST-I-' || v_suffix, 'Test income ' || v_suffix, 'income', 'credit')
  RETURNING id INTO v_account_b;

  -- A balanced journal should post.
  INSERT INTO public.journal_entries (
    entry_date, description, period_id, source_type, source_id, posting_purpose
  ) VALUES (
    DATE '2098-02-01', 'Balanced posting test', v_period_id,
    'test', v_suffix, 'balanced-posting-test'
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (v_journal_id, 1, v_account_a, 100.00, 0),
    (v_journal_id, 2, v_account_b, 0, 100.00);

  UPDATE public.journal_entries SET status = 'posted' WHERE id = v_journal_id;

  SELECT status INTO v_status FROM public.journal_entries WHERE id = v_journal_id;
  IF v_status <> 'posted' THEN
    RAISE EXCEPTION 'TEST FAILED: balanced journal did not post';
  END IF;

  -- Posted journal lines must be immutable.
  v_failed := false;
  BEGIN
    UPDATE public.journal_lines
    SET description = 'attempted change'
    WHERE journal_entry_id = v_journal_id AND line_number = 1;
  EXCEPTION WHEN raise_exception THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST FAILED: posted journal line was editable';
  END IF;

  -- An unbalanced journal must not post.
  INSERT INTO public.journal_entries (entry_date, description, period_id)
  VALUES (DATE '2098-03-01', 'Unbalanced posting test', v_period_id)
  RETURNING id INTO v_bad_journal_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (v_bad_journal_id, 1, v_account_a, 50.00, 0),
    (v_bad_journal_id, 2, v_account_b, 0, 40.00);

  v_failed := false;
  BEGIN
    UPDATE public.journal_entries SET status = 'posted' WHERE id = v_bad_journal_id;
  EXCEPTION WHEN raise_exception THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST FAILED: unbalanced journal was posted';
  END IF;

  SELECT status INTO v_status FROM public.journal_entries WHERE id = v_bad_journal_id;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'TEST FAILED: rejected journal did not remain a draft';
  END IF;

  -- Reversal must exactly swap debits and credits for each account.
  INSERT INTO public.journal_entries (
    entry_date, description, period_id, reversal_of_entry_id
  ) VALUES (
    DATE '2098-02-02', 'Exact reversal test', v_period_id, v_journal_id
  ) RETURNING id INTO v_reversal_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (v_reversal_id, 1, v_account_b, 100.00, 0),
    (v_reversal_id, 2, v_account_a, 0, 100.00);

  UPDATE public.journal_entries SET status = 'posted' WHERE id = v_reversal_id;

  -- The same source event/purpose must not be registered twice.
  v_failed := false;
  BEGIN
    INSERT INTO public.journal_entries (
      entry_date, description, period_id, source_type, source_id, posting_purpose
    ) VALUES (
      DATE '2098-02-01', 'Duplicate source test', v_period_id,
      'test', v_suffix, 'balanced-posting-test'
    );
  EXCEPTION WHEN unique_violation THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST FAILED: duplicate source event was accepted';
  END IF;

  -- Journals cannot be posted into closed periods.
  INSERT INTO public.accounting_periods (name, start_date, end_date, status)
  VALUES ('Closed ledger test ' || v_suffix, DATE '2099-01-01', DATE '2099-12-31', 'closed')
  RETURNING id INTO v_closed_period_id;

  INSERT INTO public.journal_entries (entry_date, description, period_id)
  VALUES (DATE '2099-02-01', 'Closed period test', v_closed_period_id)
  RETURNING id INTO v_bad_journal_id;

  INSERT INTO public.journal_lines (journal_entry_id, line_number, account_id, debit, credit)
  VALUES
    (v_bad_journal_id, 1, v_account_a, 10.00, 0),
    (v_bad_journal_id, 2, v_account_b, 0, 10.00);

  v_failed := false;
  BEGIN
    UPDATE public.journal_entries SET status = 'posted' WHERE id = v_bad_journal_id;
  EXCEPTION WHEN raise_exception THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'TEST FAILED: journal posted into a closed period';
  END IF;

  RAISE NOTICE 'Accounting ledger foundation smoke tests passed.';
END;
$accounting_test$;

ROLLBACK;
