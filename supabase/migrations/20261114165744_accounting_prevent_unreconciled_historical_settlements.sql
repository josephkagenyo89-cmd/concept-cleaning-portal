
CREATE OR REPLACE FUNCTION public.accounting_require_invoice_recognition_before_payment()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.journal_entries
    WHERE source_type='invoice' AND source_id=NEW.invoice_id::text AND status='posted'
  ) THEN
    RAISE EXCEPTION 'Invoice revenue has not been recognised in the ledger yet. Approve or reconcile the invoice before recording payment.';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_require_invoice_recognition_before_payment
BEFORE INSERT ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.accounting_require_invoice_recognition_before_payment();

CREATE OR REPLACE FUNCTION public.accounting_post_approved_invoice_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE v_invoice public.invoices%ROWTYPE; asset_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.approval_status<>'pending_approval' OR NEW.approval_status<>'approved' THEN RETURN NEW; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id=NEW.invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice for payment was not found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='invoice' AND source_id=NEW.invoice_id::text AND status='posted') THEN
    RAISE EXCEPTION 'Invoice revenue must be posted before its payment can be posted';
  END IF;
  asset_code:=CASE
    WHEN NEW.payment_method='mpesa' THEN '1010'
    WHEN NEW.payment_method='bank' THEN '1020'
    WHEN NEW.payment_method='cash' THEN '1000'
    ELSE '1030'
  END;
  PERFORM public.accounting_create_posted_journal(
    NEW.payment_date,'Invoice payment received: '||v_invoice.invoice_number,
    'invoice_payment',NEW.id,NEW.recorded_by,NEW.approved_by,NEW.payment_reference,
    jsonb_build_array(
      jsonb_build_object('account_code',asset_code,'debit',NEW.amount,'credit',0,'description','Payment received'),
      jsonb_build_object('account_code','1100','debit',0,'credit',NEW.amount,'description','Reduce accounts receivable')
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_record_expense_payment(
  p_expense_id uuid,p_payment_method text,p_payment_reference text DEFAULT NULL,p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS public.expenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE r public.expenses%ROWTYPE; ref text:=NULLIF(BTRIM(p_payment_reference),'');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may record expense payments';
  END IF;
  IF p_payment_method NOT IN ('cash','mpesa','bank') THEN RAISE EXCEPTION 'Invalid expense payment method; petty cash expenses are settled through the petty-cash approval workflow'; END IF;
  IF p_payment_method IN ('mpesa','bank') AND ref IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;
  IF p_payment_date IS NULL OR p_payment_date>CURRENT_DATE THEN RAISE EXCEPTION 'Invalid payment date'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='expense' AND source_id=p_expense_id::text AND status='posted') THEN
    RAISE EXCEPTION 'Expense accrual has not been posted. Reconcile the approved expense before recording payment.';
  END IF;
  UPDATE public.expenses SET payment_method=p_payment_method,payment_reference=ref,
    paid_by=auth.uid(),paid_at=p_payment_date::timestamptz
  WHERE id=p_expense_id AND approval_status='approved' AND paid_at IS NULL AND payment_method<>'petty_cash'
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved unpaid non-petty-cash expense not found'; END IF;
  RETURN r;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_post_expense_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE asset_code text;
BEGIN
  IF NEW.paid_at IS NULL OR NEW.approval_status<>'approved'
     OR (TG_OP='UPDATE' AND OLD.paid_at IS NOT NULL) THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='expense' AND source_id=NEW.id::text AND status='posted') THEN
    RAISE EXCEPTION 'Expense accrual must be posted before the payment settlement';
  END IF;
  IF NEW.payment_method='petty_cash' AND NEW.petty_cash_fund_id IS NOT NULL THEN
    SELECT aa.code INTO asset_code FROM public.petty_cash_funds f
      JOIN public.accounting_accounts aa ON aa.id=f.accounting_account_id WHERE f.id=NEW.petty_cash_fund_id;
  ELSE
    asset_code:=CASE WHEN NEW.payment_method='mpesa' THEN '1010'
      WHEN NEW.payment_method IN ('bank','bank_transfer') THEN '1020' ELSE '1000' END;
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

CREATE OR REPLACE FUNCTION public.accounting_post_paid_payroll()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE v_net numeric(18,2); v_lines jsonb;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'approved' OR NEW.status<>'paid' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='payroll_accrual' AND source_id=NEW.id::text AND status='posted') THEN
    RAISE EXCEPTION 'Payroll accrual has not been posted. Reconcile this legacy payroll run before marking it paid.';
  END IF;
  SELECT COALESCE(sum(net_salary),0) INTO v_net FROM public.payroll_items WHERE payroll_run_id=NEW.id;
  SELECT jsonb_agg(jsonb_build_object(
    'account_code',CASE
      WHEN lower(COALESCE(payment_method,'')) IN ('bank','bank_transfer') THEN '1020'
      WHEN lower(COALESCE(payment_method,''))='mpesa' THEN '1010'
      WHEN lower(COALESCE(payment_method,''))='cash' THEN '1000'
      ELSE '1030' END,
    'debit',0,'credit',amount,'description','Payroll paid by '||COALESCE(payment_method,'other')
  )) INTO v_lines
  FROM (SELECT payment_method,sum(net_salary) amount FROM public.payroll_items WHERE payroll_run_id=NEW.id GROUP BY payment_method) grouped;
  v_lines:=COALESCE(v_lines,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('account_code','2100','debit',v_net,'credit',0,'description','Settle net payroll payable')
  );
  PERFORM public.accounting_create_posted_journal(
    COALESCE(NEW.pay_date,NEW.end_date),'Payroll payment: '||NEW.payroll_code,
    'payroll_payment',NEW.id,NEW.created_by,NEW.approved_by,NEW.payment_reference,v_lines
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_record_asset_payment(
  p_asset_id uuid,p_payment_method text,p_payment_reference text DEFAULT NULL,p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS public.accounting_fixed_assets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE a public.accounting_fixed_assets%ROWTYPE; ref text:=NULLIF(BTRIM(p_payment_reference),'');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may record asset payments';
  END IF;
  IF p_payment_method NOT IN ('cash','mpesa','bank') THEN RAISE EXCEPTION 'Unsupported asset payment method'; END IF;
  IF p_payment_method IN ('mpesa','bank') AND ref IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;
  SELECT * INTO a FROM public.accounting_fixed_assets WHERE id=p_asset_id AND status IN ('approved','active') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved fixed asset not found'; END IF;
  IF a.source_expense_id IS NOT NULL THEN RAISE EXCEPTION 'This asset is linked to an expense; record payment through Accounts Payable instead'; END IF;
  IF a.paid_at IS NOT NULL THEN RAISE EXCEPTION 'This asset has already been marked as paid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='fixed_asset' AND source_id=p_asset_id::text AND status='posted') THEN
    RAISE EXCEPTION 'Fixed asset acquisition has not been posted. Reconcile the asset before recording payment.';
  END IF;
  UPDATE public.accounting_fixed_assets
  SET payment_method=p_payment_method,payment_reference=ref,paid_by=auth.uid(),
      paid_at=COALESCE(p_payment_date,CURRENT_DATE)::timestamptz,updated_at=now()
  WHERE id=p_asset_id RETURNING * INTO a;
  RETURN a;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_guard_posted_depreciation_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
BEGIN
  IF TG_OP='DELETE' AND OLD.status='posted' THEN
    RAISE EXCEPTION 'Posted depreciation cannot be deleted; use a reversing journal';
  ELSIF TG_OP='UPDATE' AND OLD.status='posted' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.asset_id IS DISTINCT FROM NEW.asset_id OR OLD.period_id IS DISTINCT FROM NEW.period_id OR
    OLD.depreciation_date IS DISTINCT FROM NEW.depreciation_date OR OLD.amount IS DISTINCT FROM NEW.amount
  ) THEN
    RAISE EXCEPTION 'Posted depreciation details are immutable; use a reversing journal';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE asset_code text; expense_category text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;
  IF NEW.source_expense_id IS NOT NULL THEN
    SELECT category INTO expense_category FROM public.expenses
    WHERE id=NEW.source_expense_id AND approval_status='approved';
    IF NOT FOUND THEN RAISE EXCEPTION 'The linked source expense must be approved before registering this asset'; END IF;
    SELECT code INTO asset_code FROM public.accounting_accounts WHERE id=NEW.asset_account_id;
    IF expense_category<>'equipment' OR asset_code<>'1500' THEN
      RAISE EXCEPTION 'Linked equipment expenses are recognised in account 1500; select that asset account to avoid a ledger/register mismatch';
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
