CREATE TABLE public.customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_notifications_user ON public.customer_notifications(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notifications TO authenticated;
GRANT ALL ON public.customer_notifications TO service_role;

ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own notifications" ON public.customer_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Customers insert own notifications" ON public.customer_notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Customers update own notifications" ON public.customer_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers delete own notifications" ON public.customer_notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Helper: create a notification for the customer linked to a CRM client
CREATE OR REPLACE FUNCTION public.notify_customer(_client_id uuid, _type text, _title text, _body text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  IF _client_id IS NULL THEN RETURN; END IF;
  SELECT user_id INTO target FROM public.clients WHERE id = _client_id;
  IF target IS NULL THEN RETURN; END IF;
  INSERT INTO public.customer_notifications (user_id, client_id, type, title, body, link)
  VALUES (target, _client_id, _type, _title, _body, _link);
END;
$$;

-- Bookings
CREATE OR REPLACE FUNCTION public.notify_customer_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_customer(NEW.client_id, 'booking',
      'Booking submitted',
      'We received your booking ' || COALESCE(NEW.booking_code, '') || ' for ' || NEW.service_date::text || '. Our team will confirm shortly.',
      '/my/bookings');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM public.notify_customer(NEW.client_id, 'booking',
        'Booking approved',
        'Your booking ' || COALESCE(NEW.booking_code, '') || ' has been approved and a team has been assigned.',
        '/my/bookings');
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.notify_customer(NEW.client_id, 'booking',
        'Booking cancelled',
        'Your booking ' || COALESCE(NEW.booking_code, '') || ' was cancelled. Contact customer care for help.',
        '/my/bookings');
    ELSIF NEW.status = 'fully_confirmed' THEN
      PERFORM public.notify_customer(NEW.client_id, 'booking',
        'Technician on the way',
        'Your booking ' || COALESCE(NEW.booking_code, '') || ' is locked in and our technician is scheduled.',
        '/my/bookings');
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.notify_customer(NEW.client_id, 'booking',
        'Service completed',
        'Your service is complete. Please share your feedback and rating.',
        '/my/bookings');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_customer_booking_ins
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_booking();

CREATE TRIGGER trg_notify_customer_booking_upd
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_booking();

-- Quotations (matched to the client by phone, quotations have no client_id)
CREATE OR REPLACE FUNCTION public.notify_customer_quotation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM public.clients WHERE phone = NEW.client_phone LIMIT 1;
  PERFORM public.notify_customer(cid, 'quotation',
    'Quotation ready',
    'Quotation ' || NEW.quotation_number || ' for ' || NEW.service_name || ' is ready to view.',
    '/my/bookings?tab=quotations');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_customer_quotation
AFTER INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_quotation();

-- Invoices
CREATE OR REPLACE FUNCTION public.notify_customer_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_customer(NEW.client_id, 'invoice',
      'Invoice generated',
      'Invoice ' || NEW.invoice_number || ' for ' || NEW.service || ' is available in your portal.',
      '/my/documents?tab=invoices');
  ELSIF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    PERFORM public.notify_customer(NEW.client_id, 'receipt',
      'Payment received',
      'We have received your payment for invoice ' || NEW.invoice_number || '. Your receipt is ready.',
      '/my/documents?tab=receipts');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_customer_invoice_ins
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_invoice();

CREATE TRIGGER trg_notify_customer_invoice_upd
AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_invoice();

-- Receipt documents
CREATE OR REPLACE FUNCTION public.notify_customer_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.document_type ILIKE '%receipt%' THEN
    PERFORM public.notify_customer(NEW.client_id, 'receipt',
      'Receipt generated',
      'Receipt ' || NEW.document_number || ' is available in your portal.',
      '/my/documents?tab=receipts');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_customer_document
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_document();

-- Service completion certificates
CREATE OR REPLACE FUNCTION public.notify_customer_certificate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_customer(NEW.client_id, 'certificate',
    'Service certificate issued',
    'Certificate ' || NEW.certificate_number || ' has been issued for your completed service.',
    '/my/documents?tab=certificates');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_customer_certificate
AFTER INSERT ON public.service_certificates
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_certificate();