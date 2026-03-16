
-- Income records table
CREATE TABLE public.income_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  description TEXT,
  service TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  source TEXT NOT NULL DEFAULT 'client_payment',
  booking_id UUID REFERENCES public.bookings(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.income_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view income" ON public.income_records FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert income" ON public.income_records FOR INSERT TO authenticated WITH CHECK (is_admin_or_super(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Admins can update income" ON public.income_records FOR UPDATE TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete income" ON public.income_records FOR DELETE TO authenticated USING (is_admin_or_super(auth.uid()));

-- Expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view expenses" ON public.expenses FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (is_admin_or_super(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Admins can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (is_admin_or_super(auth.uid()));

-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  booking_id UUID REFERENCES public.bookings(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  service TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoices" ON public.invoices FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (is_admin_or_super(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Admins can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));
