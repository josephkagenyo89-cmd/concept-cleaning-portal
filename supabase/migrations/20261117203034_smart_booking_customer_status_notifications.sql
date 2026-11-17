-- Notify the customer when staff posts an actionable Smart Booking update.
-- The existing booking notification trigger continues to handle the ERP booking handoff.
CREATE OR REPLACE FUNCTION public.notify_booking_engine_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer_user_id uuid;
  v_customer_id uuid;
  v_request_number text;
  v_title text;
  v_body text;
BEGIN
  IF NEW.actor_role NOT IN ('admin','super_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type NOT IN (
    'clarification_requested',
    'approved',
    'quote_required',
    'quote_prepared',
    'rejected',
    'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT r.customer_user_id, r.customer_id, r.request_number
    INTO v_customer_user_id, v_customer_id, v_request_number
  FROM public.booking_engine_requests r
  WHERE r.id = NEW.request_id;

  IF v_customer_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.event_type
    WHEN 'clarification_requested' THEN 'More information needed for your service request'
    WHEN 'approved' THEN 'Your service request has been approved'
    WHEN 'quote_required' THEN 'A quotation is being prepared for your request'
    WHEN 'quote_prepared' THEN 'Your service quotation is ready'
    WHEN 'rejected' THEN 'There is an update to your service request'
    WHEN 'cancelled' THEN 'Your service request has been cancelled'
    ELSE 'Your service request has been updated'
  END;

  v_body := COALESCE(
    NULLIF(btrim(NEW.message), ''),
    'There is an update to request ' || COALESCE(v_request_number, NEW.request_id::text) || '.'
  );

  INSERT INTO public.customer_notifications(user_id,client_id,type,title,body,link)
  VALUES (
    v_customer_user_id,
    v_customer_id,
    'booking_request',
    v_title,
    v_body,
    '/my/bookings?tab=requests'
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_booking_engine_request_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_booking_engine_request_event
  ON public.booking_engine_request_events;

CREATE TRIGGER trg_notify_booking_engine_request_event
AFTER INSERT ON public.booking_engine_request_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_engine_request_event();
