-- Link authenticated Smart Booking conversions into the existing CRM.
-- This is deliberately trigger-based so the existing booking conversion RPC,
-- its pricing snapshots, authorization checks, and idempotency remain unchanged.
-- No existing request is backfilled or modified by this migration.

ALTER TABLE public.booking_engine_requests
  ADD COLUMN IF NOT EXISTS lead_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_engine_requests_lead_id_fkey'
      AND conrelid = 'public.booking_engine_requests'::regclass
  ) THEN
    ALTER TABLE public.booking_engine_requests
      ADD CONSTRAINT booking_engine_requests_lead_id_fkey
      FOREIGN KEY (lead_id)
      REFERENCES public.leads(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_booking_engine_requests_lead_id
  ON public.booking_engine_requests(lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_engine_requests_lead_id
  ON public.booking_engine_requests(lead_id)
  WHERE lead_id IS NOT NULL;

-- Admin CRM screens already expect leads.booking_id. Keep the database
-- migration safe on installations where that link has not yet been added.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS booking_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_booking_id_fkey'
      AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES public.bookings(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_leads_booking_id
  ON public.leads(booking_id);

CREATE OR REPLACE FUNCTION public.link_booking_engine_conversion_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_service_id uuid;
  v_service_name text;
  v_lead_id uuid;
  v_activity_description text;
BEGIN
  -- Only a successful conversion into the existing ERP bookings table
  -- should create a CRM lead.
  IF NEW.status <> 'converted'
     OR NEW.converted_booking_id IS NULL
     OR NEW.lead_id IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_booking
    FROM public.bookings
   WHERE id = NEW.converted_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Smart Booking CRM sync failed: converted ERP booking was not found.';
  END IF;

  SELECT *
    INTO v_client
    FROM public.clients
   WHERE id = NEW.customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Smart Booking CRM sync failed: linked CRM client was not found.';
  END IF;

  SELECT s.id, s.name
    INTO v_service_id, v_service_name
    FROM public.booking_engine_request_items AS ri
    JOIN public.services AS s
      ON s.id = ri.service_id
   WHERE ri.request_id = NEW.id
   ORDER BY ri.display_order, ri.created_at
   LIMIT 1;

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION
      'Smart Booking CRM sync failed: no valid service was found on the request.';
  END IF;

  INSERT INTO public.leads (
    full_name,
    phone,
    whatsapp_number,
    location,
    service_interest,
    service_id,
    source,
    status,
    priority,
    estimated_value,
    notes,
    booking_id,
    created_by
  )
  VALUES (
    v_client.full_name,
    v_client.phone,
    v_client.phone,
    NEW.service_location,
    v_service_name,
    v_service_id,
    'smart_booking',
    'won',
    'normal',
    GREATEST(COALESCE(v_booking.price, 0), 0),
    concat_ws(
      E'\n',
      format(
        'Created from Smart Booking request %s.',
        NEW.request_number
      ),
      CASE
        WHEN NEW.requested_date IS NOT NULL
          THEN format('Requested date: %s.', NEW.requested_date)
        ELSE NULL
      END,
      CASE
        WHEN NEW.requested_time IS NOT NULL
          THEN format('Requested time: %s.', NEW.requested_time)
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(btrim(NEW.customer_notes), '') IS NOT NULL
          THEN format('Customer notes: %s', btrim(NEW.customer_notes))
        ELSE NULL
      END,
      format('ERP booking: %s.', COALESCE(v_booking.booking_code, v_booking.id::text))
    ),
    v_booking.id,
    auth.uid()
  )
  RETURNING id INTO v_lead_id;

  v_activity_description := format(
    'Smart Booking request %s converted to ERP booking %s. Service: %s. Booking value: %s KES.',
    NEW.request_number,
    COALESCE(v_booking.booking_code, v_booking.id::text),
    v_service_name,
    COALESCE(v_booking.price, 0)
  );

  INSERT INTO public.crm_activities (
    client_id,
    lead_id,
    activity_type,
    subject,
    description,
    activity_date,
    created_by
  )
  VALUES (
    v_client.id,
    v_lead_id,
    'booking',
    'Smart Booking converted to ERP booking',
    v_activity_description,
    now(),
    auth.uid()
  );

  -- This update does not recurse: the trigger listens only for changes
  -- to status and converted_booking_id, not lead_id.
  UPDATE public.booking_engine_requests
     SET lead_id = v_lead_id
   WHERE id = NEW.id
     AND lead_id IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL
  ON FUNCTION public.link_booking_engine_conversion_to_crm()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_link_booking_engine_conversion_to_crm
  ON public.booking_engine_requests;

CREATE TRIGGER trg_link_booking_engine_conversion_to_crm
AFTER UPDATE OF status, converted_booking_id
ON public.booking_engine_requests
FOR EACH ROW
WHEN (
  NEW.status = 'converted'
  AND NEW.converted_booking_id IS NOT NULL
  AND NEW.lead_id IS NULL
)
EXECUTE FUNCTION public.link_booking_engine_conversion_to_crm();

COMMENT ON COLUMN public.booking_engine_requests.lead_id IS
  'CRM lead generated atomically when this Smart Booking request becomes an ERP booking.';

COMMENT ON FUNCTION public.link_booking_engine_conversion_to_crm() IS
  'Creates one CRM lead and booking activity for each newly converted authenticated Smart Booking request.';
