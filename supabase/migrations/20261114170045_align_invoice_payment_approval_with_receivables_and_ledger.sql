
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id uuid,p_amount numeric,p_payment_method text,p_payment_reference text,p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment_id uuid;
  v_income_id uuid;
  v_reference text:=NULLIF(BTRIM(p_payment_reference),'');
  v_reserved_before numeric(18,2);
  v_approved_before numeric(18,2);
  v_balance numeric(18,2);
  v_reserved_after numeric(18,2);
  v_approved_after numeric(18,2);
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised administrators may record invoice payments';
  END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) THEN
    RAISE EXCEPTION 'Payment amount must be a positive amount to two decimal places';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('mpesa','cash','bank') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_payment_method IN ('mpesa','bank') AND v_reference IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required for M-Pesa and bank payments';
  END IF;
  IF p_payment_date IS NULL OR p_payment_date>CURRENT_DATE THEN
    RAISE EXCEPTION 'Payment date is invalid or in the future';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.payment_status IN ('cancelled','void','rejected') THEN
    RAISE EXCEPTION 'Cannot record payment against a cancelled or rejected invoice';
  END IF;
  IF v_invoice.payment_status NOT IN ('approved','partial','paid') THEN
    RAISE EXCEPTION 'Invoice must be approved before payment can be recorded';
  END IF;

  SELECT COALESCE(SUM(amount) FILTER (WHERE approval_status IN ('approved','pending_approval')),0),
         COALESCE(SUM(amount) FILTER (WHERE approval_status='approved'),0)
  INTO v_reserved_before,v_approved_before
  FROM public.invoice_payments WHERE invoice_id=p_invoice_id;

  v_balance:=round(GREATEST(COALESCE(v_invoice.amount,0)-v_reserved_before,0),2);
  IF v_balance<=0 THEN RAISE EXCEPTION 'Invoice has no available balance after pending and approved payments'; END IF;
  IF p_amount>v_balance THEN RAISE EXCEPTION 'Payment exceeds available invoice balance of %',v_balance; END IF;

  INSERT INTO public.invoice_payments(invoice_id,amount,payment_method,payment_reference,payment_date,recorded_by)
  VALUES(p_invoice_id,p_amount,p_payment_method,v_reference,p_payment_date,auth.uid())
  RETURNING id INTO v_payment_id;

  v_reserved_after:=round(v_reserved_before+p_amount,2);
  v_approved_after:=v_approved_before;
  v_status:=CASE WHEN v_approved_after>=COALESCE(v_invoice.amount,0) THEN 'paid'
                 WHEN v_approved_after>0 THEN 'partial' ELSE 'approved' END;

  SELECT id INTO v_income_id FROM public.income_records WHERE invoice_id=p_invoice_id FOR UPDATE;
  IF v_income_id IS NULL THEN
    INSERT INTO public.income_records(
      date,amount,description,service,payment_method,source,booking_id,invoice_id,
      created_by,client_id,mpesa_code,payment_reference,status
    ) VALUES(
      p_payment_date,v_reserved_after,'Payments submitted for invoice '||v_invoice.invoice_number,
      v_invoice.service,p_payment_method,'client_payment',v_invoice.booking_id,v_invoice.id,
      auth.uid(),v_invoice.client_id,CASE WHEN p_payment_method='mpesa' THEN v_reference ELSE NULL END,
      v_reference,'pending_approval'
    ) RETURNING id INTO v_income_id;
  ELSE
    UPDATE public.income_records
    SET date=p_payment_date,amount=v_reserved_after,
        description='Payments submitted for invoice '||v_invoice.invoice_number,
        service=v_invoice.service,payment_method=p_payment_method,
        client_id=COALESCE(client_id,v_invoice.client_id),
        mpesa_code=CASE WHEN p_payment_method='mpesa' THEN v_reference ELSE NULL END,
        payment_reference=v_reference,status='pending_approval',
        approved_by=NULL,approved_at=NULL,rejection_reason=NULL
    WHERE id=v_income_id;
  END IF;

  UPDATE public.invoice_payments SET income_record_id=v_income_id WHERE id=v_payment_id;

  -- Keep the invoice status tied only to approved payments. Pending amounts reserve balance
  -- but are not reported as received until the central approval queue accepts them.
  UPDATE public.invoices
  SET payment_status=v_status,
      payment_method=p_payment_method,
      payment_reference=v_reference,
      mpesa_code=CASE WHEN p_payment_method='mpesa' THEN v_reference ELSE NULL END,
      payment_date=p_payment_date::timestamptz,
      updated_at=now()
  WHERE id=p_invoice_id;

  RETURN jsonb_build_object(
    'success',true,'payment_id',v_payment_id,'income_record_id',v_income_id,
    'invoice_id',p_invoice_id,'invoice_number',v_invoice.invoice_number,
    'payment_amount',p_amount,'total_reserved',v_reserved_after,
    'total_approved',v_approved_after,
    'outstanding_balance',round(GREATEST(COALESCE(v_invoice.amount,0)-v_reserved_after,0),2),
    'payment_status',v_status,'approval_status','pending_approval',
    'payment_method',p_payment_method,'payment_reference',v_reference,'payment_date',p_payment_date
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  asset_code text;
  approved_total numeric(18,2);
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.approval_status<>'pending_approval'
     OR NEW.approval_status<>'approved' THEN RETURN NEW; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id=NEW.invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice for payment was not found'; END IF;
  asset_code:=CASE WHEN NEW.payment_method='mpesa' THEN '1010'
                   WHEN NEW.payment_method='bank' THEN '1020'
                   WHEN NEW.payment_method='cash' THEN '1000' ELSE '1030' END;
  PERFORM public.accounting_create_posted_journal(
    NEW.payment_date,'Invoice payment received: '||v_invoice.invoice_number,
    'invoice_payment',NEW.id,NEW.recorded_by,NEW.approved_by,NEW.payment_reference,
    jsonb_build_array(
      jsonb_build_object('account_code',asset_code,'debit',NEW.amount,'credit',0,'description','Payment received'),
      jsonb_build_object('account_code','1100','debit',0,'credit',NEW.amount,'description','Reduce accounts receivable')
    )
  );
  SELECT COALESCE(SUM(amount),0) INTO approved_total
  FROM public.invoice_payments WHERE invoice_id=NEW.invoice_id AND approval_status='approved';
  UPDATE public.invoices
  SET payment_status=CASE WHEN approved_total>=amount THEN 'paid'
                          WHEN approved_total>0 THEN 'partial' ELSE 'approved' END,
      updated_at=now()
  WHERE id=NEW.invoice_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accounting_guard_posted_source_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $function$
DECLARE
  source_id_text text;
  has_posted boolean:=false;
  old_json jsonb;
  new_json jsonb;
  protected_keys text[];
  k text;
  payment_state_change_allowed boolean:=false;
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
    protected_keys:=ARRAY['invoice_number','client_name','client_phone','client_id','service','amount','date','line_items','discount_amount','created_by','payment_status'];
    SELECT EXISTS(SELECT 1 FROM public.journal_entries WHERE source_type='invoice' AND source_id=source_id_text) INTO has_posted;
    IF has_posted AND old_json->>'payment_status' IS DISTINCT FROM new_json->>'payment_status' THEN
      payment_state_change_allowed:=pg_trigger_depth()>1 OR EXISTS(
        SELECT 1 FROM public.invoice_payments
        WHERE invoice_id=OLD.id AND approval_status='pending_approval' AND recorded_by=auth.uid()
      );
      IF payment_state_change_allowed THEN
        protected_keys:=array_remove(protected_keys,'payment_status');
      END IF;
    END IF;
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
