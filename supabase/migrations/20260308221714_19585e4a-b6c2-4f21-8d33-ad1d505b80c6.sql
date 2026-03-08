
-- SMTP settings table (single-row config)
CREATE TABLE public.smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_user text NOT NULL DEFAULT '',
  smtp_pass text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'Concept Cleaning Services',
  from_email text NOT NULL DEFAULT '',
  use_tls boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage SMTP settings
CREATE POLICY "Admins can view smtp settings" ON public.smtp_settings
  FOR SELECT TO authenticated
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert smtp settings" ON public.smtp_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update smtp settings" ON public.smtp_settings
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()));
