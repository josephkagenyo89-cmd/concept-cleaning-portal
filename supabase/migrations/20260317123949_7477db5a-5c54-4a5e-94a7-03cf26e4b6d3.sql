
-- Documents table for all generated documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL,
  document_type text NOT NULL DEFAULT 'quotation',
  client_name text,
  staff_name text,
  client_phone text,
  client_location text,
  department text,
  payment_reason text,
  service_name text,
  quantity text,
  unit_price numeric,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  payment_status text,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_by_role text NOT NULL DEFAULT 'agent',
  booking_id uuid REFERENCES public.bookings(id),
  invoice_id uuid REFERENCES public.invoices(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sequences for each document type
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.fuel_voucher_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.salary_voucher_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.expense_voucher_number_seq START WITH 1001;

-- Functions to get next numbers
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CCS-INV-' || nextval('public.invoice_number_seq')::text
$$;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CCS-RCP-' || nextval('public.receipt_number_seq')::text
$$;

CREATE OR REPLACE FUNCTION public.next_fuel_voucher_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CCS-FUEL-' || nextval('public.fuel_voucher_number_seq')::text
$$;

CREATE OR REPLACE FUNCTION public.next_salary_voucher_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CCS-SAL-' || nextval('public.salary_voucher_number_seq')::text
$$;

CREATE OR REPLACE FUNCTION public.next_expense_voucher_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CCS-EXP-' || nextval('public.expense_voucher_number_seq')::text
$$;

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all documents" ON public.documents
  FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can create documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_super(auth.uid()) OR auth.uid() = created_by);

CREATE POLICY "Agents can view own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Super admins can delete documents" ON public.documents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));
