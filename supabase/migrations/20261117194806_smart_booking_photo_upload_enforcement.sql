-- Enable the existing private Booking Engine photo workflow.
-- The storage bucket and ownership policies already exist; this adds server-side
-- photo-count enforcement and conservative image upload limits.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'booking-engine-photos';

CREATE INDEX IF NOT EXISTS booking_engine_request_photos_request_item_idx
  ON public.booking_engine_request_photos(request_id, request_item_id, display_order);

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old_select text := 'SELECT i.*, c.measurement_config, c.photo_mode';
  v_new_select text := 'SELECT i.*, c.measurement_config, c.photo_mode, c.photo_min, c.photo_max';
  v_old_photo_check text := $old$
    IF v_item.photo_mode = 'required' THEN
      RAISE EXCEPTION 'Required photo upload is not supported in this booking form. Contact our team before submitting.';
    END IF;
$old$;
  v_new_photo_check text := $new$
    IF v_item.photo_mode = 'required' THEN
      SELECT count(*) INTO v_photo_count
      FROM public.booking_engine_request_photos p
      WHERE p.request_id = v_item.request_id
        AND p.request_item_id = v_item.id;
      IF v_photo_count < GREATEST(COALESCE(v_item.photo_min, 1), 1) THEN
        RAISE EXCEPTION 'Upload at least % photo(s) for this service.', GREATEST(COALESCE(v_item.photo_min, 1), 1);
      END IF;
    END IF;
    IF v_item.photo_max > 0 THEN
      SELECT count(*) INTO v_photo_count
      FROM public.booking_engine_request_photos p
      WHERE p.request_id = v_item.request_id
        AND p.request_item_id = v_item.id;
      IF v_photo_count > v_item.photo_max THEN
        RAISE EXCEPTION 'Remove photos until no more than % remain for this service.', v_item.photo_max;
      END IF;
    END IF;
$new$;
BEGIN
  v_definition := pg_get_functiondef('public.submit_booking_engine_request(uuid)'::regprocedure);
  v_updated := replace(v_definition, '  v_selected jsonb;', '  v_selected jsonb;' || E'\n  v_photo_count integer;');
  v_updated := replace(v_updated, v_old_select, v_new_select);
  v_updated := replace(v_updated, v_old_photo_check, v_new_photo_check);

  IF v_updated = v_definition
     OR position(v_new_select in v_updated) = 0
     OR position(v_new_photo_check in v_updated) = 0
     OR position('v_photo_count integer' in v_updated) = 0 THEN
    RAISE EXCEPTION 'Could not safely patch the existing Booking Engine submission function. No function changes were applied.';
  END IF;

  EXECUTE v_updated;
END
$migration$;

REVOKE ALL ON FUNCTION public.submit_booking_engine_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_booking_engine_request(uuid) TO authenticated;