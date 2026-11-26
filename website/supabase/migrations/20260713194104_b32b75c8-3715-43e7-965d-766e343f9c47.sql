
-- ============ PROPERTIES ============
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Home',
  county TEXT,
  estate TEXT,
  address TEXT,
  maps_url TEXT,
  bedrooms INTEGER,
  floors INTEGER,
  parking_notes TEXT,
  gate_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own properties" ON public.properties
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all properties" ON public.properties
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ASSETS ============
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room TEXT,
  category TEXT,
  name TEXT NOT NULL,
  size TEXT,
  material TEXT,
  last_cleaned_at DATE,
  next_recommended_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assets" ON public.assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all assets" ON public.assets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ASSET SERVICE HISTORY ============
CREATE TABLE public.asset_service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cleaned_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_service_history TO authenticated;
GRANT ALL ON public.asset_service_history TO service_role;
ALTER TABLE public.asset_service_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own asset history" ON public.asset_service_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own asset history" ON public.asset_service_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all asset history" ON public.asset_service_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ BOOKING DRAFTS ============
CREATE TABLE public.booking_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  step INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_drafts TO authenticated;
GRANT ALL ON public.booking_drafts TO service_role;
ALTER TABLE public.booking_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drafts" ON public.booking_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_booking_drafts_updated_at BEFORE UPDATE ON public.booking_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXTEND BOOKINGS ============
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS tracker_stage TEXT DEFAULT 'Received',
  ADD COLUMN IF NOT EXISTS tracker_events JSONB DEFAULT '[]'::jsonb;
