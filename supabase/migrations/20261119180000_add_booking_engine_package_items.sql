CREATE TABLE IF NOT EXISTS public.booking_engine_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.booking_engine_value_offers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  item_label text,
  size_label text,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  individual_price numeric(12,2),
  complimentary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT package_item_price_check CHECK (
    (complimentary = true AND (individual_price IS NULL OR individual_price = 0))
    OR (complimentary = false AND individual_price IS NOT NULL AND individual_price >= 0)
  )
);
CREATE INDEX IF NOT EXISTS booking_engine_package_items_offer_order_idx
  ON public.booking_engine_package_items(offer_id, active, display_order);
ALTER TABLE public.booking_engine_package_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_package_items_admin_all ON public.booking_engine_package_items;
CREATE POLICY booking_package_items_admin_all
  ON public.booking_engine_package_items FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
DROP POLICY IF EXISTS booking_package_items_public_read ON public.booking_engine_package_items;
CREATE POLICY booking_package_items_public_read
  ON public.booking_engine_package_items FOR SELECT TO anon, authenticated
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.booking_engine_value_offers o
    WHERE o.id = booking_engine_package_items.offer_id
      AND o.offer_type = 'package' AND o.active = true
      AND (o.starts_at IS NULL OR o.starts_at <= now())
      AND (o.ends_at IS NULL OR o.ends_at > now())
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_engine_package_items TO authenticated;
GRANT SELECT ON public.booking_engine_package_items TO anon;
COMMENT ON TABLE public.booking_engine_package_items IS 'Admin-configured service, size, quantity and package-specific price inclusions for Booking Engine packages. Does not alter catalogue service prices.';
