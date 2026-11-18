-- Complete customer photo deletion and bind photo paths to their draft request item.
-- The existing private bucket and upload workflow remain unchanged.

CREATE OR REPLACE FUNCTION public.booking_engine_validate_request_photo_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.booking_engine_request_items i
    WHERE i.id = NEW.request_item_id
      AND i.request_id = NEW.request_id
  ) THEN
    RAISE EXCEPTION 'The selected service item does not belong to this booking request.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_engine_validate_request_photo_item
  ON public.booking_engine_request_photos;

CREATE TRIGGER booking_engine_validate_request_photo_item
BEFORE INSERT OR UPDATE OF request_id, request_item_id
ON public.booking_engine_request_photos
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_validate_request_photo_item();

REVOKE ALL ON FUNCTION public.booking_engine_validate_request_photo_item() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Booking Engine customers upload own photos" ON storage.objects;
CREATE POLICY "Booking Engine customers upload own photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'booking-engine-photos'
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    JOIN public.booking_engine_request_items i
      ON i.request_id = r.id
    WHERE r.id::text = split_part(name, '/', 1)
      AND i.id::text = split_part(name, '/', 2)
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);

DROP POLICY IF EXISTS "Booking Engine customers delete own draft photos" ON storage.objects;
CREATE POLICY "Booking Engine customers delete own draft photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'booking-engine-photos'
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    JOIN public.booking_engine_request_items i
      ON i.request_id = r.id
    WHERE r.id::text = split_part(name, '/', 1)
      AND i.id::text = split_part(name, '/', 2)
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);