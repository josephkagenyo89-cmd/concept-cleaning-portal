
-- Accounting & Finance supporting registers, budgets, banking and close controls.

ALTER TABLE public.accounting_approvals
  DROP CONSTRAINT IF EXISTS accounting_approvals_entity_type_check;
ALTER TABLE public.accounting_approvals
  ADD CONSTRAINT accounting_approvals_entity_type_check
  CHECK(entity_type IN ('income','expense','invoice','journal','petty_cash','payroll','budget','bank_reconciliation','asset'));

CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_default boolean NOT NULL DEFAULT true UNIQUE CHECK(is_default),
  currency_code text NOT NULL DEFAULT 'KES',
  financial_year_start_month integer NOT NULL DEFAULT 1 CHECK(financial_year_start_month BETWEEN 1 AND 12),
  vat_registered boolean NOT NULL DEFAULT false,
  vat_rate numeric(6,3) NOT NULL DEFAULT 0 CHECK(vat_rate>=0 AND vat_rate<=100),
  tax_registration_notes text,
  tax_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_required boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.accounting_settings(is_default,currency_code,financial_year_start_month,vat_registered,vat_rate,approval_required)
VALUES(true,'KES',1,false,0,true)
ON CONFLICT(is_default) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.accounting_fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'equipment',
  purchase_date date NOT NULL,
  purchase_cost numeric(18,2) NOT NULL CHECK(purchase_cost>0),
  residual_value numeric(18,2) NOT NULL DEFAULT 0 CHECK(residual_value>=0),
  useful_life_months integer CHECK(useful_life_months IS NULL OR useful_life_months>0),
  depreciation_method text NOT NULL DEFAULT 'straight_line'
    CHECK(depreciation_method IN ('straight_line','reducing_balance','none')),
  accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0 CHECK(accumulated_depreciation>=0),
  asset_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  depreciation_expense_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  accumulated_depreciation_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  source_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK(status IN ('pending_approval','approved','rejected','active','disposed')),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  disposal_date date,
  disposal_proceeds numeric(18,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(residual_value<=purchase_cost),
  CHECK(accumulated_depreciation<=purchase_cost-residual_value)
);

CREATE TABLE IF NOT EXISTS public.accounting_asset_depreciation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.accounting_fixed_assets(id) ON DELETE RESTRICT,
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  depreciation_date date NOT NULL,
  amount numeric(18,2) NOT NULL CHECK(amount>0),
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(asset_id,period_id)
);

CREATE TABLE IF NOT EXISTS public.accounting_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  financial_year_id uuid NOT NULL REFERENCES public.accounting_financial_years(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','pending_approval','approved','rejected','closed')),
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name,financial_year_id)
);

CREATE TABLE IF NOT EXISTS public.accounting_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.accounting_budgets(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(amount>=0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(budget_id,account_id,period_id)
);

CREATE TABLE IF NOT EXISTS public.accounting_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number_masked text,
  branch_name text,
  currency_code text NOT NULL DEFAULT 'KES',
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  opening_balance_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounting_bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES public.accounting_bank_accounts(id) ON DELETE RESTRICT,
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  statement_opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  statement_closing_balance numeric(18,2) NOT NULL,
  book_closing_balance numeric(18,2) NOT NULL DEFAULT 0,
  difference numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','pending_approval','approved','rejected')),
  notes text,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(bank_account_id,period_id)
);

