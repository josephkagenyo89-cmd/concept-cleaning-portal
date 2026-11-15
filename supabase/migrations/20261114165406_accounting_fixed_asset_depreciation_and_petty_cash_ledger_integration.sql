
-- Asset depreciation and petty-cash source-account integrations.

ALTER TABLE public.accounting_approvals
  DROP CONSTRAINT IF EXISTS accounting_approvals_entity_type_check;
ALTER TABLE public.accounting_approvals
  ADD CONSTRAINT accounting_approvals_entity_type_check
  CHECK(entity_type IN ('income','expense','invoice','journal','petty_cash','payroll','budget','bank_reconciliation','asset','depreciation'));

ALTER TABLE public.accounting_asset_depreciation
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.accounting_asset_depreciation
  DROP CONSTRAINT IF EXISTS accounting_asset_depreciation_status_check;
ALTER TABLE public.accounting_asset_depreciation
  ADD CONSTRAINT accounting_asset_depreciation_status_check
  CHECK(status IN ('draft','pending_approval','approved','rejected','posted','reversed'));

ALTER TABLE public.petty_cash_funds
  ADD COLUMN IF NOT EXISTS accounting_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS opening_balance_source_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT;
UPDATE public.petty_cash_funds
SET accounting_account_id=(SELECT id FROM public.accounting_accounts WHERE code='1000')
WHERE accounting_account_id IS NULL;
ALTER TABLE public.petty_cash_funds
  ALTER COLUMN accounting_account_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.accounting_default_petty_cash_account()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
BEGIN
  IF NEW.accounting_account_id IS NULL THEN
    SELECT id INTO NEW.accounting_account_id FROM public.accounting_accounts WHERE code='1000' AND is_active=true;
  END IF;
  IF NEW.accounting_account_id IS NULL THEN RAISE EXCEPTION 'Cash on Hand ledger account 1000 is required'; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_default_petty_cash_account
BEFORE INSERT OR UPDATE OF accounting_account_id ON public.petty_cash_funds
FOR EACH ROW EXECUTE FUNCTION public.accounting_default_petty_cash_account();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS petty_cash_fund_id uuid REFERENCES public.petty_cash_funds(id) ON DELETE RESTRICT;
ALTER TABLE public.petty_cash_transactions
  ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT;

-- Petty-cash expense requests reserve the selected fund and become paid only after independent approval.
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
    payment_method,approval_status,approved_by,approved_at,paid_by,paid_at,petty_cash_fund_id)
  VALUES(COALESCE(p_date,CURRENT_DATE),p_amount,COALESCE(NULLIF(p_category,''),'other'),NULLIF(p_description,''),
    auth.uid(),NULLIF(p_supplier_name,''),NULLIF(p_receipt_reference,''),NULLIF(p_receipt_url,''),
    'petty_cash','pending_approval',NULL,NULL,NULL,NULL,p_fund_id)
  RETURNING id INTO new_expense_id;
  INSERT INTO public.petty_cash_transactions(fund_id,transaction_date,transaction_type,amount,description,expense_id,
    receipt_reference,receipt_url,status,created_by,approved_by,approved_at)
  VALUES(p_fund_id,COALESCE(p_date,CURRENT_DATE),'expense',p_amount,COALESCE(NULLIF(p_description,''),'Petty cash expense'),
    new_expense_id,NULLIF(p_receipt_reference,''),NULLIF(p_receipt_url,''),'pending_approval',auth.uid(),NULL,NULL);
  RETURN new_expense_id;
END;
$function$;

