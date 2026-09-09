CREATE OR REPLACE FUNCTION public.assign_booking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.booking_code IS NULL OR btrim(NEW.booking_code) = '' THEN
    LOOP
      attempts := attempts + 1;
      candidate := public.next_booking_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE booking_code = candidate);
      IF attempts > 100 THEN
        RAISE EXCEPTION 'Unable to allocate a unique booking code';
      END IF;
    END LOOP;
    NEW.booking_code := candidate;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the sequence is ahead of any existing sequential code
SELECT setval('public.booking_code_seq', GREATEST(
  (SELECT COALESCE(MAX(NULLIF(regexp_replace(booking_code, '^BK\d{4}', ''), '')::bigint), 0)
     FROM public.bookings WHERE booking_code ~ '^BK\d{9}$'),
  (SELECT last_value FROM public.booking_code_seq)
));