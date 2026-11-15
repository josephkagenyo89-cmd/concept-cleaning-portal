-- Harden petty-cash history and show opening cash in the cashbook.
-- This is a follow-on migration for the accounting feature branch only.

BEGIN;

DROP POLICY IF EXISTS "Accounting admins manage petty cash transactions" ON public.petty_cash_transactions;
DROP POLICY IF EXISTS "Accounting admins read petty cash transactions" ON public.petty_cash_transactions;
CREATE POLICY "Accounting admins read petty cash transactions"
  ON public.petty_cash_transactions FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.petty_cash_transactions FROM authenticated;
GRANT SELECT ON public.petty_cash_transactions TO authenticated;
GRANT ALL ON public.petty_cash_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_log_petty_cash_opening_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.opening_balance > 0 THEN
    INSERT INTO public.petty_cash_transactions(
      fund_id, transaction_date, transaction_type, amount, description,
      status, created_by, approved_by, approved_at
    ) VALUES (
      NEW.id, CURRENT_DATE, 'opening_balance', NEW.opening_balance,
      'Opening petty-cash balance', 'approved', auth.uid(), auth.uid(), now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_petty_cash_opening_balance ON public.petty_cash_funds;
CREATE TRIGGER trg_petty_cash_opening_balance
AFTER INSERT ON public.petty_cash_funds
FOR EACH ROW EXECUTE FUNCTION public.accounting_log_petty_cash_opening_balance();

COMMIT;
