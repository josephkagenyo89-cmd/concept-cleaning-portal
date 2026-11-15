
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
    IF TG_OP<>'UPDATE' OR OLD.approval_status<>'pending_approval'
       OR pg_trigger_depth()<2 OR NEW.recorded_by IS NULL OR NEW.recorded_by=auth.uid()
       OR NULLIF(BTRIM(NEW.rejection_reason),'') IS NULL THEN
      RAISE EXCEPTION 'Invoice payments can only be rejected through the parent income approval with a reason';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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
  -- System rollback after a payment rejection restores the already-approved invoice to its approved state.
  IF TG_TABLE_NAME='invoices' AND TG_OP='UPDATE' AND new_state='approved'
     AND old_state IN ('partial','paid') AND pg_trigger_depth()>0
     AND n->>'approved_by' IS NOT DISTINCT FROM o->>'approved_by' THEN
    RETURN NEW;
  END IF;
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

CREATE OR REPLACE FUNCTION public.accounting_revert_invoice_on_payment_rejection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE approved_total numeric(14,2); pending_total numeric(14,2); new_invoice_status text;
BEGIN
  IF TG_OP<>'UPDATE' OR OLD.status<>'pending_approval' OR NEW.status<>'rejected' OR NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.invoice_payments
  SET approval_status='rejected',rejection_reason=COALESCE(NEW.rejection_reason,'Payment evidence rejected'),
      approved_by=NULL,approved_at=NULL
  WHERE income_record_id=NEW.id AND approval_status='pending_approval';

  SELECT
    COALESCE(sum(amount) FILTER (WHERE approval_status='approved'),0),
    COALESCE(sum(amount) FILTER (WHERE approval_status='pending_approval'),0)
  INTO approved_total,pending_total
  FROM public.invoice_payments WHERE invoice_id=NEW.invoice_id;

  SELECT CASE
    WHEN approved_total >= i.amount THEN 'paid'
    WHEN approved_total+pending_total > 0 THEN 'partial'
    ELSE 'approved'
  END INTO new_invoice_status
  FROM public.invoices i WHERE i.id=NEW.invoice_id;

  UPDATE public.invoices SET payment_status=new_invoice_status
  WHERE id=NEW.invoice_id;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER accounting_revert_invoice_payment_rejection
AFTER UPDATE OF status ON public.income_records
FOR EACH ROW EXECUTE FUNCTION public.accounting_revert_invoice_on_payment_rejection();
