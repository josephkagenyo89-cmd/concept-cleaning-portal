
-- Services table (dynamic from admin)
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Cleaning',
  price_type TEXT NOT NULL DEFAULT 'fixed',
  price_value NUMERIC NOT NULL DEFAULT 0,
  price_max NUMERIC,
  image_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Anyone can insert services" ON public.services FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update services" ON public.services FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete services" ON public.services FOR DELETE USING (true);

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view suppliers" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update suppliers" ON public.suppliers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete suppliers" ON public.suppliers FOR DELETE USING (true);

-- LPOs table
CREATE TABLE public.lpos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lpo_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id),
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft',
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT
);

ALTER TABLE public.lpos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lpos" ON public.lpos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert lpos" ON public.lpos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lpos" ON public.lpos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete lpos" ON public.lpos FOR DELETE USING (true);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'General',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  lpo_id UUID REFERENCES public.lpos(id),
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert expenses" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update expenses" ON public.expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete expenses" ON public.expenses FOR DELETE USING (true);

-- Staff table
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Cleaner',
  status TEXT NOT NULL DEFAULT 'Active',
  id_number TEXT,
  date_joined DATE DEFAULT CURRENT_DATE,
  notes TEXT
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staff" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staff" ON public.staff FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete staff" ON public.staff FOR DELETE USING (true);

-- Job assignments
CREATE TABLE public.job_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  booking_id UUID REFERENCES public.bookings(id),
  staff_id UUID REFERENCES public.staff(id),
  notes TEXT
);

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view job_assignments" ON public.job_assignments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert job_assignments" ON public.job_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update job_assignments" ON public.job_assignments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete job_assignments" ON public.job_assignments FOR DELETE USING (true);

-- Quotations table
CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  quotation_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id),
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft',
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  valid_until DATE,
  notes TEXT
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quotations" ON public.quotations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert quotations" ON public.quotations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update quotations" ON public.quotations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete quotations" ON public.quotations FOR DELETE USING (true);

-- Add approval_status to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Pending';

-- Add assigned_staff to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES public.staff(id);

-- Seed default services
INSERT INTO public.services (name, slug, description, category, price_type, price_value, sort_order) VALUES
('Home Cleaning', 'home-cleaning', 'Regular home cleaning to keep your space spotless. We handle dusting, mopping, sanitizing surfaces, and organizing every room.', 'Cleaning', 'fixed', 3000, 1),
('Deep Cleaning', 'deep-cleaning', 'Intensive deep cleaning that reaches every corner. Perfect for move-in/move-out or seasonal refreshes.', 'Cleaning', 'fixed', 8000, 2),
('Carpet & Sofa Cleaning', 'carpet-sofa-cleaning', 'Professional carpet and upholstery cleaning using industry-grade equipment. Removes stains, allergens, and odors.', 'Cleaning', 'fixed', 4000, 3),
('Car Detailing', 'car-detailing', 'Complete interior and exterior car detailing. From wash and wax to full interior restoration.', 'Car Detailing', 'fixed', 5000, 4),
('Cabro Cleaning', 'cabro-cleaning', 'Restore your paving blocks to their original glory. High-pressure cleaning that removes dirt, moss, and stains.', 'Cleaning', 'range', 6000, 5),
('Wall & Algae Cleaning', 'wall-algae-cleaning', 'Professional wall cleaning and algae removal. We restore walls to a clean, fresh appearance.', 'Maintenance', 'fixed', 5000, 6),
('Fumigation', 'fumigation', 'Safe and effective pest control fumigation for homes and offices. Eliminates insects and rodents.', 'Fumigation', 'fixed', 4000, 7);
