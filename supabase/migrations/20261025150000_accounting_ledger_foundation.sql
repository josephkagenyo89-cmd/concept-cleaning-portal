-- Accounting foundation, Phase 1.
-- Creates a separate double-entry ledger. Does not backfill or modify operational records.
-- Do not apply to production until the migration is reviewed and explicitly approved.

CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT accounting_periods_dates_valid CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS accounting_periods_status_dates_idx
  ON public.accounting_periods (status, start_date, end_date);

CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (
    account_type IN ('asset', 'liability', 'equity', 'income', 'expense')
  ),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  description text,
  is_system_account boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT accounting_accounts_not_own_parent
    CHECK (parent_account_id IS NULL OR parent_account_id <> id)
);

CREATE INDEX IF NOT EXISTS accounting_accounts_parent_idx
  ON public.accounting_accounts (parent_account_id);
CREATE INDEX IF NOT EXISTS accounting_accounts_type_active_idx
  ON public.accounting_accounts (account_type, is_active);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  source_type text,
  source_id text,
  posting_purpose text,
  reversal_of_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  posted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_source_fields_together CHECK (
    (source_type IS NULL AND source_id IS NULL AND posting_purpose IS NULL)
    OR
    (source_type IS NOT NULL AND source_id IS NOT NULL AND posting_purpose IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_source_event_unique
  ON public.journal_entries (source_type, source_id, posting_purpose)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND posting_purpose IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_one_reversal_per_entry
  ON public.journal_entries (reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS journal_entries_date_status_idx
  ON public.journal_entries (entry_date, status);
CREATE INDEX IF NOT EXISTS journal_entries_period_idx
  ON public.journal_entries (period_id);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx
  ON public.journal_entries (source_type, source_id);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  line_number integer NOT NULL CHECK (line_number > 0),
  account_id uuid NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  description text,
  debit numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  customer_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  supplier_reference text,
  tracking_category text,
  tracking_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_lines_one_side_only CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  ),
  CONSTRAINT journal_lines_entry_line_unique UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX IF NOT EXISTS journal_lines_entry_idx
  ON public.journal_lines (journal_entry_id, line_number);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx
  ON public.journal_lines (account_id);
CREATE INDEX IF NOT EXISTS journal_lines_customer_idx
  ON public.journal_lines (customer_id);

CREATE TABLE IF NOT EXISTS public.accounting_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  before_data jsonb,
  after_data jsonb
);

CREATE INDEX IF NOT EXISTS accounting_audit_log_record_idx
  ON public.accounting_audit_log (table_name, record_id, occurred_at DESC);

-- Prevent overlapping accounting periods without requiring an extension.
CREATE OR REPLACE FUNCTION public.accounting_periods_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.start_date > NEW.end_date THEN
    RAISE EXCEPTION 'Accounting period start date must be on or before end date';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounting_periods p
    WHERE p.id IS DISTINCT FROM NEW.id
      AND daterange(p.start_date, p.end_date, '[]')
          && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Accounting periods cannot overlap';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'closed' THEN
      IF (to_jsonb(NEW) - ARRAY['closed_at', 'closed_by'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['closed_at', 'closed_by']) THEN
        RAISE EXCEPTION 'Closed accounting periods are locked';
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'closed' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.closed_at := now();
      NEW.closed_by := auth.uid();
    ELSIF OLD.status IS DISTINCT FROM 'closed' THEN
      NEW.closed_at := now();
      NEW.closed_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_periods_validate ON public.accounting_periods;
CREATE TRIGGER trg_accounting_periods_validate
BEFORE INSERT OR UPDATE ON public.accounting_periods
FOR EACH ROW EXECUTE FUNCTION public.accounting_periods_validate();

-- Once posted, a journal header cannot be edited or deleted.
-- Corrections must be represented by a separate reversing journal.
CREATE OR REPLACE FUNCTION public.journal_entries_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status text;
  v_period_start date;
  v_period_end date;
  v_line_count bigint;
  v_debits numeric(18,2);
  v_credits numeric(18,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft journal entries can be deleted; posted entries must be reversed';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Journal entries must be created as drafts';
    END IF;
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  ELSE
    IF OLD.status IN ('posted', 'void') THEN
      RAISE EXCEPTION 'Journal entry is % and locked', OLD.status;
    END IF;
  END IF;

  NEW.updated_at := now();

  IF NEW.status = 'void' THEN
    IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft journal entries can be voided';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'posted' AND OLD.status IS DISTINCT FROM 'posted' THEN
    SELECT p.status, p.start_date, p.end_date
      INTO v_period_status, v_period_start, v_period_end
    FROM public.accounting_periods p
    WHERE p.id = NEW.period_id
    FOR UPDATE;

    IF v_period_status IS DISTINCT FROM 'open' THEN
      RAISE EXCEPTION 'Journal cannot be posted into a closed or missing accounting period';
    END IF;

    IF NEW.entry_date < v_period_start OR NEW.entry_date > v_period_end THEN
      RAISE EXCEPTION 'Journal date must fall inside its accounting period';
    END IF;

    SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
      INTO v_line_count, v_debits, v_credits
    FROM public.journal_lines
    WHERE journal_entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'A posted journal must contain at least two lines';
    END IF;

    IF v_debits <> v_credits THEN
      RAISE EXCEPTION 'Journal is not balanced: debits %, credits %', v_debits, v_credits;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.journal_lines l
      JOIN public.accounting_accounts a ON a.id = l.account_id
      WHERE l.journal_entry_id = NEW.id
        AND a.is_active = false
    ) THEN
      RAISE EXCEPTION 'Journal contains an inactive account';
    END IF;

    IF NEW.reversal_of_entry_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries original
      WHERE original.id = NEW.reversal_of_entry_id
        AND original.status = 'posted'
        AND original.reversal_of_entry_id IS NULL
    ) THEN
      RAISE EXCEPTION 'A reversal must reference an original posted, non-reversal journal';
    END IF;

    IF NEW.reversal_of_entry_id IS NOT NULL AND EXISTS (
      WITH original_totals AS (
        SELECT account_id, SUM(debit) AS debit, SUM(credit) AS credit
        FROM public.journal_lines
        WHERE journal_entry_id = NEW.reversal_of_entry_id
        GROUP BY account_id
      ),
      reversal_totals AS (
        SELECT account_id, SUM(debit) AS debit, SUM(credit) AS credit
        FROM public.journal_lines
        WHERE journal_entry_id = NEW.id
        GROUP BY account_id
      ),
      comparison AS (
        SELECT COALESCE(o.account_id, r.account_id) AS account_id,
               COALESCE(o.debit, 0) AS original_debit,
               COALESCE(o.credit, 0) AS original_credit,
               COALESCE(r.debit, 0) AS reversal_debit,
               COALESCE(r.credit, 0) AS reversal_credit
        FROM original_totals o
        FULL JOIN reversal_totals r USING (account_id)
      )
      SELECT 1 FROM comparison
      WHERE reversal_debit <> original_credit
         OR reversal_credit <> original_debit
    ) THEN
      RAISE EXCEPTION 'Reversal lines must exactly reverse the original journal by account';
    END IF;

    NEW.posted_at := now();
    NEW.posted_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_guard ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.journal_entries_guard();

-- Journal lines are mutable only while their parent journal remains a draft.
CREATE OR REPLACE FUNCTION public.journal_lines_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_status text;
  v_old_status text;
  v_account_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.journal_entry_id IS DISTINCT FROM NEW.journal_entry_id THEN
    SELECT status INTO v_old_status
    FROM public.journal_entries
    WHERE id = OLD.journal_entry_id
    FOR UPDATE;

    IF v_old_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Lines cannot be moved out of a journal that is not a draft';
    END IF;
  END IF;

  v_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END;

  SELECT status INTO v_status
  FROM public.journal_entries
  WHERE id = v_entry_id
  FOR UPDATE;

  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Journal lines can only be changed while the parent journal is a draft';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT is_active INTO v_account_active
    FROM public.accounting_accounts
    WHERE id = NEW.account_id;

    IF v_account_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Journal line must reference an active account';
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_lines_guard ON public.journal_lines;
CREATE TRIGGER trg_journal_lines_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.journal_lines_guard();

-- Record journal and account changes in an accounting-specific audit trail.
CREATE OR REPLACE FUNCTION public.accounting_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_id := COALESCE(v_before ->> 'id', v_before ->> 'journal_number');
  ELSIF TG_OP = 'INSERT' THEN
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_id := COALESCE(v_after ->> 'id', v_after ->> 'journal_number');
  ELSE
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_id := COALESCE(v_after ->> 'id', v_after ->> 'journal_number');
  END IF;

  INSERT INTO public.accounting_audit_log (
    table_name, record_id, action, actor_id, before_data, after_data
  ) VALUES (
    TG_TABLE_NAME, COALESCE(v_id, 'unknown'), TG_OP, auth.uid(), v_before, v_after
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_accounts_audit ON public.accounting_accounts;
CREATE TRIGGER trg_accounting_accounts_audit
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_accounts
FOR EACH ROW EXECUTE FUNCTION public.accounting_write_audit();

DROP TRIGGER IF EXISTS trg_journal_entries_audit ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.accounting_write_audit();

DROP TRIGGER IF EXISTS trg_journal_lines_audit ON public.journal_lines;
CREATE TRIGGER trg_journal_lines_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.accounting_write_audit();

-- Restrict all accounting data to authenticated admins/super admins initially.
-- Additional read-only finance roles can be added after mapping the current role model.
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_periods_admin_all ON public.accounting_periods;
CREATE POLICY accounting_periods_admin_all ON public.accounting_periods
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS accounting_accounts_admin_all ON public.accounting_accounts;
CREATE POLICY accounting_accounts_admin_all ON public.accounting_accounts
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS journal_entries_admin_all ON public.journal_entries;
CREATE POLICY journal_entries_admin_all ON public.journal_entries
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS journal_lines_admin_all ON public.journal_lines;
CREATE POLICY journal_lines_admin_all ON public.journal_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries e
      WHERE e.id = journal_entry_id
        AND public.is_admin_or_super(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries e
      WHERE e.id = journal_entry_id
        AND public.is_admin_or_super(auth.uid())
    )
  );

DROP POLICY IF EXISTS accounting_audit_log_admin_read ON public.accounting_audit_log;
CREATE POLICY accounting_audit_log_admin_read ON public.accounting_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT SELECT ON public.accounting_audit_log TO authenticated;
