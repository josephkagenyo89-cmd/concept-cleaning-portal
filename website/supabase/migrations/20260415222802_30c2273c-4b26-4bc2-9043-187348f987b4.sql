
-- Add additional images to products
ALTER TABLE public.products ADD COLUMN additional_images text[] DEFAULT '{}';

-- Create orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_location text NOT NULL,
  delivery_zone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_total numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

-- Create delivery zones table
CREATE TABLE public.delivery_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_name text NOT NULL,
  areas text[] NOT NULL DEFAULT '{}',
  fee numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view delivery zones" ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY "Anyone can manage delivery zones" ON public.delivery_zones FOR ALL USING (true) WITH CHECK (true);

-- Seed delivery zones
INSERT INTO public.delivery_zones (zone_name, areas, fee) VALUES
  ('Zone 1', ARRAY['Nairobi CBD', 'Westlands', 'Kilimani'], 200),
  ('Zone 2', ARRAY['Ruaka', 'Kileleshwa', 'Lavington'], 300),
  ('Zone 3', ARRAY['Ruiru', 'Kitengela', 'Syokimau', 'Athi River'], 450);
