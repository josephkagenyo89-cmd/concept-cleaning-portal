-- Sponsored campaigns are additive to the existing Booking Engine offer catalogue.
-- No existing services, bookings, quotations, customers, or accounting rows are modified.

CREATE TABLE IF NOT EXISTS public.sponsored_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL UNIQUE,
  owner_type text NOT NULL CHECK (owner_type IN ('concept','third_party')),
  provider_name text,
  provider_email text,
  provider_phone text,
  title text NOT NULL,
  description text,
  destination_url text,
  creative_image_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','paused','rejected','completed','cancelled')),
  billing_model text NOT NULL DEFAULT 'none'
    CHECK (billing_model IN ('none','fixed','cpc','cpm')),
  budget_amount numeric(12,2),
  agreed_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  billing_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (billing_status IN ('not_applicable','not_invoiced','invoiced','partially_paid','paid','overdue','waived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsored_campaign_owner_provider_check CHECK (
    (owner_type = 'concept' AND provider_name IS NULL AND billing_model = 'none'
      AND billing_status = 'not_applicable')
    OR
    (owner_type = 'third_party' AND length(trim(coalesce(provider_name,''))) > 0
      AND billing_model IN ('fixed','cpc','cpm')
      AND billing_status <> 'not_applicable')
  ),
  CONSTRAINT sponsored_campaign_amounts_check CHECK (
    (budget_amount IS NULL OR budget_amount >= 0)
    AND (agreed_amount IS NULL OR agreed_amount >= 0)
  ),
  CONSTRAINT sponsored_campaign_dates_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  )
);

CREATE TABLE IF NOT EXISTS public.sponsored_campaign_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sponsored_campaigns(id) ON DELETE CASCADE,
  placement_key text NOT NULL CHECK (placement_key IN ('homepage_featured','marketplace_featured','category_featured','search_featured')),
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  display_label text NOT NULL DEFAULT 'Sponsored',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsored_placement_category_scope CHECK (
    (placement_key = 'category_featured' AND category_id IS NOT NULL)
    OR (placement_key <> 'category_featured' AND category_id IS NULL)
  ),
  CONSTRAINT sponsored_placement_service_scope CHECK (
    placement_key IN ('marketplace_featured','category_featured','search_featured')
    OR service_id IS NULL
  )
);

CREATE TABLE IF NOT EXISTS public.sponsored_campaign_billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sponsored_campaigns(id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN ('invoice','payment','credit_note','adjustment')),
  reference_number text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('draft','issued','partially_paid','paid','void','recorded')),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_type, reference_number)
);

CREATE TABLE IF NOT EXISTS public.sponsored_campaign_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.sponsored_campaigns(id) ON DELETE CASCADE,
  placement_id uuid REFERENCES public.sponsored_campaign_placements(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('impression','click','conversion')),
  session_key text,
  source_path text,
  booking_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsored_campaigns_status_dates_idx
  ON public.sponsored_campaigns(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS sponsored_placements_campaign_active_idx
  ON public.sponsored_campaign_placements(campaign_id, active, placement_key, display_order);
CREATE INDEX IF NOT EXISTS sponsored_events_campaign_type_date_idx
  ON public.sponsored_campaign_events(campaign_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS sponsored_billing_campaign_date_idx
  ON public.sponsored_campaign_billing_records(campaign_id, created_at);

ALTER TABLE public.sponsored_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_campaign_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_campaign_billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_campaign_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsored_campaigns_admin_all ON public.sponsored_campaigns;
CREATE POLICY sponsored_campaigns_admin_all ON public.sponsored_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS sponsored_placements_admin_all ON public.sponsored_campaign_placements;
CREATE POLICY sponsored_placements_admin_all ON public.sponsored_campaign_placements
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS sponsored_billing_admin_all ON public.sponsored_campaign_billing_records;
CREATE POLICY sponsored_billing_admin_all ON public.sponsored_campaign_billing_records
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS sponsored_events_admin_read ON public.sponsored_campaign_events;
CREATE POLICY sponsored_events_admin_read ON public.sponsored_campaign_events
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- Public read access is limited to approved, in-window campaigns and active placements.
DROP POLICY IF EXISTS sponsored_campaigns_public_read ON public.sponsored_campaigns;
CREATE POLICY sponsored_campaigns_public_read ON public.sponsored_campaigns
  FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS sponsored_placements_public_read ON public.sponsored_campaign_placements;
CREATE POLICY sponsored_placements_public_read ON public.sponsored_campaign_placements
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.sponsored_campaigns c
      WHERE c.id = sponsored_campaign_placements.campaign_id
        AND c.status = 'approved'
        AND (c.starts_at IS NULL OR c.starts_at <= now())
        AND (c.ends_at IS NULL OR c.ends_at > now())
    )
  );

REVOKE ALL ON public.sponsored_campaigns FROM anon;
REVOKE ALL ON public.sponsored_campaign_placements FROM anon;
REVOKE ALL ON public.sponsored_campaign_billing_records FROM anon, authenticated;
REVOKE ALL ON public.sponsored_campaign_events FROM anon, authenticated;
GRANT SELECT (id, title, description, destination_url, creative_image_url, starts_at, ends_at, currency, status)
  ON public.sponsored_campaigns TO anon;
GRANT SELECT ON public.sponsored_campaigns, public.sponsored_campaign_placements TO authenticated;
GRANT SELECT ON public.sponsored_campaign_placements TO anon;
GRANT INSERT, UPDATE, DELETE ON public.sponsored_campaigns, public.sponsored_campaign_placements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsored_campaign_billing_records TO authenticated;
GRANT SELECT ON public.sponsored_campaign_events TO authenticated;

COMMENT ON TABLE public.sponsored_campaigns IS 'Admin-managed Concept and third-party sponsored campaign records; separate from organic services and value offers.';
COMMENT ON TABLE public.sponsored_campaign_placements IS 'Optional, disabled-by-default sponsored placements; public website must opt in to render these.';
COMMENT ON TABLE public.sponsored_campaign_billing_records IS 'Provider campaign billing ledger, intentionally separate from customer invoices and accounting income.';
COMMENT ON TABLE public.sponsored_campaign_events IS 'Campaign attribution events. Writes are reserved for a trusted tracking endpoint; browser roles cannot insert events.';
