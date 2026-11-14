
CREATE UNIQUE INDEX IF NOT EXISTS accounting_fixed_assets_source_expense_unique
ON public.accounting_fixed_assets(source_expense_id) WHERE source_expense_id IS NOT NULL;

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
  UPDATE public.expenses SET payment_method=p_payment_method,payment_reference=ref,
    paid_by=auth.uid(),paid_at=p_payment_date::timestamptz
  WHERE id=p_expense_id AND approval_status='approved' AND paid_at IS NULL AND payment_method<>'petty_cash'
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved unpaid non-petty-cash expense not found'; END IF;
  RETURN r;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_record_expense_payment(uuid,text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_record_expense_payment(uuid,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_generate_depreciation(p_asset_id uuid,p_period_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE a public.accounting_fixed_assets%ROWTYPE; p public.accounting_periods%ROWTYPE;
  remaining numeric(18,2); amount numeric(18,2); schedule_id uuid;
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
  INSERT INTO public.accounting_asset_depreciation(asset_id,period_id,depreciation_date,amount,status,created_by)
  VALUES(p_asset_id,p_period_id,p.ends_on,amount,'pending_approval',auth.uid())
  RETURNING id INTO schedule_id;
  RETURN schedule_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_generate_depreciation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_generate_depreciation(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_guard_fixed_asset_posted_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
DECLARE has_posted boolean:=false; old_json jsonb:=to_jsonb(OLD); new_json jsonb;
  keys text[]:=ARRAY['asset_code','name','category','purchase_date','purchase_cost','residual_value',
    'useful_life_months','depreciation_method','asset_account_id','depreciation_expense_account_id',
    'accumulated_depreciation_account_id','source_expense_id'];
  k text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.journal_entries je
    WHERE (je.source_type IN ('fixed_asset','fixed_asset_payment') AND je.source_id=OLD.id::text)
       OR (je.source_type='depreciation' AND je.source_id IN (
          SELECT d.id::text FROM public.accounting_asset_depreciation d WHERE d.asset_id=OLD.id
       ))
       OR (OLD.source_expense_id IS NOT NULL AND je.source_type IN ('expense','expense_payment') AND je.source_id=OLD.source_expense_id::text)
  ) INTO has_posted;
  IF TG_OP='DELETE' THEN
    IF has_posted THEN RAISE EXCEPTION 'A fixed asset linked to posted ledger activity cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  new_json:=to_jsonb(NEW);
  IF has_posted THEN
    FOREACH k IN ARRAY keys LOOP
      IF old_json->k IS DISTINCT FROM new_json->k THEN
        RAISE EXCEPTION 'Posted fixed asset details are immutable (%); use an adjustment journal',k;
      END IF;
    END LOOP;
    IF OLD.paid_at IS NOT NULL AND (
      old_json->'payment_method' IS DISTINCT FROM new_json->'payment_method' OR
      old_json->'payment_reference' IS DISTINCT FROM new_json->'payment_reference' OR
      old_json->'paid_at' IS DISTINCT FROM new_json->'paid_at'
    ) THEN RAISE EXCEPTION 'Posted fixed asset payment details are immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_guard_fixed_asset_posted_change
BEFORE UPDATE OR DELETE ON public.accounting_fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_fixed_asset_posted_change();

CREATE OR REPLACE FUNCTION public.accounting_guard_posted_depreciation_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
BEGIN
  IF TG_OP='DELETE' AND OLD.status='posted' THEN
    RAISE EXCEPTION 'Posted depreciation cannot be deleted; use a reversing journal';
  ELSIF TG_OP='UPDATE' AND OLD.status='posted' AND (
    OLD.asset_id IS DISTINCT FROM NEW.asset_id OR OLD.period_id IS DISTINCT FROM NEW.period_id OR
    OLD.depreciation_date IS DISTINCT FROM NEW.depreciation_date OR OLD.amount IS DISTINCT FROM NEW.amount
  ) THEN
    RAISE EXCEPTION 'Posted depreciation details are immutable; use a reversing journal';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_guard_posted_depreciation_change
BEFORE UPDATE OR DELETE ON public.accounting_asset_depreciation
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_posted_depreciation_change();

CREATE OR REPLACE FUNCTION public.accounting_guard_approved_budget_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
DECLARE budget_status text;
BEGIN
  IF TG_TABLE_NAME='accounting_budgets' THEN
    IF TG_OP='DELETE' AND OLD.status='approved' THEN RAISE EXCEPTION 'Approved budgets cannot be deleted'; END IF;
    IF TG_OP='UPDATE' AND OLD.status='approved' AND (
      OLD.name IS DISTINCT FROM NEW.name OR OLD.financial_year_id IS DISTINCT FROM NEW.financial_year_id
    ) THEN RAISE EXCEPTION 'Approved budget details are locked'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO budget_status FROM public.accounting_budgets WHERE id=OLD.budget_id;
  IF budget_status='approved' THEN RAISE EXCEPTION 'Allocations in an approved budget are locked'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_guard_approved_budget
BEFORE UPDATE OR DELETE ON public.accounting_budgets
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_approved_budget_change();
CREATE TRIGGER accounting_guard_approved_budget_lines
BEFORE UPDATE OR DELETE ON public.accounting_budget_lines
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_approved_budget_change();

CREATE OR REPLACE FUNCTION public.accounting_guard_approved_reconciliation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $function$
DECLARE rec_status text;
BEGIN
  IF TG_TABLE_NAME='accounting_bank_reconciliations' THEN
    IF TG_OP='DELETE' AND OLD.status='approved' THEN RAISE EXCEPTION 'Approved bank reconciliations cannot be deleted'; END IF;
    IF TG_OP='UPDATE' AND OLD.status='approved' AND (
      OLD.bank_account_id IS DISTINCT FROM NEW.bank_account_id OR OLD.period_id IS DISTINCT FROM NEW.period_id OR
      OLD.statement_opening_balance IS DISTINCT FROM NEW.statement_opening_balance OR
      OLD.statement_closing_balance IS DISTINCT FROM NEW.statement_closing_balance OR
      OLD.book_closing_balance IS DISTINCT FROM NEW.book_closing_balance OR OLD.difference IS DISTINCT FROM NEW.difference
    ) THEN RAISE EXCEPTION 'Approved reconciliation balances are locked'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO rec_status FROM public.accounting_bank_reconciliations WHERE id=OLD.reconciliation_id;
  IF rec_status='approved' THEN RAISE EXCEPTION 'Statement lines in an approved reconciliation are locked'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_guard_approved_reconciliation
BEFORE UPDATE OR DELETE ON public.accounting_bank_reconciliations
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_approved_reconciliation();
CREATE TRIGGER accounting_guard_approved_statement_lines
BEFORE UPDATE OR DELETE ON public.accounting_bank_statement_lines
FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_approved_reconciliation();
