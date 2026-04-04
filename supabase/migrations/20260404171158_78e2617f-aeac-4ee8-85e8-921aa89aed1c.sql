
-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  total_spend NUMERIC NOT NULL DEFAULT 0,
  booking_count INTEGER NOT NULL DEFAULT 0,
  last_booking_date DATE,
  created_by UUID NOT NULL,
  created_by_role TEXT NOT NULL DEFAULT 'agent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT clients_phone_unique UNIQUE (phone)
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all clients" ON public.clients FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (is_admin_or_super(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "Admins can update clients" ON public.clients FOR UPDATE TO authenticated USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Agents can view own clients" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = created_by);

-- Add client_id to bookings
ALTER TABLE public.bookings ADD COLUMN client_id UUID REFERENCES public.clients(id);