-- Movement source account is explicitly selected to prevent guessed cash/bank/equity postings.
DROP FUNCTION IF EXISTS public.accounting_record_petty_cash_movement(uuid,date,text,numeric,text,text);
CREATE FUNCTION public.accounting_record_petty_cash_movement(
  p_fund_id uuid,p_date date,p_type text,p_amount numeric,p_description text,
  p_reference text DEFAULT NULL,p_source_account_id uuid DEFAULT NULL
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
  IF p_source_account_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.accounting_accounts WHERE id=p_source_account_id AND is_active=true
  ) THEN RAISE EXCEPTION 'Select an active source ledger account for this movement'; END IF;
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
  INSERT INTO public.petty_cash_transactions(fund_id,transaction_date,transaction_type,amount,description,reference,
    source_account_id,status,created_by,approved_by,approved_at)
  VALUES(p_fund_id,COALESCE(p_date,CURRENT_DATE),p_type,p_amount,COALESCE(NULLIF(p_description,''),p_type),
    NULLIF(p_reference,''),p_source_account_id,'pending_approval',auth.uid(),NULL,NULL)
  RETURNING id INTO new_transaction_id;
  RETURN new_transaction_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_record_petty_cash_movement(uuid,date,text,numeric,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_record_petty_cash_movement(uuid,date,text,numeric,text,text,uuid) TO authenticated;

-- Opening balance source account must be explicitly selected when a new fund is opened with a balance.
CREATE OR REPLACE FUNCTION public.accounting_log_petty_cash_opening_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
BEGIN
  IF NEW.opening_balance>0 THEN
    IF NEW.opening_balance_source_account_id IS NULL THEN
      RAISE EXCEPTION 'Select the source ledger account for the petty-cash opening balance';
    END IF;
    UPDATE public.petty_cash_funds SET opening_balance=0 WHERE id=NEW.id;
    INSERT INTO public.petty_cash_transactions(
      fund_id,transaction_date,transaction_type,amount,description,source_account_id,status,created_by,approved_by,approved_at
    ) VALUES (
      NEW.id,CURRENT_DATE,'opening_balance',NEW.opening_balance,'Opening petty-cash balance',
      NEW.opening_balance_source_account_id,'pending_approval',auth.uid(),NULL,NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_post_expense_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE asset_code text;
BEGIN
  IF NEW.paid_at IS NULL OR NEW.approval_status<>'approved'
     OR (TG_OP='UPDATE' AND OLD.paid_at IS NOT NULL) THEN RETURN NEW; END IF;
  IF NEW.payment_method='petty_cash' AND NEW.petty_cash_fund_id IS NOT NULL THEN
    SELECT aa.code INTO asset_code
    FROM public.petty_cash_funds f JOIN public.accounting_accounts aa ON aa.id=f.accounting_account_id
    WHERE f.id=NEW.petty_cash_fund_id;
  ELSE
    asset_code:=CASE
      WHEN NEW.payment_method='mpesa' THEN '1010'
      WHEN NEW.payment_method IN ('bank','bank_transfer') THEN '1020'
      ELSE '1000'
    END;
  END IF;
  IF asset_code IS NULL THEN RAISE EXCEPTION 'No cash ledger account is configured for this expense payment'; END IF;
  PERFORM public.accounting_create_posted_journal(
    NEW.paid_at::date,'Expense payment: '||COALESCE(NEW.description,NEW.category),
    'expense_payment',NEW.id,NEW.created_by,NEW.approved_by,COALESCE(NEW.payment_reference,NEW.receipt_reference),
    jsonb_build_array(
      jsonb_build_object('account_code','2000','debit',NEW.amount,'credit',0,'description','Settle accounts payable'),
      jsonb_build_object('account_code',asset_code,'debit',0,'credit',NEW.amount,'description','Expense paid')
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_petty_cash_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE fund_code text; source_code text; debit_code text; credit_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;
  IF NEW.expense_id IS NOT NULL OR NEW.transaction_type='opening_balance' THEN RETURN NEW; END IF;
  SELECT aa.code INTO fund_code FROM public.petty_cash_funds f
    JOIN public.accounting_accounts aa ON aa.id=f.accounting_account_id WHERE f.id=NEW.fund_id;
  SELECT code INTO source_code FROM public.accounting_accounts WHERE id=NEW.source_account_id AND is_active=true;
  IF fund_code IS NULL OR source_code IS NULL THEN RAISE EXCEPTION 'Petty-cash fund and source ledger accounts must be configured'; END IF;
  IF NEW.transaction_type='adjustment_out' THEN debit_code:=source_code; credit_code:=fund_code;
  ELSE debit_code:=fund_code; credit_code:=source_code; END IF;
  PERFORM public.accounting_create_posted_journal(
    NEW.transaction_date,'Petty cash movement: '||NEW.transaction_type,
    'petty_cash_movement',NEW.id,NEW.created_by,NEW.approved_by,NEW.reference,
    jsonb_build_array(
      jsonb_build_object('account_code',debit_code,'debit',NEW.amount,'credit',0,'description',NEW.description),
      jsonb_build_object('account_code',credit_code,'debit',0,'credit',NEW.amount,'description',NEW.description)
    )
  );
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_post_petty_cash_movement
AFTER UPDATE OF status ON public.petty_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_petty_cash_movement();

CREATE OR REPLACE FUNCTION public.accounting_apply_petty_cash_opening_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE fund_code text; source_code text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='pending_approval' AND NEW.status='approved'
     AND NEW.transaction_type='opening_balance' THEN
    SELECT aa.code INTO fund_code FROM public.petty_cash_funds f
      JOIN public.accounting_accounts aa ON aa.id=f.accounting_account_id WHERE f.id=NEW.fund_id;
    SELECT code INTO source_code FROM public.accounting_accounts WHERE id=NEW.source_account_id AND is_active=true;
    IF fund_code IS NULL OR source_code IS NULL THEN RAISE EXCEPTION 'Opening balance ledger accounts are not configured'; END IF;
    UPDATE public.petty_cash_funds SET opening_balance=NEW.amount WHERE id=NEW.fund_id;
    PERFORM public.accounting_create_posted_journal(
      NEW.transaction_date,'Petty cash opening balance',
      'petty_cash_opening_balance',NEW.id,NEW.created_by,NEW.approved_by,NEW.reference,
      jsonb_build_array(
        jsonb_build_object('account_code',fund_code,'debit',NEW.amount,'credit',0,'description','Petty cash opening balance'),
        jsonb_build_object('account_code',source_code,'debit',0,'credit',NEW.amount,'description','Opening balance source')
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fixed asset acquisitions create ledger entries only when not already recognised through an expense.
CREATE OR REPLACE FUNCTION public.accounting_post_approved_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE asset_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;
  IF NEW.source_expense_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.expenses WHERE id=NEW.source_expense_id AND approval_status='approved') THEN
      RAISE EXCEPTION 'The linked source expense must be approved before registering this asset';
    END IF;
    RETURN NEW;
  END IF;
  SELECT code INTO asset_code FROM public.accounting_accounts WHERE id=NEW.asset_account_id AND is_active=true;
  IF asset_code IS NULL THEN RAISE EXCEPTION 'Select an active fixed-asset ledger account'; END IF;
  PERFORM public.accounting_create_posted_journal(
    NEW.purchase_date,'Fixed asset acquisition: '||NEW.asset_code,
    'fixed_asset',NEW.id,NEW.created_by,NEW.approved_by,NEW.asset_code,
    jsonb_build_array(
      jsonb_build_object('account_code',asset_code,'debit',NEW.purchase_cost,'credit',0,'description',NEW.name),
      jsonb_build_object('account_code','2000','debit',0,'credit',NEW.purchase_cost,'description','Asset acquisition payable')
    )
  );
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_post_asset_approval
AFTER UPDATE OF status ON public.accounting_fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_asset();

-- Add depreciation to the same maker-checker queue.
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
    WHEN 'accounting_asset_depreciation' THEN entity:='depreciation';
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
    UPDATE public.accounting_approvals SET status=new_status,decided_by=auth.uid(),decided_at=now(),
      decision_note=n->>'rejection_reason' WHERE id=pending_id;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_approval_depreciation_sync
AFTER INSERT OR UPDATE OF status ON public.accounting_asset_depreciation
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_extended_approval_queue();

CREATE OR REPLACE FUNCTION public.accounting_enforce_maker_checker()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
DECLARE
  n jsonb:=to_jsonb(NEW);
  o jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  state_field text; new_state text; old_state text;
  created_by_id uuid; approved_by_id uuid; reason text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'invoices' THEN state_field:='payment_status';
    WHEN 'income_records' THEN state_field:='status';
    WHEN 'expenses' THEN state_field:='approval_status';
    WHEN 'journal_entries' THEN state_field:='approval_status';
    WHEN 'petty_cash_transactions' THEN state_field:='status';
    WHEN 'payroll_runs' THEN state_field:='status';
    WHEN 'accounting_fixed_assets','accounting_budgets','accounting_bank_reconciliations','accounting_asset_depreciation' THEN state_field:='status';
    ELSE RETURN NEW;
  END CASE;
  new_state:=n->>state_field; old_state:=o->>state_field;
  created_by_id:=NULLIF(n->>'created_by','')::uuid;
  approved_by_id:=NULLIF(n->>'approved_by','')::uuid;
  reason:=NULLIF(BTRIM(n->>'rejection_reason'),'');
  IF new_state='approved' AND (TG_OP='INSERT' OR old_state IS DISTINCT FROM new_state) THEN
    IF TG_TABLE_NAME='journal_entries' AND TG_OP='INSERT' AND pg_trigger_depth()>0
       AND COALESCE(n->>'source_type','') NOT IN ('','manual')
       AND created_by_id IS NOT NULL AND approved_by_id IS NOT NULL AND created_by_id<>approved_by_id THEN
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
CREATE TRIGGER accounting_enforce_depreciation_maker_checker
BEFORE INSERT OR UPDATE OF status ON public.accounting_asset_depreciation
FOR EACH ROW EXECUTE FUNCTION public.accounting_enforce_maker_checker();

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
    WHEN 'depreciation' THEN
      UPDATE public.accounting_asset_depreciation SET status=p_decision,
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

CREATE OR REPLACE FUNCTION public.accounting_generate_depreciation(p_asset_id uuid,p_period_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE a public.accounting_fixed_assets%ROWTYPE; p public.accounting_periods%ROWTYPE;
  remaining numeric(18,2); amount numeric(18,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may generate depreciation';
  END IF;
  SELECT * INTO a FROM public.accounting_fixed_assets WHERE id=p_asset_id AND status IN ('approved','active') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved fixed asset not found'; END IF;
  IF a.depreciation_method='none' OR a.useful_life_months IS NULL OR a.useful_life_months<=0 THEN
    RAISE EXCEPTION 'A valid depreciation method and useful life are required';
  END IF;
  IF a.depreciation_expense_account_id IS NULL OR a.accumulated_depreciation_account_id IS NULL THEN
    RAISE EXCEPTION 'Depreciation expense and accumulated depreciation accounts must be configured';
  END IF;
  SELECT * INTO p FROM public.accounting_periods WHERE id=p_period_id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an open accounting period'; END IF;
  IF p.ends_on<a.purchase_date THEN RAISE EXCEPTION 'Depreciation period is before the asset purchase date'; END IF;
  remaining:=a.purchase_cost-a.residual_value-a.accumulated_depreciation;
  IF remaining<=0 THEN RAISE EXCEPTION 'Asset is fully depreciated'; END IF;
  IF a.depreciation_method='straight_line' THEN
    amount:=round((a.purchase_cost-a.residual_value)/a.useful_life_months,2);
  ELSE
    amount:=round((a.purchase_cost-a.accumulated_depreciation)*(2.0/a.useful_life_months),2);
  END IF;
  amount:=LEAST(amount,remaining);
  IF amount<=0 THEN RAISE EXCEPTION 'No depreciation amount remains'; END IF;
  INSERT INTO public.accounting_asset_depreciation(
    asset_id,period_id,depreciation_date,amount,status,created_by
  ) VALUES(p_asset_id,p_period_id,p.ends_on,amount,'pending_approval',auth.uid())
  RETURNING id INTO p_asset_id;
  RETURN p_asset_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_generate_depreciation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_generate_depreciation(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_depreciation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE a public.accounting_fixed_assets%ROWTYPE; expense_code text; accumulated_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;
  SELECT * INTO a FROM public.accounting_fixed_assets WHERE id=NEW.asset_id FOR UPDATE;
  SELECT code INTO expense_code FROM public.accounting_accounts WHERE id=a.depreciation_expense_account_id AND is_active=true;
  SELECT code INTO accumulated_code FROM public.accounting_accounts WHERE id=a.accumulated_depreciation_account_id AND is_active=true;
  IF expense_code IS NULL OR accumulated_code IS NULL THEN RAISE EXCEPTION 'Depreciation accounts are not active'; END IF;
  PERFORM public.accounting_create_posted_journal(
    NEW.depreciation_date,'Depreciation: '||a.asset_code,
    'depreciation',NEW.id,NEW.created_by,NEW.approved_by,a.asset_code,
    jsonb_build_array(
      jsonb_build_object('account_code',expense_code,'debit',NEW.amount,'credit',0,'description','Depreciation expense'),
      jsonb_build_object('account_code',accumulated_code,'debit',0,'credit',NEW.amount,'description','Accumulated depreciation')
    )
  );
  UPDATE public.accounting_asset_depreciation SET status='posted' WHERE id=NEW.id;
  UPDATE public.accounting_fixed_assets
  SET accumulated_depreciation=LEAST(purchase_cost-residual_value,accumulated_depreciation+NEW.amount),
      status='active',updated_at=now()
  WHERE id=a.id;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_post_depreciation_approval
AFTER UPDATE OF status ON public.accounting_asset_depreciation
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_depreciation();

CREATE OR REPLACE VIEW public.accounting_budget_vs_actual
WITH (security_invoker=true)
AS
SELECT
  b.id AS budget_id,
  b.name AS budget_name,
  fy.name AS financial_year,
  p.id AS period_id,
  p.name AS period_name,
  aa.id AS account_id,
  aa.code AS account_code,
  aa.name AS account_name,
  aa.account_type,
  bl.amount AS budget_amount,
  CASE WHEN aa.account_type IN ('liability','equity','revenue')
    THEN COALESCE(SUM(jl.credit-jl.debit),0)
    ELSE COALESCE(SUM(jl.debit-jl.credit),0)
  END AS actual_amount
FROM public.accounting_budget_lines bl
JOIN public.accounting_budgets b ON b.id=bl.budget_id
JOIN public.accounting_financial_years fy ON fy.id=b.financial_year_id
JOIN public.accounting_periods p ON p.id=bl.period_id
JOIN public.accounting_accounts aa ON aa.id=bl.account_id
LEFT JOIN public.journal_entries je ON je.period_id=p.id AND je.status='posted'
LEFT JOIN public.journal_lines jl ON jl.journal_entry_id=je.id AND jl.account_id=aa.id
GROUP BY b.id,b.name,fy.name,p.id,p.name,aa.id,aa.code,aa.name,aa.account_type,bl.amount;
GRANT SELECT ON public.accounting_budget_vs_actual TO authenticated;