CREATE TABLE IF NOT EXISTS public.accounting_bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.accounting_bank_reconciliations(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  description text NOT NULL,
  reference text,
  amount numeric(18,2) NOT NULL,
  direction text NOT NULL CHECK(direction IN ('debit','credit')),
  matched_journal_line_id uuid REFERENCES public.journal_lines(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched','matched','excluded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_asset_depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_bank_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting admins manage settings" ON public.accounting_settings
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage fixed assets" ON public.accounting_fixed_assets
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage asset depreciation" ON public.accounting_asset_depreciation
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage budgets" ON public.accounting_budgets
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage budget lines" ON public.accounting_budget_lines
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage bank accounts" ON public.accounting_bank_accounts
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage bank reconciliations" ON public.accounting_bank_reconciliations
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));
CREATE POLICY "Accounting admins manage bank statement lines" ON public.accounting_bank_statement_lines
FOR ALL TO authenticated USING(public.is_admin_or_super(auth.uid())) WITH CHECK(public.is_admin_or_super(auth.uid()));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.accounting_settings,
 public.accounting_fixed_assets,public.accounting_asset_depreciation,
 public.accounting_budgets,public.accounting_budget_lines,
 public.accounting_bank_accounts,public.accounting_bank_reconciliations,
 public.accounting_bank_statement_lines TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_sync_extended_approval_queue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE
  entity text; new_status text; old_status text; record_id uuid;
  submitter uuid; pending_id uuid; n jsonb:=to_jsonb(NEW);
  o jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'accounting_fixed_assets' THEN entity:='asset';
    WHEN 'accounting_budgets' THEN entity:='budget';
    WHEN 'accounting_bank_reconciliations' THEN entity:='bank_reconciliation';
    ELSE RETURN NEW;
  END CASE;
  new_status:=n->>'status'; old_status:=o->>'status';
  record_id:=(n->>'id')::uuid;
  submitter:=COALESCE(NULLIF(n->>'created_by','')::uuid,auth.uid());

  IF new_status='pending_approval' AND (TG_OP='INSERT' OR old_status IS DISTINCT FROM new_status) THEN
    INSERT INTO public.accounting_approvals(entity_type,entity_id,submitted_by)
    VALUES(entity,record_id,submitter)
    ON CONFLICT(entity_type,entity_id) WHERE status='pending_approval' DO NOTHING;
  ELSIF TG_OP='UPDATE' AND old_status='pending_approval' AND new_status IN ('approved','rejected') THEN
    SELECT id INTO pending_id FROM public.accounting_approvals
    WHERE entity_type=entity AND entity_id=record_id AND status='pending_approval'
    ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
    IF pending_id IS NULL THEN RAISE EXCEPTION 'No pending approval request exists for this record'; END IF;
    IF auth.uid() IS NULL OR auth.uid()=(SELECT submitted_by FROM public.accounting_approvals WHERE id=pending_id) THEN
      RAISE EXCEPTION 'A different authorised user must review this submission';
    END IF;
    UPDATE public.accounting_approvals
      SET status=new_status,decided_by=auth.uid(),decided_at=now(),
          decision_note=n->>'rejection_reason'
    WHERE id=pending_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_approval_asset_sync
AFTER INSERT OR UPDATE OF status ON public.accounting_fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_extended_approval_queue();
CREATE TRIGGER accounting_approval_budget_sync
AFTER INSERT OR UPDATE OF status ON public.accounting_budgets
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_extended_approval_queue();
CREATE TRIGGER accounting_approval_bank_reconciliation_sync
AFTER INSERT OR UPDATE OF status ON public.accounting_bank_reconciliations
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_extended_approval_queue();

