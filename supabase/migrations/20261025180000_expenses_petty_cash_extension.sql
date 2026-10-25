-- Extend the EXISTING expenses workflow and add petty cash inside the same module.
-- Existing expense rows are preserved and treated as approved historical entries.
-- This migration is intentionally not applied to any database by this change.

BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS receipt_reference text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.expenses.approval_status IS
  'Approval state for the existing expense register; historical rows remain approved until reviewed.';

CREATE TABLE IF NOT EXISTS public.petty_cash_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  custodian_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.petty_cash_funds(id) ON DELETE RESTRICT,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (
    transaction_type IN ('opening_balance', 'replenishment', 'expense', 'cash_return', 'adjustment_in', 'adjustment_out')
  ),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  reference text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE RESTRICT,
  receipt_reference text,
  receipt_url text,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((transaction_type = 'expense' AND expense_id IS NOT NULL) OR transaction_type <> 'expense')
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_fund_date
  ON public.petty_cash_transactions(fund_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_expense
  ON public.petty_cash_transactions(expense_id);
CREATE INDEX IF NOT EXISTS idx_expenses_approval_status_date
  ON public.expenses(approval_status, date DESC);

ALTER TABLE public.petty_cash_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accounting admins manage petty cash funds" ON public.petty_cash_funds;
CREATE POLICY "Accounting admins manage petty cash funds"
  ON public.petty_cash_funds FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Accounting admins manage petty cash transactions" ON public.petty_cash_transactions;
CREATE POLICY "Accounting admins manage petty cash transactions"
  ON public.petty_cash_transactions FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_funds, public.petty_cash_transactions TO authenticated;
GRANT ALL ON public.petty_cash_funds, public.petty_cash_transactions TO service_role;

-- Balance is derived from approved movements only. Replenishments/returns increase cash;
-- expenses/adjustment-outs decrease it. Pending or rejected entries never affect balance.
CREATE OR REPLACE VIEW public.petty_cash_fund_balances AS
SELECT
  f.id AS fund_id,
  f.name,
  f.custodian_id,
  f.opening_balance
    + COALESCE(SUM(
        CASE
          WHEN t.status <> 'approved' THEN 0
          WHEN t.transaction_type IN ('replenishment', 'cash_return', 'adjustment_in') THEN t.amount
          WHEN t.transaction_type IN ('expense', 'adjustment_out') THEN -t.amount
          ELSE 0
        END
      ), 0) AS current_balance,
  f.is_active,
  f.created_at
FROM public.petty_cash_funds f
LEFT JOIN public.petty_cash_transactions t ON t.fund_id = f.id
GROUP BY f.id, f.name, f.custodian_id, f.opening_balance, f.is_active, f.created_at;

ALTER VIEW public.petty_cash_fund_balances SET (security_invoker = true);
GRANT SELECT ON public.petty_cash_fund_balances TO authenticated;

-- Atomic petty-cash expense capture: one expense register row and one linked cash movement.
CREATE OR REPLACE FUNCTION public.accounting_record_petty_cash_expense(
  p_fund_id uuid,
  p_date date,
  p_amount numeric,
  p_category text,
  p_description text,
  p_receipt_reference text DEFAULT NULL,
  p_receipt_url text DEFAULT NULL,
  p_supplier_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_expense_id uuid;
  available_balance numeric(14,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized accounting administrators may record petty-cash expenses';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  PERFORM 1 FROM public.petty_cash_funds WHERE id = p_fund_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active petty-cash fund not found'; END IF;

  SELECT current_balance INTO available_balance
  FROM public.petty_cash_fund_balances WHERE fund_id = p_fund_id;
  IF available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient petty-cash balance. Available: %, requested: %', available_balance, p_amount;
  END IF;

  INSERT INTO public.expenses(
    date, amount, category, description, created_by, supplier_name, receipt_reference,
    receipt_url, payment_method, approval_status, approved_by, approved_at, paid_by, paid_at
  ) VALUES (
    COALESCE(p_date, CURRENT_DATE), p_amount, COALESCE(NULLIF(p_category, ''), 'other'),
    NULLIF(p_description, ''), auth.uid(), NULLIF(p_supplier_name, ''),
    NULLIF(p_receipt_reference, ''), NULLIF(p_receipt_url, ''), 'petty_cash',
    'approved', auth.uid(), now(), auth.uid(), now()
  ) RETURNING id INTO new_expense_id;

  INSERT INTO public.petty_cash_transactions(
    fund_id, transaction_date, transaction_type, amount, description, expense_id,
    receipt_reference, receipt_url, status, created_by, approved_by, approved_at
  ) VALUES (
    p_fund_id, COALESCE(p_date, CURRENT_DATE), 'expense', p_amount,
    COALESCE(NULLIF(p_description, ''), 'Petty cash expense'), new_expense_id,
    NULLIF(p_receipt_reference, ''), NULLIF(p_receipt_url, ''), 'approved',
    auth.uid(), auth.uid(), now()
  );

  RETURN new_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_record_petty_cash_movement(
  p_fund_id uuid,
  p_date date,
  p_type text,
  p_amount numeric,
  p_description text,
  p_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_transaction_id uuid;
  available_balance numeric(14,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorized accounting administrators may record petty-cash movements';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF p_type NOT IN ('replenishment', 'cash_return', 'adjustment_in', 'adjustment_out') THEN
    RAISE EXCEPTION 'Unsupported petty-cash movement type';
  END IF;

  PERFORM 1 FROM public.petty_cash_funds WHERE id = p_fund_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active petty-cash fund not found'; END IF;

  IF p_type = 'adjustment_out' THEN
    SELECT current_balance INTO available_balance
    FROM public.petty_cash_fund_balances WHERE fund_id = p_fund_id;
    IF available_balance < p_amount THEN RAISE EXCEPTION 'Adjustment exceeds available petty-cash balance'; END IF;
  END IF;

  INSERT INTO public.petty_cash_transactions(
    fund_id, transaction_date, transaction_type, amount, description, reference,
    status, created_by, approved_by, approved_at
  ) VALUES (
    p_fund_id, COALESCE(p_date, CURRENT_DATE), p_type, p_amount,
    COALESCE(NULLIF(p_description, ''), p_type), NULLIF(p_reference, ''),
    'approved', auth.uid(), auth.uid(), now()
  ) RETURNING id INTO new_transaction_id;

  RETURN new_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_record_petty_cash_expense(uuid, date, numeric, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_record_petty_cash_movement(uuid, date, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accounting_record_petty_cash_expense(uuid, date, numeric, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_record_petty_cash_movement(uuid, date, text, numeric, text, text) TO authenticated;

COMMIT;
