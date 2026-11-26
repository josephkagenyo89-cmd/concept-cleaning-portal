
-- Admin settings table for global config like discount
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert settings" ON public.admin_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.admin_settings FOR UPDATE USING (true) WITH CHECK (true);

-- Seed default discount
INSERT INTO public.admin_settings (key, value) VALUES ('discount_percentage', '0');

-- Add approval tracking columns
ALTER TABLE public.invoices ADD COLUMN approved_by text DEFAULT NULL;
ALTER TABLE public.invoices ADD COLUMN approved_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.quotations ADD COLUMN approved_by text DEFAULT NULL;
ALTER TABLE public.quotations ADD COLUMN approved_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.lpos ADD COLUMN approved_by text DEFAULT NULL;
ALTER TABLE public.lpos ADD COLUMN approved_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.expenses ADD COLUMN approved_by text DEFAULT NULL;
ALTER TABLE public.expenses ADD COLUMN approved_at timestamp with time zone DEFAULT NULL;
