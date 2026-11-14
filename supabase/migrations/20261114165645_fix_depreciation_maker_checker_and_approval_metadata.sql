
ALTER TABLE public.accounting_asset_depreciation
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

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
    WHEN 'accounting_fixed_assets','accounting_budgets','accounting_bank_reconciliations',
         'accounting_asset_depreciation' THEN state_field:='status';
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
    UPDATE public.accounting_approvals
      SET status=new_status,decided_by=auth.uid(),decided_at=now(),
          decision_note=n->>'rejection_reason'
    WHERE id=pending_id;
  END IF;
  RETURN NEW;
END;
$function$;
