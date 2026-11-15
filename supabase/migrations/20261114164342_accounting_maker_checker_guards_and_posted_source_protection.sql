
-- Enforce maker-checker at the database boundary and protect posted source transactions.

ALTER TABLE public.income_records ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.invoices ALTER COLUMN payment_status SET DEFAULT 'pending_approval';
ALTER TABLE public.invoice_payments
  ADD CONSTRAINT invoice_payments_approval_status_check
  CHECK(approval_status IN ('pending_approval','approved','rejected'));

CREATE OR REPLACE FUNCTION public.accounting_enforce_maker_checker()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
DECLARE
  new_data jsonb:=to_jsonb(NEW);
  old_data jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  state_field text;
  new_state text;
  old_state text;
  created_by_id uuid;
  approved_by_id uuid;
  reason text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'invoices' THEN state_field:='payment_status';
    WHEN 'income_records' THEN state_field:='status';
    WHEN 'expenses' THEN state_field:='approval_status';
    WHEN 'journal_entries' THEN state_field:='approval_status';
    WHEN 'petty_cash_transactions' THEN state_field:='status';
    WHEN 'payroll_runs' THEN state_field:='status';
    WHEN 'accounting_fixed_assets','accounting_budgets','accounting_bank_reconciliations' THEN state_field:='status';
    ELSE RETURN NEW;
  END CASE;

  new_state:=new_data->>state_field;
  old_state:=old_data->>state_field;
  created_by_id:=NULLIF(new_data->>'created_by','')::uuid;
  approved_by_id:=NULLIF(new_data->>'approved_by','')::uuid;
  reason:=NULLIF(BTRIM(new_data->>'rejection_reason'),'');

  IF new_state='approved' AND (TG_OP='INSERT' OR old_state IS DISTINCT FROM new_state) THEN
    IF TG_TABLE_NAME='journal_entries' AND TG_OP='INSERT'
       AND pg_trigger_depth()>0
       AND COALESCE(new_data->>'source_type','') NOT IN ('','manual')
       AND created_by_id IS NOT NULL AND approved_by_id IS NOT NULL
       AND created_by_id<>approved_by_id THEN
      RETURN NEW;
    END IF;
    IF TG_OP<>'UPDATE' OR old_state<>'pending_approval' THEN
      RAISE EXCEPTION 'This record must be submitted for independent approval before it can be approved';
    END IF;
    IF created_by_id IS NULL OR approved_by_id IS NULL OR created_by_id=approved_by_id THEN
      RAISE EXCEPTION 'The approver must be a different authorised user from the submitter';
    END IF;
  ELSIF new_state='rejected' AND (TG_OP='INSERT' OR old_state IS DISTINCT FROM new_state) THEN
    IF TG_OP<>'UPDATE' OR old_state<>'pending_approval' OR reason IS NULL THEN
      RAISE EXCEPTION 'A pending submission and a rejection reason are required';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_enforce_invoice_maker_checker
BEFORE INSERT OR UPDATE OF payment_status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_income_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.income_records
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_expense_maker_checker
BEFORE INSERT OR UPDATE OF approval_status ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_journal_maker_checker
BEFORE INSERT OR UPDATE OF approval_status ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_petty_cash_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.petty_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_payroll_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_asset_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.accounting_fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_budget_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.accounting_budgets
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();
CREATE TRIGGER accounting_enforce_bank_reconciliation_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.accounting_bank_reconciliations
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();

CREATE OR REPLACE FUNCTION public.accounting_guard_invoice_payment_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
BEGIN
  IF NEW.approval_status='approved' AND (TG_OP='INSERT' OR OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
    IF TG_OP<>'UPDATE' OR OLD.approval_status<>'pending_approval'
       OR pg_trigger_depth()<2 OR NEW.approved_by IS NULL
       OR NEW.recorded_by IS NULL OR NEW.approved_by=NEW.recorded_by THEN
      RAISE EXCEPTION 'Invoice payments are approved only through independent income approval';
    END IF;
  ELSIF NEW.approval_status='rejected' AND (TG_OP='INSERT' OR OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
    RAISE EXCEPTION 'Invoice payments are reviewed through the parent invoice income approval';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_invoice_payment_approval_guard
BEFORE INSERT OR UPDATE OF approval_status ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_invoice_payment_approval();

CREATE OR REPLACE FUNCTION public.accounting_guard_posted_source_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
DECLARE
  source_id_text text;
  has_posted boolean:=false;
  old_json jsonb;
  new_json jsonb;
  protected_keys text[];
  k text;
BEGIN
  source_id_text:=OLD.id::text;
  old_json:=to_jsonb(OLD);
  IF TG_OP='DELETE' THEN
    IF TG_TABLE_NAME='invoices' THEN
      SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='invoice' AND source_id=source_id_text) INTO has_posted;
    ELSIF TG_TABLE_NAME='income_records' THEN
      SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='income' AND source_id=source_id_text) INTO has_posted;
    ELSIF TG_TABLE_NAME='expenses' THEN
      SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type IN ('expense','expense_payment') AND source_id=source_id_text) INTO has_posted;
    ELSIF TG_TABLE_NAME='invoice_payments' THEN
      SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='invoice_payment' AND source_id=source_id_text) INTO has_posted;
    ELSIF TG_TABLE_NAME='payroll_runs' THEN
      SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type IN ('payroll_accrual','payroll_payment') AND source_id=source_id_text) INTO has_posted;
    END IF;
    IF has_posted THEN RAISE EXCEPTION 'A source transaction with posted ledger entries cannot be deleted; use a controlled reversal'; END IF;
    RETURN OLD;
  END IF;

  new_json:=to_jsonb(NEW);
  IF TG_TABLE_NAME='invoices' THEN
    protected_keys:=ARRAY['invoice_number','client_name','client_phone','client_id','service','amount','date','line_items','discount_amount','created_by'];
    SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='invoice' AND source_id=source_id_text) INTO has_posted;
  ELSIF TG_TABLE_NAME='income_records' THEN
    protected_keys:=ARRAY['date','amount','description','service','payment_method','source','invoice_id','client_id','created_by','mpesa_code','payment_reference'];
    SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='income' AND source_id=source_id_text) INTO has_posted;
    IF OLD.invoice_id IS NOT NULL THEN has_posted:=false; END IF;
  ELSIF TG_TABLE_NAME='expenses' THEN
    protected_keys:=ARRAY['date','amount','category','description','created_by'];
    SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='expense' AND source_id=source_id_text) INTO has_posted;
    IF OLD.paid_at IS NOT NULL THEN protected_keys:=protected_keys||ARRAY['payment_method','payment_reference','paid_at']; END IF;
  ELSIF TG_TABLE_NAME='invoice_payments' THEN
    protected_keys:=ARRAY['invoice_id','amount','payment_date','payment_method','payment_reference','recorded_by'];
    SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='invoice_payment' AND source_id=source_id_text) INTO has_posted;
  ELSIF TG_TABLE_NAME='payroll_runs' THEN
    protected_keys:=ARRAY['payroll_code','period_month','period_year','start_date','end_date','pay_date','total_gross','total_deductions','total_net','total_employer_cost','employee_count'];
    SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type IN ('payroll_accrual','payroll_payment') AND source_id=source_id_text) INTO has_posted;
  ELSE
    RETURN NEW;
  END IF;

  IF has_posted THEN
    FOREACH k IN ARRAY protected_keys LOOP
      IF old_json->k IS DISTINCT FROM new_json->k THEN
        RAISE EXCEPTION 'Posted source transaction fields are immutable (%). Use an adjustment or reversing journal.',k;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_guard_invoice_source
BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_posted_source_change();
CREATE TRIGGER accounting_guard_income_source
BEFORE UPDATE OR DELETE ON public.income_records
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_posted_source_change();
CREATE TRIGGER accounting_guard_expense_source
BEFORE UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_posted_source_change();
CREATE TRIGGER accounting_guard_invoice_payment_source
BEFORE UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_posted_source_change();
CREATE TRIGGER accounting_guard_payroll_source
BEFORE UPDATE OR DELETE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_posted_source_change();

-- Petty-cash opening balances are held at zero until a second user approves the opening transaction.
CREATE OR REPLACE FUNCTION public.accounting_log_petty_cash_opening_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
BEGIN
  IF NEW.opening_balance>0 THEN
    UPDATE public.petty_cash_funds SET opening_balance=0 WHERE id=NEW.id;
    INSERT INTO public.petty_cash_transactions(
      fund_id,transaction_date,transaction_type,amount,description,status,created_by,approved_by,approved_at
    ) VALUES (
      NEW.id,CURRENT_DATE,'opening_balance',NEW.opening_balance,'Opening petty-cash balance',
      'pending_approval',auth.uid(),NULL,NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_apply_petty_cash_opening_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='pending_approval' AND NEW.status='approved'
     AND NEW.transaction_type='opening_balance' THEN
    UPDATE public.petty_cash_funds SET opening_balance=NEW.amount WHERE id=NEW.fund_id;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_apply_petty_cash_opening_balance
AFTER UPDATE OF status ON public.petty_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.accounting_apply_petty_cash_opening_balance();

CREATE OR REPLACE FUNCTION public.accounting_record_petty_cash_expense(
  p_fund_id uuid,p_date date,p_amount numeric,p_category text,p_description text,
  p_receipt_reference text DEFAULT NULL,p_receipt_url text DEFAULT NULL,p_supplier_name text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE new_expense_id uuid; available_balance numeric(14,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may record petty-cash expenses';
  END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Expense amount must be greater than zero'; END IF;
  PERFORM 1 FROM public.petty_cash_funds WHERE id=p_fund_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active petty-cash fund not found'; END IF;
  SELECT b.current_balance-COALESCE(sum(t.amount) FILTER (WHERE t.status='pending_approval' AND t.transaction_type IN ('expense','adjustment_out')),0)
  INTO available_balance
  FROM public.petty_cash_fund_balances b
  LEFT JOIN public.petty_cash_transactions t ON t.fund_id=b.fund_id
  WHERE b.fund_id=p_fund_id GROUP BY b.current_balance;
  IF available_balance<p_amount THEN
    RAISE EXCEPTION 'Insufficient unreserved petty-cash balance. Available: %, requested: %',available_balance,p_amount;
  END IF;
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
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
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
    SELECT b.current_balance-COALESCE(sum(t.amount) FILTER (WHERE t.status='pending_approval' AND t.transaction_type IN ('expense','adjustment_out')),0)
    INTO available_balance
    FROM public.petty_cash_fund_balances b
    LEFT JOIN public.petty_cash_transactions t ON t.fund_id=b.fund_id
    WHERE b.fund_id=p_fund_id GROUP BY b.current_balance;
    IF available_balance<p_amount THEN RAISE EXCEPTION 'Adjustment exceeds unreserved petty-cash balance'; END IF;
  END IF;
  INSERT INTO public.petty_cash_transactions(fund_id,transaction_date,transaction_type,amount,description,reference,status,created_by,approved_by,approved_at)
  VALUES(p_fund_id,COALESCE(p_date,CURRENT_DATE),p_type,p_amount,COALESCE(NULLIF(p_description,''),p_type),
    NULLIF(p_reference,''),'pending_approval',auth.uid(),NULL,NULL)
  RETURNING id INTO new_transaction_id;
  RETURN new_transaction_id;
END;
$function$;
