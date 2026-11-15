
ALTER TABLE public.accounting_fixed_assets
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_by uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.accounting_fixed_assets
  ADD CONSTRAINT accounting_fixed_assets_payment_method_check
  CHECK(payment_method IS NULL OR payment_method IN ('cash','mpesa','bank'));

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
  UPDATE public.accounting_fixed_assets
  SET payment_method=p_payment_method,payment_reference=ref,paid_by=auth.uid(),
      paid_at=COALESCE(p_payment_date,CURRENT_DATE)::timestamptz,updated_at=now()
  WHERE id=p_asset_id RETURNING * INTO a;
  RETURN a;
END;
$function$;
REVOKE ALL ON FUNCTION public.accounting_record_asset_payment(uuid,text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accounting_record_asset_payment(uuid,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_post_asset_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE cash_code text;
BEGIN
  IF NEW.paid_at IS NULL OR NEW.status NOT IN ('approved','active')
     OR (TG_OP='UPDATE' AND OLD.paid_at IS NOT NULL) THEN RETURN NEW; END IF;
  cash_code:=CASE WHEN NEW.payment_method='mpesa' THEN '1010'
    WHEN NEW.payment_method='bank' THEN '1020' ELSE '1000' END;
  PERFORM public.accounting_create_posted_journal(
    NEW.paid_at::date,'Fixed asset payment: '||NEW.asset_code,
    'fixed_asset_payment',NEW.id,NEW.created_by,NEW.approved_by,NEW.payment_reference,
    jsonb_build_array(
      jsonb_build_object('account_code','2000','debit',NEW.purchase_cost,'credit',0,'description','Settle fixed asset payable'),
      jsonb_build_object('account_code',cash_code,'debit',0,'credit',NEW.purchase_cost,'description','Fixed asset payment')
    )
  );
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_post_fixed_asset_payment
AFTER INSERT OR UPDATE OF paid_at ON public.accounting_fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.accounting_post_asset_payment();
