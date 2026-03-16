
-- Quotations table
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  service_name text NOT NULL,
  service_date date,
  price numeric NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_by_role text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sequence for quotation numbers
CREATE SEQUENCE public.quotation_number_seq START WITH 1001;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own quotations" ON public.quotations FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Agents can create quotations" ON public.quotations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can view all quotations" ON public.quotations FOR SELECT USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can create quotations" ON public.quotations FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins can delete quotations" ON public.quotations FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

-- Add creator tracking to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_by_role text DEFAULT 'agent';
