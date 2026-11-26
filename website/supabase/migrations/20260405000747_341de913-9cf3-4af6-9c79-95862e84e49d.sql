
-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Portfolio posts table
CREATE TABLE public.portfolio_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  location TEXT,
  before_image_url TEXT,
  after_image_url TEXT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequences for auto-numbering
CREATE SEQUENCE public.booking_number_seq START 1;
CREATE SEQUENCE public.invoice_number_seq START 1;

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_posts ENABLE ROW LEVEL SECURITY;

-- Public read access for portfolio_posts (public website)
CREATE POLICY "Anyone can view portfolio posts" ON public.portfolio_posts FOR SELECT USING (true);

-- Public insert for bookings and clients (booking form)
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create clients" ON public.clients FOR INSERT WITH CHECK (true);

-- Public read for bookings (for booking confirmation)
CREATE POLICY "Anyone can view bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Anyone can view clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Anyone can view invoices" ON public.invoices FOR SELECT USING (true);

-- Public update/delete/insert for admin (simplified - no auth for now)
CREATE POLICY "Anyone can update bookings" ON public.bookings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update invoices" ON public.invoices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can insert portfolio" ON public.portfolio_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update portfolio" ON public.portfolio_posts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete portfolio" ON public.portfolio_posts FOR DELETE USING (true);

-- Enable realtime for portfolio
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_posts;

-- Storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true);

-- Storage policies
CREATE POLICY "Anyone can upload portfolio images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio');
CREATE POLICY "Anyone can view portfolio images" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio');
CREATE POLICY "Anyone can delete portfolio images" ON storage.objects FOR DELETE USING (bucket_id = 'portfolio');
