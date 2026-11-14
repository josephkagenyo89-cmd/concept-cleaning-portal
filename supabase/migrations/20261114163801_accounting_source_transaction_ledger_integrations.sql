
-- Ledger integration for approved source transactions. Historical rows are intentionally untouched.

CREATE SEQUENCE IF NOT EXISTS public.accounting_entry_number_seq;
SELECT setval(
  'public.accounting_entry_number_seq',
  GREATEST(COALESCE((SELECT max(entry_number) FROM public.journal_entries),0),0)+1,
  false
);

INSERT INTO public.accounting_accounts(code,name,account_type,description,is_system_account,is_active)
VALUES
 ('1030','Other Receipts Clearing','asset','Temporary clearing for receipts requiring allocation',true,true),
 ('2310','NSSF Payable','liability','Employee and employer NSSF payable',true,true),
 ('2320','SHIF Payable','liability','SHIF deductions payable',true,true),
 ('2330','Housing Levy Payable','liability','Employee and employer housing levy payable',true,true),
 ('2340','Other Payroll Deductions Payable','liability','Other payroll deductions pending remittance',true,true),
 ('5150','Employer Payroll Contributions','expense','Employer statutory payroll contributions',true,true)
ON CONFLICT(code) DO NOTHING;

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE OR REPLACE FUNCTION public.accounting_create_posted_journal(
  p_entry_date date,
  p_description text,
  p_source_type text,
  p_source_id uuid,
  p_created_by uuid,
  p_approved_by uuid,
  p_reference text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  v_existing uuid;
  v_period_id uuid;
  v_journal_id uuid;
  v_line record;
  v_account_id uuid;
  v_line_number integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may create ledger entries';
  END IF;
  IF p_entry_date IS NULL OR p_source_id IS NULL OR p_source_type IS NULL THEN
    RAISE EXCEPTION 'Journal date and source reference are required';
  END IF;
  IF p_created_by IS NULL OR p_approved_by IS NULL OR p_created_by=p_approved_by THEN
    RAISE EXCEPTION 'Source transaction must have a different submitter and approver';
  END IF;

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE source_type=p_source_type AND source_id=p_source_id::text;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT id INTO v_period_id
  FROM public.accounting_periods
  WHERE p_entry_date BETWEEN starts_on AND ends_on AND status='open'
  ORDER BY starts_on DESC LIMIT 1;
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open accounting period exists for %',p_entry_date;
  END IF;

  INSERT INTO public.journal_entries(
    entry_number,entry_date,description,reference,source_type,source_id,status,
    period_id,created_by,approval_status,approved_by,approved_at
  ) VALUES (
    nextval('public.accounting_entry_number_seq'),
    p_entry_date,
    COALESCE(NULLIF(p_description,''),'Accounting source transaction'),
    NULLIF(p_reference,''),
    p_source_type,p_source_id::text,'draft',
    v_period_id,p_created_by,'approved',p_approved_by,now()
  ) RETURNING id INTO v_journal_id;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(COALESCE(p_lines,'[]'::jsonb))
      AS x(account_code text,debit numeric,credit numeric,description text)
  LOOP
    IF COALESCE(v_line.debit,0)=0 AND COALESCE(v_line.credit,0)=0 THEN CONTINUE; END IF;
    SELECT id INTO v_account_id FROM public.accounting_accounts
    WHERE code=v_line.account_code AND is_active=true;
    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Active ledger account % was not found',v_line.account_code;
    END IF;
    v_line_number:=v_line_number+1;
    INSERT INTO public.journal_lines(journal_entry_id,line_number,account_id,description,debit,credit)
    VALUES(v_journal_id,v_line_number,v_account_id,v_line.description,
      COALESCE(v_line.debit,0),COALESCE(v_line.credit,0));
  END LOOP;

  IF v_line_number<2 THEN RAISE EXCEPTION 'A journal must contain at least two non-zero lines'; END IF;
  PERFORM public.accounting_post_journal(v_journal_id);
  RETURN v_journal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accounting_create_posted_journal(date,text,text,uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE revenue_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.payment_status<>'pending_approval'
     OR NEW.payment_status<>'approved' THEN RETURN NEW; END IF;
  revenue_code:=CASE
    WHEN COALESCE(NEW.service,'') ILIKE ANY(ARRAY['%pest%','%fumigation%','%bedbug%','%cockroach%']) THEN '4100'
    WHEN COALESCE(NEW.service,'') ILIKE '%clean%' THEN '4000'
    ELSE '4200'
  END;
  PERFORM public.accounting_create_posted_journal(
    NEW.date,
    'Invoice revenue recognised: '||NEW.invoice_number,
    'invoice',NEW.id,NEW.created_by,NEW.approved_by,NEW.invoice_number,
    jsonb_build_array(
      jsonb_build_object('account_code','1100','debit',NEW.amount,'credit',0,'description','Accounts receivable'),
      jsonb_build_object('account_code',revenue_code,'debit',0,'credit',NEW.amount,'description',NEW.service)
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_invoice_approval
AFTER UPDATE OF payment_status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_invoice();

CREATE OR REPLACE FUNCTION public.accounting_post_approved_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  asset_code text;
  revenue_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    UPDATE public.invoice_payments
    SET approval_status='approved',approved_by=NEW.approved_by,approved_at=NEW.approved_at
    WHERE invoice_id=NEW.invoice_id AND approval_status='pending_approval';
    RETURN NEW;
  END IF;

  asset_code:=CASE
    WHEN NEW.payment_method='mpesa' THEN '1010'
    WHEN NEW.payment_method IN ('bank','bank_transfer') THEN '1020'
    WHEN NEW.payment_method='cash' THEN '1000'
    ELSE '1030'
  END;
  revenue_code:=CASE
    WHEN COALESCE(NEW.service,'') ILIKE ANY(ARRAY['%pest%','%fumigation%','%bedbug%','%cockroach%']) THEN '4100'
    WHEN COALESCE(NEW.service,'') ILIKE '%clean%' THEN '4000'
    ELSE '4200'
  END;

  PERFORM public.accounting_create_posted_journal(
    NEW.date,
    COALESCE(NEW.description,'Approved income'),
    'income',NEW.id,NEW.created_by,NEW.approved_by,COALESCE(NEW.payment_reference,NEW.mpesa_code),
    jsonb_build_array(
      jsonb_build_object('account_code',asset_code,'debit',NEW.amount,'credit',0,'description','Money received'),
      jsonb_build_object('account_code',revenue_code,'debit',0,'credit',NEW.amount,'description',COALESCE(NEW.service,'Other service revenue'))
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_income_approval
AFTER UPDATE OF status ON public.income_records
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_income();

CREATE OR REPLACE FUNCTION public.accounting_post_approved_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  asset_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.approval_status<>'pending_approval'
     OR NEW.approval_status<>'approved' THEN RETURN NEW; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id=NEW.invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice for payment was not found'; END IF;
  asset_code:=CASE
    WHEN NEW.payment_method='mpesa' THEN '1010'
    WHEN NEW.payment_method='bank' THEN '1020'
    WHEN NEW.payment_method='cash' THEN '1000'
    ELSE '1030'
  END;
  PERFORM public.accounting_create_posted_journal(
    NEW.payment_date,
    'Invoice payment received: '||v_invoice.invoice_number,
    'invoice_payment',NEW.id,NEW.recorded_by,NEW.approved_by,NEW.payment_reference,
    jsonb_build_array(
      jsonb_build_object('account_code',asset_code,'debit',NEW.amount,'credit',0,'description','Payment received'),
      jsonb_build_object('account_code','1100','debit',0,'credit',NEW.amount,'description','Reduce accounts receivable')
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_invoice_payment_approval
AFTER UPDATE OF approval_status ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_invoice_payment();

CREATE OR REPLACE FUNCTION public.accounting_post_approved_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE expense_code text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.approval_status<>'pending_approval'
     OR NEW.approval_status<>'approved' THEN RETURN NEW; END IF;
  expense_code:=CASE
    WHEN NEW.category='equipment' THEN '1500'
    WHEN NEW.category='cleaning_chemicals' THEN '5000'
    WHEN NEW.category IN ('fuel','transport') THEN '5300'
    WHEN NEW.category='staff_payment' THEN '5100'
    WHEN NEW.category='marketing' THEN '5600'
    WHEN NEW.category='rent' THEN '5400'
    WHEN NEW.category='utilities' THEN '5500'
    WHEN NEW.category='repairs' THEN '5700'
    ELSE '6100'
  END;
  PERFORM public.accounting_create_posted_journal(
    NEW.date,
    COALESCE(NEW.description,'Approved expense'),
    'expense',NEW.id,NEW.created_by,NEW.approved_by,COALESCE(NEW.payment_reference,NEW.receipt_reference),
    jsonb_build_array(
      jsonb_build_object('account_code',expense_code,'debit',NEW.amount,'credit',0,'description',NEW.category),
      jsonb_build_object('account_code','2000','debit',0,'credit',NEW.amount,'description','Accounts payable')
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_expense_approval
AFTER UPDATE OF approval_status ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_expense();

CREATE OR REPLACE FUNCTION public.accounting_post_expense_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE asset_code text;
BEGIN
  IF NEW.paid_at IS NULL OR NEW.approval_status<>'approved'
     OR (TG_OP='UPDATE' AND OLD.paid_at IS NOT NULL) THEN RETURN NEW; END IF;
  asset_code:=CASE
    WHEN NEW.payment_method='mpesa' THEN '1010'
    WHEN NEW.payment_method IN ('bank','bank_transfer') THEN '1020'
    ELSE '1000'
  END;
  PERFORM public.accounting_create_posted_journal(
    NEW.paid_at::date,
    'Expense payment: '||COALESCE(NEW.description,NEW.category),
    'expense_payment',NEW.id,NEW.created_by,NEW.approved_by,COALESCE(NEW.payment_reference,NEW.receipt_reference),
    jsonb_build_array(
      jsonb_build_object('account_code','2000','debit',NEW.amount,'credit',0,'description','Settle accounts payable'),
      jsonb_build_object('account_code',asset_code,'debit',0,'credit',NEW.amount,'description','Expense paid')
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_expense_payment
AFTER INSERT OR UPDATE OF paid_at ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_expense_payment();

CREATE OR REPLACE FUNCTION public.accounting_record_expense_payment(
  p_expense_id uuid,p_payment_method text,p_payment_reference text DEFAULT NULL,p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE r public.expenses%ROWTYPE; ref text:=NULLIF(BTRIM(p_payment_reference),'');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may record expense payments';
  END IF;
  IF p_payment_method NOT IN ('cash','mpesa','bank','petty_cash') THEN RAISE EXCEPTION 'Invalid expense payment method'; END IF;
  IF p_payment_method IN ('mpesa','bank') AND ref IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;
  IF p_payment_date IS NULL OR p_payment_date>CURRENT_DATE THEN RAISE EXCEPTION 'Invalid payment date'; END IF;
  UPDATE public.expenses SET payment_method=p_payment_method,payment_reference=ref,
    paid_by=auth.uid(),paid_at=p_payment_date::timestamptz
  WHERE id=p_expense_id AND approval_status='approved' AND paid_at IS NULL
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved unpaid expense not found'; END IF;
  RETURN r;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_record_expense_payment(uuid,text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_record_expense_payment(uuid,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_payroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  v_gross numeric(18,2); v_net numeric(18,2); v_paye numeric(18,2);
  v_nssf numeric(18,2); v_shif numeric(18,2); v_housing numeric(18,2);
  v_other numeric(18,2); v_employer numeric(18,2);
  v_lines jsonb;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;
  SELECT
    COALESCE(sum(gross_salary),0),COALESCE(sum(net_salary),0),COALESCE(sum(net_paye),0),
    COALESCE(sum(nssf_tier1+nssf_tier2),0),COALESCE(sum(shif_amount),0),
    COALESCE(sum(housing_levy_amount),0),COALESCE(sum(other_deductions),0),
    COALESCE(sum(employer_nssf+employer_housing_levy),0)
  INTO v_gross,v_net,v_paye,v_nssf,v_shif,v_housing,v_other,v_employer
  FROM public.payroll_items WHERE payroll_run_id=NEW.id;
  IF v_gross<=0 OR v_net<0 THEN RAISE EXCEPTION 'Payroll run has no valid payroll items'; END IF;
  v_lines:=jsonb_build_array(
    jsonb_build_object('account_code','5100','debit',v_gross,'credit',0,'description','Gross salaries'),
    jsonb_build_object('account_code','5150','debit',v_employer,'credit',0,'description','Employer statutory contributions'),
    jsonb_build_object('account_code','2100','debit',0,'credit',v_net,'description','Net salaries payable'),
    jsonb_build_object('account_code','2300','debit',0,'credit',v_paye,'description','PAYE payable'),
    jsonb_build_object('account_code','2310','debit',0,'credit',v_nssf,'description','NSSF payable'),
    jsonb_build_object('account_code','2320','debit',0,'credit',v_shif,'description','SHIF payable'),
    jsonb_build_object('account_code','2330','debit',0,'credit',v_housing,'description','Housing levy payable'),
    jsonb_build_object('account_code','2340','debit',0,'credit',v_other,'description','Other deductions payable')
  );
  PERFORM public.accounting_create_posted_journal(
    COALESCE(NEW.pay_date,NEW.end_date),
    'Payroll accrual: '||NEW.payroll_code,
    'payroll_accrual',NEW.id,NEW.created_by,NEW.approved_by,NEW.payroll_code,v_lines
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_payroll_approval
AFTER UPDATE OF status ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_approved_payroll();

CREATE OR REPLACE FUNCTION public.accounting_post_paid_payroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE v_net numeric(18,2); v_lines jsonb;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'approved' OR NEW.status<>'paid' THEN RETURN NEW; END IF;
  SELECT COALESCE(sum(net_salary),0) INTO v_net
  FROM public.payroll_items WHERE payroll_run_id=NEW.id;
  SELECT jsonb_agg(jsonb_build_object(
    'account_code',CASE
      WHEN lower(COALESCE(payment_method,'')) IN ('bank','bank_transfer') THEN '1020'
      WHEN lower(COALESCE(payment_method,''))='mpesa' THEN '1010'
      WHEN lower(COALESCE(payment_method,''))='cash' THEN '1000'
      ELSE '1030' END,
    'debit',0,'credit',amount,'description','Payroll paid by '||COALESCE(payment_method,'other')
  )) INTO v_lines
  FROM (
    SELECT payment_method,sum(net_salary) amount
    FROM public.payroll_items WHERE payroll_run_id=NEW.id
    GROUP BY payment_method
  ) grouped;
  v_lines:=COALESCE(v_lines,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('account_code','2100','debit',v_net,'credit',0,'description','Settle net payroll payable')
  );
  PERFORM public.accounting_create_posted_journal(
    COALESCE(NEW.pay_date,NEW.end_date),
    'Payroll payment: '||NEW.payroll_code,
    'payroll_payment',NEW.id,NEW.created_by,NEW.approved_by,NEW.payment_reference,v_lines
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounting_post_payroll_payment
AFTER UPDATE OF status ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_paid_payroll();

REVOKE ALL ON FUNCTION public.accounting_post_approved_invoice() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_post_approved_income() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_post_approved_invoice_payment() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_post_approved_expense() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_post_expense_payment() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_post_approved_payroll() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accounting_post_paid_payroll() FROM PUBLIC,anon;
