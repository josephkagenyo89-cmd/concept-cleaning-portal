
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_duration text,
  ADD COLUMN IF NOT EXISTS service_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS short_description text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);

-- Helper: is the current user a staff member?
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- Helper: does this client row belong to the current user?
CREATE OR REPLACE FUNCTION public.owns_client(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND user_id = _user_id)
$$;

-- Customers sign up without staff roles/profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'customer' THEN
    INSERT INTO public.clients (full_name, phone, whatsapp_number, location, status, created_by, created_by_role, user_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'location', ''),
      'new',
      NEW.id,
      'customer',
      NEW.id
    );
    RETURN NEW;
  END IF;

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
$function$;

-- Public browsing of the service catalogue
GRANT SELECT ON public.services TO anon;
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
CREATE POLICY "Anyone can view active services"
ON public.services FOR SELECT TO anon, authenticated
USING (is_active = true);

-- Customers: own client record
DROP POLICY IF EXISTS "Customers can view own client record" ON public.clients;
CREATE POLICY "Customers can view own client record"
ON public.clients FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own client record" ON public.clients;
CREATE POLICY "Customers can update own client record"
ON public.clients FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Customers: bookings
DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;
CREATE POLICY "Customers can view own bookings"
ON public.bookings FOR SELECT TO authenticated
USING (public.owns_client(client_id, auth.uid()));

DROP POLICY IF EXISTS "Customers can create own bookings" ON public.bookings;
CREATE POLICY "Customers can create own bookings"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND public.owns_client(client_id, auth.uid())
  AND agent_id = auth.uid()
);

-- Customers: quotations
DROP POLICY IF EXISTS "Customers can view own quotations" ON public.quotations;
CREATE POLICY "Customers can view own quotations"
ON public.quotations FOR SELECT TO authenticated
USING (created_by = auth.uid() AND created_by_role = 'customer');

DROP POLICY IF EXISTS "Customers can request quotations" ON public.quotations;
CREATE POLICY "Customers can request quotations"
ON public.quotations FOR INSERT TO authenticated
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND created_by = auth.uid()
  AND created_by_role = 'customer'
);

-- Customers: invoices, documents (receipts), certificates
DROP POLICY IF EXISTS "Customers can view own invoices" ON public.invoices;
CREATE POLICY "Customers can view own invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.owns_client(client_id, auth.uid()));

DROP POLICY IF EXISTS "Customers can view own documents" ON public.documents;
CREATE POLICY "Customers can view own documents"
ON public.documents FOR SELECT TO authenticated
USING (public.owns_client(client_id, auth.uid()));

DROP POLICY IF EXISTS "Customers can view own certificates" ON public.service_certificates;
CREATE POLICY "Customers can view own certificates"
ON public.service_certificates FOR SELECT TO authenticated
USING (public.owns_client(client_id, auth.uid()));

-- Customers: feedback
DROP POLICY IF EXISTS "Customers can view own feedback" ON public.customer_feedback;
CREATE POLICY "Customers can view own feedback"
ON public.customer_feedback FOR SELECT TO authenticated
USING (submitted_by = auth.uid());
