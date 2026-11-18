
CREATE UNIQUE INDEX IF NOT EXISTS accounting_fixed_assets_source_expense_id_uidx
ON public.accounting_fixed_assets(source_expense_id)
WHERE source_expense_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.accounting_post_approved_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE
  asset_code text;
  source_expense public.expenses%ROWTYPE;
  source_journal_exists boolean;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'approved' THEN RETURN NEW; END IF;

  IF NEW.source_expense_id IS NOT NULL THEN
    SELECT * INTO source_expense
    FROM public.expenses
    WHERE id=NEW.source_expense_id AND approval_status='approved'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The linked source expense must be approved before registering this asset'; END IF;
    IF source_expense.category<>'equipment' THEN
      RAISE EXCEPTION 'Only approved equipment expenses can be linked to the fixed asset register';
    END IF;
    IF round(source_expense.amount,2)<>round(NEW.purchase_cost,2) THEN
      RAISE EXCEPTION 'Asset purchase cost must exactly match the linked equipment expense';
    END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.journal_entries
      WHERE source_type='expense' AND source_id=NEW.source_expense_id::text AND status='posted'
    ) INTO source_journal_exists;
    IF NOT source_journal_exists THEN
      RAISE EXCEPTION 'The linked historical expense has no posted accounting journal. Reconcile it before linking the asset.';
    END IF;
    SELECT code INTO asset_code FROM public.accounting_accounts
    WHERE id=NEW.asset_account_id AND is_active=true;
    IF asset_code<>'1500' THEN
      RAISE EXCEPTION 'Equipment expenses are posted to asset account 1500; select that account for the linked asset';
    END IF;
    IF source_expense.paid_at IS NOT NULL THEN
      UPDATE public.accounting_fixed_assets
      SET paid_by=source_expense.paid_by,
          paid_at=source_expense.paid_at,
          payment_method=CASE
            WHEN source_expense.payment_method='mpesa' THEN 'mpesa'
            WHEN source_expense.payment_method IN ('bank','bank_transfer') THEN 'bank'
            ELSE 'cash'
          END,
          payment_reference=COALESCE(source_expense.payment_reference,source_expense.receipt_reference),
          updated_at=now()
      WHERE id=NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT code INTO asset_code FROM public.accounting_accounts
  WHERE id=NEW.asset_account_id AND is_active=true;
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

CREATE OR REPLACE FUNCTION public.accounting_sync_asset_payment_from_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
BEGIN
  IF NEW.paid_at IS NULL OR NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at THEN RETURN NEW; END IF;
  UPDATE public.accounting_fixed_assets
  SET paid_by=NEW.paid_by,
      paid_at=NEW.paid_at,
      payment_method=CASE
        WHEN NEW.payment_method='mpesa' THEN 'mpesa'
        WHEN NEW.payment_method IN ('bank','bank_transfer') THEN 'bank'
        ELSE 'cash'
      END,
      payment_reference=COALESCE(NEW.payment_reference,NEW.receipt_reference),
      updated_at=now()
  WHERE source_expense_id=NEW.id;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS accounting_sync_asset_payment_from_expense ON public.expenses;
CREATE TRIGGER accounting_sync_asset_payment_from_expense
AFTER UPDATE OF paid_at ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.accounting_sync_asset_payment_from_expense();

CREATE OR REPLACE FUNCTION public.accounting_post_asset_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE cash_code text;
BEGIN
  IF NEW.source_expense_id IS NOT NULL THEN RETURN NEW; END IF;
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
