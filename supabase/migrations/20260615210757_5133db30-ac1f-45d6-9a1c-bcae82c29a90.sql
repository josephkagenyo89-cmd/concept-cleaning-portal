-- Booking drafts: human Booking ID, audit fields, completion %
CREATE SEQUENCE IF NOT EXISTS public.booking_code_seq START 1;

CREATE OR REPLACE FUNCTION public.next_booking_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'BK' || extract(year from now())::text || LPAD(nextval('public.booking_code_seq')::text, 5, '0')
$$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_code text,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid,
  ADD COLUMN IF NOT EXISTS last_modified_by_name text,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completion_percent int DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_code_key ON public.bookings(booking_code) WHERE booking_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_booking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_code IS NULL OR NEW.booking_code = '' THEN
    NEW.booking_code := public.next_booking_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_booking_code ON public.bookings;
CREATE TRIGGER trg_assign_booking_code
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.assign_booking_code();