CREATE OR REPLACE FUNCTION public.accounting_decide_approval(
  p_approval_id uuid,p_decision text,p_note text DEFAULT NULL
)
RETURNS public.accounting_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE a public.accounting_approvals%ROWTYPE; changed integer; note_text text:=NULLIF(BTRIM(p_note),'');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may review approvals';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid approval decision'; END IF;
  IF p_decision='rejected' AND note_text IS NULL THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  SELECT * INTO a FROM public.accounting_approvals WHERE id=p_approval_id AND status='pending_approval' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending approval not found or already processed'; END IF;
  IF a.submitted_by=auth.uid() THEN RAISE EXCEPTION 'You cannot approve or reject a record you submitted'; END IF;

  CASE a.entity_type
    WHEN 'income' THEN
      UPDATE public.income_records SET status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND status='pending_approval';
    WHEN 'expense' THEN
      UPDATE public.expenses SET approval_status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND approval_status='pending_approval';
    WHEN 'invoice' THEN
      UPDATE public.invoices SET payment_status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejected_by=CASE WHEN p_decision='rejected' THEN auth.uid() END,
        rejected_at=CASE WHEN p_decision='rejected' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND payment_status='pending_approval';
    WHEN 'journal' THEN
      UPDATE public.journal_entries SET approval_status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND approval_status='pending_approval';
    WHEN 'petty_cash' THEN
      UPDATE public.petty_cash_transactions SET status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND status='pending_approval';
    WHEN 'payroll' THEN
      UPDATE public.payroll_runs SET status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND status='pending_approval';
    WHEN 'asset' THEN
      UPDATE public.accounting_fixed_assets SET status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND status='pending_approval';
    WHEN 'budget' THEN
      UPDATE public.accounting_budgets SET status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND status='pending_approval';
    WHEN 'bank_reconciliation' THEN
      UPDATE public.accounting_bank_reconciliations SET status=p_decision,
        approved_by=CASE WHEN p_decision='approved' THEN auth.uid() END,
        approved_at=CASE WHEN p_decision='approved' THEN now() END,
        rejection_reason=CASE WHEN p_decision='rejected' THEN note_text END
      WHERE id=a.entity_id AND status='pending_approval';
    ELSE RAISE EXCEPTION 'Unsupported approval type';
  END CASE;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Source record is no longer awaiting approval'; END IF;

  IF a.entity_type='expense' THEN
    IF p_decision='approved' THEN
      UPDATE public.petty_cash_transactions SET status='approved',approved_by=auth.uid(),approved_at=now()
      WHERE expense_id=a.entity_id AND status='pending_approval';
      UPDATE public.expenses SET paid_by=auth.uid(),paid_at=now()
      WHERE id=a.entity_id AND payment_method='petty_cash';
    ELSE
      UPDATE public.petty_cash_transactions SET status='rejected',rejection_reason=note_text
      WHERE expense_id=a.entity_id AND status='pending_approval';
    END IF;
  END IF;
  SELECT * INTO a FROM public.accounting_approvals WHERE id=p_approval_id;
  RETURN a;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_decide_approval(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_decide_approval(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_next_entry_number()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may allocate journal numbers';
  END IF;
  RETURN nextval('public.accounting_entry_number_seq');
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_next_entry_number() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_next_entry_number() TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_close_period(p_period_id uuid)
RETURNS public.accounting_periods
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE r public.accounting_periods%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may close periods';
  END IF;
  UPDATE public.accounting_periods p SET status='closed'
  WHERE p.id=p_period_id AND p.status='open'
    AND NOT EXISTS(SELECT 1 FROM public.journal_entries je WHERE je.period_id=p.id AND je.status='draft')
    AND NOT EXISTS(SELECT 1 FROM public.accounting_approvals a
      WHERE a.status='pending_approval'
      AND a.entity_type='journal'
      AND a.entity_id IN (SELECT id FROM public.journal_entries WHERE period_id=p.id))
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period cannot be closed: it may already be closed or still contain draft/pending journals'; END IF;
  RETURN r;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_close_period(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_close_period(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_close_financial_year(p_year_id uuid)
RETURNS public.accounting_financial_years
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE r public.accounting_financial_years%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may close financial years';
  END IF;
  IF EXISTS(SELECT 1 FROM public.accounting_periods WHERE financial_year_id=p_year_id AND status<>'closed') THEN
    RAISE EXCEPTION 'All monthly periods must be closed before closing the financial year';
  END IF;
  IF EXISTS(SELECT 1 FROM public.accounting_approvals a
    JOIN public.journal_entries je ON a.entity_type='journal' AND a.entity_id=je.id
    JOIN public.accounting_periods p ON p.id=je.period_id
    WHERE p.financial_year_id=p_year_id AND a.status='pending_approval') THEN
    RAISE EXCEPTION 'Pending journal approvals remain in this financial year';
  END IF;
  UPDATE public.accounting_financial_years SET status='closed',closed_at=now(),closed_by=auth.uid()
  WHERE id=p_year_id AND status='open' RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Financial year not found or already closed'; END IF;
  RETURN r;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_close_financial_year(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_close_financial_year(uuid) TO authenticated;
