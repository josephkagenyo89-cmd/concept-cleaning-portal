
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('agent', 'admin', 'super_admin');

-- 2. Create booking_status enum
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- 3. Create agent_status enum
CREATE TYPE public.agent_status AS ENUM ('pending', 'approved', 'suspended');

-- 4. Create payout_status enum
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected');

-- 5. Create ledger_type enum
CREATE TYPE public.ledger_type AS ENUM ('credit', 'debit');

-- 6. Create commission_tier enum
CREATE TYPE public.commission_tier AS ENUM ('bronze', 'silver', 'gold');

-- ==================== TABLES ====================

-- profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  town_estate TEXT NOT NULL,
  mpesa_number TEXT NOT NULL,
  referral_code TEXT,
  status public.agent_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  location TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id),
  service_date DATE NOT NULL,
  price NUMERIC NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- commissions table
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  tier_at_time public.commission_tier NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- wallet_ledger table
CREATE TABLE public.wallet_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ledger_type NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

-- payout_requests table
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==================== HELPER FUNCTIONS ====================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_profile_status(_user_id UUID)
RETURNS public.agent_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.profiles WHERE user_id = _user_id
$$;

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile and assign agent role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, town_estate, mpesa_number, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'town_estate', ''),
    COALESCE(NEW.raw_user_meta_data->>'mpesa_number', ''),
    NEW.raw_user_meta_data->>'referral_code'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== RLS POLICIES ====================

-- profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.is_admin_or_super(auth.uid()));

-- user_roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin_or_super(auth.uid()));

-- services policies
CREATE POLICY "Anyone authenticated can view active services" ON public.services FOR SELECT USING (is_active = true OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can manage services" ON public.services FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can update services" ON public.services FOR UPDATE USING (public.is_admin_or_super(auth.uid()));

-- bookings policies
CREATE POLICY "Agents can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Approved agents can create bookings" ON public.bookings FOR INSERT WITH CHECK (
  auth.uid() = agent_id AND public.has_role(auth.uid(), 'agent') AND public.get_profile_status(auth.uid()) = 'approved'
);
CREATE POLICY "Admins can update bookings" ON public.bookings FOR UPDATE USING (public.is_admin_or_super(auth.uid()));

-- commissions policies
CREATE POLICY "Agents can view own commissions" ON public.commissions FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Admins can view all commissions" ON public.commissions FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert commissions" ON public.commissions FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));

-- wallet_ledger policies
CREATE POLICY "Agents can view own ledger" ON public.wallet_ledger FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Admins can view all ledger" ON public.wallet_ledger FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert ledger" ON public.wallet_ledger FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));

-- payout_requests policies
CREATE POLICY "Agents can view own payouts" ON public.payout_requests FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Admins can view all payouts" ON public.payout_requests FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Agents can request payouts" ON public.payout_requests FOR INSERT WITH CHECK (
  auth.uid() = agent_id AND public.has_role(auth.uid(), 'agent')
);
CREATE POLICY "Admins can update payouts" ON public.payout_requests FOR UPDATE USING (public.is_admin_or_super(auth.uid()));

-- audit_logs policies
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));
