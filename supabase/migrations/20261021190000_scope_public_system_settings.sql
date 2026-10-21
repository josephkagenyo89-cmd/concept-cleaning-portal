-- Limit settings visible to customer accounts to explicitly public categories.
-- Staff roles retain access to all operational settings.
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.system_settings;

CREATE POLICY "Public can view approved public settings"
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (category IN ('general', 'discount', 'integrations', 'document'));

CREATE POLICY "Staff can view operational settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'agent'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);
