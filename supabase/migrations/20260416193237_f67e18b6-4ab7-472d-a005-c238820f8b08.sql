CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
ON public.system_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can insert settings"
ON public.system_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can update settings"
ON public.system_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can delete settings"
ON public.system_settings FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();

  -- Skip audit when there is no authenticated user (e.g. seed migrations)
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, details)
    VALUES (
      auth.uid(),
      CASE WHEN TG_OP = 'INSERT' THEN 'settings.create' ELSE 'settings.update' END,
      'system_settings',
      NEW.id,
      jsonb_build_object(
        'category', NEW.category,
        'old_value', CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
        'new_value', NEW.value
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_settings_change ON public.system_settings;
CREATE TRIGGER trg_log_settings_change
BEFORE INSERT OR UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();

INSERT INTO public.system_settings (category, value) VALUES
  ('general', jsonb_build_object(
    'company_name', 'Concept Cleaning Services',
    'phone', '+254796563741',
    'email', 'info@conceptcleaning.co.ke',
    'address', 'Nairobi, Kenya',
    'website', 'https://conceptcleaning.co.ke',
    'logo_url', ''
  )),
  ('document', jsonb_build_object(
    'primary_color', '#2A9D8F',
    'footer_text', 'Thank you for choosing Concept Cleaning Services.',
    'terms_conditions', E'1. Payment due on receipt unless agreed otherwise.\n2. All services are guaranteed for 7 days.\n3. Cancellations require 24-hour notice.'
  )),
  ('tax', jsonb_build_object('vat_enabled', false, 'vat_percentage', 16)),
  ('payment', jsonb_build_object(
    'mpesa_paybill', '', 'mpesa_till', '', 'mpesa_account', '',
    'bank_name', '', 'bank_account_name', '', 'bank_account_number', '', 'bank_branch', ''
  )),
  ('commission', jsonb_build_object('type', 'tiered', 'fixed_amount', 0, 'percentage', 10)),
  ('crm', jsonb_build_object('vip_threshold', 50000, 'inactive_days', 30, 'followup_days', 14)),
  ('system', jsonb_build_object('currency', 'Ksh', 'date_format', 'DD/MM/YYYY', 'auto_numbering', true)),
  ('notifications', jsonb_build_object(
    'whatsapp_signature_template', 'Hello {client_name}, thank you for choosing Concept Cleaning Services. Your service is complete. Please confirm and sign here: {link}',
    'whatsapp_invoice_template', 'Hello {client_name}, please find your invoice {invoice_number} for Ksh {amount}.',
    'whatsapp_quotation_template', 'Hello {client_name}, here is your quotation {quotation_number} for Ksh {amount}.'
  ))
ON CONFLICT (category) DO NOTHING;