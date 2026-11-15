-- Harden the isolated accounting ledger before operational posting is introduced.
-- Safe to apply only after reviewing any manually-created accounting periods on the target DB.

BEGIN;

-- Prevent overlapping accounting periods at the database constraint level.
-- The inclusive range matches the existing starts_on/ends_on date semantics.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.accounting_periods a
    JOIN public.accounting_periods b
      ON a.id < b.id
     AND daterange(a.starts_on, a.ends_on, '[]') && daterange(b.starts_on, b.ends_on, '[]')
  ) THEN
    RAISE EXCEPTION 'Cannot harden accounting periods: overlapping periods already exist. Resolve overlaps before retrying.';
  END IF;
END;
$$;

ALTER TABLE public.accounting_periods
  ADD CONSTRAINT accounting_periods_no_overlap
  EXCLUDE USING gist (daterange(starts_on, ends_on, '[]') WITH &&);

-- Include journal-line changes in the accounting audit trail.
DROP TRIGGER IF EXISTS trg_journal_lines_audit ON public.journal_lines;
CREATE TRIGGER trg_journal_lines_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.accounting_audit_row();

-- Keep account identity/classification stable once it has affected posted books.
CREATE OR REPLACE FUNCTION public.accounting_guard_account_classification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  has_posted_activity boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_account THEN
      RAISE EXCEPTION 'System accounts cannot be deleted; deactivate them if no longer used';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.journal_lines jl
      JOIN public.journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = OLD.id AND je.status = 'posted'
    ) THEN
      RAISE EXCEPTION 'Accounts used by posted journals cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_system_account AND (
    NEW.code IS DISTINCT FROM OLD.code OR
    NEW.is_system_account IS DISTINCT FROM OLD.is_system_account OR
    NEW.is_control_account IS DISTINCT FROM OLD.is_control_account
  ) THEN
    RAISE EXCEPTION 'System account code and system/control flags are protected';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_id = OLD.id AND je.status = 'posted'
  ) INTO has_posted_activity;

  IF has_posted_activity AND (
    NEW.account_type IS DISTINCT FROM OLD.account_type OR
    NEW.parent_id IS DISTINCT FROM OLD.parent_id
  ) THEN
    RAISE EXCEPTION 'Account classification cannot change after posted journal activity; create a new account and use a controlled reclassification';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_account_classification_guard ON public.accounting_accounts;
CREATE TRIGGER trg_accounting_account_classification_guard
BEFORE UPDATE OR DELETE ON public.accounting_accounts
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_account_classification();

COMMIT;
