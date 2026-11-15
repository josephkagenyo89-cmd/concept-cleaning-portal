
ALTER TABLE public.accounting_financial_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accounting admins manage financial years" ON public.accounting_financial_years;
CREATE POLICY "Accounting admins manage financial years"
ON public.accounting_financial_years
FOR ALL TO authenticated
USING(public.is_admin_or_super(auth.uid()))
WITH CHECK(public.is_admin_or_super(auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.accounting_financial_years TO authenticated;
