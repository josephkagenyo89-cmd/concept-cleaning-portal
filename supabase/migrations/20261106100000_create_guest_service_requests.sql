CREATE TABLE IF NOT EXISTS public.guest_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_reference text NOT NULL UNIQUE
    DEFAULT (
      'GREQ-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
    ),
  request_type text NOT NULL
    CHECK (request_type IN ('booking', 'quotation')),
  service_id text NOT NULL,
  service_name text NOT NULL,
  service_category text,
  customer_name text,
  customer_phone text NOT NULL,
  customer_notes text,
  location text NOT NULL,
  preferred_date date NOT NULL,
  preferred_time time NOT NULL,
  size_sqm numeric CHECK (size_sqm IS NULL OR size_sqm > 0),
  estimated_amount numeric NOT NULL DEFAULT 0
    CHECK (estimated_amount >= 0),
  discount_amount numeric NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'contacted', 'converted_to_lead', 'rejected', 'closed')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  converted_at timestamptz,
  converted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_notes text,
  CONSTRAINT guest_request_conversion_consistency CHECK (
    (status = 'converted_to_lead' AND lead_id IS NOT NULL)
    OR status <> 'converted_to_lead'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_service_requests_created_at
  ON public.guest_service_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_service_requests_status
  ON public.guest_service_requests (status);

CREATE INDEX IF NOT EXISTS idx_guest_service_requests_phone
  ON public.guest_service_requests (customer_phone);

CREATE INDEX IF NOT EXISTS idx_guest_service_requests_lead
  ON public.guest_service_requests (lead_id);

ALTER TABLE public.guest_service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view guest service requests"
  ON public.guest_service_requests;

CREATE POLICY "Admins can view guest service requests"
  ON public.guest_service_requests
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can update guest service requests"
  ON public.guest_service_requests;

CREATE POLICY "Admins can update guest service requests"
  ON public.guest_service_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

REVOKE ALL ON public.guest_service_requests FROM anon, authenticated;
GRANT SELECT ON public.guest_service_requests TO authenticated;
GRANT UPDATE (
  status,
  internal_notes,
  updated_at,
  lead_id,
  converted_at,
  converted_by
)
  ON public.guest_service_requests TO authenticated;
GRANT ALL ON TABLE public.guest_service_requests TO service_role;

COMMENT ON TABLE public.guest_service_requests IS
  'Public landing-page guest booking and quotation enquiries. These are not confirmed ERP bookings.';

-- Private rate-limit storage for the public guest submission endpoint.
CREATE TABLE IF NOT EXISTS public.guest_service_request_rate_limits (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_service_request_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.guest_service_request_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guest_service_request_rate_limits TO service_role;

-- Atomically count submissions per hashed IP in a fixed time window.
CREATE OR REPLACE FUNCTION public.consume_guest_service_request_rate_limit(
  p_ip_hash text,
  p_max_requests integer DEFAULT 5,
  p_window_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_count integer;
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$'
     OR p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 100
     OR p_window_seconds IS NULL OR p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters.';
  END IF;

  INSERT INTO public.guest_service_request_rate_limits AS limits (
    ip_hash, window_started_at, request_count, updated_at
  )
  VALUES (p_ip_hash, now(), 1, now())
  ON CONFLICT (ip_hash) DO UPDATE
    SET window_started_at = CASE
          WHEN limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          THEN now()
          ELSE limits.window_started_at
        END,
        request_count = CASE
          WHEN limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          THEN 1
          ELSE limits.request_count + 1
        END,
        updated_at = now()
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_guest_service_request_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_service_request_rate_limit(text, integer, integer)
  TO service_role;

COMMENT ON TABLE public.guest_service_request_rate_limits IS
  'Private keyed-IP-hash counters for rate limiting public guest service submissions.';

-- Convert an approved guest enquiry into a CRM lead.
-- The row lock and single transaction prevent duplicate conversion of one request.
CREATE OR REPLACE FUNCTION public.convert_guest_service_request_to_lead(
  p_request_id uuid
)
RETURNS TABLE (
  request_id uuid,
  lead_id uuid,
  lead_code text,
  reused_existing_lead boolean,
  already_converted boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.guest_service_requests%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_reused boolean := false;
  v_service_id uuid;
  v_normalized_phone text;
  v_activity_description text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'You are not authorized to convert guest requests.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_request
    FROM public.guest_service_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest request not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_request.status = 'converted_to_lead' AND v_request.lead_id IS NOT NULL THEN
    SELECT * INTO v_lead
      FROM public.leads
     WHERE id = v_request.lead_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The linked CRM lead could not be found.';
    END IF;

    RETURN QUERY
      SELECT v_request.id, v_lead.id, v_lead.lead_code, false, true;
    RETURN;
  END IF;

  IF v_request.lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'This guest request is already linked to a CRM lead.';
  END IF;

  IF v_request.status IN ('rejected', 'closed') THEN
    RAISE EXCEPTION 'Rejected or closed guest requests cannot be converted.';
  END IF;

  IF v_request.customer_phone IS NULL OR btrim(v_request.customer_phone) = '' THEN
    RAISE EXCEPTION 'A phone number is required before conversion.';
  END IF;

  v_normalized_phone := regexp_replace(v_request.customer_phone, '[^0-9]', '', 'g');

  -- Match the existing CRM normalizePhone() rules for Kenyan numbers.
  IF left(v_normalized_phone, 3) = '254' THEN
    NULL;
  ELSIF left(v_normalized_phone, 1) = '0' THEN
    v_normalized_phone := '254' || substr(v_normalized_phone, 2);
  ELSIF length(v_normalized_phone) = 9 THEN
    v_normalized_phone := '254' || v_normalized_phone;
  END IF;

  -- Serialize conversions for the same normalized phone across different requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_normalized_phone, 0));

  -- Keep the CRM service reference only when the service still exists.
  -- A deleted service must not prevent guest request conversion.
  v_service_id := NULL;

  IF v_request.service_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT s.id
      INTO v_service_id
      FROM public.services AS s
     WHERE s.id = v_request.service_id::uuid;
  END IF;

  -- Reuse the most recently created lead with the same normalized phone number.
  SELECT l.*
    INTO v_lead
    FROM public.leads AS l
   WHERE (
           CASE
             WHEN left(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 3) = '254'
               THEN regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
             WHEN left(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 1) = '0'
               THEN '254' || substr(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 2)
             WHEN length(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')) = 9
               THEN '254' || regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
             ELSE regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
           END
         ) = v_normalized_phone
     AND regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') <> ''
   ORDER BY l.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    v_reused := true;
  ELSE
    INSERT INTO public.leads (
      full_name,
      phone,
      whatsapp_number,
      location,
      service_interest,
      service_id,
      source,
      status,
      estimated_value,
      notes,
      created_by
    ) VALUES (
      coalesce(nullif(btrim(v_request.customer_name), ''), 'Guest enquiry'),
      v_request.customer_phone,
      v_request.customer_phone,
      v_request.location,
      v_request.service_name,
      v_service_id,
      'guest_service_request',
      'new',
      v_request.estimated_amount,
      format(
        'Created from guest request %s (%s). Preferred date: %s; preferred time: %s; area: %s sq m; indicative estimate: %s KES; discount: %s KES.',
        v_request.request_reference,
        v_request.request_type,
        v_request.preferred_date,
        v_request.preferred_time,
        coalesce(v_request.size_sqm::text, 'not provided'),
        v_request.estimated_amount,
        v_request.discount_amount
      ),
      auth.uid()
    )
    RETURNING * INTO v_lead;
  END IF;

  v_activity_description := format(
    'Guest request %s was converted into this CRM lead. Request type: %s. Service: %s. Location: %s. Preferred date: %s. Preferred time: %s. Area: %s sq m. Indicative estimate: %s KES. Discount: %s KES. %s',
    v_request.request_reference,
    v_request.request_type,
    v_request.service_name,
    v_request.location,
    v_request.preferred_date,
    v_request.preferred_time,
    coalesce(v_request.size_sqm::text, 'not provided'),
    v_request.estimated_amount,
    v_request.discount_amount,
    CASE WHEN v_reused THEN 'An existing lead with the same phone number was reused.'
         ELSE 'A new CRM lead was created.' END
  );

  INSERT INTO public.crm_activities (
    lead_id,
    activity_type,
    subject,
    description,
    activity_date,
    created_by
  ) VALUES (
    v_lead.id,
    'other',
    'Guest service request received: ' || v_request.request_reference,
    v_activity_description,
    v_request.created_at,
    auth.uid()
  );

  UPDATE public.guest_service_requests
     SET status = 'converted_to_lead',
         lead_id = v_lead.id,
         converted_at = now(),
         converted_by = auth.uid(),
         updated_at = now()
   WHERE id = v_request.id;

  RETURN QUERY
    SELECT v_request.id, v_lead.id, v_lead.lead_code, v_reused, false;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_guest_service_request_to_lead(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_guest_service_request_to_lead(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.convert_guest_service_request_to_lead(uuid) IS
  'Admin-only atomic conversion of a guest service request into a new or existing CRM lead, with CRM activity history.';
