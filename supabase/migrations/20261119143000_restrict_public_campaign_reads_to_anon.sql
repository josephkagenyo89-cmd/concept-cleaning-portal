-- Authenticated customers must not inherit public campaign reads of private provider fields.
-- The public campaign renderer will use the anonymous role; admins retain access through the admin policy.
DROP POLICY IF EXISTS sponsored_campaigns_public_read ON public.sponsored_campaigns;
CREATE POLICY sponsored_campaigns_public_read ON public.sponsored_campaigns
  FOR SELECT TO anon
  USING (status = 'approved' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
DROP POLICY IF EXISTS sponsored_placements_public_read ON public.sponsored_campaign_placements;
CREATE POLICY sponsored_placements_public_read ON public.sponsored_campaign_placements
  FOR SELECT TO anon
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.sponsored_campaigns c
    WHERE c.id = sponsored_campaign_placements.campaign_id
      AND c.status = 'approved'
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
  ));
