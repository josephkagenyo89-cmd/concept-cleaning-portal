
-- Accounting & Finance: calendar, central approval history and maker-checker enforcement.
-- Historical records are preserved; no historical transactions are posted or reclassified.

CREATE TABLE IF NOT EXISTS public.accounting_financial_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CHECK (starts_on <= ends_on)
);

ALTER TABLE public.accounting_periods
  ADD COLUMN IF NOT EXISTS financial_year_id uuid
  REFERENCES public.accounting_financial_years(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS accounting_periods_year_dates_uidx
  ON public.accounting_periods(financial_year_id, starts_on, ends_on)
  WHERE financial_year_id IS NOT NULL;

INSERT INTO public.accounting_financial_years(name,starts_on,ends_on)
VALUES ('FY 2025',DATE '2025-01-01',DATE '2025-12-31'),
       ('FY 2026',DATE '2026-01-01',DATE '2026-12-31')
ON CONFLICT(name) DO NOTHING;

INSERT INTO public.accounting_periods(name,starts_on,ends_on,status,financial_year_id)
SELECT to_char(m,'FMMonth YYYY'),m::date,(m+interval '1 month - 1 day')::date,'open',fy.id
FROM public.accounting_financial_years fy
CROSS JOIN LATERAL generate_series(fy.starts_on,fy.ends_on,interval '1 month') m
WHERE fy.name IN ('FY 2025','FY 2026')
AND NOT EXISTS (
  SELECT 1 FROM public.accounting_periods p
  WHERE p.starts_on=m::date AND p.ends_on=(m+interval '1 month - 1 day')::date
);

CREATE TABLE IF NOT EXISTS public.accounting_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK(entity_type IN ('income','expense','invoice','journal','petty_cash','payroll')),
  entity_id uuid NOT NULL,
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK(status IN ('pending_approval','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_approvals_one_pending_uidx
  ON public.accounting_approvals(entity_type,entity_id) WHERE status='pending_approval';
CREATE INDEX IF NOT EXISTS accounting_approvals_status_submitted_idx
  ON public.accounting_approvals(status,submitted_at DESC);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.expenses ALTER COLUMN approval_status SET DEFAULT 'pending_approval';
ALTER TABLE public.income_records ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_approval_status_check
  CHECK(approval_status IN ('not_submitted','pending_approval','approved','rejected'));
ALTER TABLE public.petty_cash_transactions ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz;

ALTER TABLE public.accounting_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounting admins read approvals" ON public.accounting_approvals
  FOR SELECT TO authenticated USING(public.is_admin_or_super(auth.uid()));
REVOKE ALL ON public.accounting_approvals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.accounting_approvals TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_sync_approval_queue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE
  v_entity text;
  v_id uuid;
  v_status text;
  v_old_status text;
  v_submitter uuid;
  v_pending_id uuid;
  n jsonb := to_jsonb(NEW);
  o jsonb := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'income_records' THEN v_entity:='income'; v_status:=n->>'status'; v_old_status:=o->>'status';
    WHEN 'expenses' THEN v_entity:='expense'; v_status:=n->>'approval_status'; v_old_status:=o->>'approval_status';
    WHEN 'invoices' THEN v_entity:='invoice'; v_status:=n->>'payment_status'; v_old_status:=o->>'payment_status';
    WHEN 'journal_entries' THEN v_entity:='journal'; v_status:=n->>'approval_status'; v_old_status:=o->>'approval_status';
    WHEN 'petty_cash_transactions' THEN
      IF NULLIF(n->>'expense_id','') IS NOT NULL THEN RETURN NEW; END IF;
      v_entity:='petty_cash'; v_status:=n->>'status'; v_old_status:=o->>'status';
    WHEN 'payroll_runs' THEN v_entity:='payroll'; v_status:=n->>'status'; v_old_status:=o->>'status';
    ELSE RETURN NEW;
  END CASE;
  v_id := (n->>'id')::uuid;
  v_submitter := COALESCE(NULLIF(n->>'created_by','')::uuid,auth.uid());

  IF v_status='pending_approval' AND (TG_OP='INSERT' OR v_old_status IS DISTINCT FROM v_status) THEN
    INSERT INTO public.accounting_approvals(entity_type,entity_id,submitted_by)
    VALUES(v_entity,v_id,v_submitter)
    ON CONFLICT(entity_type,entity_id) WHERE status='pending_approval' DO NOTHING;
  ELSIF TG_OP='UPDATE' AND v_old_status='pending_approval' AND v_status IN ('approved','rejected') THEN
    SELECT id INTO v_pending_id FROM public.accounting_approvals
    WHERE entity_type=v_entity AND entity_id=v_id AND status='pending_approval'
    ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
    IF v_pending_id IS NULL THEN RAISE EXCEPTION 'No pending approval request exists for this record'; END IF;
    IF auth.uid() IS NULL OR auth.uid()=(SELECT submitted_by FROM public.accounting_approvals WHERE id=v_pending_id) THEN
      RAISE EXCEPTION 'A different authorised user must review this submission';
    END IF;
    UPDATE public.accounting_approvals
      SET status=v_status,decided_by=auth.uid(),decided_at=now(),
          decision_note=COALESCE(n->>'rejection_reason',n->>'notes')
    WHERE id=v_pending_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_approval_income_sync AFTER INSERT OR UPDATE OF status ON public.income_records
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_approval_queue();
CREATE TRIGGER accounting_approval_expense_sync AFTER INSERT OR UPDATE OF approval_status ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_approval_queue();
CREATE TRIGGER accounting_approval_invoice_sync AFTER INSERT OR UPDATE OF payment_status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_approval_queue();
CREATE TRIGGER accounting_approval_journal_sync AFTER INSERT OR UPDATE OF approval_status ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_approval_queue();
CREATE TRIGGER accounting_approval_petty_cash_sync AFTER INSERT OR UPDATE OF status ON public.petty_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_approval_queue();
CREATE TRIGGER accounting_approval_payroll_sync AFTER INSERT OR UPDATE OF status ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_approval_queue();

INSERT INTO public.accounting_approvals(entity_type,entity_id,submitted_by)
SELECT 'income',id,created_by FROM public.income_records WHERE status='pending_approval'
UNION ALL SELECT 'expense',id,created_by FROM public.expenses WHERE approval_status='pending_approval'
UNION ALL SELECT 'invoice',id,created_by FROM public.invoices WHERE payment_status='pending_approval'
UNION ALL SELECT 'journal',id,created_by FROM public.journal_entries WHERE approval_status='pending_approval'
UNION ALL SELECT 'petty_cash',id,created_by FROM public.petty_cash_transactions
  WHERE status='pending_approval' AND expense_id IS NULL
UNION ALL SELECT 'payroll',id,created_by FROM public.payroll_runs WHERE status='pending_approval'
ON CONFLICT(entity_type,entity_id) WHERE status='pending_approval' DO NOTHING;

CREATE OR REPLACE FUNCTION public.accounting_decide_approval(
  p_approval_id uuid,p_decision text,p_note text DEFAULT NULL
)
RETURNS public.accounting_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE
  a public.accounting_approvals%ROWTYPE;
  changed integer;
  note_text text:=NULLIF(BTRIM(p_note),'');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may review approvals';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid approval decision'; END IF;
  IF p_decision='rejected' AND note_text IS NULL THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  SELECT * INTO a FROM public.accounting_approvals
    WHERE id=p_approval_id AND status='pending_approval' FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.accounting_guard_journal_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  target_period public.accounting_periods%ROWTYPE;
  debit_total numeric(18,2);
  credit_total numeric(18,2);
  should_post boolean:=false;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status<>'draft' THEN RAISE EXCEPTION 'Only draft journal entries may be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' AND NEW.status<>'draft' THEN RAISE EXCEPTION 'Journal entries must be created as drafts'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status<>'draft' THEN RAISE EXCEPTION 'Posted or void journal entries are immutable; use a reversing journal or correction entry'; END IF;
    should_post:=NEW.status='posted';
  ELSIF TG_OP='INSERT' THEN should_post:=NEW.status='posted';
  END IF;
  IF should_post THEN
    IF NEW.approval_status<>'approved' OR NEW.approved_by IS NULL OR NEW.created_by IS NULL OR NEW.approved_by=NEW.created_by THEN
      RAISE EXCEPTION 'Journal must be approved by a different authorised user before posting';
    END IF;
    SELECT * INTO target_period FROM public.accounting_periods WHERE id=NEW.period_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Accounting period does not exist'; END IF;
    IF target_period.status<>'open' THEN RAISE EXCEPTION 'Cannot post to a closed accounting period'; END IF;
    IF NEW.entry_date<target_period.starts_on OR NEW.entry_date>target_period.ends_on THEN
      RAISE EXCEPTION 'Journal date must fall inside its accounting period';
    END IF;
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0)
      INTO debit_total,credit_total FROM public.journal_lines WHERE journal_entry_id=NEW.id;
    IF debit_total<=0 OR debit_total<>credit_total THEN
      RAISE EXCEPTION 'Journal must have equal, non-zero total debits and credits (debits %, credits %)',debit_total,credit_total;
    END IF;
    IF EXISTS(SELECT 1 FROM public.journal_lines jl JOIN public.accounting_accounts aa ON aa.id=jl.account_id
      WHERE jl.journal_entry_id=NEW.id AND aa.is_active=false) THEN
      RAISE EXCEPTION 'Journal contains an inactive account';
    END IF;
    NEW.posted_at:=now(); NEW.posted_by:=auth.uid();
  END IF;
  IF NEW.status='void' THEN
    IF TG_OP='UPDATE' AND OLD.status<>'draft' THEN RAISE EXCEPTION 'Only draft journal entries may be voided'; END IF;
    NEW.voided_at:=now(); NEW.voided_by:=auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_post_journal(p_journal_id uuid)
RETURNS public.journal_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result_row public.journal_entries%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may post journals';
  END IF;
  UPDATE public.journal_entries SET status='posted'
  WHERE id=p_journal_id AND status='draft' AND approval_status='approved'
    AND approved_by IS NOT NULL AND created_by IS NOT NULL AND approved_by<>created_by
  RETURNING * INTO result_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved draft journal not found or already processed'; END IF;
  RETURN result_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_record_petty_cash_expense(
  p_fund_id uuid,p_date date,p_amount numeric,p_category text,p_description text,
  p_receipt_reference text DEFAULT NULL,p_receipt_url text DEFAULT NULL,p_supplier_name text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_expense_id uuid; available_balance numeric(14,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may record petty-cash expenses';
  END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Expense amount must be greater than zero'; END IF;
  PERFORM 1 FROM public.petty_cash_funds WHERE id=p_fund_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active petty-cash fund not found'; END IF;
  SELECT current_balance INTO available_balance FROM public.petty_cash_fund_balances WHERE fund_id=p_fund_id;
  IF available_balance<p_amount THEN RAISE EXCEPTION 'Insufficient petty-cash balance. Available: %, requested: %',available_balance,p_amount; END IF;
  INSERT INTO public.expenses(date,amount,category,description,created_by,supplier_name,receipt_reference,receipt_url,
    payment_method,approval_status,approved_by,approved_at,paid_by,paid_at)
  VALUES(COALESCE(p_date,CURRENT_DATE),p_amount,COALESCE(NULLIF(p_category,''),'other'),NULLIF(p_description,''),
    auth.uid(),NULLIF(p_supplier_name,''),NULLIF(p_receipt_reference,''),NULLIF(p_receipt_url,''),
    'petty_cash','pending_approval',NULL,NULL,NULL,NULL)
  RETURNING id INTO new_expense_id;
  INSERT INTO public.petty_cash_transactions(fund_id,transaction_date,transaction_type,amount,description,expense_id,
    receipt_reference,receipt_url,status,created_by,approved_by,approved_at)
  VALUES(p_fund_id,COALESCE(p_date,CURRENT_DATE),'expense',p_amount,COALESCE(NULLIF(p_description,''),'Petty cash expense'),
    new_expense_id,NULLIF(p_receipt_reference,''),NULLIF(p_receipt_url,''),'pending_approval',auth.uid(),NULL,NULL);
  RETURN new_expense_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_record_petty_cash_movement(
  p_fund_id uuid,p_date date,p_type text,p_amount numeric,p_description text,p_reference text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_transaction_id uuid; available_balance numeric(14,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may record petty-cash movements';
  END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF p_type NOT IN ('replenishment','cash_return','adjustment_in','adjustment_out') THEN
    RAISE EXCEPTION 'Unsupported petty-cash movement type';
  END IF;
  PERFORM 1 FROM public.petty_cash_funds WHERE id=p_fund_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active petty-cash fund not found'; END IF;
  IF p_type='adjustment_out' THEN
    SELECT current_balance INTO available_balance FROM public.petty_cash_fund_balances WHERE fund_id=p_fund_id;
    IF available_balance<p_amount THEN RAISE EXCEPTION 'Adjustment exceeds available petty-cash balance'; END IF;
  END IF;
  INSERT INTO public.petty_cash_transactions(fund_id,transaction_date,transaction_type,amount,description,reference,
    status,created_by,approved_by,approved_at)
  VALUES(p_fund_id,COALESCE(p_date,CURRENT_DATE),p_type,p_amount,COALESCE(NULLIF(p_description,''),p_type),
    NULLIF(p_reference,''),'pending_approval',auth.uid(),NULL,NULL)
  RETURNING id INTO new_transaction_id;
  RETURN new_transaction_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accounting_record_petty_cash_expense(uuid,date,numeric,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_record_petty_cash_movement(uuid,date,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_record_petty_cash_expense(uuid,date,numeric,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_record_petty_cash_movement(uuid,date,text,numeric,text,text) TO authenticated;
